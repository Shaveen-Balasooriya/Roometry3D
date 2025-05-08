import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Loading from '../components/Loading';
import Popup from '../components/Popup';
import ConfirmationPopup from '../components/ConfirmationPopup';
import { auth } from '../services/firebase';
import './HomePage.css'; // Import HomePage styles for consistent theming
import './UsersDashboard.css'; // We'll create this file for responsive table styles

export default function UsersDashboardPage() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState({ open: false, type: 'error', message: '' });
  const [confirm, setConfirm] = useState({ open: false, user: null });
  const navigate = useNavigate();

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
      
      const response = await fetch('http://localhost:3001/api/users', {
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
      
      const response = await fetch(`http://localhost:3001/api/users/${user.id}`, {
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
    <div className="page-content">
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
      
      {/* Dashboard header with consistent spacing */}
      <div className="dashboard-header">
        <h2 className="dashboard-title">Users Dashboard</h2>
        
        <button
          className="button-primary add-user-button"
          onClick={() => navigate('/add-user')}
        >
          <span className="plus-icon">+</span> Add User
        </button>
      </div>
      
      {loading ? (
        <Loading />
      ) : (
        <div className="table-container">
          {/* Table content stays the same */}
          {users.length === 0 ? (
            <div className="no-data-message">No users found.</div>
          ) : (
            <div className="responsive-table">
              <table className="users-table">
                <thead>
                  <tr>
                    <th className="name-column">
                      <span className="column-title">Name</span>
                      <span className="gold-underline"></span>
                    </th>
                    <th className="email-column">Email</th>
                    <th className="role-column">Role</th>
                    <th className="created-column">Created</th>
                    <th className="actions-column">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id}>
                      <td data-label="Name">{user.name}</td>
                      <td data-label="Email" className="email-cell">{user.email}</td>
                      <td data-label="Role" className="role-cell">{user.userType}</td>
                      <td data-label="Created" className="date-cell">
                        {user.createdAt ? new Date(
                          user.createdAt._seconds 
                            ? user.createdAt._seconds * 1000 
                            : user.createdAt
                        ).toLocaleString() : '-'}
                      </td>
                      <td className="actions-cell">
                        <div className="action-buttons">
                          <button
                            className="icon-button edit-button"
                            onClick={() => navigate(`/edit-user/${user.id}`)}
                            title="Edit User"
                            aria-label={`Edit ${user.name}`}
                          >
                            <svg 
                              width="16" 
                              height="16" 
                              viewBox="0 0 24 24" 
                              fill="none" 
                              stroke="white"
                              strokeWidth="2" 
                              strokeLinecap="round" 
                              strokeLinejoin="round"
                            >
                              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
                              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
                            </svg>
                          </button>
                          
                          <button
                            className="icon-button delete-button"
                            onClick={() => handleDelete(user)}
                            title="Delete User"
                            aria-label={`Delete ${user.name}`}
                          >
                            <svg 
                              width="16" 
                              height="16" 
                              viewBox="0 0 24 24" 
                              fill="none" 
                              stroke="white" 
                              strokeWidth="2" 
                              strokeLinecap="round" 
                              strokeLinejoin="round"
                            >
                              <polyline points="3 6 5 6 21 6"></polyline>
                              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                              <line x1="10" y1="11" x2="10" y2="17"></line>
                              <line x1="14" y1="11" x2="14" y2="17"></line>
                            </svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
