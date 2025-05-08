import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser, registerUser, getCurrentUser, getUserRole, resetPassword } from '../services/firebase';
import Loading from '../components/Loading';
import './LoginPage.css';

export default function LoginPage() {
  const [activeTab, setActiveTab] = useState('login');
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    name: '',
  });
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [forgotPasswordModal, setForgotPasswordModal] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetEmailError, setResetEmailError] = useState('');
  const [resetEmailSuccess, setResetEmailSuccess] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const user = await getCurrentUser();
        if (user) {
          navigate('/');
        }
      } finally {
        setInitialLoading(false);
      }
    };
    checkAuth();
  }, [navigate]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    // Clear errors when user types
    setError('');
  };

  const validateForm = () => {
    if (activeTab === 'signup') {
      if (!formData.name.trim()) {
        setError('Please enter your name');
        return false;
      }
      if (formData.password !== formData.confirmPassword) {
        setError('Passwords do not match');
        return false;
      }
      if (formData.password.length < 6) {
        setError('Password must be at least 6 characters long');
        return false;
      }
    }
    
    if (!formData.email) {
      setError('Please enter your email');
      return false;
    }
    
    if (!formData.password) {
      setError('Please enter your password');
      return false;
    }
    
    return true;
  };

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      await loginUser(formData.email, formData.password);
      
      // Get the user's role and redirect based on role
      const user = await getCurrentUser();
      if (user) {
        const userRole = await getUserRole();
        console.log("User role:", userRole);
        
        if (userRole === 'admin') {
          navigate('/admin');
        } else {
          // For designers and clients, redirect to the new home page
          navigate('/');
        }
      } else {
        navigate('/');
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(err.message || 'Failed to sign in. Please check your credentials.');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e) => {
    e.preventDefault();
    
    if (!validateForm()) return;
    
    setLoading(true);
    try {
      await registerUser(formData.email, formData.password, formData.name);
      setSuccess('Account created successfully! You can now log in.');
      setActiveTab('login');
      setFormData(prev => ({ ...prev, password: '', confirmPassword: '' }));
    } catch (err) {
      console.error('Signup error:', err);
      setError(err.message || 'Failed to create account. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const switchTab = (tab) => {
    setActiveTab(tab);
    setError('');
    setSuccess('');
  };

  const handleForgotPassword = async (e) => {
    e.preventDefault();
    
    // Reset states
    setResetEmailError('');
    setResetEmailSuccess('');
    
    // Validate email
    if (!resetEmail || !/\S+@\S+\.\S+/.test(resetEmail)) {
      setResetEmailError('Please enter a valid email address');
      return;
    }
    
    setResetLoading(true);
    try {
      await resetPassword(resetEmail);
      setResetEmailSuccess('Password reset link sent! Check your email inbox.');
      setResetEmail('');
      
      // Auto close modal after success (3 seconds)
      setTimeout(() => {
        setForgotPasswordModal(false);
        setResetEmailSuccess('');
      }, 3000);
    } catch (err) {
      console.error('Password reset error:', err);
      if (err.code === 'auth/user-not-found') {
        setResetEmailError('No account found with this email address.');
      } else {
        setResetEmailError(err.message || 'Failed to send reset email. Please try again.');
      }
    } finally {
      setResetLoading(false);
    }
  };

  const openForgotPassword = () => {
    setForgotPasswordModal(true);
    setResetEmail(formData.email || ''); // Pre-fill with login email if available
    setResetEmailError('');
    setResetEmailSuccess('');
  };

  const closeForgotPassword = () => {
    setForgotPasswordModal(false);
    setResetEmailError('');
    setResetEmailSuccess('');
  };

  if (initialLoading) {
    return <div className="loading-container"><Loading size={40} /></div>;
  }

  return (
    <div className="login-container" style={{ minHeight: '100vh', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
      <div className="login-card">
        <h2>Roometry 3D</h2>
        
        <div className="auth-tabs">
          <div 
            className={`auth-tab ${activeTab === 'login' ? 'active' : ''}`}
            onClick={() => switchTab('login')}
            onKeyDown={(e) => e.key === 'Enter' && switchTab('login')}
            role="tab"
            tabIndex="0"
            aria-selected={activeTab === 'login'}
          >
            Login
          </div>
          <div 
            className={`auth-tab ${activeTab === 'signup' ? 'active' : ''}`}
            onClick={() => switchTab('signup')}
            onKeyDown={(e) => e.key === 'Enter' && switchTab('signup')}
            role="tab"
            tabIndex="0"
            aria-selected={activeTab === 'signup'}
          >
            Sign Up
          </div>
        </div>

        {error && <div className="error-message">{error}</div>}
        {success && <div className="success-message">{success}</div>}

        {activeTab === 'login' ? (
          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label htmlFor="email">Email</label>
              <div className="input-with-icon">
                
                <input
                  type="email"
                  id="email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="password">Password</label>
              <div className="input-with-icon">
                
                <input
                  type="password"
                  id="password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Enter your password"
                  autoComplete="current-password"
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="button-primary"
              disabled={loading}
            >
              {loading && <Loading size={20} className="loading-spinner" />}
              Login
            </button>

            <div className="form-footer">
              <button 
                type="button" 
                className="text-button"
                onClick={openForgotPassword}
              >
                Forgot password?
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSignup}>
            <div className="form-group">
              <label htmlFor="signup-name">Full Name</label>
              <div className="input-with-icon">
                <span className="input-icon">👤</span>
                <input
                  type="text"
                  id="signup-name"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="Enter your full name"
                  autoComplete="name"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="signup-email">Email</label>
              <div className="input-with-icon">
                <span className="input-icon">📧</span>
                <input
                  type="email"
                  id="signup-email"
                  name="email"
                  value={formData.email}
                  onChange={handleChange}
                  placeholder="Enter your email"
                  autoComplete="email"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="signup-password">Password</label>
              <div className="input-with-icon">
                <span className="input-icon">🔒</span>
                <input
                  type="password"
                  id="signup-password"
                  name="password"
                  value={formData.password}
                  onChange={handleChange}
                  placeholder="Create a password"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirm-password">Confirm Password</label>
              <div className="input-with-icon">
                <span className="input-icon">🔐</span>
                <input
                  type="password"
                  id="confirm-password"
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                  placeholder="Confirm your password"
                  autoComplete="new-password"
                />
              </div>
            </div>

            <button 
              type="submit" 
              className="button-primary"
              disabled={loading}
            >
              {loading && <Loading size={20} className="loading-spinner" />}
              Create Account
            </button>
          </form>
        )}
      </div>

      {/* Forgot Password Modal */}
      {forgotPasswordModal && (
        <div className="forgot-password-overlay">
          <div className="forgot-password-modal">
            <div className="forgot-password-header">
              <h3>Reset Your Password</h3>
              <button 
                className="close-modal-button" 
                onClick={closeForgotPassword}
                aria-label="Close"
              >
                &times;
              </button>
            </div>
            
            <div className="forgot-password-content">
              <p>Enter your email address and we'll send you a link to reset your password.</p>
              
              {resetEmailError && <div className="error-message">{resetEmailError}</div>}
              {resetEmailSuccess && <div className="success-message">{resetEmailSuccess}</div>}
              
              <form onSubmit={handleForgotPassword} className="forgot-password-form">
                <div className="form-group">
                  <label htmlFor="reset-email">Email Address</label>
                  <div className="input-with-icon">
                    <span className="input-icon">📧</span>
                    <input
                      type="email"
                      id="reset-email"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      placeholder="Enter your email address"
                      autoComplete="email"
                      disabled={resetLoading}
                    />
                  </div>
                </div>
                
                <div className="forgot-password-actions">
                  <button 
                    type="button" 
                    className="button-secondary" 
                    onClick={closeForgotPassword}
                    disabled={resetLoading}
                  >
                    Cancel
                  </button>
                  <button 
                    type="submit" 
                    className="button-primary"
                    disabled={resetLoading}
                  >
                    {resetLoading ? <Loading size={20} className="loading-spinner" /> : 'Send Reset Link'}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}