import React, { useRef, useEffect, useState, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Environment, Bounds } from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import * as THREE from 'three'
import { useNavigate } from 'react-router-dom' // Import useNavigate
import Loading from '../../components/Loading'
import Popup from '../../components/Popup'
import ConfirmationPopup from '../../components/ConfirmationPopup'
import { auth } from '../../services/firebase'

function ModelPreview({ objFile, textureUrl, dimensions }) {
  const [object, setObject] = useState(null)
  const loaderRef = useRef(new OBJLoader())
  const { width = 1, height = 1, length = 1 } = dimensions || {}
  const API_URL = import.meta.env.VITE_BACKEND_URL;
  useEffect(() => {
    let currentMaterial = null
    let cancelled = false
    setObject(null)

    async function loadObj() {
      let objText = null
      if (objFile instanceof Blob) {
        objText = await objFile.text()
      }
      if (!objText || cancelled) return

      try {
        const parsedObj = loaderRef.current.parse(objText)

        const originalBox = new THREE.Box3().setFromObject(parsedObj)
        const originalSize = originalBox.getSize(new THREE.Vector3())
        const maxObjDim = Math.max(originalSize.x, originalSize.y, originalSize.z, 0.001)
        const maxTargetDim = Math.max(width, height, length, 0.001)
        const scale = maxTargetDim / maxObjDim

        parsedObj.scale.set(scale, scale, scale)

        const scaledBox = new THREE.Box3().setFromObject(parsedObj)
        const scaledCenter = scaledBox.getCenter(new THREE.Vector3())

        const applyMaterial = (material) => {
          if (currentMaterial) {
            if (currentMaterial.map) currentMaterial.map.dispose()
            currentMaterial.dispose()
          }
          currentMaterial = material
          parsedObj.traverse(child => {
            if (child.isMesh) {
              child.material = material
              child.material.needsUpdate = true
            }
          })
          setObject({ model: parsedObj, centerOffset: scaledCenter.clone() })
        }

        if (textureUrl) {
          const textureLoader = new THREE.TextureLoader()
          textureLoader.load(
            textureUrl,
            (mapTexture) => {
              if (cancelled) return
              mapTexture.wrapS = mapTexture.wrapT = THREE.RepeatWrapping
              mapTexture.encoding = THREE.sRGBEncoding
              mapTexture.needsUpdate = true
              applyMaterial(new THREE.MeshStandardMaterial({
                map: mapTexture,
                side: THREE.DoubleSide,
                metalness: 0.1,
                roughness: 0.8
              }))
            },
            undefined,
            () => {
              if (cancelled) return
              applyMaterial(new THREE.MeshStandardMaterial({
                color: '#999999',
                side: THREE.DoubleSide,
                metalness: 0.1,
                roughness: 0.8
              }))
            }
          )
        } else {
          applyMaterial(new THREE.MeshStandardMaterial({
            color: '#999999',
            side: THREE.DoubleSide,
            metalness: 0.1,
            roughness: 0.8
          }))
        }

      } catch (error) {
        console.error("Error processing model:", error)
        setObject(null)
      }
    }

    loadObj()

    return () => {
      cancelled = true
      if (currentMaterial) {
        if (currentMaterial.map) currentMaterial.map.dispose()
        currentMaterial.dispose()
      }
    }
  }, [objFile, textureUrl, width, height, length])

  return object ? (
    <group position={[-object.centerOffset.x, -object.centerOffset.y, -object.centerOffset.z]}>
      <primitive object={object.model} />
    </group>
  ) : null
}

function RotatingBoundsContent({ children }) {
  const groupRef = useRef()

  useFrame((state, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.25
    }
  })

  return (
    <group ref={groupRef}>
      <Bounds fit clip observe margin={1.2}>
        {children}
      </Bounds>
    </group>
  )
}

