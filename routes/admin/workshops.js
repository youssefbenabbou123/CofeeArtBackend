import express from 'express';
import { getCollection } from '../../db-mongodb.js';
import { verifyToken, requireAdmin } from '../../middleware/auth.js';
import { sendWorkshopCancellation } from '../../services/email.js';

const router = express.Router();

// All routes require admin authentication
router.use(verifyToken);
router.use(requireAdmin);

// DELETE /api/admin/workshops/all - Delete all workshops (admin only)
router.delete('/all', async (req, res) => {
  try {
    const reservationsCollection = await getCollection('reservations');
    const sessionsCollection = await getCollection('workshop_sessions');
    const workshopsCollection = await getCollection('workshops');
    
    // Delete reservations first
    const reservationsResult = await reservationsCollection.deleteMany({});
    
    // Delete workshop sessions
    const sessionsResult = await sessionsCollection.deleteMany({});
    
    // Delete workshops
    const workshopsResult = await workshopsCollection.deleteMany({});
    
    res.json({
      success: true,
      message: 'Tous les ateliers ont été supprimés',
      data: {
        workshopsDeleted: workshopsResult.deletedCount,
        sessionsDeleted: sessionsResult.deletedCount,
        reservationsDeleted: reservationsResult.deletedCount
      }
    });
  } catch (error) {
    console.error('Error deleting all workshops:', error);
    res.status(500).json({
      success: false,
      message: 'Erreur lors de la suppression des ateliers',
      ...(process.env.NODE_ENV === 'development' && { error: error.message })
    });
  }
});

