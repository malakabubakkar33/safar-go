/**
 * SafarGo - Service Area & Geofence Service
 * Authoritative Peshawar Metropolitan Service Area boundaries & validation rules.
 */

export interface BoundingBox {
  minLat: number;
  maxLat: number;
  minLng: number;
  maxLng: number;
}

export interface Landmark {
  id: string;
  title: string;
  address: string;
  lat: number;
  lng: number;
  category: 'Neighborhood' | 'Road' | 'Hospital' | 'Education' | 'Market' | 'Park' | 'Landmark' | 'Hotel' | 'Restaurant' | 'Transport';
}

export const PESHAWAR_SERVICE_BOUNDS: BoundingBox = {
  minLat: 33.8800, // South: Southern Ring Road / Kohat Road
  maxLat: 34.1400, // North: Warsak Road / Charsadda Road junction
  minLng: 71.3900, // West: Karkhano Market / Khyber Agency border
  maxLng: 71.6800, // East: Chamkani / GT Road Peshawar Interchange
};

export const PESHAWAR_CENTER = {
  lat: 34.0151,
  lng: 71.5249,
  name: 'Saddar, Peshawar',
  address: 'Saddar Road, Peshawar Cantonment, Khyber Pakhtunkhwa',
  city: 'Peshawar',
};

export const PESHAWAR_MAP_CAMERA = {
  defaultZoom: 14,
  minZoom: 12,
  maxZoom: 18,
  bounds: [
    [33.8800, 71.3900], // South-West
    [34.1400, 71.6800], // North-East
  ] as [[number, number], [number, number]],
};

export const SERVICE_AREA_NOTICE = 'SafarGo is currently available in Peshawar only.';

