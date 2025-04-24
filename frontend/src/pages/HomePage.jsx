import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MetricCard from './components/MetricCard';
import './HomePage.css';
import { auth } from '../services/firebase'; // Adjust the path as needed

// Simple icon components without external dependencies
const IconFurniture = () => <div className="icon-placeholder">F</div>;
const IconUsers = () => <div className="icon-placeholder">U</div>;
const IconProjects = () => <div className="icon-placeholder">P</div>;
const IconOrders = () => <div className="icon-placeholder">O</div>;

export default function HomePage() {
  // State for metrics - will be populated from backend
  const [metrics, setMetrics] = useState({
    projectsToday: 0,
    totalDesigners: 0,
    totalProjects: 0,
    checkedOutProjects: 0 // You may need to create an API for this as well
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
          fetch('http://localhost:3001/api/count/todayProjects', { headers }),
          fetch('http://localhost:3001/api/count/designers', { headers }),
          fetch('http://localhost:3001/api/count/totalProjcts', { headers })
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
    { title: "Add Furniture", path: "/add-furniture", icon: <IconFurniture /> },
    { title: "Furniture Dashboard", path: "/furniture-dashboard", icon: <IconFurniture /> },
    { title: "Add User", path: "/add-user", icon: <IconUsers /> },
    { title: "Users Dashboard", path: "/users-dashboard", icon: <IconUsers /> }
  ];

  return (
    <div className="home-content">
      <div className="welcome-section">
        <h2>Welcome to Roometry 3D Admin</h2>
        <p>Use the navigation bar to add furniture or manage your content.</p>
      </div>
      
      {/* Dashboard Stats Section */}
      <h3 className="section-title">Dashboard Overview</h3>
      {error && <div className="error-message">Error loading metrics: {error}</div>}
      
      <div className="metrics-container">
        <MetricCard 
          title="Projects Added Today" 
          amount={loading ? '...' : metrics.projectsToday} 
          icon={<IconProjects />} 
        />
        <MetricCard 
          title="Designers" 
          amount={loading ? '...' : metrics.totalDesigners} 
          icon={<IconUsers />} 
        />
        <MetricCard 
          title="Total Projects" 
          amount={loading ? '...' : metrics.totalProjects} 
          icon={<IconProjects />} 
        />
        <MetricCard 
          title="Checked Out Projects" 
          amount={loading ? '...' : metrics.checkedOutProjects} 
          icon={<IconOrders />} 
        />
      </div>
      
      {/* Clear section separator */}
      <div className="section-separator"></div>
      
      {/* Quick Navigation Section */}
      <h3 className="section-title">Quick Navigation</h3>
      <div className="quick-nav-links">
        {navLinks.map((link, index) => (
          <Link to={link.path} key={index} className="quick-nav-link">
            <div className="quick-nav-icon">{link.icon}</div>
            <span>{link.title}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}