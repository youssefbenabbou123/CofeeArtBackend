import express from 'express';
import { getCollection } from '../db-mongodb.js';
import { optionalAuth } from '../middleware/auth.js';
import { sendWorkshopConfirmation, sendWorkshopCancellation } from '../services/email.js';

const router = express.Router();

// GET /api/workshops - List available workshops (public)
router.get('/', async (req, res) => {
  try {
    const { level, status } = req.query;

    const workshopsCollection = await getCollection('workshops');
    const sessionsCollection = await getCollection('workshop_sessions');

    // Build query
    const query = { status: 'active' };
    if (level) {
      query.level = level;
    }

    const workshops = await workshopsCollection.find(query)
      .sort({ created_at: -1 })
      .toArray();

    // Get sessions for each workshop and calculate session_count and next_session_date
    const workshopsWithSessions = await Promise.all(workshops.map(async (workshop) => {
      const sessions = await sessionsCollection.find({
        workshop_id: workshop._id,
        status: 'active'
      }).toArray();

      const sessionDates = sessions.map(s => s.session_date).filter(Boolean);
      const nextSessionDate = sessionDates.length > 0 ? new Date(Math.min(...sessionDates.map(d => new Date(d).getTime()))) : null;

      // Get images array
      let images = [];
      if (workshop.images && Array.isArray(workshop.images) && workshop.images.length > 0) {
        images = workshop.images;
      } else if (workshop.image) {
        images = [workshop.image];
      }

      return {
        id: workshop._id,
        title: workshop.title,
        description: workshop.description,
        level: workshop.level,
        duration: workshop.duration,
        price: workshop.price || 0,
        image: images[0] || workshop.image || null,
        images: images,
        status: workshop.status,
        session_count: sessions.length,
        next_session_date: nextSessionDate
      };
    }));

    // Sort by next_session_date
    workshopsWithSessions.sort((a, b) => {
      if (!a.next_session_date && !b.next_session_date) return 0;
      if (!a.next_session_date) return 1;
      if (!b.next_session_date) return -1;
      return new Date(a.next_session_date) - new Date(b.next_session_date);
    });

    res.json({
      success: true,
      data: workshopsWithSessions
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

    const workshopsCollection = await getCollection('workshops');
    const sessionsCollection = await getCollection('workshop_sessions');

    // Get workshop
    const workshop = await workshopsCollection.findOne({ _id: id });

    if (!workshop) {
      return res.status(404).json({
        success: false,
        message: 'Workshop not found'
      });
    }

    // Get sessions
    const sessions = await sessionsCollection.find({
      workshop_id: id,
      status: 'active'
    })
    .sort({ session_date: 1, session_time: 1 })
    .toArray();

    const sessionsWithSpots = sessions.map(s => ({
      id: s._id,
      session_date: s.session_date,
      session_time: s.session_time,
      capacity: s.capacity,
      booked_count: s.booked_count,
      available_spots: s.capacity - s.booked_count,
      status: s.status
    }));

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
        sessions: sessionsWithSpots
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

    const workshopsCollection = await getCollection('workshops');
    const sessionsCollection = await getCollection('workshop_sessions');
    const reservationsCollection = await getCollection('reservations');

    // Get workshop and session
    const workshop = await workshopsCollection.findOne({ _id: id });
    if (!workshop) {
      return res.status(404).json({
        success: false,
        message: 'Workshop not found'
      });
    }

    const session = await sessionsCollection.findOne({ _id: session_id, workshop_id: id });
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session not found'
      });
    }

    // Check availability
    const availableSpots = session.capacity - session.booked_count;
    if (availableSpots < quantity) {
      // Check if waitlist is enabled
      const waitlistCount = await reservationsCollection.countDocuments({
        session_id: session_id,
        waitlist_position: { $ne: null }
      });

      // Add to waitlist
      const reservationData = {
        workshop_id: id,
        session_id: session_id,
        user_id: userId || null,
        quantity: quantity,
        status: 'waitlist',
        guest_name: guest_name || null,
        guest_email: guest_email || null,
        guest_phone: guest_phone || null,
        waitlist_position: waitlistCount + 1,
        created_at: new Date()
      };

      const reservationResult = await reservationsCollection.insertOne(reservationData);
      const reservation = {
        id: reservationResult.insertedId,
        ...reservationData
      };

      return res.status(200).json({
        success: true,
        message: 'Ajouté à la liste d\'attente',
        data: {
          reservation: reservation,
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
      try {
        // Create reservation with "pending" status (will be confirmed after payment)
        const reservationData = {
          workshop_id: id,
          session_id: session_id,
          user_id: userId || null,
          quantity: quantity,
          status: 'pending',
          guest_name: guest_name || null,
          guest_email: guest_email || null,
          guest_phone: guest_phone || null,
          created_at: new Date()
        };

        const reservationResult = await reservationsCollection.insertOne(reservationData);
        const reservation = {
          id: reservationResult.insertedId,
          ...reservationData
        };

        // Block the slot immediately by incrementing booked_count (so it's grayed out for others)
        await sessionsCollection.updateOne(
          { _id: session_id },
          { $inc: { booked_count: quantity } }
        );

        // Create Square Checkout Link
        const { createCheckoutLink } = await import('../services/square.js');
        
        const lineItems = [{
          name: `${workshop.title} - ${quantity} place${quantity > 1 ? 's' : ''}`,
          description: `Réservation pour la session du ${new Date(session.session_date).toLocaleDateString('fr-FR')} à ${session.session_time}`,
          quantity: quantity,
          amount: totalPrice,
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

        const squareCheckout = await createCheckoutLink(lineItems, successUrl, cancelUrl, {
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

        if (squareCheckout && squareCheckout.url) {
          return res.status(200).json({
            success: true,
            message: 'Redirection vers le paiement...',
            data: {
              checkout_url: squareCheckout.url,
              checkout_session_id: squareCheckout.id
            }
          });
        } else {
          // Rollback: delete reservation and revert booked_count
          await reservationsCollection.deleteOne({ _id: reservation.id });
          await sessionsCollection.updateOne(
            { _id: session_id },
            { $inc: { booked_count: -quantity } }
          );
          throw new Error('Square checkout link creation failed: no URL returned');
        }
      } catch (squareError) {
        // Cleanup on error
        try {
          if (reservation?.id) {
            await reservationsCollection.deleteOne({ _id: reservation.id });
            await sessionsCollection.updateOne(
              { _id: session_id },
              { $inc: { booked_count: -quantity } }
            );
          }
        } catch (cleanupError) {
          console.error('Error cleaning up failed reservation:', cleanupError);
        }
        console.error('Error creating Square checkout link:', squareError);
        return res.status(500).json({
          success: false,
          message: `Erreur lors de la création de la session de paiement: ${squareError.message}`
        });
      }
    } else {
      // No payment required - create reservation directly
      try {
        // Create reservation
        const reservationData = {
          workshop_id: id,
          session_id: session_id,
          user_id: userId || null,
          quantity: quantity,
          status: 'confirmed',
          guest_name: guest_name || null,
          guest_email: guest_email || null,
          guest_phone: guest_phone || null,
          created_at: new Date()
        };

        const reservationResult = await reservationsCollection.insertOne(reservationData);
        const reservation = {
          id: reservationResult.insertedId,
          ...reservationData
        };

        // Update session booked count
        await sessionsCollection.updateOne(
          { _id: session_id },
          { $inc: { booked_count: quantity } }
        );

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
        // Cleanup on error
        try {
          if (reservation?.id) {
            await reservationsCollection.deleteOne({ _id: reservation.id });
            await sessionsCollection.updateOne(
              { _id: session_id },
              { $inc: { booked_count: -quantity } }
            );
          }
        } catch (cleanupError) {
          console.error('Error cleaning up failed reservation:', cleanupError);
        }
        throw error;
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

