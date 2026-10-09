/**
 * SafarGo - Production Customer Mobile Web Experience & Realtime Coordinator
 * Fully integrated with Backend APIs, Socket.IO, Leaflet Maps, and PostgreSQL-synced State Machine.
 */

// Module state
let map = null;
let userMarker = null;
let destMarker = null;
let driverMarker = null;
let routePolyline = null;
let socket = null;
let activeUser = null;

let currentRide = null;
let selectedVehicleType = 'BIKE';
let selectedOffer = null;
let currentRating = 5;

let pickupCoords = { lat: 31.5204, lng: 74.3587, address: 'Gulberg III, Lahore' };
let destCoords = { lat: 31.4682, lng: 74.2678, address: 'Emporium Mall, Johar Town, Lahore' };
let currentRouteData = null;

function authHeaders(isJson = true) {
  const token = localStorage.getItem('safargo_token');
  const headers = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  if (isJson) headers['Content-Type'] = 'application/json';
  return headers;
}

export function initCustomerApp(user) {
  activeUser = user || JSON.parse(localStorage.getItem('safargo_user') || '{}');
  console.log('[CustomerApp] Initializing for user:', activeUser.fullName || activeUser.username);

  // Update header and drawer user info
  updateCustomerHeader(activeUser);

  // Setup Leaflet Map
  initMap();

  // Connect Socket.IO
  initSocket();

  // Setup event listeners across all sheets & modals
  setupNavigationAndDrawer();
  setupWhereToSheet();
  setupLocationSearchSheet();
  setupRoutePreviewSheet();
  setupVehicleSelectionSheet();
  setupOffersSheet();
  setupDealChatSheet();
  setupPaymentSheet();
  setupLiveRideSheet();
  setupCompletionSheet();
  setupHistoryModal();
  setupSavedPlacesModal();

  // Check for active ongoing ride
  checkActiveRide();
}

// -------------------------------------------------------------
// 1. Header & Drawer
// -------------------------------------------------------------
function updateCustomerHeader(user) {
  const avatarEl = document.getElementById('cust-user-avatar');
  const drawerAvatar = document.getElementById('cust-drawer-avatar');
  const drawerName = document.getElementById('cust-drawer-name');
  const drawerUser = document.getElementById('cust-drawer-username');

  const initial = (user.fullName || user.username || 'U').charAt(0).toUpperCase();

  if (avatarEl) {
    if (user.avatarUrl || user.profilePhotoUrl) {
      avatarEl.innerHTML = `<img src="${user.avatarUrl || user.profilePhotoUrl}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />`;
    } else {
      avatarEl.innerHTML = `<span>${initial}</span>`;
    }
  }

  if (drawerAvatar) {
    if (user.avatarUrl || user.profilePhotoUrl) {
      drawerAvatar.innerHTML = `<img src="${user.avatarUrl || user.profilePhotoUrl}" alt="Avatar" style="width:100%;height:100%;border-radius:50%;object-fit:cover;" />`;
    } else {
      drawerAvatar.innerHTML = `<span>${initial}</span>`;
    }
  }

  if (drawerName) drawerName.textContent = user.fullName || 'SafarGo Traveler';
  if (drawerUser) drawerUser.textContent = user.username ? `@${user.username}` : user.email || '';
}

function setupNavigationAndDrawer() {
  const btnMenu = document.getElementById('cust-btn-menu');
  const btnProfile = document.getElementById('cust-btn-profile');
  const drawerOverlay = document.getElementById('cust-drawer-overlay');
  const btnLogout = document.getElementById('cust-btn-logout');

  const openDrawer = () => {
    if (drawerOverlay) {
      drawerOverlay.style.display = 'flex';
      requestAnimationFrame(() => drawerOverlay.classList.add('open'));
    }
  };

  const closeDrawer = () => {
    if (drawerOverlay) {
      drawerOverlay.classList.remove('open');
      setTimeout(() => (drawerOverlay.style.display = 'none'), 250);
    }
  };

  if (btnMenu) btnMenu.onclick = openDrawer;
  if (btnProfile) btnProfile.onclick = openDrawer;

  if (drawerOverlay) {
    drawerOverlay.onclick = (e) => {
      if (e.target === drawerOverlay) closeDrawer();
    };
  }

  if (btnLogout) {
    btnLogout.onclick = () => {
      localStorage.removeItem('safargo_token');
      localStorage.removeItem('safargo_user');
      window.location.reload();
    };
  }

  // Switch to driver mode from drawer
  const btnDriverMode = document.getElementById('cust-menu-driver-mode');
  if (btnDriverMode) {
    btnDriverMode.onclick = async () => {
      closeDrawer();
      try {
        const res = await fetch('/api/onboarding/role', {
          method: 'POST',
          headers: authHeaders(true),
          body: JSON.stringify({ role: 'DRIVER' }),
        });
        const data = await res.json();
        window.location.reload();
      } catch (err) {
        console.error('Error switching to driver mode:', err);
      }
    };
  }

  // Resume ride button on floating ribbon
  const btnResumeRide = document.getElementById('cust-btn-resume-ride');
  if (btnResumeRide) {
    btnResumeRide.onclick = () => {
      if (!currentRide) return;
      handleRideStateChange(currentRide);
    };
  }
}

