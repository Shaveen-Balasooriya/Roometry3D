import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Loading from '../components/Loading';
import ProjectModelViewer from './components/ProjectModelViewer';
import ConfirmationPopup from '../components/ConfirmationPopup';
import '../App.css';
import './ViewProjectPage.css';

export default function ViewProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clientDetails, setClientDetails] = useState(null);
  const [designerDetails, setDesignerDetails] = useState(null);
  const [activeTab, setActiveTab] = useState('model'); // Default to model view
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const [userRole, setUserRole] = useState(null);
  const [animateModel, setAnimateModel] = useState(true);
  const [notification, setNotification] = useState(null);
  const [modelLoading, setModelLoading] = useState(true);
  const [viewMode, setViewMode] = useState('rotate'); // 'rotate', 'pan', 'zoom'
  const API_URL = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    async function fetchProjectData() {
      try {
        setLoading(true);
        const user = auth.currentUser;

        if (!user) {
          throw new Error('Authentication required');
        }

        const idToken = await user.getIdToken();

        // Fetch project details
        const projectResponse = await fetch(`${API_URL}/api/projects/${id}`, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });

        if (!projectResponse.ok) {
          const errorData = await projectResponse.json();
          throw new Error(errorData.message || 'Failed to fetch project');
        }

        const projectData = await projectResponse.json();
        setProject(projectData);

        // Fetch client details
        const clientResponse = await fetch(`${API_URL}/api/users/${projectData.clientId}`, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });

        if (clientResponse.ok) {
          const clientData = await clientResponse.json();
          setClientDetails(clientData);
        }

        // Fetch designer details
        const designerResponse = await fetch(`${API_URL}/api/users/${projectData.designerId}`, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });

        if (designerResponse.ok) {
          const designerData = await designerResponse.json();
          setDesignerDetails(designerData);
        }

      } catch (err) {
        console.error('Error loading project:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }

    fetchProjectData();
  }, [id]);

  useEffect(() => {
    async function fetchUserRole() {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const token = await user.getIdTokenResult();
        const role = token.claims.role || token.claims.userType;
        setUserRole(role);
      } catch (err) {
        console.error("Error fetching user role:", err);
      }
    }

    fetchUserRole();
  }, []);

  // Show notification function
  const showNotification = (message, type = 'success') => {
    setNotification({ message, type });
    setTimeout(() => setNotification(null), 3000);
  };

  // Format date helper
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  // Get status display text
  const getStatusDisplay = (status) => {
    switch(status) {
      case 'draft': return 'Draft';
      case 'in_progress': return 'In Progress';
      case 'completed': return 'Completed';
      default: return status;
    }
  };

  // Get status color class
  const getStatusClass = (status) => {
    switch(status) {
      case 'draft': return 'status-draft';
      case 'in_progress': return 'status-progress';
      case 'completed': return 'status-completed';
      default: return '';
    }
  };

  // Always show delete button for all authenticated users
  const canDeleteProject = () => {
    return true; // Make delete button available for all users
  };

  // Handle delete project
  const handleDeleteProject = async () => {
    try {
      const user = auth.currentUser;
      if (!user) {
        throw new Error('Authentication required');
      }

      const idToken = await user.getIdToken();

      const response = await fetch(`${API_URL}/api/projects/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to delete project');
      }

      // Redirect to projects list
      navigate('/my-projects', { 
        state: { 
          notification: {
            type: 'success',
            message: `Project "${project.name}" was deleted successfully`
          }
        }
      });

    } catch (err) {
      console.error('Error deleting project:', err);
      showNotification(`Error: ${err.message || 'Failed to delete project'}`, 'error');
    }
  };

  // Copy Share URL to clipboard
  const handleShareProject = () => {
    try {
      navigator.clipboard.writeText(window.location.href);
      showNotification('Project URL copied to clipboard');
    } catch (err) {
      console.error('Error copying to clipboard:', err);
      showNotification('Failed to copy URL', 'error');
    }
  };

  const handleDownloadModel = () => {
    if (project?.objFileUrl) {
      // Track download
      showNotification('Downloading 3D model...');
    }
  };

  const handleModelLoaded = () => {
    setModelLoading(false);
  };

  if (loading) {
    return (
      <div className="page-content">
        <Loading />
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-content">
        <div className="error-container">
          <h2>Error</h2>
          <p>{error}</p>
          <button className="button-secondary" onClick={() => navigate('/my-projects')}>
            Back to Projects
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page-content">

      <main className="main-content project-view-page">
        {notification && (
          <div className={`notification notification-${notification.type}`}>
            <p>{notification.message}</p>
          </div>
        )}
        
        <ConfirmationPopup
          open={deleteConfirmOpen}
          message={`Are you sure you want to delete "${project?.name}"? This action cannot be undone.`}
          confirmText="Delete Project"
          confirmButtonClass="button-danger"
          onCancel={() => setDeleteConfirmOpen(false)}
          onConfirm={handleDeleteProject}
        />
      
        <div className="project-view-container">
          <header className="project-view-header">
            <div className="breadcrumbs">
              <Link to="/my-projects">Projects</Link> / <span className="current-page">{project.name}</span>
            </div>
            
            <div className="project-header-content">
              <div className="project-title-wrapper">
                <h1>{project.name}</h1>
                <div className={`status-badge ${getStatusClass(project.status)}`}>
                  {getStatusDisplay(project.status)}
                </div>
              </div>
              
              <div className="project-view-actions">
                <Link 
                  to={`/edit-project/${project.id}`} 
                  className="icon-button edit-button" 
                  title="Edit Project"
                  aria-label="Edit Project"
                >
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="white"
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                  </svg>
                </Link>
                
                <button 
                  onClick={handleShareProject} 
                  className="icon-button share-button" 
                  title="Share Project"
                  aria-label="Share Project"
                >
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="white" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <circle cx="18" cy="5" r="3"></circle>
                    <circle cx="6" cy="12" r="3"></circle>
                    <circle cx="18" cy="19" r="3"></circle>
                    <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"></line>
                    <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"></line>
                  </svg>
                </button>
                
                {canDeleteProject() && (
                  <button 
                    onClick={() => setDeleteConfirmOpen(true)}
                    className="icon-button delete-button"
                    title="Delete Project"
                    aria-label="Delete Project"
                  >
                    <svg 
                      width="16" 
                      height="16" 
                      viewBox="0 0 24 24" 
                      fill="none" 
                      stroke="white" 
                      strokeWidth="2" 
                      strokeLinecap="round" 
                      strokeLinejoin="round"
                    >
                      <polyline points="3 6 5 6 21 6"></polyline>
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      <line x1="10" y1="11" x2="10" y2="17"></line>
                      <line x1="14" y1="11" x2="14" y2="17"></line>
                    </svg>
                  </button>
                )}
                
                <Link 
                  to="/my-projects" 
                  className="icon-button back-button" 
                  title="Back to Projects"
                  aria-label="Back to Projects"
                >
                  <svg 
                    width="16" 
                    height="16" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="white" 
                    strokeWidth="2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <line x1="19" y1="12" x2="5" y2="12"></line>
                    <polyline points="12 19 5 12 12 5"></polyline>
                  </svg>
                </Link>
              </div>
            </div>
          </header>
          
          {/* Tab Navigation */}
          <nav className="project-tabs">
            <button 
              className={`tab-button ${activeTab === 'model' ? 'active' : ''}`}
              onClick={() => setActiveTab('model')}
              aria-label="View 3D Model"
            >
              <i className="fas fa-cube"></i> 3D Model
            </button>
            <button 
              className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
              onClick={() => setActiveTab('details')}
              aria-label="View Project Details"
            >
              <i className="fas fa-info-circle"></i> Project Details
            </button>
            <button 
              className={`tab-button ${activeTab === 'team' ? 'active' : ''}`}
              onClick={() => setActiveTab('team')}
              aria-label="View Project Team"
            >
              <i className="fas fa-users"></i> Team
            </button>
          </nav>
          
          {/* Tab Content */}
          <div className="tab-content">
            {/* 3D Model Tab */}
            {activeTab === 'model' && (
              <div className="model-tab">
                {project.objFileUrl ? (
                  <div className="project-3d-model-wrapper">
                    <div className="model-controls">
                      <button 
                        className={`model-control-button ${animateModel ? 'active' : ''}`}
                        onClick={() => setAnimateModel(!animateModel)}
                        aria-label={animateModel ? "Pause model rotation" : "Start model rotation"}
                        title={animateModel ? "Pause rotation" : "Start rotation"}
                      >
                        <i className={`fas ${animateModel ? 'fa-pause' : 'fa-play'}`}></i>
                      </button>
                      
                      <button 
                        className={`model-control-button ${viewMode === 'zoom' ? 'active' : ''}`}
                        onClick={() => setViewMode('zoom')}
                        aria-label="Zoom view mode"
                        title="Zoom mode"
                      >
                        <i className="fas fa-search-plus"></i>
                      </button>
                      
                      <button 
                        className={`model-control-button ${viewMode === 'pan' ? 'active' : ''}`}
                        onClick={() => setViewMode('pan')}
                        aria-label="Pan view mode"
                        title="Pan mode"
                      >
                        <i className="fas fa-hand-paper"></i>
                      </button>
                    </div>
                    
                    <div className="project-3d-model">
                      {modelLoading && (
                        <div className="model-loading">
                          <i className="fas fa-cube"></i>
                        </div>
                      )}
                      <ProjectModelViewer 
                        projectId={project.id} 
                        onLoad={handleModelLoaded} 
                        animateModel={animateModel}
                        viewMode={viewMode}
                      />
                    </div>
                    
                    <div className="model-actions">
                      <a 
                        href={project.objFileUrl} 
                        download 
                        className="download-button"
                        onClick={handleDownloadModel}
                      >
                        <i className="fas fa-download"></i>
                        <span>Download 3D Model</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="model-placeholder">
                    <div className="placeholder-content">
                      <span className="model-icon">🏠</span>
                      <p>No 3D model has been uploaded for this project yet.</p>
                      <Link to={`/edit-project/${project.id}`} className="button-secondary">
                        <i className="fas fa-upload"></i> Upload a 3D Model
                      </Link>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Project Details Tab */}
            {activeTab === 'details' && (
              <div className="details-tab">
                <div className="project-card description-card">
                  <h3>Project Description</h3>
                  <p className="project-description">{project.description || "No description provided for this project."}</p>
                </div>
                
                <div className="project-card timeline-card">
                  <h3>Project Timeline</h3>
                  <div className="timeline">
                    <div className="timeline-item">
                      <div className="timeline-icon">
                        <i className="fas fa-calendar-plus"></i>
                      </div>
                      <div className="timeline-content">
                        <h4>Project Created</h4>
                        <p>{formatDate(project.createdAt)}</p>
                      </div>
                    </div>
                    
                    <div className="timeline-item">
                      <div className="timeline-icon">
                        <i className="fas fa-sync-alt"></i>
                      </div>
                      <div className="timeline-content">
                        <h4>Last Updated</h4>
                        <p>{formatDate(project.updatedAt)}</p>
                      </div>
                    </div>
                    
                    <div className="timeline-item">
                      <div className="timeline-icon">
                        <i className="fas fa-flag-checkered"></i>
                      </div>
                      <div className="timeline-content">
                        <h4>Current Status</h4>
                        <div className={`status-badge ${getStatusClass(project.status)}`}>
                          {getStatusDisplay(project.status)}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            
            {/* Team Tab */}
            {activeTab === 'team' && (
              <div className="team-tab">
                <div className="team-members">
                  <div className="team-card client-card">
                    <h3><i className="fas fa-user-tie"></i> Client</h3>
                    {clientDetails ? (
                      <div className="user-profile">
                        <div className="user-avatar">{clientDetails.name?.charAt(0) || 'C'}</div>
                        <div className="user-details">
                          <h4>{clientDetails.name || 'Unknown'}</h4>
                          <p>{clientDetails.email}</p>
                          <div className="user-role client">Client</div>
                        </div>
                      </div>
                    ) : (
                      <div className="placeholder-text">Client details not available</div>
                    )}
                  </div>
                  
                  <div className="team-card designer-card">
                    <h3><i className="fas fa-pencil-ruler"></i> Designer</h3>
                    {designerDetails ? (
                      <div className="user-profile">
                        <div className="user-avatar">{designerDetails.name?.charAt(0) || 'D'}</div>
                        <div className="user-details">
                          <h4>{designerDetails.name || 'Unknown'}</h4>
                          <p>{designerDetails.email}</p>
                          <div className="user-role designer">Designer</div>
                        </div>
                      </div>
                    ) : (
                      <div className="placeholder-text">Designer details not available</div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

    </div>
  );
}