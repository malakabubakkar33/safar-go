/**
 * SafarGo Backend - Real Email Service via Resend API
 */

import dotenv from 'dotenv';
dotenv.config();

export interface SendOtpEmailOptions {
  toEmail: string;
  otpCode: string;
  fullName?: string;
}

export class MailService {
  private readonly apiKey: string;
  private readonly fromEmail: string;

  constructor() {
    this.apiKey = process.env.RESEND_API_KEY || '';
    this.fromEmail = process.env.EMAIL_FROM || 'SafarGo <onboarding@resend.dev>';
  }

  async sendOtpEmail({ toEmail, otpCode, fullName = 'Valued User' }: SendOtpEmailOptions): Promise<{ id: string }> {
    if (!this.apiKey || this.apiKey.trim() === '' || this.apiKey.startsWith('re_your_')) {
      throw new Error('RESEND_API_KEY is not configured in .env. Real email OTP delivery requires a valid Resend key.');
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

    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.apiKey.trim()}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.fromEmail,
        to: [toEmail],
        subject,
        html,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      console.error('[Resend Error]', data);
      throw new Error(data.message || 'Failed to send OTP email via Resend.');
    }

    return { id: data.id };
  }
}

export const mailService = new MailService();
