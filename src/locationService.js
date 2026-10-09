/**
 * SafarGo - Device Location API Service
 * Handles GPS positioning, IP fallback, and reverse geocoding.
 */


export const LOCATION_CONFIG = {
  apiKey: 'ad129807860e7b56d327bf3aa0a0e4e1',
  defaultCoordinates: {
    lat: 31.5204, // Default urban coordinates
    lng: 74.3587,
    city: 'Lahore',
    country: 'Pakistan',
  },
};

export class LocationService {
  constructor() {
    this.currentLocation = null;
    this.watchId = null;
  }

  /**
   * Request device position with high accuracy GPS and IP API fallback
   */
  async getCurrentPosition() {
    return new Promise((resolve) => {
      if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (pos) => {
            const coords = {
              lat: pos.coords.latitude,
              lng: pos.coords.longitude,
              accuracy: pos.coords.accuracy,
              source: 'gps',
              timestamp: pos.timestamp,
            };

            this.currentLocation = coords;
            resolve(coords);
          },
          async (err) => {
            console.warn('[LocationService] GPS permission denied or unavailable, using Device Location API fallback:', err.message);
            const fallback = await this.getLocationByDeviceApi();
            resolve(fallback);
          },
          {
            enableHighAccuracy: true,
            timeout: 8000,
            maximumAge: 60000,
          }
        );
      } else {
        this.getLocationByDeviceApi().then(resolve);
      }
    });
  }

  /**
   * Device Location API fallback via provided API key
   */
  async getLocationByDeviceApi() {
    try {
      // Attempt resolution using the provided API key
      const endpoints = [
        `https://api.ipgeolocation.io/ipgeo?apiKey=${LOCATION_CONFIG.apiKey}`,
        `https://us1.locationiq.com/v1/reverse?key=${LOCATION_CONFIG.apiKey}&lat=${LOCATION_CONFIG.defaultCoordinates.lat}&lon=${LOCATION_CONFIG.defaultCoordinates.lng}&format=json`,
      ];

      for (const url of endpoints) {
        try {
          const res = await fetch(url, { signal: AbortSignal.timeout(4000) });
          if (res.ok) {
            const data = await res.json();
            const location = {
              lat: parseFloat(data.latitude || data.lat || LOCATION_CONFIG.defaultCoordinates.lat),
              lng: parseFloat(data.longitude || data.lon || LOCATION_CONFIG.defaultCoordinates.lng),
              city: data.city || data.address?.city || LOCATION_CONFIG.defaultCoordinates.city,
              country: data.country_name || data.address?.country || LOCATION_CONFIG.defaultCoordinates.country,
              source: 'device_api',
            };
            this.currentLocation = location;
            return location;
          }
        } catch {
          // Continue to next fallback
        }
      }
    } catch (e) {
      console.warn('[LocationService] Fallback network error:', e);
    }

    // Default safe fallback
    const fallback = {
      ...LOCATION_CONFIG.defaultCoordinates,
      source: 'default',
    };
    this.currentLocation = fallback;
    return fallback;
  }
}

export const locationService = new LocationService();
