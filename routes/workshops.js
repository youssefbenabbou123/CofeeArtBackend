import express from 'express';
import { getCollection } from '../db-mongodb.js';
import { optionalAuth } from '../middleware/auth.js';
import { sendWorkshopConfirmation, sendWorkshopCancellation } from '../services/email.js';

const router = express.Router();

/**
 * Cleanup past sessions - marks sessions that have passed as 'completed'
 * This is called on certain routes to keep the database clean
 */
async function cleanupPastSessions() {
  try {
    const sessionsCollection = await getCollection('workshop_sessions');
    const now = new Date();
    
    // Find all active sessions that have passed
    const pastSessions = await sessionsCollection.find({
      status: 'active',
      session_date: { $lt: now.toISOString().split('T')[0] } // Sessions before today
    }).toArray();

    // Also check sessions from today that have already passed (considering time)
    const todaySessions = await sessionsCollection.find({
      status: 'active',
      session_date: now.toISOString().split('T')[0]
    }).toArray();

    const sessionsToComplete = [...pastSessions];
    
    // Check today's sessions for past times
    for (const session of todaySessions) {
      if (session.session_time) {
        const [hours, minutes] = session.session_time.split(':').map(Number);
        const sessionDateTime = new Date(session.session_date);
        sessionDateTime.setHours(hours || 0, minutes || 0, 0, 0);
        
        if (sessionDateTime < now) {
          sessionsToComplete.push(session);
        }
      }
    }

    // Mark them as completed
    if (sessionsToComplete.length > 0) {
      const sessionIds = sessionsToComplete.map(s => s._id);
      await sessionsCollection.updateMany(
        { _id: { $in: sessionIds } },
        { $set: { status: 'completed', completed_at: now } }
      );
      console.log(`🧹 Cleaned up ${sessionsToComplete.length} past workshop sessions`);
    }
  } catch (error) {
    console.error('Error cleaning up past sessions:', error);
  }
}

