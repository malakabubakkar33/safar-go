/**
 * SafarGo - Driver & Customer Onboarding Validation Schemas
 */

import { z } from 'zod';
import { phoneRegex } from './auth.schemas.js';

export const roleSelectionSchema = z.object({
  role: z.enum(['CUSTOMER', 'DRIVER'] as const),
});

export const driverVehicleTypeSchema = z.object({
  vehicleType: z.enum(['BIKE', 'CAR'] as const),
});

export const driverPersonalInfoSchema = z.object({
  fullName: z
    .string()
    .trim()
    .min(2, 'Full name must be at least 2 characters')
    .max(70, 'Full name cannot exceed 70 characters'),
  phone: z
    .string()
    .trim()
    .regex(phoneRegex, 'Please enter a valid phone number'),
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email('Please enter a valid email address'),
});

export const driverLicenseSchema = z.object({
  licenseNumber: z
    .string()
    .trim()
    .min(4, 'License number must be at least 4 characters')
    .max(30, 'License number cannot exceed 30 characters'),
});

export const driverVehicleDetailsSchema = z.object({
  registrationNumber: z
    .string()
    .trim()
    .min(3, 'Registration number must be at least 3 characters')
    .max(20, 'Registration number cannot exceed 20 characters'),
});

export const submitVerificationSchema = z.object({
  confirmed: z.literal(true),
});

export type RoleSelectionInput = z.infer<typeof roleSelectionSchema>;
export type DriverVehicleTypeInput = z.infer<typeof driverVehicleTypeSchema>;
export type DriverPersonalInfoInput = z.infer<typeof driverPersonalInfoSchema>;
export type DriverLicenseInput = z.infer<typeof driverLicenseSchema>;
export type DriverVehicleDetailsInput = z.infer<typeof driverVehicleDetailsSchema>;
export type SubmitVerificationInput = z.infer<typeof submitVerificationSchema>;
