import React, { useState, useEffect, useCallback } from 'react';
import FurnitureForm from './components/FurnitureForm';
import FurniturePreview from './components/FurniturePreview';
import '../App.css';

export default function UpdateFurnitureContent({ initialData, onUpdateSuccess }) {
  // Separate state for form data to allow reverting
  const [formData, setFormData] = useState({});
  // State for preview component, including initial URLs
  const [previewData, setPreviewData] = useState({
    modelFile: null, // Changed from objFile to modelFile
    textures: [],
    dimensions: {},
    initialModelUrl: null, // Changed from initialObjUrl to initialModelUrl
    initialTextureUrls: [], // For showing initial textures
    furnitureId: null, // Pass the furniture ID for texture uploads
  });
  const API_URL = import.meta.env.VITE_BACKEND_URL;

  // Initialize form and preview state when initialData is loaded
  useEffect(() => {
    if (initialData) {
      const dataForForm = {
        ...initialData,
        modelFile: null, // Form handles file objects, not URLs initially
        textures: [],
      };
      setFormData(dataForForm);

      setPreviewData({
        modelFile: null, // Will be fetched by preview if needed
        textures: [], // Will be fetched by preview if needed
        dimensions: {
          width: Number(initialData.width),
          height: Number(initialData.height),
          length: Number(initialData.length),
        },
        initialModelUrl: `${API_URL}/api/furniture/${initialData.id}/model`, // Pass the endpoint
        initialTextureUrls: initialData.textureUrls || [],
        furnitureId: initialData.id, // Pass the furniture ID
      });
    }
  }, [initialData, API_URL]);

  // Update form data and preview when form changes
  const handleFormChange = useCallback((updatedForm) => {
    setFormData(updatedForm); // Update the complete form state

    // Update preview state based on form changes
    setPreviewData(prev => ({
      ...prev,
      modelFile: updatedForm.modelFile, // User selected file takes precedence
      textures: updatedForm.textures, // User selected textures take precedence
      dimensions: {
        width: Number(updatedForm.width),
        height: Number(updatedForm.height),
        length: Number(updatedForm.length),
      },
      // Keep initial URLs unless new files are added
      initialModelUrl: updatedForm.modelFile ? null : prev.initialModelUrl,
    }));
  }, []);

  return (
    <div className="furniture-content-container">
      <div className="furniture-form-section">
        <FurnitureForm
          initialData={initialData} // Pass initial data for pre-filling and reverting
          onChange={handleFormChange}
          onUpdateSuccess={onUpdateSuccess} // Pass the success handler
        />
      </div>
      <div className="furniture-preview-section">
        <FurniturePreview
          objFile={previewData.modelFile}
          textures={previewData.textures}
          dimensions={previewData.dimensions}
          initialObjUrl={previewData.initialModelUrl}
          initialTextureUrls={previewData.initialTextureUrls}
          furnitureId={previewData.furnitureId}
          isEditMode={true}
        />
      </div>

      <style jsx>{`
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
      `}</style>
    </div>
  );
}