import React, { useState } from 'react'
import FurnitureForm from './components/FurnitureForm'
import FurniturePreview from './components/FurniturePreview'
import '../App.css'
import { Link } from 'react-router-dom'

export default function AddFurnitureContent() {
  const [furniture, setFurniture] = useState({})

  return (
    <>
      <section className="form-section">
        <FurnitureForm onChange={setFurniture} />
      </section>
      <section className="preview-section">
        <FurniturePreview
          objFile={furniture.objFile}
          textures={furniture.textures}
          dimensions={{
            width: Number(furniture.width),
            height: Number(furniture.height),
            length: Number(furniture.length),
          }}
        />
      </section>
    </>
  )
}
