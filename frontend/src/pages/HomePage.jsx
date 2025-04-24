import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import MetricCard from './components/MetricCard';
import './HomePage.css';

// Simple icon components without external dependencies
const IconFurniture = () => <div className="icon-placeholder">F</div>;
const IconUsers = () => <div className="icon-placeholder">U</div>;
const IconProjects = () => <div className="icon-placeholder">P</div>;
const IconOrders = () => <div className="icon-placeholder">O</div>;

export default function HomePage() {
  // State for metrics - will be populated from backend
  const [metrics, setMetrics] = useState({
    totalFurniture: 0,
    totalUsers: 0,
    totalProjects: 0,
    totalOrders: 0
  });

  // Simulate fetching data from backend
  useEffect(() => {
    // This would be replaced with your actual API call
    const fetchMetrics = async () => {
      try {
        // Simulate API response
        const response = {
          totalFurniture: 45,
          totalUsers: 28,
          totalProjects: 12,
          totalOrders: 34
        };
        
        setMetrics(response);
      } catch (error) {
        console.error("Error fetching metrics:", error);
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
      <div className="metrics-container">
        <MetricCard 
          title="Total Furniture" 
          amount={metrics.totalFurniture} 
          icon={<IconFurniture />} 
        />
        <MetricCard 
          title="Total Users" 
          amount={metrics.totalUsers} 
          icon={<IconUsers />} 
        />
        <MetricCard 
          title="Total Projects" 
          amount={metrics.totalProjects} 
          icon={<IconProjects />} 
        />
        <MetricCard 
          title="Total Orders" 
          amount={metrics.totalOrders} 
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