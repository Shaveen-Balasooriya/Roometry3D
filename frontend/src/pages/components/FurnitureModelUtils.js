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
export const applyTextureToModel = (model, textureUrl, callback) => {
  if (!model || !textureUrl) {
    if (callback) callback(false);
    return false;
  }
  
  try {
    const textureLoader = new THREE.TextureLoader();
    
    textureLoader.load(
      textureUrl,
      (texture) => {
        texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
        texture.repeat.set(1, 1);
        
        let meshesFound = 0;
        let texturesApplied = 0;
        
        model.traverse((child) => {
          if (child.isMesh) {
            meshesFound++;
            try {
              // Clone the texture to avoid sharing issues with multiple meshes
              const textureClone = texture.clone();
              textureClone.needsUpdate = true;
              
              // Create a new material with the texture
              child.material = new THREE.MeshStandardMaterial({
                map: textureClone,
                side: THREE.DoubleSide,
                roughness: 0.7,
                metalness: 0.2
              });
              
              texturesApplied++;
            } catch (err) {
              console.warn(`Failed to apply texture to mesh in model:`, err);
            }
          }
        });
        
        const success = meshesFound > 0 && texturesApplied > 0;
        console.log(`Applied texture to ${texturesApplied}/${meshesFound} meshes`);
        
        if (callback) callback(success);
        return success;
      },
      undefined, // onProgress
      (error) => {
        console.error('Error loading texture:', error);
        if (callback) callback(false);
        return false;
      }
    );
    
    return true; // Texture loading started
  } catch (err) {
    console.error('Error in applyTextureToModel:', err);
    if (callback) callback(false);
    return false;
  }
};

// Check model file size before loading to handle large files better
export const checkModelFileSize = async (url) => {
  if (!url) return { size: 0, isLarge: false };
  
  try {
    // Use HEAD request to get content length without downloading the file
    const response = await fetch(url, { 
      method: 'HEAD',
      // Add cache headers to prevent stale responses
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0'
      },
      // Add credentials for Firebase storage
      credentials: 'include'
    });
    
    if (!response.ok) {
      console.error(`Failed to check file size: ${response.status} ${response.statusText}`);
      return { size: 0, isLarge: false, error: 'Failed to check file size', status: response.status };
    }
    
    const contentLength = response.headers.get('content-length');
    const size = contentLength ? parseInt(contentLength, 10) : 0;
    
    // Adjust thresholds based on file type
    const isGLTF = url.toLowerCase().includes('.gltf') || url.toLowerCase().includes('.glb');
    const isOBJ = url.toLowerCase().includes('.obj');
    
    // Different size thresholds for different formats
    let threshold = 5 * 1024 * 1024; // 5MB default
    if (isGLTF) threshold = 10 * 1024 * 1024; // 10MB for GLTF
    if (isOBJ) threshold = 8 * 1024 * 1024; // 8MB for OBJ
    
    const isLarge = size > threshold;
    
    if (isLarge) {
      console.warn(`Large model file detected: ${(size / (1024 * 1024)).toFixed(2)}MB`);
    }
    
    return { 
      size, 
      isLarge, 
      formattedSize: formatFileSize(size),
      threshold: formatFileSize(threshold)
    };
  } catch (error) {
    console.error('Error checking file size:', error);
    return { size: 0, isLarge: false, error: error.message };
  }
};

// Helper to format file size in human-readable format
const formatFileSize = (bytes) => {
  if (bytes === 0) return '0 Bytes';
  
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
};

// Handle large model files with appropriate fallbacks
export const handleLargeModelFile = (modelUrl, instanceId, onSuccess, onError) => {
  const fallbackModelUrl = '/models/fallback-cube.gltf';
  
  // Check model file size first
  checkModelFileSize(modelUrl)
    .then(({ size, isLarge, formattedSize }) => {
      if (isLarge) {
        console.warn(`Model file is large (${formattedSize}), using optimized loading strategy`);
        // Continue loading with warning, but set up a timeout
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => {
            reject(new Error(`Loading timeout for large model (${formattedSize})`));
          }, 20000); // 20 second timeout for large files
        });
        
        // Try loading the original model with a timeout
        Promise.race([
          fetch(modelUrl).then(response => {
            if (!response.ok) throw new Error(`Failed to fetch model: ${response.status} ${response.statusText}`);
            return onSuccess({ 
              originalUrl: modelUrl,
              isLarge: true,
              size: formattedSize
            });
          }),
          timeoutPromise
        ]).catch(error => {
          console.error(`Loading large model failed or timed out: ${error.message}`);
          console.log(`Using fallback model for ${modelUrl}`);
          
          // Use fallback model instead
          fetch(fallbackModelUrl)
            .then(response => {
              if (!response.ok) throw new Error('Failed to fetch fallback model');
              return onSuccess({ 
                originalUrl: modelUrl, 
                fallbackUrl: fallbackModelUrl,
                usedFallback: true,
                error: error.message
              });
            })
            .catch(fallbackError => {
              console.error('Even fallback model failed to load:', fallbackError);
              onError(fallbackError);
            });
        });
      } else {
        // Normal loading for reasonably sized models
        console.log(`Model file size is acceptable (${formattedSize})`);
        onSuccess({ originalUrl: modelUrl, isLarge: false });
      }
    })
    .catch(sizeCheckError => {
      console.error('Error checking model file size:', sizeCheckError);
      // Try normal loading if size check fails
      onSuccess({ originalUrl: modelUrl, isLarge: false, sizeCheckFailed: true });
    });
};
