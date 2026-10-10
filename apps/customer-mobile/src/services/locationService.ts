/**
 * SafarGo - Device GPS & Foreground Location Service
 * Robust handling of location permissions, device services, and current GPS coords.
 */

import * as Location from 'expo-location';

export type LocationPermissionStatus = 'idle' | 'detecting' | 'granted' | 'denied' | 'disabled' | 'error';

export interface UserPosition {
  lat: number;
  lng: number;
  accuracy?: number | null;
  heading?: number | null;
  speed?: number | null;
  timestamp: number;
}

export const LocationService = {
  /**
   * Check if device location services (GPS hardware/switches) are turned on
   */
  async areServicesEnabled(): Promise<boolean> {
    try {
      return await Location.hasServicesEnabledAsync();
    } catch {
      return false;
    }
  },

  /**
   * Check current foreground permissions
   */
  async getPermissionsAsync(): Promise<Location.LocationPermissionResponse> {
    return await Location.getForegroundPermissionsAsync();
  },

  /**
   * Request foreground permissions from the user
   */
  async requestPermissionsAsync(): Promise<Location.LocationPermissionResponse> {
    return await Location.requestForegroundPermissionsAsync();
  },

  /**
   * Get device's current GPS position with balanced accuracy & safety timeout
   */
  async getCurrentPosition(timeoutMs = 8000): Promise<{
    status: LocationPermissionStatus;
    position?: UserPosition;
    errorMessage?: string;
  }> {
    // 1. Verify device location switch is enabled
    const enabled = await this.areServicesEnabled();
    if (!enabled) {
      return {
        status: 'disabled',
        errorMessage: 'Location services are disabled on your device. Please turn on GPS.',
      };
    }

    // 2. Request permission if not already granted
    let perm = await this.getPermissionsAsync();
    if (perm.status !== 'granted') {
      perm = await this.requestPermissionsAsync();
      if (perm.status !== 'granted') {
        return {
          status: 'denied',
          errorMessage: 'Location permission was denied. You can select your pickup manually.',
        };
      }
    }

    // 3. Acquire location with timeout defense
    try {
      const positionPromise = Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.Balanced,
      });

      const timeoutPromise = new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('GPS location request timed out')), timeoutMs)
      );

      const result = await Promise.race([positionPromise, timeoutPromise]);

      return {
        status: 'granted',
        position: {
          lat: result.coords.latitude,
          lng: result.coords.longitude,
          accuracy: result.coords.accuracy,
          heading: result.coords.heading,
          speed: result.coords.speed,
          timestamp: result.timestamp,
        },
      };
    } catch (err: any) {
      // If fresh position timed out, try getting last known position as fallback
      try {
        const lastKnown = await Location.getLastKnownPositionAsync({});
        if (lastKnown) {
          return {
            status: 'granted',
            position: {
              lat: lastKnown.coords.latitude,
              lng: lastKnown.coords.longitude,
              accuracy: lastKnown.coords.accuracy,
              heading: lastKnown.coords.heading,
              speed: lastKnown.coords.speed,
              timestamp: lastKnown.timestamp,
            },
          };
        }
      } catch {}

      return {
        status: 'error',
        errorMessage: err.message || 'Unable to retrieve your current location.',
      };
    }
  },
};
