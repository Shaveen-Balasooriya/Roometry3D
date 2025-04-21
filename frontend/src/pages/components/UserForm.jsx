import React, { useState } from 'react';
import Loading from '../../components/Loading';
import Popup from '../../components/Popup';

export default function UserForm({ onSuccess }) {
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    confirmPassword: '',
    userType: 'admin'
  });
  
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [popup, setPopup] = useState({ open: false, type: 'error', message: '' });
  
  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
    
    // Clear error on change
    if (errors[name]) {
      setErrors({ ...errors, [name]: '' });
    }
  };
  
  const validateForm = () => {
    const newErrors = {};
    
    if (!form.name.trim()) {
      newErrors.name = 'Name is required';
    }
    
    if (!form.email.trim()) {
      newErrors.email = 'Email is required';
    } else if (!/^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i.test(form.email)) {
      newErrors.email = 'Invalid email address';
    }
    
    if (!form.password) {
      newErrors.password = 'Password is required';
    } else if (form.password.length < 6) {
      newErrors.password = 'Password must be at least 6 characters';
    }
    
    if (form.password !== form.confirmPassword) {
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
      const response = await fetch('http://localhost:3001/api/users', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          userType: form.userType
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to create user');
      }
      
      const result = await response.json();
      
      setPopup({ 
        open: true, 
        type: 'success', 
        message: `User ${result.name} created successfully!`,
        duration: 3000
      });
      
      // Reset form
      setForm({
        name: '',
        email: '',
        password: '',
        confirmPassword: '',
        userType: 'admin'
      });
      
      // Call the success callback if provided
      if (onSuccess) {
        onSuccess(result);
      }
      
    } catch (err) {
      console.error('Error creating user:', err);
      setPopup({ 
        open: true, 
        type: 'error', 
        message: err.message || 'Error creating user. Please try again.'
      });
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleClearForm = () => {
    setForm({
      name: '',
      email: '',
      password: '',
      confirmPassword: '',
      userType: 'admin'
    });
    setErrors({});
  };
  
  return (
    <>
      <Popup 
        open={popup.open}
        type={popup.type}
        message={popup.message}
        onClose={() => setPopup({...popup, open: false})}
        duration={popup.duration}
      />
      
      <form className="furniture-form" onSubmit={handleSubmit}>
        {isSubmitting && <Loading overlay />}
        <h2>Create Admin User</h2>
        
        <div className="form-section-title">User Information</div>
        
        <div className="form-group">
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
        
        <div className="form-group">
          <label htmlFor="email">Email Address</label>
          <input
            id="email"
            name="email"
            type="text"
            value={form.email}
            onChange={handleChange}
            className={errors.email ? 'error' : ''}
            placeholder="Enter email address"
          />
          {errors.email && <div className="error-message">{errors.email}</div>}
        </div>
        
        <div className="form-section-title">Security</div>
        
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            id="password"
            name="password"
            type="password"
            value={form.password}
            onChange={handleChange}
            className={errors.password ? 'error' : ''}
            placeholder="Minimum 6 characters"
          />
          {errors.password && <div className="error-message">{errors.password}</div>}
        </div>
        
        <div className="form-group">
          <label htmlFor="confirmPassword">Confirm Password</label>
          <input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            value={form.confirmPassword}
            onChange={handleChange}
            className={errors.confirmPassword ? 'error' : ''}
            placeholder="Re-enter password"
          />
          {errors.confirmPassword && <div className="error-message">{errors.confirmPassword}</div>}
        </div>
        
        <div className="form-section-title">Access Level</div>
        
        <div className="form-group">
          <label htmlFor="userType">User Role</label>
          <select
            id="userType"
            name="userType"
            value={form.userType}
            disabled
            className="disabled"
          >
            <option value="admin">Administrator</option>
          </select>
          <div className="helper-text">This user will have full administrative privileges</div>
        </div>
        
        <div className="form-actions">
          <button
            type="button"
            className="button-secondary"
            onClick={handleClearForm}
          >
            Clear Form
          </button>
          <button
            type="submit"
            className="button-primary"
            disabled={isSubmitting}
          >
            {isSubmitting ? <Loading size={20} /> : 'Create User'}
          </button>
        </div>
      </form>
    </>
  );
}