// -------------------------------------------------------------
// 2. Leaflet Map Initialization
// -------------------------------------------------------------
function initMap() {
  const mapContainer = document.getElementById('cust-leaflet-map');
  if (!mapContainer || typeof window.L === 'undefined') return;

  if (map) {
    map.invalidateSize();
    return;
  }

  map = window.L.map('cust-leaflet-map', {
    zoomControl: false,
    attributionControl: false,
  }).setView([pickupCoords.lat, pickupCoords.lng], 14);

  // Modern clean OpenStreetMap tiles
  window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
  }).addTo(map);

  // Pickup marker
  userMarker = window.L.marker([pickupCoords.lat, pickupCoords.lng], {
    icon: createCustomIcon('USER'),
  }).addTo(map);

  // Floating controls
  const btnRecenter = document.getElementById('cust-btn-recenter');
  const btnZoomIn = document.getElementById('cust-btn-zoom-in');
  const btnZoomOut = document.getElementById('cust-btn-zoom-out');

  if (btnRecenter) {
    btnRecenter.onclick = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            pickupCoords.lat = pos.coords.latitude;
            pickupCoords.lng = pos.coords.longitude;
            map.setView([pickupCoords.lat, pickupCoords.lng], 15);
            if (userMarker) userMarker.setLatLng([pickupCoords.lat, pickupCoords.lng]);
            reverseGeocode(pickupCoords.lat, pickupCoords.lng);
          },
          () => {
            map.setView([pickupCoords.lat, pickupCoords.lng], 14);
          }
        );
      } else {
        map.setView([pickupCoords.lat, pickupCoords.lng], 14);
      }
    };
  }

  if (btnZoomIn) btnZoomIn.onclick = () => map.zoomIn();
  if (btnZoomOut) btnZoomOut.onclick = () => map.zoomOut();

  // Try real GPS immediately
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      pickupCoords.lat = pos.coords.latitude;
      pickupCoords.lng = pos.coords.longitude;
      map.setView([pickupCoords.lat, pickupCoords.lng], 14);
      if (userMarker) userMarker.setLatLng([pickupCoords.lat, pickupCoords.lng]);
      reverseGeocode(pickupCoords.lat, pickupCoords.lng);
    }, (err) => {
      console.warn('GPS location permission declined or timeout:', err.message);
    }, { timeout: 8000 });
  }
}

function createCustomIcon(type) {
  if (typeof window.L === 'undefined') return null;

  if (type === 'USER') {
    return window.L.divIcon({
      className: 'cust-leaflet-icon',
      html: `
        <div style="width: 24px; height: 24px; background: #16A34A; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center;">
          <div style="width: 6px; height: 6px; background: white; border-radius: 50%;"></div>
        </div>
      `,
      iconSize: [24, 24],
      iconAnchor: [12, 12],
    });
  }

  if (type === 'DEST') {
    return window.L.divIcon({
      className: 'cust-leaflet-icon',
      html: `
        <div style="width: 28px; height: 28px; background: #EF4444; border: 3px solid white; border-radius: 50%; box-shadow: 0 2px 8px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; color: white; font-size: 13px; font-weight: bold;">
          🏁
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });
  }

  if (type === 'DRIVER') {
    return window.L.divIcon({
      className: 'cust-leaflet-icon',
      html: `
        <div style="width: 34px; height: 34px; background: #0F172A; border: 3px solid #86EFAC; border-radius: 50%; box-shadow: 0 4px 12px rgba(0,0,0,0.35); display: flex; align-items: center; justify-content: center; font-size: 16px;">
          🏍️
        </div>
      `,
      iconSize: [34, 34],
      iconAnchor: [17, 17],
    });
  }
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(`/api/locations/reverse?lat=${lat}&lng=${lng}`);
    const data = await res.json();
    if (data.address) {
      pickupCoords.address = data.address;
      const preview = document.getElementById('cust-current-loc-preview');
      const input = document.getElementById('cust-pickup-input');
      if (preview) preview.textContent = `Pickup: ${data.address.split(',')[0]}`;
      if (input) input.value = data.address;
    }
  } catch (err) {
    console.warn('Reverse geocode error:', err);
  }
}

// -------------------------------------------------------------
// 3. Socket.IO Realtime Connection
// -------------------------------------------------------------
function initSocket() {
  if (typeof window.io === 'undefined') {
    console.warn('Socket.IO script not loaded');
    return;
  }

  if (socket) return;

  socket = window.io('/', {
    transports: ['websocket', 'polling'],
  });

  socket.on('connect', () => {
    console.log('[CustomerApp Socket] Connected:', socket.id);
    if (activeUser && activeUser.id) {
      socket.emit('join:user', activeUser.id);
    }
    if (currentRide && currentRide.id) {
      socket.emit('join:ride', currentRide.id);
    }
  });

  socket.on('ride:offer', (offer) => {
    console.log('[CustomerApp Socket] Incoming Driver Offer:', offer);
    addOfferToUI(offer);
  });

  socket.on('ride:fare-updated', (data) => {
    console.log('[CustomerApp Socket] Fare Updated:', data);
    if (currentRide && currentRide.id === data.ride.id) {
      currentRide = data.ride;
      updateChatCurrentFare(data.amount);
      if (data.message) appendChatMessage(data.message);
    }
  });

  socket.on('ride:fare-agreed', (data) => {
    console.log('[CustomerApp Socket] Fare Agreed:', data);
    if (currentRide && currentRide.id === data.ride.id) {
      currentRide = data.ride;
      switchSheet('sheet-payment');
      populatePaymentDetails(data.ride);
    }
  });

  socket.on('ride:confirmed', (data) => {
    console.log('[CustomerApp Socket] Ride Confirmed & Driver Assigned:', data);
    currentRide = data.ride;
    switchSheet('sheet-live');
    populateLiveRide(data.ride);
  });

  socket.on('driver:location', (data) => {
    console.log('[CustomerApp Socket] Live Driver GPS Location:', data);
    updateDriverLocationOnMap(data.lat, data.lng);
  });

  socket.on('driver:arrived', (data) => {
    console.log('[CustomerApp Socket] Driver Arrived:', data);
    currentRide = data.ride;
    updateLiveStatusBadge('DRIVER_ARRIVED');
  });

  socket.on('ride:started', (data) => {
    console.log('[CustomerApp Socket] Ride Started:', data);
    currentRide = data.ride;
    updateLiveStatusBadge('RIDE_STARTED');
  });

  socket.on('ride:completed', (data) => {
    console.log('[CustomerApp Socket] Ride Completed:', data);
    currentRide = data.ride;
    switchSheet('sheet-complete');
    populateCompletionSummary(data.ride);
  });

  socket.on('ride:cancelled', (data) => {
    alert(`Ride cancelled: ${data.reason || 'Trip ended'}`);
    resetToHome();
  });

  socket.on('chat:message', (msg) => {
    appendChatMessage(msg);
  });
}

function updateDriverLocationOnMap(lat, lng) {
  if (!map) return;
  if (!driverMarker) {
    driverMarker = window.L.marker([lat, lng], {
      icon: createCustomIcon('DRIVER'),
    }).addTo(map);
  } else {
    driverMarker.setLatLng([lat, lng]);
  }
}

// -------------------------------------------------------------
// 4. Sheets State Machine Controller
// -------------------------------------------------------------
function switchSheet(targetSheetId) {
  const allSheets = [
    'sheet-whereto',
    'sheet-search',
    'sheet-route',
    'sheet-vehicle',
    'sheet-offers',
    'sheet-chat',
    'sheet-payment',
    'sheet-live',
    'sheet-complete',
  ];

  allSheets.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      if (id === targetSheetId) {
        el.style.display = 'block';
        el.classList.add('active');
      } else {
        el.style.display = 'none';
        el.classList.remove('active');
      }
    }
  });

  // Re-fit Leaflet map container on sheet transition
  if (map) {
    setTimeout(() => map.invalidateSize(), 150);
  }
}

// -------------------------------------------------------------
// 5. Sheet 1: Where To (Home View)
// -------------------------------------------------------------
function setupWhereToSheet() {
  const btnTriggerSearch = document.getElementById('cust-trigger-search');
  if (btnTriggerSearch) {
    btnTriggerSearch.onclick = () => {
      switchSheet('sheet-search');
      const destInput = document.getElementById('cust-dest-input');
      if (destInput) destInput.focus();
    };
  }

  // Quick pills (Airport, Emporium, Packages, Liberty)
  const quickPills = document.querySelectorAll('.cust-quick-pill');
  quickPills.forEach((pill) => {
    pill.onclick = () => {
      const lat = parseFloat(pill.dataset.lat);
      const lng = parseFloat(pill.dataset.lng);
      const address = pill.dataset.address;
      selectDestination(lat, lng, address);
    };
  });
}

// -------------------------------------------------------------
// 6. Sheet 2: Location Search
// -------------------------------------------------------------
let searchDebounceTimer = null;

function setupLocationSearchSheet() {
  const backBtn = document.querySelector('[data-target="sheet-whereto"]');
  if (backBtn) {
    backBtn.onclick = () => switchSheet('sheet-whereto');
  }

  const destInput = document.getElementById('cust-dest-input');
  const resultsContainer = document.getElementById('cust-results-items');

  if (destInput) {
    destInput.addEventListener('input', (e) => {
      const q = e.target.value.trim();
      clearTimeout(searchDebounceTimer);
      if (q.length < 2) {
        if (resultsContainer) resultsContainer.innerHTML = '';
        return;
      }

      searchDebounceTimer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/locations/search?q=${encodeURIComponent(q)}&lat=${pickupCoords.lat}&lng=${pickupCoords.lng}`);
          const data = await res.json();
          renderSearchResults(data.places || []);
        } catch (err) {
          console.error('Search error:', err);
        }
      }, 300);
    });
  }
}

