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

// ---------------- CORS CONFIGURATION ---------------- //
// Function to check if origin is allowed
function isOriginAllowed(origin) {
  if (!origin) return true; // Allow requests with no origin (Postman, curl, etc.)
  
  // Allow localhost for development
  if (origin.includes('localhost') || origin.includes('127.0.0.1')) {
    return true;
  }
  
  // Allow ALL Vercel deployments (preview and production)
  if (origin.endsWith('.vercel.app')) {
    return true;
  }
  
  return false;
}

// MANUAL CORS HEADERS - Must be FIRST to prevent Railway from overriding
// This runs before cors() middleware to ensure headers are set correctly
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  // Log preflight requests for debugging
  if (req.method === 'OPTIONS') {
    console.log('🔍 Preflight request from:', origin);
  }
  
  // Set CORS headers if origin is allowed
  if (origin && isOriginAllowed(origin)) {
    // Force set headers - use res.setHeader to ensure they're set
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Range, X-Content-Range');
    res.setHeader('Access-Control-Max-Age', '86400'); // 24 hours
    
    if (req.method === 'OPTIONS') {
      console.log('✅ Preflight handled - CORS headers set for:', origin);
      return res.status(200).end();
    }
  } else if (origin) {
    console.log('❌ CORS blocked origin:', origin);
  }
  
  next();
});

// CORS middleware as backup (in case manual headers don't work)
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) {
      callback(null, true);
    } else {
      console.log('❌ CORS middleware blocked origin:', origin);
      callback(new Error(`CORS policy: Origin ${origin} not allowed`));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
}));

// ---------------- MIDDLEWARE ---------------- //
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------- HEALTH CHECK ---------------- //
app.get('/', (req, res) => {
  res.json({
    message: 'Coffee Arts Paris Backend API',
    status: 'running',
    timestamp: new Date().toISOString()
  });
});

// ---------------- TEST ENDPOINTS ---------------- //
// Test CORS configuration
app.get('/test-cors', (req, res) => {
  const origin = req.headers.origin;
  res.json({
    success: true,
    message: 'CORS test endpoint',
    origin: origin,
    allowed: isOriginAllowed(origin),
    timestamp: new Date().toISOString()
  });
});

// Test database connection
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

// ---------------- API ROUTES ---------------- //
app.use('/api/products', productsRouter);
app.use('/api/auth', authRouter);
app.use('/api/contact', contactRouter);
app.use('/api/admin', adminRouter);
app.use('/api/upload', uploadRouter);

// ---------------- ERROR HANDLING ---------------- //
app.use((err, req, res, next) => {
  // Handle CORS errors specifically
  if (err.message && err.message.includes('CORS')) {
    console.error('❌ CORS Error:', err.message);
    return res.status(403).json({
      success: false,
      message: 'CORS policy violation',
      error: err.message
    });
  }
  
  console.error('Error:', err.message);
  res.status(500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// ---------------- 404 ROUTE ---------------- //
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// ---------------- START SERVER ---------------- //
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`📍 Test database: http://localhost:${PORT}/test-db`);
  console.log(`📍 Admin routes: http://localhost:${PORT}/api/admin/*`);
  console.log(`📍 Contact route: http://localhost:${PORT}/api/contact`);
});
