import React, { useState, useEffect, useRef } from 'react';
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

  const [clientSearch, setClientSearch] = useState('');
  const [designerSearch, setDesignerSearch] = useState('');
  const [filteredClients, setFilteredClients] = useState([]);
  const [filteredDesigners, setFilteredDesigners] = useState([]);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [showDesignerDropdown, setShowDesignerDropdown] = useState(false);

  const clientDropdownRef = useRef(null);
  const designerDropdownRef = useRef(null);
  const clientSearchTimeout = useRef(null);
  const designerSearchTimeout = useRef(null);

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

        const role = await getUserRole();
        if (isMounted) setCurrentUserRole(role);

        const clientsQuery = query(collection(db, 'users'), where('userType', '==', 'client'));
        const clientsSnapshot = await getDocs(clientsQuery);
        if (!isMounted) return;

        const clientsData = clientsSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        if (isMounted) {
          setClients(clientsData);
          setFilteredClients(clientsData);
        }

        const designersQuery = query(collection(db, 'users'), where('userType', '==', 'designer'));
        const designersSnapshot = await getDocs(designersQuery);
        if (!isMounted) return;

        const designersData = designersSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        }));
        if (isMounted) {
          setDesigners(designersData);
          setFilteredDesigners(designersData);
        }

        if (isMounted && auth.currentUser) {
          const currentUserId = auth.currentUser.uid;

          if (role === 'client' && !editMode) {
            setForm(prev => ({
              ...prev,
              clientId: currentUserId
            }));
            setIsAutoAssignedClient(true);
          } else if (role === 'designer' && !editMode) {
            setForm(prev => ({
              ...prev,
              designerId: currentUserId
            }));
            setIsAutoAssignedDesigner(true);
          }
        }

      } catch (error) {
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

    return () => {
      isMounted = false;
      if (clientSearchTimeout.current) clearTimeout(clientSearchTimeout.current);
      if (designerSearchTimeout.current) clearTimeout(designerSearchTimeout.current);
    };
  }, [navigate, editMode]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (clientDropdownRef.current && !clientDropdownRef.current.contains(event.target)) {
        setShowClientDropdown(false);
      }
      if (designerDropdownRef.current && !designerDropdownRef.current.contains(event.target)) {
        setShowDesignerDropdown(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

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

  const handleClientSearch = (e) => {
    const searchTerm = e.target.value;
    setClientSearch(searchTerm);

    if (clientSearchTimeout.current) {
      clearTimeout(clientSearchTimeout.current);
    }

    clientSearchTimeout.current = setTimeout(() => {
      if (searchTerm.trim() === '') {
        setFilteredClients(clients);
      } else {
        const searchTermLower = searchTerm.toLowerCase();
        const filtered = clients.filter(client =>
          (client.name && client.name.toLowerCase().includes(searchTermLower)) ||
          (client.email && client.email.toLowerCase().includes(searchTermLower)) ||
          (client.displayName && client.displayName.toLowerCase().includes(searchTermLower))
        );
        setFilteredClients(filtered);
      }
    }, 300);

    setShowClientDropdown(true);
  };

  const handleDesignerSearch = (e) => {
    const searchTerm = e.target.value;
    setDesignerSearch(searchTerm);

    if (designerSearchTimeout.current) {
      clearTimeout(designerSearchTimeout.current);
    }

    designerSearchTimeout.current = setTimeout(() => {
      if (searchTerm.trim() === '') {
        setFilteredDesigners(designers);
      } else {
        const searchTermLower = searchTerm.toLowerCase();
        const filtered = designers.filter(designer =>
          (designer.name && designer.name.toLowerCase().includes(searchTermLower)) ||
          (designer.email && designer.email.toLowerCase().includes(searchTermLower)) ||
          (designer.displayName && designer.displayName.toLowerCase().includes(searchTermLower))
        );
        setFilteredDesigners(filtered);
      }
    }, 300);

    setShowDesignerDropdown(true);
  };

  const handleSelectClient = (client) => {
    setForm(prev => ({ ...prev, clientId: client.id }));
    setClientSearch(client.name || client.displayName || client.email);
    setShowClientDropdown(false);

    if (errors.clientId) {
      setErrors(prev => ({ ...prev, clientId: '' }));
    }
  };

  const handleSelectDesigner = (designer) => {
    setForm(prev => ({ ...prev, designerId: designer.id }));
    setDesignerSearch(designer.name || designer.displayName || designer.email);
    setShowDesignerDropdown(false);

    if (errors.designerId) {
      setErrors(prev => ({ ...prev, designerId: '' }));
    }
  };

  useEffect(() => {
    if (form.clientId) {
      const selectedClient = clients.find(client => client.id === form.clientId);
      if (selectedClient) {
        setClientSearch(selectedClient.name || selectedClient.displayName || selectedClient.email);
      }
    }

    if (form.designerId) {
      const selectedDesigner = designers.find(designer => designer.id === form.designerId);
      if (selectedDesigner) {
        setDesignerSearch(selectedDesigner.name || selectedDesigner.displayName || selectedDesigner.email);
      }
    }
  }, [form.clientId, form.designerId, clients, designers]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if ((isAutoAssignedClient && name === 'clientId') ||
      (isAutoAssignedDesigner && name === 'designerId')) {
      return;
    }

    if (e.key === 'Enter' && e.target.type !== 'textarea') {
      e.preventDefault();
    }

    setForm(prevForm => ({
      ...prevForm,
      [name]: value
    }));

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

    if (!isAutoAssignedClient) {
      setClientSearch('');
    }
    if (!isAutoAssignedDesigner) {
      setDesignerSearch('');
    }

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

      const projectsCollection = collection(db, 'projects');
      const docRef = await addDoc(projectsCollection, projectData);

      if (onSuccess) {
        onSuccess({ id: docRef.id, ...projectData });
      }
    } catch (error) {
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
            <label htmlFor="clientSearch">Client</label>
            {isAutoAssignedClient ? (
              <>
                <input
                  type="text"
                  value={clientSearch}
                  disabled
                  className="search-input"
                  style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                />
                <div className="helper-text">You are assigned as the client for this project.</div>
              </>
            ) : (
              <div className="search-container" ref={clientDropdownRef}>
                <input
                  id="clientSearch"
                  type="text"
                  value={clientSearch}
                  onChange={handleClientSearch}
                  onFocus={() => setShowClientDropdown(true)}
                  placeholder="Search for a client by name or email"
                  className={`search-input ${errors.clientId ? 'error' : ''}`}
                  autoComplete="off"
                />
                {showClientDropdown && (
                  <div className="search-dropdown">
                    {filteredClients.length > 0 ? (
                      filteredClients.map(client => (
                        <div
                          key={client.id}
                          className="dropdown-item"
                          onClick={() => handleSelectClient(client)}
                        >
                          <div className="dropdown-item-name">
                            {client.name || client.displayName || 'Unnamed User'}
                          </div>
                          {client.email && (
                            <div className="dropdown-item-email">
                              {client.email}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="no-results">No clients found</div>
                    )}
                  </div>
                )}
                {errors.clientId && <div className="error-message">{errors.clientId}</div>}
              </div>
            )}
          </div>

          <div className="form-group half">
            <label htmlFor="designerSearch">Designer</label>
            {isAutoAssignedDesigner ? (
              <>
                <input
                  type="text"
                  value={designerSearch}
                  disabled
                  className="search-input"
                  style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                />
                <div className="helper-text">You are assigned as the designer for this project.</div>
              </>
            ) : (
              <div className="search-container" ref={designerDropdownRef}>
                <input
                  id="designerSearch"
                  type="text"
                  value={designerSearch}
                  onChange={handleDesignerSearch}
                  onFocus={() => setShowDesignerDropdown(true)}
                  placeholder="Search for a designer by name or email"
                  className={`search-input ${errors.designerId ? 'error' : ''}`}
                  autoComplete="off"
                />
                {showDesignerDropdown && (
                  <div className="search-dropdown">
                    {filteredDesigners.length > 0 ? (
                      filteredDesigners.map(designer => (
                        <div
                          key={designer.id}
                          className="dropdown-item"
                          onClick={() => handleSelectDesigner(designer)}
                        >
                          <div className="dropdown-item-name">
                            {designer.name || designer.displayName || 'Unnamed User'}
                          </div>
                          {designer.email && (
                            <div className="dropdown-item-email">
                              {designer.email}
                            </div>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="no-results">No designers found</div>
                    )}
                  </div>
                )}
                {errors.designerId && <div className="error-message">{errors.designerId}</div>}
              </div>
            )}
          </div>
        </div>

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