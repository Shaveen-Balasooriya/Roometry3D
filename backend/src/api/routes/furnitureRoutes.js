import express from 'express';
import multer from 'multer';
import { 
  createFurniture,
  getAllFurniture,
  getFurnitureById
} from '../controllers/furnitureController.js';

const router = express.Router();

// Configure multer for memory storage
const storage = multer.memoryStorage();
const upload = multer({ 
  storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB limit
});

// Define file upload fields
const furnitureUpload = upload.fields([
  { name: 'model', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 },
  { name: 'textures', maxCount: 10 } // Allow up to 10 texture files
]);

// Routes
router.post('/', furnitureUpload, createFurniture);
router.get('/', getAllFurniture);
router.get('/:id', getFurnitureById);

export default router;