// GET /api/admin/workshops - List all workshops
router.get('/', async (req, res) => {
  try {
    const { status, level } = req.query;

    const workshopsCollection = await getCollection('workshops');
    
    const query = {};
    if (status) query.status = status;
    if (level) query.level = level;

    const workshops = await workshopsCollection.find(query)
      .sort({ created_at: -1 })
      .toArray();

    res.json({
      success: true,
      data: workshops.map(workshop => ({
        id: workshop._id,
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

    const workshopsCollection = await getCollection('workshops');
    const reservationsCollection = await getCollection('reservations');
    const usersCollection = await getCollection('users');
    const sessionsCollection = await getCollection('workshop_sessions');

    // Verify workshop exists
    const workshop = await workshopsCollection.findOne({ _id: id });

    if (!workshop) {
      return res.status(404).json({
        success: false,
        message: 'Atelier non trouvé'
      });
    }

    // Get all reservations for this workshop
    const reservations = await reservationsCollection.find({ workshop_id: id })
      .sort({ created_at: -1 })
      .toArray();

    // Get user and session details for each reservation
    const reservationsWithDetails = await Promise.all(reservations.map(async (r) => {
      const user = r.user_id ? await usersCollection.findOne({ _id: r.user_id }) : null;
      const session = r.session_id ? await sessionsCollection.findOne({ _id: r.session_id }) : null;

      return {
        id: r._id,
        workshop_id: r.workshop_id,
        session_id: r.session_id,
        user_id: r.user_id,
        quantity: parseInt(r.quantity),
        status: r.status,
        waitlist_position: r.waitlist_position ? parseInt(r.waitlist_position) : null,
        guest_name: r.guest_name,
        guest_email: r.guest_email,
        guest_phone: r.guest_phone,
        created_at: r.created_at,
        cancelled_at: r.cancelled_at,
        cancellation_reason: r.cancellation_reason,
        user_name: user?.name || null,
        user_email: user?.email || null,
        session_date: session?.session_date || null,
        session_time: session?.session_time || null,
        session_capacity: session?.capacity || null,
        booked_count: session?.booked_count || null
      };
    }));

    res.json({
      success: true,
      data: reservationsWithDetails
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

    const workshopsCollection = await getCollection('workshops');
    const sessionsCollection = await getCollection('workshop_sessions');

    // Get workshop
    const workshop = await workshopsCollection.findOne({ _id: id });

    if (!workshop) {
      return res.status(404).json({
        success: false,
        message: 'Atelier non trouvé'
      });
    }

    // Get sessions
    const sessions = await sessionsCollection.find({ workshop_id: id })
      .sort({ session_date: 1, session_time: 1 })
      .toArray();

    res.json({
      success: true,
      data: {
        id: workshop._id,
        ...workshop,
        price: parseFloat(workshop.price || 0),
        sessions: sessions.map(s => ({ id: s._id, ...s }))
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

    const workshopsCollection = await getCollection('workshops');
    
    const workshopData = {
      title,
      description: description || null,
      level: level || 'débutant',
      duration: duration || 120,
      price: parseFloat(price),
      image: image || null,
      status: status || 'active',
      capacity: capacity || 10,
      created_at: new Date()
    };

    const result = await workshopsCollection.insertOne(workshopData);

    res.status(201).json({
      success: true,
      message: 'Atelier créé avec succès',
      data: {
        id: result.insertedId,
        ...workshopData
      }
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

    const workshopsCollection = await getCollection('workshops');
    
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (level !== undefined) updateData.level = level;
    if (duration !== undefined) updateData.duration = duration;
    if (price !== undefined) updateData.price = parseFloat(price);
    if (image !== undefined) updateData.image = image;
    if (status !== undefined) updateData.status = status;
    if (capacity !== undefined) updateData.capacity = capacity;

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Aucune donnée à mettre à jour'
      });
    }

    const result = await workshopsCollection.updateOne(
      { _id: id },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({
        success: false,
        message: 'Atelier non trouvé'
      });
    }

    const updated = await workshopsCollection.findOne({ _id: id });
    res.json({
      success: true,
      message: 'Atelier mis à jour',
      data: {
        id: updated._id,
        ...updated
      }
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

    const workshopsCollection = await getCollection('workshops');
    const result = await workshopsCollection.deleteOne({ _id: id });

    if (result.deletedCount === 0) {
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

    const sessionsCollection = await getCollection('workshop_sessions');
    const sessions = await sessionsCollection.find({ workshop_id: id })
      .sort({ session_date: 1, session_time: 1 })
      .toArray();

    res.json({
      success: true,
      data: sessions.map(s => ({ id: s._id, ...s }))
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

    const sessionsCollection = await getCollection('workshop_sessions');
    
    const sessionData = {
      workshop_id: id,
      session_date: new Date(session_date),
      session_time: session_time,
      capacity: parseInt(capacity),
      booked_count: 0,
      status: 'active',
      created_at: new Date()
    };

    const result = await sessionsCollection.insertOne(sessionData);

    res.status(201).json({
      success: true,
      message: 'Session créée avec succès',
      data: {
        id: result.insertedId,
        ...sessionData
      }
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

    const sessionsCollection = await getCollection('workshop_sessions');
    const reservationsCollection = await getCollection('reservations');

    // Check if session belongs to workshop
    const session = await sessionsCollection.findOne({ _id: sessionId, workshop_id: id });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session non trouvée'
      });
    }

    // Check if there are any bookings for this session
    const bookingsCount = await reservationsCollection.countDocuments({ session_id: sessionId });

    if (bookingsCount > 0) {
      return res.status(400).json({
        success: false,
        message: 'Impossible de supprimer une session avec des réservations'
      });
    }

    await sessionsCollection.deleteOne({ _id: sessionId });

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

    const reservationsCollection = await getCollection('reservations');
    const usersCollection = await getCollection('users');
    const sessionsCollection = await getCollection('workshop_sessions');

    const query = { workshop_id: id };
    if (session_id) query.session_id = session_id;
    if (status) query.status = status;

    const reservations = await reservationsCollection.find(query)
      .sort({ created_at: -1 })
      .toArray();

    const bookings = await Promise.all(reservations.map(async (r) => {
      const user = r.user_id ? await usersCollection.findOne({ _id: r.user_id }) : null;
      const session = r.session_id ? await sessionsCollection.findOne({ _id: r.session_id }) : null;

      return {
        id: r._id,
        quantity: r.quantity,
        status: r.status,
        waitlist_position: r.waitlist_position,
        guest_name: r.guest_name,
        guest_email: r.guest_email,
        guest_phone: r.guest_phone,
        created_at: r.created_at,
        cancelled_at: r.cancelled_at,
        cancellation_reason: r.cancellation_reason,
        user_name: user?.name || null,
        user_email: user?.email || null,
        session_date: session?.session_date || null,
        session_time: session?.session_time || null
      };
    }));

    res.json({
      success: true,
      data: bookings
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

    const sessionsCollection = await getCollection('workshop_sessions');
    const reservationsCollection = await getCollection('reservations');

    // Check session availability
    const session = await sessionsCollection.findOne({ _id: session_id });

    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'Session non trouvée'
      });
    }

    const availableSpots = session.capacity - session.booked_count;

    if (availableSpots < quantity) {
      return res.status(400).json({
        success: false,
        message: `Seulement ${availableSpots} place(s) disponible(s)`
      });
    }

    try {
      // Create reservation
      const reservationData = {
        workshop_id: id,
        session_id: session_id,
        user_id: user_id || null,
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

      res.status(201).json({
        success: true,
        message: 'Réservation créée manuellement',
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

    const reservationsCollection = await getCollection('reservations');
    const workshopsCollection = await getCollection('workshops');
    const sessionsCollection = await getCollection('workshop_sessions');

    // Get reservation
    const reservation = await reservationsCollection.findOne({ _id: id });

    if (!reservation) {
      return res.status(404).json({
        success: false,
        message: 'Réservation non trouvée'
      });
    }

    const workshop = await workshopsCollection.findOne({ _id: reservation.workshop_id });
    const session = await sessionsCollection.findOne({ _id: reservation.session_id });

    if (reservation.cancelled_at) {
      return res.status(400).json({
        success: false,
        message: 'Réservation déjà annulée'
      });
    }

    try {
      // Update reservation
      await reservationsCollection.updateOne(
        { _id: id },
        {
          $set: {
            status: 'cancelled',
            cancelled_at: new Date(),
            cancellation_reason: reason || null
          }
        }
      );

      // Update session booked count if confirmed
      if (reservation.status === 'confirmed') {
        await sessionsCollection.updateOne(
          { _id: reservation.session_id },
          { $inc: { booked_count: -reservation.quantity } }
        );
      }

      // Send cancellation email if requested
      if (send_email && (reservation.guest_email || reservation.user_id)) {
        const email = reservation.guest_email;
        if (email) {
          await sendWorkshopCancellation(email, {
            participantName: reservation.guest_name || 'Participant',
            workshopTitle: workshop?.title || '',
            sessionDate: session?.session_date || null,
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
      throw error;
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

    const sessionsCollection = await getCollection('workshop_sessions');
    const workshopsCollection = await getCollection('workshops');

    // Get sessions for the month
    const startDate = new Date(targetYear, targetMonth - 1, 1);
    const endDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    const sessions = await sessionsCollection.find({
      session_date: {
        $gte: startDate,
        $lte: endDate
      },
      status: 'active'
    })
    .sort({ session_date: 1, session_time: 1 })
    .toArray();

    // Get workshop details for each session
    const sessionsWithWorkshops = await Promise.all(sessions.map(async (ws) => {
      const workshop = await workshopsCollection.findOne({ _id: ws.workshop_id });
      return {
        session_id: ws._id,
        session_date: ws.session_date,
        session_time: ws.session_time,
        capacity: ws.capacity,
        booked_count: ws.booked_count,
        workshop_id: workshop?._id || null,
        title: workshop?.title || null,
        level: workshop?.level || null,
        duration: workshop?.duration || null,
        price: parseFloat(workshop?.price || 0)
      };
    }));

    res.json({
      success: true,
      data: sessionsWithWorkshops
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

