import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { auth } from '../services/firebase';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ProjectForm from './components/ProjectForm';
import Loading from '../components/Loading';
import '../App.css';


export default function EditProjectPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const API_URL = import.meta.env.VITE_BACKEND_URL;
  
  useEffect(() => {
    async function fetchProject() {
      try {
        setLoading(true);
        const user = auth.currentUser;
        
        if (!user) {
          throw new Error('Authentication required');
        }
        
        const idToken = await user.getIdToken();
        const response = await fetch(`${API_URL}/api/projects/${id}`, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.message || 'Failed to fetch project');
        }
        
        const projectData = await response.json();
        setProject(projectData);
      } catch (err) {
        console.error('Error loading project:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    }
    
    fetchProject();
  }, [id, API_URL]);

  const handleProjectUpdated = () => {
    // Navigate to the project details page after successful update
    navigate(`/view-project/${id}`);
  };

  if (loading) {
    return (
      <div className="app-container">
        
        <main className="main-content" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <Loading size={40} />
        </main>
        
      </div>
    );
  }

  if (error || !project) {
    return (
      <div className="app-container">
        
        <main className="main-content" style={{ justifyContent: 'center', alignItems: 'center' }}>
          <div className="error-container">
            <h2>Error</h2>
            <p>{error || 'Project not found'}</p>
            <button 
              className="button-secondary"
              onClick={() => navigate('/my-projects')}
            >
              Back to Projects
            </button>
          </div>
        </main>
        
      </div>
    );
  }

  return (
    <div className="app-container">
      
      <main 
        className="main-content"
        style={{
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 64px - 80px)',
          padding: '64px 0 60px 0',
          background: 'var(--background)',
        }}
      >
        {/* Breadcrumb navigation */}
        <div className="breadcrumbs">
          <Link to="/my-projects">My Projects</Link> / 
          <Link to={`/view-project/${id}`}>{project.name}</Link> / 
          <span>Edit</span>
        </div>
        
        {/* Page title */}
        <h2 style={{
          marginBottom: '2rem',
          color: 'var(--accent)',
          fontSize: '2.1rem',
          fontWeight: 700,
          textAlign: 'center'
        }}>Edit Project</h2>
        
        {/* Form container card */}
        <div
          style={{
            width: '100%',
            maxWidth: 800, // Slightly wider than profile page to accommodate the project form
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow)',
            border: '1px solid var(--border)',
            padding: '2.5rem 2.2rem 2rem 2.2rem',
            margin: '0 auto',
          }}
        >
          <ProjectForm 
            onSuccess={handleProjectUpdated}
            initialData={project}
            editMode={true}
            projectId={project.id}
          />
        </div>
      </main>
      
    </div>
  );
}