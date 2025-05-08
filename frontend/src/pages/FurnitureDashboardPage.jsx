import React, { useEffect, useState } from 'react'
import FurnitureCard from './components/FurnitureCard'
import CategoryFilter from './components/FurnitureCategoryFilter'
import Loading from '../components/Loading'
import Popup from '../components/Popup'
import { auth } from '../services/firebase'

export default function FurnitureDashboardPage() {
  const [furniture, setFurniture] = useState([])
  const [filteredFurniture, setFilteredFurniture] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [loading, setLoading] = useState(true)
  const [popup, setPopup] = useState({ open: false, type: 'error', message: '' })

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
          ? `http://localhost:3001/api/furniture?category=${encodeURIComponent(selectedCategory)}`
          : 'http://localhost:3001/api/furniture';
        
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

  // Callback function to remove item from state
  const handleDeleteSuccess = (deletedId) => {
    setFurniture(currentFurniture => {
      const updatedFurniture = currentFurniture.filter(item => item.id !== deletedId);
      setFilteredFurniture(updatedFurniture);
      return updatedFurniture;
    });
    
    // Show success message on the dashboard after successful deletion
    setPopup({ open: true, type: 'success', message: 'Furniture item deleted successfully.' })
  }

  return (
    <div className="page-content">
      <Popup open={popup.open} type={popup.type} message={popup.message} onClose={() => setPopup({ ...popup, open: false })} />
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent)' }}>Furniture Dashboard</h2>
      
      <CategoryFilter 
        selectedCategory={selectedCategory} 
        onCategoryChange={handleCategoryChange} 
      />
      
      {loading ? (
        <Loading />
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
            <div>No furniture found.</div>
          ) : (
            furniture.map(item => (
              <FurnitureCard
                key={item.id}
                furniture={item}
                onDeleteSuccess={handleDeleteSuccess}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}