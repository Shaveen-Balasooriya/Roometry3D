import React, { useState, useEffect } from 'react';
import { auth } from '../services/firebase';
import Loading from '../components/Loading';
import Popup from '../components/Popup';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useNavigate } from 'react-router-dom';

export default function ProfilePage() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [popup, setPopup] = useState({ open: false, type: 'error', message: '' });
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_BACKEND_URL;
  useEffect(() => {
    async function fetchUserProfile() {
      try {
        const user = auth.currentUser;
        if (!user) {
          navigate('/login');
          return;
        }

        // Get authentication token
        const idToken = await user.getIdToken();
        
        // Fetch user profile data from backend
        const response = await fetch('${API_URL}/api/auth/verify', {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to fetch profile');
        }

        const data = await response.json();
        setProfile(data);
      } catch (err) {
        setPopup({ open: true, type: 'error', message: err.message || 'Error loading profile' });
      } finally {
        setLoading(false);
      }
    }

    fetchUserProfile();
  }, [navigate]);

  // Format date for display
  const formatDate = (timestamp) => {
    if (!timestamp) return 'Never';
    
    const date = new Date(timestamp);
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(date);
  };

  // Get user role display text and icon
  const getRoleInfo = (role) => {
    switch(role) {
      case 'admin':
        return { 
          text: 'Administrator',
          icon: '👑',
          description: 'Full access to all system features'
        };
      case 'designer':
        return { 
          text: 'Designer',
          icon: '🎨',
          description: 'Can create and modify 3D designs'
        };
      case 'client':
        return { 
          text: 'Client',
          icon: '👤',
          description: 'Can view and request design projects'
        };
      default:
        return { 
          text: 'User',
          icon: '😊',
          description: 'Basic user access'
        };
    }
  };

  return (
    <div className="app-container">
      <Navbar />
      <Popup
        open={popup.open}
        type={popup.type}
        message={popup.message}
        onClose={() => setPopup({ ...popup, open: false })}
      />
      
      <main className="main-content" style={{ 
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '3rem 1rem',
        background: 'var(--background)'
      }}>
        <h1 style={{ 
          color: 'var(--accent)',
          marginBottom: '2rem',
          fontSize: '2.2rem',
          fontWeight: 700
        }}>My Profile</h1>
        
        {loading ? (
          <Loading size={40} />
        ) : profile ? (
          <div style={{
            width: '100%',
            maxWidth: '800px',
            display: 'grid',
            gridTemplateColumns: '1fr',
            gap: '2rem',
          }}>
            {/* Profile Overview */}
            <div className="profile-card" style={{
              background: 'var(--surface)',
              borderRadius: 'var(--radius-lg)',
              boxShadow: 'var(--shadow-soft)',
              overflow: 'hidden',
            }}>
              <div style={{
                background: 'linear-gradient(135deg, var(--accent) 0%, var(--primary) 100%)',
                padding: '2.5rem 2rem',
                position: 'relative',
                overflow: 'hidden',
              }}>
                <div style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  background: 'radial-gradient(circle at 70% 30%, rgba(255, 255, 255, 0.1) 0%, transparent 70%)',
                }}></div>
                
                <div style={{
                  display: 'flex',
                  alignItems: 'center',
                  position: 'relative',
                }}>
                  <div style={{
                    width: '80px',
                    height: '80px',
                    borderRadius: '50%',
                    background: 'white',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '2rem',
                    marginRight: '1.5rem',
                    boxShadow: '0 8px 25px rgba(0, 0, 0, 0.15)'
                  }}>
                    {profile.name ? profile.name.charAt(0).toUpperCase() : 'U'}
                  </div>
                  <div>
                    <h2 style={{
                      color: 'white',
                      fontSize: '1.75rem',
                      fontWeight: 700,
                      margin: 0,
                    }}>{profile.name}</h2>
                    <div style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      background: 'rgba(255, 255, 255, 0.15)',
                      backdropFilter: 'blur(8px)',
                      padding: '0.4rem 1rem',
                      borderRadius: '50px',
                      color: 'white',
                      fontWeight: 600,
                      fontSize: '0.9rem',
                      marginTop: '0.75rem',
                    }}>
                      <span style={{ marginRight: '0.5rem' }}>{getRoleInfo(profile.role || profile.userType).icon}</span>
                      {getRoleInfo(profile.role || profile.userType).text}
                    </div>
                  </div>
                </div>
              </div>
              
              <div style={{ padding: '2rem' }}>
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))',
                  gap: '2rem',
                }}>
                  <div className="profile-info-section">
                    <h3 style={{
                      color: 'var(--text-dark)',
                      marginTop: 0,
                      marginBottom: '1rem',
                      paddingBottom: '0.75rem',
                      borderBottom: '1px solid var(--border-light)',
                      fontSize: '1.2rem',
                    }}>Account Information</h3>
                    
                    <div className="info-item" style={{ marginBottom: '1rem' }}>
                      <div style={{ color: 'var(--text-medium)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Email</div>
                      <div style={{ fontWeight: 500, color: 'var(--text-dark)' }}>{profile.email}</div>
                    </div>
                    
                    <div className="info-item" style={{ marginBottom: '1rem' }}>
                      <div style={{ color: 'var(--text-medium)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>User ID</div>
                      <div style={{ 
                        fontWeight: 500, 
                        color: 'var(--text-dark)',
                        fontSize: '0.9rem',
                        fontFamily: 'monospace',
                        background: 'var(--background)',
                        padding: '0.5rem',
                        borderRadius: '4px',
                        overflowX: 'auto'
                      }}>{profile.uid}</div>
                    </div>
                    
                    <div className="info-item" style={{ marginBottom: '1rem' }}>
                      <div style={{ color: 'var(--text-medium)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Access Level</div>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ 
                          fontWeight: 500, 
                          color: 'var(--accent)',
                        }}>{getRoleInfo(profile.role || profile.userType).text}</span>
                      </div>
                      <div style={{ 
                        fontSize: '0.85rem', 
                        color: 'var(--text-light)',
                        marginTop: '0.25rem' 
                      }}>
                        {getRoleInfo(profile.role || profile.userType).description}
                      </div>
                    </div>
                  </div>
                  
                  <div className="profile-info-section">
                    <h3 style={{
                      color: 'var(--text-dark)',
                      marginTop: 0,
                      marginBottom: '1rem',
                      paddingBottom: '0.75rem',
                      borderBottom: '1px solid var(--border-light)',
                      fontSize: '1.2rem',
                    }}>Activity</h3>
                    
                    <div className="info-item" style={{ marginBottom: '1rem' }}>
                      <div style={{ color: 'var(--text-medium)', fontSize: '0.9rem', marginBottom: '0.25rem' }}>Last Login</div>
                      <div style={{ fontWeight: 500, color: 'var(--text-dark)' }}>
                        {profile.lastLogin ? formatDate(profile.lastLogin) : 'Never'}
                      </div>
                    </div>
                    
                    <div className="action-buttons" style={{
                      display: 'flex',
                      gap: '1rem',
                      marginTop: '2rem',
                    }}>
                      <button
                        className="button-secondary"
                        style={{ flex: 1 }}
                        onClick={() => navigate('/edit-profile')}
                      >
                        Update Profile
                      </button>
                      <button
                        className="button-secondary"
                        style={{ flex: 1 }}
                        onClick={() => navigate('/change-password')}
                      >
                        Change Password
                      </button>
                    </div>
                    
                    <div className="note" style={{
                      marginTop: '2rem',
                      padding: '1rem',
                      background: 'rgba(var(--accent-rgb), 0.05)',
                      borderLeft: '4px solid var(--accent)',
                      borderRadius: '4px',
                    }}>
                      <p style={{ margin: 0, color: 'var(--text-medium)', fontSize: '0.9rem' }}>
                        <strong style={{ color: 'var(--accent)' }}>Note:</strong> To change your role or access level, please contact an administrator.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="error-message">Failed to load profile information</div>
        )}
      </main>
      <Footer />
    </div>
  );
}