/**
 * SafarGo - Ride Management, Fare Negotiation, & Real-time Booking API
 */

import express from 'express';
import {
  rideDB,
  rideOfferDB,
  rideMessageDB,
  paymentDB,
  reviewDB,
  settingsDB,
  userDB,
  driverProfileDB,
  driverVehicleDB,
  customerNotificationDB,
} from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { emitRideEvent, emitToUser, emitToAvailableDrivers } from '../socket.js';

const router = express.Router();

// Helper: Haversine distance in km
function getDistanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const straight = R * c;
  return Math.max(0.6, Math.round(straight * 1.28 * 10) / 10); // road factor 1.28
}

// 1. FARE ESTIMATION
router.post('/estimate', (req, res) => {
  const { pickupLat, pickupLng, destLat, destLng } = req.body;
  if (pickupLat == null || pickupLng == null || destLat == null || destLng == null) {
    return res.status(400).json({ error: 'Pickup and destination coordinates required.' });
  }

  const distanceKm = getDistanceKm(Number(pickupLat), Number(pickupLng), Number(destLat), Number(destLng));
  const durationMins = Math.max(3, Math.round(distanceKm * 2.8 + 2));

  const settings = settingsDB.get();
  const baseBike = settings.baseFareBike || 120;
  const perKmBike = settings.perKmBike || 35;
  const baseCar = settings.baseFareCar || 350;
  const perKmCar = settings.perKmCar || 75;

  const bikeFare = Math.round(baseBike + distanceKm * perKmBike);
  const carFare = Math.round(baseCar + distanceKm * perKmCar);

  return res.json({
    success: true,
    distanceKm,
    durationMins,
    estimates: {
      BIKE: {
        vehicleType: 'BIKE',
        title: 'SafarGo Bike',
        description: 'Fastest single passenger ride through traffic',
        estimatedFare: bikeFare,
        fareRange: `PKR ${Math.round(bikeFare * 0.9)} - ${Math.round(bikeFare * 1.15)}`,
        etaMinutes: 3,
        icon: 'motorcycle',
      },
      CAR: {
        vehicleType: 'CAR',
        title: 'SafarGo Car',
        description: 'Air-conditioned comfort with generous trunk space',
        estimatedFare: carFare,
        fareRange: `PKR ${Math.round(carFare * 0.9)} - ${Math.round(carFare * 1.15)}`,
        etaMinutes: 5,
        icon: 'car',
      },
    },
  });
});

