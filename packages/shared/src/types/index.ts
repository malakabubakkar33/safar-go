/**
 * SafarGo - Shared Enterprise Type Definitions
 */

export type UserRole = 'CUSTOMER' | 'PROVIDER' | 'ADMIN' | 'SUPERADMIN';
export type UserStatus = 'PENDING_VERIFICATION' | 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';

export interface UserProfile {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  username: string;
  avatarUrl?: string | null;
  isVerified: boolean;
  role: UserRole;
  status: UserStatus;
  createdAt: string;
  updatedAt?: string;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface AuthResponse {
  success: boolean;
  message: string;
  user: UserProfile;
  tokens: AuthTokens;
}

export interface SignupStep1Response {
  success: boolean;
  message: string;
  emailMasked: string;
  cooldownSeconds: number;
}

export interface VerifyOtpResponse {
  success: boolean;
  message: string;
  verificationToken: string;
}

export interface ResendOtpResponse {
  success: boolean;
  message: string;
  emailMasked: string;
  cooldownSeconds: number;
}

export interface AvatarUploadResponse {
  success: boolean;
  avatarUrl: string;
}

export interface ApiErrorResponse {
  statusCode: number;
  message: string | string[];
  error?: string;
  timestamp: string;
  path?: string;
}
