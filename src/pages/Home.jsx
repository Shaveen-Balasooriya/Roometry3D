import React from 'react';
import { Link } from 'react-router-dom';

const Home = () => {
  return (
    <div className="home-container">
      <header className="home-header">
        <h1>Roometry3D</h1>
        <p>Design your perfect space with 3D room planning</p>
      </header>
      
      <div className="home-content">
        <div className="home-features">
          <h2>Start Creating Your Space</h2>
          <p>Easily design and visualize your rooms in 3D</p>
          
          <div className="cta-buttons">
            <Link to="/login" className="btn btn-primary">Sign In</Link>
            <Link to="/register" className="btn btn-secondary">Create Account</Link>
            <Link to="/admin/furniture" className="btn btn-outline">View Admin Panel</Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;
