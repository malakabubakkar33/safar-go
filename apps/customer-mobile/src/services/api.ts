/**
 * SafarGo Customer Mobile - Typed API Service Layer
 */

import {
  SignupStep1Input,
  VerifyOtpInput,
  ResendOtpInput,
  CreateAccountInput,
  LoginInput,
  AuthResponse,
  SignupStep1Response,
  VerifyOtpResponse,
  ResendOtpResponse,
  AvatarUploadResponse,
} from '@safargo/shared';
import { useAuthStore } from '../store/authStore';

const getBaseUrl = (): string => {
  if (process.env.EXPO_PUBLIC_API_URL) {
    return process.env.EXPO_PUBLIC_API_URL;
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return `${window.location.origin}/api`;
  }
  return 'http://localhost:4000/api';
};

const API_BASE_URL = getBaseUrl();

class ApiService {
  private async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;
    const tokens = useAuthStore.getState().tokens;

    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers as Record<string, string>),
    };

    if (tokens?.accessToken) {
      headers['Authorization'] = `Bearer ${tokens.accessToken}`;
    }

    const response = await fetch(url, {
      ...options,
      headers,
    });

    const data = await response.json().catch(() => ({ error: 'Network parsing error' }));

    if (!response.ok) {
      throw new Error(data.error || data.message || `Request failed with status ${response.status}`);
    }

    return data as T;
  }

  // Auth Endpoints
  async signupStep1(data: SignupStep1Input): Promise<SignupStep1Response> {
    return this.request<SignupStep1Response>('/auth/signup-step1', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async resendOtp(data: ResendOtpInput): Promise<ResendOtpResponse> {
    return this.request<ResendOtpResponse>('/auth/resend-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async verifyOtp(data: VerifyOtpInput): Promise<VerifyOtpResponse> {
    return this.request<VerifyOtpResponse>('/auth/verify-otp', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async uploadAvatar(formData: FormData): Promise<AvatarUploadResponse> {
    const url = `${API_BASE_URL}/auth/upload-avatar`;
    const tokens = useAuthStore.getState().tokens;

    const headers: Record<string, string> = {};
    if (tokens?.accessToken) {
      headers['Authorization'] = `Bearer ${tokens.accessToken}`;
    }

    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || 'Failed to upload photo');
    }
    return data;
  }

  async createAccount(data: CreateAccountInput): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/create-account', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async login(data: LoginInput): Promise<AuthResponse> {
    return this.request<AuthResponse>('/auth/login', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }



  // Ride Booking Endpoints
  async estimateFare(pickupLat: number, pickupLng: number, destLat: number, destLng: number): Promise<{
    success: boolean;
    distanceKm: number;
    durationMins: number;
    estimates: {
      BIKE: { vehicleType: string; title: string; description: string; estimatedFare: number; fareRange: string; etaMinutes: number; icon: string };
      CAR: { vehicleType: string; title: string; description: string; estimatedFare: number; fareRange: string; etaMinutes: number; icon: string };
    };
  }> {
    return this.request('/rides/estimate', {
      method: 'POST',
      body: JSON.stringify({ pickupLat, pickupLng, destLat, destLng }),
    });
  }

  async createRideRequest(data: {
    pickupAddress: string;
    pickupLat: number;
    pickupLng: number;
    destAddress: string;
    destLat: number;
    destLng: number;
    vehicleType: 'BIKE' | 'CAR';
  }): Promise<{ success: boolean; ride: any }> {
    return this.request('/rides/request', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getActiveRide(): Promise<{ hasActiveRide: boolean; ride: any; offers: any[]; messages: any[] }> {
    return this.request('/rides/active');
  }

  async getRideDetails(id: string): Promise<{ success: boolean; ride: any; offers: any[]; messages: any[] }> {
    return this.request(`/rides/${id}`);
  }

  async selectDriverOffer(rideId: string, offerId: string): Promise<{ success: boolean; ride: any; offer: any }> {
    return this.request(`/rides/${rideId}/select-offer`, {
      method: 'POST',
      body: JSON.stringify({ offerId }),
    });
  }

  async sendCounterOffer(rideId: string, amount: number): Promise<{ success: boolean; ride: any; message: any }> {
    return this.request(`/rides/${rideId}/counter-offer`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  async acceptFare(rideId: string, amount?: number): Promise<{ success: boolean; ride: any }> {
    return this.request(`/rides/${rideId}/accept-fare`, {
      method: 'POST',
      body: JSON.stringify({ amount }),
    });
  }

  async confirmPayment(rideId: string, paymentMethod: 'CASH' | 'DIGITAL'): Promise<{ success: boolean; ride: any; payment: any }> {
    return this.request(`/rides/${rideId}/payment`, {
      method: 'POST',
      body: JSON.stringify({ paymentMethod }),
    });
  }

  async progressDriverStatus(rideId: string, newStatus: string): Promise<{ success: boolean; ride: any }> {
    return this.request(`/rides/${rideId}/driver-progress`, {
      method: 'POST',
      body: JSON.stringify({ newStatus }),
    });
  }

  async cancelRide(rideId: string, reason: string): Promise<{ success: boolean; ride: any }> {
    return this.request(`/rides/${rideId}/cancel`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    });
  }

  async submitReview(rideId: string, rating: number, comment?: string): Promise<{ success: boolean; review: any }> {
    return this.request(`/rides/${rideId}/review`, {
      method: 'POST',
      body: JSON.stringify({ rating, comment }),
    });
  }

  async getRideHistory(filter: 'all' | 'completed' | 'cancelled' = 'all'): Promise<{ success: boolean; rides: any[] }> {
    return this.request(`/rides/history/all?filter=${filter}`);
  }

  async getRideMessages(rideId: string): Promise<{ success: boolean; messages: any[] }> {
    return this.request(`/rides/${rideId}/messages`);
  }

  async sendRideMessage(rideId: string, content: string, type = 'TEXT', amount?: number): Promise<{ success: boolean; message: any }> {
    return this.request(`/rides/${rideId}/messages`, {
      method: 'POST',
      body: JSON.stringify({ content, type, amount }),
    });
  }

  // -------------------------------------------------------------
  // Location, Geocoding & Routing Endpoints
  // -------------------------------------------------------------
  async getServiceArea(): Promise<{
    supportedCity: string;
    serviceBounds: { minLat: number; maxLat: number; minLng: number; maxLng: number; centerLat: number; centerLng: number };
    center: { lat: number; lng: number; name: string; address: string };
    message: string;
    categories: string[];
  }> {
    return this.request('/locations/service-area');
  }

  async searchLocations(
    query: string,
    category?: string,
    userLat?: number,
    userLng?: number
  ): Promise<{
    results: Array<{
      id: string;
      title: string;
      address: string;
      lat: number;
      lng: number;
      city?: string;
      category?: string;
      distanceKm?: number;
      isWithinServiceArea?: boolean;
    }>;
  }> {
    const params = new URLSearchParams({ q: query });
    if (category) params.append('category', category);
    if (userLat != null && userLng != null) {
      params.append('userLat', String(userLat));
      params.append('userLng', String(userLng));
    }
    return this.request(`/locations/search?${params.toString()}`);
  }

  async reverseGeocode(
    lat: number,
    lng: number
  ): Promise<{
    address: string;
    name?: string;
    city?: string;
    category?: string;
    lat: number;
    lng: number;
    isWithinServiceArea: boolean;
  }> {
    return this.request(`/locations/reverse?lat=${lat}&lng=${lng}`);
  }

  async calculateRoute(
    pickupLat: number,
    pickupLng: number,
    destLat: number,
    destLng: number
  ): Promise<{
    success: boolean;
    distanceKm: number;
    durationMins: number;
    coordinates: Array<{ lat: number; lng: number }>;
    provider?: string;
  }> {
    return this.request('/locations/route', {
      method: 'POST',
      body: JSON.stringify({ pickupLat, pickupLng, destLat, destLng }),
    });
  }

  async getSavedPlaces(): Promise<{ places: any[] }> {
    return this.request('/locations/saved');
  }

  async savePlace(data: {
    label: string;
    address: string;
    lat: number;
    lng: number;
  }): Promise<{ success: boolean; place: any }> {
    return this.request('/locations/saved', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteSavedPlace(id: string): Promise<{ success: boolean }> {
    return this.request(`/locations/saved/${id}`, {
      method: 'DELETE',
    });
  }
}

export const api = new ApiService();

