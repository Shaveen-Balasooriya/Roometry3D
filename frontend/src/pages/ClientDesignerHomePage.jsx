import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { auth, getUserRole } from '../services/firebase';
import Loading from '../components/Loading';
import './HomePage.css'; // Reusing the same CSS with additional styles

export default function ClientDesignerHomePage() {
  const [userName, setUserName] = useState('');
  const [userRole, setUserRole] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [recentProjects, setRecentProjects] = useState([]);
  const navigate = useNavigate();
  const API_URL = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const user = auth.currentUser;
        if (user) {
          setUserName(user.displayName || 'User');
          const role = await getUserRole();
          setUserRole(role);
        }
      } catch (error) {
        console.error('Error fetching user data:', error);
      }
    };

    const fetchRecentProjects = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const idToken = await user.getIdToken();
        const response = await fetch(`${API_URL}/api/projects/recent?limit=3`, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        });

        if (response.ok) {
          const data = await response.json();
          setRecentProjects(data.projects || []);
        }
      } catch (error) {
        console.error('Error fetching recent projects:', error);
      } finally {
        setIsLoading(false);
      }
    };

    fetchUserData();
    fetchRecentProjects();
  }, [API_URL]);

  // Quick access links for clients and designers
  const featureCards = [
    {
      title: "Create New Project",
      description: "Start designing your dream space with our 3D visualization tools",
      icon: "🏠",
      color: "#4299E1", // Blue
      path: "/create-project"
    },
    {
      title: "Browse Furniture",
      description: "Explore our catalog of high-quality furniture for your designs",
      icon: "🪑",
      color: "#48BB78", // Green
      path: "/customer-designer-furniture-catalogue"
    },
    {
      title: "My Projects",
      description: "View and manage all your ongoing and completed projects",
      icon: "📋",
      color: "#ED8936", // Orange
      path: "/my-projects"
    },
    {
      title: "Shopping Cart",
      description: "Check your selected furniture items ready for ordering",
      icon: "🛒",
      color: "#9F7AEA", // Purple
      path: "/cart"
    }
  ];

  const TimeOfDayGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <main className="home-content client-designer-home">
      {/* Hero Section */}
      <section className="hero-section">
        <div className="hero-content">
          <h1>{TimeOfDayGreeting()}, {userName}!</h1>
          <p className="role-badge">{userRole === 'designer' ? 'Interior Designer' : 'Client'}</p>
          <p className="hero-subtitle">
            Welcome to your personalized Roometry 3D dashboard. Design, visualize, and transform spaces effortlessly.
          </p>
        </div>
        <div className="hero-graphic">
          <img 
            src="/assets/roometry3d-visualization.svg" 
            alt="Roometry 3D Visualization" 
            className="hero-image"
          />
        </div>
      </section>

      {/* Feature Cards */}
      <section className="features-section">
        <h2 className="section-title">Quick Actions</h2>
        <div className="feature-cards">
          {featureCards.map((card, index) => (
            <Link to={card.path} className="feature-card" key={index} style={{ borderTopColor: card.color }}>
              <div className="feature-icon" style={{ backgroundColor: card.color }}>
                <span>{card.icon}</span>
              </div>
              <h3>{card.title}</h3>
              <p>{card.description}</p>
            </Link>
          ))}
        </div>
      </section>

      {/* Recent Projects Section */}
      <section className="recent-projects-section">
        <h2 className="section-title">Recent Projects</h2>
        {isLoading ? (
          <div className="loading-container">
            <Loading />
          </div>
        ) : recentProjects.length > 0 ? (
          <div className="recent-projects-grid">
            {recentProjects.map(project => (
              <div className="project-card" key={project.id}>
                <div className="project-image-container">
                  {project.thumbnailUrl ? (
                    <img src={project.thumbnailUrl} alt={project.name} className="project-thumbnail" />
                  ) : (
                    <div className="project-thumbnail-placeholder">
                      <span>3D</span>
                    </div>
                  )}
                </div>
                <div className="project-details">
                  <h3>{project.name}</h3>
                  <p className="project-date">Last updated: {new Date(project.updatedAt?.toDate()).toLocaleDateString()}</p>
                  <div className="project-actions">
                    <button 
                      onClick={() => navigate(`/view-project/${project.id}`)}
                      className="btn-primary btn-sm"
                    >
                      View Project
                    </button>
                    <button 
                      onClick={() => navigate(`/edit-project/${project.id}`)}
                      className="btn-outline btn-sm"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="no-projects">
            <p>You don't have any projects yet.</p>
            <button onClick={() => navigate('/create-project')} className="btn-primary">
              Create Your First Project
            </button>
          </div>
        )}
        {recentProjects.length > 0 && (
          <div className="view-all-container">
            <Link to="/my-projects" className="view-all-link">
              View All Projects
            </Link>
          </div>
        )}
      </section>

      {/* Tips & Inspiration Section */}
      <section className="tips-section">
        <h2 className="section-title">Tips & Inspiration</h2>
        <div className="tips-container">
          <div className="tip-card">
            <div className="tip-icon">💡</div>
            <h3>Space Planning Tips</h3>
            <p>Leave at least 30 inches of walking space in high-traffic areas for optimal flow.</p>
          </div>
          <div className="tip-card">
            <div className="tip-icon">🎨</div>
            <h3>Color Theory</h3>
            <p>Use the 60-30-10 rule: 60% dominant color, 30% secondary color, and 10% accent color.</p>
          </div>
          <div className="tip-card">
            <div className="tip-icon">📏</div>
            <h3>Furniture Sizing</h3>
            <p>Allow 18 inches between the coffee table and sofa to ensure comfortable legroom.</p>
          </div>
        </div>
      </section>
    </main>
  );
}