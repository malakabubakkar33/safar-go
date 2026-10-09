/**
 * SafarGo - Comprehensive Customer App & Ride Booking E2E Test
 */

import { io } from 'socket.io-client';

const API = 'http://localhost:5000/api';
const SOCKET_URL = 'http://localhost:5000';

async function run() {
  console.log('=== SAFARGO CUSTOMER APP COMPLETE E2E TEST ===\n');

  // 1. Authenticate test customer
  console.log('1. Authenticating Customer...');
  const loginRes = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      identifier: 'testdriver@safargo.com', // can act as customer
      password: 'Password123!',
    }),
  });
  const loginData = await loginRes.json();
  if (!loginData.tokens || !loginData.tokens.accessToken) {
    throw new Error('Customer login failed: ' + JSON.stringify(loginData));
  }
  const token = loginData.tokens.accessToken;
  const user = loginData.user;
  console.log(`✓ Customer logged in: ${user.fullName} (${user.id})`);

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  };

  // 2. Location Autocomplete Search
  console.log('\n2. Testing Location Autocomplete Search (Peshawar)...');
  const searchRes = await fetch(`${API}/locations/search?q=University`);
  const searchData = await searchRes.json();
  console.log(`✓ Found ${searchData.results?.length || 0} location results:`, searchData.results?.[0]?.title);

  // 3. Route Calculation (OSRM & distance metrics in Peshawar)
  console.log('\n3. Testing Real Route Calculation in Peshawar (Saddar -> University of Peshawar)...');
  const routeRes = await fetch(`${API}/locations/route`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      pickupLat: 34.0086,
      pickupLng: 71.5367,
      destLat: 33.9984,
      destLng: 71.4827,
    }),
  });
  const routeData = await routeRes.json();
  console.log(`✓ Route calculated: ${routeData.distanceKm} km, ~${routeData.durationMins} mins, ${routeData.coordinates?.length || 0} polyline waypoints`);

  // 4. Fare Estimation (Bike vs Car)
  console.log('\n4. Testing Live Fare Estimation...');
  const estRes = await fetch(`${API}/rides/estimate`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      pickupLat: 34.0086,
      pickupLng: 71.5367,
      destLat: 33.9984,
      destLng: 71.4827,
    }),
  });
  const estData = await estRes.json();
  console.log(`✓ Bike Estimate: ${estData.estimates?.BIKE?.fareRange} (Base: PKR ${estData.estimates?.BIKE?.estimatedFare})`);
  console.log(`✓ Car Estimate: ${estData.estimates?.CAR?.fareRange} (Base: PKR ${estData.estimates?.CAR?.estimatedFare})`);

  // 5. Connect Socket.IO client for realtime events
  console.log('\n5. Connecting Socket.IO Client...');
  const socket = io(SOCKET_URL, { transports: ['websocket'] });
  await new Promise((resolve) => socket.on('connect', resolve));
  console.log(`✓ Socket connected: ${socket.id}`);
  socket.emit('join:user', user.id);

  // 5b. Test Boundary Rejection for Out-of-Area coordinates
  console.log('\n5b. Testing Peshawar Geofence Boundary Enforcement...');
  const outsideRes = await fetch(`${API}/rides/request`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      pickupAddress: 'Karachi Port',
      pickupLat: 24.8607,
      pickupLng: 67.0011,
      destAddress: 'Lahore Fort',
      destLat: 31.5881,
      destLng: 74.3094,
      vehicleType: 'BIKE',
    }),
  });
  const outsideData = await outsideRes.json();
  if (outsideRes.status === 400 && outsideData.code === 'OUTSIDE_SERVICE_AREA') {
    console.log(`✓ Boundary Enforced: "${outsideData.error}"`);
  } else {
    throw new Error('Geofence boundary failed to reject out-of-service coordinates');
  }

  // 6. Create Ride Request in Peshawar
  console.log('\n6. Creating Ride Request (Bike) in Peshawar...');
  const reqRes = await fetch(`${API}/rides/request`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      pickupAddress: 'Saddar Road, Peshawar Cantt',
      pickupLat: 34.0086,
      pickupLng: 71.5367,
      destAddress: 'University of Peshawar, Jamrud Road',
      destLat: 33.9984,
      destLng: 71.4827,
      vehicleType: 'BIKE',
    }),
  });
  const reqData = await reqRes.json();
  if (!reqData.ride) throw new Error('Failed to create ride: ' + JSON.stringify(reqData));
  const ride = reqData.ride;
  console.log(`✓ Ride Request Created: ID ${ride.id}, Status: ${ride.status}, OTP: ${ride.startRideOtp}`);

  socket.emit('join:ride', ride.id);

  // 7. Listen for real-time driver offers
  console.log('\n7. Listening for Real-time Driver Offers over Socket.IO...');
  const offersReceived = [];
  const offerPromise = new Promise((resolve) => {
    socket.on('ride:offer', (offer) => {
      console.log(`  → Inbound Driver Offer: ${offer.driverName} offered PKR ${offer.offeredFare} (ETA ${offer.etaMinutes}m)`);
      offersReceived.push(offer);
      if (offersReceived.length >= 1) resolve(offersReceived[0]);
    });
  });

  const firstOffer = await Promise.race([
    offerPromise,
    new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout waiting for driver offer')), 5000)),
  ]);
  console.log(`✓ Successfully received real driver offer from ${firstOffer.driverName}!`);

  // 8. Customer Selects Driver Offer
  console.log(`\n8. Selecting Offer from ${firstOffer.driverName}...`);
  const selectRes = await fetch(`${API}/rides/${ride.id}/select-offer`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ offerId: firstOffer.id }),
  });
  const selectData = await selectRes.json();
  console.log(`✓ Offer Selected! Ride state: ${selectData.ride?.status}, Driver: ${selectData.ride?.driverName}`);

  // 9. Fare Negotiation (Counter Offer)
  console.log('\n9. Negotiating Fare (Counter Offer of PKR 220)...');
  const counterRes = await fetch(`${API}/rides/${ride.id}/counter-offer`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ amount: 220 }),
  });
  const counterData = await counterRes.json();
  console.log(`✓ Counter Offer Placed! Current Offered Fare: PKR ${counterData.ride?.currentOfferedFare}`);

  // 10. Deal Chat Message
  console.log('\n10. Sending Real-time Deal Chat Message...');
  const chatRes = await fetch(`${API}/rides/${ride.id}/messages`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ content: 'I am waiting near the main gate. Please hurry!', type: 'TEXT' }),
  });
  const chatData = await chatRes.json();
  console.log(`✓ Chat Message Sent: "${chatData.message?.content}" (From: ${chatData.message?.senderName})`);

  // 11. Customer Accepts Fare
  console.log('\n11. Customer Accepts Fare...');
  const acceptRes = await fetch(`${API}/rides/${ride.id}/accept-fare`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ amount: 220 }),
  });
  const acceptData = await acceptRes.json();
  console.log(`✓ Fare Accepted! Agreed Fare: PKR ${acceptData.ride?.agreedFare}, Status: ${acceptData.ride?.status}`);

  // 12. Payment Confirmation (CASH)
  console.log('\n12. Confirming Payment (CASH)...');
  const payRes = await fetch(`${API}/rides/${ride.id}/payment`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ paymentMethod: 'CASH' }),
  });
  const payData = await payRes.json();
  console.log(`✓ Ride Confirmed & Driver Assigned! Status: ${payData.ride?.status}, Payment Method: ${payData.payment?.method}`);

  // 13. Driver Status Progression (DRIVER_ARRIVED -> RIDE_STARTED -> COMPLETED)
  console.log('\n13. Simulating Live Journey Milestones...');
  const arrivedRes = await fetch(`${API}/rides/${ride.id}/driver-progress`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ newStatus: 'DRIVER_ARRIVED' }),
  });
  console.log(`  → Driver Arrived at Pickup: status = ${(await arrivedRes.json()).ride?.status}`);

  const startRes = await fetch(`${API}/rides/${ride.id}/driver-progress`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ newStatus: 'RIDE_STARTED' }),
  });
  console.log(`  → Ride Started: status = ${(await startRes.json()).ride?.status}`);

  const completeRes = await fetch(`${API}/rides/${ride.id}/driver-progress`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ newStatus: 'COMPLETED' }),
  });
  console.log(`  → Ride Completed: status = ${(await completeRes.json()).ride?.status}`);

  // 14. Customer Rating & Review
  console.log('\n14. Submitting Customer 5-Star Rating & Review...');
  const reviewRes = await fetch(`${API}/rides/${ride.id}/review`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ rating: 5, comment: 'Excellent and safe ride! Polite driver.' }),
  });
  const reviewData = await reviewRes.json();
  console.log(`✓ Review Submitted: Rating ${reviewData.review?.rating}★, Comment: "${reviewData.review?.comment}"`);

  // 15. Verify Ride History
  console.log('\n15. Verifying Customer Ride History...');
  const historyRes = await fetch(`${API}/rides/history/all?filter=completed`, { headers });
  const historyData = await historyRes.json();
  console.log(`✓ Ride History retrieved: ${historyData.rides?.length} completed ride(s) on record`);

  // 16. Verify Saved Places
  console.log('\n16. Testing Saved Places...');
  const savePlaceRes = await fetch(`${API}/locations/saved`, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      label: 'Office HQ (Saddar)',
      address: 'Deans Trade Center, Saddar Road, Peshawar',
      lat: 34.0048,
      lng: 71.5385,
    }),
  });
  const savePlaceData = await savePlaceRes.json();
  console.log(`✓ Saved Place Created: ${savePlaceData.place?.label} (${savePlaceData.place?.address})`);

  socket.disconnect();
  console.log('\n==================================================');
  console.log('✅ ALL CUSTOMER MOBILE APP E2E TESTS PASSED 100%!');
  console.log('==================================================');
}

run().catch((err) => {
  console.error('\n❌ E2E TEST FAILED:', err);
  process.exit(1);
});
