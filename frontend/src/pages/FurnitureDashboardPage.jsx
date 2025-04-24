import React, { useEffect, useState } from 'react'
import FurnitureCard from './components/FurnitureCard'
import Loading from '../components/Loading'
import Popup from '../components/Popup'
import { auth } from '../services/firebase'

export default function FurnitureDashboardPage() {
  const [furniture, setFurniture] = useState([])
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
        
        const response = await fetch('http://localhost:3001/api/furniture', {
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
      } catch (err) {
        console.error('Error fetching furniture:', err);
        setPopup({ open: true, type: 'error', message: 'Failed to load furniture: ' + err.message })
      } finally {
        setLoading(false)
      }
    }
    fetchFurniture()
  }, [])

  // Callback function to remove item from state
  const handleDeleteSuccess = (deletedId) => {
    setFurniture(currentFurniture => currentFurniture.filter(item => item.id !== deletedId))
    // Show success message on the dashboard after successful deletion
    setPopup({ open: true, type: 'success', message: 'Furniture item deleted successfully.' })
  }

  return (
    <div className="app-container">
      <Popup open={popup.open} type={popup.type} message={popup.message} onClose={() => setPopup({ ...popup, open: false })} />
      <main className="main-content" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
        <h2 style={{ marginBottom: '1.5rem', color: 'var(--accent)' }}>Furniture Dashboard</h2>
        {loading ? (
          <Loading />
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '2rem' }}>
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
      </main>
    </div>
  )
}
