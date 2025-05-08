import React, { useState, useEffect } from 'react';
import { auth } from '../../services/firebase';
import Loading from '../../components/Loading';
import Popup from '../../components/Popup';

export default function UserForm({ onSuccess, initialData = null, editMode = false, userId }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    userType: 'client' // Changed default from 'admin' to 'client'
  });
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [popup, setPopup] = useState({ open: false, type: 'error', message: '' });
  const API_URL = import.meta.env.VITE_BACKEND_URL;
  useEffect(() => {
    if (initialData) {
      setForm({ ...initialData, password: '', confirmPassword: '' });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.name.trim()) {
      newErrors.name = 'Name is required';
    }
    if (!editMode) {
      if (!form.email.trim()) {
        newErrors.email = 'Email is required';
      } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(form.email)) {
        newErrors.email = 'Invalid email address';
      }
    }
    if (editMode) {
      if (form.password || form.confirmPassword) {
        if (form.password.length < 6) {
          newErrors.password = 'Password must be at least 6 characters';
        }
        if (form.password !== form.confirmPassword) {
          newErrors.confirmPassword = 'Passwords do not match';
        }
      }
    } else {
      if (!form.password) {
        newErrors.password = 'Password is required';
      } else if (form.password.length < 6) {
        newErrors.password = 'Password must be at least 6 characters';
      }
      if (form.password !== form.confirmPassword) {
        newErrors.confirmPassword = 'Passwords do not match';
      }
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
      let response, result;
      
      // Get current user's auth token
      const idToken = await auth.currentUser.getIdToken();
      
      if (editMode) {
        response = await fetch(`${API_URL}/api/users/${userId}`, {
          method: 'PUT',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            name: form.name,
            password: form.password || undefined, // Only send if changed
          }),
        });
      } else {
        response = await fetch(`${API_URL}/api/users`, {
          method: 'POST',
          headers: { 
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${idToken}`
          },
          body: JSON.stringify({
            name: form.name,
            email: form.email,
            password: form.password,
            userType: form.userType
          }),
        });
      }
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save user');
      }
      result = await response.json();
      setPopup({
        open: true,
        type: 'success',
        message: editMode ? 'User updated successfully!' : `User ${result.name} created successfully!`,
        duration: 3000
      });
      if (!editMode) {
        setForm({
          name: '',
          email: '',
          password: '',
          confirmPassword: '',
          userType: 'client'
        });
      }
      if (onSuccess) onSuccess(result);
    } catch (err) {
      setPopup({
        open: true,
        type: 'error',
        message: err.message || `Error ${editMode ? 'updating' : 'creating'} user. Please try again.`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClearForm = () => {
    if (initialData) {
      setForm({ ...initialData, password: '', confirmPassword: '' });
    } else {
      setForm({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        userType: 'client'
      });
    }
    setErrors({});
  };

  return (
    <>
      <Popup
        open={popup.open}
        type={popup.type}
        message={popup.message}
        onClose={() => setPopup({ ...popup, open: false })}
        duration={popup.duration}
      />
      <form className="furniture-form" onSubmit={handleSubmit}>
        {isSubmitting && <Loading overlay />}

        <div className="form-section-title">User Information</div>
        <div className="form-row">
          <div className="form-group half">
            <label htmlFor="name">Full Name</label>
            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              className={errors.name ? 'error' : ''}
              placeholder="Enter full name"
            />
            {errors.name && <div className="error-message">{errors.name}</div>}
          </div>
          <div className="form-group half">
            <label htmlFor="email">Email Address</label>
            <input
              id="email"
              name="email"
              type="text"
              value={form.email}
              onChange={handleChange}
              className={errors.email ? 'error' : ''}
              placeholder="Enter email address"
              disabled={editMode}
            />
            {errors.email && <div className="error-message">{errors.email}</div>}
          </div>
        </div>

        <div className="form-section-title">Security</div>
        <div className="form-row">
          <div className="form-group half">
            <label htmlFor="password">{editMode ? 'New Password (leave blank to keep unchanged)' : 'Password'}</label>
            <input
              id="password"
              name="password"
              type="password"
              value={form.password}
              onChange={handleChange}
              className={errors.password ? 'error' : ''}
              placeholder={editMode ? 'Enter new password (optional)' : 'Minimum 6 characters'}
            />
            {errors.password && <div className="error-message">{errors.password}</div>}
          </div>
          <div className="form-group half">
            <label htmlFor="confirmPassword">Confirm Password</label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              value={form.confirmPassword}
              onChange={handleChange}
              className={errors.confirmPassword ? 'error' : ''}
              placeholder={editMode ? 'Re-enter new password' : 'Re-enter password'}
            />
            {errors.confirmPassword && <div className="error-message">{errors.confirmPassword}</div>}
          </div>
        </div>

        <div className="form-section-title">Access Level</div>
        <div className="form-group">
          <label htmlFor="userType">User Role</label>
          <select
            id="userType"
            name="userType"
            value={form.userType}
            onChange={handleChange}
            className={errors.userType ? 'error' : ''}
          >
            <option value="client">Client</option>
            <option value="designer">Designer</option>
            <option value="admin">Administrator</option>
          </select>
          <div className="helper-text">
            {form.userType === 'client' && "This user can create projects and view designs"}
            {form.userType === 'designer' && "This user can create and modify 3D designs"}
            {form.userType === 'admin' && "This user will have full administrative privileges"}
          </div>
        </div>

        <div className="form-actions">
          <button
            type="button"
            className="button-secondary"
            onClick={handleClearForm}
          >
            {editMode ? 'Revert Changes' : 'Clear Form'}
          </button>
          <button
            type="submit"
            className="button-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loading size={20} /> : (editMode ? 'Save Changes' : 'Create User')}
          </button>
        </div>
      </form>
    </>
  );
}
