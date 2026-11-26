import mongoose from 'mongoose';

const sizeSchema = new mongoose.Schema({
  quantity: {
    type: Number,
    required: true,
    min: 0.01
  },
  unit: {
    type: String,
    required: true,
    enum: ['inch', 'g', 'S', 'M', 'L', 'ml', 'mm', 'pcs']
  },
  price: {
    type: Number,
    required: true,
    min: 0.01
  }
}, { _id: false });

const schema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },

  category: {
    type: String,
    required: true,
    trim: true
  },

  // Compatibility field for older frontend logic and existing products.
  // The controller always sets this to the lowest size price automatically.
  // Customers are charged using the selected size's own price.
  price: {
    type: Number,
    min: 0,
    default: 0
  },

  oldPrice: {
    type: Number,
    min: 0,
    default: null
  },

  tag: {
    type: String,
    trim: true,
    default: ''
  },

  description: {
    type: String,
    trim: true,
    default: ''
  },

  image: {
    type: String,
    trim: true,
    default: ''
  },

  isActive: {
    type: Boolean,
    default: true
  },

  stock: {
    type: Number,
    min: 0,
    default: 0
  },

  sizes: {
    type: [sizeSchema],
    default: []
  },

  bulkDiscountEnabled: {
    type: Boolean,
    default: false
  },

  bulkMinimumQuantity: {
    type: Number,
    min: 1,
    default: 5
  },

  bulkDiscountAmount: {
    type: Number,
    min: 0,
    default: 0
  }

}, { timestamps: true });

export default mongoose.model('Product', schema);
