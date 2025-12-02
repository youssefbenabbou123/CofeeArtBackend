import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import pool from '../db.js';

dotenv.config();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-in-production';

// Middleware to verify JWT token
export function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers.authorization;
    
    // Check if authorization header exists and is not empty
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Token manquant'
      });
    }

    const token = authHeader.replace('Bearer ', '').trim();
    
    if (!token || token === '') {
      return res.status(401).json({
        success: false,
        message: 'Token manquant'
      });
    }

    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError' || error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token invalide ou expiré'
      });
    }
    console.error('Token verification error:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification du token',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur'
    });
  }
}

// Middleware to check if user is admin
export async function requireAdmin(req, res, next) {
  try {
    if (!req.user || !req.user.userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    // Get user from database to check role
    let result;
    try {
      result = await pool.query(
        'SELECT role FROM users WHERE id = $1',
        [req.user.userId]
      );
    } catch (dbError) {
      console.error('Database error in requireAdmin:', dbError);
      return res.status(500).json({
        success: false,
        message: 'Erreur de connexion à la base de données',
        error: process.env.NODE_ENV === 'development' ? dbError.message : 'Erreur serveur'
      });
    }

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Utilisateur non trouvé'
      });
    }

    if (result.rows[0].role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Accès refusé. Admin requis.'
      });
    }

    next();
  } catch (error) {
    console.error('Admin check error:', error);
    return res.status(500).json({
      success: false,
      message: 'Erreur lors de la vérification des permissions',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Erreur serveur'
    });
  }
}

