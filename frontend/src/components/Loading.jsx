import React from 'react'
import './Loading.css'

export default function Loading({ overlay = false, size = 48 }) {
  return (
    <div className={overlay ? 'loading-overlay' : 'loading-inline'}>
      <div className="spinner" style={{ width: size, height: size }} />
    </div>
  )
}
