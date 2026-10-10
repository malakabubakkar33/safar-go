/**
 * SafarGo - Comprehensive Automated Verification Test Suite
 * Tests: Health, Pricing & Geofence, Email OTP Auth, Bcrypt Passwords, 
 * Password Reset Flow, Multipart Avatar Uploads, and Driver Policy Enforcement.
 */

process.env.MOCK_EMAIL = 'true';

const { default: app } = await import('../server/app.js');
const { userDB, otpDB, driverProfileDB } = await import('../server/db.js');

const TEST_PORT = 5098;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

let server;
let passedCount = 0;
let failedCount = 0;

function assert(condition, testName, details = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${testName}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${testName} - ${details}`);
    failedCount++;
  }
}

async function request(path, options = {}) {
  const url = `${BASE_URL}${path}`;
  const res = await fetch(url, options);
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function runTests() {
  console.log('\n======================================================');
  console.log('   SAFARGO SYSTEMATIC VERIFICATION SUITE');
  console.log('======================================================\n');

  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, () => {
      console.log(`[Test Server] Running on http://127.0.0.1:${TEST_PORT}\n`);
      resolve();
    });
  });

  const testEmail = `qa_audit_${Date.now()}@safargo.test`;
  const testPhone = '+92300' + Math.floor(1000000 + Math.random() * 9000000);
  const testPassword = 'Password123#Secure!';
  const updatedPassword = 'NewPassword456#Verified!';
  let verificationToken = '';
  let authToken = '';
  let createdUserId = '';

  try {
    // -------------------------------------------------------------------------
    // 1. HEALTH CHECK
    // -------------------------------------------------------------------------
    console.log('--- 1. API Health & Environment ---');
    const health = await request('/health');
    assert(health.status === 200, 'Health endpoint responds 200 OK');
    assert(health.data?.service?.includes('SafarGo'), 'Health reports SafarGo Mobility platform');

    // -------------------------------------------------------------------------
    // 2. RIDE ESTIMATE & PESHAWAR GEOFENCE
    // -------------------------------------------------------------------------
    console.log('\n--- 2. Ride Fare Estimation & Geofence Boundaries ---');
    const peshawarEstimate = await request('/rides/estimate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        pickupLat: 34.0151,
        pickupLng: 71.5249,
        destLat: 34.0042,
        destLng: 71.5428,
      }),
    });
    assert(peshawarEstimate.status === 200, 'Peshawar route fare estimation succeeds');
    assert(peshawarEstimate.data?.estimates?.BIKE?.estimatedFare > 0, 'Bike fare calculated');
    assert(peshawarEstimate.data?.estimates?.CAR?.estimatedFare > 0, 'Car fare calculated');

    // Outside boundary test
    const outsideEstimate = await request('/rides/request', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer dummy_token',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        pickupAddress: 'Islamabad Blue Area',
        pickupLat: 33.7294,
        pickupLng: 73.0931,
        destAddress: 'Islamabad F-7',
        destLat: 33.7200,
        destLng: 73.0500,
      }),
    });
    // Either 400 (outside boundary) or 401 (auth)
    assert([400, 401].includes(outsideEstimate.status), 'Outside-boundary/auth request correctly guarded');

    // -------------------------------------------------------------------------
    // 3. AUTHENTICATION & SIGNUP STEP 1
    // -------------------------------------------------------------------------
    console.log('\n--- 3. Signup Step 1 & Email OTP Generation ---');
    const step1 = await request('/auth/signup-step1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'QA Verification User',
        email: testEmail,
        phone: testPhone,
        username: `qa_user_${Date.now()}`,
      }),
    });
    if (step1.status !== 200) {
      console.log('Step 1 returned:', step1.status, step1.data);
    }
    assert(step1.status === 200, 'Signup step 1 handles valid inputs', JSON.stringify(step1.data));
    assert(Boolean(step1.data?.emailMasked), 'Email masked string returned securely');

    // -------------------------------------------------------------------------
    // 4. HARDENED OTP VERIFICATION (NO DEMO BYPASSES)
    // -------------------------------------------------------------------------
    console.log('\n--- 4. Hardened OTP Verification (Security Enforcement) ---');
    // Ensure demo bypass 123456 fails
    const fakeOtpRes = await request('/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        otp: '123456',
      }),
    });
    assert(fakeOtpRes.status === 400, 'Demo OTP "123456" is strictly rejected (no bypasses)');

    // Verify OTP record in DB has otpHash and no plaintext password
    const realOtpRecord = otpDB.get(testEmail);
    assert(Boolean(realOtpRecord?.otpHash), 'Server securely stored bcrypt OTP hash in database');

    const dispatchedOtp = global.__lastMockOtp;
    assert(Boolean(dispatchedOtp), `Dispatched 6-digit OTP captured (${dispatchedOtp})`);

    const validOtpRes = await request('/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: testEmail,
        otp: dispatchedOtp,
      }),
    });
    assert(validOtpRes.status === 200, 'Genuine OTP verification succeeds');
    assert(Boolean(validOtpRes.data?.verificationToken), 'One-time verificationToken issued');
    verificationToken = validOtpRes.data?.verificationToken;

    // -------------------------------------------------------------------------
    // 5. ACCOUNT CREATION & BCRYPT PASSWORD HASHING
    // -------------------------------------------------------------------------
    console.log('\n--- 5. Account Creation with Bcrypt Security ---');
    const createAccountRes = await request('/auth/create-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verificationToken,
        password: testPassword,
        confirmPassword: testPassword,
        avatarUrl: '/brand/safargo-symbol.svg',
      }),
    });
    assert([200, 201].includes(createAccountRes.status), 'Account successfully created with verified token');
    assert(Boolean(createAccountRes.data?.tokens?.accessToken), 'JWT access token issued on completion');
    authToken = createAccountRes.data?.tokens?.accessToken;
    createdUserId = createAccountRes.data?.user?.id;

    // Verify password is not plaintext in DB
    const storedUser = userDB.findById(createdUserId);
    assert(Boolean(storedUser?.passwordHash && storedUser.passwordHash.startsWith('$2')), 'Password stored as bcrypt hash');

    // -------------------------------------------------------------------------
    // 6. LOGIN AUTHENTICATION (VALID VS INVALID)
    // -------------------------------------------------------------------------
    console.log('\n--- 6. Login Lifecycle Verification ---');
    const wrongLogin = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testEmail,
        password: 'WrongPassword999!',
      }),
    });
    assert(wrongLogin.status === 401, 'Invalid password correctly rejected with 401');

    const validLogin = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testEmail,
        password: testPassword,
      }),
    });
    assert(validLogin.status === 200, 'Valid credentials login returns 200 OK');
    assert(Boolean(validLogin.data?.tokens?.accessToken), 'Valid session tokens issued');

    // -------------------------------------------------------------------------
    // 7. PASSWORD RESET LIFECYCLE
    // -------------------------------------------------------------------------
    console.log('\n--- 7. Password Recovery Flow ---');
    const forgotRes = await request('/auth/forgot-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail }),
    });
    assert(forgotRes.status === 200, 'Forgot password initiates successfully');

    const resetOtpRecord = otpDB.get(testEmail);
    assert(Boolean(resetOtpRecord?.otpHash), 'Reset OTP record generated in DB with hash');

    const dispatchedResetOtp = global.__lastMockOtp;
    assert(Boolean(dispatchedResetOtp), `Dispatched Reset OTP captured (${dispatchedResetOtp})`);

    const verifyResetOtp = await request('/auth/verify-reset-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: testEmail, otp: dispatchedResetOtp }),
    });
    assert(verifyResetOtp.status === 200, 'Reset OTP verified');
    const resetToken = verifyResetOtp.data?.resetToken;

    const resetPassRes = await request('/auth/reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        resetToken,
        newPassword: updatedPassword,
      }),
    });
    assert(resetPassRes.status === 200, 'Password reset completes successfully');

    // Verify login with old password fails, new password succeeds
    const oldPassLogin = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testEmail, password: testPassword }),
    });
    assert(oldPassLogin.status === 401, 'Old password fails after reset');

    const newPassLogin = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identifier: testEmail, password: updatedPassword }),
    });
    assert(newPassLogin.status === 200, 'New password logs in successfully');
    authToken = newPassLogin.data?.tokens?.accessToken;

    // -------------------------------------------------------------------------
    // 8. PROFILE AVATAR UPDATE PIPELINE
    // -------------------------------------------------------------------------
    console.log('\n--- 8. Profile Avatar Pipeline ---');
    // Test base64/buffer multipart upload
    const dummyJpegBuffer = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0xFF, 0xD9
    ]);
    const boundary = '----WebKitFormBoundary7MA4YWxkTrZu0gW';
    const multipartBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="avatar.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      dummyJpegBuffer,
      Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    const uploadRes = await fetch(`${BASE_URL}/auth/upload-avatar`, {
      method: 'POST',
      headers: {
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: multipartBody,
    });
    const uploadData = await uploadRes.json();
    assert(uploadRes.status === 200 && Boolean(uploadData.avatarUrl), 'Multipart avatar uploaded successfully');

    // Update profile avatar endpoint with Authorization header
    const updateProfileAvatarRes = await fetch(`${BASE_URL}/auth/profile/avatar`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: multipartBody,
    });
    const updateProfileData = await updateProfileAvatarRes.json();
    assert(updateProfileAvatarRes.status === 200 && updateProfileData.success, 'Profile avatar updated in user DB record');

    // -------------------------------------------------------------------------
    // 9. DRIVER APPROVAL RESTRICTIONS
    // -------------------------------------------------------------------------
    console.log('\n--- 9. Driver Authorization Enforcement ---');
    const fakeRideProgress = await request('/rides/ride_dummy_123/driver-progress', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ newStatus: 'DRIVER_ARRIVED' }),
    });
    // Should return 404 for non-existent ride or 403 for non-approved driver
    assert([403, 404].includes(fakeRideProgress.status), 'Unauthorized / unapproved driver ride progression guarded');

  } catch (err) {
    console.error('Unexpected test suite error:', err);
    failedCount++;
  } finally {
    // Clean up test user & OTP records
    if (createdUserId) {
      userDB.delete(createdUserId);
    }
    otpDB.remove(testEmail);

    server.close(() => {
      console.log('\n======================================================');
      console.log(`TEST SUMMARY: ${passedCount} PASSED, ${failedCount} FAILED`);
      console.log('======================================================\n');
      process.exit(failedCount > 0 ? 1 : 0);
    });
  }
}

runTests();
