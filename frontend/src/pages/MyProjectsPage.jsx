import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { auth } from '../services/firebase';
import Loading from '../components/Loading';
import Popup from '../components/Popup';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import '../App.css';
import './MyProjectsPage.css';

export default function MyProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [popup, setPopup] = useState({ open: false, type: '', message: '' });
  const [userRole, setUserRole] = useState(null);
  const API_URL = import.meta.env.VITE_BACKEND_URL;

  // Fetch user projects on component mount
  useEffect(() => {
    async function fetchUserProjects() {
      try {
        setIsLoading(true);
        const user = auth.currentUser;
        
        if (!user) {
          throw new Error('User not authenticated');
        }

        // Get user token to identify role
        const token = await user.getIdTokenResult();
        const role = token.claims.role || token.claims.userType;
        setUserRole(role);

        // Get auth token for API request
        const idToken = await user.getIdToken();
        
        const response = await fetch(`${API_URL}/api/users/${user.uid}/projects`, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.message || 'Failed to fetch projects');
        }

        const data = await response.json();
        setProjects(data);
      } catch (err) {
        console.error('Error fetching projects:', err);
        setError(err.message);
        setPopup({
          open: true,
          type: 'error',
          message: `Error: ${err.message}`
        });
      } finally {
        setIsLoading(false);
      }
    }

    fetchUserProjects();
  }, []);

  const handleDeleteProject = async (projectId, projectName) => {
    // Confirm before deleting
    if (!confirm(`Are you sure you want to delete "${projectName}"?`)) {
      return;
    }

    try {
      const user = auth.currentUser;
      const idToken = await user.getIdToken();
      
      const response = await fetch(`${API_URL}/api/projects/${projectId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.message || 'Failed to delete project');
      }

      // Remove project from state
      setProjects(projects.filter(project => project.id !== projectId));
      
      setPopup({
        open: true,
        type: 'success',
        message: `Project "${projectName}" deleted successfully`
      });
    } catch (err) {
      console.error('Error deleting project:', err);
      setPopup({
        open: true,
        type: 'error',
        message: `Error: ${err.message}`
      });
    }
  };

  // Format date helper
  const formatDate = (timestamp) => {
    if (!timestamp) return 'N/A';
    const date = new Date(timestamp);
    return date.toLocaleDateString('en-US', { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // Get status badge class
  const getStatusClass = (status) => {
    switch(status) {
      case 'draft': return 'status-draft';
      case 'in_progress': return 'status-progress';
      case 'completed': return 'status-completed';
      default: return '';
    }
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

  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">
        <Popup
          open={popup.open}
          type={popup.type}
          message={popup.message}
          onClose={() => setPopup({ ...popup, open: false })}
        />
        
        <div className="page-content">
          <div className="page-header-container">
            <h2 className="page-title">My Projects</h2>
            
            <Link to="/create-project" className="button-primary create-project-button">
              <span className="create-project-icon">+</span> Create New Project
            </Link>
          </div>

          {loading ? (
            <div className="loading-container">
              <Loading size={40} />
            </div>
          ) : error ? (
            <div className="error-container">
              <div className="error-message-box">
                <p className="error-message-title">Error loading projects: {error}</p>
                <p className="error-message-text">Please try refreshing the page.</p>
              </div>
            </div>
          ) : projects.length === 0 ? (
            <div className="empty-projects-container">
              <div className="empty-projects-content">
                <div className="empty-projects-icon">📁</div>
                <h3 className="empty-projects-title">No projects found</h3>
                <p className="empty-projects-text">
                  {userRole === 'client' 
                    ? "You don't have any projects yet. Create your first project to get started!"
                    : userRole === 'designer'
                      ? "You haven't been assigned to any projects yet."
                      : "No projects available."}
                </p>
                {userRole === 'client' && (
                  <Link to="/create-project" className="button-secondary">
                    <span style={{ marginRight: '0.5rem' }}>+</span> Create New Project
                  </Link>
                )}
              </div>
            </div>
          ) : (
            <div className="projects-container">
              <div className="projects-grid">
                {projects.map(project => (
                  <div key={project.id} className="project-card">
                    <div className="project-card-header"></div>
                    
                    <div className="project-card-top">
                      <div className={`project-status-badge ${getStatusClass(project.status)}`}>
                        {getStatusDisplay(project.status)}
                      </div>
                      
                      <div className="project-actions">
                        <Link 
                          to={`/view-project/${project.id}`} 
                          className="action-button"
                          title="View Project"
                        >
                          <i className="fas fa-eye"></i>
                        </Link>
                        
                        {(userRole === 'admin' || (userRole === 'designer' && project.designerId === auth.currentUser?.uid)) && (
                          <Link 
                            to={`/edit-project/${project.id}`} 
                            className="action-button"
                            title="Edit Project"
                          >
                            <i className="fas fa-edit"></i>
                          </Link>
                        )}
                        
                        {(userRole === 'admin' || (userRole === 'client' && project.clientId === auth.currentUser?.uid)) && (
                          <button 
                            onClick={() => handleDeleteProject(project.id, project.name)}
                            className="action-button"
                            title="Delete Project"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <h3 className="project-title">{project.name}</h3>
                    
                    <p className="project-description">
                      {project.description || "No description provided."}
                    </p>
                    
                    <div className="project-footer">
                      <div className="project-meta-row">
                        <span className="meta-label">Created</span>
                        <span className="meta-value">{formatDate(project.createdAt)}</span>
                      </div>
                      
                      <div className="project-meta-row">
                        <span className="meta-label">Updated</span>
                        <span className="meta-value">{formatDate(project.updatedAt)}</span>
                      </div>
                    </div>

                    {project.objFileUrl && (
                      <div className="model-button-container">
                        <Link 
                          to={`/view-project/${project.id}`} 
                          className="model-button"
                        >
                          <i className="fas fa-cube model-button-icon"></i> View 3D Model
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}