import React, { useState } from 'react';
import TextureItem from './TextureItem';
import './TextureCategory.css';

/**
 * Component for displaying a category of textures with filtering capability
 */
function TextureCategory({ 
  title, 
  textures, 
  selectedTexture, 
  onTextureSelect, 
  loading = false 
}) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expanded, setExpanded] = useState(true);
  
  // Filter textures based on search term
  const filteredTextures = textures.filter(texture => 
    texture.name.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Toggle category expansion
  const toggleExpanded = () => {
    setExpanded(!expanded);
  };
  
  return (
    <div className="texture-category">
      <div className="texture-category-header" onClick={toggleExpanded}>
        <h3 className="texture-category-title">{title}</h3>
        <span className={`texture-category-icon ${expanded ? 'expanded' : 'collapsed'}`}>
          {expanded ? '▼' : '►'}
        </span>
      </div>
      
      {expanded && (
        <>
          <div className="texture-search">
            <input
              type="text"
              placeholder="Search textures..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="texture-search-input"
            />
            {searchTerm && (
              <button 
                className="texture-search-clear" 
                onClick={() => setSearchTerm('')}
              >
                ×
              </button>
            )}
          </div>
          
          <div className="texture-items-container">
            {loading ? (
              <div className="texture-loading-container">
                <div className="texture-category-spinner"></div>
                <p>Loading textures...</p>
              </div>
            ) : filteredTextures.length > 0 ? (
              <div className="texture-grid">
                {filteredTextures.map((texture) => (
                  <TextureItem
                    key={texture.id}
                    texture={texture}
                    isSelected={selectedTexture && selectedTexture.id === texture.id}
                    onSelect={onTextureSelect}
                  />
                ))}
              </div>
            ) : (
              <div className="texture-empty-state">
                {searchTerm ? (
                  <p>No textures match your search.</p>
                ) : (
                  <p>No textures available in this category.</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default TextureCategory;