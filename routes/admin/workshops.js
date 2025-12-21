import express from 'express';
import pool from '../../db.js';
import { verifyToken, requireAdmin } from '../../middleware/auth.js';
import { sendWorkshopCancellation } from '../../services/email.js';

const router = express.Router();

// All routes require admin authentication
router.use(verifyToken);
router.use(requireAdmin);

// GET /api/admin/workshops - List all workshops
router.get('/', async (req, res) => {
  try {
    const { status, level } = req.query;

    let query = 'SELECT * FROM workshops WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (status) {
      query += ` AND status = $${paramCount++}`;
      params.push(status);
    }

    if (level) {
      query += ` AND level = $${paramCount++}`;
      params.push(level);
    }

    query += ' ORDER BY created_at DESC';

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
      message: 'Erreur lors de la récupération des ateliers',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/admin/workshops/:id/reservations - Get all reservations for a workshop (MUST BE BEFORE /:id)
router.get('/:id/reservations', async (req, res) => {
  try {
    const { id } = req.params;

    // Verify workshop exists
    const workshopCheck = await pool.query(
      'SELECT id, title FROM workshops WHERE id = $1',
      [id]
    );

    if (workshopCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Atelier non trouvé'
      });
    }

    // Get all reservations for this workshop with user/client info and session details
    const result = await pool.query(
      `SELECT 
        r.id,
        r.workshop_id,
        r.session_id,
        r.user_id,
        r.quantity,
        r.status,
        r.guest_name,
        r.guest_email,
        r.guest_phone,
        r.created_at,
        r.cancelled_at,
        r.cancellation_reason,
        r.waitlist_position,
        ws.session_date,
        ws.session_time,
        ws.capacity as session_capacity,
        ws.booked_count,
        u.name as user_name,
        u.email as user_email,
        u.phone as user_phone
      FROM reservations r
      LEFT JOIN workshop_sessions ws ON r.session_id = ws.id
      LEFT JOIN users u ON r.user_id = u.id
      WHERE r.workshop_id = $1
      ORDER BY 
        CASE 
          WHEN r.status = 'confirmed' THEN 1
          WHEN r.status = 'pending' THEN 2
          WHEN r.status = 'waitlist' THEN 3
          WHEN r.status = 'cancelled' THEN 4
          ELSE 5
        END,
        ws.session_date ASC NULLS LAST,
        ws.session_time ASC NULLS LAST,
        r.created_at ASC`,
      [id]
    );

    res.json({
      success: true,
      data: result.rows.map(reservation => ({
        ...reservation,
        quantity: parseInt(reservation.quantity),
        waitlist_position: reservation.waitlist_position ? parseInt(reservation.waitlist_position) : null
      }))
    });
  } catch (error) {
    console.error('Error fetching workshop reservations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des réservations',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/admin/workshops/:id - Get workshop with sessions and bookings
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
        message: 'Atelier non trouvé'
      });
    }

    const workshop = workshopResult.rows[0];

    // Get sessions
    const sessionsResult = await pool.query(
      'SELECT * FROM workshop_sessions WHERE workshop_id = $1 ORDER BY session_date, session_time',
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
      message: 'Erreur lors de la récupération de l\'atelier',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// POST /api/admin/workshops - Create workshop
router.post('/', async (req, res) => {
  try {
    const { title, description, level, duration, price, image, status, capacity } = req.body;

    if (!title || !price) {
      return res.status(400).json({
        success: false,
        message: 'Le titre et le prix sont requis'
      });
    }

    const result = await pool.query(
      `INSERT INTO workshops (title, description, level, duration, price, image, status, capacity)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [title, description || null, level || 'débutant', duration || 120, price, image || null, status || 'active', capacity || 10]
    );

    res.status(201).json({
      success: true,
      message: 'Atelier créé avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating workshop:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de l\'atelier',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// PUT /api/admin/workshops/:id - Update workshop
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, level, duration, price, image, status, capacity } = req.body;

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (title !== undefined) {
      updates.push(`title = $${paramCount++}`);
      values.push(title);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (level !== undefined) {
      updates.push(`level = $${paramCount++}`);
      values.push(level);
    }
    if (duration !== undefined) {
      updates.push(`duration = $${paramCount++}`);
      values.push(duration);
    }
    if (price !== undefined) {
      updates.push(`price = $${paramCount++}`);
      values.push(price);
    }
    if (image !== undefined) {
      updates.push(`image = $${paramCount++}`);
      values.push(image);
    }
    if (status !== undefined) {
      updates.push(`status = $${paramCount++}`);
      values.push(status);
    }
    if (capacity !== undefined) {
      updates.push(`capacity = $${paramCount++}`);
      values.push(capacity);
    }

    if (updates.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }

    values.push(id);
    const query = `UPDATE workshops SET ${updates.join(', ')} WHERE id = $${paramCount} RETURNING *`;

    const result = await pool.query(query, values);

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Atelier non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Atelier mis à jour',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error updating workshop:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la mise à jour de l\'atelier',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// DELETE /api/admin/workshops/:id - Delete workshop
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM workshops WHERE id = $1 RETURNING id',
      [id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Atelier non trouvé'
      });
    }

    res.json({
      success: true,
      message: 'Atelier supprimé'
    });
  } catch (error) {
    console.error('Error deleting workshop:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de l\'atelier',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/admin/workshops/:id/sessions - Get all sessions for a workshop
router.get('/:id/sessions', async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'SELECT * FROM workshop_sessions WHERE workshop_id = $1 ORDER BY session_date, session_time',
      [id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching sessions:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des sessions',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// POST /api/admin/workshops/:id/sessions - Create session
router.post('/:id/sessions', async (req, res) => {
  try {
    const { id } = req.params;
    const { session_date, session_time, capacity } = req.body;

    if (!session_date || !session_time || !capacity) {
      return res.status(400).json({
        success: false,
        message: 'Date, heure et capacité sont requis'
      });
    }

    const result = await pool.query(
      `INSERT INTO workshop_sessions (workshop_id, session_date, session_time, capacity)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [id, session_date, session_time, capacity]
    );

    res.status(201).json({
      success: true,
      message: 'Session créée avec succès',
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error creating session:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la session',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// DELETE /api/admin/workshops/:id/sessions/:sessionId - Delete session
router.delete('/:id/sessions/:sessionId', async (req, res) => {
  try {
    const { id, sessionId } = req.params;

    // Check if session belongs to workshop
    const sessionCheck = await pool.query(
      'SELECT * FROM workshop_sessions WHERE id = $1 AND workshop_id = $2',
      [sessionId, id]
    );

    if (sessionCheck.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Session non trouvée'
      });
    }

    // Check if there are any bookings for this session
    const bookingsCheck = await pool.query(
      'SELECT COUNT(*) FROM reservations WHERE session_id = $1',
      [sessionId]
    );

    if (parseInt(bookingsCheck.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer une session avec des réservations'
      });
    }

    await pool.query(
      'DELETE FROM workshop_sessions WHERE id = $1',
      [sessionId]
    );

    res.json({
      success: true,
      message: 'Session supprimée avec succès'
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression de la session',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/admin/workshops/:id/bookings - Get bookings for workshop
router.get('/:id/bookings', async (req, res) => {
  try {
    const { id } = req.params;
    const { session_id, status } = req.query;

    let query = `
      SELECT 
        r.id,
        r.quantity,
        r.status,
        r.waitlist_position,
        r.guest_name,
        r.guest_email,
        r.guest_phone,
        r.created_at,
        r.cancelled_at,
        r.cancellation_reason,
        u.name as user_name,
        u.email as user_email,
        ws.session_date,
        ws.session_time
      FROM reservations r
      LEFT JOIN users u ON r.user_id = u.id
      LEFT JOIN workshop_sessions ws ON r.session_id = ws.id
      WHERE r.workshop_id = $1
    `;
    const params = [id];
    let paramCount = 2;

    if (session_id) {
      query += ` AND r.session_id = $${paramCount++}`;
      params.push(session_id);
    }

    if (status) {
      query += ` AND r.status = $${paramCount++}`;
      params.push(status);
    }

    query += ' ORDER BY r.created_at DESC';

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error('Error fetching bookings:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des réservations',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// POST /api/admin/workshops/:id/bookings - Manual booking
router.post('/:id/bookings', async (req, res) => {
  try {
    const { id } = req.params;
    const { session_id, user_id, guest_name, guest_email, guest_phone, quantity = 1 } = req.body;

    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: 'Session ID est requis'
      });
    }

    if (!user_id && (!guest_name || !guest_email)) {
      return res.status(400).json({
        success: false,
        message: 'User ID ou informations invité sont requis'
      });
    }

    // Check session availability
    const sessionResult = await pool.query(
      'SELECT * FROM workshop_sessions WHERE id = $1',
      [session_id]
    );

    if (sessionResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Session non trouvée'
      });
    }

    const session = sessionResult.rows[0];
    const availableSpots = session.capacity - session.booked_count;

    if (availableSpots < quantity) {
      return res.status(400).json({
        success: false,
        message: `Seulement ${availableSpots} place(s) disponible(s)`
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
        [id, session_id, user_id || null, quantity, guest_name || null, guest_email || null, guest_phone || null]
      );

      // Update session booked count
      await client.query(
        'UPDATE workshop_sessions SET booked_count = booked_count + $1 WHERE id = $2',
        [quantity, session_id]
      );

      await client.query('COMMIT');

      res.status(201).json({
        success: true,
        message: 'Réservation créée manuellement',
        data: reservationResult.rows[0]
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error creating manual booking:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la création de la réservation',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// PUT /api/admin/workshops/bookings/:id/cancel - Cancel booking
router.put('/bookings/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason, refund_amount, send_email } = req.body;

    // Get reservation
    const reservationResult = await pool.query(
      `SELECT r.*, w.title as workshop_title, ws.session_date, ws.session_time
       FROM reservations r
       LEFT JOIN workshops w ON r.workshop_id = w.id
       LEFT JOIN workshop_sessions ws ON r.session_id = ws.id
       WHERE r.id = $1`,
      [id]
    );

    if (reservationResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    const reservation = reservationResult.rows[0];

    if (reservation.cancelled_at) {
      return res.status(400).json({
        success: false,
        message: 'Réservation déjà annulée'
      });
    }

    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Update reservation
      await client.query(
        `UPDATE reservations 
         SET status = 'cancelled',
             cancelled_at = NOW(),
             cancellation_reason = $1
         WHERE id = $2`,
        [reason || null, id]
      );

      // Update session booked count if confirmed
      if (reservation.status === 'confirmed') {
        await client.query(
          'UPDATE workshop_sessions SET booked_count = booked_count - $1 WHERE id = $2',
          [reservation.quantity, reservation.session_id]
        );
      }

      await client.query('COMMIT');

      // Send cancellation email if requested
      if (send_email && (reservation.guest_email || reservation.user_id)) {
        const email = reservation.guest_email;
        if (email) {
          await sendWorkshopCancellation(email, {
            participantName: reservation.guest_name || 'Participant',
            workshopTitle: reservation.workshop_title,
            sessionDate: reservation.session_date,
            reason: reason,
            refundAmount: refund_amount
          });
        }
      }

      res.json({
        success: true,
        message: 'Réservation annulée',
        data: { ...reservation, cancelled_at: new Date() }
      });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    console.error('Error cancelling booking:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de l\'annulation',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/admin/workshops/calendar - Calendar view
router.get('/calendar/view', async (req, res) => {
  try {
    const { month, year } = req.query;
    const targetMonth = month || new Date().getMonth() + 1;
    const targetYear = year || new Date().getFullYear();

    const result = await pool.query(
      `SELECT 
        ws.id as session_id,
        ws.session_date,
        ws.session_time,
        ws.capacity,
        ws.booked_count,
        w.id as workshop_id,
        w.title,
        w.level,
        w.duration,
        w.price
       FROM workshop_sessions ws
       LEFT JOIN workshops w ON ws.workshop_id = w.id
       WHERE EXTRACT(MONTH FROM ws.session_date) = $1
         AND EXTRACT(YEAR FROM ws.session_date) = $2
         AND ws.status = 'active'
       ORDER BY ws.session_date, ws.session_time`,
      [targetMonth, targetYear]
    );

    res.json({
      success: true,
      data: result.rows.map(row => ({
        ...row,
        price: parseFloat(row.price || 0)
      }))
    });
  } catch (error) {
    console.error('Error fetching calendar:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération du calendrier',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

export default router;

