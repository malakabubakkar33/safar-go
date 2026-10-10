/**
 * SafarGo - Resilient Email Service via Resend API
 * Uses native HTTPS with forced IPv4 to eliminate Node.js undici connect timeouts on Windows
 */

import https from 'node:https';
import dotenv from 'dotenv';
dotenv.config();

function makeResendRequest(apiKey, fromEmail, toEmail, subject, html) {
  return new Promise((resolve, reject) => {
    const payload = JSON.stringify({
      from: fromEmail,
      to: [toEmail],
      subject,
      html,
    });

    const req = https.request('https://api.resend.com/emails', {
      method: 'POST',
      family: 4, // Explicitly force IPv4 to prevent Windows/undici socket hangs
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload),
      },
      timeout: 10000,
    }, (res) => {
      let rawData = '';
      res.on('data', (chunk) => {
        rawData += chunk;
      });

      res.on('end', () => {
        let parsed = {};
        try {
          parsed = JSON.parse(rawData);
        } catch {
          parsed = { raw: rawData };
        }

        if (res.statusCode >= 200 && res.statusCode < 300) {
          return resolve({ success: true, id: parsed.id });
        }

        const rawMsg = parsed.message || `Resend returned HTTP ${res.statusCode}`;
        const err = new Error(rawMsg);
        err.statusCode = res.statusCode;
        err.resendData = parsed;
        return reject(err);
      });
    });

    req.on('timeout', () => {
      req.destroy();
      const err = new Error('Connection to Resend timed out (10s).');
      err.code = 'ETIMEDOUT';
      reject(err);
    });

    req.on('error', (err) => {
      reject(err);
    });

    req.write(payload);
    req.end();
  });
}

export async function sendOtpEmail(toEmail, otpCode, fullName = 'Valued User') {
  if (process.env.MOCK_EMAIL === 'true') {
    global.__lastMockOtp = otpCode;
    console.log(`[Test Mock Email Service] Simulated email delivery to ${toEmail} (OTP: ${otpCode})`);
    return { success: true, id: `mock_msg_${Date.now()}` };
  }

  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  const fromEmail = process.env.EMAIL_FROM || 'SafarGo <onboarding@resend.dev>';

  if (!apiKey || apiKey.startsWith('re_your_')) {
    throw new Error('RESEND_API_KEY is not properly configured in .env.');
  }

  const subject = `${otpCode} is your SafarGo verification code`;

  const html = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>SafarGo Verification Code</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px; }
        .container { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.05); }
        .header { background: #16A34A; padding: 28px 24px; text-align: center; }
        .header h1 { color: #ffffff; font-size: 24px; font-weight: 800; margin: 0; letter-spacing: -0.02em; }
        .header p { color: rgba(255,255,255,0.85); font-size: 13px; margin: 4px 0 0; }
        .content { padding: 32px 28px; text-align: center; }
        .greeting { font-size: 16px; color: #1E293B; font-weight: 600; margin-bottom: 8px; }
        .instruction { font-size: 14px; color: #64748B; margin-bottom: 24px; line-height: 1.5; }
        .otp-box { background: #F0FDF4; border: 2px dashed #16A34A; border-radius: 12px; padding: 18px 24px; margin: 0 auto 24px; display: inline-block; }
        .otp-code { font-size: 34px; font-weight: 800; color: #15803D; letter-spacing: 8px; font-family: 'Courier New', Courier, monospace; margin: 0; }
        .expiry-note { font-size: 12px; color: #94A3B8; margin-bottom: 24px; }
        .security-note { font-size: 12px; color: #64748B; line-height: 1.5; border-top: 1px solid #F1F5F9; padding-top: 20px; }
        .footer { background: #F8FAFC; padding: 16px; text-align: center; font-size: 11px; color: #94A3B8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SafarGo</h1>
          <p>Your Ride, Your Way</p>
        </div>
        <div class="content">
          <div class="greeting">Hello, ${fullName}!</div>
          <div class="instruction">Use the 6-digit verification code below to verify your email address and continue setting up your SafarGo account.</div>
          
          <div class="otp-box">
            <div class="otp-code">${otpCode}</div>
          </div>
          
          <div class="expiry-note">⏱️ This code will expire in <strong>10 minutes</strong>.</div>
          
          <div class="security-note">
            If you did not request this code, someone may have entered your email by mistake. You can safely ignore this email. Never share this code with anyone.
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} SafarGo Technologies Inc. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;

  let lastError = null;
  // Retry loop: up to 2 attempts
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await makeResendRequest(apiKey, fromEmail, toEmail, subject, html);
      console.log(`[Resend Email Sent] Delivered to ${toEmail} | Message ID: ${result.id}`);
      return result;
    } catch (err) {
      lastError = err;
      console.error(`[Resend Attempt ${attempt} Failed]:`, err.message);

      // Handle Resend free tier restriction clearly and honestly
      if (err.statusCode === 403 || (err.message && err.message.includes('only send testing emails'))) {
        const customErr = new Error(
          'Email Delivery Notice: Resend test domain (onboarding@resend.dev) can only deliver to your registered account email (malikabubakkar523@gmail.com). To send to other addresses, please verify a custom domain on resend.com/domains or configure production SMTP.'
        );
        customErr.code = 'PROVIDER_SANDBOX_RESTRICTION';
        customErr.statusCode = 403;
        throw customErr;
      }

      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  throw lastError || new Error('Failed to deliver OTP email after 2 attempts.');
}
