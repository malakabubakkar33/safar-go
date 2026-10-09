/**
 * SafarGo - Production Real-Time Socket.IO Architecture
 * Manages WebSocket connections, room subscriptions, real GPS location broadcasts,
 * ride negotiations, and notifications.
 */

import { Server } from 'socket.io';
import jwt from 'jsonwebtoken';
import { rideDB, rideOfferDB, rideMessageDB, userDB, driverProfileDB } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'safargo_production_jwt_secret_key_2026_x89a';

let ioInstance = null;

// Track active connected sockets: Map<userId, Set<socketId>>
const userSockets = new Map();

// Track online driver locations: Map<driverId, { lat, lng, heading, updatedAt }>
const driverLocations = new Map();

export function initSocketServer(httpServer) {
  const io = new Server(httpServer, {
    cors: {
      origin: '*',
      methods: ['GET', 'POST'],
    },
    transports: ['websocket', 'polling'],
  });

  ioInstance = io;

  // Socket authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token) {
      // Allow unauthenticated guest sockets for demo/browsing, but without user identity
      socket.user = null;
      return next();
    }

    try {
      const cleanToken = token.startsWith('Bearer ') ? token.slice(7) : token;
      const decoded = jwt.verify(cleanToken, JWT_SECRET);
      socket.user = decoded;
      return next();
    } catch (err) {
      console.warn('[Socket Auth Warning]: Invalid token', err.message);
      socket.user = null;
      return next();
    }
  });

  io.on('connection', (socket) => {
    const userId = socket.user?.id || socket.handshake.query?.userId;

    if (userId) {
      if (!userSockets.has(userId)) {
        userSockets.set(userId, new Set());
      }
      userSockets.get(userId).add(socket.id);
      socket.join(`user:${userId}`);
    }

    // Role-specific rooms
    const role = socket.user?.role || socket.handshake.query?.role;
    if (role === 'DRIVER') {
      socket.join('drivers:available');
    }

    // 1. Join / Leave Ride Room & User Channel
    const handleJoinRide = (data) => {
      const rideId = typeof data === 'string' ? data : data?.rideId;
      if (rideId) {
        socket.join(`ride:${rideId}`);
        console.log(`[Socket] Client ${socket.id} joined ride:${rideId}`);
      }
    };
    socket.on('ride:join', handleJoinRide);
    socket.on('join:ride', handleJoinRide);

    socket.on('join:user', (targetUserId) => {
      const uId = typeof targetUserId === 'string' ? targetUserId : targetUserId?.userId;
      if (uId) {
        socket.join(`user:${uId}`);
        console.log(`[Socket] Client ${socket.id} joined user:${uId}`);
      }
    });

    socket.on('ride:leave', (data) => {
      const rideId = typeof data === 'string' ? data : data?.rideId;
      if (rideId) {
        socket.leave(`ride:${rideId}`);
      }
    });

    // 2. Real-Time Chat Message in Ride Room
    socket.on('chat:send', async (msgData) => {
      const { rideId, senderId, senderRole, senderName, content, type, amount } = msgData;
      if (!rideId || !content) return;

      const messageRecord = {
        id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        rideId,
        senderId: senderId || socket.user?.id || 'unknown',
        senderRole: senderRole || socket.user?.role || 'CUSTOMER',
        senderName: senderName || 'User',
        content,
        type: type || 'TEXT',
        amount: amount || null,
        createdAt: new Date().toISOString(),
      };

      rideMessageDB.create(messageRecord);

      // Broadcast to all participants in this ride room
      io.to(`ride:${rideId}`).emit('chat:message', messageRecord);
    });

    // 3. Real GPS Driver Location Broadcast
    socket.on('driver:location_update', (locData) => {
      const { driverId, rideId, lat, lng, heading } = locData;
      const dId = driverId || socket.user?.id;
      if (!dId || lat == null || lng == null) return;

      const locationPayload = {
        driverId: dId,
        lat: Number(lat),
        lng: Number(lng),
        heading: Number(heading || 0),
        updatedAt: Date.now(),
      };

      driverLocations.set(dId, locationPayload);

      // If active ride, broadcast specifically to that ride room
      if (rideId) {
        io.to(`ride:${rideId}`).emit('driver:location', locationPayload);
      }
    });

    // 4. Disconnect cleanup
    socket.on('disconnect', () => {
      if (userId && userSockets.has(userId)) {
        userSockets.get(userId).delete(socket.id);
        if (userSockets.get(userId).size === 0) {
          userSockets.delete(userId);
        }
      }
    });
  });

  console.log('[SafarGo Socket.IO] WebSocket server initialized.');
  return io;
}

export function getIO() {
  return ioInstance;
}

/**
 * Emit an event to a specific ride room
 */
export function emitRideEvent(rideId, eventName, payload) {
  if (ioInstance && rideId) {
    ioInstance.to(`ride:${rideId}`).emit(eventName, payload);
  }
}

/**
 * Emit an event to a specific user's private channel
 */
export function emitToUser(userId, eventName, payload) {
  if (ioInstance && userId) {
    ioInstance.to(`user:${userId}`).emit(eventName, payload);
  }
}

/**
 * Broadcast event to all available drivers
 */
export function emitToAvailableDrivers(eventName, payload) {
  if (ioInstance) {
    ioInstance.to('drivers:available').emit(eventName, payload);
  }
}

export function getDriverLocation(driverId) {
  return driverLocations.get(driverId) || null;
}