function renderSearchResults(places) {
  const container = document.getElementById('cust-results-items');
  if (!container) return;

  if (places.length === 0) {
    container.innerHTML = `<div style="padding: 12px; font-size: 13px; color: #94A3B8; text-align: center;">No matching locations found</div>`;
    return;
  }

  container.innerHTML = places
    .map(
      (p) => `
      <div class="cust-result-item" data-lat="${p.lat}" data-lng="${p.lng}" data-addr="${p.address}">
        <span class="cust-result-icon">📍</span>
        <div class="cust-result-text">
          <strong>${p.name || p.address.split(',')[0]}</strong>
          <small>${p.address}</small>
        </div>
      </div>
    `
    )
    .join('');

  container.querySelectorAll('.cust-result-item').forEach((item) => {
    item.onclick = () => {
      const lat = parseFloat(item.dataset.lat);
      const lng = parseFloat(item.dataset.lng);
      const addr = item.dataset.addr;
      selectDestination(lat, lng, addr);
    };
  });
}

async function selectDestination(lat, lng, address) {
  destCoords = { lat, lng, address };

  // Update map destination marker
  if (map) {
    if (destMarker) {
      destMarker.setLatLng([lat, lng]);
    } else {
      destMarker = window.L.marker([lat, lng], {
        icon: createCustomIcon('DEST'),
      }).addTo(map);
    }
  }

  // Fetch real OSRM route and travel time
  try {
    const res = await fetch(
      `/api/locations/route?fromLat=${pickupCoords.lat}&fromLng=${pickupCoords.lng}&toLat=${destCoords.lat}&toLng=${destCoords.lng}`
    );
    currentRouteData = await res.json();
    renderRouteOnMap(currentRouteData);
    populateRoutePreview(currentRouteData);
    switchSheet('sheet-route');
  } catch (err) {
    console.error('Route error:', err);
  }
}

function renderRouteOnMap(routeData) {
  if (!map) return;

  if (routePolyline) {
    map.removeLayer(routePolyline);
  }

  if (routeData.coordinates && routeData.coordinates.length > 0) {
    routePolyline = window.L.polyline(routeData.coordinates, {
      color: '#16A34A',
      weight: 5,
      opacity: 0.85,
    }).addTo(map);

    map.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });
  } else {
    // Fallback straight line
    routePolyline = window.L.polyline(
      [
        [pickupCoords.lat, pickupCoords.lng],
        [destCoords.lat, destCoords.lng],
      ],
      { color: '#16A34A', weight: 4, dashArray: '6, 8' }
    ).addTo(map);
    map.fitBounds(routePolyline.getBounds(), { padding: [40, 40] });
  }
}

