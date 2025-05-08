import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Loading from '../components/Loading';
import Popup from '../components/Popup';
import { auth } from '../services/firebase';

export default function EditProfilePage() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    photoURL: ''
  });
  const [originalData, setOriginalData] = useState({});
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [popup, setPopup] = useState({ open: false, type: 'error', message: '' });
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_BACKEND_URL;

  // Fetch user profile on component mount
  useEffect(() => {
    async function fetchUserProfile() {
      try {
        const user = auth.currentUser;
        if (!user) {
          // If not logged in, redirect to login
          navigate('/login');
          return;
        }

        // Get authentication token
        const idToken = await user.getIdToken();
        
        // Fetch user profile data from backend
        const response = await fetch(`${API_URL}/api/auth/verify`, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to fetch profile');
        }

        const data = await response.json();
        
        // Set form data
        setForm({
          name: data.name || '',
          email: data.email || '',
          photoURL: data.photoURL || ''
        });
        
        // Save original data to detect changes
        setOriginalData({
          name: data.name || '',
          photoURL: data.photoURL || ''
        });
        
      } catch (err) {
        console.error('Error fetching profile:', err);
        setPopup({ 
          open: true, 
          type: 'error', 
          message: err.message || 'Error loading profile data' 
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserProfile();
  }, [navigate, API_URL]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm(prev => ({ ...prev, [name]: value }));
    // Clear error for this field if it exists
    if (errors[name]) {
      setErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    
    // Validate name
    if (!form.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    return newErrors;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      return;
    }
    
    // Check if anything changed
    if (form.name === originalData.name && form.photoURL === originalData.photoURL) {
      setPopup({
        open: true,
        type: 'info',
        message: 'No changes to save'
      });
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('You must be logged in to update your profile');
      }
      
      // Get the ID token for API call
      const idToken = await user.getIdToken();
      
      // Call our backend API to update the profile
      const response = await fetch(`${API_URL}/api/user/profile`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          name: form.name,
          photoURL: form.photoURL || null
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to update profile');
      }
      
      // Success!
      setPopup({
        open: true,
        type: 'success',
        message: 'Profile updated successfully!'
      });
      
      // Update original data
      setOriginalData({
        name: form.name,
        photoURL: form.photoURL
      });
      
      // Redirect to profile page after a short delay
      setTimeout(() => {
        navigate('/profile');
      }, 2000);
      
    } catch (error) {
      console.error('Error updating profile:', error);
      setPopup({
        open: true,
        type: 'error',
        message: error.message || 'Failed to update profile. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="app-container">
        <Navbar />
        <main className="main-content" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Loading size={40} />
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar />
      <Popup
        open={popup.open}
        type={popup.type}
        message={popup.message}
        onClose={() => setPopup({ ...popup, open: false })}
      />
      
      <main
        className="main-content"
        style={{
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 64px - 80px)',
          padding: '64px 0 60px 0',
          background: 'var(--background)',
        }}
      >
        <h2 style={{
          marginBottom: '2rem',
          color: 'var(--accent)',
          fontSize: '2.1rem',
          fontWeight: 700,
          textAlign: 'center'
        }}>Edit Profile</h2>
        
        <div
          style={{
            width: '100%',
            maxWidth: 480,
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow)',
            border: '1px solid var(--border)',
            padding: '2.5rem 2.2rem 2rem 2.2rem',
            margin: '0 auto',
          }}
        >
          {isSubmitting && <Loading overlay />}
          
          <form onSubmit={handleSubmit}>
            <div className="form-group">
              <label htmlFor="name">Full Name</label>
              <input
                id="name"
                name="name"
                type="text"
                value={form.name}
                onChange={handleChange}
                className={errors.name ? 'error' : ''}
                placeholder="Enter your full name"
              />
              {errors.name && <div className="error-message">{errors.name}</div>}
            </div>
            
            <div className="form-group">
              <label htmlFor="email">Email Address</label>
              <input
                id="email"
                name="email"
                type="email"
                value={form.email}
                disabled
                className="disabled"
                style={{ backgroundColor: 'var(--background-light)', cursor: 'not-allowed' }}
              />
              <div className="helper-text">
                Email address cannot be changed
              </div>
            </div>
            
            <div className="form-section-title" style={{ marginTop: '1.5rem' }}>
              Profile Picture
            </div>
            
            <div className="form-group">
              <label htmlFor="photoURL">Profile Picture URL (optional)</label>
              <input
                id="photoURL"
                name="photoURL"
                type="url"
                value={form.photoURL}
                onChange={handleChange}
                className={errors.photoURL ? 'error' : ''}
                placeholder="Enter URL for your profile picture"
              />
              {errors.photoURL && <div className="error-message">{errors.photoURL}</div>}
              <div className="helper-text">
                Enter a valid URL to an image (e.g., https://example.com/profile.jpg)
              </div>
            </div>
            
            <div className="form-actions" style={{ 
              display: 'flex',
              justifyContent: 'space-between',
              marginTop: '2rem'
            }}>
              <button
                type="button"
                className="button-secondary"
                onClick={() => navigate('/profile')}
                style={{ minWidth: '120px' }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="button-primary"
                disabled={isSubmitting}
                style={{ minWidth: '160px' }}
              >
                {isSubmitting ? <Loading size={20} /> : 'Save Changes'}
              </button>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}