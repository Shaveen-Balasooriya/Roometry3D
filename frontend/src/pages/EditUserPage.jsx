import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import UserForm from './components/UserForm';
import Loading from '../components/Loading';
import Popup from '../components/Popup';
import { auth } from '../services/firebase';

export default function EditUserPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState({ open: false, type: 'error', message: '' });

  useEffect(() => {
    async function fetchUser() {
      setLoading(true);
      try {
        // Get the current user's auth token
        const user = auth.currentUser;
        if (!user) {
          throw new Error('You must be logged in to access this page');
        }
        
        const idToken = await user.getIdToken();
        
        const response = await fetch(`http://localhost:3001/api/users/${id}`, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to fetch user');
        }
        const data = await response.json();
        setFormData({
          name: data.name || '',
          email: data.email || '',
          password: '',
          confirmPassword: '',
          userType: data.userType || 'client'
        });
      } catch (err) {
        console.error('Error fetching user:', err);
        setPopup({ open: true, type: 'error', message: err.message });
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [id]);

  // For update: handle success and possible redirect
  const handleSuccess = () => {
    setPopup({ open: true, type: 'success', message: 'User updated successfully!' });
    setTimeout(() => navigate('/users-dashboard'), 1800);
  };

  if (loading) {
    return (
      <div className="page-content">
        <Loading overlay />
      </div>
    );
  }
  
  if (!formData) {
    return (
      <div className="page-content">
        <Popup open={popup.open} type={popup.type} message={popup.message} onClose={() => setPopup({ ...popup, open: false })} />
        <div className="error-container">
          <p>Could not load user data.</p>
          <button className="button-secondary" onClick={() => navigate('/users-dashboard')}>Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <Popup open={popup.open} type={popup.type} message={popup.message} onClose={() => setPopup({ ...popup, open: false })} />
      <h2 className="page-title">Edit User</h2>
      <div className="form-container">
        <UserForm
          initialData={formData}
          editMode
          userId={id}
          onSuccess={handleSuccess}
        />
      </div>
    </div>
  );
}
