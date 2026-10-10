/**
 * SafarGo - Production Location, Geocoding, Routing & Service Area Routes
 * Serving Peshawar Metropolitan Area, Khyber Pakhtunkhwa, Pakistan
 */

import express from 'express';
import { savedPlaceDB } from '../db.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

// -------------------------------------------------------------
// PESHAWAR SERVICE AREA CONFIGURATION
// -------------------------------------------------------------
export const PESHAWAR_BOUNDS = {
  minLat: 33.8800, // Ring Road South / Kohat Road border
  maxLat: 34.1400, // Warsak Road / Charsadda Road junction
  minLng: 71.3900, // Karkhano Market / Khyber Agency border
  maxLng: 71.6800, // Chamkani / GT Road Peshawar Interchange
  centerLat: 34.0151,
  centerLng: 71.5249,
};

export function isWithinPeshawarServiceArea(lat, lng) {
  if (typeof lat !== 'number' || typeof lng !== 'number') return false;
  return (
    lat >= PESHAWAR_BOUNDS.minLat &&
    lat <= PESHAWAR_BOUNDS.maxLat &&
    lng >= PESHAWAR_BOUNDS.minLng &&
    lng <= PESHAWAR_BOUNDS.maxLng
  );
}

// -------------------------------------------------------------
// VERIFIED PESHAWAR LOCAL PLACES DIRECTORY (60+ REAL PLACES ACROSS 8 CATEGORIES)
// -------------------------------------------------------------
export const PESHAWAR_DIRECTORY = [
  // 1. NEIGHBORHOODS & LOCALITIES
  { id: 'nbr_hayatabad_p1', name: 'Hayatabad Phase 1', address: 'Phase 1, Hayatabad, Peshawar', lat: 33.9961, lng: 71.4582, category: 'Neighborhood' },
  { id: 'nbr_hayatabad_p2', name: 'Hayatabad Phase 2', address: 'Bagh-e-Naran Road, Phase 2, Hayatabad, Peshawar', lat: 33.9922, lng: 71.4491, category: 'Neighborhood' },
  { id: 'nbr_hayatabad_p3', name: 'Hayatabad Phase 3', address: 'Tatara Park Road, Phase 3, Hayatabad, Peshawar', lat: 33.9892, lng: 71.4367, category: 'Neighborhood' },
  { id: 'nbr_hayatabad_p4', name: 'Hayatabad Phase 4', address: 'HMC Road, Phase 4, Hayatabad, Peshawar', lat: 33.9856, lng: 71.4336, category: 'Neighborhood' },
  { id: 'nbr_hayatabad_p5', name: 'Hayatabad Phase 5', address: 'Commercial Area, Phase 5, Hayatabad, Peshawar', lat: 33.9781, lng: 71.4285, category: 'Neighborhood' },
  { id: 'nbr_hayatabad_p6', name: 'Hayatabad Phase 6', address: 'Phase 6, Hayatabad, Peshawar', lat: 33.9740, lng: 71.4210, category: 'Neighborhood' },
  { id: 'nbr_hayatabad_p7', name: 'Hayatabad Phase 7', address: 'Phase 7, Hayatabad, Peshawar', lat: 33.9685, lng: 71.4150, category: 'Neighborhood' },
  { id: 'nbr_utown', name: 'University Town', address: 'Park Avenue, University Town, Peshawar', lat: 34.0042, lng: 71.5034, category: 'Neighborhood' },
  { id: 'nbr_saddar_cantt', name: 'Saddar Cantonment', address: 'Saddar Road, Peshawar Cantonment, Peshawar', lat: 34.0086, lng: 71.5367, category: 'Neighborhood' },
  { id: 'nbr_gulbahar', name: 'Gulbahar Colony', address: 'Gulbahar No. 1, Grand Trunk Road, Peshawar', lat: 34.0135, lng: 71.5892, category: 'Neighborhood' },
  { id: 'nbr_tehkal_bala', name: 'Tehkal Bala', address: 'Jamrud Road, Tehkal Bala, Peshawar', lat: 34.0012, lng: 71.4985, category: 'Neighborhood' },
  { id: 'nbr_tehkal_payan', name: 'Tehkal Payan', address: 'University Road, Tehkal, Peshawar', lat: 34.0028, lng: 71.5082, category: 'Neighborhood' },
  { id: 'nbr_chamkani', name: 'Chamkani Town', address: 'GT Road, Chamkani, Peshawar', lat: 34.0112, lng: 71.6425, category: 'Neighborhood' },
  { id: 'nbr_regi', name: 'Regi Model Town', address: 'Nasir Bagh Road, Regi Model Town, Peshawar', lat: 34.0450, lng: 71.4320, category: 'Neighborhood' },
  { id: 'nbr_palosi', name: 'Palosi', address: 'Palosi Road, Agricultural University, Peshawar', lat: 34.0210, lng: 71.4780, category: 'Neighborhood' },
  { id: 'nbr_nauthia', name: 'Nauthia Jadeed', address: 'Near Railway Line, Nauthia, Peshawar Cantt', lat: 33.9985, lng: 71.5420, category: 'Neighborhood' },
  { id: 'nbr_landi_arbab', name: 'Landi Arbab', address: 'Kohat Road, Landi Arbab, Peshawar', lat: 33.9750, lng: 71.5620, category: 'Neighborhood' },

  // 2. STREETS & MAIN ROADS
  { id: 'rd_univ_rd', name: 'University Road', address: 'University Road, Peshawar', lat: 34.0035, lng: 71.5120, category: 'Road' },
  { id: 'rd_gt_rd', name: 'Grand Trunk (GT) Road', address: 'Grand Trunk Road, Peshawar', lat: 34.0142, lng: 71.5950, category: 'Road' },
  { id: 'rd_ring_rd', name: 'Ring Road Peshawar', address: 'Southern Ring Road Bypass, Peshawar', lat: 33.9820, lng: 71.5540, category: 'Road' },
  { id: 'rd_jamrud_rd', name: 'Jamrud Road', address: 'Jamrud Road, Peshawar', lat: 33.9980, lng: 71.4650, category: 'Road' },
  { id: 'rd_khyber_rd', name: 'Khyber Road', address: 'Khyber Road, Peshawar Cantonment', lat: 34.0150, lng: 71.5450, category: 'Road' },
  { id: 'rd_warsak_rd', name: 'Warsak Road', address: 'Warsak Road, Peshawar', lat: 34.0321, lng: 71.5204, category: 'Road' },
  { id: 'rd_charsadda_rd', name: 'Charsadda Road', address: 'Charsadda Road, Faqirabad, Peshawar', lat: 34.0350, lng: 71.5850, category: 'Road' },
  { id: 'rd_mall_rd', name: 'The Mall Road', address: 'The Mall, Peshawar Cantonment, Peshawar', lat: 34.0070, lng: 71.5380, category: 'Road' },
  { id: 'rd_dalazak_rd', name: 'Dalazak Road', address: 'Dalazak Road, Peshawar', lat: 34.0280, lng: 71.6150, category: 'Road' },
  { id: 'rd_kohat_rd', name: 'Kohat Road', address: 'Kohat Road, Peshawar', lat: 33.9650, lng: 71.5580, category: 'Road' },

  // 3. HOSPITALS & MEDICAL FACILITIES
  { id: 'hosp_lrh', name: 'Lady Reading Hospital (LRH)', address: 'Soekarno Square, Old City, Peshawar', lat: 34.0128, lng: 71.5724, category: 'Hospital' },
  { id: 'hosp_kth', name: 'Khyber Teaching Hospital (KTH)', address: 'University Road, Peshawar', lat: 34.0003, lng: 71.4925, category: 'Hospital' },
  { id: 'hosp_hmc', name: 'Hayatabad Medical Complex (HMC)', address: 'Phase 4, Hayatabad, Peshawar', lat: 33.9822, lng: 71.4421, category: 'Hospital' },
  { id: 'hosp_northwest', name: 'Northwest General Hospital', address: 'Sector A-3, Phase 5, Hayatabad, Peshawar', lat: 33.9785, lng: 71.4312, category: 'Hospital' },
  { id: 'hosp_rmi', name: 'Rehman Medical Institute (RMI)', address: '5/B-2, Phase 5, Hayatabad, Peshawar', lat: 33.9768, lng: 71.4294, category: 'Hospital' },
  { id: 'hosp_pic', name: 'Peshawar Institute of Cardiology (PIC)', address: 'Phase 5, Hayatabad, Peshawar', lat: 33.9752, lng: 71.4268, category: 'Hospital' },
  { id: 'hosp_alkhidmat', name: 'Al-Khidmat Hospital', address: 'Nishtarabad, GT Road, Peshawar', lat: 34.0162, lng: 71.5834, category: 'Hospital' },
  { id: 'hosp_cantt_gen', name: 'Cantonment General Hospital', address: 'Hospital Road, Peshawar Cantonment', lat: 34.0094, lng: 71.5420, category: 'Hospital' },
  { id: 'hosp_shaukat', name: 'Shaukat Khanum Cancer Hospital', address: 'Plot 5-B, Sector A-2, Phase 5, Hayatabad', lat: 33.9798, lng: 71.4340, category: 'Hospital' },

  // 4. UNIVERSITIES & COLLEGES
  { id: 'edu_uop', name: 'University of Peshawar (UOP)', address: 'University Road, University Campus, Peshawar', lat: 33.9984, lng: 71.4827, category: 'Education' },
  { id: 'edu_islamia', name: 'Islamia College Peshawar', address: 'Jamrud Road, University Campus, Peshawar', lat: 33.9996, lng: 71.4883, category: 'Education' },
  { id: 'edu_uet', name: 'UET Peshawar', address: 'University Road, Peshawar', lat: 34.0018, lng: 71.4942, category: 'Education' },
  { id: 'edu_kmu', name: 'Khyber Medical University (KMU)', address: 'Phase 5, Hayatabad, Peshawar', lat: 33.9772, lng: 71.4302, category: 'Education' },
  { id: 'edu_imsciences', name: 'Institute of Management Sciences (IM|Sciences)', address: '1-A, Sector E-5, Phase 7, Hayatabad, Peshawar', lat: 33.9675, lng: 71.4172, category: 'Education' },
  { id: 'edu_cecos', name: 'CECOS University', address: 'Sector F-5, Phase 6, Hayatabad, Peshawar', lat: 33.9715, lng: 71.4230, category: 'Education' },
  { id: 'edu_edwardes', name: 'Edwardes College Peshawar', address: 'The Mall, Peshawar Cantonment, Peshawar', lat: 34.0062, lng: 71.5398, category: 'Education' },
  { id: 'edu_agri', name: 'Agriculture University Peshawar', address: 'Palosi Road, University Campus, Peshawar', lat: 34.0190, lng: 71.4815, category: 'Education' },
  { id: 'edu_fast', name: 'FAST-NUCES Peshawar Campus', address: 'Industrial Estate, Hayatabad, Peshawar', lat: 33.9845, lng: 71.4190, category: 'Education' },
  { id: 'edu_pps', name: 'Peshawar Public School & College', address: 'Warsak Road, Peshawar', lat: 34.0380, lng: 71.5240, category: 'Education' },

  // 5. MARKETS & COMMERCIAL SHOPPING
  { id: 'mkt_saddar', name: 'Saddar Bazaar', address: 'Saddar Road, Peshawar Cantonment, Peshawar', lat: 34.0084, lng: 71.5545, category: 'Market' },
  { id: 'mkt_karkhano', name: 'Karkhano Markets', address: 'Jamrud Road, Industrial Estate, Peshawar', lat: 33.9882, lng: 71.4116, category: 'Market' },
  { id: 'mkt_deans', name: 'Deans Trade Center', address: 'Saddar Road, Peshawar Cantt, Peshawar', lat: 34.0048, lng: 71.5385, category: 'Market' },
  { id: 'mkt_qissa_khwani', name: 'Qissa Khwani Bazaar', address: 'Old City, Heritage Trail, Peshawar', lat: 34.0105, lng: 71.5694, category: 'Market' },
  { id: 'mkt_shaheen', name: 'Shaheen Chemist & Supermarket', address: 'University Road & Saddar, Peshawar', lat: 34.0055, lng: 71.5180, category: 'Market' },
  { id: 'mkt_city_towers', name: 'City Towers & Shopping Mall', address: 'University Road, Jahangirabad, Peshawar', lat: 34.0040, lng: 71.5140, category: 'Market' },
  { id: 'mkt_mega_mart', name: 'Mega Mart Peshawar', address: 'University Road, Peshawar', lat: 34.0032, lng: 71.5105, category: 'Market' },
  { id: 'mkt_hyper_mall', name: 'Hyper Mall Hayatabad', address: 'Phase 3 Commercial, Hayatabad, Peshawar', lat: 33.9885, lng: 71.4390, category: 'Market' },
  { id: 'mkt_board_bazaar', name: 'Board Bazaar', address: 'Jamrud Road, Peshawar', lat: 33.9972, lng: 71.4721, category: 'Market' },
  { id: 'mkt_mobile', name: 'Peshawar Mobile Market', address: 'Saddar Road, Peshawar Cantt', lat: 34.0078, lng: 71.5412, category: 'Market' },

  // 6. PARKS & HERITAGE LANDMARKS
  { id: 'park_tatara', name: 'Tatara Park', address: 'Phase 4, Hayatabad, Peshawar', lat: 33.9875, lng: 71.4350, category: 'Park' },
  { id: 'park_bagh_naran', name: 'Bagh-e-Naran', address: 'Phase 2, Hayatabad, Peshawar', lat: 33.9915, lng: 71.4480, category: 'Park' },
  { id: 'park_shahi_bagh', name: 'Shahi Bagh', address: 'Shahi Bagh Road, Faqirabad, Peshawar', lat: 34.0267, lng: 71.5732, category: 'Park' },
  { id: 'lmk_bala_hissar', name: 'Bala Hissar Fort', address: 'Grand Trunk Road, Peshawar', lat: 34.0153, lng: 71.5714, category: 'Landmark' },
  { id: 'lmk_museum', name: 'Peshawar Museum', address: 'Saddar Road / The Mall, Peshawar Cantt', lat: 34.0075, lng: 71.5510, category: 'Landmark' },
  { id: 'lmk_clock_tower', name: 'Cunningham Clock Tower (Ghanta Ghar)', address: 'Heritage Trail, Old City, Peshawar', lat: 34.0118, lng: 71.5772, category: 'Landmark' },
  { id: 'park_wazir_bagh', name: 'Wazir Bagh', address: 'Old City, Peshawar', lat: 34.0020, lng: 71.5780, category: 'Park' },
  { id: 'park_garrison', name: 'Garrison Park', address: 'Peshawar Cantonment, Peshawar', lat: 34.0130, lng: 71.5340, category: 'Park' },
  { id: 'lmk_army_stadium', name: 'Army Stadium & Food Street', address: 'Stadium Road, Peshawar Cantt', lat: 34.0050, lng: 71.5450, category: 'Landmark' },
  { id: 'lmk_sethi_house', name: 'Sethi House Heritage Complex', address: 'Mohallah Sethian, Old City, Peshawar', lat: 34.0110, lng: 71.5745, category: 'Landmark' },

  // 7. HOTELS & DINING
  { id: 'htl_pc', name: 'Pearl Continental (PC) Hotel', address: 'Khyber Road, Peshawar Cantonment', lat: 34.0140, lng: 71.5460, category: 'Hotel' },
  { id: 'htl_serena', name: 'Peshawar Serena Hotel', address: 'Khyber Road, Peshawar Cantonment', lat: 34.0160, lng: 71.5480, category: 'Hotel' },
  { id: 'rst_habibi', name: 'Habibi Restaurant', address: 'Phase 3, Hayatabad & Cantt, Peshawar', lat: 33.9890, lng: 71.4375, category: 'Restaurant' },
  { id: 'rst_usmania', name: 'Usmania Restaurant', address: 'University Road, Jahangirabad, Peshawar', lat: 34.0038, lng: 71.5130, category: 'Restaurant' },
  { id: 'rst_shiraz', name: 'Shiraz Rawayat Restaurant', address: 'University Road, Peshawar', lat: 34.0025, lng: 71.5090, category: 'Restaurant' },
  { id: 'rst_namak_mandi', name: 'Namak Mandi Food Street', address: 'Namak Mandi, Old City, Peshawar', lat: 34.0085, lng: 71.5710, category: 'Restaurant' },
  { id: 'rst_chief', name: 'Chief Grillers', address: 'University Road, University Town, Peshawar', lat: 34.0045, lng: 71.5160, category: 'Restaurant' },
  { id: 'rst_kfc', name: 'KFC University Road', address: 'Near Abdara Chowk, University Road, Peshawar', lat: 34.0035, lng: 71.5115, category: 'Restaurant' },
  { id: 'rst_mcdonalds', name: 'McDonald\'s Peshawar', address: 'The Mall, Peshawar Cantonment', lat: 34.0068, lng: 71.5390, category: 'Restaurant' },

  // 8. TRANSPORT HUBS & AIRPORTS
  { id: 'trn_airport', name: 'Bacha Khan International Airport', address: 'Airport Road, Civil Quarters, Peshawar', lat: 33.9940, lng: 71.5146, category: 'Transport' },
  { id: 'trn_railway', name: 'Peshawar Cantt Railway Station', address: 'Station Road, Peshawar Cantonment', lat: 34.0076, lng: 71.5342, category: 'Transport' },
  { id: 'trn_haji_camp', name: 'General Bus Stand (Haji Camp)', address: 'GT Road, Haji Camp, Peshawar', lat: 34.0205, lng: 71.6030, category: 'Transport' },
  { id: 'trn_daewoo', name: 'Daewoo Express Terminal', address: 'Amjad Shaheed Road, Peshawar', lat: 34.0180, lng: 71.5870, category: 'Transport' },
  { id: 'trn_brt_saddar', name: 'BRT Saddar Central Station', address: 'Saddar Road, Peshawar Cantt', lat: 34.0080, lng: 71.5430, category: 'Transport' },
  { id: 'trn_brt_karkhano', name: 'BRT Karkhano Terminal', address: 'Jamrud Road, Karkhano, Peshawar', lat: 33.9890, lng: 71.4120, category: 'Transport' },
];

