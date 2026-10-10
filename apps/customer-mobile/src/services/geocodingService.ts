/**
 * SafarGo - Geocoding Service
 * Converts coordinates to human-readable addresses and vice-versa for Peshawar.
 */

import { api } from './api';
import { ServiceAreaService, PESHAWAR_CENTER } from './serviceAreaService';

export interface GeocodedAddress {
  address: string;
  name?: string;
  city?: string;
  category?: string;
  lat: number;
  lng: number;
  isWithinServiceArea: boolean;
}

export const GeocodingService = {
  /**
   * Reverse geocodes latitude/longitude into human-readable Peshawar address
   */
  async reverseGeocode(lat: number, lng: number): Promise<GeocodedAddress> {
    const isPeshawar = ServiceAreaService.isWithinServiceArea(lat, lng);

    try {
      const res = await api.reverseGeocode(lat, lng);
      return {
        address: res.address || (isPeshawar ? 'Peshawar, Khyber Pakhtunkhwa' : `${lat.toFixed(4)}, ${lng.toFixed(4)}`),
        name: res.name || (isPeshawar ? 'Current Location in Peshawar' : 'Selected Location'),
        city: res.city || 'Peshawar',
        category: res.category,
        lat,
        lng,
        isWithinServiceArea: res.isWithinServiceArea ?? isPeshawar,
      };
    } catch {
      // Offline fallback using service area calculation
      return {
        address: isPeshawar ? 'Peshawar, Khyber Pakhtunkhwa' : `Outside Peshawar (${lat.toFixed(4)}, ${lng.toFixed(4)})`,
        name: isPeshawar ? 'Peshawar Location' : 'Selected Location',
        city: 'Peshawar',
        lat,
        lng,
        isWithinServiceArea: isPeshawar,
      };
    }
  },

  /**
   * Forward geocodes text query to coordinates via backend search API
   */
  async forwardGeocode(query: string): Promise<GeocodedAddress | null> {
    try {
      const data = await api.searchLocations(query);
      const first = data.results?.[0];
      if (first) {
        return {
          address: first.address,
          name: first.title,
          city: first.city || 'Peshawar',
          category: first.category,
          lat: Number(first.lat),
          lng: Number(first.lng),
          isWithinServiceArea: ServiceAreaService.isWithinServiceArea(Number(first.lat), Number(first.lng)),
        };
      }
      return null;
    } catch {
      return null;
    }
  },
};