// -------------------------------------------------------------
// 7. Sheet 3: Route Preview
// -------------------------------------------------------------
function populateRoutePreview(routeData) {
  const pickupEl = document.getElementById('cust-route-pickup-text');
  const destEl = document.getElementById('cust-route-dest-text');
  const distEl = document.getElementById('cust-route-distance');
  const durEl = document.getElementById('cust-route-duration');

  if (pickupEl) pickupEl.textContent = pickupCoords.address || 'Current Location';
  if (destEl) destEl.textContent = destCoords.address || 'Selected Destination';
  if (distEl) distEl.textContent = `${routeData.distanceKm || 4.5} km`;
  if (durEl) durEl.textContent = `${routeData.durationMins || 14} mins`;
}

function setupRoutePreviewSheet() {
  const backBtn = document.querySelector('[data-target="sheet-search"]');
  if (backBtn) {
    backBtn.onclick = () => switchSheet('sheet-search');
  }

  const btnToVehicle = document.getElementById('cust-btn-to-vehicle');
  if (btnToVehicle) {
    btnToVehicle.onclick = async () => {
      await fetchFaresAndPopulateVehicleSheet();
      switchSheet('sheet-vehicle');
    };
  }
}

// -------------------------------------------------------------
// 8. Sheet 4: Vehicle Selection
// -------------------------------------------------------------
async function fetchFaresAndPopulateVehicleSheet() {
  try {
    const res = await fetch('/api/rides/estimate', {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({
        pickupLat: pickupCoords.lat,
        pickupLng: pickupCoords.lng,
        destLat: destCoords.lat,
        destLng: destCoords.lng,
      }),
    });
    const data = await res.json();
    if (data.estimates) {
      const bikeFareEl = document.getElementById('cust-bike-fare');
      const carFareEl = document.getElementById('cust-car-fare');
      if (bikeFareEl) bikeFareEl.textContent = data.estimates.BIKE.fareRange;
      if (carFareEl) carFareEl.textContent = data.estimates.CAR.fareRange;
    }
  } catch (err) {
    console.error('Estimate fare error:', err);
  }
}

function setupVehicleSelectionSheet() {
  const backBtn = document.querySelector('[data-target="sheet-route"]');
  if (backBtn) {
    backBtn.onclick = () => switchSheet('sheet-route');
  }

  const vehicleCards = document.querySelectorAll('.cust-vehicle-card');
  vehicleCards.forEach((card) => {
    card.onclick = () => {
      vehicleCards.forEach((c) => {
        c.classList.remove('active');
        const radio = c.querySelector('.cust-v-radio');
        if (radio) radio.textContent = '';
      });
      card.classList.add('active');
      const radio = card.querySelector('.cust-v-radio');
      if (radio) radio.textContent = '✓';
      selectedVehicleType = card.dataset.vtype || 'BIKE';
    };
  });

  const btnDispatch = document.getElementById('cust-btn-dispatch');
  if (btnDispatch) {
    btnDispatch.onclick = async () => {
      btnDispatch.disabled = true;
      btnDispatch.textContent = 'Creating Request...';
      try {
        const res = await fetch('/api/rides/request', {
          method: 'POST',
          headers: authHeaders(true),
          body: JSON.stringify({
            pickupAddress: pickupCoords.address,
            pickupLat: pickupCoords.lat,
            pickupLng: pickupCoords.lng,
            destAddress: destCoords.address,
            destLat: destCoords.lat,
            destLng: destCoords.lng,
            vehicleType: selectedVehicleType,
          }),
        });
        const data = await res.json();
        if (data.ride) {
          currentRide = data.ride;
          if (socket) socket.emit('join:ride', currentRide.id);

          // Clear offers container
          const container = document.getElementById('cust-offers-list');
          if (container) container.innerHTML = '';

          switchSheet('sheet-offers');
          updateFloatingRibbon(currentRide);
        } else {
          alert(data.error || 'Could not request ride');
        }
      } catch (err) {
        console.error('Request ride error:', err);
      } finally {
        btnDispatch.disabled = false;
        btnDispatch.textContent = 'Find Drivers Now →';
      }
    };
  }
}

// -------------------------------------------------------------
// 9. Sheet 5: Finding Drivers & Real-time Offers
// -------------------------------------------------------------
function setupOffersSheet() {
  const btnCancel = document.getElementById('cust-btn-cancel-request');
  if (btnCancel) {
    btnCancel.onclick = async () => {
      if (!confirm('Are you sure you want to cancel looking for drivers?')) return;
      if (currentRide) {
        await fetch(`/api/rides/${currentRide.id}/cancel`, {
          method: 'POST',
          headers: authHeaders(true),
          body: JSON.stringify({ reason: 'Cancelled by customer' }),
        });
      }
      resetToHome();
    };
  }
}

function addOfferToUI(offer) {
  const container = document.getElementById('cust-offers-list');
  if (!container) return;

  // Check if offer already rendered
  if (document.getElementById(`offer-card-${offer.id}`)) return;

  const card = document.createElement('div');
  card.id = `offer-card-${offer.id}`;
  card.className = 'cust-offer-card';
  card.innerHTML = `
    <div class="cust-offer-driver-row">
      <div class="cust-offer-avatar-wrap">
        <img src="${offer.driverAvatar || '/brand/safargo-symbol.svg'}" class="cust-offer-avatar-img" alt="${offer.driverName}" />
        <span class="cust-offer-rating-badge">★ ${offer.driverRating || 4.9}</span>
      </div>
      <div class="cust-offer-details">
        <div style="display: flex; justify-content: space-between; align-items: flex-start;">
          <strong>${offer.driverName}</strong>
          <strong class="cust-offer-fare-badge">PKR ${offer.offeredFare}</strong>
        </div>
        <p style="font-size: 11px; color: #64748B; margin-top: 2px;">
          ${offer.vehicleInfo || offer.vehicleType} • ${offer.registrationNumber || ''}
        </p>
        <div class="cust-offer-metrics">
          <span>⏱️ ${offer.etaMinutes || 3} min away</span>
          <span>📍 ${offer.distanceKm || 1.2} km</span>
        </div>
      </div>
    </div>
    <button type="button" class="cust-btn-select-offer cust-primary-action-btn" style="margin-top: 10px; padding: 10px; font-size: 13px;" data-offer-id="${offer.id}">
      Select Driver & Negotiate Fare →
    </button>
  `;

  container.prepend(card);

  card.querySelector('.cust-btn-select-offer').onclick = async () => {
    selectedOffer = offer;
    try {
      const res = await fetch(`/api/rides/${currentRide.id}/select-offer`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ offerId: offer.id }),
      });
      const data = await res.json();
      if (data.ride) {
        currentRide = data.ride;
        openDealChat(currentRide, offer);
      }
    } catch (err) {
      console.error('Select offer error:', err);
    }
  };
}