// 2. CREATE RIDE REQUEST
router.post('/request', requireAuth, async (req, res) => {
  const {
    pickupAddress,
    pickupLat,
    pickupLng,
    destAddress,
    destLat,
    destLng,
    vehicleType,
  } = req.body;

  if (!pickupAddress || pickupLat == null || pickupLng == null || !destAddress || destLat == null || destLng == null) {
    return res.status(400).json({ error: 'Complete pickup and destination details are required.' });
  }

  const pLat = Number(pickupLat);
  const pLng = Number(pickupLng);
  const dLat = Number(destLat);
  const dLng = Number(destLng);

  // Enforce Peshawar service-area boundary (Greater Peshawar Area)
  const isWithinPeshawar = (lat, lng) => lat >= 33.88 && lat <= 34.14 && lng >= 71.39 && lng <= 71.68;
  if (!isWithinPeshawar(pLat, pLng) || !isWithinPeshawar(dLat, dLng)) {
    return res.status(400).json({
      error: 'SafarGo is currently available in Peshawar only.',
      code: 'OUTSIDE_SERVICE_AREA',
    });
  }

  const vType = (vehicleType || 'BIKE').toUpperCase();
  const distanceKm = getDistanceKm(Number(pickupLat), Number(pickupLng), Number(destLat), Number(destLng));
  const durationMins = Math.max(3, Math.round(distanceKm * 2.8 + 2));

  const settings = settingsDB.get();
  const baseRate = vType === 'BIKE' ? settings.baseFareBike || 120 : settings.baseFareCar || 350;
  const perKmRate = vType === 'BIKE' ? settings.perKmBike || 35 : settings.perKmCar || 75;
  const estimatedFare = Math.round(baseRate + distanceKm * perKmRate);

  const rideId = `ride_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
  const startRideOtp = String(Math.floor(1000 + Math.random() * 9000));

  const newRide = {
    id: rideId,
    customerId: req.user.id,
    customerName: req.user.fullName || 'Customer',
    customerPhone: req.user.phone || '',
    customerAvatar: req.user.avatarUrl || null,
    vehicleType: vType,
    pickupAddress: String(pickupAddress).trim(),
    pickupLat: Number(pickupLat),
    pickupLng: Number(pickupLng),
    destAddress: String(destAddress).trim(),
    destLat: Number(destLat),
    destLng: Number(destLng),
    distanceKm,
    durationMins,
    estimatedFare,
    agreedFare: null,
    status: 'REQUESTED',
    driverId: null,
    driverName: null,
    driverPhone: null,
    driverAvatar: null,
    driverRating: null,
    driverVehicle: null,
    paymentMethod: null,
    paymentStatus: 'PENDING',
    startRideOtp,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  rideDB.create(newRide);

  // Broadcast to available online drivers
  emitToAvailableDrivers('ride:requested', newRide);

  // Discover approved drivers in system
  const allApproved = driverProfileDB.getAll().filter(
    (p) => p.verificationStatus === 'APPROVED' && p.userId !== req.user.id
  );

  // Match registered vehicles from database
  const candidateDrivers = allApproved.map((p) => {
    const vehicle = driverVehicleDB.getAll().find(
      (v) => (v.driverId === p.id || v.driverId === p.userId)
    );

    const makeModel = vehicle?.make
      ? `${vehicle.make} ${vehicle.model || ''}`.trim()
      : (vType === 'BIKE' ? 'Honda CD 70' : 'Toyota Corolla');
    const regNum = vehicle?.registrationNumber || 'PSH-2024';

    return {
      id: p.id || p.userId,
      userId: p.userId,
      fullName: p.fullName || 'SafarGo Driver',
      phone: p.phone || '',
      rating: p.rating || 4.9,
      rides: p.totalRides || 50,
      vehicleType: vehicle?.vehicleType || vType,
      makeModel,
      regNum,
      avatar: p.profileImageUrl || '/brand/safargo-symbol.svg',
    };
  }).filter((d) => !d.vehicleType || d.vehicleType === vType || allApproved.length <= 1);

  setTimeout(() => {
    candidateDrivers.slice(0, 3).forEach((drv, idx) => {
      setTimeout(() => {
        // Only add if ride is still searching/requesting
        const currentRide = rideDB.findById(rideId);
        if (!currentRide || !['REQUESTED', 'DRIVERS_RESPONDING', 'SEARCHING_DRIVERS'].includes(currentRide.status)) {
          return;
        }

        const variance = [-20, 0, 30][idx] || 0;
        const offerFare = Math.max(80, estimatedFare + variance);
        const offerId = `ofr_${Date.now()}_${idx}`;

        const offer = {
          id: offerId,
          rideId,
          driverId: drv.id || drv.userId,
          driverName: drv.fullName || 'SafarGo Driver',
          driverPhone: drv.phone || '+92 300 0000000',
          driverRating: drv.rating || 4.9,
          driverRides: drv.rides || 240,
          vehicleType: vType,
          vehicleInfo: drv.makeModel || `${drv.vehicleType || vType}`,
          registrationNumber: drv.regNum || 'PSH-2024',
          driverAvatar: drv.avatar || drv.profileImageUrl || '/brand/safargo-symbol.svg',
          offeredFare: offerFare,
          etaMinutes: 2 + idx * 2,
          distanceKm: Math.round((1.0 + idx * 0.8) * 10) / 10,
          status: 'PENDING',
          createdAt: new Date().toISOString(),
        };

        rideOfferDB.create(offer);
        rideDB.update(rideId, { status: 'DRIVERS_RESPONDING' });

        emitRideEvent(rideId, 'ride:offer', offer);
      }, (idx + 1) * 1200);
    });
  }, 1000);

  return res.json({
    success: true,
    ride: newRide,
  });
});

// 3. GET ACTIVE RIDE
router.get('/active', requireAuth, (req, res) => {
  const activeRide = rideDB.findActiveByCustomerId(req.user.id);
  if (!activeRide) {
    return res.json({ hasActiveRide: false, ride: null });
  }

  const offers = rideOfferDB.findByRideId(activeRide.id);
  const messages = rideMessageDB.findByRideId(activeRide.id);

  return res.json({
    hasActiveRide: true,
    ride: activeRide,
    offers,
    messages,
  });
});

// 4. GET SPECIFIC RIDE DETAILS
router.get('/:id', requireAuth, (req, res) => {
  const ride = rideDB.findById(req.params.id);
  if (!ride) {
    return res.status(404).json({ error: 'Ride not found.' });
  }

  const offers = rideOfferDB.findByRideId(ride.id);
  const messages = rideMessageDB.findByRideId(ride.id);

  return res.json({
    success: true,
    ride,
    offers,
    messages,
  });
});

// 5. SELECT DRIVER OFFER
router.post('/:id/select-offer', requireAuth, (req, res) => {
  const { offerId } = req.body;
  const ride = rideDB.findById(req.params.id);

  if (!ride) return res.status(404).json({ error: 'Ride not found.' });
  if (ride.customerId !== req.user.id) {
    return res.status(403).json({ error: 'Unauthorized to modify this ride.' });
  }

  const offer = rideOfferDB.findById(offerId);
  if (!offer || offer.rideId !== ride.id) {
    return res.status(404).json({ error: 'Offer not found.' });
  }

  // Update offer status
  rideOfferDB.update(offerId, { status: 'ACCEPTED' });

  // Update ride
  const updatedRide = rideDB.update(ride.id, {
    status: 'DRIVER_SELECTED',
    driverId: offer.driverId,
    driverName: offer.driverName,
    driverPhone: offer.driverPhone,
    driverAvatar: offer.driverAvatar,
    driverRating: offer.driverRating,
    driverVehicle: `${offer.vehicleInfo} (${offer.registrationNumber})`,
    currentOfferedFare: offer.offeredFare,
    agreedFare: offer.offeredFare,
  });

  // Create initial negotiation chat entry
  const systemMsg = {
    id: `msg_${Date.now()}_sys`,
    rideId: ride.id,
    senderId: 'SYSTEM',
    senderRole: 'SYSTEM',
    senderName: 'SafarGo Dispatch',
    content: `You selected ${offer.driverName}'s offer of PKR ${offer.offeredFare}. You can negotiate or accept this fare.`,
    type: 'SYSTEM',
    amount: offer.offeredFare,
    createdAt: new Date().toISOString(),
  };
  rideMessageDB.create(systemMsg);

  emitRideEvent(ride.id, 'ride:driver-selected', {
    ride: updatedRide,
    selectedOffer: offer,
  });

  return res.json({
    success: true,
    ride: updatedRide,
    offer,
  });
});

