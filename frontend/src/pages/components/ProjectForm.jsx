import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth, getUserRole } from '../../services/firebase';
import { collection, getDocs, query, where, addDoc, serverTimestamp } from 'firebase/firestore';
import Loading from '../../components/Loading';
import Popup from '../../components/Popup';

import './ProjectForm.css';

export default function ProjectForm({ onSuccess, onCancel, initialData = {}, editMode = false }) {
  const [form, setForm] = useState({
    name: initialData.name || '',
    description: initialData.description || '',
    clientId: initialData.clientId || '',
    designerId: initialData.designerId || '',
    status: initialData.status || 'draft'
  });
  
  const [errors, setErrors] = useState({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [serverError, setServerError] = useState(null);
  const navigate = useNavigate();
  const [popup, setPopup] = useState({ open: false, type: 'error', message: '' });
  const [clients, setClients] = useState([]);
  const [designers, setDesigners] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [currentUserRole, setCurrentUserRole] = useState(null);
  const [isAutoAssignedClient, setIsAutoAssignedClient] = useState(false);
  const [isAutoAssignedDesigner, setIsAutoAssignedDesigner] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    if (!auth.currentUser) {
      navigate('/login');
      return;
    }
    
    const loadUsersAndSetCurrentUser = async () => {
      if (!isMounted) return;
      
      try {
        setIsLoading(true);
        
        // Get current user's role
        const role = await getUserRole();
        if (isMounted) setCurrentUserRole(role);
        
        // Fetch clients - using userType instead of role
        const clientsQuery = query(collection(db, 'users'), where('userType', '==', 'client'));
        const clientsSnapshot = await getDocs(clientsQuery);
        if (!isMounted) return;
        
        const clientsData = clientsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        if (isMounted) setClients(clientsData);
        
        // Fetch designers - using userType instead of role
        const designersQuery = query(collection(db, 'users'), where('userType', '==', 'designer'));
        const designersSnapshot = await getDocs(designersQuery);
        if (!isMounted) return;
        
        const designersData = designersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        if (isMounted) setDesigners(designersData);
        
        // Auto-assign client or designer based on current user's role
        if (isMounted && auth.currentUser) {
          const currentUserId = auth.currentUser.uid;
          
          if (role === 'client' && !editMode) {
            console.log('Auto-assigning client:', currentUserId);
            setForm(prev => ({
              ...prev,
              clientId: currentUserId
            }));
            setIsAutoAssignedClient(true);
          } else if (role === 'designer' && !editMode) {
            console.log('Auto-assigning designer:', currentUserId);
            setForm(prev => ({
              ...prev,
              designerId: currentUserId
            }));
            setIsAutoAssignedDesigner(true);
          }
        }
        
      } catch (error) {
        console.error('Error fetching users:', error);
        if (isMounted) {
          setPopup({
            open: true,
            type: 'error',
            message: `Error loading users: ${error.message}`
          });
        }
      } finally {
        if (isMounted) setIsLoading(false);
      }
    };
    
    loadUsersAndSetCurrentUser();
    
    // Cleanup function
    return () => {
      isMounted = false;
    };
  }, [navigate, editMode]);

  // Load initial data if in edit mode
  useEffect(() => {
    if (initialData && editMode) {
      setForm({
        name: initialData.name || '',
        description: initialData.description || '',
        clientId: initialData.clientId || '',
        designerId: initialData.designerId || '',
        status: initialData.status || 'draft'
      });
    }
  }, [initialData, editMode]);

  const fetchUsers = async () => {
    try {
      setIsLoading(true);
      
      // Fetch clients - using userType instead of role
      const clientsQuery = query(collection(db, 'users'), where('userType', '==', 'client'));
      const clientsSnapshot = await getDocs(clientsQuery);
      const clientsData = clientsSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setClients(clientsData);
      
      // Fetch designers - using userType instead of role
      const designersQuery = query(collection(db, 'users'), where('userType', '==', 'designer'));
      const designersSnapshot = await getDocs(designersQuery);
      const designersData = designersSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setDesigners(designersData);
      
    } catch (error) {
      console.error('Error fetching users:', error);
      setPopup({
        open: true,
        type: 'error',
        message: `Error loading users: ${error.message}`
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Skip changes to auto-assigned fields
    if ((isAutoAssignedClient && name === 'clientId') || 
        (isAutoAssignedDesigner && name === 'designerId')) {
      return;
    }

    // Prevent form submission on Enter for certain fields
    if (e.key === 'Enter' && e.target.type !== 'textarea') {
      e.preventDefault();
    }

    // Update form state with new value
    setForm(prevForm => ({
      ...prevForm,
      [name]: value
    }));
    
    // Clear error for this field if it exists
    if (errors[name]) {
      setErrors(prevErrors => ({
        ...prevErrors,
        [name]: ''
      }));
    }
  };

  const validateForm = () => {
    const newErrors = {};
    if (!form.name.trim()) {
      newErrors.name = 'Project name is required';
    }
    
    if (!form.description.trim()) {
      newErrors.description = 'Project description is required';
    }
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleClearForm = () => {
    setForm({
      name: '',
      description: '',
      clientId: isAutoAssignedClient ? form.clientId : '',
      designerId: isAutoAssignedDesigner ? form.designerId : '',
      status: 'draft'
    });
    setErrors({});
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
        name: form.name,
        description: form.description,
        clientId: form.clientId || null,
        designerId: form.designerId || null,
        status: form.status,
        createdBy: user.uid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
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
      setPopup({
        open: true,
        type: 'error',
        message: `Error: ${error.message || 'Failed to create project'}`
      });
      setIsSubmitting(false);
    }
  };

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
              value={form.name || ''}
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
            value={form.description || ''}
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
              value={form.clientId || ''}
              onChange={handleChange}
              className={errors.clientId ? 'error' : ''}
              disabled={isAutoAssignedClient}
              style={isAutoAssignedClient ? {backgroundColor: '#f5f5f5', cursor: 'not-allowed'} : {}}
            >
              <option value="">Select a client</option>
              {clients.map(client => (
                <option key={client.id} value={client.id}>
                  {client.name || client.displayName || client.email} {client.email && `(${client.email})`}
                </option>
              ))}
            </select>
            {isAutoAssignedClient && <div className="helper-text">You are assigned as the client for this project.</div>}
            {errors.clientId && <div className="error-message">{errors.clientId}</div>}
          </div>
          
          <div className="form-group half">
            <label htmlFor="designerId">Designer</label>
            <select
              id="designerId"
              name="designerId"
              value={form.designerId || ''}
              onChange={handleChange}
              className={errors.designerId ? 'error' : ''}
              disabled={isAutoAssignedDesigner}
              style={isAutoAssignedDesigner ? {backgroundColor: '#f5f5f5', cursor: 'not-allowed'} : {}}
            >
              <option value="">Select a designer</option>
              {designers.map(designer => (
                <option key={designer.id} value={designer.id}>
                  {designer.name || designer.displayName || designer.email} {designer.email && `(${designer.email})`}
                </option>
              ))}
            </select>
            {isAutoAssignedDesigner && <div className="helper-text">You are assigned as the designer for this project.</div>}
            {errors.designerId && <div className="error-message">{errors.designerId}</div>}
          </div>
        </div>
        
        {/* No 3D Model section required */}
        
        <div className="form-actions">
          <div className="form-action-left">
            <button
              type="button"
              className="button-secondary"
              onClick={onCancel || handleClearForm}
            >
              {onCancel ? 'Cancel' : 'Clear Form'}
            </button>
          </div>
          <div className="form-action-right">
            <button
              type="submit"
              className="button-primary"
              disabled={isSubmitting}
            >
              {isSubmitting ? <Loading size={20} /> : (editMode ? 'Update Project' : 'Create Project')}
            </button>
          </div>
        </div>
      </form>
    </>
  );
}