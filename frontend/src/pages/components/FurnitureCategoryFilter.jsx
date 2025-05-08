import React from 'react';

export default function CategoryFilter({ selectedCategory, onCategoryChange }) {
  // Common categories for furniture
  const categories = [
    'All',
    'Seating',
    'Tables',
    'Storage',
    'Beds',
    'Lighting',
    'Decor',
    'Office',
    'Outdoor'
  ];

  return (
    <div style={{ 
      marginBottom: '2rem',
      background: '#FFFFFF',
      borderRadius: '8px',
      boxShadow: '0 2px 4px rgba(0, 0, 0, 0.08)',
      border: '1px solid var(--border)',
      padding: '1rem 1.5rem',
      position: 'relative',
      borderBottom: '2px solid #66B2B8' // Teal accent on bottom to match cards
    }}>
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <h3 style={{ 
          color: '#00474C', 
          margin: 0,
          fontSize: '1.2rem',
          fontWeight: 600,
          position: 'relative',
          paddingBottom: '0.5rem'
        }}>
          Filter by Category
          <span style={{
            position: 'absolute',
            bottom: '-2px',
            left: '0',
            width: '60px',
            height: '2px',
            backgroundColor: '#ECC94B' // Gold accent matching other elements
          }}></span>
        </h3>
      </div>
      
      <div style={{ 
        display: 'flex', 
        flexWrap: 'wrap', 
        gap: '0.75rem',
        alignItems: 'center'
      }}>
        {categories.map((category) => (
          <button
            key={category}
            onClick={() => onCategoryChange(category)}
            style={{
              background: selectedCategory === category ? '#006A71' : '#FFFFFF',
              color: selectedCategory === category ? 'white' : '#00474C',
              border: `1px solid ${selectedCategory === category ? '#006A71' : '#E2E8F0'}`,
              borderRadius: '6px',
              padding: '0.5rem 1rem',
              fontSize: '0.9rem',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              fontWeight: selectedCategory === category ? '600' : 'normal',
              borderLeft: selectedCategory === category ? '3px solid #ECC94B' : '1px solid #E2E8F0',
            }}
            onMouseOver={(e) => {
              if (selectedCategory !== category) {
                e.currentTarget.style.background = '#F7FAFC';
                e.currentTarget.style.borderColor = '#66B2B8';
              }
            }}
            onMouseOut={(e) => {
              if (selectedCategory !== category) {
                e.currentTarget.style.background = '#FFFFFF';
                e.currentTarget.style.borderColor = '#E2E8F0';
              }
            }}
          >
            {category}
          </button>
        ))}
      </div>
    </div>
  );
}