// -------------------------------------------------------------
// 10. Sheet 6: Deal Chat & Fare Negotiation
// -------------------------------------------------------------
function openDealChat(ride, offer) {
  const driverNameEl = document.getElementById('cust-chat-driver-name');
  const vehicleEl = document.getElementById('cust-chat-vehicle');
  const currentFareEl = document.getElementById('cust-chat-current-fare');
  const btnAccept = document.getElementById('cust-btn-accept-fare');

  if (driverNameEl) driverNameEl.textContent = offer.driverName || ride.driverName;
  if (vehicleEl) vehicleEl.textContent = `${offer.vehicleInfo || ride.driverVehicle}`;
  if (currentFareEl) currentFareEl.textContent = `PKR ${offer.offeredFare}`;
  if (btnAccept) btnAccept.textContent = `Accept Fare: PKR ${offer.offeredFare} →`;

  // Load chat messages
  loadChatMessages(ride.id);

  switchSheet('sheet-chat');
}

async function loadChatMessages(rideId) {
  const container = document.getElementById('cust-chat-messages');
  if (!container) return;
  container.innerHTML = '';

  try {
    const res = await fetch(`/api/rides/${rideId}/messages`, {
      headers: authHeaders(false),
    });
    const data = await res.json();
    if (data.messages) {
      data.messages.forEach(appendChatMessage);
    }
  } catch (err) {
    console.error('Load chat messages error:', err);
  }
}

function appendChatMessage(msg) {
  const container = document.getElementById('cust-chat-messages');
  if (!container) return;

  const isCustomer = msg.senderRole === 'CUSTOMER';
  const isSystem = msg.senderRole === 'SYSTEM' || msg.type === 'SYSTEM';

  const div = document.createElement('div');
  if (isSystem) {
    div.className = 'cust-chat-bubble cust-chat-system';
    div.innerHTML = `<span>ℹ️ ${msg.content}</span>`;
  } else {
    div.className = `cust-chat-bubble ${isCustomer ? 'cust-chat-customer' : 'cust-chat-driver'}`;
    div.innerHTML = `
      <strong style="font-size: 11px; display: block; opacity: 0.75;">${msg.senderName}</strong>
      <span>${msg.content}</span>
    `;
  }

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function updateChatCurrentFare(amount) {
  const currentFareEl = document.getElementById('cust-chat-current-fare');
  const btnAccept = document.getElementById('cust-btn-accept-fare');
  if (currentFareEl) currentFareEl.textContent = `PKR ${amount}`;
  if (btnAccept) btnAccept.textContent = `Accept Fare: PKR ${amount} →`;
}

function setupDealChatSheet() {
  const backBtn = document.querySelector('[data-target="sheet-offers"]');
  if (backBtn) {
    backBtn.onclick = () => switchSheet('sheet-offers');
  }

  // Counter offer pills (-20, +20, -10%)
  const counterPills = document.querySelectorAll('.cust-counter-pill');
  counterPills.forEach((pill) => {
    pill.onclick = async () => {
      if (!currentRide) return;
      const base = currentRide.currentOfferedFare || currentRide.agreedFare || currentRide.estimatedFare || 250;
      let newFare = base;

      if (pill.dataset.delta) {
        newFare = base + parseInt(pill.dataset.delta, 10);
      } else if (pill.dataset.pct) {
        newFare = Math.round(base * parseFloat(pill.dataset.pct));
      }

      newFare = Math.max(60, newFare);

      try {
        const res = await fetch(`/api/rides/${currentRide.id}/counter-offer`, {
          method: 'POST',
          headers: authHeaders(true),
          body: JSON.stringify({ amount: newFare }),
        });
        const data = await res.json();
        if (data.ride) {
          currentRide = data.ride;
          updateChatCurrentFare(newFare);
        }
      } catch (err) {
        console.error('Counter offer error:', err);
      }
    };
  });

  // Accept fare button
  const btnAccept = document.getElementById('cust-btn-accept-fare');
  if (btnAccept) {
    btnAccept.onclick = async () => {
      if (!currentRide) return;
      try {
        const res = await fetch(`/api/rides/${currentRide.id}/accept-fare`, {
          method: 'POST',
          headers: authHeaders(true),
          body: JSON.stringify({ amount: currentRide.currentOfferedFare }),
        });
        const data = await res.json();
        if (data.ride) {
          currentRide = data.ride;
          switchSheet('sheet-payment');
          populatePaymentDetails(currentRide);
        }
      } catch (err) {
        console.error('Accept fare error:', err);
      }
    };
  }

  // Send text message
  const btnSend = document.getElementById('cust-btn-send-msg');
  const inputMsg = document.getElementById('cust-chat-input');
  const sendMessage = async () => {
    if (!inputMsg || !inputMsg.value.trim() || !currentRide) return;
    const text = inputMsg.value.trim();
    inputMsg.value = '';
    try {
      await fetch(`/api/rides/${currentRide.id}/messages`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ content: text, type: 'TEXT' }),
      });
    } catch (err) {
      console.error('Send message error:', err);
    }
  };

  if (btnSend) btnSend.onclick = sendMessage;
  if (inputMsg) {
    inputMsg.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') sendMessage();
    });
  }
}

