// Utility functions for furniture model handling
import * as THREE from 'three';

// Extract file type based on URL pattern
export const getFileTypeFromUrl = (url) => {
  if (!url) return null;
  
  // Try to find an explicit file extension
  const urlWithoutParams = url.split('?')[0];
  const pathParts = urlWithoutParams.split('/').pop().split('.');
  if (pathParts.length > 1) {
    const extension = pathParts.pop().toLowerCase();
    if (['obj', 'gltf', 'glb'].includes(extension)) {
      return extension;
    }
  }
  
  // Check for pattern matching in URL
  if (url.includes('_wardrobe') || 
      url.includes('_bed') || 
      url.includes('furniture/models')) {
    // Most furniture models are OBJ format
    return 'obj';
  }
  
  // Default to GLTF for room models
  return 'glb';
};

// Helper function to add scene metadata
export const prepareModelScene = (scene, instanceId) => {
  // Add identifier to model and all children
  scene.userData.isFurniture = true;
  scene.userData.furnitureId = instanceId;
  
  scene.traverse((child) => {
    child.userData.isFurniture = true;
    child.userData.furnitureId = instanceId;
    
    // Make sure meshes are interactive
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
    }
  });
  
  return scene;
};

// Apply texture to a model
export const applyTextureToModel = (model, textureUrl) => {
  if (!model || !textureUrl) return;
  
  const texture = new THREE.TextureLoader().load(textureUrl);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(1, 1);
  
  model.traverse((child) => {
    if (child.isMesh) {
      child.material = new THREE.MeshStandardMaterial({
        map: texture,
        side: THREE.DoubleSide
      });
    }
  });
};
