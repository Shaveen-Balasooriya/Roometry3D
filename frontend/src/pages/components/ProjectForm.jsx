import React, { useState, useEffect } from 'react';
import { db, auth } from '../../services/firebase';
import { collection, getDocs, query, where } from 'firebase/firestore';
import Loading from '../../components/Loading';
import Popup from '../../components/Popup';
import './ProjectForm.css';

const API_URL = import.meta.env.VITE_BACKEND_URL;

export default function ProjectForm({ onSuccess, initialData = null, editMode = false, projectId }) {
  const [form, setForm] = useState({
    name: '',
    description: '',
    clientId: '',
    designerId: '',
    status: 'draft'
  });
  const [objFile, setObjFile] = useState(null);
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [popup, setPopup] = useState({ open: false, type: 'error', message: '' });
  const [clients, setClients] = useState([]);
  const [designers, setDesigners] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isObjDragging, setIsObjDragging] = useState(false);

  // Fetch clients and designers
  useEffect(() => {
    async function fetchUsers() {
      try {
        setIsLoading(true);
        
        // Fetch clients
        const clientsQuery = query(collection(db, 'users'), where('userType', '==', 'client'));
        const clientsSnapshot = await getDocs(clientsQuery);
        const clientsList = clientsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        // Fetch designers
        const designersQuery = query(collection(db, 'users'), where('userType', '==', 'designer'));
        const designersSnapshot = await getDocs(designersQuery);
        const designersList = designersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        
        setClients(clientsList);
        setDesigners(designersList);
      } catch (error) {
        console.error("Error fetching users:", error);
        setPopup({
          open: true, 
          type: 'error',
          message: 'Failed to load users. Please refresh the page.'
        });
      } finally {
        setIsLoading(false);
      }
    }
    
    fetchUsers();
  }, []);

  // Load initial data if in edit mode
  useEffect(() => {
    if (initialData) {
      setForm({
        name: initialData.name || '',
        description: initialData.description || '',
        clientId: initialData.clientId || '',
        designerId: initialData.designerId || '',
        status: initialData.status || 'draft'
      });
    }
  }, [initialData]);

  const handleChange = (e) => {
    const { name, value, type, files } = e.target;

    if (e.key === 'Enter') {
      e.preventDefault();
    }

    if (type === 'file' && name === 'objFile') {
      const file = files[0];
      if (file && file.name.toLowerCase().endsWith('.obj')) {
        setObjFile(file);
        if (errors.objFile) {
          setErrors({ ...errors, objFile: '' });
        }
      } else if (file) {
        setErrors({ ...errors, objFile: 'Invalid file type. Please select a .obj file.' });
      }
    } else {
      setForm({ ...form, [name]: value });
      if (errors[name]) {
        setErrors({ ...errors, [name]: '' });
      }
    }
  };
  
  const handleObjDragOver = (e) => { 
    e.preventDefault(); 
    setIsObjDragging(true);
  };
  
  const handleObjDragLeave = () => { 
    setIsObjDragging(false); 
  };
  
  const handleDrop = (e) => {
    e.preventDefault();
    setIsObjDragging(false);
    
    const file = e.dataTransfer.files[0];
    if (file && file.name.toLowerCase().endsWith('.obj')) {
      setObjFile(file);
      if (errors.objFile) {
        setErrors({ ...errors, objFile: '' });
      }
    } else if (file) {
      setErrors({ ...errors, objFile: 'Invalid file type. Please drop a .obj file.' });
    }
  };

  const removeObjFile = (e) => {
    e.stopPropagation();
    setObjFile(null);
    setErrors(prevErrors => {
      const newErrors = { ...prevErrors };
      delete newErrors.objFile;
      return newErrors;
    });
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.name.trim()) newErrors.name = 'Project name is required';
    if (!form.description.trim()) newErrors.description = 'Description is required';
    if (!form.clientId) newErrors.clientId = 'Client selection is required';
    if (!form.designerId) newErrors.designerId = 'Designer selection is required';
    if (!editMode && !objFile) newErrors.objFile = '3D model file is required';
    
    return newErrors;
  };

  const handleClearForm = () => {
    setForm({
      name: '',
      description: '',
      clientId: '',
      designerId: '',
      status: 'draft'
    });
    setObjFile(null);
    setErrors({});
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
      const formData = new FormData();
      formData.append('name', form.name);
      formData.append('description', form.description);
      formData.append('clientId', form.clientId);
      formData.append('designerId', form.designerId);
      formData.append('status', form.status);
      
      if (objFile) {
        formData.append('objFile', objFile);
      }
      
      // Get authentication token
      const user = auth.currentUser;
      if (!user) {
        throw new Error('You must be logged in to perform this action');
      }
      
      const idToken = await user.getIdToken();
      
      let response;
      if (editMode) {
        response = await fetch(`${API_URL}/api/projects/${projectId}`, {
          method: 'PUT',
          headers: {
            'Authorization': `Bearer ${idToken}`
          },
          body: formData,
        });
      } else {
        response = await fetch(`${API_URL}/api/projects`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${idToken}`
          },
          body: formData,
        });
      }
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save project');
      }
      
      const result = await response.json();
      setPopup({
        open: true,
        type: 'success',
        message: editMode 
          ? 'Project updated successfully!' 
          : `Project ${result.name} created successfully!`,
        duration: 3000
      });
      
      if (!editMode) {
        setForm({
          name: '',
          description: '',
          clientId: '',
          designerId: '',
          status: 'draft'
        });
        setObjFile(null);
      }
      
      if (onSuccess) onSuccess(result);
    } catch (err) {
      setPopup({
        open: true,
        type: 'error',
        message: err.message || `Error ${editMode ? 'updating' : 'creating'} project. Please try again.`
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return <div className="loading-container"><Loading size={30} /></div>;
  }

  return (
    <>
      <Popup 
        open={popup.open} 
        type={popup.type} 
        message={popup.message} 
        onClose={() => setPopup({ ...popup, open: false })} 
      />
      <form className="furniture-form" onSubmit={handleSubmit}>
        {isSubmitting && <Loading overlay />}
      
        <div className="form-section-title">Project Details</div>
        <div className="form-row">
          <div className="form-group half">
            <label htmlFor="name">Project Name</label>
            <input
              id="name"
              name="name"
              type="text"
              value={form.name}
              onChange={handleChange}
              className={errors.name ? 'error' : ''}
              placeholder="Enter project name"
            />
            {errors.name && <div className="error-message">{errors.name}</div>}
          </div>
          
          <div className="form-group half">
            <label htmlFor="status">Project Status</label>
            <select
              id="status"
              name="status"
              value={form.status}
              onChange={handleChange}
            >
              <option value="draft">Draft</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
            <div className="helper-text">
              {form.status === 'draft' && "Project is in initial planning phase"}
              {form.status === 'in_progress' && "Project is actively being worked on"}
              {form.status === 'completed' && "Project has been completed"}
            </div>
          </div>
        </div>
        
        <div className="form-group">
          <label htmlFor="description">Description</label>
          <textarea
            id="description"
            name="description"
            value={form.description}
            onChange={handleChange}
            className={errors.description ? 'error' : ''}
            placeholder="Enter project description"
            rows={4}
          />
          {errors.description && <div className="error-message">{errors.description}</div>}
        </div>
        
        <div className="form-section-title">Assigned Users</div>
        <div className="form-row">
          <div className="form-group half">
            <label htmlFor="clientId">Client</label>
            <select
              id="clientId"
              name="clientId"
              value={form.clientId}
              onChange={handleChange}
              className={errors.clientId ? 'error' : ''}
            >
              <option value="">Select a client</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name} ({client.email})
                </option>
              ))}
            </select>
            {errors.clientId && <div className="error-message">{errors.clientId}</div>}
          </div>
          
          <div className="form-group half">
            <label htmlFor="designerId">Designer</label>
            <select
              id="designerId"
              name="designerId"
              value={form.designerId}
              onChange={handleChange}
              className={errors.designerId ? 'error' : ''}
            >
              <option value="">Select a designer</option>
              {designers.map(designer => (
                <option key={designer.id} value={designer.id}>
                  {designer.name} ({designer.email})
                </option>
              ))}
            </select>
            {errors.designerId && <div className="error-message">{errors.designerId}</div>}
          </div>
        </div>
        
        <div className="form-section-title">3D Model</div>
        
        <div className="form-group">
          <label htmlFor="objFileInput">
            {editMode ? '3D Model File (.obj) (optional)' : '3D Model File (.obj)'}
          </label>
          <div
            id="objFileDropArea"
            className={`file-input-wrapper ${isObjDragging ? 'dragging' : ''} ${errors.objFile ? 'error' : ''}`}
            onDragEnter={handleObjDragOver}
            onDragOver={handleObjDragOver}
            onDragLeave={handleObjDragLeave}
            onDrop={handleDrop}
          >
            <input
              id="objFileInput"
              name="objFile"
              type="file"
              onChange={handleChange}
              className="file-input-native"
              accept=".obj"
              aria-describedby="objFileDropArea"
            />
            <div className="file-input-display">
              {objFile ? (
                <div className="file-info">
                  <span className="file-name">{objFile.name}</span>
                  <span className="file-size">
                    ({(objFile.size / 1024).toFixed(1)} KB)
                    <button type="button" onClick={removeObjFile} className="remove-file-btn" title="Remove file">&times;</button>
                  </span>
                </div>
              ) : (
                <div className="file-placeholder">
                  <span>{editMode ? 'Drop new .obj or click to replace' : 'Drop .obj file or click to browse'}</span>
                </div>
              )}
            </div>
          </div>
          {errors.objFile && <div className="error-message">{errors.objFile}</div>}
          {initialData?.objFileUrl && (
            <div className="file-preview">
              <p>Current file: <a href={initialData.objFileUrl} target="_blank" rel="noopener noreferrer">View model</a></p>
            </div>
          )}
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
            disabled={isSubmitting || Object.keys(errors).length > 0}
          >
            {isSubmitting ? <Loading size={20} /> : (editMode ? 'Update Project' : 'Create Project')}
          </button>
        </div>
      </form>
    </>
  );
}