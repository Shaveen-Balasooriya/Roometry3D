import mongoose from 'mongoose'

const furnitureSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  category: {
    type: String,
    required: true,
    enum: ['seating', 'tables', 'storage', 'beds', 'lighting', 'decor', 'other']
  },
  price: {
    type: Number,
    required: true
  },
  dimensions: {
    width: { type: Number, required: true },
    length: { type: Number, required: true },
    height: { type: Number, required: true }
  },
  modelUrl: {
    type: String,
    required: true
  },
  thumbnailUrl: {
    type: String,
    required: true
  },
  manufacturer: {
    type: String,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
})

const Furniture = mongoose.model('Furniture', furnitureSchema)

export default Furniture
