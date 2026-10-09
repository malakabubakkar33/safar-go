/**
 * SafarGo Customer Mobile - Socket.IO Client Service
 */

import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '../store/authStore';

const SOCKET_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/api', '') || 'http://localhost:5000';

class SocketService {
  private socket: Socket | null = null;
  private currentRideId: string | null = null;

  connect(): Socket {
    if (this.socket && this.socket.connected) {
      return this.socket;
    }

    const tokens = useAuthStore.getState().tokens;
    const user = useAuthStore.getState().user;

    this.socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
      auth: {
        token: tokens?.accessToken || '',
      },
      query: {
        userId: user?.id || '',
        role: user?.role || 'CUSTOMER',
      },
      reconnection: true,
      reconnectionAttempts: 10,
      reconnectionDelay: 1000,
    });

    this.socket.on('connect', () => {
      console.log('[Socket] Connected to SafarGo Realtime Gateway');
      if (this.currentRideId) {
        this.joinRideRoom(this.currentRideId);
      }
    });

    this.socket.on('disconnect', (reason) => {
      console.warn('[Socket] Disconnected:', reason);
    });

    this.socket.on('connect_error', (err) => {
      console.warn('[Socket] Connection error:', err.message);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinRideRoom(rideId: string) {
    this.currentRideId = rideId;
    if (this.socket?.connected) {
      this.socket.emit('ride:join', { rideId });
    }
  }

  leaveRideRoom(rideId: string) {
    if (this.socket?.connected) {
      this.socket.emit('ride:leave', { rideId });
    }
    if (this.currentRideId === rideId) {
      this.currentRideId = null;
    }
  }

  sendChatMessage(rideId: string, content: string, type = 'TEXT', amount?: number) {
    const user = useAuthStore.getState().user;
    if (this.socket?.connected) {
      this.socket.emit('chat:send', {
        rideId,
        senderId: user?.id,
        senderRole: user?.role || 'CUSTOMER',
        senderName: user?.fullName || 'Customer',
        content,
        type,
        amount,
      });
    }
  }

  on(eventName: string, callback: (...args: any[]) => void) {
    const s = this.connect();
    s.on(eventName, callback);
  }

  off(eventName: string, callback?: (...args: any[]) => void) {
    if (this.socket) {
      if (callback) {
        this.socket.off(eventName, callback);
      } else {
        this.socket.off(eventName);
      }
    }
  }
}

export const socketService = new SocketService();
