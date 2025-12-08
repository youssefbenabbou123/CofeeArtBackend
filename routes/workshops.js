import express from 'express';
import pool from '../db.js';
import { optionalAuth } from '../middleware/auth.js';
import { sendWorkshopConfirmation, sendWorkshopCancellation } from '../services/email.js';

const router = express.Router();

// GET /api/workshops - List available workshops (public)
router.get('/', async (req, res) => {
  try {
    const { level, status } = req.query;

    let query = `
      SELECT 
        w.id,
        w.title,
        w.description,
        w.level,
        w.duration,
        w.price,
        w.image,
        w.status,
        COUNT(DISTINCT ws.id) as session_count,
        MIN(ws.session_date) as next_session_date
      FROM workshops w
      LEFT JOIN workshop_sessions ws ON w.id = ws.workshop_id AND ws.status = 'active'
      WHERE w.status = 'active'
    `;
    const params = [];
    let paramCount = 1;

    if (level) {
      query += ` AND w.level = $${paramCount++}`;
      params.push(level);
    }

    query += ` GROUP BY w.id ORDER BY next_session_date ASC NULLS LAST, w.created_at DESC`;

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows.map(workshop => ({
        ...workshop,
        price: parseFloat(workshop.price || 0)
      }))
    });
  } catch (error) {
    console.error('Error fetching workshops:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching workshops',
      error: error.message
    });
  }
});

// GET /api/workshops/:id - Get workshop details with sessions
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    // Get workshop
    const workshopResult = await pool.query(
      'SELECT * FROM workshops WHERE id = $1',
      [id]
    );

    if (workshopResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Workshop not found'
      });
    }

    const workshop = workshopResult.rows[0];

    // Get sessions
    const sessionsResult = await pool.query(
      `SELECT 
        id,
        session_date,
        session_time,
        capacity,
        booked_count,
        (capacity - booked_count) as available_spots,
        status
       FROM workshop_sessions
       WHERE workshop_id = $1 AND status = 'active'
       ORDER BY session_date, session_time`,
      [id]
    );

    res.json({
      success: true,
      data: {
        ...workshop,
        price: parseFloat(workshop.price || 0),
        sessions: sessionsResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching workshop:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching workshop',
      error: error.message
    });
  }
});

// POST /api/workshops/:id/book - Book workshop (public, guest or user)
router.post('/:id/book', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId || null;
    const { session_id, guest_name, guest_email, guest_phone, quantity = 1 } = req.body;

    // Validate session_id
    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    // Get session
    const sessionResult = await pool.query(
      'SELECT * FROM workshop_sessions WHERE id = $1 AND workshop_id = $2',
      [session_id, id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    const session = sessionResult.rows[0];

    // Check availability
    const availableSpots = session.capacity - session.booked_count;
    if (availableSpots < quantity) {
      // Check if waitlist is enabled
      const waitlistResult = await pool.query(
        `SELECT COUNT(*) as count FROM reservations 
         WHERE session_id = $1 AND waitlist_position IS NOT NULL`,
        [session_id]
      );
      const waitlistCount = parseInt(waitlistResult.rows[0].count);

      // Add to waitlist
      const reservationResult = await pool.query(
        `INSERT INTO reservations (workshop_id, session_id, user_id, quantity, status, guest_name, guest_email, guest_phone, waitlist_position)
         VALUES ($1, $2, $3, $4, 'waitlist', $5, $6, $7, $8)
         RETURNING *`,
        [id, session_id, userId, quantity, guest_name || null, guest_email || null, guest_phone || null, waitlistCount + 1]
      );

      return res.status(200).json({
        success: true,
        message: 'Ajouté à la liste d\'attente',
        data: {
          reservation: reservationResult.rows[0],
          waitlist: true
        }
      });
    }

    // If no user_id, require guest information
    if (!userId && (!guest_name || !guest_email)) {
      return res.status(400).json({
        success: false,
        message: 'Nom et email requis pour les invités'
      });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Create reservation
      const reservationResult = await client.query(
        `INSERT INTO reservations (workshop_id, session_id, user_id, quantity, status, guest_name, guest_email, guest_phone)
         VALUES ($1, $2, $3, $4, 'confirmed', $5, $6, $7)
         RETURNING *`,
        [id, session_id, userId, quantity, guest_name || null, guest_email || null, guest_phone || null]
      );

      // Update session booked count
      await client.query(
        'UPDATE workshop_sessions SET booked_count = booked_count + $1 WHERE id = $2',
        [quantity, session_id]
      );

      await client.query('COMMIT');

      const reservation = reservationResult.rows[0];

      // Get workshop details for email
      const workshopResult = await client.query('SELECT * FROM workshops WHERE id = $1', [id]);
      const workshop = workshopResult.rows[0];

      // Send confirmation email
      const email = userId ? null : guest_email; // Get user email if logged in
      if (email) {
        await sendWorkshopConfirmation(email, {
          participantName: guest_name || 'Participant',
          workshopTitle: workshop.title,
          sessionDate: session.session_date,
          sessionTime: session.session_time,
          duration: workshop.duration,
          level: workshop.level
        });
      }

      res.status(201).json({
        success: true,
        message: 'Réservation confirmée',
        data: reservation
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error booking workshop:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la réservation',
      error: error.message
    });
  }
});

export default router;

