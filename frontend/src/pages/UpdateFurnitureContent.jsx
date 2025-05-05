import React, { useState, useEffect, useCallback } from 'react';
import FurnitureForm from './components/FurnitureForm';
import FurniturePreview from './components/FurniturePreview';
import '../App.css';

export default function UpdateFurnitureContent({ initialData, onUpdateSuccess }) {
  // Separate state for form data to allow reverting
  const [formData, setFormData] = useState({});
  // State for preview component, including initial URLs
  const [previewData, setPreviewData] = useState({
    objFile: null,
    textures: [],
    dimensions: {},
    initialObjUrl: null, // For fetching initial model
    initialTextureUrls: [], // For showing initial textures
    furnitureId: null, // Pass the furniture ID for texture uploads
  });
  const API_URL = import.meta.env.VITE_BACKEND_URL;

  // Initialize form and preview state when initialData is loaded
  useEffect(() => {
    if (initialData) {
      const dataForForm = {
        ...initialData,
        objFile: null, // Form handles file objects, not URLs initially
        textures: [],
      };
      setFormData(dataForForm);

      setPreviewData({
        objFile: null, // Will be fetched by preview if needed
        textures: [], // Will be fetched by preview if needed
        dimensions: {
          width: Number(initialData.width),
          height: Number(initialData.height),
          length: Number(initialData.length),
        },
        initialObjUrl: `${API_URL}/api/furniture/${initialData.id}/model`, // Pass the endpoint
        initialTextureUrls: initialData.textureUrls || [],
        furnitureId: initialData.id, // Pass the furniture ID
      });
    }
  }, [initialData]);

  // Update form data and preview when form changes
  const handleFormChange = useCallback((updatedForm) => {
    setFormData(updatedForm); // Update the complete form state

    // Update preview state based on form changes
    setPreviewData(prev => ({
      ...prev,
      objFile: updatedForm.objFile, // User selected file takes precedence
      textures: updatedForm.textures, // User selected textures take precedence
      dimensions: {
        width: Number(updatedForm.width),
        height: Number(updatedForm.height),
        length: Number(updatedForm.length),
      },
      // Keep initial URLs unless new files are added
      initialObjUrl: updatedForm.objFile ? null : prev.initialObjUrl,
    }));
  }, []);

  return (
    <>
      <section className="form-section">
        <FurnitureForm
          initialData={initialData} // Pass initial data for pre-filling and reverting
          onChange={handleFormChange}
          onUpdateSuccess={onUpdateSuccess} // Pass the success handler
        />
      </section>
      <section className="preview-section">
        <FurniturePreview
          objFile={previewData.objFile}
          textures={previewData.textures}
          dimensions={previewData.dimensions}
          initialObjUrl={previewData.initialObjUrl}
          initialTextureUrls={previewData.initialTextureUrls}
          furnitureId={previewData.furnitureId}
        />
      </section>
    </>
  );
}