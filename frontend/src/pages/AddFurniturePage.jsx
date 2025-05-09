import React from 'react';
import { useNavigate } from 'react-router-dom';
import AddFurnitureContent from './AddFurnitureContent';
import '../App.css';

export default function AddFurniturePage() {
  const navigate = useNavigate();

  return (
    <div className="page-content">
      <h1 className="page-header">Add New Furniture</h1>
      <div className="form-container">
        <AddFurnitureContent />
      </div>
    </div>
  );
}
