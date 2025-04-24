import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import UserForm from './components/UserForm';
import Loading from '../components/Loading';
import Popup from '../components/Popup';
import { auth } from '../services/firebase';

export default function EditUserPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [formData, setFormData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState({ open: false, type: 'error', message: '' });

  useEffect(() => {
    async function fetchUser() {
      setLoading(true);
      try {
        // Get the current user's auth token
        const user = auth.currentUser;
        if (!user) {
          throw new Error('You must be logged in to access this page');
        }
        
        const idToken = await user.getIdToken();
        
        const response = await fetch(`http://localhost:3001/api/users/${id}`, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to fetch user');
        }
        const data = await response.json();
        setFormData({
          name: data.name || '',
          email: data.email || '',
          password: '',
          confirmPassword: '',
          userType: data.userType || 'admin'
        });
      } catch (err) {
        console.error('Error fetching user:', err);
        setPopup({ open: true, type: 'error', message: err.message });
      } finally {
        setLoading(false);
      }
    }
    fetchUser();
  }, [id]);

  // For update: handle success and possible redirect
  const handleSuccess = () => {
    setPopup({ open: true, type: 'success', message: 'User updated successfully!' });
    setTimeout(() => navigate('/users-dashboard'), 1800);
  };

  if (loading) return <Loading overlay />;
  if (!formData) {
    return (
      <div>
        <Popup open={popup.open} type={popup.type} message={popup.message} onClose={() => setPopup({ ...popup, open: false })} />
        <p>Could not load user data. <button onClick={() => navigate('/users-dashboard')}>Go Back</button></p>
      </div>
    );
  }

  return (
    <>
      <Popup open={popup.open} type={popup.type} message={popup.message} onClose={() => setPopup({ ...popup, open: false })} />
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
          <h2 style={{
            marginBottom: '2.5rem',
            color: 'var(--accent)',
            fontSize: '2.1rem',
            fontWeight: 700,
            textAlign: 'center'
          }}>Edit User</h2>
          <div
            style={{
              width: '100%',
              maxWidth: 480,
              background: 'var(--surface)',
              borderRadius: 'var(--radius)',
              boxShadow: 'var(--shadow)',
              border: '1px solid var(--border)',
              padding: '2.5rem 2.2rem 2rem 2.2rem',
              margin: '0 auto',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <UserForm
              initialData={formData}
              editMode
              userId={id}
              onSuccess={handleSuccess}
            />
          </div>
        </main>
      </div>
    </>
  );
}
