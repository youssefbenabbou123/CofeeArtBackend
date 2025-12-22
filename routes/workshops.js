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
      data: result.rows.map(workshop => {
        // Get images array, fallback to single image, then to empty array
        let images = [];
        if (workshop.images && Array.isArray(workshop.images) && workshop.images.length > 0) {
          images = workshop.images;
        } else if (workshop.image) {
          images = [workshop.image];
        }
        
        return {
          ...workshop,
          price: parseFloat(workshop.price || 0),
          images: images,
          image: images[0] || workshop.image || null // Keep image for backward compatibility
        };
      })
    });
  } catch (error) {
    console.error('Error fetching workshops:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching workshops',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/workshops/reservations - Get user's reservations (MUST BE BEFORE /:id)
router.get('/reservations', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    const result = await pool.query(
      `SELECT 
        r.id,
        r.quantity,
        r.status,
        r.created_at,
        r.waitlist_position,
        w.id as workshop_id,
        w.title as workshop_title,
        w.description as workshop_description,
        w.level,
        w.duration,
        w.price,
        w.image as workshop_image,
        ws.id as session_id,
        ws.session_date,
        ws.session_time
       FROM reservations r
       LEFT JOIN workshops w ON r.workshop_id = w.id
       LEFT JOIN workshop_sessions ws ON r.session_id = ws.id
       WHERE r.user_id = $1 AND r.status != 'cancelled'
       ORDER BY ws.session_date ASC, ws.session_time ASC`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows.map(reservation => ({
        ...reservation,
        price: parseFloat(reservation.price || 0)
      }))
    });
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des réservations',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/workshops/reservations - Get user's reservations (MUST BE BEFORE /:id)
router.get('/reservations', optionalAuth, async (req, res) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return res.status(401).json({
        success: false,
        message: 'Non authentifié'
      });
    }

    const result = await pool.query(
      `SELECT 
        r.id,
        r.quantity,
        r.status,
        r.created_at,
        r.waitlist_position,
        w.id as workshop_id,
        w.title as workshop_title,
        w.description as workshop_description,
        w.level,
        w.duration,
        w.price,
        w.image as workshop_image,
        ws.id as session_id,
        ws.session_date,
        ws.session_time
       FROM reservations r
       LEFT JOIN workshops w ON r.workshop_id = w.id
       LEFT JOIN workshop_sessions ws ON r.session_id = ws.id
       WHERE r.user_id = $1 AND r.status != 'cancelled'
       ORDER BY ws.session_date ASC, ws.session_time ASC`,
      [userId]
    );

    res.json({
      success: true,
      data: result.rows.map(reservation => ({
        ...reservation,
        price: parseFloat(reservation.price || 0)
      }))
    });
  } catch (error) {
    console.error('Error fetching reservations:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la récupération des réservations',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
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

    // Get images array, fallback to single image, then to empty array
    let images = [];
    if (workshop.images && Array.isArray(workshop.images) && workshop.images.length > 0) {
      images = workshop.images;
    } else if (workshop.image) {
      images = [workshop.image];
    }
    
    res.json({
      success: true,
      data: {
        ...workshop,
        price: parseFloat(workshop.price || 0),
        images: images,
        image: images[0] || workshop.image || null, // Keep image for backward compatibility
        sessions: sessionsResult.rows
      }
    });
  } catch (error) {
    console.error('Error fetching workshop:', error);
    res.status(500).json({
      success: false,
      message: 'Error fetching workshop',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// POST /api/workshops/:id/book - Book workshop (public, guest or user)
router.post('/:id/book', optionalAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId || null;
    const { session_id, guest_name, guest_email, guest_phone, quantity = 1, create_payment_intent = true } = req.body;

    // Validate session_id
    if (!session_id) {
      return res.status(400).json({
        success: false,
        message: 'Session ID is required'
      });
    }

    // Get workshop and session
    const workshopResult = await pool.query('SELECT * FROM workshops WHERE id = $1', [id]);
    if (workshopResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Workshop not found'
      });
    }
    const workshop = workshopResult.rows[0];

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

    // Calculate total price
    const totalPrice = parseFloat(workshop.price || 0) * quantity;

    // If payment is required, create reservation with "pending" status first, then create Stripe Checkout Session
    if (create_payment_intent && totalPrice > 0) {
      const client = await pool.connect();
      
      try {
        await client.query('BEGIN');

        // Create reservation with "pending" status (will be confirmed after payment)
        const reservationResult = await client.query(
          `INSERT INTO reservations (workshop_id, session_id, user_id, quantity, status, guest_name, guest_email, guest_phone)
           VALUES ($1, $2, $3, $4, 'pending', $5, $6, $7)
           RETURNING *`,
          [id, session_id, userId, quantity, guest_name || null, guest_email || null, guest_phone || null]
        );

        const reservation = reservationResult.rows[0];

        // Block the slot immediately by incrementing booked_count (so it's grayed out for others)
        await client.query(
          `UPDATE workshop_sessions 
           SET booked_count = booked_count + $1 
           WHERE id = $2`,
          [quantity, session_id]
        );

        // Create Stripe Checkout Session
        const { createCheckoutSession } = await import('../services/stripe.js');
        
        const lineItems = [{
          price_data: {
            currency: 'eur',
            product_data: {
              name: `${workshop.title} - ${quantity} place${quantity > 1 ? 's' : ''}`,
              description: `Réservation pour la session du ${new Date(session.session_date).toLocaleDateString('fr-FR')} à ${session.session_time}`,
            },
            unit_amount: Math.round(totalPrice * 100), // Price in cents
          },
          quantity: 1,
        }];

        // Get frontend URL - prioritize environment variable, then try to extract from request
        const getFrontendUrl = () => {
          // First priority: Environment variable (most reliable)
          if (process.env.FRONTEND_URL) {
            return process.env.FRONTEND_URL;
          }
          
          // Second priority: Try to extract from request headers
          const origin = req.headers.origin || req.headers.referer;
          if (origin) {
            try {
              const url = new URL(origin);
              const extractedOrigin = url.origin;
              // Only use if it's not localhost (we're in production)
              if (!extractedOrigin.includes('localhost') && !extractedOrigin.includes('127.0.0.1')) {
                return extractedOrigin;
              }
            } catch (e) {
              // Invalid URL, continue to next option
            }
          }
          
          // Check if we're actually running locally (backend is on localhost)
          const isLocalBackend = !process.env.RAILWAY_ENVIRONMENT && 
                                  !process.env.VERCEL && 
                                  (process.env.NODE_ENV === 'development' || !process.env.NODE_ENV);
          
          // Only use localhost if backend is definitely running locally
          if (isLocalBackend) {
            return 'http://localhost:3000';
          }
          
          // Production: require FRONTEND_URL to be set
          console.error('❌ FRONTEND_URL not configured. Cannot determine frontend URL for redirect.');
          throw new Error('FRONTEND_URL environment variable must be set in production. Please configure it in your deployment platform.');
        };
        
        const frontendUrl = getFrontendUrl();
        console.log(`🔗 Using frontend URL for redirect: ${frontendUrl}`);
        const successUrl = `${frontendUrl}/ateliers?success=true`;
        const cancelUrl = `${frontendUrl}/ateliers?cancelled=true`;

        const stripeSession = await createCheckoutSession(lineItems, successUrl, cancelUrl, {
          type: 'workshop_booking',
          reservation_id: reservation.id.toString(),
          workshop_id: id,
          session_id: session_id,
          quantity: quantity.toString(),
          user_id: userId || 'guest',
          guest_name: guest_name || null,
          guest_email: guest_email || null,
          guest_phone: guest_phone || null,
        });

        if (stripeSession && stripeSession.url) {
          await client.query('COMMIT');
          return res.status(200).json({
            success: true,
            message: 'Redirection vers le paiement...',
            data: {
              checkout_url: stripeSession.url,
              checkout_session_id: stripeSession.id
            }
          });
        } else {
          throw new Error('Stripe session creation failed: no URL returned');
        }
      } catch (stripeError) {
        await client.query('ROLLBACK');
        console.error('Error creating Stripe checkout session:', stripeError);
        return res.status(500).json({
          success: false,
          message: `Erreur lors de la création de la session de paiement: ${stripeError.message}`
        });
      } finally {
        client.release();
      }
    } else {
      // No payment required - create reservation directly
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

        // Send confirmation email
        const email = userId ? null : guest_email;
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
    }
  } catch (error) {
    console.error('Error booking workshop:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la réservation',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

export default router;

