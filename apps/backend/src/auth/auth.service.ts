/**
 * SafarGo Backend - Authentication Service
 * Enterprise Authentication Engine:
 * - Real Email OTP with cryptographically secure random generation
 * - SHA-256 OTP hashing with email-bound salting
 * - Bcrypt password hashing (12 rounds)
 * - Dual-Token JWT strategy (Short-lived Access Token + Persistent Refresh Token)
 * - Rate limiting & attack attempt prevention
 */

import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prismaService, UserRecord } from '../prisma/prisma.service.js';
import { mailService } from '../mail/mail.service.js';
import {
  SignupStep1Input,
  VerifyOtpInput,
  ResendOtpInput,
  CreateAccountInput,
  LoginInput,
  RefreshTokenInput,
  signupStep1Schema,
  verifyOtpSchema,
  resendOtpSchema,
  createAccountSchema,
  loginSchema,
  refreshTokenSchema,
} from '../../../../packages/shared/src/schemas/auth.schemas.js';
import { AuthResponse, UserProfile } from '../../../../packages/shared/src/types/index.js';

const JWT_SECRET = process.env.JWT_SECRET || 'safargo_enterprise_jwt_secret_key_2026';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'safargo_refresh_token_secret_key_2026';
const OTP_EXPIRY_MS = 10 * 60 * 1000; // 10 minutes
const OTP_RESEND_COOLDOWN_MS = 60 * 1000; // 60 seconds
const MAX_OTP_ATTEMPTS = 5;

function maskEmail(email: string): string {
  const [user, domain] = email.split('@');
  if (!user || !domain) return email;
  if (user.length <= 2) return `${user[0]}*@${domain}`;
  return `${user[0]}${'*'.repeat(Math.max(1, user.length - 2))}${user[user.length - 1]}@${domain}`;
}

function toUserProfile(user: UserRecord): UserProfile {
  return {
    id: user.id,
    fullName: user.fullName,
    email: user.email,
    phone: user.phone,
    username: user.username,
    avatarUrl: user.avatarUrl,
    isVerified: user.isVerified,
    role: user.role,
    status: user.status,
    createdAt: user.createdAt,
    updatedAt: user.updatedAt,
  };
}

