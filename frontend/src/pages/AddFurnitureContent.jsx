import React, { useState, useMemo } from 'react';
import FurnitureForm from './components/FurnitureForm';
import FurniturePreview from './components/FurniturePreview';
import '../App.css';

export default function AddFurnitureContent({ initialData = null }) {
  const [furniture, setFurniture] = useState(initialData || {});
  const isUpdateMode = !!initialData;

  // Use useMemo to calculate dimensions, providing defaults
  const previewDimensions = useMemo(() => ({
    width: Math.max(Number(furniture.width) || 0, 1),
    height: Math.max(Number(furniture.height) || 0, 1),
    length: Math.max(Number(furniture.length) || 0, 1),
  }), [furniture.width, furniture.height, furniture.length]);

  return (
    <div className="furniture-content-container">
      <div className="furniture-form-section">
        <FurnitureForm
          initialData={initialData}
          onChange={setFurniture}
        />
      </div>

      <div className="furniture-preview-section">
        <FurniturePreview
          objFile={furniture.modelFile}
          textures={furniture.textures}
          dimensions={previewDimensions}
          initialObjUrl={initialData?.objUrl}
          initialTextureUrls={initialData?.textureUrls || []}
          furnitureId={initialData?.id}
          isEditMode={isUpdateMode}
        />
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        .furniture-content-container {
          display: flex;
          flex-direction: column;
          gap: 2rem;
          width: 100%;
        }
        
        .furniture-form-section,
        .furniture-preview-section {
          width: 100%;
        }
        
        @media (min-width: 992px) {
          .furniture-content-container {
            flex-direction: row;
            align-items: flex-start;
          }
          
          .furniture-form-section {
            flex: 1;
            max-width: 50%;
            padding-right: 1rem;
          }
          
          .furniture-preview-section {
            flex: 1;
            max-width: 50%;
            padding-left: 1rem;
          }
        }
        
        @media (min-width: 1200px) {
          .furniture-form-section {
            padding-right: 2rem;
          }
          
          .furniture-preview-section {
            padding-left: 2rem;
          }
        }
      ` }} />
    </div>
  );
}
