import mongoose from 'mongoose';

const textureSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true
  },
  textureUrl: {
    type: String,
    required: true
  },
  isDefault: {
    type: Boolean,
    default: false
  }
});

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
  price: {
    type: Number,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    default: 0
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
    type: String
  },
  textures: [textureSchema],
  createdAt: {
    type: Date,
    default: Date.now
  },
  updatedAt: {
    type: Date,
    default: Date.now
  }
});

// Pre-save hook to update the updatedAt field
furnitureSchema.pre('save', function(next) {
  this.updatedAt = Date.now();
  next();
});

const Furniture = mongoose.model('Furniture', furnitureSchema);

export default Furniture;
