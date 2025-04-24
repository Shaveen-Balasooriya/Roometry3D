import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth, getUserRole } from '../services/firebase';
import './Navbar.css';

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const mobileMenuRef = useRef(null);
  const userDropdownRef = useRef(null);
  const userButtonRef = useRef(null);

  // Close mobile menu when location changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
    setIsDropdownOpen(false);
  }, [location]);

  // Check for user authentication status and role
  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (currentUser) => {
      setUser(currentUser);
      if (currentUser) {
        const role = await getUserRole();
        setUserRole(role);
      } else {
        setUserRole(null);
      }
    });
    
    return () => unsubscribe();
  }, []);

  // Handle scroll events for navbar styling
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  // Handle clicks outside of dropdown and mobile menu
  const handleClickOutside = useCallback((event) => {
    // Close user dropdown when clicking outside
    if (
      isDropdownOpen && 
      userDropdownRef.current && 
      !userDropdownRef.current.contains(event.target) &&
      userButtonRef.current && 
      !userButtonRef.current.contains(event.target)
    ) {
      setIsDropdownOpen(false);
    }
    
    // Close mobile menu when clicking outside (but not on very small screens)
    if (
      isMobileMenuOpen && 
      mobileMenuRef.current && 
      !mobileMenuRef.current.contains(event.target) &&
      window.innerWidth > 480
    ) {
      setIsMobileMenuOpen(false);
    }
  }, [isDropdownOpen, isMobileMenuOpen]);

  // Add event listener for clicks outside
  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [handleClickOutside]);

  // Handle escape key press
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === 'Escape') {
        setIsDropdownOpen(false);
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener('keydown', handleEscKey);
    return () => {
      document.removeEventListener('keydown', handleEscKey);
    };
  }, []);

  // Toggle dropdown with proper focus management
  const toggleDropdown = () => {
    setIsDropdownOpen(prev => !prev);
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate('/login');
    } catch (error) {
      console.error('Error signing out: ', error);
    }
  };

  // Function to get first letter of user's name for avatar
  const getInitial = () => {
    if (user && user.displayName) {
      return user.displayName.charAt(0).toUpperCase();
    }
    return 'U';
  };

  // Get role display info
  const getRoleDisplay = (role) => {
    if (!role) return { text: 'User' };
    
    switch(role.toLowerCase()) {
      case 'admin':
        return { icon: '👑', text: 'Administrator' };
      case 'designer':
        return { icon: '🎨', text: 'Designer' };
      case 'client':
        return { icon: '👤', text: 'Client' };
      default:
        return { icon: '👤', text: 'User' };
    }
  };

  // Toggle body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isMobileMenuOpen]);

  // Filter navigation links based on user role
  const getNavLinks = () => {
    const baseLinks = [
      { to: "/", label: "Home" },
    ];
    
    // Add role-specific links
    if (userRole === 'admin') {
      baseLinks.push(
        { to: "/add-furniture", label: "Add Furniture" },
        { to: "/furniture-dashboard", label: "Manage Furniture" },
        { to: "/add-user", label: "Add User" },
        { to: "/users-dashboard", label: "Users Dashboard" }
      );
    } else if (userRole === 'designer') {
      baseLinks.push(
        { to: "/furniture-dashboard", label: "Browse Furniture" },
        { to: "/my-projects", label: "My Projects" }
      );
    } else if (userRole === 'client') {
      baseLinks.push(
        { to: "/my-projects", label: "My Projects" }
      );
    }
    
    return baseLinks;
  };

  const navLinks = getNavLinks();

  return (
    <nav className={`navbar ${isScrolled ? 'scrolled' : ''}`} role="navigation">
      <div className="navbar-content">
        <Link to="/" className="navbar-title" aria-label="Roometry Home">
          Roometry
        </Link>
        
        <button 
          className={`mobile-menu-toggle ${isMobileMenuOpen ? 'open' : ''}`}
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          aria-label="Toggle navigation menu"
          aria-expanded={isMobileMenuOpen}
          aria-controls="navbar-links"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
        
        <div 
          id="navbar-links"
          ref={mobileMenuRef}
          className={`navbar-links ${isMobileMenuOpen ? 'open' : ''}`}
          aria-hidden={!isMobileMenuOpen && window.innerWidth <= 768}
        >
          {navLinks.map((link, index) => (
            <Link 
              key={index} 
              to={link.to} 
              className={location.pathname === link.to ? 'active' : ''}
            >
              {link.label}
            </Link>
          ))}
        </div>
        
        {user ? (
          <div className="user-menu" ref={userDropdownRef}>
            <button 
              ref={userButtonRef}
              className="user-info"
              onClick={toggleDropdown}
              aria-expanded={isDropdownOpen}
              aria-label="User menu"
            >
              <div className="user-avatar">{getInitial()}</div>
              <div className="user-name">{user.displayName || 'User'}</div>
              <div className={`dropdown-arrow ${isDropdownOpen ? 'open' : ''}`}>▼</div>
            </button>
            
            {isDropdownOpen && (
              <div 
                className="user-dropdown" 
                role="menu"
                aria-labelledby="user-menu-button"
              >
                <div className="dropdown-item user-role">
                  {userRole && (
                    <>
                      <span style={{ marginRight: '8px' }}>{getRoleDisplay(userRole).icon}</span>
                      {getRoleDisplay(userRole).text}
                    </>
                  )}
                </div>
                <div className="dropdown-divider" role="separator"></div>
                <Link to="/profile" className="dropdown-item" role="menuitem">My Profile</Link>
                {userRole === 'client' && (
                  <Link to="/my-projects" className="dropdown-item" role="menuitem">My Projects</Link>
                )}
                {userRole === 'designer' && (
                  <Link to="/my-projects" className="dropdown-item" role="menuitem">My Projects</Link>
                )}
                <div className="dropdown-divider" role="separator"></div>
                <button 
                  className="dropdown-item logout" 
                  onClick={handleLogout} 
                  role="menuitem"
                >
                  Logout
                </button>
              </div>
            )}
          </div>
        ) : (
          <Link to="/login" className="login-button">
            <span>Login</span>
          </Link>
        )}
      </div>
    </nav>
  );
}
