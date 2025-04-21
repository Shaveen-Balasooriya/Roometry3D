import React from 'react'
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import './App.css'
import AddFurniturePage from './pages/AddFurniturePage'
import Navbar from './components/Navbar'
import Footer from './components/Footer'
import FurnitureDashboardPage from './pages/FurnitureDashboardPage'
import UpdateFurniturePage from './pages/UpdateFurniturePage'
import UserManagementPage from './pages/UserManagementPage'

function Home() {
  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div>
          <h2 style={{ color: 'var(--primary)', marginBottom: '1.5rem' }}>Welcome to Roometry 3D Admin</h2>
          <p style={{ color: 'var(--text-light)', marginBottom: '2rem' }}>
            Use the navigation bar to add furniture or manage your content.
          </p>
        </div>
      </main>
      <Footer />
    </div>
  )
}

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/add-furniture" element={
          <div className="app-container">
            <Navbar />
            <main className="main-content">
              <AddFurniturePage />
            </main>
            <Footer />
          </div>
        } />
        <Route path="/furniture-dashboard" element={
          <div className="app-container">
            <Navbar />
            <FurnitureDashboardPage />
            <Footer />
          </div>
        } />
        <Route path="/update-furniture/:id" element={
          <div className="app-container">
            <Navbar />
            <main className="main-content">
              <UpdateFurniturePage />
            </main>
            <Footer />
          </div>
        } />
        <Route path="/user-management" element={
          <div className="app-container">
            <Navbar />
            <UserManagementPage />
            <Footer />
          </div>
        } />
      </Routes>
    </Router>
  )
}
