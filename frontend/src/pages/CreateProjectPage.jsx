import React from 'react';
import { useNavigate } from 'react-router-dom';
import ProjectForm from './components/ProjectForm';

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
      <main
        className="main-content"
        style={{
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: 'calc(100vh - 64px - 80px)', // leave space for navbar/footer
          padding: '64px 0 60px 0', // top/bottom space for navbar/footer
          background: 'var(--background)',
        }}
      >
        <h2 style={{
          marginBottom: '2.5rem',
          color: 'var(--accent)',
          fontSize: '2.1rem',
          fontWeight: 700,
          textAlign: 'center'
        }}>Create New Project</h2>
        
        <div
          style={{
            width: '100%',
            maxWidth: '900px',
            background: 'var(--surface)',
            borderRadius: 'var(--radius)',
            boxShadow: 'var(--shadow)',
            border: '1px solid var(--border)',
            padding: '2.5rem 2.2rem 2rem 2.2rem',
            margin: '0 auto',
          }}
        >
          <ProjectForm 
            onSuccess={handleProjectCreated}
            onCancel={handleCancel}
          />
        </div>
      </main>
    </div>
  );
}