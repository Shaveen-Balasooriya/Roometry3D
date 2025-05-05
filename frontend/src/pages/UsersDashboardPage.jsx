import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Loading from '../components/Loading';
import Popup from '../components/Popup';
import ConfirmationPopup from '../components/ConfirmationPopup';
import { auth } from '../services/firebase';

export default function UsersDashboardPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState({ open: false, type: 'error', message: '' });
  const [confirm, setConfirm] = useState({ open: false, user: null });
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_BACKEND_URL;
  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setLoading(true);
    try {
      // Get the current user's auth token
      const user = auth.currentUser;
      if (!user) {
        throw new Error('You must be logged in to access this page');
      }
      
      const idToken = await user.getIdToken();
      
      const response = await fetch(`${API_URL}/api/users`, {
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to fetch users');
      }
      
      const items = await response.json();
      setUsers(items);
    } catch (err) {
      console.error('Error fetching users:', err);
      setPopup({ open: true, type: 'error', message: 'Failed to load users: ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = (user) => {
    setConfirm({ open: true, user });
  };

  const handleCancelDelete = () => {
    setConfirm({ open: false, user: null });
  };

  const handleConfirmDelete = async () => {
    const user = confirm.user;
    setConfirm({ open: false, user: null });
    if (!user) return;
    setLoading(true);
    try {
      // Get the current user's auth token
      const currentUser = auth.currentUser;
      if (!currentUser) {
        throw new Error('You must be logged in to perform this action');
      }
      
      const idToken = await currentUser.getIdToken();
      
      const response = await fetch(`${API_URL}/api/users/${user.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.message || 'Failed to delete user');
      }
      setPopup({ open: true, type: 'success', message: `User "${user.name}" deleted successfully!` });
      setUsers(users.filter(u => u.id !== user.id));
    } catch (err) {
      console.error('Error deleting user:', err);
      setPopup({ open: true, type: 'error', message: err.message || 'Error deleting user.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <Popup open={popup.open} type={popup.type} message={popup.message} onClose={() => setPopup({ ...popup, open: false })} />
      <ConfirmationPopup
        open={confirm.open}
        message={
          confirm.user
            ? `Are you sure you want to delete "${confirm.user.name}"? This action cannot be undone.`
            : ''
        }
        onConfirm={handleConfirmDelete}
        onCancel={handleCancelDelete}
        confirmText="Delete"
        confirmButtonClass="button-primary"
      />
      <main className="main-content" style={{ flexDirection: 'column', alignItems: 'stretch', minHeight: 'calc(100vh - 64px - 80px)', padding: '64px 0 60px 0' }}>
        <h2 style={{ marginBottom: '2.5rem', color: 'var(--accent)', fontSize: '2.1rem', fontWeight: 700, textAlign: 'center' }}>Users Dashboard</h2>
        {loading ? (
          <Loading />
        ) : (
          <div style={{ overflowX: 'auto', width: '100%', background: 'var(--surface)', borderRadius: 'var(--radius)', boxShadow: 'var(--shadow)', border: '1px solid var(--border)', padding: '2.5rem 2.2rem 2rem 2.2rem', margin: '0 auto', maxWidth: 900 }}>
            {users.length === 0 ? (
              <div>No users found.</div>
            ) : (
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: 'var(--primary-dark)' }}>
                    <th style={{ padding: '0.8rem', borderBottom: '2px solid var(--border)', textAlign: 'left' }}>Name</th>
                    <th style={{ padding: '0.8rem', borderBottom: '2px solid var(--border)', textAlign: 'left' }}>Email</th>
                    <th style={{ padding: '0.8rem', borderBottom: '2px solid var(--border)', textAlign: 'left' }}>Role</th>
                    <th style={{ padding: '0.8rem', borderBottom: '2px solid var(--border)', textAlign: 'left' }}>Created</th>
                    <th style={{ padding: '0.8rem', borderBottom: '2px solid var(--border)' }}></th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '0.8rem' }}>{user.name}</td>
                      <td style={{ padding: '0.8rem' }}>{user.email}</td>
                      <td style={{ padding: '0.8rem', textTransform: 'capitalize' }}>{user.userType}</td>
                      <td style={{ padding: '0.8rem' }}>{user.createdAt ? new Date(user.createdAt._seconds ? user.createdAt._seconds * 1000 : user.createdAt).toLocaleString() : '-'}</td>
                      <td style={{ padding: '0.8rem', textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <button
                          className="button-secondary"
                          style={{ marginRight: 8, minWidth: 0, padding: '0.3rem 1rem' }}
                          onClick={() => navigate(`/edit-user/${user.id}`)}
                        >
                          Edit
                        </button>
                        <button
                          className="button-primary"
                          style={{ background: 'var(--error)', borderColor: 'var(--error)', minWidth: 0, padding: '0.3rem 1rem' }}
                          onClick={() => handleDelete(user)}
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
