import React from 'react';

const FURNITURE_CATEGORIES = [
  'All',
  'Living Room',
  'Bedroom',
  'Dining Room',
  'Office',
  'Kitchen',
  'Bathroom',
  'Outdoor',
  'Kids',
  'Other'
];

export default function CategoryFilter({ selectedCategory, onCategoryChange }) {
  return (
    <div className="category-filter" style={{ marginBottom: '2rem' }}>
      <label htmlFor="category-select" style={{ marginRight: '1rem', fontWeight: 'bold' }}>
        Filter by Category:
      </label>
      <select
        id="category-select"
        value={selectedCategory}
        onChange={(e) => onCategoryChange(e.target.value)}
        style={{
          padding: '0.5rem',
          borderRadius: '4px',
          border: '1px solid var(--border-color, #ccc)',
          backgroundColor: 'var(--bg-secondary, white)',
          color: 'var(--text-primary, black)'
        }}
      >
        {FURNITURE_CATEGORIES.map(category => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
    </div>
  );
}