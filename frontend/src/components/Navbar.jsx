import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { signOut } from "firebase/auth";
import { auth, getUserRole } from "../services/firebase";
import "./Navbar.css";

export default function Navbar() {
  const [user, setUser] = useState(null);
  const [userRole, setUserRole] = useState(null);
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [cartItemCount, setCartItemCount] = useState(0);
  const navigate = useNavigate();
  const location = useLocation();
  const mobileMenuRef = useRef(null);
  const userDropdownRef = useRef(null);

  // Close mobile menu when location changes
  useEffect(() => {
    setIsMobileMenuOpen(false);
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

  // Load cart item count from localStorage
  useEffect(() => {
    const updateCartCount = () => {
      try {
        const cartJSON = localStorage.getItem('cart');
        if (cartJSON) {
          const parsedCart = JSON.parse(cartJSON);
          if (Array.isArray(parsedCart)) {
            setCartItemCount(parsedCart.length);
          } else {
            setCartItemCount(0);
          }
        } else {
          setCartItemCount(0);
        }
      } catch (error) {
        console.error('Error loading cart count:', error);
        setCartItemCount(0);
      }
    };

    // Initial load
    updateCartCount();

    // Set up a listener for storage events to update cart count when changed
    const handleStorageChange = (e) => {
      if (e.key === 'cart') {
        updateCartCount();
      }
    };

    window.addEventListener('storage', handleStorageChange);
    
    // Also set up an interval to check for changes (for cross-tab sync)
    const interval = setInterval(updateCartCount, 5000);

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  // Handle scroll events for navbar styling
  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener("scroll", handleScroll);
    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Close dropdown and mobile menu when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      // Close user dropdown when clicking outside
      if (
        isDropdownOpen &&
        userDropdownRef.current &&
        !userDropdownRef.current.contains(event.target)
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
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isDropdownOpen, isMobileMenuOpen]);

  // Handle escape key press
  useEffect(() => {
    const handleEscKey = (event) => {
      if (event.key === "Escape") {
        setIsDropdownOpen(false);
        setIsMobileMenuOpen(false);
      }
    };

    document.addEventListener("keydown", handleEscKey);
    return () => {
      document.removeEventListener("keydown", handleEscKey);
    };
  }, []);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/login");
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  // Function to get first letter of user's name for avatar
  const getInitial = () => {
    if (user && user.displayName) {
      return user.displayName.charAt(0).toUpperCase();
    }
    return "U";
  };

  // Get role display info
  const getRoleDisplay = (role) => {
    if (!role) return { text: "User" };

    switch (role.toLowerCase()) {
      case "admin":
        return { icon: "👑", text: "Administrator" };
      case "designer":
        return { icon: "🎨", text: "Designer" };
      case "client":
        return { icon: "👤", text: "Client" };
      default:
        return { icon: "👤", text: "User" };
    }
  };

  // Toggle body scroll when mobile menu is open
  useEffect(() => {
    if (isMobileMenuOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isMobileMenuOpen]);

  return (
    <nav className={`navbar ${isScrolled ? "scrolled" : ""}`} role="navigation">
      <div className="navbar-content">
        <Link
          to="/my-projects"
          className="navbar-title"
          aria-label="Roometry Home"
        >
          Roometry
        </Link>

        <button
          className={`mobile-menu-toggle ${isMobileMenuOpen ? "open" : ""}`}
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
          className={`navbar-links ${isMobileMenuOpen ? "open" : ""}`}
          aria-hidden={!isMobileMenuOpen && window.innerWidth <= 768}
        >
          {/* <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Link> */}
          {/* User Management Links - visible only to admins */}
          {userRole === "admin" && (
            <>
              <Link
                to="/"
                className={location.pathname === "/" ? "active" : ""}
              >
                Home
              </Link>
            </>
          )}


          {/* Links - visible to designers and client */}
          {userRole && (userRole === "client" || userRole === "designer") && (
            <>
              <Link
                to="/my-projects"
                className={location.pathname === "/my-projects" ? "active" : ""}
              >
                Projects
              </Link>
              <Link
                to="/create-project"
                className={
                  location.pathname === "/create-project" ? "active" : ""
                }
              >
                Create Project
              </Link>
              <Link
                to="/customer-designer-furniture-catalogue"
                className={
                  location.pathname === "/customer-designer-furniture-catalogue"? "active": ""
                } 
              >
                Furniture Catalogue
              </Link>
            </>
          )}

          {/* Furniture Management Links - visible to designers and admins */}
          {userRole && (userRole === "admin" || userRole === "designer") && (
            <>
              <Link
                to="/add-furniture"
                className={
                  location.pathname === "/add-furniture" ? "active" : ""
                }
              >
                Add Furniture
              </Link>
              {/* <Link
                to="/furniture-dashboard"
                className={
                  location.pathname === "/furniture-dashboard" ? "active" : ""
                }
              >
                Manage Furniture
              </Link> */}
            </>
          )}

          {/* User Management Links - visible only to admins */}
          {userRole === "admin" && (
            <>
                          <Link
                to="/furniture-dashboard"
                className={
                  location.pathname === "/furniture-dashboard" ? "active" : ""
                }
              >
                Manage Furniture
              </Link>
              <Link
                to="/add-user"
                className={location.pathname === "/add-user" ? "active" : ""}
              >
                Add User
              </Link>
              <Link
                to="/users-dashboard"
                className={
                  location.pathname === "/users-dashboard" ? "active" : ""
                }
              >
                Users Dashboard
              </Link>
            </>
          )}
        </div>

        {user ? (
          <div className="navbar-actions">
            {/* Cart icon - visible to clients and designers */}
            {userRole && (userRole === "client" || userRole === "designer") && (
              <Link 
                to="/cart" 
                className="cart-icon-link"
                aria-label="Shopping cart"
                title="View cart"
              >
                <div className="cart-icon">
                  🛒
                  {cartItemCount > 0 && (
                    <span className="cart-count">{cartItemCount}</span>
                  )}
                </div>
              </Link>
            )}
            
            <div className="user-menu" ref={userDropdownRef}>
              <button
                className="user-info"
                onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                aria-expanded={isDropdownOpen}
                aria-label="User menu"
              >
                <div className="user-avatar">{getInitial()}</div>
                <div className="user-name">{user.displayName || "User"}</div>
                <div className={`dropdown-arrow ${isDropdownOpen ? "open" : ""}`}>
                  ▼
                </div>
              </button>

              {isDropdownOpen && (
                <div className="user-dropdown" role="menu">
                  <div className="dropdown-item user-role">
                    {userRole && (
                      <>
                        <span style={{ marginRight: "8px" }}>
                          {getRoleDisplay(userRole).icon}
                        </span>
                        {getRoleDisplay(userRole).text}
                      </>
                    )}
                  </div>
                  <div className="dropdown-divider" role="separator"></div>
                  <Link to="/profile" className="dropdown-item" role="menuitem">
                    My Profile
                  </Link>
                  <Link
                    to="/my-projects"
                    className="dropdown-item"
                    role="menuitem"
                  >
                    My Projects
                  </Link>
                  {userRole && (userRole === "client" || userRole === "designer") && (
                    <Link
                      to="/cart"
                      className="dropdown-item"
                      role="menuitem"
                    >
                      My Cart {cartItemCount > 0 && `(${cartItemCount})`}
                    </Link>
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
