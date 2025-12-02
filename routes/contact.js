import express from 'express';
import pool from '../db.js';

const router = express.Router();

// POST /api/contact - Submit contact form message
router.post('/', async (req, res) => {
  try {
    const { name, email, subject, message } = req.body;

    // Validation
    if (!name || !email || !subject || !message) {
      return res.status(400).json({
        success: false,
        message: 'Tous les champs sont requis'
      });
    }

    // Insert message into database
    const result = await pool.query(
      'INSERT INTO contact_messages (name, email, subject, message) VALUES ($1, $2, $3, $4) RETURNING id, name, email, subject, message, read, created_at',
      [name, email, subject, message]
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
      error: error.message
    });
  }
});

export default router;

