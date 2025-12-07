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
// Allow localhost for development and all Vercel frontend deployments
const allowedOrigins = [
  'http://localhost:3000',
  'http://localhost:3001',
  'https://coffee-arts-paris.vercel.app',
  'http://localhost:3002'
];

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (like Postman or server-to-server)
    if (!origin) return callback(null, true);

    // Allow localhost and Vercel preview deployments
    if (origin.includes('localhost') || origin.endsWith('.vercel.app')) {
      return callback(null, true);
    }

    // Block everything else
    console.log('❌ CORS blocked origin:', origin);
    return callback(new Error(`CORS policy: Origin ${origin} not allowed`));
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

// ---------------- TEST DATABASE CONNECTION ---------------- //
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