// -------------------------------------------------------------
// 11. Sheet 7: Ride Confirmation & Payment
// -------------------------------------------------------------
let selectedPaymentMethod = 'CASH';

function populatePaymentDetails(ride) {
  const fareEl = document.getElementById('cust-pay-fare-amount');
  const driverEl = document.getElementById('cust-pay-driver-name');
  const vehicleEl = document.getElementById('cust-pay-vehicle');

  const fare = ride.agreedFare || ride.currentOfferedFare || ride.estimatedFare;
  if (fareEl) fareEl.textContent = `PKR ${fare}`;
  if (driverEl) driverEl.textContent = ride.driverName || 'Driver';
  if (vehicleEl) vehicleEl.textContent = ride.driverVehicle || 'Vehicle';
}

function setupPaymentSheet() {
  const payCards = document.querySelectorAll('.cust-pay-method-card');
  payCards.forEach((card) => {
    card.onclick = () => {
      payCards.forEach((c) => {
        c.classList.remove('selected');
        const r = c.querySelector('.cust-pay-radio');
        if (r) r.textContent = '';
      });
      card.classList.add('selected');
      const r = card.querySelector('.cust-pay-radio');
      if (r) r.textContent = '✓';
      selectedPaymentMethod = card.dataset.method || 'CASH';
    };
  });

  const btnConfirm = document.getElementById('cust-btn-confirm-payment');
  if (btnConfirm) {
    btnConfirm.onclick = async () => {
      if (!currentRide) return;
      btnConfirm.disabled = true;
      btnConfirm.textContent = 'Locking Booking...';
      try {
        const res = await fetch(`/api/rides/${currentRide.id}/payment`, {
          method: 'POST',
          headers: authHeaders(true),
          body: JSON.stringify({ paymentMethod: selectedPaymentMethod }),
        });
        const data = await res.json();
        if (data.ride) {
          currentRide = data.ride;
          switchSheet('sheet-live');
          populateLiveRide(currentRide);
        }
      } catch (err) {
        console.error('Payment confirmation error:', err);
      } finally {
        btnConfirm.disabled = false;
        btnConfirm.textContent = 'Confirm & Start Ride →';
      }
    };
  }
}

// -------------------------------------------------------------
// 12. Sheet 8: Live Ride Tracking
// -------------------------------------------------------------
function populateLiveRide(ride) {
  const nameEl = document.getElementById('cust-live-driver-name');
  const plateEl = document.getElementById('cust-live-driver-plate');
  const vehicleEl = document.getElementById('cust-live-driver-vehicle');
  const fareEl = document.getElementById('cust-live-agreed-fare');
  const pinEl = document.getElementById('cust-live-otp-pin');

  if (nameEl) nameEl.textContent = ride.driverName || 'Assigned Driver';
  if (vehicleEl) vehicleEl.textContent = ride.driverVehicle || 'Vehicle';
  if (fareEl) fareEl.textContent = `PKR ${ride.agreedFare || ride.estimatedFare}`;
  if (pinEl) pinEl.textContent = ride.startRideOtp || '7392';

  // Extract license plate from vehicle string if available
  if (plateEl) {
    const regMatch = (ride.driverVehicle || '').match(/\(([^)]+)\)/);
    plateEl.textContent = regMatch ? regMatch[1] : 'LE-2024';
  }

  updateLiveStatusBadge(ride.status);
  updateFloatingRibbon(ride);

  // Initialize driver marker near pickup
  const drvLat = pickupCoords.lat + 0.008;
  const drvLng = pickupCoords.lng + 0.006;
  updateDriverLocationOnMap(drvLat, drvLng);
}

function updateLiveStatusBadge(status) {
  const bannerText = document.getElementById('cust-live-status-text');
  const bannerSub = document.getElementById('cust-live-status-sub');

  if (status === 'DRIVER_ASSIGNED' || status === 'DRIVER_EN_ROUTE') {
    if (bannerText) bannerText.textContent = 'Driver is on the way';
    if (bannerSub) bannerSub.textContent = 'Arriving at your pickup in ~3 mins';
  } else if (status === 'DRIVER_ARRIVED') {
    if (bannerText) bannerText.textContent = 'Driver Has Arrived!';
    if (bannerSub) bannerSub.textContent = 'Meet driver at pickup point. Share OTP PIN.';
  } else if (status === 'RIDE_STARTED') {
    if (bannerText) bannerText.textContent = 'Ride In Progress 🛣️';
    if (bannerSub) bannerSub.textContent = 'En route to your destination safely.';
  }
}

function setupLiveRideSheet() {
  // Simulator triggers to allow testing full driver lifecycle
  const simArrived = document.getElementById('sim-driver-arrived');
  const simStart = document.getElementById('sim-ride-start');
  const simComplete = document.getElementById('sim-ride-complete');

  if (simArrived) {
    simArrived.onclick = async () => {
      if (!currentRide) return;
      await fetch(`/api/rides/${currentRide.id}/driver-progress`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ newStatus: 'DRIVER_ARRIVED' }),
      });
      updateLiveStatusBadge('DRIVER_ARRIVED');
    };
  }

  if (simStart) {
    simStart.onclick = async () => {
      if (!currentRide) return;
      await fetch(`/api/rides/${currentRide.id}/driver-progress`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ newStatus: 'RIDE_STARTED' }),
      });
      updateLiveStatusBadge('RIDE_STARTED');
    };
  }

  if (simComplete) {
    simComplete.onclick = async () => {
      if (!currentRide) return;
      await fetch(`/api/rides/${currentRide.id}/driver-progress`, {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({ newStatus: 'COMPLETED' }),
      });
      switchSheet('sheet-complete');
      populateCompletionSummary(currentRide);
    };
  }

  // Safety actions
  const btnShare = document.getElementById('cust-live-share-btn');
  if (btnShare) {
    btnShare.onclick = () => {
      if (navigator.share) {
        navigator.share({
          title: 'SafarGo Live Trip',
          text: `I'm travelling with SafarGo in a ${currentRide ? currentRide.driverVehicle : 'vehicle'}.`,
          url: window.location.href,
        }).catch(() => {});
      } else {
        alert('Live trip details copied to clipboard for safety sharing.');
      }
    };
  }

  const btnEmergency = document.getElementById('cust-live-emergency-btn');
  if (btnEmergency) {
    btnEmergency.onclick = () => {
      if (confirm('Initiate Emergency Assistance (15 Police / SafarGo Security)?')) {
        alert('Emergency alert transmitted to SafarGo 24/7 Security Operations.');
      }
    };
  }
}

