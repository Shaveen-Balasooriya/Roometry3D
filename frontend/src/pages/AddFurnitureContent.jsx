import React, { useState, useMemo } from 'react' // Import useMemo
import FurnitureForm from './components/FurnitureForm'
import FurniturePreview from './components/FurniturePreview'
import '../App.css'
// Removed unused Link import

export default function AddFurnitureContent() {
  const [furniture, setFurniture] = useState({})

  // Use useMemo to calculate dimensions, providing defaults
  const previewDimensions = useMemo(() => ({
    width: Math.max(Number(furniture.width) || 0, 1), // Default to 1 if invalid or 0
    height: Math.max(Number(furniture.height) || 0, 1), // Default to 1 if invalid or 0
    length: Math.max(Number(furniture.length) || 0, 1), // Default to 1 if invalid or 0
  }), [furniture.width, furniture.height, furniture.length]);


  return (
    <>
      <section className="form-section">
        {/* Pass initialData as null for Add form */}
        <FurnitureForm initialData={null} onChange={setFurniture} />
      </section>
      <section className="preview-section">
        <FurniturePreview
          objFile={furniture.objFile}
          textures={furniture.textures}
          dimensions={previewDimensions} // Pass memoized dimensions with defaults
          // No initialObjUrl or initialTextureUrls needed for Add page
        />
      </section>
    </>
  )
}
