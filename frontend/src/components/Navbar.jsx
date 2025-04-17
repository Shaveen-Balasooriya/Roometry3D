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
        </div>
      </div>
    </nav>
  )
}
