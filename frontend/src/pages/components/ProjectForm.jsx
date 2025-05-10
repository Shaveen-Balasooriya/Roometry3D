import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../services/firebase';
import { doc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import './ProjectForm.css';

export default function ProjectForm({ onSuccess, onCancel, initialData = {} }) {
  const [formData, setFormData] = useState({
    name: initialData.name || '',
    description: initialData.description || '',
    type: initialData.type || 'living'
  });
  
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!auth.currentUser) {
      navigate('/login');
    }
  }, [navigate]);

  const validateForm = () => {
    const newErrors = {};
    if (!formData.name.trim()) {
      newErrors.name = 'Project name is required';
    }
    
    if (!formData.description.trim()) {
      newErrors.description = 'Project description is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setServerError(null);
    
    if (!validateForm()) {
      return;
    }
    
    setIsSubmitting(true);
    
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('You must be logged in to create a project');
      }
      
      // Create project data object
      const projectData = {
        name: formData.name,
        description: formData.description,
        type: formData.type,
        userId: user.uid,
        userEmail: user.email,
        createdAt: serverTimestamp(),
        status: 'draft'
      };
      
      // Save project to Firestore
      const projectsCollection = collection(db, 'projects');
      const docRef = await addDoc(projectsCollection, projectData);
      
      // Call the onSuccess callback with the created project
      if (onSuccess) {
        onSuccess({ id: docRef.id, ...projectData });
      }
    } catch (error) {
      console.error('Error creating project:', error);
      setServerError(error.message || 'Failed to create project. Please try again.');
      setIsSubmitting(false);
    }
  };

  return (
    <form className="project-form" onSubmit={handleSubmit}>
      {serverError && (
        <div className="error-banner">
          {serverError}
        </div>
      )}
      
      <h3 className="form-section-title">Project Details</h3>
      
      <div className="form-group">
        <label htmlFor="name">Project Name *</label>
        <input
          type="text"
          id="name"
          name="name"
          value={formData.name}
          onChange={handleInputChange}
          placeholder="Enter a name for your project"
          className={errors.name ? 'error' : ''}
          maxLength={100}
        />
        {errors.name && <div className="error-message">{errors.name}</div>}
      </div>
      
      <div className="form-group">
        <label htmlFor="description">Description *</label>
        <textarea
          id="description"
          name="description"
          value={formData.description}
          onChange={handleInputChange}
          placeholder="Describe your project and what you want to achieve"
          className={errors.description ? 'error' : ''}
          maxLength={1000}
        />
        {errors.description && <div className="error-message">{errors.description}</div>}
      </div>
      
      <div className="form-group">
        <label htmlFor="type">Room Type *</label>
        <select
          id="type"
          name="type"
          value={formData.type}
          onChange={handleInputChange}
        >
          <option value="living">Living Room</option>
          <option value="bedroom">Bedroom</option>
          <option value="kitchen">Kitchen</option>
          <option value="bathroom">Bathroom</option>
          <option value="office">Office</option>
          <option value="dining">Dining Room</option>
          <option value="other">Other</option>
        </select>
      </div>
      
      {/* Room dimensions section has been removed */}
      
      <div className="form-actions">
        <button 
          type="button" 
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </button>
        <button 
          type="submit" 
          disabled={isSubmitting}
        >
          {isSubmitting ? 'Creating...' : 'Create Project & Continue'}
        </button>
      </div>
    </form>
  );
}