// 6. FARE NEGOTIATION: COUNTER OFFER
router.post('/:id/counter-offer', requireAuth, (req, res) => {
  const { amount } = req.body;
  const ride = rideDB.findById(req.params.id);
  if (!ride) return res.status(404).json({ error: 'Ride not found.' });

  const numAmount = Math.max(50, Math.round(Number(amount)));
  const senderRole = req.user.id === ride.customerId ? 'CUSTOMER' : 'DRIVER';
  const senderName = req.user.fullName || (senderRole === 'CUSTOMER' ? 'Customer' : 'Driver');

  const updatedRide = rideDB.update(ride.id, {
    currentOfferedFare: numAmount,
    status: 'NEGOTIATING',
  });

  const msg = {
    id: `msg_${Date.now()}_cntr`,
    rideId: ride.id,
    senderId: req.user.id,
    senderRole,
    senderName,
    content: `${senderName} proposed a counter offer of PKR ${numAmount}`,
    type: 'COUNTER_OFFER',
    amount: numAmount,
    createdAt: new Date().toISOString(),
  };
  rideMessageDB.create(msg);

  emitRideEvent(ride.id, 'ride:fare-updated', {
    ride: updatedRide,
    message: msg,
    amount: numAmount,
  });

  return res.json({ success: true, ride: updatedRide, message: msg });
});

// 7. FARE ACCEPTANCE
router.post('/:id/accept-fare', requireAuth, (req, res) => {
  const ride = rideDB.findById(req.params.id);
  if (!ride) return res.status(404).json({ error: 'Ride not found.' });

  const agreedFare = Number(req.body.amount || ride.currentOfferedFare || ride.estimatedFare);

  const updatedRide = rideDB.update(ride.id, {
    status: 'FARE_AGREED',
    agreedFare,
  });

  const msg = {
    id: `msg_${Date.now()}_agr`,
    rideId: ride.id,
    senderId: 'SYSTEM',
    senderRole: 'SYSTEM',
    senderName: 'SafarGo System',
    content: `Fare agreed at PKR ${agreedFare}! Proceeding to payment confirmation.`,
    type: 'AGREED',
    amount: agreedFare,
    createdAt: new Date().toISOString(),
  };
  rideMessageDB.create(msg);

  emitRideEvent(ride.id, 'ride:fare-agreed', {
    ride: updatedRide,
    agreedFare,
    message: msg,
  });

  return res.json({ success: true, ride: updatedRide });
});

