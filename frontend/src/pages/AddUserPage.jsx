import React from 'react';
import { useNavigate } from 'react-router-dom';
import UserForm from './components/UserForm';

export default function AddUserPage() {
  const navigate = useNavigate();

  const handleUserCreationSuccess = (userData) => {
    console.log('User created successfully:', userData);
    // Navigate back to users dashboard after successful creation
    navigate('/users-dashboard');
  };

  return (
    <div className="page-content">
      <h2 className="page-title">Add User</h2>
      
      <div className="form-container">
        <UserForm onSuccess={handleUserCreationSuccess} />
      </div>
    </div>
  );
}
