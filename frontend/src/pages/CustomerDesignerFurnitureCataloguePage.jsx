import React, { useEffect, useState } from 'react'
import CustomerDesignerFurnitureCard from './components/CustomerDesignerFurnitureCard'
import CategoryFilter from './components/FurnitureCategoryFilter'
import Loading from '../components/Loading'
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import Popup from '../components/Popup'
import { auth } from '../services/firebase'

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
      <Popup open={popup.open} type={popup.type} message={popup.message} onClose={() => setPopup({ ...popup, open: false })} />
      <main className="main-content" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent)' }}>Furniture Catalogue</h2>
        
        {/* Add the category filter component */}
        <CategoryFilter 
          selectedCategory={selectedCategory} 
          onCategoryChange={handleCategoryChange} 
        />
        
        {loading ? (
          <Loading />
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
            {furniture.length === 0 ? (
              <div>No furniture found.</div>
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
      </main>
      <Footer />
    </div>
  )
}