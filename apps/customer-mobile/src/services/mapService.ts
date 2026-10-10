/**
 * SafarGo - Map & Camera Management Service
 * Controls map camera bounds, tile layer providers, and marker layout for Peshawar.
 */

import { PESHAWAR_SERVICE_BOUNDS, PESHAWAR_CENTER, PESHAWAR_MAP_CAMERA } from './serviceAreaService';

export interface TileLayerConfig {
  url: string;
  attribution: string;
  maxZoom: number;
  subdomains?: string[];
}

export const GOOGLE_MAPS_CONFIG = {
  apiKey: 'AIzaSyAOVYRIgupAurZup5y1PRh8Ismb1A3lLao',
  city: 'Peshawar',
  country: 'Pakistan',
  center: { lat: 34.0151, lng: 71.5249 },
};

export const MapService = {
  /**
   * Primary tile layer: Google Maps Vector Roadmap strictly for Peshawar, Pakistan
   */
  getGoogleMapsTileLayer(): TileLayerConfig {
    return {
      url: `https://mt{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}&key=${GOOGLE_MAPS_CONFIG.apiKey}`,
      attribution: '&copy; Google Maps',
      maxZoom: 19,
      subdomains: ['0', '1', '2', '3'],
    };
  },

  /**
   * CARTO Voyager layer
   */
  getPrimaryTileLayer(): TileLayerConfig {
    return {
      url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
      maxZoom: 19,
      subdomains: ['a', 'b', 'c', 'd'],
    };
  },

  /**
   * Fallback tile layer: OpenStreetMap standard
   */
  getFallbackTileLayer(): TileLayerConfig {
    return {
      url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
      maxZoom: 19,
    };
  },

  /**
   * Camera and boundary constraints strictly enforcing the Peshawar metropolitan area
   */
  getCameraConstraints() {
    return {
      initialCenter: PESHAWAR_CENTER,
      defaultZoom: PESHAWAR_MAP_CAMERA.defaultZoom,
      minZoom: PESHAWAR_MAP_CAMERA.minZoom,
      maxZoom: PESHAWAR_MAP_CAMERA.maxZoom,
      maxBounds: [
        [PESHAWAR_SERVICE_BOUNDS.minLat, PESHAWAR_SERVICE_BOUNDS.minLng],
        [PESHAWAR_SERVICE_BOUNDS.maxLat, PESHAWAR_SERVICE_BOUNDS.maxLng],
      ],
      maxBoundsViscosity: 1.0, // Strictly prevent panning outside Peshawar
    };
  },

  /**
   * Formats marker payload for map synchronization
   */
  formatMarkerState(params: {
    userLocation?: { lat: number; lng: number } | null;
    pickupLocation?: { lat: number; lng: number } | null;
    destinationLocation?: { lat: number; lng: number } | null;
    driverLocation?: { lat: number; lng: number } | null;
    routeCoordinates?: Array<{ lat: number; lng: number }> | null;
  }) {
    return {
      userLocation: params.userLocation || null,
      pickupLocation: params.pickupLocation || null,
      destinationLocation: params.destinationLocation || null,
      driverLocation: params.driverLocation || null,
      routeCoordinates: params.routeCoordinates || null,
    };
  },
};
