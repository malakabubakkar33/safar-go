/**
 * SafarGo - Verified Peshawar Metropolitan Boundary & Geofencing Configuration
 * Coordinates verified against Survey of Pakistan & OpenStreetMap Peshawar boundaries.
 */

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export const PESHAWAR_SERVICE_AREA: BoundingBox = {
  // Northern border: Warsak Road / Charsadda Road junction (~34.14° N)
  maxLat: 34.1400,
  // Southern border: Ring Road South / Kohat Road border (~33.88° N)
  minLat: 33.8800,
  // Western border: Karkhano Market / Khyber Agency border (~31.39° -> 71.40° E)
  minLng: 71.3900,
  // Eastern border: Chamkani / GT Road Peshawar Interchange (~71.68° E)
  maxLng: 71.6800,
};

export const PESHAWAR_CENTER = {
  lat: 34.0151,
  lng: 71.5249,
  name: 'Saddar, Peshawar',
  address: 'Saddar Road, Peshawar Cantonment, Khyber Pakhtunkhwa',
  city: 'Peshawar',
};

export const PESHAWAR_MAP_CONFIG = {
  defaultZoom: 14,
  minZoom: 12,
  maxZoom: 18,
  // Bounding box for Leaflet / MapLibre camera bounds
  bounds: [
    [33.8800, 71.3900], // South-West
    [34.1400, 71.6800], // North-East
  ] as [[number, number], [number, number]],
};

/**
 * Validates if coordinates fall within the supported Peshawar SafarGo operating area
 */
export function isWithinPeshawar(lat: number, lng: number): boolean {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  return (
    lat >= PESHAWAR_SERVICE_AREA.minLat &&
    lat <= PESHAWAR_SERVICE_AREA.maxLat &&
    lng >= PESHAWAR_SERVICE_AREA.minLng &&
    lng <= PESHAWAR_SERVICE_AREA.maxLng
  );
}

export const SERVICE_AREA_NOTICE = 'SafarGo is currently available in Peshawar only.';

export const PESHAWAR_LANDMARKS = [
  { id: 'uop', title: 'University of Peshawar', address: 'University Road, Peshawar', lat: 34.0006, lng: 71.4851, category: 'Education' },
  { id: 'islamia', title: 'Islamia College Peshawar', address: 'Grand Trunk Road / University Road, Peshawar', lat: 34.0076, lng: 71.4795, category: 'Education' },
  { id: 'kth', title: 'Khyber Teaching Hospital (KTH)', address: 'University Road, Peshawar', lat: 34.0041, lng: 71.4897, category: 'Hospital' },
  { id: 'hmc', title: 'Hayatabad Medical Complex (HMC)', address: 'Phase 4, Hayatabad, Peshawar', lat: 33.9856, lng: 71.4398, category: 'Hospital' },
  { id: 'saddar', title: 'Saddar Bazaar', address: 'Saddar Road, Peshawar Cantonment', lat: 34.0084, lng: 71.5545, category: 'Market' },
  { id: 'hayatabad_p3', title: 'Hayatabad Phase 3', address: 'Tatara Park Road, Hayatabad, Peshawar', lat: 33.9892, lng: 71.4367, category: 'Neighborhood' },
  { id: 'hayatabad_p5', title: 'Hayatabad Phase 5', address: 'Phase 5 Commercial Area, Hayatabad, Peshawar', lat: 33.9781, lng: 71.4285, category: 'Neighborhood' },
  { id: 'airport', title: 'Bacha Khan International Airport', address: 'Civil Lines, Peshawar', lat: 33.9939, lng: 71.5147, category: 'Airport' },
  { id: 'deans', title: 'Deans Trade Center', address: 'Saddar, Peshawar Cantt', lat: 34.0091, lng: 71.5492, category: 'Shopping' },
  { id: 'qissa_khwani', title: 'Qissa Khwani Bazaar', address: 'Old City, Peshawar', lat: 34.0125, lng: 71.5714, category: 'Heritage' },
  { id: 'karkhano', title: 'Karkhano Market', address: 'Jamrud Road, Peshawar', lat: 33.9982, lng: 71.4112, category: 'Market' },
  { id: 'shahi_bagh', title: 'Shahi Bagh', address: 'Faqirabad, Peshawar', lat: 34.0268, lng: 71.5732, category: 'Park' },
];
