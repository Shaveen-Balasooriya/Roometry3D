import React from 'react';
import UserForm from './components/UserForm';

export default function AddUserPage() {
  const handleUserCreationSuccess = (userData) => {
    console.log('User created successfully:', userData);
    // Future feature - could refresh a list of users here
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
        }}>Add User</h2>
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
            
            flexDirection: 'column',
            alignItems: 'center',
          }}
        >
          <UserForm onSuccess={handleUserCreationSuccess} />
        </div>
      </main>
    </div>
  );
}
