import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import AddFurnitureContent from './AddFurnitureContent';
import '../App.css';

export default function AddFurniturePage() {
  const navigate = useNavigate();

  const handleCancel = () => {
    // Navigate back to the furniture list or dashboard
    navigate('/furniture-list');
  };

  return (
    <div className="app-container">
      <main className="main-content">
        <div className="my-projects-page">
          <div className="page-header">
            <h1>Add New Furniture</h1>
          </div>

          <div className="form-container">
            <AddFurnitureContent />
          </div>
        </div>
      </main>
    </div>
  );
}
