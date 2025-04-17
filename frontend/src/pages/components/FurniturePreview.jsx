import React, { useRef, useEffect, useState, useMemo } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Environment, Bounds } from '@react-three/drei'
import { OBJLoader } from 'three/examples/jsm/loaders/OBJLoader'
import * as THREE from 'three'

const ModelLoader = React.memo(function ModelLoader({ objFile, textureUrl, dimensions }) {
  const [object, setObject] = useState(null)
  const loaderRef = useRef(new OBJLoader())

  const { width = 1, height = 1, length = 1 } = dimensions || {};

  useEffect(() => {
    setObject(null);
    if (!objFile) {
      return;
    }

    let currentMaterial = null;

    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const parsedObj = loaderRef.current.parse(e.target.result)

        const box = new THREE.Box3().setFromObject(parsedObj);
        const originalSize = box.getSize(new THREE.Vector3());

        const scaleX = (originalSize.x > 0 && width > 0) ? width / originalSize.x : 1;
        const scaleY = (originalSize.y > 0 && height > 0) ? height / originalSize.y : 1;
        const scaleZ = (originalSize.z > 0 && length > 0) ? length / originalSize.z : 1;

        parsedObj.scale.set(scaleX, scaleY, scaleZ);

        const applyMaterial = (material) => {
          if (currentMaterial) {
            if (currentMaterial.map) currentMaterial.map.dispose();
            currentMaterial.dispose();
          }
          currentMaterial = material;

          parsedObj.traverse(child => {
            if (child.isMesh) {
              child.material = material;
              child.material.needsUpdate = true;
            }
          });
          setObject(parsedObj);
        };

        if (textureUrl) {
          const textureLoader = new THREE.TextureLoader();
          textureLoader.load(
            textureUrl,
            (mapTexture) => {
              mapTexture.wrapS = mapTexture.wrapT = THREE.RepeatWrapping;
              mapTexture.needsUpdate = true;
              applyMaterial(new THREE.MeshStandardMaterial({ map: mapTexture }));
            },
            undefined,
            (err) => {
              console.error('Error loading texture:', err);
              applyMaterial(new THREE.MeshStandardMaterial({ color: '#999999' }));
            }
          );
        } else {
          applyMaterial(new THREE.MeshStandardMaterial({ color: '#999999' }));
        }

      } catch (error) {
        console.error("Error parsing OBJ file:", error)
        setObject(null)
      }
    }
    reader.onerror = (error) => {
      console.error("Error reading file:", error)
      setObject(null)
    }
    reader.readAsText(objFile)

    return () => {
      if (currentMaterial) {
        if (currentMaterial.map) currentMaterial.map.dispose();
        currentMaterial.dispose();
      }
    };
  }, [objFile, textureUrl, width, height, length])

  return object ? <primitive object={object} /> : null
});

export default function FurniturePreview({ objFile, textures, dimensions }) {
  const [selectedTextureIndex, setSelectedTextureIndex] = useState(0);
  const [textureUrls, setTextureUrls] = useState([]);
  const prevUrlsRef = useRef([]);

  useEffect(() => {
    // Create new URLs for current textures
    const validTextures = textures?.filter(t => t instanceof Blob) || [];
    const newUrls = validTextures.map(textureFile => URL.createObjectURL(textureFile));
    setTextureUrls(newUrls);
    setSelectedTextureIndex(0);

    // Revoke previous URLs after new ones are set
    const prevUrls = prevUrlsRef.current;
    prevUrls.forEach(url => URL.revokeObjectURL(url));
    prevUrlsRef.current = newUrls;

    // On unmount, revoke all current URLs
    return () => {
      prevUrlsRef.current.forEach(url => URL.revokeObjectURL(url));
      prevUrlsRef.current = [];
    };
  }, [textures]);

  const currentTextureUrl = useMemo(() => {
    return textureUrls[selectedTextureIndex] || null;
  }, [textureUrls, selectedTextureIndex]);

  return (
    <div className="furniture-preview" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}>
      <h2 style={{ marginLeft: 0, marginRight: 0, textAlign: 'left' }}>3D Preview</h2>
      <div
        className="preview-container"
        style={{
          marginLeft: 0,
          marginRight: 0,
          width: '100%',
          boxSizing: 'border-box',
        }}
      >
        {objFile && (
          <Canvas
            style={{ background: '#9ACBD0', width: '100%', height: '100%', display: 'block' }}
            camera={{ position: [0, 1, 5], fov: 50 }}
            frameloop="demand"
            dpr={[1, 2]}
          >
            <ambientLight intensity={0.5} />
            <directionalLight position={[2.5, 8, 5]} intensity={1} castShadow />
            <directionalLight position={[-2.5, -8, -5]} intensity={0.3} />
            <Environment preset="city" />

            <Bounds fit clip observe margin={1.5}>
              <ModelLoader
                objFile={objFile}
                textureUrl={currentTextureUrl}
                dimensions={dimensions}
              />
            </Bounds>

            <OrbitControls
              makeDefault
              minDistance={0.5}
              maxDistance={10}
              enableDamping={true}
              dampingFactor={0.1}
            />
          </Canvas>
        )}
        {!objFile && (
          <div className="empty-preview">
            <span>Upload a 3D model to see preview</span>
          </div>
        )}
      </div>
      {objFile && textureUrls.length > 1 && (
        <div className="texture-controls">
          <h3>Available Textures</h3>
          <div className="texture-switcher">
            {textureUrls.map((url, index) => (
              <button
                key={index}
                className={index === selectedTextureIndex ? 'selected' : ''}
                onClick={() => setSelectedTextureIndex(index)}
                title={`Texture ${index + 1}`}
              >
                <img src={url} alt={`Texture ${index + 1}`} />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}