export const VERIFIED_PESHAWAR_LANDMARKS: Landmark[] = [
  // Neighborhoods
  { id: 'nbr_hayatabad_p3', title: 'Hayatabad Phase 3', address: 'Tatara Park Road, Phase 3, Hayatabad, Peshawar', lat: 33.9892, lng: 71.4367, category: 'Neighborhood' },
  { id: 'nbr_hayatabad_p5', title: 'Hayatabad Phase 5', address: 'Commercial Area, Phase 5, Hayatabad, Peshawar', lat: 33.9781, lng: 71.4285, category: 'Neighborhood' },
  { id: 'nbr_saddar', title: 'Saddar Cantonment', address: 'Saddar Road, Peshawar Cantonment, Peshawar', lat: 34.0086, lng: 71.5367, category: 'Neighborhood' },
  { id: 'nbr_utown', title: 'University Town', address: 'Park Avenue, University Town, Peshawar', lat: 34.0042, lng: 71.5034, category: 'Neighborhood' },
  { id: 'nbr_gulbahar', title: 'Gulbahar Colony', address: 'Gulbahar No. 1, Grand Trunk Road, Peshawar', lat: 34.0135, lng: 71.5892, category: 'Neighborhood' },
  // Hospitals
  { id: 'hosp_lrh', title: 'Lady Reading Hospital (LRH)', address: 'Soekarno Square, Old City, Peshawar', lat: 34.0128, lng: 71.5724, category: 'Hospital' },
  { id: 'hosp_kth', title: 'Khyber Teaching Hospital (KTH)', address: 'University Road, Peshawar', lat: 34.0003, lng: 71.4925, category: 'Hospital' },
  { id: 'hosp_hmc', title: 'Hayatabad Medical Complex (HMC)', address: 'Phase 4, Hayatabad, Peshawar', lat: 33.9822, lng: 71.4421, category: 'Hospital' },
  { id: 'hosp_northwest', title: 'Northwest General Hospital', address: 'Sector A-3, Phase 5, Hayatabad, Peshawar', lat: 33.9785, lng: 71.4312, category: 'Hospital' },
  { id: 'hosp_rmi', title: 'Rehman Medical Institute (RMI)', address: '5/B-2, Phase 5, Hayatabad, Peshawar', lat: 33.9768, lng: 71.4294, category: 'Hospital' },
  // Education
  { id: 'edu_uop', title: 'University of Peshawar (UOP)', address: 'University Road, University Campus, Peshawar', lat: 33.9984, lng: 71.4827, category: 'Education' },
  { id: 'edu_islamia', title: 'Islamia College Peshawar', address: 'Jamrud Road, University Campus, Peshawar', lat: 33.9996, lng: 71.4883, category: 'Education' },
  { id: 'edu_uet', title: 'UET Peshawar', address: 'University Road, Peshawar', lat: 34.0018, lng: 71.4942, category: 'Education' },
  { id: 'edu_imsciences', title: 'IM|Sciences', address: '1-A, Sector E-5, Phase 7, Hayatabad, Peshawar', lat: 33.9675, lng: 71.4172, category: 'Education' },
  { id: 'edu_cecos', title: 'CECOS University', address: 'Sector F-5, Phase 6, Hayatabad, Peshawar', lat: 33.9715, lng: 71.4230, category: 'Education' },
  // Markets
  { id: 'mkt_saddar', title: 'Saddar Bazaar', address: 'Saddar Road, Peshawar Cantonment, Peshawar', lat: 34.0084, lng: 71.5545, category: 'Market' },
  { id: 'mkt_karkhano', title: 'Karkhano Markets', address: 'Jamrud Road, Industrial Estate, Peshawar', lat: 33.9882, lng: 71.4116, category: 'Market' },
  { id: 'mkt_deans', title: 'Deans Trade Center', address: 'Saddar Road, Peshawar Cantt, Peshawar', lat: 34.0048, lng: 71.5385, category: 'Market' },
  { id: 'mkt_qissa', title: 'Qissa Khwani Bazaar', address: 'Old City, Heritage Trail, Peshawar', lat: 34.0105, lng: 71.5694, category: 'Market' },
  // Parks & Heritage
  { id: 'park_tatara', title: 'Tatara Park', address: 'Phase 4, Hayatabad, Peshawar', lat: 33.9875, lng: 71.4350, category: 'Park' },
  { id: 'park_bagh_naran', title: 'Bagh-e-Naran', address: 'Phase 2, Hayatabad, Peshawar', lat: 33.9915, lng: 71.4480, category: 'Park' },
  { id: 'park_shahi_bagh', title: 'Shahi Bagh', address: 'Shahi Bagh Road, Faqirabad, Peshawar', lat: 34.0267, lng: 71.5732, category: 'Park' },
  { id: 'lmk_bala_hissar', title: 'Bala Hissar Fort', address: 'Grand Trunk Road, Peshawar', lat: 34.0153, lng: 71.5714, category: 'Landmark' },
  { id: 'lmk_museum', title: 'Peshawar Museum', address: 'Saddar Road / The Mall, Peshawar Cantt', lat: 34.0075, lng: 71.5510, category: 'Landmark' },
  // Transport
  { id: 'trn_airport', title: 'Bacha Khan International Airport', address: 'Airport Road, Civil Quarters, Peshawar', lat: 33.9940, lng: 71.5146, category: 'Transport' },
  { id: 'trn_railway', title: 'Peshawar Cantt Railway Station', address: 'Station Road, Peshawar Cantonment', lat: 34.0076, lng: 71.5342, category: 'Transport' },
  { id: 'trn_haji_camp', title: 'General Bus Stand (Haji Camp)', address: 'GT Road, Haji Camp, Peshawar', lat: 34.0205, lng: 71.6030, category: 'Transport' },
  { id: 'trn_daewoo', title: 'Daewoo Express Terminal', address: 'Amjad Shaheed Road, Peshawar', lat: 34.0180, lng: 71.5870, category: 'Transport' },
];

export const ServiceAreaService = {
  isWithinServiceArea(lat: number, lng: number): boolean {
    if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
      return false;
    }
    return (
      lat >= PESHAWAR_SERVICE_BOUNDS.minLat &&
      lat <= PESHAWAR_SERVICE_BOUNDS.maxLat &&
      lng >= PESHAWAR_SERVICE_BOUNDS.minLng &&
      lng <= PESHAWAR_SERVICE_BOUNDS.maxLng
    );
  },

  getServiceBounds(): BoundingBox {
    return PESHAWAR_SERVICE_BOUNDS;
  },

  getCenter() {
    return PESHAWAR_CENTER;
  },

  getCameraConfig() {
    return PESHAWAR_MAP_CAMERA;
  },

  getServiceNotice(): string {
    return SERVICE_AREA_NOTICE;
  },

  getLandmarks(): Landmark[] {
    return VERIFIED_PESHAWAR_LANDMARKS;
  },

  validateRideCoordinates(pickup: { lat: number; lng: number }, dest: { lat: number; lng: number }): {
    isValid: boolean;
    error?: string;
  } {
    if (!this.isWithinServiceArea(pickup.lat, pickup.lng)) {
      return {
        isValid: false,
        error: 'Pickup location is outside our Peshawar operating area.',
      };
    }
    if (!this.isWithinServiceArea(dest.lat, dest.lng)) {
      return {
        isValid: false,
        error: 'Destination is outside our Peshawar operating area.',
      };
    }
    return { isValid: true };
  },
};