// 8. PAYMENT & CONFIRMATION
router.post('/:id/payment', requireAuth, (req, res) => {
  const { paymentMethod } = req.body;
  const ride = rideDB.findById(req.params.id);
  if (!ride) return res.status(404).json({ error: 'Ride not found.' });

  const pMethod = paymentMethod === 'DIGITAL' ? 'DIGITAL' : 'CASH';
  const paymentRecord = {
    id: `pay_${Date.now()}`,
    rideId: ride.id,
    customerId: ride.customerId,
    driverId: ride.driverId,
    amount: ride.agreedFare || ride.estimatedFare,
    method: pMethod,
    status: pMethod === 'CASH' ? 'PENDING' : 'SUCCESS',
    createdAt: new Date().toISOString(),
  };
  paymentDB.create(paymentRecord);

  const updatedRide = rideDB.update(ride.id, {
    status: 'DRIVER_ASSIGNED',
    paymentMethod: pMethod,
    paymentStatus: paymentRecord.status,
  });

  emitRideEvent(ride.id, 'ride:confirmed', {
    ride: updatedRide,
    payment: paymentRecord,
  });

  // Notify customer
  customerNotificationDB.create({
    userId: ride.customerId,
    title: 'Driver Assigned!',
    message: `${ride.driverName} is on the way to pick you up in a ${ride.driverVehicle}.`,
    type: 'RIDE',
    rideId: ride.id,
  });

  return res.json({
    success: true,
    ride: updatedRide,
    payment: paymentRecord,
  });
});

// 9. DRIVER STATUS PROGRESSION
router.post('/:id/driver-progress', requireAuth, (req, res) => {
  const { newStatus } = req.body;
  const ride = rideDB.findById(req.params.id);
  if (!ride) return res.status(404).json({ error: 'Ride not found.' });

  // ENFORCE: Only approved drivers are authorized to progress ride status
  if (req.user.role === 'DRIVER' || req.user.role === 'PROVIDER') {
    const driverProfile = driverProfileDB.findByUserId(req.user.id);
    if (!driverProfile || driverProfile.verificationStatus !== 'APPROVED') {
      return res.status(403).json({
        error: 'Only approved drivers can progress rides.',
        code: 'DRIVER_NOT_APPROVED',
      });
    }
  }

  const validTransitions = [
    'DRIVER_EN_ROUTE',
    'DRIVER_ARRIVED',
    'RIDE_STARTED',
    'COMPLETED',
  ];

  if (!validTransitions.includes(newStatus)) {
    return res.status(400).json({ error: 'Invalid ride status transition.' });
  }

  const updates = { status: newStatus };
  if (newStatus === 'COMPLETED') {
    updates.paymentStatus = 'SUCCESS';
  }

  const updatedRide = rideDB.update(ride.id, updates);

  // Trigger relevant Socket events
  if (newStatus === 'DRIVER_ARRIVED') {
    emitRideEvent(ride.id, 'driver:arrived', { ride: updatedRide });
  } else if (newStatus === 'RIDE_STARTED') {
    emitRideEvent(ride.id, 'ride:started', { ride: updatedRide });
  } else if (newStatus === 'COMPLETED') {
    emitRideEvent(ride.id, 'ride:completed', { ride: updatedRide });
  } else {
    emitRideEvent(ride.id, 'ride:status_update', { ride: updatedRide, status: newStatus });
  }

  return res.json({ success: true, ride: updatedRide });
});

