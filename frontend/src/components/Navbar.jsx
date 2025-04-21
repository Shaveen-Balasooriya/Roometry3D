import React from 'react'
import { Link, useLocation } from 'react-router-dom'

export default function Navbar() {
  const location = useLocation()
  return (
    <nav className="navbar">
      <div className="navbar-content">
        <span className="navbar-title">Roometry 3D Admin</span>
        <div className="navbar-links">
          <Link to="/" className={location.pathname === '/' ? 'active' : ''}>Home</Link>
          <Link to="/add-furniture" className={location.pathname === '/add-furniture' ? 'active' : ''}>Add Furniture</Link>
          <Link to="/furniture-dashboard" className={location.pathname === '/furniture-dashboard' ? 'active' : ''}>Manage Furniture</Link>
          <Link to="/add-user" className={location.pathname === '/add-user' ? 'active' : ''}>Users</Link>
          <Link to="/users-dashboard" className={location.pathname === '/users-dashboard' ? 'active' : ''}>Users Dashboard</Link>
        </div>
      </div>
    </nav>
  )
}
