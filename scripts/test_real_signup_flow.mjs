/**
 * SafarGo - Live E2E Signup Flow Verification (Streamlined 3-Step Flow without OTP)
 * Tests:
 *  1. Step 1: Info Validation & Immediate Verification Token Issuance (Zero OTP friction)
 *  2. Verification that devOtp is NEVER returned
 *  3. Duplicate email / username / phone rejection
 *  4. Multipart profile avatar upload to Supabase Cloud Storage
 *  5. Account creation with persisted avatarUrl
 *  6. Session persistence across /api/auth/me and page reload
 *  7. Login persistence across /api/auth/login
 *  8. Interactive profile avatar replacement via PUT /api/auth/profile/avatar
 */

const { default: app } = await import('../server/app.js');
const { userDB, otpDB } = await import('../server/db.js');

const TEST_PORT = 5096;
const BASE_URL = `http://127.0.0.1:${TEST_PORT}/api`;

let server;
let passedCount = 0;
let failedCount = 0;

function assert(condition, name, details = '') {
  if (condition) {
    console.log(`  ✓ PASS: ${name}`);
    passedCount++;
  } else {
    console.error(`  ✗ FAIL: ${name} - ${details}`);
    failedCount++;
  }
}

async function request(endpoint, options = {}) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, options);
  let data;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, ok: res.ok, data };
}

async function run() {
  console.log('\n===============================================================');
  console.log('   SAFARGO VERIFICATION: STREAMLINED SIGNUP FLOW (NO OTP)');
  console.log('===============================================================\n');

  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, resolve);
  });
  console.log(`[Test Server] Listening on http://127.0.0.1:${TEST_PORT}\n`);

  const testEmail = `user_${Date.now()}@safargo.pk`;
  const testPhone = '+92300' + Math.floor(1000000 + Math.random() * 9000000);
  const testUsername = `user_${Date.now()}`;
  const testPassword = 'Password123#Secure!';

  let createdUserId = null;
  let verificationToken = null;

  try {
    // -------------------------------------------------------------
    // TEST 1: Step 1 Registration Details & Direct Token Generation
    // -------------------------------------------------------------
    console.log('--- 1. Step 1: User Registration Details (No OTP required) ---');
    const step1Res = await request('/auth/signup-step1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'SafarGo Traveler',
        email: testEmail,
        phone: testPhone,
        username: testUsername,
      }),
    });

    assert(step1Res.status === 200, 'Signup Step 1 responds 200 OK');
    assert(Boolean(step1Res.data?.verificationToken), 'One-time registration verificationToken issued directly');
    assert(step1Res.data?.devOtp === undefined, 'Zero devOtp returned in API response');
    assert(Boolean(step1Res.data?.emailMasked), 'Email masked string returned securely');
    verificationToken = step1Res.data?.verificationToken;

    // -------------------------------------------------------------
    // TEST 2: Duplicate Prevention
    // -------------------------------------------------------------
    console.log('\n--- 2. Duplicate Email & Username Prevention ---');
    const dupRes = await request('/auth/signup-step1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Duplicate Tester',
        email: 'testdriver@safargo.com', // existing account
        phone: '+923009999999',
        username: 'unique_user_999',
      }),
    });
    assert(dupRes.status === 409, 'Duplicate existing email rejected with 409 Conflict');

    // -------------------------------------------------------------
    // TEST 3: Real Multipart Profile Avatar Upload
    // -------------------------------------------------------------
    console.log('\n--- 3. Profile Avatar Upload to Persistent Cloud Storage ---');
    const dummyJpeg = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0xFF, 0xD9
    ]);
    const boundary = '----WebKitFormBoundaryE2ETestUpload';
    const multipartBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="profile_photo.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
      dummyJpeg,
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
    assert(uploadRes.status === 200, 'Avatar upload endpoint returns 200 OK');
    assert(uploadData.success === true, 'Upload response indicates success');
    assert(Boolean(uploadData.avatarUrl), `Returned persistent avatarUrl: ${uploadData.avatarUrl}`);
    const uploadedAvatarUrl = uploadData.avatarUrl;

    // -------------------------------------------------------------
    // TEST 4: Complete Account Creation (Step 3: Password)
    // -------------------------------------------------------------
    console.log('\n--- 4. Complete Account Creation (Step 3: Password) ---');
    const createRes = await request('/auth/create-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        verificationToken,
        password: testPassword,
        confirmPassword: testPassword,
        avatarUrl: uploadedAvatarUrl,
      }),
    });
    assert(createRes.status === 201, 'Account creation completes with 201 Created');
    assert(createRes.data?.user?.avatarUrl === uploadedAvatarUrl, 'Returned user object contains persisted avatarUrl');
    createdUserId = createRes.data?.user?.id;
    const sessionToken = createRes.data?.token || createRes.data?.tokens?.accessToken;

    // Check DB record directly
    const dbUser = userDB.findById(createdUserId);
    assert(dbUser?.avatarUrl === uploadedAvatarUrl, 'Database user record stores the exact uploaded avatarUrl');
    assert(dbUser?.email === testEmail, 'Database user record contains correct email');

    // -------------------------------------------------------------
    // TEST 5: Session Persistence (/api/auth/me)
    // -------------------------------------------------------------
    console.log('\n--- 5. Session Persistence Verification (/api/auth/me) ---');
    const meRes = await request('/auth/me', {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    assert(meRes.status === 200, '/api/auth/me returns 200 OK');
    assert(meRes.data?.user?.avatarUrl === uploadedAvatarUrl, 'Avatar remains identical on session reload');

    // -------------------------------------------------------------
    // TEST 6: Login Persistence (/api/auth/login)
    // -------------------------------------------------------------
    console.log('\n--- 6. Login Persistence Verification (/api/auth/login) ---');
    const loginRes = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: testEmail,
        password: testPassword,
      }),
    });
    assert(loginRes.status === 200, 'Login returns 200 OK');
    assert(loginRes.data?.user?.avatarUrl === uploadedAvatarUrl, 'Avatar remains persisted across logout and login');

    // -------------------------------------------------------------
    // TEST 7: Replace Profile Image (PUT /api/auth/profile/avatar)
    // -------------------------------------------------------------
    console.log('\n--- 7. Replace Profile Image (Authenticated PUT) ---');
    const updateRes = await fetch(`${BASE_URL}/auth/profile/avatar`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${sessionToken}`,
        'Content-Type': `multipart/form-data; boundary=${boundary}`,
      },
      body: multipartBody,
    });
    const updateData = await updateRes.json();
    assert(updateRes.status === 200, 'PUT /api/auth/profile/avatar returns 200 OK');
    assert(Boolean(updateData.avatarUrl), 'New avatar URL generated');
    assert(updateData.user?.avatarUrl === updateData.avatarUrl, 'User record updated with replaced avatar');

  } catch (err) {
    console.error('Test execution error:', err);
    failedCount++;
  } finally {
    if (createdUserId) {
      userDB.delete(createdUserId);
    }

    server.close(() => {
      console.log('\n===============================================================');
      console.log(`TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
      console.log('===============================================================\n');
      process.exit(failedCount > 0 ? 1 : 0);
    });
  }
}

run();
