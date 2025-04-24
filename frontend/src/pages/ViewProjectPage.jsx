import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { auth } from '../services/firebase';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Loading from '../components/Loading';
import ProjectModelViewer from './components/ProjectModelViewer';
import '../App.css';
import './ViewProjectPage.css';

export default function ViewProjectPage() {
  const { id } = useParams();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [clientDetails, setClientDetails] = useState(null);
  const [designerDetails, setDesignerDetails] = useState(null);
  const [activeTab, setActiveTab] = useState('model'); // Default to model view

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
        const projectResponse = await fetch(`http://localhost:3001/api/projects/${id}`, {
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
        const clientResponse = await fetch(`http://localhost:3001/api/users/${projectData.clientId}`, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });
        
        if (clientResponse.ok) {
          const clientData = await clientResponse.json();
          setClientDetails(clientData);
        }
        
        // Fetch designer details
        const designerResponse = await fetch(`http://localhost:3001/api/users/${projectData.designerId}`, {
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

  if (loading) {
    return (
      <div className="app-container">
        <Navbar />
        <main className="main-content">
          <div className="loading-container">
            <Loading size={40} />
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="app-container">
        <Navbar />
        <main className="main-content">
          <div className="error-container">
            <h2>Error</h2>
            <p>{error || 'Project not found'}</p>
            <Link to="/my-projects" className="button-secondary">
              Back to Projects
            </Link>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content project-view-page">
        <div className="project-view-container">
          <div className="project-view-header">
            <div className="breadcrumbs">
              <Link to="/my-projects">Projects</Link> / {project.name}
            </div>
            
            <div className="project-view-actions">
              <Link to={`/edit-project/${project.id}`} className="action-btn btn-edit">
                <i className="fas fa-edit"></i> Edit Project
              </Link>
              <Link to="/my-projects" className="action-btn btn-back">
                <i className="fas fa-arrow-left"></i> Back
              </Link>
            </div>
          </div>
          
          <div className="project-title-section">
            <h1>{project.name}</h1>
            <div className={`status-badge ${getStatusClass(project.status)}`}>
              {getStatusDisplay(project.status)}
            </div>
          </div>
          
          {/* Tab Navigation */}
          <div className="project-tabs">
            <button 
              className={`tab-button ${activeTab === 'model' ? 'active' : ''}`}
              onClick={() => setActiveTab('model')}
            >
              <i className="fas fa-cube"></i> 3D Model
            </button>
            <button 
              className={`tab-button ${activeTab === 'details' ? 'active' : ''}`}
              onClick={() => setActiveTab('details')}
            >
              <i className="fas fa-info-circle"></i> Project Details
            </button>
            <button 
              className={`tab-button ${activeTab === 'team' ? 'active' : ''}`}
              onClick={() => setActiveTab('team')}
            >
              <i className="fas fa-users"></i> Team
            </button>
          </div>
          
          {/* Tab Content */}
          <div className="tab-content">
            {/* 3D Model Tab */}
            {activeTab === 'model' && (
              <div className="model-tab">
                {project.objFileUrl ? (
                  <div className="project-3d-model">
                    <ProjectModelViewer projectId={project.id} />
                    {project.objFileUrl && (
                      <div className="model-actions">
                        <a 
                          href={project.objFileUrl} 
                          download 
                          className="button-secondary"
                        >
                          <i className="fas fa-download"></i> Download Model
                        </a>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="model-placeholder">
                    <div className="placeholder-content">
                      <span className="model-icon">🏠</span>
                      <p>No 3D model has been uploaded for this project yet.</p>
                    </div>
                  </div>
                )}
              </div>
            )}
            
            {/* Project Details Tab */}
            {activeTab === 'details' && (
              <div className="details-tab">
                <div className="project-card">
                  <h3>Project Description</h3>
                  <p className="project-description">{project.description || "No description provided for this project."}</p>
                </div>
                
                <div className="project-card">
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
                  <div className="team-card">
                    <h3>Client</h3>
                    {clientDetails ? (
                      <div className="user-profile">
                        <div className="user-avatar">{clientDetails.name?.charAt(0) || 'C'}</div>
                        <div className="user-details">
                          <h4>{clientDetails.name || 'Unknown'}</h4>
                          <p>{clientDetails.email}</p>
                          <span className="user-role client">Client</span>
                        </div>
                      </div>
                    ) : (
                      <div className="placeholder-text">Client details not available</div>
                    )}
                  </div>
                  
                  <div className="team-card">
                    <h3>Designer</h3>
                    {designerDetails ? (
                      <div className="user-profile">
                        <div className="user-avatar">{designerDetails.name?.charAt(0) || 'D'}</div>
                        <div className="user-details">
                          <h4>{designerDetails.name || 'Unknown'}</h4>
                          <p>{designerDetails.email}</p>
                          <span className="user-role designer">Designer</span>
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
      <Footer />
    </div>
  );
}