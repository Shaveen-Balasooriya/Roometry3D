import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import UpdateFurnitureContent from './UpdateFurnitureContent';
import Loading from '../components/Loading';
import Popup from '../components/Popup';
import { auth } from '../services/firebase';

export default function UpdateFurniturePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [initialData, setInitialData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState({ open: false, type: 'error', message: '' });
  const API_URL = import.meta.env.VITE_BACKEND_URL;
  useEffect(() => {
    const fetchFurnitureDetails = async () => {
      setLoading(true);
      try {
        // Get the current user's auth token
        const user = auth.currentUser;
        if (!user) {
          throw new Error('You must be logged in to access this page');
        }
        
        const idToken = await user.getIdToken();
        
        // Fetch the full details including the original objFileUrl needed for the preview
        const response = await fetch(`${API_URL}/api/furniture/${id}/details`, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to fetch furniture details');
        }
        const data = await response.json();
        setInitialData(data);
      } catch (err) {
        console.error("Error fetching furniture details:", err);
        setPopup({ open: true, type: 'error', message: `Error loading furniture: ${err.message}` });
        // Optionally navigate back or show a persistent error
        // navigate('/furniture-dashboard');
      } finally {
        setLoading(false);
      }
    };

    fetchFurnitureDetails();
  }, [id, navigate]);

  const handleUpdateSuccess = () => {
    // Show success message and navigate back to dashboard
    setPopup({ open: true, type: 'success', message: 'Furniture updated successfully!', duration: 2000 });
    setTimeout(() => navigate('/furniture-dashboard'), 2100);
  };

  if (loading) {
    return (
      <div className="page-content">
        <Loading overlay />
      </div>
    );
  }

  if (!initialData && !loading) {
    return (
      <div className="page-content">
        <Popup open={popup.open} type={popup.type} message={popup.message} onClose={() => setPopup({ ...popup, open: false })} />
        <div className="error-container">
          <p>Could not load furniture data.</p>
          <button className="button-primary" onClick={() => navigate('/furniture-dashboard')}>Go Back</button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">
      <Popup open={popup.open} type={popup.type} message={popup.message} onClose={() => setPopup({ ...popup, open: false })} duration={popup.duration || 3000} />
      <h1 className="page-title">Update Furniture</h1>
      <div className="form-container">
        {initialData && <UpdateFurnitureContent initialData={initialData} onUpdateSuccess={handleUpdateSuccess} />}
      </div>
    </div>
  );
}
