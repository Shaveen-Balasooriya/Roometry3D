import Furniture from '../../models/Furniture.js';
import { uploadFile, getSignedFileUrl, deleteFile } from '../../services/s3Service.js';
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
  { name: 'thumbnail', maxCount: 1 }
]);

// Create new furniture item with 3D model
export const createFurniture = async (req, res, next) => {
  try {
    if (!req.files || !req.files.model || !req.files.thumbnail) {
      return res.status(400).json({ message: 'Model and thumbnail files are required' });
    }
    
    const { 
      name, description, category, price, 
      width, length, height, manufacturer 
    } = req.body;
    
    // Upload model file to S3
    const modelFile = req.files.model[0];
    const modelExtension = path.extname(modelFile.originalname);
    const modelKey = `furniture/models/${Date.now()}-${name.replace(/\s+/g, '-')}${modelExtension}`;
    
    const modelUploadResult = await uploadFile(
      modelKey, 
      modelFile.buffer,
      modelFile.mimetype
    );
    
    // Upload thumbnail image to S3
    const thumbnailFile = req.files.thumbnail[0];
    const thumbExtension = path.extname(thumbnailFile.originalname);
    const thumbnailKey = `furniture/thumbnails/${Date.now()}-${name.replace(/\s+/g, '-')}${thumbExtension}`;
    
    const thumbnailUploadResult = await uploadFile(
      thumbnailKey, 
      thumbnailFile.buffer,
      thumbnailFile.mimetype
    );
    
    // Create new furniture record in MongoDB
    const furniture = new Furniture({
      name,
      description,
      category,
      price: Number(price),
      dimensions: {
        width: Number(width),
        length: Number(length),
        height: Number(height)
      },
      modelUrl: modelUploadResult.url,
      thumbnailUrl: thumbnailUploadResult.url,
      manufacturer,
      status: 'active'
    });
    
    await furniture.save();
    
    res.status(201).json({
      success: true,
      data: furniture
    });
    
  } catch (error) {
    next(error);
  }
};

// Get all furniture items
export const getAllFurniture = async (req, res, next) => {
  try {
    const furniture = await Furniture.find({ status: 'active' });
    res.status(200).json({
      success: true,
      count: furniture.length,
      data: furniture
    });
  } catch (error) {
    next(error);
  }
};

// Get single furniture item by ID
export const getFurnitureById = async (req, res, next) => {
  try {
    const furniture = await Furniture.findById(req.params.id);
    
    if (!furniture) {
      return res.status(404).json({ message: 'Furniture not found' });
    }
    
    // Generate temporary signed URL for the 3D model (useful if your S3 bucket is private)
    const signedModelUrl = await getSignedFileUrl(
      furniture.modelUrl.split('/').pop(),
      3600 // 1 hour expiry
    );
    
    res.status(200).json({
      success: true,
      data: {
        ...furniture.toObject(),
        signedModelUrl
      }
    });
    
  } catch (error) {
    next(error);
  }
};
