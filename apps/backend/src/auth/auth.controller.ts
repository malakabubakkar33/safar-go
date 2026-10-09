/**
 * SafarGo Backend - Auth Controller
 */

import { Router, Request, Response } from 'express';
import multer from 'multer';
import path from 'path';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import { fileURLToPath } from 'url';
import { authService } from './auth.service.js';
import { prismaService } from '../prisma/prisma.service.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const JWT_SECRET = process.env.JWT_SECRET || 'safargo_enterprise_jwt_secret_key_2026';

export const authRouter = Router();

// Multer Storage for Avatars
const uploadDir = path.resolve(__dirname, '..', '..', '..', 'public', 'uploads', 'avatars');
const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, uploadDir);
  },
  filename: (_req, file, cb) => {
    const uniqueSuffix = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    cb(null, `avatar-${uniqueSuffix}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
    if (allowed.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed.'));
    }
  },
});

// Step 1: Info Validation + Real OTP Dispatch
authRouter.post('/signup-step1', async (req: Request, res: Response) => {
  try {
    const result = await authService.signupStep1(req.body);
    return res.status(200).json(result);
  } catch (err: any) {
    const status = err.name === 'ZodError' ? 400 : err.message.includes('already') ? 409 : 400;
    const msg = err.errors ? err.errors[0]?.message : err.message;
    return res.status(status).json({ error: msg || 'Validation failed' });
  }
});

// Resend OTP
authRouter.post('/resend-otp', async (req: Request, res: Response) => {
  try {
    const result = await authService.resendOtp(req.body);
    return res.status(200).json(result);
  } catch (err: any) {
    const status = err.message.includes('wait') ? 429 : 400;
    return res.status(status).json({ error: err.message });
  }
});

// Verify Real OTP
authRouter.post('/verify-otp', async (req: Request, res: Response) => {
  try {
    const result = await authService.verifyOtp(req.body);
    return res.status(200).json(result);
  } catch (err: any) {
    const status = err.message.includes('expired') ? 410 : err.message.includes('attempt') ? 400 : 400;
    return res.status(status).json({ error: err.message });
  }
});

// Upload Avatar
authRouter.post('/upload-avatar', upload.single('avatar'), (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file uploaded.' });
    }
    const avatarUrl = `/uploads/avatars/${req.file.filename}`;
    return res.json({ success: true, avatarUrl });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || 'Failed to upload photo.' });
  }
});

// Step 4: Password Creation & Final Account Creation
authRouter.post('/create-account', async (req: Request, res: Response) => {
  try {
    const result = await authService.createAccount(req.body);
    // Return backward-compatible session token alongside dual tokens
    return res.status(201).json({
      ...result,
      token: result.tokens.accessToken,
    });
  } catch (err: any) {
    const status = err.name === 'ZodError' ? 400 : err.message.includes('already') ? 409 : 400;
    const msg = err.errors ? err.errors[0]?.message : err.message;
    return res.status(status).json({ error: msg || 'Account creation failed' });
  }
});

// Login
authRouter.post('/login', async (req: Request, res: Response) => {
  try {
    const result = await authService.login(req.body);
    return res.status(200).json({
      ...result,
      token: result.tokens.accessToken,
    });
  } catch (err: any) {
    return res.status(401).json({ error: err.message || 'Login failed' });
  }
});

// Refresh Token
authRouter.post('/refresh-token', async (req: Request, res: Response) => {
  try {
    const result = await authService.refreshToken(req.body);
    return res.status(200).json(result);
  } catch (err: any) {
    return res.status(401).json({ error: err.message });
  }
});

// /me - Current Authenticated User
authRouter.get('/me', async (req: Request, res: Response) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized.' });
    }
    const token = authHeader.split(' ')[1];
    const decoded: any = jwt.verify(token, JWT_SECRET);
    const user = await prismaService.findUserById(decoded.id);

    if (!user) return res.status(404).json({ error: 'User not found.' });

    const safeUser = { ...user };
    delete (safeUser as any).passwordHash;
    return res.json({ user: safeUser });
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token.' });
  }
});
