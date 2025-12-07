import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import pool, { testConnection } from './db.js';
import productsRouter from './routes/products.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import contactRouter from './routes/contact.js';
import uploadRouter from './routes/upload.js';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// CORS configuration - Explicitly allow your Vercel frontend domain
const allowedOrigins = [
  'https://my-project-mqxfmghrv-lhehlolbro123-2933s-projects.vercel.app',
  'http://localhost:3000',
  'http://localhost:3001',
  // Add your production Vercel domain when you have it
  // You can also set this via environment variable: ALLOWED_ORIGINS
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',').map(o => o.trim()) : [])
];

// CORS middleware - MUST be first
app.use(cors({
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl)
    if (!origin) return callback(null, true);
    
    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      // Log for debugging
      console.log('⚠️  CORS blocked origin:', origin);
      console.log('✅ Allowed origins:', allowedOrigins);
      // In development, allow all; in production, be strict
      if (process.env.NODE_ENV !== 'production') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    }
  },
  credentials: true, // Allow cookies/auth headers
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
}));

// Additional CORS headers as backup (in case Railway overrides)
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Only set headers if origin is allowed
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    
    // Log for debugging
    if (req.method === 'OPTIONS') {
      console.log('✅ Preflight request handled for origin:', origin);
    }
  }
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  next();
});

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Health check route
app.get('/', (req, res) => {
  res.json({
    message: 'Coffee Arts Paris Backend API',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// Test database connection route
app.get('/test-db', async (req, res) => {
  try {
    const result = await testConnection();
    res.json({
      success: true,
      message: 'Database connection successful',
      data: result,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Database test error:', error);
    res.status(500).json({
      success: false,
      message: 'Database connection failed',
      error: error.message
    });
  }
});

// API Routes
app.use('/api/products', productsRouter);
app.use('/api/auth', authRouter);
app.use('/api/contact', contactRouter);
app.use('/api/admin', adminRouter);
app.use('/api/upload', uploadRouter);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📍 Test database: http://localhost:${PORT}/test-db`);
  console.log(`📍 Admin routes: http://localhost:${PORT}/api/admin/*`);
  console.log(`📍 Contact route: http://localhost:${PORT}/api/contact`);
});

