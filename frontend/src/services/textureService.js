import { collection, query, where, getDocs, doc, getDoc } from 'firebase/firestore';
import { ref, listAll, getDownloadURL } from 'firebase/storage';
import { db, storage } from './firebase';

/**
 * Service for fetching and managing textures for rooms
 */
export const TextureService = {
  /**
   * Fetch all available textures for a room by type
   * @param {string} roomId - The ID of the room
   * @param {string} textureType - Type of texture ('wall', 'floor', 'ceiling', etc.)
   * @returns {Promise<Array>} Array of texture objects with url and metadata
   */
  async fetchTexturesForRoom(roomId, textureType) {
    if (!roomId) return [];
    
    try {
      // First try to fetch from room's specific textures folder
      const roomTexturesPath = `rooms/${roomId}/textures/${textureType}`;
      const roomTexturesRef = ref(storage, roomTexturesPath);
      
      try {
        const roomTexturesResult = await listAll(roomTexturesRef);
        
        if (roomTexturesResult.items.length > 0) {
          console.log(`Found ${roomTexturesResult.items.length} ${textureType} textures for room ${roomId}`);
          
          // Get download URLs and metadata for each texture
          const textures = await Promise.all(roomTexturesResult.items.map(async (itemRef) => {
            const url = await getDownloadURL(itemRef);
            const name = itemRef.name.replace(/\.[^/.]+$/, ""); // Remove file extension
            
            return {
              id: itemRef.name,
              url,
              name: name.replace(/_/g, ' ').replace(/-/g, ' '),
              type: textureType
            };
          }));
          
          return textures;
        }
      } catch (err) {
        console.log(`No specific ${textureType} textures found for room ${roomId}, using global textures.`);
      }
      
      // If no room-specific textures, fetch from global textures collection
      const globalTexturesPath = `textures/${textureType}`;
      const globalTexturesRef = ref(storage, globalTexturesPath);
      
      try {
        const globalTexturesResult = await listAll(globalTexturesRef);
        
        if (globalTexturesResult.items.length > 0) {
          console.log(`Found ${globalTexturesResult.items.length} global ${textureType} textures`);
          
          // Get download URLs and metadata for each texture
          const textures = await Promise.all(globalTexturesResult.items.map(async (itemRef) => {
            const url = await getDownloadURL(itemRef);
            const name = itemRef.name.replace(/\.[^/.]+$/, ""); // Remove file extension
            
            return {
              id: itemRef.name,
              url,
              name: name.replace(/_/g, ' ').replace(/-/g, ' '),
              type: textureType
            };
          }));
          
          return textures;
        }
      } catch (err) {
        console.log(`No global ${textureType} textures found either.`);
      }
      
      // As a fallback, return a small set of default textures
      return this.getDefaultTextures(textureType);
    } catch (error) {
      console.error(`Error fetching ${textureType} textures:`, error);
      return this.getDefaultTextures(textureType);
    }
  },

  /**
   * Get default textures as a fallback
   * @param {string} textureType - Type of texture
   * @returns {Array} Array of default texture objects
   */
  getDefaultTextures(textureType) {
    if (textureType === 'wall') {
      return [
        {
          id: 'wall-white',
          url: 'https://firebasestorage.googleapis.com/v0/b/roometry3d.appspot.com/o/textures%2Fwall%2Fwall-white.jpg?alt=media',
          name: 'White Wall',
          type: 'wall'
        },
        {
          id: 'wall-beige',
          url: 'https://firebasestorage.googleapis.com/v0/b/roometry3d.appspot.com/o/textures%2Fwall%2Fwall-beige.jpg?alt=media',
          name: 'Beige Wall',
          type: 'wall'
        }
      ];
    } else if (textureType === 'floor') {
      return [
        {
          id: 'floor-wood',
          url: 'https://firebasestorage.googleapis.com/v0/b/roometry3d.appspot.com/o/textures%2Ffloor%2Fwood-floor.jpg?alt=media',
          name: 'Wood Floor',
          type: 'floor'
        },
        {
          id: 'floor-tiles',
          url: 'https://firebasestorage.googleapis.com/v0/b/roometry3d.appspot.com/o/textures%2Ffloor%2Ftiles.jpg?alt=media',
          name: 'Tiles',
          type: 'floor'
        }
      ];
    } else {
      return [];
    }
  },

  /**
   * Fetch all texture categories available
   * @returns {Promise<Array>} Array of texture categories
   */
  async fetchTextureCategories() {
    try {
      const categoriesRef = collection(db, 'textureCategories');
      const categoriesSnapshot = await getDocs(categoriesRef);
      
      if (categoriesSnapshot.empty) {
        console.log('No texture categories found.');
        return [];
      }
      
      const categories = categoriesSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      
      return categories;
    } catch (error) {
      console.error('Error fetching texture categories:', error);
      return [];
    }
  }
};

export default TextureService;