import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Loading from '../components/Loading';
import Popup from '../components/Popup';
import { auth } from '../services/firebase';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';

export default function ChangePasswordPage() {
  const [form, setForm] = useState({
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [popup, setPopup] = useState({ open: false, type: 'error', message: '' });
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_BACKEND_URL;

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
    
    // Validate current password
    if (!form.currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }
    
    // Validate new password
    if (!form.newPassword) {
      newErrors.newPassword = 'New password is required';
    } else if (form.newPassword.length < 6) {
      newErrors.newPassword = 'New password must be at least 6 characters';
    }
    
    // Validate confirm password
    if (!form.confirmPassword) {
      newErrors.confirmPassword = 'Please confirm your new password';
    } else if (form.newPassword !== form.confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
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
    
    setIsSubmitting(true);
    
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('You must be logged in to change your password');
      }
      
      // First, reauthenticate the user
      const credential = EmailAuthProvider.credential(
        user.email,
        form.currentPassword
      );
      
      await reauthenticateWithCredential(user, credential);
      
      // Get the ID token for API call
      const idToken = await user.getIdToken(true);
      
      // Call our backend API to change the password
      const response = await fetch(`${API_URL}/api/user/change-password`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify({
          currentPassword: form.currentPassword,
          newPassword: form.newPassword
        })
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to change password');
      }
      
      // Success!
      setPopup({
        open: true,
        type: 'success',
        message: 'Password changed successfully!'
      });
      
      // Reset form
      setForm({
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      });
      
      // Redirect to profile page after a short delay
      setTimeout(() => {
        navigate('/profile');
      }, 2000);
      
    } catch (error) {
      console.error('Error changing password:', error);
      
      // Handle specific Firebase auth errors
      if (error.code === 'auth/wrong-password') {
        setErrors({ currentPassword: 'Incorrect current password' });
      } else if (error.code === 'auth/too-many-requests') {
        setPopup({
          open: true,
          type: 'error',
          message: 'Too many unsuccessful attempts. Please try again later.'
        });
      } else {
        setPopup({
          open: true,
          type: 'error',
          message: error.message || 'Failed to change password. Please try again.'
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

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
        }}>Change Password</h2>
        
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
              <label htmlFor="currentPassword">Current Password</label>
              <input
                id="currentPassword"
                name="currentPassword"
                type="password"
                value={form.currentPassword}
                onChange={handleChange}
                className={errors.currentPassword ? 'error' : ''}
                placeholder="Enter your current password"
                autoComplete="current-password"
              />
              {errors.currentPassword && <div className="error-message">{errors.currentPassword}</div>}
            </div>
            
            <div className="form-group">
              <label htmlFor="newPassword">New Password</label>
              <input
                id="newPassword"
                name="newPassword"
                type="password"
                value={form.newPassword}
                onChange={handleChange}
                className={errors.newPassword ? 'error' : ''}
                placeholder="Enter your new password"
                autoComplete="new-password"
              />
              {errors.newPassword && <div className="error-message">{errors.newPassword}</div>}
            </div>
            
            <div className="form-group">
              <label htmlFor="confirmPassword">Confirm New Password</label>
              <input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                value={form.confirmPassword}
                onChange={handleChange}
                className={errors.confirmPassword ? 'error' : ''}
                placeholder="Confirm your new password"
                autoComplete="new-password"
              />
              {errors.confirmPassword && <div className="error-message">{errors.confirmPassword}</div>}
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
                {isSubmitting ? <Loading size={20} /> : 'Change Password'}
              </button>
            </div>
          </form>
        </div>
      </main>
      <Footer />
    </div>
  );
}