import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth } from '../services/firebase';
import Loading from '../components/Loading';
import Popup from '../components/Popup';
import Navbar from '../components/Navbar'; // Import Navbar
import '../App.css';
import './MyProjectsPage.css';

export default function MyProjectsPage() {
  const [projects, setProjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [popup, setPopup] = useState({ open: false, type: '', message: '' });
  const [userRole, setUserRole] = useState(null);
  const navigate = useNavigate();

  // Fetch user projects on component mount
  useEffect(() => {
    async function fetchUserProjects() {
      try {
        setLoading(true);
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
        
        const response = await fetch(`http://localhost:3001/api/users/${user.uid}/projects`, {
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
        setLoading(false);
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
      
      const response = await fetch(`http://localhost:3001/api/projects/${projectId}`, {
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
    <>
      <Navbar />
      <main className="main-content my-projects-page">
        <div className="page-content">
          <Popup
            open={popup.open}
            type={popup.type}
            message={popup.message}
            onClose={() => setPopup({ ...popup, open: false })}
          />
          
          <div className="projects-header">
            <h2 className="projects-title">My Projects</h2>
            <button 
              className="button-primary create-project-button"
              onClick={() => navigate('/create-project')}
            >
              <span className="plus-icon">+</span> Create Project
            </button>
          </div>

          <div className="container">
            {loading ? (
              <div className="loading-container">
                <Loading size={40} />
              </div>
            ) : error ? (
              <div className="error-message">
                <p>Error loading projects: {error}</p>
                <p>Please try refreshing the page.</p>
              </div>
            ) : projects.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">📁</div>
                <h3>No projects found</h3>
                <p>
                  {userRole === 'client' 
                    ? "You don't have any projects yet. Create your first project to get started!"
                    : userRole === 'designer'
                      ? "You haven't been assigned to any projects yet."
                      : "No projects available."}
                </p>
                {userRole === 'client' && (
                  <Link to="/create-project" className="button-secondary">
                    <i className="fas fa-plus-circle"></i> Create New Project
                  </Link>
                )}
              </div>
            ) : (
              <div className="projects-grid">
                {projects.map(project => (
                  <div key={project.id} className="project-card">
                    <div className="project-header">
                      <div className={`project-status ${getStatusClass(project.status)}`}>
                        {getStatusDisplay(project.status)}
                      </div>
                      <div className="project-actions">
                        <Link to={`/view-project/${project.id}`} className="action-button view-button" title="View Project">
                          <i className="fas fa-eye"></i>
                        </Link>
                        {(userRole === 'admin' || (userRole === 'designer' && project.designerId === auth.currentUser?.uid)) && (
                          <Link to={`/edit-project/${project.id}`} className="action-button edit-button" title="Edit Project">
                            <i className="fas fa-edit"></i>
                          </Link>
                        )}
                        {(userRole === 'admin' || (userRole === 'client' && project.clientId === auth.currentUser?.uid)) && (
                          <button 
                            onClick={() => handleDeleteProject(project.id, project.name)}
                            className="action-button delete-button"
                            title="Delete Project"
                          >
                            <i className="fas fa-trash"></i>
                          </button>
                        )}
                      </div>
                    </div>
                    
                    <h3 className="project-name">{project.name}</h3>
                    <p className="project-description">{project.description || "No description provided."}</p>
                    
                    <div className="project-details">
                      <div className="detail-item">
                        <span className="detail-label">Created</span>
                        <span className="detail-value">{formatDate(project.createdAt)}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Updated</span>
                        <span className="detail-value">{formatDate(project.updatedAt)}</span>
                      </div>
                    </div>

                    {project.objFileUrl && (
                      <div className="model-preview">
                        <Link to={`/view-project/${project.id}`} className="model-link">
                          <i className="fas fa-cube"></i> View 3D Model
                        </Link>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </main>
    </>
  );
}