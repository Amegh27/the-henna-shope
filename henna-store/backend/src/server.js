import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';

import { connectDB } from './config/db.js';

import authRoutes from './routes/auth.js';
import userAuthRoutes from './routes/userAuth.js';
import productRoutes from './routes/products.js';
import orderRoutes from './routes/orders.js';
import categoryRoutes from './routes/categories.js';

import {
  notFound,
  errorHandler
} from './middleware/errors.js';

const app = express();

// Security middleware
app.use(helmet());

// CORS MUST come before API routes
app.use(cors({
  origin: (process.env.CLIENT_URL).split(',').map(x => x.trim()),
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Parse JSON before API routes
app.use(express.json({ limit: '1mb' }));

// Rate limiting for admin login
app.use(
  '/api/auth/login',
  rateLimit({
    windowMs: 900000,
    limit: 10,
    standardHeaders: true,
    legacyHeaders: false
  })
);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'henna-store-api'
  });
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users/auth', userAuthRoutes);
app.use('/api/products', productRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/categories', categoryRoutes);

// Error handling - MUST remain at the bottom
app.use(notFound);
app.use(errorHandler);

// Server
const port = process.env.PORT || 5000;

connectDB()
  .then(() => {
    app.listen(port, () => {
      console.log(`API listening on ${port}`);
    });
  })
  .catch(error => {
    console.error('Startup failed:', error.message);
    process.exit(1);
  });