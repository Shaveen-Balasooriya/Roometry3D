import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase'; 
import { useState, useEffect } from 'react';
import './Breadcrumb.css';

/**
 * Breadcrumb navigation component
 * @param {Object} props - Component properties
 * @param {Array} props.customPaths - Optional custom path segments to override automatic paths
 */
function Breadcrumb({ customPaths }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [userRole, setUserRole] = useState(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (user) {
        try {
          // Get the ID token result which contains the custom claims
          const idTokenResult = await user.getIdTokenResult();
          // Set the user role from custom claims
          setUserRole(idTokenResult.claims.role);
        } catch (error) {
          console.error("Error fetching user role:", error);
        }
      } else {
        setUserRole(null);
      }
      setLoading(false);
    });
    
    // Clean up subscription
    return () => unsubscribe();
  }, []);
  
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
  
  // If custom paths are provided, use those instead of automatically generating from URL
  const pathSegments = customPaths || getPathSegmentsFromUrl(location.pathname);
  
  if (loading) {
    return null; // Don't render anything while loading
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
        
        {pathSegments.map((segment, index) => (
          <li 
            key={index} 
            className={`breadcrumb-item ${index === pathSegments.length - 1 ? 'active' : ''}`}
          >
            {index === pathSegments.length - 1 ? (
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

/**
 * Convert URL path to structured breadcrumb segments
 * @param {string} pathname - The current URL path
 * @returns {Array} Array of path segments with names and URLs
 */
function getPathSegmentsFromUrl(pathname) {
  // Skip empty segments and filter out any unwanted segments
  const segments = pathname.split('/').filter(segment => segment !== '');
  
  // Path mapping from URL segments to user-friendly names
  const pathMapping = {
    'admin': 'Admin Dashboard',
    'furniture-dashboard': 'Furniture Dashboard',
    'furniture-list': 'Furniture List',
    'add-furniture': 'Add Furniture',
    'update-furniture': 'Update Furniture',
    'projects': 'Projects',
    'my-projects': 'My Projects',
    'create-project': 'Create Project',
    'view-project': 'View Project',
    'edit-project': 'Edit Project',
    'users-dashboard': 'Users Dashboard',
    'add-user': 'Add User',
    'edit-user': 'Edit User',
    'upload-room': 'Upload Room'
  };
  
  const result = [];
  let currentPath = '';
  
  segments.forEach((segment, index) => {
    // Build cumulative path
    currentPath += `/${segment}`;
    
    // Handle special case: IDs in URLs
    if (segment.match(/^[a-zA-Z0-9]{20,}$/)) {
      // This looks like a Firebase ID, so we'll use the previous segment + "Details"
      const prevSegment = segments[index - 1];
      const prevName = pathMapping[prevSegment] || formatSegmentName(prevSegment);
      result.push({
        name: prevName + " Details",
        path: currentPath
      });
    } else {
      // Normal path segment
      const name = pathMapping[segment] || formatSegmentName(segment);
      result.push({
        name: name,
        path: currentPath
      });
    }
  });
  
  return result;
}

/**
 * Format URL segment into a readable name
 * @param {string} segment - URL segment to format
 * @returns {string} Formatted name
 */
function formatSegmentName(segment) {
  if (!segment) return '';
  
  // Convert kebab-case to Title Case
  return segment
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

export default Breadcrumb;