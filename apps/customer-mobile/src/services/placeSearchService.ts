/**
 * SafarGo - Place Search & Autocomplete Service
 * Searches real places in Peshawar across 8 categories with cache, debouncing, & distance sorting.
 */

import { api } from './api';
import { ServiceAreaService, VERIFIED_PESHAWAR_LANDMARKS } from './serviceAreaService';

export interface PlaceSearchResult {
  id: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  category?: string;
  city?: string;
  distanceKm?: number;
  isWithinServiceArea: boolean;
  source?: string;
}

const searchCache = new Map<string, PlaceSearchResult[]>();

// Helper: Haversine distance in km
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

export const PlaceSearchService = {
  /**
   * Search Peshawar places with optional category filter and user coordinates for distance
   */
  async search(
    query: string,
    userCoords?: { lat: number; lng: number } | null,
    category?: string
  ): Promise<PlaceSearchResult[]> {
    const trimmed = query.trim().toLowerCase();
    const cacheKey = `${trimmed}__cat:${category || 'all'}__user:${userCoords ? `${userCoords.lat.toFixed(2)},${userCoords.lng.toFixed(2)}` : 'none'}`;

    if (!trimmed || trimmed.length < 2) {
      return this.getDefaultLandmarks(userCoords, category);
    }

    if (searchCache.has(cacheKey)) {
      return searchCache.get(cacheKey)!;
    }

    try {
      const data = await api.searchLocations(
        trimmed,
        category,
        userCoords?.lat,
        userCoords?.lng
      );

      const rawResults = Array.isArray(data.results) ? data.results : [];

      const results: PlaceSearchResult[] = rawResults.map((item: any) => {
        const lat = Number(item.lat);
        const lng = Number(item.lng);
        const isSupported = ServiceAreaService.isWithinServiceArea(lat, lng);

        let distanceKm = item.distanceKm;
        if (distanceKm == null && userCoords && !isNaN(userCoords.lat) && !isNaN(userCoords.lng)) {
          distanceKm = calculateHaversineKm(userCoords.lat, userCoords.lng, lat, lng);
        }

        return {
          id: item.id || `loc_${Math.random().toString(36).substring(2, 9)}`,
          title: item.title || item.name || 'Peshawar Landmark',
          address: item.address || 'Peshawar, Khyber Pakhtunkhwa',
          lat,
          lng,
          category: item.category || 'Location',
          city: item.city || 'Peshawar',
          distanceKm,
          isWithinServiceArea: isSupported,
          source: item.source || 'api',
        };
      });

      // Cache up to 50 queries
      if (searchCache.size > 50) {
        const oldestKey = searchCache.keys().next().value;
        if (oldestKey) searchCache.delete(oldestKey);
      }
      searchCache.set(cacheKey, results);

      return results;
    } catch (err) {
      console.warn('[PlaceSearchService] Remote search error, falling back to local directory:', err);
      // Resilient local matching fallback
      return this.searchLocalDirectory(trimmed, userCoords, category);
    }
  },

  /**
   * Search local verified landmarks when offline or as immediate instant fallback
   */
  searchLocalDirectory(
    query: string,
    userCoords?: { lat: number; lng: number } | null,
    category?: string
  ): PlaceSearchResult[] {
    const qLower = query.toLowerCase();
    const catLower = category?.toLowerCase();

    return VERIFIED_PESHAWAR_LANDMARKS.filter((item) => {
      if (catLower && catLower !== 'all' && item.category.toLowerCase() !== catLower) {
        return false;
      }
      return (
        item.title.toLowerCase().includes(qLower) ||
        item.address.toLowerCase().includes(qLower) ||
        item.category.toLowerCase().includes(qLower)
      );
    }).map((item) => {
      let distanceKm: number | undefined;
      if (userCoords && !isNaN(userCoords.lat) && !isNaN(userCoords.lng)) {
        distanceKm = calculateHaversineKm(userCoords.lat, userCoords.lng, item.lat, item.lng);
      }
      return {
        id: item.id,
        title: item.title,
        address: item.address,
        lat: item.lat,
        lng: item.lng,
        category: item.category,
        city: 'Peshawar',
        distanceKm,
        isWithinServiceArea: true,
        source: 'local_verified',
      };
    });
  },

  /**
   * Returns verified default landmarks for empty search query
   */
  getDefaultLandmarks(
    userCoords?: { lat: number; lng: number } | null,
    category?: string
  ): PlaceSearchResult[] {
    const catLower = category?.toLowerCase();
    return VERIFIED_PESHAWAR_LANDMARKS.filter((item) => {
      if (catLower && catLower !== 'all') {
        return item.category.toLowerCase() === catLower;
      }
      return true;
    }).map((item) => {
      let distanceKm: number | undefined;
      if (userCoords && !isNaN(userCoords.lat) && !isNaN(userCoords.lng)) {
        distanceKm = calculateHaversineKm(userCoords.lat, userCoords.lng, item.lat, item.lng);
      }
      return {
        id: item.id,
        title: item.title,
        address: item.address,
        lat: item.lat,
        lng: item.lng,
        category: item.category,
        city: 'Peshawar',
        distanceKm,
        isWithinServiceArea: true,
        source: 'curated_directory',
      };
    });
  },

  clearCache() {
    searchCache.clear();
  },
};
