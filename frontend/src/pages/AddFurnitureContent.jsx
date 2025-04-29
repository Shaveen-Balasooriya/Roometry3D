import React, { useState, useMemo } from 'react';
import FurnitureForm from './components/FurnitureForm';
import FurniturePreview from './components/FurniturePreview';
import '../App.css';

export default function AddFurnitureContent({ initialData = null }) {
  const [furniture, setFurniture] = useState({});
  const isUpdateMode = !!initialData; // Determine if it's update mode

  // Use useMemo to calculate dimensions, providing defaults
  const previewDimensions = useMemo(() => ({
    width: Math.max(Number(furniture.width) || 0, 1),
    height: Math.max(Number(furniture.height) || 0, 1),
    length: Math.max(Number(furniture.length) || 0, 1),
  }), [furniture.width, furniture.height, furniture.length]);

  return (
    <div className="content-section">
      {/* Form Section */}
      <div className="form-section">
        <FurnitureForm
          initialData={initialData}
          onChange={setFurniture}
        />
      </div>

      {/* Preview Section */}
      <div className="preview-section">
        <FurniturePreview
          objFile={furniture.objFile}
          textures={furniture.textures}
          dimensions={previewDimensions}
        />
      </div>
    </div>
  );
}
