import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import helmet from 'helmet';
import { connectToMongoDB } from './db-mongodb.js';
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
import squareRouter from './routes/square.js';
import squareWebhookRouter from './routes/square-webhook.js';

dotenv.config();

// Log Square configuration status on startup
const accessToken = process.env.SQUARE_ACCESS_TOKEN;
const applicationId = process.env.SQUARE_APPLICATION_ID;
if (accessToken && applicationId) {
  console.log('✅ Square credentials are configured');
} else {
  console.warn('⚠️  Square credentials are not set. Payment functionality will be disabled.');
  console.warn('   Please add SQUARE_ACCESS_TOKEN and SQUARE_APPLICATION_ID to your .env file and restart the server.');
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
  // Production domain
  'https://coffeeartsparis.fr',
  'https://www.coffeeartsparis.fr',
  /^https:\/\/.*coffeeartsparis\.fr$/,  // Match any subdomain of coffeeartsparis.fr
  // Vercel deployments (for when you deploy)
  'https://my-project-ovwmn55cv-lhehlolbro123-2933s-projects.vercel.app',
  'https://my-project-78bhaky0t-lhehlolbro123-2933s-projects.vercel.app',
  'https://my-project-bewi697zq-lhehlolbro123-2933s-projects.vercel.app',
  'https://my-project-oz60xibo6-lhehlolbro123-2933s-projects.vercel.app',
  /^https:\/\/.*\.vercel\.app$/,  // regex to match any Vercel deployment
];

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests with no origin (direct browser requests, health checks, etc.)
    // This is safe because browsers don't send credentials with no-origin requests
    if (!origin) {
      console.log('✅ CORS: No origin (direct request) - allowing');
      return callback(null, true);
    }

    // Log all CORS requests for debugging
    console.log(`🔍 CORS check: Origin="${origin}"`);

    // Check if origin is in allowedOrigins
    const isAllowed = allowedOrigins.some(allowedOrigin => {
      if (allowedOrigin instanceof RegExp) {
        const matches = allowedOrigin.test(origin);
        if (matches) {
          console.log(`✅ CORS: Origin matches regex pattern: ${allowedOrigin}`);
        }
        return matches;
      }
      const matches = allowedOrigin === origin;
      if (matches) {
        console.log(`✅ CORS: Origin matches exact: ${allowedOrigin}`);
      }
      return matches;
    });

    if (isAllowed) {
      console.log(`✅ CORS allowed origin: ${origin}`);
      return callback(null, true);
    }

    console.log(`❌ CORS blocked origin: ${origin}`);
    console.log(`   Allowed origins: ${allowedOrigins.map(o => typeof o === 'string' ? o : o.toString()).join(', ')}`);
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

// Normalize URLs (remove double slashes)
app.use((req, res, next) => {
  if (req.url.includes('//')) {
    req.url = req.url.replace(/\/+/g, '/');
  }
  next();
});

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
    const db = await connectToMongoDB();
    res.json({
      message: 'Coffee Arts Paris Backend API',
      status: 'running',
      timestamp: new Date(),
      database: {
        connected: true,
        type: 'MongoDB Atlas',
        database: db.databaseName
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
    const db = await connectToMongoDB();
    const collections = await db.listCollections().toArray();
    res.json({
      success: true,
      message: 'MongoDB connection successful',
      data: {
        connected: true,
        database: db.databaseName,
        collections: collections.map(c => c.name)
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'MongoDB connection failed',
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
app.use('/api/square', squareRouter);
app.use('/api/square', squareWebhookRouter); // Square webhooks

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
  console.log(`🚀 Square config: http://localhost:${PORT}/api/square/check-config`);
  console.log('🚀 ========================================');
  console.log('');
  
  // Final check of Square configuration
  if (accessToken && applicationId) {
    console.log('✅ Square is configured and ready for payments');
  } else {
    console.log('⚠️  WARNING: Square is NOT configured');
    console.log('   Add SQUARE_ACCESS_TOKEN and SQUARE_APPLICATION_ID to your .env file to enable payments');
  }
  console.log('');
});
