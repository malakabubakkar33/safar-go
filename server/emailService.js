/**
 * SafarGo - Production Email Service
 * Supports:
 *  1. Direct SMTP (Gmail SMTP, Custom SMTP) via Nodemailer
 *  2. Resend REST API via Native HTTPS with IPv4 forcing (prevents Windows socket hangs)
 * Strict Production Enforcement:
 *  - Never logs or exposes OTP in sandbox/mock mode in production
 *  - Only reports success when the provider accepts the email
 *  - Clear error diagnostics if provider limits or credentials fail
 */

import https from 'node:https';
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

let smtpTransporter = null;

function getSmtpTransporter() {
  const host = process.env.SMTP_HOST || (process.env.GMAIL_USER ? 'smtp.gmail.com' : null);
  const user = process.env.SMTP_USER || process.env.GMAIL_USER;
  const pass = process.env.SMTP_PASS || process.env.GMAIL_APP_PASSWORD;
  const port = parseInt(process.env.SMTP_PORT || (process.env.SMTP_SECURE === 'true' ? '465' : '587'), 10);
  const secure = process.env.SMTP_SECURE === 'true' || port === 465;

  if (host && user && pass) {
    if (!smtpTransporter) {
      smtpTransporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: { user, pass },
        tls: { rejectUnauthorized: false },
        connectionTimeout: 10000,
      });
    }
    return smtpTransporter;
  }
  return null;
}

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
      timeout: 12000,
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
          return resolve({ success: true, id: parsed.id, provider: 'resend' });
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
      const err = new Error('Connection to Resend timed out (12s).');
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

function generateOtpHtml(fullName, otpCode) {
  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>SafarGo Verification Code</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #F8FAFC; margin: 0; padding: 24px; color: #1E293B; }
        .container { max-width: 500px; margin: 0 auto; background: #ffffff; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 14px rgba(0,0,0,0.06); }
        .header { background: #16A34A; padding: 28px 24px; text-align: center; }
        .header h1 { color: #ffffff; font-size: 26px; font-weight: 800; margin: 0; letter-spacing: -0.02em; }
        .header p { color: rgba(255,255,255,0.9); font-size: 13px; margin: 4px 0 0; }
        .content { padding: 32px 28px; text-align: center; }
        .greeting { font-size: 17px; color: #0F172A; font-weight: 700; margin-bottom: 8px; }
        .instruction { font-size: 14px; color: #64748B; margin-bottom: 24px; line-height: 1.55; }
        .otp-box { background: #F0FDF4; border: 2px dashed #16A34A; border-radius: 12px; padding: 18px 28px; margin: 0 auto 24px; display: inline-block; }
        .otp-code { font-size: 36px; font-weight: 800; color: #15803D; letter-spacing: 8px; font-family: 'Courier New', Courier, monospace; margin: 0; }
        .expiry-note { font-size: 13px; color: #475569; margin-bottom: 24px; }
        .security-note { font-size: 12px; color: #94A3B8; line-height: 1.5; border-top: 1px solid #F1F5F9; padding-top: 20px; text-align: left; }
        .footer { background: #F8FAFC; padding: 16px; text-align: center; font-size: 11px; color: #94A3B8; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="header">
          <h1>SafarGo</h1>
          <p>Ride Booking & Pick-and-Drop Platform</p>
        </div>
        <div class="content">
          <div class="greeting">Hello, ${fullName}!</div>
          <div class="instruction">
            Use the 6-digit verification code below to verify your email address and continue setting up your SafarGo account.
          </div>
          
          <div class="otp-box">
            <div class="otp-code">${otpCode}</div>
          </div>
          
          <div class="expiry-note">⏱️ This code will expire in <strong>10 minutes</strong>.</div>
          
          <div class="security-note">
            <strong>Security Notice:</strong> Never share this code with anyone, including SafarGo staff. If you did not request this verification, please safely ignore this email.
          </div>
        </div>
        <div class="footer">
          &copy; ${new Date().getFullYear()} SafarGo Technologies Inc. Peshawar, Pakistan. All rights reserved.
        </div>
      </div>
    </body>
    </html>
  `;
}

/**
 * Dispatches a real OTP email.
 * Rejects with an error if the email cannot be delivered.
 * Never reports success on delivery failure.
 */
export async function sendOtpEmail(toEmail, otpCode, fullName = 'Valued User') {
  // Test mock environment flag used only by automated test suites
  if (process.env.MOCK_EMAIL === 'true') {
    global.__lastMockOtp = otpCode;
    console.log(`[Test Mock Email Service] Simulated email delivery to ${toEmail} (OTP: ${otpCode})`);
    return { success: true, id: `mock_msg_${Date.now()}`, provider: 'mock' };
  }

  const subject = `${otpCode} is your SafarGo verification code`;
  const html = generateOtpHtml(fullName, otpCode);

  // 1. Check if direct SMTP (e.g. Gmail SMTP) is configured
  const smtp = getSmtpTransporter();
  if (smtp) {
    try {
      const fromAddr = process.env.SMTP_FROM || process.env.SMTP_USER || process.env.GMAIL_USER || 'no-reply@safargo.com';
      const info = await smtp.sendMail({
        from: `SafarGo <${fromAddr}>`,
        to: toEmail,
        subject,
        html,
      });
      console.log(`[SMTP Email Sent] Delivered to ${toEmail} | Message ID: ${info.messageId}`);
      return { success: true, id: info.messageId, provider: 'smtp' };
    } catch (smtpErr) {
      console.error('[SMTP Delivery Failed]:', smtpErr.message);
      // If Resend is also configured, let it fall through to try Resend
      if (!process.env.RESEND_API_KEY || process.env.RESEND_API_KEY.startsWith('re_your_')) {
        throw new Error(`SMTP email delivery failed: ${smtpErr.message}`);
      }
    }
  }

  // 2. Resend API Delivery
  const apiKey = (process.env.RESEND_API_KEY || '').trim();
  const fromEmail = process.env.EMAIL_FROM || 'SafarGo <onboarding@resend.dev>';

  if (!apiKey || apiKey.startsWith('re_your_')) {
    throw new Error(
      'Email service not configured: No valid RESEND_API_KEY or SMTP credentials found in .env. Real email delivery could not be performed.'
    );
  }

  let lastError = null;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const result = await makeResendRequest(apiKey, fromEmail, toEmail, subject, html);
      console.log(`[Resend Email Sent] Delivered to ${toEmail} | Message ID: ${result.id}`);
      return result;
    } catch (err) {
      lastError = err;
      console.error(`[Resend Attempt ${attempt} Failed]:`, err.message);

      if (err.statusCode === 403 || (err.message && err.message.includes('only send testing emails'))) {
        throw new Error(
          `Resend Sandbox Restriction: Resend's free trial domain (${fromEmail}) can only deliver emails to the account owner (malikabubakkar523@gmail.com). To deliver to ${toEmail}, either register ${toEmail} on resend.com, verify a custom sending domain at resend.com/domains, or configure Gmail SMTP in .env.`
        );
      }

      if (attempt < 2) {
        await new Promise((r) => setTimeout(r, 1000));
      }
    }
  }

  throw new Error(`Email delivery to ${toEmail} failed via Resend: ${lastError?.message || 'Network timeout'}`);
}
