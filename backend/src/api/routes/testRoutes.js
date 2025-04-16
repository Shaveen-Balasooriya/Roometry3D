import express from 'express';
const router = express.Router();

// Example test route
router.get('/test', (req, res) => {
  res.json({ message: 'Test route working!' });
});

export default router;
