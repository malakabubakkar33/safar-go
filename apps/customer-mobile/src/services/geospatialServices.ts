/**
 * SafarGo - Modular Geospatial Engineering Services
 * Clean provider architecture for Geocoding, Place Search, Map Config, and Routing
 */

import { api } from './api';
import { PESHAWAR_CENTER, isWithinPeshawar, SERVICE_AREA_NOTICE } from './peshawarGeofence';

export interface PlaceSearchResult {
  id: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  city?: string;
  distanceKm?: number;
  isWithinServiceArea: boolean;
}

export interface GeocodedAddress {
  address: string;
  name?: string;
  city?: string;
  lat: number;
  lng: number;
  isWithinServiceArea: boolean;
}

export interface RouteData {
  distanceKm: number;
  durationMins: number;
  coordinates: Array<{ lat: number; lng: number }>;
}

// -----------------------------------------------------------------
// 1. GEOCODING SERVICE
// -----------------------------------------------------------------
export const GeocodingService = {
  async reverseGeocode(lat: number, lng: number): Promise<GeocodedAddress> {
    try {
      const res = await api.reverseGeocode(lat, lng);
      const isPeshawar = isWithinPeshawar(lat, lng);
      return {
        address: res.address || `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        name: res.name || (isPeshawar ? 'Current Location in Peshawar' : 'Location'),
        city: res.city || 'Peshawar',
        lat,
        lng,
        isWithinServiceArea: isPeshawar,
      };
    } catch {
      const isPeshawar = isWithinPeshawar(lat, lng);
      return {
        address: isPeshawar ? 'Peshawar, Khyber Pakhtunkhwa' : `${lat.toFixed(4)}, ${lng.toFixed(4)}`,
        name: isPeshawar ? 'Peshawar' : 'Current Location',
        city: 'Peshawar',
        lat,
        lng,
        isWithinServiceArea: isPeshawar,
      };
    }
  },
};

// -----------------------------------------------------------------
// 2. PLACE SEARCH SERVICE (Real Autocomplete with Cache & Bounds)
// -----------------------------------------------------------------
const searchCache = new Map<string, PlaceSearchResult[]>();

export const PlaceSearchService = {
  async search(query: string, currentCoords?: { lat: number; lng: number }): Promise<PlaceSearchResult[]> {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed || trimmed.length < 2) return [];

    if (searchCache.has(trimmed)) {
      return searchCache.get(trimmed)!;
    }

    try {
      const data = await api.searchLocations(trimmed);
      const results: PlaceSearchResult[] = (data.results || []).map((item: any) => {
        const lat = Number(item.lat);
        const lng = Number(item.lng);
        const isSupported = isWithinPeshawar(lat, lng);

        let distanceKm: number | undefined;
        if (currentCoords) {
          distanceKm = calculateHaversineKm(currentCoords.lat, currentCoords.lng, lat, lng);
        }

        return {
          id: item.id || `loc_${Math.random()}`,
          title: item.title || item.name || 'Peshawar Landmark',
          address: item.address || 'Peshawar, Khyber Pakhtunkhwa',
          lat,
          lng,
          city: item.city || 'Peshawar',
          distanceKm,
          isWithinServiceArea: isSupported,
        };
      });

      // Cache up to 40 recent queries
      if (searchCache.size > 40) {
        const firstKey = searchCache.keys().next().value;
        if (firstKey) searchCache.delete(firstKey);
      }
      searchCache.set(trimmed, results);

      return results;
    } catch (err) {
      console.warn('[PlaceSearchService] Search error:', err);
      return [];
    }
  },

  clearCache() {
    searchCache.clear();
  },
};

// -----------------------------------------------------------------
// 3. ROUTING SERVICE
// -----------------------------------------------------------------
export const RoutingService = {
  async getRoute(
    pickupLat: number,
    pickupLng: number,
    destLat: number,
    destLng: number
  ): Promise<RouteData> {
    try {
      const data = await api.calculateRoute(pickupLat, pickupLng, destLat, destLng);
      return {
        distanceKm: Number(data.distanceKm) || 4.2,
        durationMins: Number(data.durationMins) || 12,
        coordinates: Array.isArray(data.coordinates) ? data.coordinates : [],
      };
    } catch {
      const distanceKm = calculateHaversineKm(pickupLat, pickupLng, destLat, destLng) * 1.3;
      const durationMins = Math.max(3, Math.round(distanceKm * 2.5 + 2));
      return {
        distanceKm: Math.round(distanceKm * 10) / 10,
        durationMins,
        coordinates: [
          { lat: pickupLat, lng: pickupLng },
          { lat: destLat, lng: destLng },
        ],
      };
    }
  },
};

// -----------------------------------------------------------------
// 4. MAP UTILITY HELPERS
// -----------------------------------------------------------------
function calculateHaversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}
