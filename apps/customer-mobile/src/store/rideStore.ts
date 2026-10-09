/**
 * SafarGo Customer Mobile - Active Ride State Store (Zustand)
 */

import { create } from 'zustand';
import { socketService } from '../services/socket';
import { api } from '../services/api';

export interface LocationPoint {
  address: string;
  lat: number;
  lng: number;
  city?: string;
  name?: string;
}

export interface DriverOffer {
  id: string;
  rideId: string;
  driverId: string;
  driverName: string;
  driverPhone: string;
  driverRating: number;
  driverRides: number;
  vehicleType: string;
  vehicleInfo: string;
  registrationNumber: string;
  driverAvatar: string;
  offeredFare: number;
  etaMinutes: number;
  distanceKm: number;
  status: 'PENDING' | 'ACCEPTED' | 'REJECTED' | 'EXPIRED';
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  rideId: string;
  senderId: string;
  senderRole: string;
  senderName: string;
  content: string;
  type: string;
  amount?: number | null;
  createdAt: string;
}

interface RideStoreState {
  // Booking Setup
  pickup: LocationPoint | null;
  destination: LocationPoint | null;
  vehicleType: 'BIKE' | 'CAR';
  route: {
    distanceKm: number;
    durationMins: number;
    coordinates: Array<{ lat: number; lng: number }>;
  } | null;
  estimates: any | null;

  // Active Ride Execution
  activeRide: any | null;
  offers: DriverOffer[];
  selectedOffer: DriverOffer | null;
  messages: ChatMessage[];
  driverLocation: { lat: number; lng: number; heading: number } | null;

  // Saved Places
  savedPlaces: Array<{ id: string; label: string; address: string; lat: number; lng: number }>;

  // Actions
  setPickup: (point: LocationPoint | null) => void;
  setDestination: (point: LocationPoint | null) => void;
  setVehicleType: (type: 'BIKE' | 'CAR') => void;
  setRoute: (route: any) => void;
  setEstimates: (estimates: any) => void;
  setActiveRide: (ride: any | null) => void;
  setOffers: (offers: DriverOffer[]) => void;
  addOffer: (offer: DriverOffer) => void;
  setSelectedOffer: (offer: DriverOffer | null) => void;
  setMessages: (messages: ChatMessage[]) => void;
  addMessage: (msg: ChatMessage) => void;
  setDriverLocation: (loc: { lat: number; lng: number; heading: number }) => void;
  setSavedPlaces: (places: any[]) => void;
  resetBooking: () => void;
  initSocketListeners: (rideId: string) => void;
  cleanupSocketListeners: () => void;
}

export const useRideStore = create<RideStoreState>((set, get) => ({
  pickup: null,
  destination: null,
  vehicleType: 'BIKE',
  route: null,
  estimates: null,

  activeRide: null,
  offers: [],
  selectedOffer: null,
  messages: [],
  driverLocation: null,
  savedPlaces: [],

  setPickup: (pickup) => set({ pickup }),
  setDestination: (destination) => set({ destination }),
  setVehicleType: (vehicleType) => set({ vehicleType }),
  setRoute: (route) => set({ route }),
  setEstimates: (estimates) => set({ estimates }),
  setActiveRide: (activeRide) => set({ activeRide }),
  setOffers: (offers) => set({ offers }),
  addOffer: (offer) => {
    const current = get().offers;
    const exists = current.some((o) => o.id === offer.id);
    if (!exists) {
      set({ offers: [offer, ...current] });
    }
  },
  setSelectedOffer: (selectedOffer) => set({ selectedOffer }),
  setMessages: (messages) => set({ messages }),
  addMessage: (msg) => {
    const current = get().messages;
    const exists = current.some((m) => m.id === msg.id);
    if (!exists) {
      set({ messages: [...current, msg] });
    }
  },
  setDriverLocation: (driverLocation) => set({ driverLocation }),
  setSavedPlaces: (savedPlaces) => set({ savedPlaces }),

  resetBooking: () =>
    set({
      destination: null,
      route: null,
      estimates: null,
      activeRide: null,
      offers: [],
      selectedOffer: null,
      messages: [],
      driverLocation: null,
    }),

  initSocketListeners: (rideId: string) => {
    socketService.joinRideRoom(rideId);

    socketService.on('ride:offer', (offer: DriverOffer) => {
      get().addOffer(offer);
    });

    socketService.on('ride:driver-selected', (data: any) => {
      if (data.ride) set({ activeRide: data.ride });
      if (data.selectedOffer) set({ selectedOffer: data.selectedOffer });
    });

    socketService.on('ride:fare-updated', (data: any) => {
      if (data.ride) set({ activeRide: data.ride });
      if (data.message) get().addMessage(data.message);
    });

    socketService.on('ride:fare-agreed', (data: any) => {
      if (data.ride) set({ activeRide: data.ride });
      if (data.message) get().addMessage(data.message);
    });

    socketService.on('ride:confirmed', (data: any) => {
      if (data.ride) set({ activeRide: data.ride });
    });

    socketService.on('driver:location', (loc: any) => {
      set({ driverLocation: loc });
    });

    socketService.on('driver:arrived', (data: any) => {
      if (data.ride) set({ activeRide: data.ride });
    });

    socketService.on('ride:started', (data: any) => {
      if (data.ride) set({ activeRide: data.ride });
    });

    socketService.on('ride:completed', (data: any) => {
      if (data.ride) set({ activeRide: data.ride });
    });

    socketService.on('ride:cancelled', (data: any) => {
      if (data.ride) set({ activeRide: data.ride });
    });

    socketService.on('chat:message', (msg: ChatMessage) => {
      get().addMessage(msg);
    });
  },

  cleanupSocketListeners: () => {
    const activeRide = get().activeRide;
    if (activeRide?.id) {
      socketService.leaveRideRoom(activeRide.id);
    }
    socketService.off('ride:offer');
    socketService.off('ride:driver-selected');
    socketService.off('ride:fare-updated');
    socketService.off('ride:fare-agreed');
    socketService.off('ride:confirmed');
    socketService.off('driver:location');
    socketService.off('driver:arrived');
    socketService.off('ride:started');
    socketService.off('ride:completed');
    socketService.off('ride:cancelled');
    socketService.off('chat:message');
  },
}));
