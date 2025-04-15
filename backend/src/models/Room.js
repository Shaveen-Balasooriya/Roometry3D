import mongoose from 'mongoose'

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  dimensions: {
    width: { type: Number, required: true },
    length: { type: Number, required: true },
    height: { type: Number, required: true }
  },
  walls: [{
    position: { type: String, required: true }, // north, south, east, west
    features: [{
      type: { type: String, enum: ['door', 'window', 'outlet', 'switch'] },
      position: {
        x: { type: Number, required: true },
        y: { type: Number, required: true }
      },
      dimensions: {
        width: { type: Number, required: true },
        height: { type: Number, required: true }
      }
    }]
  }],
  furniture: [{
    item: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: 'Furniture' 
    },
    position: {
      x: { type: Number, required: true },
      y: { type: Number, required: true },
      z: { type: Number, required: true }
    },
    rotation: {
      x: { type: Number, default: 0 },
      y: { type: Number, default: 0 },
      z: { type: Number, default: 0 }
    }
  }],
  s3Key: {
    type: String
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
})

const Room = mongoose.model('Room', roomSchema)

export default Room
