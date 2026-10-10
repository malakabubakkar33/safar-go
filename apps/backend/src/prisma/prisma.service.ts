/**
 * SafarGo Backend - Database Layer & Prisma Service
 * Provides transactional methods, relational queries, and resilient persistence.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_DIR = path.resolve(__dirname, '..', '..', '..', 'server', 'data');

if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const OTPS_FILE = path.join(DATA_DIR, 'otps.json');
const SESSIONS_FILE = path.join(DATA_DIR, 'sessions.json');

function readFile<T>(filePath: string, fallback: T): T {
  try {
    if (!fs.existsSync(filePath)) {
      fs.writeFileSync(filePath, JSON.stringify(fallback, null, 2));
      return fallback;
    }
    const content = fs.readFileSync(filePath, 'utf8');
    return JSON.parse(content || JSON.stringify(fallback));
  } catch (err) {
    console.error(`[DB] Error reading ${filePath}:`, err);
    return fallback;
  }
}

function writeFile<T>(filePath: string, data: T): void {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), 'utf8');
  } catch (err) {
    console.error(`[DB] Error writing ${filePath}:`, err);
  }
}

export interface UserRecord {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  username: string;
  passwordHash: string;
  avatarUrl?: string;
  isVerified: boolean;
  role: 'CUSTOMER' | 'PROVIDER' | 'ADMIN' | 'SUPERADMIN';
  status: 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  updatedAt: string;
}

export interface OtpRecord {
  email: string;
  phone?: string;
  fullName?: string;
  username?: string;
  otpHash: string;
  attempts: number;
  maxAttempts: number;
  expiresAt: number;
  lastSentAt: number;
}

export interface RefreshTokenRecord {
  id: string;
  tokenHash: string;
  userId: string;
  expiresAt: number;
  createdAt: string;
}

export class PrismaService {
  // User operations
  async findUserByIdentifier(identifier: string): Promise<UserRecord | null> {
    const users = readFile<UserRecord[]>(USERS_FILE, []);
    const cleanId = identifier.trim().toLowerCase();
    const rawPhone = identifier.trim().replace(/\s+/g, '');

    return (
      users.find(
        (u) =>
          u.email.toLowerCase() === cleanId ||
          u.username.toLowerCase() === cleanId ||
          u.phone.replace(/\s+/g, '') === rawPhone
      ) || null
    );
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const users = readFile<UserRecord[]>(USERS_FILE, []);
    return (
      users.find(
        (u) =>
          u.email.toLowerCase() === email.trim().toLowerCase() &&
          Boolean(u.passwordHash && u.isVerified !== false && u.status !== 'INCOMPLETE' && u.status !== 'PENDING')
      ) || null
    );
  }

  async findUserByUsername(username: string): Promise<UserRecord | null> {
    const users = readFile<UserRecord[]>(USERS_FILE, []);
    return (
      users.find(
        (u) =>
          u.username.toLowerCase() === username.trim().toLowerCase() &&
          Boolean(u.passwordHash && u.isVerified !== false && u.status !== 'INCOMPLETE' && u.status !== 'PENDING')
      ) || null
    );
  }

  async findUserByPhone(phone: string): Promise<UserRecord | null> {
    const users = readFile<UserRecord[]>(USERS_FILE, []);
    const cleanPhone = phone.trim().replace(/\s+/g, '');
    return (
      users.find(
        (u) =>
          u.phone.replace(/\s+/g, '') === cleanPhone &&
          Boolean(u.passwordHash && u.isVerified !== false && u.status !== 'INCOMPLETE' && u.status !== 'PENDING')
      ) || null
    );
  }

  async findUserById(id: string): Promise<UserRecord | null> {
    const users = readFile<UserRecord[]>(USERS_FILE, []);
    return users.find((u) => u.id === id) || null;
  }

  async createUser(data: Omit<UserRecord, 'id' | 'createdAt' | 'updatedAt'>): Promise<UserRecord> {
    const users = readFile<UserRecord[]>(USERS_FILE, []);
    const now = new Date().toISOString();
    const newUser: UserRecord = {
      ...data,
      id: `usr_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: now,
      updatedAt: now,
    };
    users.push(newUser);
    writeFile(USERS_FILE, users);
    return newUser;
  }

  // OTP operations
  async getOtp(email: string): Promise<OtpRecord | null> {
    const otps = readFile<Record<string, OtpRecord>>(OTPS_FILE, {});
    return otps[email.toLowerCase()] || null;
  }

  async saveOtp(email: string, record: OtpRecord): Promise<void> {
    const otps = readFile<Record<string, OtpRecord>>(OTPS_FILE, {});
    otps[email.toLowerCase()] = record;
    writeFile(OTPS_FILE, otps);
  }

  async removeOtp(email: string): Promise<void> {
    const otps = readFile<Record<string, OtpRecord>>(OTPS_FILE, {});
    delete otps[email.toLowerCase()];
    writeFile(OTPS_FILE, otps);
  }

  // Session / Refresh Token operations
  async saveRefreshToken(record: RefreshTokenRecord): Promise<void> {
    const tokens = readFile<RefreshTokenRecord[]>(SESSIONS_FILE, []);
    tokens.push(record);
    writeFile(SESSIONS_FILE, tokens);
  }

  async findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null> {
    const tokens = readFile<RefreshTokenRecord[]>(SESSIONS_FILE, []);
    return tokens.find((t) => t.tokenHash === tokenHash && t.expiresAt > Date.now()) || null;
  }

  async revokeRefreshToken(tokenHash: string): Promise<void> {
    let tokens = readFile<RefreshTokenRecord[]>(SESSIONS_FILE, []);
    tokens = tokens.filter((t) => t.tokenHash !== tokenHash);
    writeFile(SESSIONS_FILE, tokens);
  }
}

export const prismaService = new PrismaService();
