import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
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
  }, [id]);

  const handleProjectUpdated = () => {
    // Navigate to the project details page after successful update
    navigate(`/view-project/${id}`);
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
            <button 
              className="button-secondary"
              onClick={() => navigate('/my-projects')}
            >
              Back to Projects
            </button>
          </div>
        </main>
        <Footer />
      </div>
    );
  }

  return (
    <div className="app-container">
      <Navbar />
      <main className="main-content">
        <div className="page-header">
          <h1>Edit Project: {project.name}</h1>
        </div>
        
        <div className="form-container">
          <ProjectForm 
            onSuccess={handleProjectUpdated}
            initialData={project}
            editMode={true}
            projectId={project.id}
          />
        </div>
      </main>
      <Footer />
    </div>
  );
}