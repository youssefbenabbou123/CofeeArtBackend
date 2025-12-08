import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import pool, { testConnection } from './db.js';
import productsRouter from './routes/products.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import contactRouter from './routes/contact.js';
import uploadRouter from './routes/upload.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3002;

// ---------------- CORS CONFIGURATION ---------------- //
// IMPORTANT: This must be the VERY FIRST middleware to prevent Railway proxy from intercepting
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://my-project-plum-eta-90.vercel.app',
];

// Helper function to check if origin is allowed
function isOriginAllowed(origin) {
  if (!origin) return true; // Allow server-to-server / Postman
  return allowedOrigins.includes(origin) || /^https:\/\/.*\.vercel\.app$/.test(origin);
}

// CRITICAL: Set CORS headers FIRST, before anything else
// This prevents Railway's proxy from overriding our headers
app.use((req, res, next) => {
  const origin = req.headers.origin;
  
  if (isOriginAllowed(origin) && origin) {
    // Set headers explicitly on EVERY response
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, Accept');
    res.setHeader('Access-Control-Allow-Credentials', 'true');
    res.setHeader('Access-Control-Max-Age', '86400'); // Cache preflight for 24 hours
  }
  
  // Handle OPTIONS preflight requests IMMEDIATELY
  if (req.method === 'OPTIONS') {
    console.log('✅ OPTIONS preflight handled for origin:', origin);
    return res.status(200).end();
  }
  
  next();
});

// Also use the cors package as backup
app.use(cors({
  origin: function(origin, callback) {
    if (isOriginAllowed(origin)) {
      return callback(null, true);
    }
    console.log('❌ CORS blocked origin:', origin);
    return callback(new Error(`CORS policy: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
}));

// ---------------- MIDDLEWARE ---------------- //
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------- HEALTH CHECK ---------------- //
app.get('/', (req, res) => {
  res.json({ message: 'Coffee Arts Paris Backend API', status: 'running', timestamp: new Date() });
});

// ---------------- API ROUTES ---------------- //
app.use('/api/products', productsRouter);
app.use('/api/auth', authRouter);
app.use('/api/contact', contactRouter);
app.use('/api/admin', adminRouter);
app.use('/api/upload', uploadRouter);

// ---------------- ERROR HANDLING ---------------- //
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({ success: false, message: 'CORS policy violation', error: err.message });
  }
  res.status(500).json({ success: false, message: 'Internal server error', error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong' });
});

// ---------------- 404 ROUTE ---------------- //
app.use((req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// ---------------- START SERVER ---------------- //
app.listen(PORT, () => {
  console.log(`🚀 Server is running on port ${PORT}`);
});
