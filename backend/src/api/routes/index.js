import express from 'express';
import testRoutes from './testRoutes.js';
// Remove or comment out imports for files that don't exist yet
// import authRoutes from './authRoutes.js';
// import userRoutes from './userRoutes.js';
// import roomRoutes from './roomRoutes.js';
// import furnitureRoutes from './furnitureRoutes.js';
// import adminRoutes from './adminRoutes.js';

const router = express.Router();

// Test routes
router.use('/test', testRoutes);

// Public routes
// router.use('/auth', authRoutes);

// Protected routes
// router.use('/user', authenticate, userRoutes);
// router.use('/rooms', authenticate, roomRoutes);
// router.use('/furniture', furnitureRoutes);

// Admin routes
// router.use('/admin', authenticate, adminRoutes);

// Health check endpoint directly in the index routes file
router.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'OK', 
    message: 'API is running'
  });
});

export default router;
