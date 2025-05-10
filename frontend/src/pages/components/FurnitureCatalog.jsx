import React, { useState, useEffect } from 'react';
import './FurnitureCatalog.css';
import Loading from '../../components/Loading';
import { auth } from '../../services/firebase'; // Import auth

export default function FurnitureCatalog({ onSelectFurniture }) {
  const [furniture, setFurniture] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [categories, setCategories] = useState(['All']);

  // Fetch furniture data from backend
  useEffect(() => {
    const fetchFurniture = async () => {
      try {
        setLoading(true);
        setError(null); // Clear previous errors

        const user = auth.currentUser;
        if (!user) {
          throw new Error('User not authenticated. Please log in.');
        }

        const idToken = await user.getIdToken();

        const response = await fetch('/api/furniture', {
          headers: {
            'Authorization': `Bearer ${idToken}`,
          },
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }
        const data = await response.json();
        setFurniture(data);
        
        // Extract unique categories
        const uniqueCategories = ['All', ...new Set(data.map(item => item.category).filter(Boolean))];
        setCategories(uniqueCategories);
      } catch (err) {
        console.error('Error fetching furniture:', err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchFurniture();
  }, []);

  // Handle furniture selection
  const handleSelectFurniture = (item) => {
    if (onSelectFurniture) {
      onSelectFurniture(item);
    }
  };

  // Filter furniture based on search term and category
  const filteredFurniture = furniture.filter(item => {
    const matchesSearch = item.name.toLowerCase().includes(searchTerm.toLowerCase()) || 
                         (item.description && item.description.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'All' || item.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  // Render loading state
  if (loading) {
    return (
      <div className="furniture-catalog-loading">
        <Loading size={32} />
        <p>Loading furniture catalog...</p>
      </div>
    );
  }

  // Render error state
  if (error) {
    return (
      <div className="furniture-catalog-error">
        <p>Error loading furniture: {error}</p>
        <button 
          className="retry-button"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="furniture-catalog">
      <div className="furniture-catalog-header">
        <h3>Furniture Catalog</h3>
        <p className="catalog-description">Select furniture to add to your room</p>
      </div>

      <div className="furniture-search-bar">
        <input
          type="text"
          placeholder="Search furniture..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
        />
      </div>

      <div className="furniture-category-filters">
        {categories.map(category => (
          <button
            key={category}
            className={`category-filter ${selectedCategory === category ? 'active' : ''}`}
            onClick={() => setSelectedCategory(category)}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="furniture-list">
        {filteredFurniture.length === 0 ? (
          <div className="no-furniture-message">
            <p>No furniture items found</p>
            <p>Try adjusting your search or filters</p>
          </div>
        ) : (
          filteredFurniture.map(item => (
            <div 
              key={item.id} 
              className="furniture-item"
              onClick={() => handleSelectFurniture(item)}
            >
              <div className="furniture-item-preview">
                {item.thumbnailUrl ? (
                  <img src={item.thumbnailUrl} alt={item.name} />
                ) : (
                  <div className="thumbnail-placeholder">📦</div>
                )}
              </div>
              <div className="furniture-item-info">
                <h4>{item.name}</h4>
                <p className="furniture-category">{item.category || 'Uncategorized'}</p>
              </div>
              <button className="add-furniture-button" title="Add to room">+</button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}