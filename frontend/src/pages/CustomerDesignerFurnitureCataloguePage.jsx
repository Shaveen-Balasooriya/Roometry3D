import React, { useState, useEffect } from 'react';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Loading from '../components/Loading';
import CategoryFilter from './components/FurnitureCategoryFilter';
import CustomerDesignerFurnitureCard from './components/CustomerDesignerFurnitureCard';
import Popup from '../components/Popup';
import { auth } from '../services/firebase';

export default function CustomerDesignerFurnitureCataloguePage() {
  const [furniture, setFurniture] = useState([])
  const [filteredFurniture, setFilteredFurniture] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [loading, setLoading] = useState(true)
  const [popup, setPopup] = useState({ open: false, type: 'error', message: '' })
  const API_URL = import.meta.env.VITE_BACKEND_URL;
  
  useEffect(() => {
    async function fetchFurniture() {
      setLoading(true)
      try {
        // Get the current user's auth token
        const user = auth.currentUser;
        if (!user) {
          throw new Error('You must be logged in to access this page');
        }
        
        const idToken = await user.getIdToken();
        
        // Use query parameter for filtering if not "All"
        const endpoint = selectedCategory !== 'All' 
          ? `${API_URL}/api/furniture?category=${encodeURIComponent(selectedCategory)}`
          : `${API_URL}/api/furniture`;
        
        const response = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        })
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to fetch furniture');
        }
        const items = await response.json()
        setFurniture(items)
        setFilteredFurniture(items)
      } catch (err) {
        console.error('Error fetching furniture:', err);
        setPopup({ open: true, type: 'error', message: 'Failed to load furniture: ' + err.message })
      } finally {
        setLoading(false)
      }
    }
    
    fetchFurniture()
  }, [selectedCategory]) // Re-fetch when category changes

  // Handle category change
  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
  }

  return (
    <div className="app-container">

      <Navbar />
      <main className="main-content" style={{ 
        display: 'flex', 
        flexDirection: 'column', 
        alignItems: 'center',
        padding: '0 1rem',
        maxWidth: '1200px',
        margin: '0 auto',
        width: '100%'
      }}>
        <div className="page-content" style={{ width: '100%' }}>
          <Popup open={popup.open} type={popup.type} message={popup.message} onClose={() => setPopup({ ...popup, open: false })} />
          
          {/* Exactly matching the h2 style from FurnitureDashboardPage */}
          <h2 style={{ 
            marginBottom: '1.5rem', 
            color: 'var(--accent)',
            fontSize: '2.1rem',
            fontWeight: '700'
          }}>Furniture Catalogue</h2>
          
          <CategoryFilter 
            selectedCategory={selectedCategory} 
            onCategoryChange={handleCategoryChange} 
          />
          
          {loading ? (
            <div style={{ 
              display: 'flex', 
              justifyContent: 'center', 
              alignItems: 'center',
              minHeight: '200px',
              width: '100%'
            }}>
              <Loading />
            </div>
          ) : (
            <div style={{ 
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
              gap: '2rem',
              justifyItems: 'center',
              alignItems: 'stretch',
              width: '100%',
              marginTop: '1rem'
            }}>
              {furniture.length === 0 ? (
                <div style={{
                  textAlign: 'center',
                  padding: '2rem',
                  color: '#718096',
                  gridColumn: '1 / -1',
                  width: '100%'
                }}>No furniture found.</div>
              ) : (
                furniture.map(item => (
                  <CustomerDesignerFurnitureCard
                    key={item.id}
                    furniture={item}
                  />
                ))
              )}
            </div>
          )}
        </div>

      </main>

    </div>
  )
}