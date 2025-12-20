import express from 'express';
import pool from '../db.js';
import { body, validationResult } from 'express-validator';

const router = express.Router();

// Input validation middleware
const validateContact = [
  body('name')
    .trim()
    .isLength({ min: 2, max: 100 })
    .withMessage('Le nom doit contenir entre 2 et 100 caractères')
    .escape(),
  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Veuillez fournir une adresse email valide'),
  body('subject')
    .trim()
    .isLength({ min: 3, max: 200 })
    .withMessage('Le sujet doit contenir entre 3 et 200 caractères')
    .escape(),
  body('message')
    .trim()
    .isLength({ min: 10, max: 5000 })
    .withMessage('Le message doit contenir entre 10 et 5000 caractères')
    .escape(),
];

// POST /api/contact - Submit contact form message
router.post('/', validateContact, async (req, res) => {
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

    const { name, email, subject, message } = req.body;

    // Insert message into database
    const result = await pool.query(
      'INSERT INTO contact_messages (name, email, subject, message) VALUES ($1, $2, $3, $4) RETURNING id, name, email, subject, message, read, created_at',
      [name.trim(), email.toLowerCase().trim(), subject.trim(), message.trim()]
    );

    res.status(201).json({
      success: true,
      message: 'Message envoyé avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Contact form error:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'envoi du message',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

export default router;

