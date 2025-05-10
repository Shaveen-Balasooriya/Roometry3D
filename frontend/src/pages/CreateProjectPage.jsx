import React from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import ProjectForm from './components/ProjectForm';
import '../App.css';
import './MyProjectsPage.css'; // Reuse MyProjectsPage styles for consistency

export default function CreateProjectPage() {
  const navigate = useNavigate();

  const handleProjectCreated = (result) => {
    // Navigate to room scaper after successful creation
    navigate(`/room-scaper`, { state: { projectId: result.id } });
  };

  const handleCancel = () => {
    // Navigate back to the projects list when canceled
    navigate('/my-projects');
  };

  return (
    <div className="app-container">

      <main className="main-content">
        <div className="my-projects-page">
          <div className="page-header">
            <h1>Create New Project</h1>
            <button 
              className="button-secondary" 
              onClick={handleCancel}
              aria-label="Cancel creation"
            >
              Back to Projects
            </button>
          </div>
          
          <div className="form-container">
            <ProjectForm onSuccess={handleProjectCreated} onCancel={handleCancel} />
          </div>
        </div>
      </main>
  
    </div>
  );
}