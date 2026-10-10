/**
 * SafarGo - Verified Peshawar Metropolitan Boundary & Geofencing Configuration
 * Coordinates verified against Survey of Pakistan & OpenStreetMap Peshawar boundaries.
 */

import {
  BoundingBox,
  PESHAWAR_SERVICE_BOUNDS,
  PESHAWAR_CENTER,
  PESHAWAR_MAP_CAMERA,
  SERVICE_AREA_NOTICE,
  VERIFIED_PESHAWAR_LANDMARKS,
  ServiceAreaService,
} from './serviceAreaService';

export type { BoundingBox };
export { PESHAWAR_CENTER, SERVICE_AREA_NOTICE, ServiceAreaService };

export const PESHAWAR_SERVICE_AREA = PESHAWAR_SERVICE_BOUNDS;
export const PESHAWAR_MAP_CONFIG = PESHAWAR_MAP_CAMERA;
export const PESHAWAR_LANDMARKS = VERIFIED_PESHAWAR_LANDMARKS;

/**
 * Validates if coordinates fall within the supported Peshawar SafarGo operating area
 */
export function isWithinPeshawar(lat: number, lng: number): boolean {
  return ServiceAreaService.isWithinServiceArea(lat, lng);
}