export default function FurnitureCard({ furniture, onDeleteSuccess }) {
  const {
    id, name, category, price, quantity, height, width, length, wallMountable,
    modelEndpoint, textureUrls = []
  } = furniture

  const [selectedTextureIndex, setSelectedTextureIndex] = useState(0)
  const [objBlob, setObjBlob] = useState(null)
  const [isLoadingBlob, setIsLoadingBlob] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)
  const [popup, setPopup] = useState({ open: false, type: 'error', message: '' })
  const [showConfirmPopup, setShowConfirmPopup] = useState(false)
  const navigate = useNavigate()
  const API_URL = import.meta.env.VITE_BACKEND_URL;

  useEffect(() => { setSelectedTextureIndex(0) }, [textureUrls])

  const currentTextureUrl = useMemo(() => {
    if (!textureUrls || textureUrls.length === 0) return null
    return textureUrls[selectedTextureIndex] || textureUrls[0]
  }, [textureUrls, selectedTextureIndex])

  useEffect(() => {
    let isActive = true
    setObjBlob(null)
    if (modelEndpoint) {
      setIsLoadingBlob(true)
      const fetchModel = async () => {
        try {
          // Get the current user's auth token
          const user = auth.currentUser;
          if (!user) {
            throw new Error('You must be logged in to access this model');
          }
          
          const idToken = await user.getIdToken();
          
          const response = await fetch(`${API_URL}${modelEndpoint}`, {
            headers: {
              'Authorization': `Bearer ${idToken}`
            }
          });
          
          if (!response.ok) throw new Error('Failed to fetch OBJ file')
          const blob = await response.blob();
          if (isActive) {
            setObjBlob(blob)
          }
        } catch (err) {
          console.error("Error fetching blob:", err)
          if (isActive) {
            setObjBlob(null)
          }
        } finally {
          if (isActive) {
            setIsLoadingBlob(false)
          }
        }
      };
      
      fetchModel();
    } else {
      setIsLoadingBlob(false)
    }
    return () => {
      isActive = false
    }
  }, [modelEndpoint])

  const executeDelete = async () => {
    setShowConfirmPopup(false)
    setIsDeleting(true)
    setPopup({ open: false, type: '', message: '' })
    try {
      // Get the current user's auth token
      const user = auth.currentUser;
      if (!user) {
        throw new Error('You must be logged in to delete furniture');
      }
      
      const idToken = await user.getIdToken();
      
      const response = await fetch(`${API_URL}/api/furniture/${id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${idToken}`
        }
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: 'Failed to delete item. Server returned an error.' }))
        throw new Error(errorData.message || 'Failed to delete item.')
      }

      onDeleteSuccess(id)

    } catch (err) {
      console.error("Error deleting furniture:", err)
      setPopup({ open: true, type: 'error', message: err.message || 'Error deleting item.' })
    } finally {
      setIsDeleting(false)
    }
  }

  const handleDelete = () => {
    setShowConfirmPopup(true)
  }

  const handleCancelDelete = () => {
    setShowConfirmPopup(false)
  }

  const handleEdit = () => {
    console.log(`Edit button clicked for item ID: ${id}`)
    navigate(`/update-furniture/${id}`)
  }

  const previewAvailable = !!objBlob
  const showLoading = isLoadingBlob || (!previewAvailable && modelEndpoint)

  return (
    <div
      style={{
        background: '#FFFFFF',
        border: '2px solid #4382FF',
        borderRadius: '8px',
        boxShadow: 'var(--shadow-sm)',
        padding: '1.5rem 1.2rem 1.2rem 1.2rem',
        margin: '0.5rem',
        minWidth: 260,
        maxWidth: 320,
        flex: '1 1 260px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'stretch',
        gap: '1rem'
      }}
    >
      <Popup open={popup.open} type={popup.type} message={popup.message} onClose={() => setPopup({ ...popup, open: false })} />

      <ConfirmationPopup
        open={showConfirmPopup}
        message={`Are you sure you want to delete "${name}"? This action cannot be undone.`}
        onConfirm={executeDelete}
        onCancel={handleCancelDelete}
        confirmText="Delete"
        confirmButtonClass="button-primary"
      />

      <div style={{ marginBottom: '0.5rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center'  }}>
        <span style={{fontWeight: 600, fontSize: '20px', color: '#1A365D'  }}>{name}</span>
        <span style={{ color: '#2C5282', fontWeight: 600, fontSize: '18px' }}>${price}</span>
      </div>
      <div style={{  color: '#3182CE', fontSize: '14px', marginBottom: '0.2rem', fontWeight: 400 }}>{category}</div>
      <div
        style={{
          width: '100%',
          height: 140,
          background: '#DBEAFE',
          borderRadius: 8,
          marginBottom: 8,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
        }}
      >
        {showLoading ? (
          <div style={{  color: '#4A5568', fontSize: 13, textAlign: 'center'}}>
            <Loading size={30} />
            <div style={{ marginTop: '5px', opacity: 0.8 }}>Loading Preview...</div>
          </div>
        ) : previewAvailable ? (
          <Canvas
            style={{
              width: '100%',
              height: '100%',
              borderRadius: 8,
              border: '1px solid #4382FF'
            }}
            gl={{ antialias: true, alpha: false, preserveDrawingBuffer: false }}
            dpr={[1, 1.5]}
            frameloop="always"
            shadows
            camera={{ fov: 45, near: 0.1, far: 50 }}
          >
            <color attach="background" aargs={['#DBEAFE']} />
            <ambientLight intensity={0.6} />
            <directionalLight
              position={[3, 5, 4]}
              intensity={1.0}
              castShadow
              shadow-mapSize-width={1024}
              shadow-mapSize-height={1024}
            />
            <directionalLight position={[-3, 2, -4]} intensity={0.4} />
            <Suspense fallback={null}>
              <Environment preset="city" />
              <RotatingBoundsContent>
                <ModelPreview
                  objFile={objBlob}
                  textureUrl={currentTextureUrl}
                  dimensions={{ width, height, length }}
                />
              </RotatingBoundsContent>
            </Suspense>
          </Canvas>
        ) : (
          <div style={{ color: '#4A5568', fontSize: 13, width: '100%', textAlign: 'center' }}>
            <span style={{ opacity: 0.7 }}>No 3D Preview</span>
          </div>
        )}
      </div>
      {textureUrls.length > 1 && (
        <div style={{ display: 'flex', gap: 8, marginBottom: 4, justifyContent: 'flex-start' }}>
          {textureUrls.map((url, idx) => (
            <button
              key={idx}
              onClick={() => setSelectedTextureIndex(idx)}
              style={{
                border: idx === selectedTextureIndex ? '2px solid #1A365D' : '1px solid #D1D5DB',
                borderRadius: '4px',
                padding: 0,
                background: 'var(--surface-lighter)',
                width: 24,
                height: 24,
                cursor: 'pointer',
                outline: 'none',
                boxShadow: idx === selectedTextureIndex ? '0 0 0 2px var(--primary-dark)' : undefined,
                transition: 'border-color 0.2s, box-shadow 0.2s'
              }}
              title={`Texture ${idx + 1}`}
              type="button"
            >
              <img src={url} alt={`Texture ${idx + 1}`} style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 4 }} />
            </button>
          ))}
        </div>
      )}
      <div style={{ fontSize: '12px', marginBottom: '8px', display: 'grid', gridTemplateColumns: '40% 60%' }}>
        <span style={{ fontWeight: 600, color: '#1A365D', textAlign: 'left' }}>Dimensions:</span>
        <span style={{ color: '#4A5568', textAlign: 'left' }}>{height}m (H) × {width}m (W) × {length}m (L)</span>
      </div>
      <div style={{ fontSize: '12px', marginBottom: '8px', display: 'grid', gridTemplateColumns: '40% 60%' }}>
        <span style={{ fontWeight: 600, color: '#1A365D', textAlign: 'left' }}>Quantity:</span>
        <span style={{ color: '#4A5568', textAlign: 'left' }}>{quantity}</span>
      </div>
      <div style={{ fontSize: '12px', marginBottom: '8px', display: 'grid', gridTemplateColumns: '40% 60%' }}>
        <span style={{ fontWeight: 600, color: '#1A365D', textAlign: 'left' }}>Wall Mountable:</span>
        <span style={{ color: '#4A5568', textAlign: 'left' }}>{wallMountable ? 'Yes' : 'No'}</span>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '1rem' }}>
        <button
          onClick={handleEdit}
          style={{
             minWidth: '80px', 
            padding: '0.5rem 1rem', 
            fontSize: '0.9rem',
            background: '#3B82F6',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer' }}
        >
          Edit
        </button>
        <button
          onClick={handleDelete}
          style={{
            minWidth: '80px', 
            padding: '0.5rem 1rem', 
            fontSize: '0.9rem', 
            background: '#EF4444',
            color: '#FFFFFF',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'}}
          disabled={isDeleting}
        >
          {isDeleting ? <Loading size={18} /> : 'Delete'}
        </button>
      </div>
    </div>
  )
}
