import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { loginUser, registerUser, getCurrentUser, getUserRole } from '../services/firebase';
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
              <button type="button" className="text-button">
                Forgot password?
              </button>
            </div>
          </form>
        ) : (
          <form onSubmit={handleSignup}>
            <div className="form-group">
              <label htmlFor="signup-name">Full Name</label>
              <div className="input-with-icon">
                <span className="input-icon"></span>
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
                <span className="input-icon"></span>
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
                <span className="input-icon"></span>
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
                <span className="input-icon"></span>
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
    </div>
  );
}