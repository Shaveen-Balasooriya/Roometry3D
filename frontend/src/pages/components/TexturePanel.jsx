import React, { useState, useEffect } from 'react';
import './TexturePanel.css';

// Sample textures (in a real app, you would fetch these from Firebase)
const sampleTextures = {
  wall: [
    {
      id: 'wall-texture-1',
      name: 'White Paint',
      url: 'https://firebasestorage.googleapis.com/v0/b/roometry3d.appspot.com/o/textures%2Fwall-white-paint.jpg?alt=media',
      type: 'wall',
      repeat: 2,
      thumbnail: 'https://firebasestorage.googleapis.com/v0/b/roometry3d.appspot.com/o/textures%2Fthumbnails%2Fwall-white-paint-thumb.jpg?alt=media'
    },
    {
      id: 'wall-texture-2',
      name: 'Light Blue',
      url: 'https://firebasestorage.googleapis.com/v0/b/roometry3d.appspot.com/o/textures%2Fwall-light-blue.jpg?alt=media',
      type: 'wall',
      repeat: 2,
      thumbnail: 'https://firebasestorage.googleapis.com/v0/b/roometry3d.appspot.com/o/textures%2Fthumbnails%2Fwall-light-blue-thumb.jpg?alt=media'
    },
    {
      id: 'wall-texture-3',
      name: 'Beige',
      url: 'https://firebasestorage.googleapis.com/v0/b/roometry3d.appspot.com/o/textures%2Fwall-beige.jpg?alt=media',
      type: 'wall',
      repeat: 2,
      thumbnail: 'https://firebasestorage.googleapis.com/v0/b/roometry3d.appspot.com/o/textures%2Fthumbnails%2Fwall-beige-thumb.jpg?alt=media'
    },
    {
      id: 'wall-texture-4',
      name: 'Brick Pattern',
      url: 'https://firebasestorage.googleapis.com/v0/b/roometry3d.appspot.com/o/textures%2Fwall-brick.jpg?alt=media',
      type: 'wall',
      repeat: 4,
      thumbnail: 'https://firebasestorage.googleapis.com/v0/b/roometry3d.appspot.com/o/textures%2Fthumbnails%2Fwall-brick-thumb.jpg?alt=media'
    },
  ],
  floor: [
    {
      id: 'floor-texture-1',
      name: 'Hardwood',
      url: 'https://firebasestorage.googleapis.com/v0/b/roometry3d.appspot.com/o/textures%2Ffloor-hardwood.jpg?alt=media',
      type: 'floor',
      repeat: 4,
      thumbnail: 'https://firebasestorage.googleapis.com/v0/b/roometry3d.appspot.com/o/textures%2Fthumbnails%2Ffloor-hardwood-thumb.jpg?alt=media'
    },
    {
      id: 'floor-texture-2',
      name: 'Marble',
      url: 'https://firebasestorage.googleapis.com/v0/b/roometry3d.appspot.com/o/textures%2Ffloor-marble.jpg?alt=media',
      type: 'floor',
      repeat: 2,
      thumbnail: 'https://firebasestorage.googleapis.com/v0/b/roometry3d.appspot.com/o/textures%2Fthumbnails%2Ffloor-marble-thumb.jpg?alt=media'
    },
    {
      id: 'floor-texture-3',
      name: 'Carpet',
      url: 'https://firebasestorage.googleapis.com/v0/b/roometry3d.appspot.com/o/textures%2Ffloor-carpet.jpg?alt=media',
      type: 'floor',
      repeat: 3,
      thumbnail: 'https://firebasestorage.googleapis.com/v0/b/roometry3d.appspot.com/o/textures%2Fthumbnails%2Ffloor-carpet-thumb.jpg?alt=media'
    },
    {
      id: 'floor-texture-4',
      name: 'Tile',
      url: 'https://firebasestorage.googleapis.com/v0/b/roometry3d.appspot.com/o/textures%2Ffloor-tile.jpg?alt=media',
      type: 'floor',
      repeat: 4,
      thumbnail: 'https://firebasestorage.googleapis.com/v0/b/roometry3d.appspot.com/o/textures%2Fthumbnails%2Ffloor-tile-thumb.jpg?alt=media'
    },
  ]
};

function TexturePanel({ onTextureSelect, activeTexture, roomType }) {
  const [activeTab, setActiveTab] = useState('wall');
  const [textures, setTextures] = useState(sampleTextures);
  const [loading, setLoading] = useState(false);

  // In a real app, you would fetch textures based on room type
  useEffect(() => {
    const fetchTextures = async () => {
      setLoading(true);
      try {
        // Here you would fetch textures from Firebase or other source
        // For now, we'll use the sample textures
        console.log(`Would fetch textures for room type: ${roomType}`);
        
        // Simulate loading delay
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // In a real app, you'd replace this with actual data
        setTextures(sampleTextures);
      } catch (error) {
        console.error("Error loading textures:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchTextures();
  }, [roomType]);

  const handleTextureClick = (texture) => {
    onTextureSelect(texture);
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="texture-panel">
      <div className="texture-panel-header">
        <h2>Textures</h2>
        <div className="texture-tabs">
          <button 
            className={`texture-tab ${activeTab === 'wall' ? 'active' : ''}`}
            onClick={() => handleTabChange('wall')}
          >
            Wall Textures
          </button>
          <button 
            className={`texture-tab ${activeTab === 'floor' ? 'active' : ''}`}
            onClick={() => handleTabChange('floor')}
          >
            Floor Textures
          </button>
        </div>
      </div>

      <div className="texture-panel-content">
        {loading ? (
          <div className="texture-loading">
            <div className="texture-spinner"></div>
            <p>Loading textures...</p>
          </div>
        ) : (
          <>
            <div className="texture-list">
              {textures[activeTab]?.map((texture) => (
                <div 
                  key={texture.id}
                  className={`texture-item ${activeTexture?.id === texture.id ? 'active' : ''}`}
                  onClick={() => handleTextureClick(texture)}
                >
                  <div className="texture-thumbnail">
                    <img 
                      src={texture.thumbnail || texture.url} 
                      alt={texture.name}
                      loading="lazy"
                    />
                  </div>
                  <div className="texture-name">{texture.name}</div>
                </div>
              ))}
            </div>

            {textures[activeTab]?.length === 0 && (
              <div className="no-textures">
                <p>No {activeTab} textures available for this room type.</p>
              </div>
            )}
          </>
        )}
      </div>

      {activeTexture && (
        <div className="active-texture">
          <h3>Selected: {activeTexture.name}</h3>
          <div className="texture-preview">
            <img
              src={activeTexture.thumbnail || activeTexture.url}
              alt={activeTexture.name}
            />
          </div>
        </div>
      )}
    </div>
  );
}

export default TexturePanel;