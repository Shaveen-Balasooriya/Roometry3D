import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MetricCard from './components/MetricCard';
import './HomePage.css';
import { auth } from '../services/firebase'; // Adjust the path as needed

// Enhanced icon components with better accessibility
const IconFurniture = () => <div className="icon-placeholder" aria-hidden="true">F</div>;
const IconUsers = () => <div className="icon-placeholder" aria-hidden="true">U</div>;
const IconProjects = () => <div className="icon-placeholder" aria-hidden="true">P</div>;
const IconOrders = () => <div className="icon-placeholder" aria-hidden="true">O</div>;
const IconHomeScan = () => <div className="icon-placeholder" aria-hidden="true">H</div>;
const API_URL = import.meta.env.VITE_BACKEND_URL;

export default function HomePage() {
  // State for metrics - will be populated from backend
  const [metrics, setMetrics] = useState({
    projectsToday: 0,
    totalDesigners: 0,
    totalProjects: 0,
    checkedOutProjects: 0
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchMetrics = async () => {
      setLoading(true);
      try {
        // Get the current user's auth token
        const user = auth.currentUser;
        if (!user) {
          throw new Error('You must be logged in to access this page');
        }
        
        const idToken = await user.getIdToken();
        const headers = {
          'Authorization': `Bearer ${idToken}`
        };

        // Fetch all metrics in parallel
        const [projectsTodayRes, designersRes, totalProjectsRes] = await Promise.all([
          fetch(`${API_URL}/api/count/todayProjects`, { headers }),
          fetch(`${API_URL}/api/count/designers`, { headers }),
          fetch(`${API_URL}/api/count/totalProjcts`, { headers })
        ]);

        // Check for errors
        if (!projectsTodayRes.ok || !designersRes.ok || !totalProjectsRes.ok) {
          throw new Error('Failed to fetch one or more metrics');
        }

        // Parse responses
        const projectsTodayData = await projectsTodayRes.json();
        const designersData = await designersRes.json();
        const totalProjectsData = await totalProjectsRes.json();

        // Update state with fetched data
        setMetrics({
          projectsToday: projectsTodayData.count,
          totalDesigners: designersData.count,
          totalProjects: totalProjectsData.count,
          checkedOutProjects: 0 // You'd need to fetch this separately
        });
        
        setError(null);
      } catch (err) {
        console.error("Error fetching metrics:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchMetrics();
  }, []);

  // Navigation links
  const navLinks = [
    { title: "Add Furniture", path: "/add-furniture", icon: <IconFurniture />, ariaLabel: "Navigate to Add Furniture page" },
    { title: "Furniture Dashboard", path: "/furniture-dashboard", icon: <IconFurniture />, ariaLabel: "Navigate to Furniture Dashboard page" },
    { title: "Upload Room", path: "/upload-room", icon: <IconHomeScan />, ariaLabel: "Navigate to Upload Room page" },
    { title: "Add User", path: "/add-user", icon: <IconUsers />, ariaLabel: "Navigate to Add User page" },
    { title: "Users Dashboard", path: "/users-dashboard", icon: <IconUsers />, ariaLabel: "Navigate to Users Dashboard page" }
  ];

  return (
    <main className="home-content">
      <section className="welcome-section">
        <h2>Welcome to Roometry 3D Admin</h2>
      </section>
      
      {/* Dashboard Stats Section */}
      <h3 className="section-title">Dashboard Overview</h3>
      {error && <div className="error-message" role="alert">Error loading metrics: {error}</div>}
      
      <div className="metrics-container">
        <MetricCard 
          title="Projects Added Today" 
          amount={loading ? 'Loading...' : metrics.projectsToday} 
          icon={<IconProjects />} 
        />
        <MetricCard 
          title="Designers" 
          amount={loading ? 'Loading...' : metrics.totalDesigners} 
          icon={<IconUsers />} 
        />
        <MetricCard 
          title="Total Projects" 
          amount={loading ? 'Loading...' : metrics.totalProjects} 
          icon={<IconProjects />} 
        />
        <MetricCard 
          title="Checked Out Projects" 
          amount={loading ? 'Loading...' : metrics.checkedOutProjects} 
          icon={<IconOrders />} 
        />
      </div>
      
      {/* Clear section separator */}
      <div className="section-separator" role="separator"></div>
      
      {/* Quick Navigation Section */}
      <h3 className="section-title">Quick Navigation</h3>
      <nav className="quick-nav-links">
        {navLinks.map((link, index) => (
          <Link 
            to={link.path} 
            key={index} 
            className="quick-nav-link"
            aria-label={link.ariaLabel}
          >
            <div className="quick-nav-icon">{link.icon}</div>
            <span>{link.title}</span>
          </Link>
        ))}
      </nav>
    </main>
  );
}