import express from 'express';
import { getCollection } from '../db-mongodb.js';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import { body, validationResult } from 'express-validator';
import { authLimiter } from '../middleware/rateLimiter.js';

dotenv.config();

const router = express.Router();

// JWT_SECRET must be set in production
const JWT_SECRET = process.env.JWT_SECRET || (process.env.NODE_ENV === 'production' ? null : 'dev-secret-key-change-in-production');

if (!JWT_SECRET) {
  console.error('❌ CRITICAL: JWT_SECRET environment variable is not set!');
  console.error('   The application cannot run securely without a JWT_SECRET.');
  console.error('   Please set JWT_SECRET in your environment variables.');
  process.exit(1);
}

// Helper function to generate JWT token
function generateToken(userId, email, role) {
  return jwt.sign(
    { userId, email, role },
    JWT_SECRET,
    { expiresIn: '7d' } // Token expires in 7 days
  );
}

// Input validation middleware
const validateSignup = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom doit contenir entre 2 et 100 caractères')
    .escape(),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Veuillez fournir une adresse email valide'),
  body('password')
    .isLength({ min: 12 })
    .withMessage('Le mot de passe doit contenir au moins 12 caractères')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/])/)
    .withMessage('Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial'),
];

const validateSignin = [
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Veuillez fournir une adresse email valide'),
  body('password')
    .notEmpty()
    .withMessage('Le mot de passe est requis'),
];

// POST /api/auth/signup - Register new user
router.post('/signup', authLimiter, validateSignup, async (req, res) => {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Erreur de validation',
        errors: errors.array()
      });
    }

    const { name, email, password } = req.body;

    // Additional password validation (redundant but kept for clarity)
    if (password.length < 12) {
      return res.status(400).json({
        success: false,
        message: 'Le mot de passe doit contenir au moins 12 caractères'
      });
    }

    // Check password complexity
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumbers = /\d/.test(password);
    const hasSpecialChar = /[@$!%*?&#^()_+\-=\[\]{};':"\\|,.<>\/]/.test(password);

    if (!hasUpperCase || !hasLowerCase || !hasNumbers || !hasSpecialChar) {
      return res.status(400).json({
        success: false,
        message: 'Le mot de passe doit contenir au moins une majuscule, une minuscule, un chiffre et un caractère spécial'
      });
    }

    // Check if user already exists
    const usersCollection = await getCollection('users');
    const existingUser = await usersCollection.findOne({ email: email.toLowerCase() });

    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'Cet email est déjà utilisé'
      });
    }

    // Hash password
    const saltRounds = 10;
    const password_hash = await bcrypt.hash(password, saltRounds);

    // Create user
    const userData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password_hash: password_hash,
      role: 'client',
      created_at: new Date()
    };

    const result = await usersCollection.insertOne(userData);
    const user = {
      id: result.insertedId,
      name: userData.name,
      email: userData.email,
      role: userData.role,
      created_at: userData.created_at
    };

    // Generate token
    const token = generateToken(user.id, user.email, user.role);

    res.status(201).json({
      success: true,
      message: 'Compte créé avec succès',
      data: {
        user: {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    console.error('Signup error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création du compte',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// POST /api/auth/signin - Login user
router.post('/signin', authLimiter, validateSignin, async (req, res) => {
  try {
    // Check validation results
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({
        success: false,
        message: 'Erreur de validation',
        errors: errors.array()
      });
    }

    const { email, password } = req.body;

    // Find user
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Verify password
    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({
        success: false,
        message: 'Email ou mot de passe incorrect'
      });
    }

    // Generate token
    const token = generateToken(user._id, user.email, user.role);

    res.json({
      success: true,
      message: 'Connexion réussie',
      data: {
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          role: user.role
        },
        token
      }
    });
  } catch (error) {
    console.error('Signin error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la connexion',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/auth/me - Get current user (protected route)
router.get('/me', async (req, res) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token manquant'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);

    // Get user from database
    const usersCollection = await getCollection('users');
    const user = await usersCollection.findOne({ _id: decoded.userId });

    if (!user) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    res.json({
      success: true,
      data: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        created_at: user.created_at
      }
    });
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token invalide ou expiré'
      });
    }

    console.error('Auth me error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

export default router;

