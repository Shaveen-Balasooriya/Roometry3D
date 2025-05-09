import React, { useEffect, useState } from 'react'
import RoomCard from './components/RoomCard'  // Update import name to match actual component
import CategoryFilter from './components/FurnitureCategoryFilter'
import Loading from '../components/Loading'
import Popup from '../components/Popup'
import { auth } from '../services/firebase'

export default function RoomManagementPage() {
  const [rooms, setRooms] = useState([])
  const [filteredRooms, setFilteredRooms] = useState([])
  const [selectedCategory, setSelectedCategory] = useState('All')
  const [loading, setLoading] = useState(true)
  const [popup, setPopup] = useState({ open: false, type: 'error', message: '' })
  const API_URL = import.meta.env.VITE_BACKEND_URL;
  
  useEffect(() => {
    async function fetchRooms() {
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
          ? `${API_URL}/api/rooms?category=${encodeURIComponent(selectedCategory)}`
          : `${API_URL}/api/rooms`;
        
        const response = await fetch(endpoint, {
          headers: {
            'Authorization': `Bearer ${idToken}`
          }
        })
        
        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.message || 'Failed to fetch rooms');
        }
        
        const items = await response.json()
        setRooms(items)
        setFilteredRooms(items)
      } catch (err) {
        console.error('Error fetching rooms:', err);
        setPopup({ open: true, type: 'error', message: 'Failed to load rooms: ' + err.message })
      } finally {
        setLoading(false)
      }
    }
    
    fetchRooms()
  }, [selectedCategory, API_URL]) // Re-fetch when category changes

  // Handle category change
  const handleCategoryChange = (category) => {
    setSelectedCategory(category);
  }

  // Callback function to remove item from state
  const handleDeleteSuccess = (deletedId) => {
    setRooms(currentRooms => {
      const updatedRooms = currentRooms.filter(item => item.id !== deletedId);
      setFilteredRooms(updatedRooms);
      return updatedRooms;
    });
    
    // Show success message on the dashboard after successful deletion
    setPopup({ open: true, type: 'success', message: 'Room deleted successfully.' })
  }

  return (
    <div className="page-content">
      <Popup open={popup.open} type={popup.type} message={popup.message} onClose={() => setPopup({ ...popup, open: false })} />
      <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent)' }}>Room Management</h2>
      
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
          {rooms.length === 0 ? (
            <div>No rooms found.</div>
          ) : (
            rooms.map(room => (
              <RoomCard
                key={room.id}
                room={room}
                baseUrl={API_URL}
                onDeleteSuccess={handleDeleteSuccess}
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}