import express from 'express';
import { getCollection } from '../db-mongodb.js';
import { body, validationResult } from 'express-validator';
import { sendContactForm, sendContactAutoReply } from '../services/email.js';

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
    const collection = await getCollection('contact_messages');
    const messageData = {
      name: name.trim(),
      email: email.toLowerCase().trim(),
      subject: subject.trim(),
      message: message.trim(),
      read: false,
      created_at: new Date()
    };

    const result = await collection.insertOne(messageData);

    // Send email to admin
    const adminEmail = process.env.ADMIN_EMAIL || process.env.SMTP_USER;
    if (adminEmail) {
      try {
        await sendContactForm(adminEmail, {
          name: messageData.name,
          email: messageData.email,
          subject: messageData.subject,
          message: messageData.message
        });
      } catch (emailError) {
        console.error('Error sending admin email:', emailError);
        // Don't fail the request if email fails
      }
    }

    // Send auto-reply to user
    try {
      await sendContactAutoReply(messageData.email, {
        name: messageData.name
      });
    } catch (emailError) {
      console.error('Error sending auto-reply:', emailError);
      // Don't fail the request if email fails
    }

    res.status(201).json({
      success: true,
      message: 'Message envoyé avec succès',
      data: {
        id: result.insertedId,
        ...messageData
      }
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

