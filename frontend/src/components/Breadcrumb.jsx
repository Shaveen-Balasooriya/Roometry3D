import React, { useState, useEffect } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { doc, getDoc } from 'firebase/firestore';
import { db, auth } from '../services/firebase';
import './Breadcrumb.css';

// Complete route map with labels
const ROUTE_MAP = {
  // Admin routes
  '/admin': 'Admin Dashboard',
  '/furniture-dashboard': 'Furniture Dashboard',
  '/furniture-list': 'Furniture List',
  '/add-furniture': 'Add Furniture',
  '/update-furniture': 'Update Furniture', 
  '/users-dashboard': 'Users Dashboard',
  '/add-user': 'Add User',
  '/upload-room': 'Upload Room',
  
  // Client/Designer routes
  '/': 'Home',
  '/client-home': 'Dashboard',
  '/projects': 'Projects',
  '/my-projects': 'My Projects',
  '/create-project': 'Create Project',
  '/profile': 'Profile',
  '/edit-profile': 'Edit Profile',
  '/furniture-catalogue': 'Furniture Catalogue',
  '/customer-designer-furniture-catalogue': 'Furniture Catalogue',
  '/model-viewer': '3D Viewer',
  '/room': 'Room',
  
  // Special patterns
  '/view-project': 'Project Details',
  '/edit-project': 'Edit Project',
  '/view-furniture': 'Furniture Details',
  '/edit-furniture': 'Edit Furniture',
  '/update-furniture': 'Update Furniture',
  '/edit-user': 'Edit User'
};

// Define navigation contexts for proper back navigation
const NAVIGATION_CONTEXTS = {
  '/edit-project': {
    backPattern: '/view-project/%id%',
    backLabel: 'Project Details'
  },
  '/view-project': {
    backPattern: '/my-projects',
    backLabel: 'My Projects'
  },
  '/edit-furniture': {
    backPattern: '/view-furniture/%id%',
    backLabel: 'Furniture Details'
  },
  '/view-furniture': {
    backPattern: '/furniture-catalogue',
    backLabel: 'Furniture Catalogue'
  },
  '/update-furniture': {
    // This will be dynamically determined based on user role
    getBackInfo: (userRole) => {
      return userRole === 'admin' 
        ? { backPattern: '/furniture-dashboard', backLabel: 'Furniture Dashboard' }
        : { backPattern: '/customer-designer-furniture-catalogue', backLabel: 'Furniture Catalogue' };
    }
  },
  '/edit-user': {
    backPattern: '/users-dashboard',
    backLabel: 'Users Dashboard'
  }
};

