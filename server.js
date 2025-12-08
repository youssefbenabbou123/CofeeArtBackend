import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import pool, { testConnection } from './db.js';
import productsRouter from './routes/products.js';
import authRouter from './routes/auth.js';
import adminRouter from './routes/admin.js';
import contactRouter from './routes/contact.js';
import uploadRouter from './routes/upload.js';
import blogsRouter from './routes/blogs.js';
import ordersRouter from './routes/orders.js';
import adminOrdersRouter from './routes/admin/orders.js';
import workshopsRouter from './routes/workshops.js';
import adminWorkshopsRouter from './routes/admin/workshops.js';
import adminClientsRouter from './routes/admin/clients.js';
import adminGiftCardsRouter from './routes/admin/gift-cards.js';

dotenv.config();
const app = express();
const PORT = process.env.PORT || 3002;

// ---------------- CORS CONFIGURATION ---------------- //
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:3002',
  'http://localhost:3003',
  'http://localhost:5173',  // Vite default port
  'http://localhost:5174',
  'http://127.0.0.1:3000',
  'http://127.0.0.1:3001',
  // Vercel deployments (for when you deploy)
  'https://my-project-ovwmn55cv-lhehlolbro123-2933s-projects.vercel.app',
  'https://my-project-78bhaky0t-lhehlolbro123-2933s-projects.vercel.app',
  /^https:\/\/.*\.vercel\.app$/,  // regex to match any Vercel deployment
];

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) {
      // Allow requests with no origin (like Postman, mobile apps, or server-to-server)
      return callback(null, true);
    }
    
    // Check if origin is in allowedOrigins
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return allowedOrigin === origin;
    });
    
    if (isAllowed) {
      console.log('✅ CORS allowed origin:', origin);
      return callback(null, true);
    }
    
    console.log('❌ CORS blocked origin:', origin);
    return callback(new Error(`CORS policy: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight OPTIONS requests explicitly
app.options('*', cors(corsOptions));

// Request logging middleware (helpful for debugging)
app.use((req, res, next) => {
  console.log(`➡ ${req.method} ${req.path} | Origin: ${req.headers.origin || 'none'}`);
  next();
});

// ---------------- MIDDLEWARE ---------------- //
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// ---------------- HEALTH CHECK & DATABASE TEST ---------------- //
app.get('/', async (req, res) => {
  try {
    const dbTest = await testConnection();
    res.json({
      message: 'Coffee Arts Paris Backend API',
      status: 'running',
      timestamp: new Date(),
      database: {
        connected: dbTest.connected,
        timestamp: dbTest.now
      }
    });
  } catch (error) {
    res.json({
      message: 'Coffee Arts Paris Backend API',
      status: 'running',
      timestamp: new Date(),
      database: {
        connected: false,
        error: error.message
      }
    });
  }
});

// Database test endpoint
app.get('/test-db', async (req, res) => {
  try {
    const result = await testConnection();
    res.json({
      success: true,
      message: 'Database connection successful',
      data: result
    });
  } catch (error) {
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
app.use('/api/blogs', blogsRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/admin/orders', adminOrdersRouter);
app.use('/api/workshops', workshopsRouter);
app.use('/api/admin/workshops', adminWorkshopsRouter);
app.use('/api/admin/clients', adminClientsRouter);
app.use('/api/admin/gift-cards', adminGiftCardsRouter);

// ---------------- ERROR HANDLING ---------------- //
app.use((err, req, res, next) => {
  console.error('🔥 ERROR:', err.message);
  
  if (err.message && err.message.includes('CORS')) {
    return res.status(403).json({
      success: false,
      message: 'CORS policy violation',
      error: err.message
    });
  }
  
  res.status(err.status || 500).json({
    success: false,
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
  });
});

// ---------------- 404 ROUTE ---------------- //
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
    path: req.path
  });
});

// ---------------- START SERVER ---------------- //
app.listen(PORT, () => {
  console.log('');
  console.log('🚀 ========================================');
  console.log(`🚀 Server is running on port ${PORT}`);
  console.log(`🚀 Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`🚀 Health check: http://localhost:${PORT}/`);
  console.log(`🚀 Database test: http://localhost:${PORT}/test-db`);
  console.log('🚀 ========================================');
  console.log('');
});
