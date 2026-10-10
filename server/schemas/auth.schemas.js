/**
 * SafarGo - Backend Authentication & Form Validation Schemas (ESM)
 */

import { z } from 'zod';

export const phoneRegex = /^[+]?[(]?[0-9]{1,4}[)]?[-\s./0-9]{6,16}$/;
export const usernameRegex = /^[a-zA-Z0-9_]{3,24}$/;
export const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,64}$/;

export const signupStep1Schema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(70, 'Full name cannot exceed 70 characters'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address'),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, 'Please enter a valid mobile number (min 8 digits)'),
  username: z
    .string()
    .trim()
    .toLowerCase()
    .regex(usernameRegex, 'Username must be 3-24 characters (letters, numbers, underscores only)'),
});

export const verifyOtpSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address'),
  otp: z
    .string()
    .trim()
    .length(6, 'Verification code must be exactly 6 digits')
    .regex(/^\d{6}$/, 'Verification code must contain digits only'),
});

export const resendOtpSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address'),
});

export const createAccountSchema = z
  .object({
    verificationToken: z
      .string()
      .min(10, 'Invalid verification session token'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters long')
      .max(64, 'Password cannot exceed 64 characters')
      .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
      .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
      .regex(/[0-9]/, 'Password must contain at least one number'),
    confirmPassword: z
      .string()
      .min(1, 'Please confirm your password'),
    avatarUrl: z
      .string()
      .optional()
      .nullable(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export const loginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3, 'Please enter a valid username, email, or phone'),
  password: z
    .string()
    .min(1, 'Please enter your password'),
});

export const refreshTokenSchema = z.object({
  refreshToken: z.string().min(1, 'Refresh token is required'),
});