function Breadcrumb({ customPaths }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  const [dynamicLabels, setDynamicLabels] = useState({});
  
  // Track actual navigation history with sessionStorage
  useEffect(() => {
    const storeNavigationHistory = () => {
      try {
        // Get current navigation history
        const navigationHistory = JSON.parse(sessionStorage.getItem('navigationHistory') || '[]');
        
        // Don't add duplicate entries
        if (navigationHistory.length > 0 && 
            navigationHistory[navigationHistory.length - 1].path === location.pathname) {
          return;
        }
        
        // Add current path to history (limit to last 10 entries)
        navigationHistory.push({
          path: location.pathname,
          timestamp: Date.now()
        });
        
        // Keep only last 10 entries
        const limitedHistory = navigationHistory.slice(-10);
        
        // Save back to sessionStorage
        sessionStorage.setItem('navigationHistory', JSON.stringify(limitedHistory));
      } catch (error) {
        console.error('Error storing navigation history:', error);
      }
    };
    
    storeNavigationHistory();
  }, [location.pathname]);
  
  // Get user role
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          const idTokenResult = await user.getIdTokenResult();
          setUserRole(idTokenResult.claims.role);
        } catch (error) {
          console.error("Error fetching user role:", error);
        }
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });
    
    return () => unsubscribe();
  }, []);
  
  // Fetch names for any IDs in the URL
  useEffect(() => {
    fetchResourceNames();
  }, [location.pathname]);
  
  const fetchResourceNames = async () => {
    const pathParts = location.pathname.split('/').filter(Boolean);
    const idPattern = /^[a-zA-Z0-9_-]{10,}$/;
    const newLabels = { ...dynamicLabels };
    let hasNewLabels = false;
    
    // Check each path part to see if it's an ID that needs resolution
    for (let i = 0; i < pathParts.length; i++) {
      const part = pathParts[i];
      
      // Skip if already resolved or doesn't match ID pattern
      if (dynamicLabels[part] || !idPattern.test(part)) {
        continue;
      }
      
      // Determine collection based on URL context
      let collection = '';
      let nameField = 'name';
      
      if (i > 0) {
        const prevPart = pathParts[i-1];
        
        // Map URL patterns to collections
        if (prevPart === 'view-project' || prevPart === 'edit-project') {
          collection = 'projects';
        } else if (prevPart === 'view-furniture' || prevPart === 'edit-furniture' || prevPart === 'update-furniture') {
          collection = 'furniture';
        } else if (prevPart === 'edit-user') {
          collection = 'users';
          nameField = 'displayName';
        }
      }
      
      // If we couldn't determine collection from previous part,
      // check the overall URL pattern
      if (!collection) {
        if (location.pathname.includes('/projects/') || 
            location.pathname.includes('/view-project/') || 
            location.pathname.includes('/edit-project/')) {
          collection = 'projects';
        } else if (location.pathname.includes('/furniture/') || 
                  location.pathname.includes('/view-furniture/') || 
                  location.pathname.includes('/edit-furniture/') ||
                  location.pathname.includes('/update-furniture/')) {
          collection = 'furniture';  
        } else if (location.pathname.includes('/users/')) {
          collection = 'users';
          nameField = 'displayName';
        }
      }
      
      // If we determined a collection, fetch the document to get its name
      if (collection) {
        try {
          const docRef = doc(db, collection, part);
          const docSnap = await getDoc(docRef);
          
          if (docSnap.exists()) {
            const data = docSnap.data();
            newLabels[part] = data[nameField] || 'Unknown';
            hasNewLabels = true;
          }
        } catch (error) {
          console.error(`Error fetching name for ID ${part}:`, error);
        }
      }
    }
    
    // Update state if we found any new labels
    if (hasNewLabels) {
      setDynamicLabels(prevLabels => ({...prevLabels, ...newLabels}));
    }
  };
  
  const handleHomeClick = (e) => {
    e.preventDefault();
    if (userRole === 'admin') {
      navigate('/admin');
    } else if (userRole === 'client' || userRole === 'designer') {
      navigate('/client-home');
    } else {
      navigate('/login');
    }
  };
  
  // Generate breadcrumb segments based on current path and navigation history
  const generateBreadcrumbs = () => {
    const pathSegments = location.pathname.split('/').filter(Boolean);
    const result = [];
    
    // Handle special client home page at root path
    if (location.pathname === '/' || location.pathname === '/client-home') {
      return [{ name: 'Dashboard', path: '/client-home' }];
    }
    
    // Handle special case for direct path navigation (view/edit with IDs)
    if (pathSegments.length >= 2) {
      const firstSegment = pathSegments[0];
      const secondSegment = pathSegments[1];
      const isIdPattern = /^[a-zA-Z0-9_-]{10,}$/.test(secondSegment);
      
      // Special patterns for edit/view pages with IDs
      if (isIdPattern) {
        const context = NAVIGATION_CONTEXTS[`/${firstSegment}`];
        
        if (context) {
          // If this is for update-furniture, determine the back navigation based on user role
          if (firstSegment === 'update-furniture') {
            const backInfo = context.getBackInfo(userRole);
            return [
              { name: backInfo.backLabel, path: backInfo.backPattern },
              { name: dynamicLabels[secondSegment] || 'Update Furniture', path: location.pathname }
            ];
          }
          
          // Get proper back navigation
          const backPath = context.backPattern.replace('%id%', secondSegment);
          
          // If it's an edit page that should go back to view page
          if (firstSegment === 'edit-project') {
            return [
              { name: 'My Projects', path: '/my-projects' },
              { name: dynamicLabels[secondSegment] || 'Project Details', path: `/view-project/${secondSegment}` },
              { name: 'Edit Project', path: location.pathname }
            ];
          } 
          
          if (firstSegment === 'view-project') {
            return [
              { name: 'My Projects', path: '/my-projects' },
              { name: dynamicLabels[secondSegment] || 'Project Details', path: location.pathname }
            ];
          }
          
          if (firstSegment === 'edit-furniture') {
            return [
              { name: 'Furniture Catalogue', path: '/furniture-catalogue' },
              { name: dynamicLabels[secondSegment] || 'Furniture Details', path: `/view-furniture/${secondSegment}` },
              { name: 'Edit Furniture', path: location.pathname }
            ];
          }
          
          if (firstSegment === 'view-furniture') {
            return [
              { name: 'Furniture Catalogue', path: '/furniture-catalogue' },
              { name: dynamicLabels[secondSegment] || 'Furniture Details', path: location.pathname }
            ];
          }
          
          // For other special page types
          if (context.backPattern && context.backLabel) {
            const parentPath = context.backPattern.replace('%id%', secondSegment);
            
            result.push({
              name: context.backLabel,
              path: parentPath
            });
            
            result.push({
              name: dynamicLabels[secondSegment] || ROUTE_MAP[`/${firstSegment}`] || formatSegmentName(firstSegment),
              path: location.pathname
            });
            
            return result;
          }
        }
      }
    }
    
    // For standard routes, build breadcrumb path from segments
    let currentPath = '';
    
    for (let i = 0; i < pathSegments.length; i++) {
      const segment = pathSegments[i];
      currentPath += `/${segment}`;
      
      // Check if this looks like an ID
      const isIdPattern = /^[a-zA-Z0-9_-]{10,}$/.test(segment);
      
      if (isIdPattern && dynamicLabels[segment]) {
        // We have a resolved name for this ID
        result.push({
          name: dynamicLabels[segment],
          path: currentPath
        });
      } else if (isIdPattern) {
        // It's an ID but we don't have a name for it yet
        // Try to infer a descriptive name from context
        let itemName = 'Details';
        
        if (i > 0) {
          const prevSegment = pathSegments[i-1];
          if (prevSegment === 'view-project') itemName = 'Project Details';
          else if (prevSegment === 'edit-project') itemName = 'Edit Project';
          else if (prevSegment === 'view-furniture') itemName = 'Furniture Details';
          else if (prevSegment === 'edit-furniture') itemName = 'Edit Furniture';
          else if (prevSegment === 'update-furniture') itemName = 'Update Furniture';
        }
        
        result.push({
          name: itemName,
          path: currentPath
        });
      } else {
        // It's a normal path segment
        const pathKey = `/${segment}`;
        const name = ROUTE_MAP[pathKey] || formatSegmentName(segment);
        
        result.push({
          name,
          path: currentPath
        });
      }
    }
    
    return result;
  };
  
  // Helper function to format segment names
  const formatSegmentName = (segment) => {
    return segment
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };
  
  // Use custom paths if provided, otherwise generate from current location
  const breadcrumbSegments = customPaths || generateBreadcrumbs();
  
  if (loading) {
    return null;
  }
  
  return (
    <nav className="breadcrumb-container" aria-label="Breadcrumb">
      <ol className="breadcrumb">
        <li className="breadcrumb-item">
          <a href="#" onClick={handleHomeClick}>
            <span className="breadcrumb-home-icon">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
                <polyline points="9 22 9 12 15 12 15 22"></polyline>
              </svg>
            </span>
            <span>Home</span>
          </a>
        </li>
        
        {breadcrumbSegments.map((segment, index) => (
          <li 
            key={`${segment.path}-${index}`}
            className={`breadcrumb-item ${index === breadcrumbSegments.length - 1 ? 'active' : ''}`}
          >
            {index === breadcrumbSegments.length - 1 ? (
              <span>{segment.name}</span>
            ) : (
              <Link to={segment.path}>{segment.name}</Link>
            )}
          </li>
        ))}
      </ol>
    </nav>
  );
}

export default Breadcrumb;