// GET /api/workshops - List available workshops (public)
router.get('/', async (req, res) => {
  try {
    // Cleanup past sessions on each request (lightweight check)
    await cleanupPastSessions();
    
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
    const now = new Date();
    
    const workshopsWithSessions = await Promise.all(workshops.map(async (workshop) => {
      const sessions = await sessionsCollection.find({
        workshop_id: workshop._id,
        status: 'active'
      }).toArray();

      // Filter sessions: only future sessions with available spots
      const availableSessions = sessions.filter(session => {
        // Check if session date/time is in the future
        const sessionDateTime = new Date(session.session_date);
        if (session.session_time) {
          const [hours, minutes] = session.session_time.split(':').map(Number);
          sessionDateTime.setHours(hours || 0, minutes || 0, 0, 0);
        }
        const isFuture = sessionDateTime > now;
        
        // Check if session has available spots
        const hasSpots = (session.capacity - (session.booked_count || 0)) > 0;
        
        return isFuture && hasSpots;
      });

      const sessionDates = availableSessions.map(s => s.session_date).filter(Boolean);
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
        session_count: availableSessions.length, // Only count available future sessions
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

    const reservationsCollection = await getCollection('reservations');
    const workshopsCollection = await getCollection('workshops');
    const sessionsCollection = await getCollection('workshop_sessions');

    // Get user's reservations (excluding cancelled)
    const reservations = await reservationsCollection.find({
      user_id: userId,
      status: { $ne: 'cancelled' }
    }).sort({ created_at: -1 }).toArray();

    // Enrich reservations with workshop and session data
    const enrichedReservations = await Promise.all(reservations.map(async (reservation) => {
      const workshop = await workshopsCollection.findOne({ _id: reservation.workshop_id });
      const session = await sessionsCollection.findOne({ _id: reservation.session_id });

      return {
        id: reservation._id,
        quantity: reservation.quantity,
        status: reservation.status,
        created_at: reservation.created_at,
        waitlist_position: reservation.waitlist_position || null,
        workshop_id: workshop?._id || null,
        workshop_title: workshop?.title || 'Atelier inconnu',
        workshop_description: workshop?.description || '',
        level: workshop?.level || '',
        duration: workshop?.duration || 0,
        price: parseFloat(workshop?.price || 0),
        workshop_image: workshop?.image || null,
        session_id: session?._id || null,
        session_date: session?.session_date || null,
        session_time: session?.session_time || null
      };
    }));

    // Sort by session date
    enrichedReservations.sort((a, b) => {
      if (!a.session_date) return 1;
      if (!b.session_date) return -1;
      return new Date(a.session_date).getTime() - new Date(b.session_date).getTime();
    });

    res.json({
      success: true,
      data: enrichedReservations
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

    // Filter out past sessions and fully booked sessions
    const now = new Date();
    const availableSessions = sessions.filter(session => {
      // Check if session date/time is in the future
      const sessionDateTime = new Date(session.session_date);
      if (session.session_time) {
        const [hours, minutes] = session.session_time.split(':').map(Number);
        sessionDateTime.setHours(hours || 0, minutes || 0, 0, 0);
      }
      const isFuture = sessionDateTime > now;
      
      // Check if session has available spots
      const availableSpots = session.capacity - (session.booked_count || 0);
      const hasSpots = availableSpots > 0;
      
      return isFuture && hasSpots;
    });

    const sessionsWithSpots = availableSessions.map(s => ({
      id: s._id,
      session_date: s.session_date,
      session_time: s.session_time,
      capacity: s.capacity,
      booked_count: s.booked_count || 0,
      available_spots: s.capacity - (s.booked_count || 0),
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

    // Handle gift card if provided
    const { gift_card_code } = req.body;
    let giftCardApplied = null;
    let amountToPay = totalPrice;
    let giftCardAmount = 0;
    
    if (gift_card_code) {
      try {
        const giftCardsCollection = await getCollection('gift_cards');
        const card = await giftCardsCollection.findOne({ code: gift_card_code.toUpperCase() });
        
        if (!card) {
          return res.status(400).json({
            success: false,
            message: 'Carte cadeau non trouvée'
          });
        }
        
        // Check if expired
        if (card.expiry_date && new Date(card.expiry_date) < new Date()) {
          return res.status(400).json({
            success: false,
            message: 'Cette carte cadeau a expiré'
          });
        }
        
        // Check if active
        if (card.status !== 'active') {
          return res.status(400).json({
            success: false,
            message: 'Cette carte cadeau n\'est pas active'
          });
        }
        
        // Check category restriction - workshops can only use "atelier" or "libre" cards
        const cardCategory = card.category;
        const allowedCategories = ['atelier', 'libre'];
        if (cardCategory && !allowedCategories.includes(cardCategory.toLowerCase())) {
          return res.status(400).json({
            success: false,
            message: `Cette carte cadeau est réservée aux ${cardCategory === 'boutique' ? 'produits de la boutique' : cardCategory}. Elle ne peut pas être utilisée pour des ateliers.`
          });
        }
        
        const balance = parseFloat(card.balance || 0);
        if (balance <= 0) {
          return res.status(400).json({
            success: false,
            message: 'Cette carte cadeau n\'a plus de solde'
          });
        }
        
        // Calculate how much to apply
        giftCardAmount = Math.min(balance, totalPrice);
        amountToPay = Math.round((totalPrice - giftCardAmount) * 100) / 100; // Round to 2 decimals
        
        giftCardApplied = {
          code: card.code,
          card_id: card._id,
          amount_applied: giftCardAmount,
          previous_balance: balance,
          new_balance: balance - giftCardAmount
        };
        
        console.log(`🎁 Gift card ${card.code} applied to workshop: ${giftCardAmount}€ (Remaining to pay: ${amountToPay}€)`);
      } catch (giftCardError) {
        console.error('Error applying gift card:', giftCardError);
        return res.status(500).json({
          success: false,
          message: 'Erreur lors de l\'application de la carte cadeau'
        });
      }
    }

    // If payment is required, create reservation with "pending" status first, then create Square Checkout Session
    if (create_payment_intent && amountToPay > 0) {
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
          // Gift card info
          gift_card_code: giftCardApplied?.code || null,
          gift_card_amount: giftCardAmount || null,
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
        
        // Create line items for the remaining amount (after gift card)
        const lineItems = [{
          name: giftCardApplied 
            ? `${workshop.title} - ${quantity} place${quantity > 1 ? 's' : ''} (après carte cadeau ${giftCardApplied.code})`
            : `${workshop.title} - ${quantity} place${quantity > 1 ? 's' : ''}`,
          description: `Réservation pour la session du ${new Date(session.session_date).toLocaleDateString('fr-FR')} à ${session.session_time}`,
          quantity: 1,
          amount: amountToPay,
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
          gift_card_code: gift_card_code || null,
          gift_card_amount: giftCardAmount || null
        });

        if (squareCheckout && squareCheckout.url) {
          // Store the Square checkout ID on the reservation for refund tracking
          await reservationsCollection.updateOne(
            { _id: reservation.id },
            { 
              $set: { 
                square_checkout_id: squareCheckout.id,
                amount_paid: amountToPay
              } 
            }
          );

          return res.status(200).json({
            success: true,
            message: giftCardApplied && amountToPay === 0 
              ? 'Réservation créée et payée avec votre carte cadeau' 
              : 'Redirection vers le paiement...',
            data: {
              reservation_id: reservation.id,
              gift_card: giftCardApplied ? {
                code: giftCardApplied.code,
                amount_applied: giftCardAmount,
                remaining_balance: giftCardApplied.new_balance,
                fully_covered: amountToPay === 0
              } : null,
              amount_to_pay: amountToPay,
              checkout_url: amountToPay > 0 ? squareCheckout.url : null,
              checkout_session_id: amountToPay > 0 ? squareCheckout.id : null
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