// Helper: Haversine distance in km
function calculateHaversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * (Math.PI / 180);
  const dLon = (lon2 - lon1) * (Math.PI / 180);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * (Math.PI / 180)) * Math.cos(lat2 * (Math.PI / 180)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return Math.round(R * c * 10) / 10;
}

// -------------------------------------------------------------
// 0. GET SERVICE AREA BOUNDS
// -------------------------------------------------------------
router.get('/service-area', (req, res) => {
  res.json({
    supportedCity: 'Peshawar',
    serviceBounds: PESHAWAR_BOUNDS,
    center: {
      lat: PESHAWAR_BOUNDS.centerLat,
      lng: PESHAWAR_BOUNDS.centerLng,
      name: 'Saddar, Peshawar',
      address: 'Saddar Road, Peshawar Cantonment, Khyber Pakhtunkhwa',
    },
    message: 'SafarGo is currently available in Peshawar only.',
    categories: ['Neighborhood', 'Road', 'Hospital', 'Education', 'Market', 'Park', 'Landmark', 'Hotel', 'Restaurant', 'Transport'],
  });
});

// -------------------------------------------------------------
// 1. PLACE SEARCH & AUTOCOMPLETE (MULTI-TIER ENGINE)
// -------------------------------------------------------------
router.get('/search', async (req, res) => {
  const query = String(req.query.q || '').trim();
  const categoryFilter = String(req.query.category || '').trim().toLowerCase();
  const userLat = parseFloat(req.query.userLat || req.query.lat);
  const userLng = parseFloat(req.query.userLng || req.query.lng);

  if (!query || query.length < 2) {
    return res.json({ results: [], places: [] });
  }

  const queryLower = query.toLowerCase();

  // 1. Filter and score from curated Peshawar directory
  const localMatches = PESHAWAR_DIRECTORY.filter((place) => {
    if (categoryFilter && categoryFilter !== 'all') {
      if (place.category.toLowerCase() !== categoryFilter) return false;
    }
    const nameMatch = place.name.toLowerCase().includes(queryLower);
    const addrMatch = place.address.toLowerCase().includes(queryLower);
    const catMatch = place.category.toLowerCase().includes(queryLower);
    return nameMatch || addrMatch || catMatch;
  }).map((place) => {
    let distanceKm = undefined;
    if (!isNaN(userLat) && !isNaN(userLng)) {
      distanceKm = calculateHaversineKm(userLat, userLng, place.lat, place.lng);
    }
    return {
      id: place.id,
      name: place.name,
      title: place.name,
      address: place.address,
      lat: place.lat,
      lng: place.lng,
      category: place.category,
      city: 'Peshawar',
      distanceKm,
      isWithinServiceArea: true,
      source: 'verified_directory',
    };
  });

  // Sort local matches by exact prefix match, then distance
  localMatches.sort((a, b) => {
    const aStartsWith = a.title.toLowerCase().startsWith(queryLower);
    const bStartsWith = b.title.toLowerCase().startsWith(queryLower);
    if (aStartsWith && !bStartsWith) return -1;
    if (!aStartsWith && bStartsWith) return 1;
    if (a.distanceKm != null && b.distanceKm != null) return a.distanceKm - b.distanceKm;
    return 0;
  });

  // If we found 5 or more local verified matches, return them immediately
  if (localMatches.length >= 5) {
    const topLocal = localMatches.slice(0, 10);
    return res.json({ results: topLocal, places: topLocal });
  }

  // 2. Query external geocoding providers bounded strictly to Peshawar
  let externalMatches = [];
  const googleApiKey = process.env.GOOGLE_MAPS_API_KEY || 'AIzaSyAOVYRIgupAurZup5y1PRh8Ismb1A3lLao';

  // Attempt Google Geocoding bounded strictly to Peshawar, Pakistan
  if (googleApiKey) {
    try {
      const gUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(query + ' Peshawar')}&bounds=${PESHAWAR_BOUNDS.minLat},${PESHAWAR_BOUNDS.minLng}|${PESHAWAR_BOUNDS.maxLat},${PESHAWAR_BOUNDS.maxLng}&components=country:PK&key=${googleApiKey}`;
      const gResp = await fetch(gUrl, { signal: AbortSignal.timeout(2000) });
      if (gResp.ok) {
        const gData = await gResp.json();
        if (gData.status === 'OK' && Array.isArray(gData.results)) {
          const gMatches = gData.results
            .filter((r) => {
              const lat = r.geometry?.location?.lat;
              const lng = r.geometry?.location?.lng;
              return isWithinPeshawarServiceArea(lat, lng);
            })
            .map((r) => {
              const lat = r.geometry.location.lat;
              const lng = r.geometry.location.lng;
              const name = r.address_components?.[0]?.long_name || r.formatted_address.split(',')[0];
              let distanceKm = undefined;
              if (!isNaN(userLat) && !isNaN(userLng)) {
                distanceKm = calculateHaversineKm(userLat, userLng, lat, lng);
              }
              return {
                id: `g_${r.place_id}`,
                name,
                title: name,
                address: r.formatted_address,
                lat,
                lng,
                category: 'Google Place',
                city: 'Peshawar',
                distanceKm,
                isWithinServiceArea: true,
                source: 'google_maps',
              };
            });
          externalMatches.push(...gMatches);
        }
      }
    } catch {
      // Fall through to Photon
    }
  }

  try {
    // Attempt Photon (OpenStreetMap Elasticsearch by Komoot - fast, reliable, rate-limit tolerant)
    const photonUrl = `https://photon.komoot.io/api/?q=${encodeURIComponent(query + ' Peshawar')}&bbox=${PESHAWAR_BOUNDS.minLng},${PESHAWAR_BOUNDS.minLat},${PESHAWAR_BOUNDS.maxLng},${PESHAWAR_BOUNDS.maxLat}&limit=6`;
    const resp = await fetch(photonUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(2400),
    });

    if (resp.ok) {
      const data = await resp.json();
      if (Array.isArray(data?.features)) {
        externalMatches = data.features
          .filter((f) => {
            const [lng, lat] = f.geometry?.coordinates || [];
            return isWithinPeshawarServiceArea(lat, lng);
          })
          .map((f) => {
            const [lng, lat] = f.geometry.coordinates;
            const props = f.properties || {};
            const title = props.name || props.street || query;
            const parts = [title, props.city || 'Peshawar', props.state || 'Khyber Pakhtunkhwa'].filter(Boolean);
            let distanceKm = undefined;
            if (!isNaN(userLat) && !isNaN(userLng)) {
              distanceKm = calculateHaversineKm(userLat, userLng, lat, lng);
            }
            return {
              id: `ext_${props.osm_id || Math.random().toString(36).substring(2, 8)}`,
              name: title,
              title,
              address: parts.join(', '),
              lat,
              lng,
              category: props.osm_value || 'Location',
              city: 'Peshawar',
              distanceKm,
              isWithinServiceArea: true,
              source: 'osm_photon',
            };
          });
      }
    }
  } catch (err) {
    // Suppress external network timeout; fall through to local results
  }

  // Combine local and external matches without duplicates
  const seenNames = new Set(localMatches.map((m) => m.title.toLowerCase()));
  const combined = [...localMatches];

  for (const ext of externalMatches) {
    const key = ext.title.toLowerCase();
    if (!seenNames.has(key)) {
      seenNames.add(key);
      combined.push(ext);
    }
  }

  const finalResults = combined.slice(0, 10);
  return res.json({ results: finalResults, places: finalResults });
});