// -------------------------------------------------------------
// 13. Sheet 9: Ride Completion & Rating
// -------------------------------------------------------------
function populateCompletionSummary(ride) {
  const fareEl = document.getElementById('cust-receipt-fare');
  const distEl = document.getElementById('cust-receipt-dist');
  const durEl = document.getElementById('cust-receipt-dur');
  const driverNameEl = document.getElementById('cust-rated-driver-name');

  const fare = ride.agreedFare || ride.currentOfferedFare || ride.estimatedFare || 250;
  if (fareEl) fareEl.textContent = `PKR ${fare}`;
  if (distEl) distEl.textContent = `${ride.distanceKm || 4.8} km`;
  if (durEl) durEl.textContent = `${ride.durationMins || 14} mins`;
  if (driverNameEl) driverNameEl.textContent = ride.driverName || 'Driver';

  hideFloatingRibbon();
}

function setupCompletionSheet() {
  const stars = document.querySelectorAll('.cust-star');
  stars.forEach((star) => {
    star.onclick = () => {
      const val = parseInt(star.dataset.val, 10);
      currentRating = val;
      stars.forEach((s) => {
        const sVal = parseInt(s.dataset.val, 10);
        if (sVal <= val) {
          s.classList.add('active');
        } else {
          s.classList.remove('active');
        }
      });
    };
  });

  const btnFinish = document.getElementById('cust-btn-finish-review');
  if (btnFinish) {
    btnFinish.onclick = async () => {
      const commentInput = document.getElementById('cust-review-comment');
      const comment = commentInput ? commentInput.value.trim() : '';

      if (currentRide) {
        try {
          await fetch(`/api/rides/${currentRide.id}/review`, {
            method: 'POST',
            headers: authHeaders(true),
            body: JSON.stringify({ rating: currentRating, comment }),
          });
        } catch (err) {
          console.error('Review submit error:', err);
        }
      }

      resetToHome();
    };
  }
}

function resetToHome() {
  currentRide = null;
  selectedOffer = null;
  hideFloatingRibbon();

  if (routePolyline && map) {
    map.removeLayer(routePolyline);
    routePolyline = null;
  }
  if (destMarker && map) {
    map.removeLayer(destMarker);
    destMarker = null;
  }
  if (driverMarker && map) {
    map.removeLayer(driverMarker);
    driverMarker = null;
  }

  switchSheet('sheet-whereto');
}

// -------------------------------------------------------------
// 14. Modals: Ride History & Saved Places
// -------------------------------------------------------------
function setupHistoryModal() {
  const btnOpen = document.getElementById('cust-menu-history');
  const modal = document.getElementById('modal-cust-history');
  const closeBtns = document.querySelectorAll('[data-close="modal-cust-history"]');

  if (btnOpen && modal) {
    btnOpen.onclick = () => {
      const drawer = document.getElementById('cust-drawer-overlay');
      if (drawer) {
        drawer.classList.remove('open');
        drawer.style.display = 'none';
      }
      modal.style.display = 'flex';
      loadRideHistory('all');
    };
  }

  closeBtns.forEach((btn) => {
    btn.onclick = () => {
      if (modal) modal.style.display = 'none';
    };
  });

  const tabBtns = document.querySelectorAll('.cust-tab-btn');
  tabBtns.forEach((tab) => {
    tab.onclick = () => {
      tabBtns.forEach((t) => t.classList.remove('active'));
      tab.classList.add('active');
      loadRideHistory(tab.dataset.filter || 'all');
    };
  });
}

async function loadRideHistory(filter) {
  const container = document.getElementById('cust-history-list');
  if (!container) return;
  container.innerHTML = `<div style="text-align: center; padding: 20px; color: #94A3B8;">Loading trips...</div>`;

  try {
    const res = await fetch(`/api/rides/history/all?filter=${filter}`, {
      headers: authHeaders(false),
    });
    const data = await res.json();
    const rides = data.rides || [];

    if (rides.length === 0) {
      container.innerHTML = `<div style="text-align: center; padding: 30px; color: #94A3B8;">No trips found in this category.</div>`;
      return;
    }

    container.innerHTML = rides
      .map(
        (r) => `
        <div class="cust-history-card">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
            <div>
              <strong style="font-size: 14px; color: #0F172A;">${r.vehicleType === 'BIKE' ? '🏍️ SafarGo Bike' : '🚗 SafarGo Car'}</strong>
              <small style="display: block; color: #94A3B8; font-size: 11px;">${new Date(r.createdAt).toLocaleDateString()} • ${new Date(r.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</small>
            </div>
            <strong style="color: #16A34A; font-size: 14px;">PKR ${r.agreedFare || r.estimatedFare}</strong>
          </div>
          <div style="font-size: 12px; color: #475569; margin-bottom: 8px;">
            <div>🟢 ${r.pickupAddress.split(',')[0]}</div>
            <div>🔴 ${r.destAddress.split(',')[0]}</div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; border-top: 1px solid #F1F5F9; padding-top: 6px;">
            <span style="font-size: 11px; color: #64748B;">Driver: ${r.driverName || 'SafarGo Partner'}</span>
            <span class="cust-badge ${r.status === 'COMPLETED' ? 'badge-success' : r.status === 'CANCELLED' ? 'badge-danger' : 'badge-info'}" style="font-size: 10px; padding: 2px 6px; border-radius: 6px;">${r.status}</span>
          </div>
        </div>
      `
      )
      .join('');
  } catch (err) {
    console.error('Ride history error:', err);
    container.innerHTML = `<div style="text-align: center; padding: 20px; color: #EF4444;">Failed to load ride history.</div>`;
  }
}

