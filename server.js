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
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://my-project-plum-eta-90.vercel.app',  // Explicit Vercel production URL
  /^https:\/\/.*\.vercel\.app$/,  // regex to match any Vercel preview/prod deployment
];

// Custom CORS middleware to ensure headers are set correctly
const corsOptions = {
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // allow Postman/server-to-server
    // Check if origin is in allowedOrigins
    const isAllowed = allowedOrigins.some(o => {
      if (o instanceof RegExp) {
        return o.test(origin);
      }
      return o === origin;
    });
    
    if (isAllowed) {
      console.log('✅ CORS allowed origin:', origin);
      return callback(null, true);
    }
    console.log('❌ CORS blocked origin:', origin);
    return callback(new Error(`CORS policy: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','PATCH','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Requested-With','Accept'],
  exposedHeaders: ['Content-Range','X-Content-Range']
};

app.use(cors(corsOptions));

// Explicitly handle preflight OPTIONS requests to ensure headers are set
app.options('*', (req, res) => {
  const origin = req.headers.origin;
  const isAllowed = allowedOrigins.some(o => {
    if (o instanceof RegExp) {
      return o.test(origin);
    }
    return o === origin;
  });
  
  if (isAllowed && origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,PATCH,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type,Authorization,X-Requested-With,Accept');
    res.header('Access-Control-Allow-Credentials', 'true');
    console.log('✅ Preflight request handled, origin:', origin);
  }
  res.sendStatus(204);
});

// Additional middleware to set CORS headers on all responses
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const isAllowed = allowedOrigins.some(o => {
    if (o instanceof RegExp) {
      return o.test(origin);
    }
    return o === origin;
  });
  
  if (isAllowed && origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Access-Control-Allow-Credentials', 'true');
  }
  next();
});

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
