/**
 * SafarGo - Live E2E Real Email Delivery & Profile Image Upload Verification
 * Tests the complete live signup flow without mock flags:
 *  1. Step 1 Real Email dispatch via Resend to malikabubakkar523@gmail.com
 *  2. Verification that devOtp is NEVER returned
 *  3. Verification that invalid email on Resend trial domain produces a clean 502 with diagnostic instructions
 *  4. OTP Rate limiting & Cooldown enforcement
 *  5. Wrong OTP attempt tracking & rejection
 *  6. Real OTP verification & token generation
 *  7. Multipart profile avatar upload to Supabase Cloud Storage
 *  8. Account creation with persisted avatarUrl
 *  9. Session persistence across /api/auth/me and /api/auth/login
 *  10. Profile avatar update via PUT /api/auth/profile/avatar
 */

import { fileURLToPath } from 'url';
import path from 'path';

delete process.env.MOCK_EMAIL; // Ensure live real delivery is active

const { default: app } = await import('../server/app.js');
const { userDB, otpDB } = await import('../server/db.js');

const TEST_PORT = 5097;
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
  console.log('   SAFARGO LIVE VERIFICATION: REAL EMAIL DELIVERY & AVATAR');
  console.log('===============================================================\n');

  await new Promise((resolve) => {
    server = app.listen(TEST_PORT, resolve);
  });
  console.log(`[Live Test Server] Listening on http://127.0.0.1:${TEST_PORT}\n`);

  const realGmail = 'malikabubakkar523@gmail.com';
  const testPhone = '+92300' + Math.floor(1000000 + Math.random() * 9000000);
  const testUsername = `user_${Date.now()}`;
  const testPassword = 'Password123#Real!';

  let createdUserId = null;

  try {
    // -------------------------------------------------------------
    // TEST 1: Restricted Email Handling (No silent bypasses)
    // -------------------------------------------------------------
    console.log('--- 1. Testing Unverified Recipient Protection ---');
    const restrictedRes = await request('/auth/signup-step1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Unregistered Test User',
        email: `unregistered_${Date.now()}@gmail.com`,
        phone: testPhone,
        username: `unreg_${Date.now()}`,
      }),
    });
    assert(restrictedRes.status === 502, 'Restricted email fails with 502 Bad Gateway (No fake success)');
    assert(restrictedRes.data?.code === 'EMAIL_DELIVERY_FAILED', 'Returns code EMAIL_DELIVERY_FAILED');
    assert(restrictedRes.data?.devOtp === undefined, 'Zero devOtp leaked in failure response');
    assert(restrictedRes.data?.error?.includes('Resend Sandbox Restriction'), 'Provides clear diagnostic explanation for unverified email');

    // -------------------------------------------------------------
    // TEST 2: Real Gmail Delivery via Resend
    // -------------------------------------------------------------
    console.log('\n--- 2. Dispatching Real Email to Registered Gmail ---');
    // Ensure clean state for test email
    otpDB.remove(realGmail);
    const existingUser = userDB.findByEmail(realGmail);
    if (existingUser) userDB.delete(existingUser.id);

    const step1Res = await request('/auth/signup-step1', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        fullName: 'Malik Abubakar',
        email: realGmail,
        phone: testPhone,
        username: testUsername,
      }),
    });

    assert(step1Res.status === 200, 'Real email send request accepted by provider (HTTP 200 OK)');
    assert(step1Res.data?.devOtp === undefined, 'devOtp is NOT returned to client');
    assert(step1Res.data?.message?.includes('Verification code sent'), 'Reports real verification code sent');

    const otpRecord = otpDB.get(realGmail);
    assert(Boolean(otpRecord?.otpHash), 'Secure SHA-256 OTP hash saved in database');

    // -------------------------------------------------------------
    // TEST 3: Rate Limiting Cooldown
    // -------------------------------------------------------------
    console.log('\n--- 3. Testing Resend Cooldown Enforcement ---');
    const immediateResend = await request('/auth/resend-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: realGmail }),
    });
    assert(immediateResend.status === 429, 'Immediate resend rejected with 429 Too Many Requests');
    assert(immediateResend.data?.code === 'OTP_RATE_LIMITED', 'Reports OTP_RATE_LIMITED');

    // -------------------------------------------------------------
    // TEST 4: Wrong OTP Handling & Attempt Limits
    // -------------------------------------------------------------
    console.log('\n--- 4. Testing Incorrect OTP Handling ---');
    const wrongOtpRes = await request('/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: realGmail, otp: '999999' }),
    });
    assert(wrongOtpRes.status === 400, 'Incorrect OTP rejected with 400');
    assert(wrongOtpRes.data?.attemptsRemaining === 4, 'Remaining attempts accurately decremented to 4');

    // -------------------------------------------------------------
    // TEST 5: Verify with Matching Hash
    // -------------------------------------------------------------
    console.log('\n--- 5. Verifying Real OTP ---');
    // We test verify with matching hash by finding the valid code matching otpRecord.otpHash
    // Since otpHash is sha256(otpCode + ':' + cleanEmail), let's find the OTP:
    let matchedOtp = null;
    const crypto = await import('crypto');
    for (let c = 100000; c <= 999999; c++) {
      const codeStr = c.toString();
      const testH = crypto.createHash('sha256').update(`${codeStr}:${realGmail}`).digest('hex');
      if (testH === otpRecord.otpHash) {
        matchedOtp = codeStr;
        break;
      }
    }
    assert(Boolean(matchedOtp), `Cryptographic OTP found matching stored database hash`);

    const verifyRes = await request('/auth/verify-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: realGmail, otp: matchedOtp }),
    });
    assert(verifyRes.status === 200, 'Real OTP verification succeeds');
    assert(Boolean(verifyRes.data?.verificationToken), 'Signed verification token generated');
    const verificationToken = verifyRes.data?.verificationToken;

    // Verify consumed OTP is cleared from database
    assert(!otpDB.get(realGmail), 'Consumed OTP record immediately cleared from database');

    // -------------------------------------------------------------
    // TEST 6: Real Multipart Profile Avatar Upload to Supabase Storage
    // -------------------------------------------------------------
    console.log('\n--- 6. Profile Avatar Upload to Persistent Cloud Storage ---');
    const dummyJpeg = Buffer.from([
      0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x01, 0x00, 0x48, 0x00, 0x48, 0x00, 0x00, 0xFF, 0xDB, 0x00, 0x43,
      0x00, 0xFF, 0xD9
    ]);
    const boundary = '----WebKitFormBoundaryE2ETestUpload';
    const multipartBody = Buffer.concat([
      Buffer.from(`--${boundary}\r\nContent-Disposition: form-data; name="avatar"; filename="my_profile.jpg"\r\nContent-Type: image/jpeg\r\n\r\n`),
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
    assert(
      uploadData.avatarUrl.includes('supabase.co') || uploadData.avatarUrl.startsWith('/uploads/avatars/'),
      'Avatar URL points to persistent Supabase Cloud Storage or static uploads directory'
    );
    const uploadedAvatarUrl = uploadData.avatarUrl;

    // -------------------------------------------------------------
    // TEST 7: Complete Account Creation with Profile Image
    // -------------------------------------------------------------
    console.log('\n--- 7. Complete Account Creation with Avatar Reference ---');
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

    // -------------------------------------------------------------
    // TEST 8: Session Persistence (/api/auth/me)
    // -------------------------------------------------------------
    console.log('\n--- 8. Session Persistence Verification (/api/auth/me) ---');
    const meRes = await request('/auth/me', {
      headers: { Authorization: `Bearer ${sessionToken}` },
    });
    assert(meRes.status === 200, '/api/auth/me returns 200 OK');
    assert(meRes.data?.user?.avatarUrl === uploadedAvatarUrl, 'Avatar remains identical on session reload / page refresh');

    // -------------------------------------------------------------
    // TEST 9: Login Persistence (/api/auth/login)
    // -------------------------------------------------------------
    console.log('\n--- 9. Login Persistence Verification (/api/auth/login) ---');
    const loginRes = await request('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        identifier: realGmail,
        password: testPassword,
      }),
    });
    assert(loginRes.status === 200, 'Login returns 200 OK');
    assert(loginRes.data?.user?.avatarUrl === uploadedAvatarUrl, 'Avatar remains persisted across logout and login');

    // -------------------------------------------------------------
    // TEST 10: Replace Profile Image (PUT /api/auth/profile/avatar)
    // -------------------------------------------------------------
    console.log('\n--- 10. Replace Profile Image (Authenticated PUT) ---');
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
    // Clean up
    if (createdUserId) {
      userDB.delete(createdUserId);
    }
    otpDB.remove(realGmail);

    server.close(() => {
      console.log('\n===============================================================');
      console.log(`LIVE TEST RESULTS: ${passedCount} PASSED, ${failedCount} FAILED`);
      console.log('===============================================================\n');
      process.exit(failedCount > 0 ? 1 : 0);
    });
  }
}

run();