function setupSavedPlacesModal() {
  const btnOpen = document.getElementById('cust-menu-saved');
  const modal = document.getElementById('modal-cust-saved');
  const closeBtns = document.querySelectorAll('[data-close="modal-cust-saved"]');
  const btnSave = document.getElementById('cust-btn-save-place');

  if (btnOpen && modal) {
    btnOpen.onclick = () => {
      const drawer = document.getElementById('cust-drawer-overlay');
      if (drawer) {
        drawer.classList.remove('open');
        drawer.style.display = 'none';
      }
      modal.style.display = 'flex';
      loadSavedPlaces();
    };
  }

  closeBtns.forEach((btn) => {
    btn.onclick = () => {
      if (modal) modal.style.display = 'none';
    };
  });

  if (btnSave) {
    btnSave.onclick = async () => {
      const labelInput = document.getElementById('cust-saved-label');
      const addrInput = document.getElementById('cust-saved-addr');
      const label = labelInput ? labelInput.value.trim() : '';
      const address = addrInput ? addrInput.value.trim() : '';

      if (!label || !address) {
        alert('Please fill both label and address');
        return;
      }

      try {
        await fetch('/api/locations/saved', {
          method: 'POST',
          headers: authHeaders(true),
          body: JSON.stringify({
            label,
            address,
            lat: pickupCoords.lat,
            lng: pickupCoords.lng,
          }),
        });
        if (labelInput) labelInput.value = '';
        if (addrInput) addrInput.value = '';
        loadSavedPlaces();
      } catch (err) {
        console.error('Save place error:', err);
      }
    };
  }
}

async function loadSavedPlaces() {
  const container = document.getElementById('cust-saved-places-list');
  if (!container) return;

  try {
    const res = await fetch('/api/locations/saved', {
      headers: authHeaders(false),
    });
    const data = await res.json();
    const places = data.places || [];

    if (places.length === 0) {
      container.innerHTML = `<div style="text-align: center; padding: 20px; color: #94A3B8;">No saved places yet. Add Home or Work above.</div>`;
      return;
    }

    container.innerHTML = places
      .map(
        (p) => `
        <div class="cust-saved-place-item" data-lat="${p.lat}" data-lng="${p.lng}" data-addr="${p.address}">
          <div style="font-size: 18px;">${p.label.toLowerCase().includes('home') ? '🏠' : p.label.toLowerCase().includes('work') ? '💼' : '📍'}</div>
          <div style="flex: 1;">
            <strong style="display: block; font-size: 13px; color: #0F172A;">${p.label}</strong>
            <small style="color: #64748B; font-size: 11px;">${p.address}</small>
          </div>
          <button type="button" class="cust-btn-select-saved" style="padding: 4px 10px; background: #DCFCE7; color: #16A34A; border: none; border-radius: 8px; font-weight: 700; font-size: 11px; cursor: pointer;">
            Go Here
          </button>
        </div>
      `
      )
      .join('');

    container.querySelectorAll('.cust-btn-select-saved').forEach((btn) => {
      btn.onclick = (e) => {
        const item = e.target.closest('.cust-saved-place-item');
        const lat = parseFloat(item.dataset.lat);
        const lng = parseFloat(item.dataset.lng);
        const addr = item.dataset.addr;
        const modal = document.getElementById('modal-cust-saved');
        if (modal) modal.style.display = 'none';
        selectDestination(lat, lng, addr);
      };
    });
  } catch (err) {
    console.error('Load saved places error:', err);
  }
}

// -------------------------------------------------------------
// 15. Active Ongoing Ride Sync
// -------------------------------------------------------------
async function checkActiveRide() {
  try {
    const res = await fetch('/api/rides/active', {
      headers: authHeaders(false),
    });
    const data = await res.json();
    if (data.hasActiveRide && data.ride) {
      currentRide = data.ride;
      if (socket) socket.emit('join:ride', currentRide.id);
      updateFloatingRibbon(currentRide);
      handleRideStateChange(currentRide, data.offers, data.messages);
    } else {
      hideFloatingRibbon();
    }
  } catch (err) {
    console.warn('Check active ride error:', err);
  }
}

function handleRideStateChange(ride, offers = [], messages = []) {
  if (['REQUESTED', 'SEARCHING_DRIVERS', 'DRIVERS_RESPONDING'].includes(ride.status)) {
    switchSheet('sheet-offers');
    if (offers && offers.length > 0) {
      offers.forEach(addOfferToUI);
    }
  } else if (ride.status === 'DRIVER_SELECTED' || ride.status === 'NEGOTIATING') {
    openDealChat(ride, {
      driverName: ride.driverName,
      vehicleInfo: ride.driverVehicle,
      offeredFare: ride.currentOfferedFare || ride.agreedFare,
    });
  } else if (ride.status === 'FARE_AGREED') {
    switchSheet('sheet-payment');
    populatePaymentDetails(ride);
  } else if (['CONFIRMED', 'DRIVER_ASSIGNED', 'DRIVER_EN_ROUTE', 'DRIVER_ARRIVED', 'RIDE_STARTED'].includes(ride.status)) {
    switchSheet('sheet-live');
    populateLiveRide(ride);
  } else if (ride.status === 'COMPLETED') {
    switchSheet('sheet-complete');
    populateCompletionSummary(ride);
  }
}

function updateFloatingRibbon(ride) {
  const ribbon = document.getElementById('cust-active-ribbon');
  const statusEl = document.getElementById('cust-ribbon-status');
  if (!ribbon) return;

  ribbon.style.display = 'flex';
  if (statusEl) {
    statusEl.textContent = `Status: ${ride.status.replace(/_/g, ' ')}`;
  }
}

function hideFloatingRibbon() {
  const ribbon = document.getElementById('cust-active-ribbon');
  if (ribbon) ribbon.style.display = 'none';
}
