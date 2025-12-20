import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import pool, { testConnection } from './db.js';
import { apiLimiter } from './middleware/rateLimiter.js';
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
import giftCardsRouter from './routes/gift-cards.js';
import stripeRouter from './routes/stripe.js';
import stripeWebhookRouter from './routes/stripe-webhook.js';

dotenv.config();

// Log Stripe configuration status on startup
if (process.env.STRIPE_SECRET_KEY) {
  console.log('✅ Stripe Secret Key is configured');
} else {
  console.warn('⚠️  STRIPE_SECRET_KEY is not set. Payment functionality will be disabled.');
  console.warn('   Please add STRIPE_SECRET_KEY to your .env file and restart the server.');
}

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
  'https://my-project-bewi697zq-lhehlolbro123-2933s-projects.vercel.app',
  'https://my-project-oz60xibo6-lhehlolbro123-2933s-projects.vercel.app',
  /^https:\/\/.*\.vercel\.app$/,  // regex to match any Vercel deployment
];

const corsOptions = {
  origin: (origin, callback) => {
    // In production, don't allow requests with no origin (security)
    if (!origin) {
      if (process.env.NODE_ENV === 'development') {
        // Allow in development for testing tools like Postman
        return callback(null, true);
      }
      return callback(new Error('CORS policy: Origin header required'));
    }

    // Check if origin is in allowedOrigins
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin instanceof RegExp) {
        return allowedOrigin.test(origin);
      }
      return allowedOrigin === origin;
    });

    if (isAllowed) {
      if (process.env.NODE_ENV === 'development') {
        console.log('✅ CORS allowed origin:', origin);
      }
      return callback(null, true);
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('❌ CORS blocked origin:', origin);
    }
    return callback(new Error(`CORS policy: Origin ${origin} not allowed`));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept'],
  exposedHeaders: ['Content-Range', 'X-Content-Range']
};

// ---------------- SECURITY MIDDLEWARE ---------------- //
// Helmet for security headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"], // Allow images from HTTPS sources
      connectSrc: ["'self'", "https:"], // Allow API calls to HTTPS
    },
  },
  crossOriginEmbedderPolicy: false, // Disable for compatibility
}));

// Apply CORS middleware
app.use(cors(corsOptions));

// Handle preflight OPTIONS requests explicitly
app.options('*', cors(corsOptions));

// Request logging middleware (helpful for debugging)
if (process.env.NODE_ENV === 'development') {
  app.use((req, res, next) => {
    console.log(`➡ ${req.method} ${req.path} | Origin: ${req.headers.origin || 'none'}`);
    next();
  });
}

// ---------------- MIDDLEWARE ---------------- //
// Body parser with size limits to prevent DoS attacks
app.use(express.json({ limit: '10mb' })); // Limit JSON payload size
app.use(express.urlencoded({ extended: true, limit: '10mb' })); // Limit URL-encoded payload size

// Apply general rate limiting to all API routes
app.use('/api/', apiLimiter);

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
app.use('/api/gift-cards', giftCardsRouter);
app.use('/api/stripe', stripeRouter);
app.use('/api/stripe', stripeWebhookRouter);
app.use('/api/stripe', stripeWebhookRouter);

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
  console.log(`🚀 Stripe config: http://localhost:${PORT}/api/stripe/check-config`);
  console.log('🚀 ========================================');
  console.log('');
  
  // Final check of Stripe configuration
  if (process.env.STRIPE_SECRET_KEY) {
    console.log('✅ Stripe is configured and ready for payments');
  } else {
    console.log('⚠️  WARNING: Stripe is NOT configured');
    console.log('   Add STRIPE_SECRET_KEY to your .env file to enable payments');
  }
  console.log('');
});