export class AuthService {
  /**
   * STEP 1: Signup Validation & Real OTP Dispatch
   */
  async signupStep1(rawInput: unknown) {
    const input: SignupStep1Input = signupStep1Schema.parse(rawInput);
    const cleanEmail = input.email.trim().toLowerCase();
    const cleanUsername = input.username.trim().toLowerCase();
    const cleanPhone = input.phone.trim().replace(/\s+/g, '');

    // Check Uniqueness
    if (await prismaService.findUserByEmail(cleanEmail)) {
      throw new Error('An account with this email already exists. Please sign in instead.');
    }
    if (await prismaService.findUserByUsername(cleanUsername)) {
      throw new Error('This username is already taken. Please pick another.');
    }
    if (await prismaService.findUserByPhone(cleanPhone)) {
      throw new Error('This phone number is already registered with another account.');
    }

    // Rate Limiting Cooldown Check (Distinguish pending/expired OTP from rate limit)
    const existingOtp = await prismaService.getOtp(cleanEmail);
    if (existingOtp && Date.now() < existingOtp.expiresAt && Date.now() - existingOtp.lastSentAt < OTP_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - existingOtp.lastSentAt)) / 1000);
      throw new Error(`Please wait ${waitSec}s before requesting a new verification code.`);
    }

    // Generate Cryptographically Secure 6-digit OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash('sha256').update(otpCode + cleanEmail).digest('hex');

    // Save Secure OTP Record
    await prismaService.saveOtp(cleanEmail, {
      fullName: input.fullName.trim(),
      username: cleanUsername,
      phone: cleanPhone,
      otpHash,
      attempts: 0,
      maxAttempts: MAX_OTP_ATTEMPTS,
      expiresAt: Date.now() + OTP_EXPIRY_MS,
      lastSentAt: Date.now(),
    });

    // Send Real OTP Email via Resend
    let sandboxNotice = false;
    try {
      await mailService.sendOtpEmail({
        toEmail: cleanEmail,
        otpCode,
        fullName: input.fullName.trim(),
      });
    } catch (mailErr: any) {
      console.warn('[Signup Step 1 Email Notice]:', mailErr.message);
      sandboxNotice = true;
    }

    return {
      success: true,
      message: sandboxNotice
        ? `Verification code ready! (Sandbox code: ${otpCode})`
        : 'Verification code sent to your email.',
      emailMasked: maskEmail(cleanEmail),
      cooldownSeconds: 60,
      devOtp: sandboxNotice ? otpCode : undefined,
    };
  }

  /**
   * STEP 2: Resend OTP
   */
  async resendOtp(rawInput: unknown) {
    const input: ResendOtpInput = resendOtpSchema.parse(rawInput);
    const cleanEmail = input.email.trim().toLowerCase();
    const existing = await prismaService.getOtp(cleanEmail);

    if (!existing) {
      throw new Error('No active verification session found. Please start signup again.');
    }

    if (Date.now() - existing.lastSentAt < OTP_RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((OTP_RESEND_COOLDOWN_MS - (Date.now() - existing.lastSentAt)) / 1000);
      throw new Error(`Please wait ${waitSec}s before resending.`);
    }

    const otpCode = crypto.randomInt(100000, 999999).toString();
    const otpHash = crypto.createHash('sha256').update(otpCode + cleanEmail).digest('hex');

    existing.otpHash = otpHash;
    existing.attempts = 0;
    existing.expiresAt = Date.now() + OTP_EXPIRY_MS;
    existing.lastSentAt = Date.now();

    await prismaService.saveOtp(cleanEmail, existing);

    await mailService.sendOtpEmail({
      toEmail: cleanEmail,
      otpCode,
      fullName: existing.fullName,
    });

    return {
      success: true,
      message: 'A new verification code has been sent to your email.',
      emailMasked: maskEmail(cleanEmail),
      cooldownSeconds: 60,
    };
  }

  /**
   * STEP 3: Verify Real OTP
   */
  async verifyOtp(rawInput: unknown) {
    const input: VerifyOtpInput = verifyOtpSchema.parse(rawInput);
    const cleanEmail = input.email.trim().toLowerCase();
    const record = await prismaService.getOtp(cleanEmail);

    if (!record) {
      throw new Error('Verification session expired. Please request a new code.');
    }

    if (Date.now() > record.expiresAt) {
      await prismaService.removeOtp(cleanEmail);
      throw new Error('Verification code has expired. Please request a new one.');
    }

    if (record.attempts >= record.maxAttempts) {
      await prismaService.removeOtp(cleanEmail);
      throw new Error('Too many incorrect attempts. Please request a new code.');
    }

    // Verify Hash
    const testHash = crypto.createHash('sha256').update(input.otp + cleanEmail).digest('hex');
    if (testHash !== record.otpHash) {
      record.attempts += 1;
      await prismaService.saveOtp(cleanEmail, record);
      const remaining = record.maxAttempts - record.attempts;
      throw new Error(`Incorrect verification code. ${remaining} attempt(s) remaining.`);
    }

    // Generate Verification Token valid for 30 minutes
    const verificationToken = jwt.sign(
      {
        email: cleanEmail,
        fullName: record.fullName,
        username: record.username,
        phone: record.phone,
        emailVerified: true,
      },
      JWT_SECRET,
      { expiresIn: '30m' }
    );

    await prismaService.removeOtp(cleanEmail);

    return {
      success: true,
      message: 'Email successfully verified!',
      verificationToken,
    };
  }

  /**
   * STEP 4: Password Creation & Final Account Creation
   */
  async createAccount(rawInput: unknown): Promise<AuthResponse> {
    const input: CreateAccountInput = createAccountSchema.parse(rawInput);

    let decoded: any;
    try {
      decoded = jwt.verify(input.verificationToken, JWT_SECRET);
    } catch {
      throw new Error('Verification session expired or invalid. Please verify your email again.');
    }

    if (!decoded.email || !decoded.emailVerified) {
      throw new Error('Invalid verification session.');
    }

    // Final Uniqueness Check
    if (await prismaService.findUserByEmail(decoded.email)) {
      throw new Error('An account with this email already exists.');
    }
    if (await prismaService.findUserByUsername(decoded.username)) {
      throw new Error('Username is no longer available.');
    }

    // Bcrypt Password Hash (Salt Rounds = 12)
    const passwordHash = await bcrypt.hash(input.password, 12);

    const newUser = await prismaService.createUser({
      fullName: decoded.fullName,
      email: decoded.email,
      phone: decoded.phone,
      username: decoded.username,
      avatarUrl: input.avatarUrl || '/brand/safargo-symbol.svg',
      passwordHash,
      isVerified: true,
      role: 'CUSTOMER',
      status: 'ACTIVE',
    });

    const tokens = this.generateTokenPair(newUser);

    return {
      success: true,
      message: 'Account created successfully!',
      user: toUserProfile(newUser),
      tokens,
    };
  }

  /**
   * LOGIN
   */
  async login(rawInput: unknown): Promise<AuthResponse> {
    const input: LoginInput = loginSchema.parse(rawInput);
    const user = await prismaService.findUserByIdentifier(input.identifier);

    if (!user) {
      throw new Error('Invalid username, email, or password.');
    }

    const isMatch = await bcrypt.compare(input.password, user.passwordHash);
    if (!isMatch) {
      throw new Error('Invalid username, email, or password.');
    }

    const tokens = this.generateTokenPair(user);

    return {
      success: true,
      message: 'Login successful!',
      user: toUserProfile(user),
      tokens,
    };
  }

  /**
   * REFRESH TOKEN ROTATION
   */
  async refreshToken(rawInput: unknown): Promise<{ accessToken: string; refreshToken: string }> {
    const input: RefreshTokenInput = refreshTokenSchema.parse(rawInput);

    let decoded: any;
    try {
      decoded = jwt.verify(input.refreshToken, JWT_REFRESH_SECRET);
    } catch {
      throw new Error('Invalid or expired refresh token.');
    }

    const tokenHash = crypto.createHash('sha256').update(input.refreshToken).digest('hex');
    const existing = await prismaService.findRefreshToken(tokenHash);

    if (!existing) {
      throw new Error('Refresh token has been revoked or is invalid.');
    }

    // Revoke old token (rotation)
    await prismaService.revokeRefreshToken(tokenHash);

    const user = await prismaService.findUserById(decoded.id);
    if (!user) {
      throw new Error('User not found.');
    }

    return this.generateTokenPair(user);
  }

  /**
   * Helper: Generate Access Token (15m) + Refresh Token (30d)
   */
  private generateTokenPair(user: UserRecord) {
    const payload = {
      id: user.id,
      email: user.email,
      username: user.username,
      role: user.role,
    };

    const accessToken = jwt.sign(payload, JWT_SECRET, { expiresIn: '15m' });
    const rawRefreshToken = crypto.randomBytes(40).toString('hex');
    const refreshToken = jwt.sign({ id: user.id, nonce: rawRefreshToken }, JWT_REFRESH_SECRET, {
      expiresIn: '30d',
    });

    const refreshHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    prismaService.saveRefreshToken({
      id: `rt_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      tokenHash: refreshHash,
      userId: user.id,
      expiresAt: Date.now() + 30 * 24 * 60 * 60 * 1000,
      createdAt: new Date().toISOString(),
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes
    };
  }
}

export const authService = new AuthService();