// -------------------------------------------------------------
// 2. REVERSE GEOCODING (LAT/LNG -> HUMAN-READABLE PESHAWAR ADDRESS)
// -------------------------------------------------------------
router.get('/reverse', async (req, res) => {
  const lat = parseFloat(req.query.lat);
  const lng = parseFloat(req.query.lng);

  if (isNaN(lat) || isNaN(lng)) {
    return res.status(400).json({ error: 'Valid lat and lng query params are required.' });
  }

  const isPsh = isWithinPeshawarServiceArea(lat, lng);

  // Find closest verified place from directory
  let closestPlace = null;
  let minDistance = Infinity;
  for (const place of PESHAWAR_DIRECTORY) {
    const dist = calculateHaversineKm(lat, lng, place.lat, place.lng);
    if (dist < minDistance) {
      minDistance = dist;
      closestPlace = place;
    }
  }

  // If within 350 meters of a known landmark, use it directly
  if (closestPlace && minDistance <= 0.35) {
    return res.json({
      address: closestPlace.address,
      name: closestPlace.name,
      city: 'Peshawar',
      category: closestPlace.category,
      lat,
      lng,
      isWithinServiceArea: isPsh,
      distanceToLandmarkKm: minDistance,
    });
  }

  // Attempt Google Reverse Geocoding bounded to Peshawar, Pakistan
  if (googleApiKey && isPsh) {
    try {
      const gRevUrl = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&components=country:PK&key=${googleApiKey}`;
      const gResp = await fetch(gRevUrl, { signal: AbortSignal.timeout(2000) });
      if (gResp.ok) {
        const gData = await gResp.json();
        if (gData.status === 'OK' && gData.results?.[0]) {
          const res0 = gData.results[0];
          const name = res0.address_components?.[0]?.long_name || res0.formatted_address.split(',')[0];
          return res.json({
            address: res0.formatted_address,
            name,
            city: 'Peshawar',
            lat,
            lng,
            isWithinServiceArea: true,
            source: 'google_maps',
          });
        }
      }
    } catch {}
  }

  // Query Photon reverse geocoder
  try {
    const photonUrl = `https://photon.komoot.io/reverse?lat=${lat}&lon=${lng}`;
    const resp = await fetch(photonUrl, {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(2400),
    });

    if (resp.ok) {
      const data = await resp.json();
      const feature = data?.features?.[0];
      if (feature) {
        const props = feature.properties || {};
        const road = props.street || props.name;
        const district = props.district || props.suburb || closestPlace?.name || 'Peshawar';
        const address = road
          ? `${road}, ${district}, Peshawar`
          : `${district}, Peshawar, Khyber Pakhtunkhwa`;

        return res.json({
          address,
          name: road || district,
          city: 'Peshawar',
          lat,
          lng,
          isWithinServiceArea: isPsh,
        });
      }
    }
  } catch {
    // Suppress external timeout; use smart fallback
  }

  // Smart fallback using closest landmark reference
  const nearbyRef = closestPlace ? `near ${closestPlace.name}, ` : '';
  const fallbackAddress = isPsh
    ? `${nearbyRef}Peshawar, Khyber Pakhtunkhwa (${lat.toFixed(4)}, ${lng.toFixed(4)})`
    : `Outside Peshawar Service Area (${lat.toFixed(4)}, ${lng.toFixed(4)})`;

  return res.json({
    address: fallbackAddress,
    name: closestPlace?.name || (isPsh ? 'Peshawar Location' : 'Selected Pin'),
    city: 'Peshawar',
    lat,
    lng,
    isWithinServiceArea: isPsh,
  });
});

// -------------------------------------------------------------
// 3. REAL ROAD ROUTING (DISTANCE, ETA, & ROAD POLYLINE)
// -------------------------------------------------------------
const handleRouteCalculation = async (req, res) => {
  const pLatRaw = req.body?.pickupLat ?? req.body?.fromLat ?? req.query?.pickupLat ?? req.query?.fromLat;
  const pLngRaw = req.body?.pickupLng ?? req.body?.fromLng ?? req.query?.pickupLng ?? req.query?.fromLng;
  const dLatRaw = req.body?.destLat ?? req.body?.toLat ?? req.query?.destLat ?? req.query?.toLat;
  const dLngRaw = req.body?.destLng ?? req.body?.toLng ?? req.query?.destLng ?? req.query?.toLng;

  if (pLatRaw == null || pLngRaw == null || dLatRaw == null || dLngRaw == null) {
    return res.status(400).json({ error: 'Pickup and destination coordinates are required.' });
  }

  const pLat = Number(pLatRaw);
  const pLng = Number(pLngRaw);
  const dLat = Number(dLatRaw);
  const dLng = Number(dLngRaw);

  const isPickupInPsh = isWithinPeshawarServiceArea(pLat, pLng);
  const isDestInPsh = isWithinPeshawarServiceArea(dLat, dLng);

  if (!isPickupInPsh || !isDestInPsh) {
    return res.status(400).json({
      error: 'Both pickup and destination must be within the supported Peshawar service area.',
      serviceAreaNotice: 'SafarGo is currently available in Peshawar only.',
    });
  }

  try {
    // Query OSRM public car driving router
    const osrmUrl = `https://router.project-osrm.org/route/v1/driving/${pLng},${pLat};${dLng},${dLat}?overview=full&geometries=geojson`;
    const resp = await fetch(osrmUrl, { signal: AbortSignal.timeout(3200) });

    if (resp.ok) {
      const data = await resp.json();
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const distanceKm = Math.round((route.distance / 1000) * 10) / 10;
        // In dense Peshawar traffic, minimum speed is ~22 km/h
        const durationMins = Math.max(3, Math.round(route.duration / 60));
        const coordinates = route.geometry?.coordinates?.map(([lng, lat]) => ({ lat, lng })) || [];

        return res.json({
          success: true,
          distanceKm: Math.max(0.6, distanceKm),
          durationMins,
          coordinates,
          provider: 'osrm_road_network',
        });
      }
    }
  } catch (err) {
    // Suppress external network errors; fall back to calibrated road path
  }

  // Calibrated urban road factor: 1.28x direct distance
  const straightKm = calculateHaversineKm(pLat, pLng, dLat, dLng);
  const roadKm = Math.max(0.8, Math.round(straightKm * 1.28 * 10) / 10);
  const durationMins = Math.max(3, Math.round(roadKm * 2.7 + 2)); // Average 22 km/h city driving

  // Generate intermediate points along path
  const points = [];
  const steps = 14;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const bend = Math.sin(t * Math.PI) * 0.003;
    points.push({
      lat: pLat + (dLat - pLat) * t + bend,
      lng: pLng + (dLng - pLng) * t - bend,
    });
  }

  return res.json({
    success: true,
    distanceKm: roadKm,
    durationMins,
    coordinates: points,
    provider: 'calibrated_city_route',
  });
};

router.post('/route', handleRouteCalculation);
router.get('/route', handleRouteCalculation);

// -------------------------------------------------------------
// 4. SAVED PLACES (HOME, WORK, FAVORITES)
// -------------------------------------------------------------
router.get('/saved', requireAuth, (req, res) => {
  const places = savedPlaceDB.findByUserId(req.user.id);
  res.json({ places });
});

router.post('/saved', requireAuth, (req, res) => {
  const { label, address, lat, lng } = req.body;
  if (!label || !address || lat == null || lng == null) {
    return res.status(400).json({ error: 'Label, address, lat, and lng are required.' });
  }

  const newPlace = savedPlaceDB.create({
    id: `plc_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
    userId: req.user.id,
    label: String(label).trim(),
    address: String(address).trim(),
    lat: Number(lat),
    lng: Number(lng),
    createdAt: new Date().toISOString(),
  });

  res.json({ success: true, place: newPlace });
});

router.delete('/saved/:id', requireAuth, (req, res) => {
  savedPlaceDB.delete(req.params.id, req.user.id);
  res.json({ success: true });
});

export default router;
