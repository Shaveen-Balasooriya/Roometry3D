import Furniture from '../../models/Furniture.js';
import { uploadFile, getSignedFileUrl } from '../../services/s3Service.js';
import multer from 'multer';
import path from 'path';

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 }, // 50MB limit
  fileFilter: (req, file, cb) => {
    const allowedModelFormats = ['.glb', '.gltf', '.obj', '.fbx'];
    const allowedImageFormats = ['.jpg', '.jpeg', '.png', '.webp'];
    
    const ext = path.extname(file.originalname).toLowerCase();
    if ([...allowedModelFormats, ...allowedImageFormats].includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file format. Only 3D models and images allowed.'));
    }
  }
});

// Middleware to handle file uploads (to be used in routes)
export const uploadModelMiddleware = upload.fields([
  { name: 'model', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
  { name: 'textures', maxCount: 10 }
]);

// Create new furniture
export const createFurniture = async (req, res) => {
  try {
    // Check if all required files are present
    if (!req.files || !req.files.model || !req.files.model[0]) {
      return res.status(400).json({ 
        success: false,
        message: '3D model file is required'
      });
    }
    
    const { 
      name, description, price, quantity,
      width, length, height
    } = req.body;
    
    // Upload the model file to S3
    const modelFile = req.files.model[0];
    const modelKey = `furniture/models/${Date.now()}-${modelFile.originalname}`;
    
    const modelUploadResult = await uploadFile(
      modelKey, 
      modelFile.buffer,
      modelFile.mimetype
    );
    
    // Initialize furniture data
    const furnitureData = {
      name,
      description,
      price: Number(price),
      quantity: Number(quantity),
      dimensions: {
        width: Number(width),
        length: Number(length),
        height: Number(height)
      },
      modelUrl: modelUploadResult.url,
      textures: []
    };
    
    // Upload thumbnail if provided
    if (req.files.thumbnail && req.files.thumbnail[0]) {
      const thumbnailFile = req.files.thumbnail[0];
      const thumbnailKey = `furniture/thumbnails/${Date.now()}-${thumbnailFile.originalname}`;
      
      const thumbnailUploadResult = await uploadFile(
        thumbnailKey,
        thumbnailFile.buffer,
        thumbnailFile.mimetype
      );
      
      furnitureData.thumbnailUrl = thumbnailUploadResult.url;
    }
    
    // Process textures if provided
    if (req.files.textures && req.files.textures.length > 0) {
      const texturePromises = req.files.textures.map(async (textureFile, index) => {
        const textureKey = `furniture/textures/${Date.now()}-${textureFile.originalname}`;
        const textureUploadResult = await uploadFile(
          textureKey,
          textureFile.buffer,
          textureFile.mimetype
        );
        
        return {
          name: textureFile.originalname.split('.')[0],
          textureUrl: textureUploadResult.url,
          isDefault: index === 0
        };
      });
      
      furnitureData.textures = await Promise.all(texturePromises);
    }
    
    // Create and save the furniture document
    const furniture = new Furniture(furnitureData);
    await furniture.save();
    
    res.status(201).json({
      success: true,
      data: furniture
    });
    
  } catch (error) {
    console.error('Error creating furniture:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Error creating furniture'
    });
  }
};

// Get all furniture items
export const getAllFurniture = async (req, res) => {
  try {
    const furniture = await Furniture.find();
    
    res.status(200).json({
      success: true,
      count: furniture.length,
      data: furniture
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching furniture'
    });
  }
};

// Get furniture by ID
export const getFurnitureById = async (req, res) => {
  try {
    const furniture = await Furniture.findById(req.params.id);
    
    if (!furniture) {
      return res.status(404).json({
        success: false,
        message: 'Furniture not found'
      });
    }
    
    // Generate signed URL for the 3D model
    const modelKey = furniture.modelUrl.split('/').pop();
    const signedModelUrl = await getSignedFileUrl(`furniture/models/${modelKey}`);
    
    // Generate signed URLs for textures
    const texturesWithSignedUrls = await Promise.all(
      furniture.textures.map(async (texture) => {
        const textureKey = texture.textureUrl.split('/').pop();
        const signedTextureUrl = await getSignedFileUrl(`furniture/textures/${textureKey}`);
        
        return {
          ...texture.toObject(),
          signedTextureUrl
        };
      })
    );
    
    res.status(200).json({
      success: true,
      data: {
        ...furniture.toObject(),
        signedModelUrl,
        textures: texturesWithSignedUrls
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message || 'Error fetching furniture'
    });
  }
};