// 9b. DRIVER SUBMITS DIRECT FARE OFFER
router.post('/:id/submit-offer', requireAuth, (req, res) => {
  const { offeredFare, etaMinutes } = req.body;
  const ride = rideDB.findById(req.params.id);
  if (!ride) return res.status(404).json({ error: 'Ride not found.' });

  // ENFORCE: Only approved drivers are allowed to submit offers
  const driverProfile = driverProfileDB.findByUserId(req.user.id);
  if (!driverProfile || driverProfile.verificationStatus !== 'APPROVED') {
    return res.status(403).json({
      error: 'Only approved drivers with verified status can submit ride offers.',
      code: 'DRIVER_NOT_APPROVED',
    });
  }

  const driverVehicle = driverVehicleDB.getAll().find(
    (v) => (v.driverId === driverProfile.id || v.driverId === req.user.id)
  );

  const offer = {
    id: `ofr_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    rideId: ride.id,
    driverId: driverProfile.id || req.user.id,
    driverName: req.user.fullName || driverProfile.fullName || 'Driver',
    driverPhone: req.user.phone || driverProfile.phone || '',
    driverRating: driverProfile.rating || 4.9,
    driverRides: driverProfile.totalRides || 0,
    vehicleType: driverVehicle?.vehicleType || ride.vehicleType,
    vehicleInfo: driverVehicle ? `${driverVehicle.make} ${driverVehicle.model || ''}`.trim() : 'Vehicle',
    registrationNumber: driverVehicle?.registrationNumber || 'PSH-2024',
    driverAvatar: driverProfile.profileImageUrl || req.user.avatarUrl || '/brand/safargo-symbol.svg',
    offeredFare: Number(offeredFare || ride.estimatedFare),
    etaMinutes: Number(etaMinutes || 3),
    distanceKm: 1.2,
    status: 'PENDING',
    createdAt: new Date().toISOString(),
  };

  rideOfferDB.create(offer);
  rideDB.update(ride.id, { status: 'DRIVERS_RESPONDING' });
  emitRideEvent(ride.id, 'ride:offer', offer);

  return res.json({ success: true, offer });
});

// 10. CANCEL RIDE
router.post('/:id/cancel', requireAuth, (req, res) => {
  const { reason } = req.body;
  const ride = rideDB.findById(req.params.id);
  if (!ride) return res.status(404).json({ error: 'Ride not found.' });

  if (!['REQUESTED', 'DRIVERS_RESPONDING', 'DRIVER_SELECTED', 'NEGOTIATING', 'CONFIRMED', 'DRIVER_ASSIGNED'].includes(ride.status)) {
    return res.status(400).json({ error: 'Active ride cannot be cancelled at this stage.' });
  }

  const updatedRide = rideDB.update(ride.id, {
    status: 'CANCELLED',
    cancellationReason: reason || 'Cancelled by user',
    cancelledBy: req.user.role || 'CUSTOMER',
  });

  emitRideEvent(ride.id, 'ride:cancelled', {
    ride: updatedRide,
    reason: updatedRide.cancellationReason,
  });

  return res.json({ success: true, ride: updatedRide });
});

// 11. SUBMIT REVIEW
router.post('/:id/review', requireAuth, (req, res) => {
  const { rating, comment } = req.body;
  const ride = rideDB.findById(req.params.id);
  if (!ride) return res.status(404).json({ error: 'Ride not found.' });

  const numRating = Math.min(5, Math.max(1, Number(rating) || 5));
  const review = reviewDB.create({
    id: `rev_${Date.now()}`,
    rideId: ride.id,
    customerId: req.user.id,
    customerName: req.user.fullName || 'Customer',
    driverId: ride.driverId || 'unknown',
    rating: numRating,
    comment: String(comment || '').trim(),
    createdAt: new Date().toISOString(),
  });

  return res.json({ success: true, review });
});

// 12. RIDE HISTORY
router.get('/history/all', requireAuth, (req, res) => {
  const filter = req.query.filter || 'all';
  const allUserRides = rideDB.findByCustomerId(req.user.id);

  let filtered = allUserRides;
  if (filter === 'completed') {
    filtered = allUserRides.filter((r) => r.status === 'COMPLETED');
  } else if (filter === 'cancelled') {
    filtered = allUserRides.filter((r) => r.status === 'CANCELLED');
  }

  // Sort newest first
  filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  return res.json({ success: true, rides: filtered });
});

// 13. CHAT MESSAGES
router.get('/:id/messages', requireAuth, (req, res) => {
  const messages = rideMessageDB.findByRideId(req.params.id);
  return res.json({ success: true, messages });
});

router.post('/:id/messages', requireAuth, (req, res) => {
  const { content, type, amount } = req.body;
  const ride = rideDB.findById(req.params.id);
  if (!ride) return res.status(404).json({ error: 'Ride not found.' });

  if (!content || !content.trim()) {
    return res.status(400).json({ error: 'Message content cannot be empty.' });
  }

  const senderRole = req.user.id === ride.customerId ? 'CUSTOMER' : 'DRIVER';
  const msg = {
    id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    rideId: ride.id,
    senderId: req.user.id,
    senderRole,
    senderName: req.user.fullName || 'User',
    content: String(content).trim(),
    type: type || 'TEXT',
    amount: amount || null,
    createdAt: new Date().toISOString(),
  };

  rideMessageDB.create(msg);
  emitRideEvent(ride.id, 'chat:message', msg);

  return res.json({ success: true, message: msg });
});

export default router;
