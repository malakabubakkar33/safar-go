/**
 * SafarGo - Driver & Customer Onboarding API Routes
 * Secure, Idempotent, Production-Grade
 */

import express from 'express';
import crypto from 'crypto';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import { authenticate } from '../middleware/auth.js';
import {
  userDB,
  driverProfileDB,
  driverVehicleDB,
  driverDocumentDB,
  driverVerificationDB,
} from '../db.js';

const router = express.Router();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Secure Storage Directory for Private Documents (CNIC, License, Plate)
const SECURE_DOCS_DIR = path.join(__dirname, '..', 'storage', 'documents');
if (!fs.existsSync(SECURE_DOCS_DIR)) {
  fs.mkdirSync(SECURE_DOCS_DIR, { recursive: true });
}

// Public Uploads Directory for Driver Profile Avatars
const AVATAR_UPLOADS_DIR = path.join(__dirname, '..', '..', 'public', 'uploads', 'avatars');
if (!fs.existsSync(AVATAR_UPLOADS_DIR)) {
  fs.mkdirSync(AVATAR_UPLOADS_DIR, { recursive: true });
}

// -------------------------------------------------------------
// Multer Storage Engines
// -------------------------------------------------------------
const fileFilter = (req, file, cb) => {
  const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg'];
  if (allowed.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Invalid file type. Only JPEG, PNG, and WebP images are allowed.'));
  }
};

// 1. Secure Documents Storage (Private)
const docStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, SECURE_DOCS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const unique = `doc-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, unique);
  },
});

const uploadDoc = multer({
  storage: docStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter,
});

// 2. Avatar Storage (Public web-accessible)
const avatarStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, AVATAR_UPLOADS_DIR);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const unique = `driver-avatar-${Date.now()}-${crypto.randomBytes(8).toString('hex')}${ext}`;
    cb(null, unique);
  },
});

const uploadAvatar = multer({
  storage: avatarStorage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
  fileFilter,
});

// -------------------------------------------------------------
// 1. SELECT ROLE: Customer or Driver
// -------------------------------------------------------------
router.post('/role', authenticate, (req, res) => {
  try {
    const { role } = req.body;
    if (!['CUSTOMER', 'DRIVER'].includes(role)) {
      return res.status(400).json({ success: false, error: 'Role must be either CUSTOMER or DRIVER.' });
    }

    const updatedUser = userDB.update(req.user.id, { role });
    let driverProfile = null;

    if (role === 'DRIVER') {
      // Idempotently create or fetch driver profile
      driverProfile = driverProfileDB.findOrCreate(req.user.id, {
        fullName: req.user.fullName,
        phone: req.user.phone,
        email: req.user.email,
        profileImageUrl: req.user.avatarUrl,
      });
    }

    const safeUser = { ...updatedUser };
    delete safeUser.passwordHash;

    return res.json({
      success: true,
      role,
      user: safeUser,
      driverProfile,
    });
  } catch (err) {
    console.error('[Role Selection Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to update user role.' });
  }
});

// -------------------------------------------------------------
// 2. GET CURRENT DRIVER STATUS & PROGRESS (For Resume / Reload)
// -------------------------------------------------------------
router.get(['/driver-status', '/status'], authenticate, (req, res) => {
  try {
    const user = userDB.findById(req.user.id);
    if (!user) return res.status(404).json({ success: false, error: 'User not found.' });

    const driverProfile = driverProfileDB.findByUserId(user.id);
    if (!driverProfile) {
      return res.json({
        success: true,
        role: user.role,
        hasDriverProfile: false,
        driverProfile: null,
      });
    }

    const vehicle = driverVehicleDB.findByDriverId(driverProfile.id);
    const documents = driverDocumentDB.findByDriverId(driverProfile.id);

    return res.json({
      success: true,
      role: user.role,
      hasDriverProfile: true,
      driverProfile,
      vehicle: vehicle || null,
      documents: documents || [],
      verificationStatus: driverProfile.verificationStatus,
      currentStep: driverProfile.currentStep,
    });
  } catch (err) {
    console.error('[Driver Status Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve driver status.' });
  }
});

// -------------------------------------------------------------
// 3. VEHICLE TYPE SELECTION (BIKE / CAR)
// -------------------------------------------------------------
router.post('/driver-vehicle-type', authenticate, (req, res) => {
  try {
    const { vehicleType } = req.body;
    if (!['BIKE', 'CAR'].includes(vehicleType)) {
      return res.status(400).json({ success: false, error: 'Vehicle type must be either BIKE or CAR.' });
    }

    const profile = driverProfileDB.findOrCreate(req.user.id, {
      fullName: req.user.fullName,
      phone: req.user.phone,
      email: req.user.email,
    });

    const vehicle = driverVehicleDB.upsert(profile.id, { vehicleType });
    driverProfileDB.update(profile.id, { currentStep: 'PERSONAL_INFO' });

    return res.json({
      success: true,
      vehicleType,
      vehicle,
      driverProfile: driverProfileDB.findById(profile.id),
    });
  } catch (err) {
    console.error('[Vehicle Type Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to save vehicle type.' });
  }
});

// -------------------------------------------------------------
// 4. DRIVER PERSONAL INFORMATION
// -------------------------------------------------------------
router.post('/driver-personal-info', authenticate, (req, res) => {
  try {
    const { fullName, phone, email } = req.body;

    if (!fullName || typeof fullName !== 'string' || fullName.trim().length < 2) {
      return res.status(400).json({ success: false, error: 'Full name is required (min 2 characters).' });
    }
    if (!phone || typeof phone !== 'string' || phone.trim().length < 8) {
      return res.status(400).json({ success: false, error: 'A valid phone number is required.' });
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!email || !emailRegex.test(email.trim())) {
      return res.status(400).json({ success: false, error: 'A valid email address is required.' });
    }

    const profile = driverProfileDB.findOrCreate(req.user.id);
    const updated = driverProfileDB.update(profile.id, {
      fullName: fullName.trim(),
      phone: phone.trim(),
      email: email.trim().toLowerCase(),
      currentStep: 'CNIC',
    });

    return res.json({
      success: true,
      driverProfile: updated,
    });
  } catch (err) {
    console.error('[Personal Info Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to save personal information.' });
  }
});

// -------------------------------------------------------------
// 5. CNIC DOCUMENT UPLOAD (FRONT & BACK)
// -------------------------------------------------------------
const cnicUploadFields = uploadDoc.fields([
  { name: 'cnicFront', maxCount: 1 },
  { name: 'cnicBack', maxCount: 1 },
]);

router.post('/upload-cnic', authenticate, cnicUploadFields, (req, res) => {
  try {
    const profile = driverProfileDB.findOrCreate(req.user.id);
    const existingDoc = driverDocumentDB.findByDriverAndType(profile.id, 'CNIC');

    const frontFile = req.files?.cnicFront?.[0];
    const backFile = req.files?.cnicBack?.[0];

    const frontUrl = frontFile 
      ? `/api/onboarding/document-file/${frontFile.filename}`
      : existingDoc?.documentImageFrontUrl;

    const backUrl = backFile
      ? `/api/onboarding/document-file/${backFile.filename}`
      : existingDoc?.documentImageBackUrl;

    if (!frontUrl) {
      return res.status(400).json({ success: false, error: 'CNIC Front image is required.' });
    }
    if (!backUrl) {
      return res.status(400).json({ success: false, error: 'CNIC Back image is required.' });
    }

    const doc = driverDocumentDB.upsert(profile.id, 'CNIC', {
      documentImageFrontUrl: frontUrl,
      documentImageBackUrl: backUrl,
      verificationStatus: 'PENDING',
    });

    driverProfileDB.update(profile.id, { currentStep: 'LICENSE' });

    return res.json({
      success: true,
      document: doc,
      message: 'CNIC documents uploaded successfully.',
    });
  } catch (err) {
    console.error('[CNIC Upload Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to upload CNIC.' });
  }
});

// -------------------------------------------------------------
// 6. DRIVER LICENSE (LICENSE NUMBER & IMAGE)
// -------------------------------------------------------------
router.post('/driver-license', authenticate, uploadDoc.single('licenseImage'), (req, res) => {
  try {
    const profile = driverProfileDB.findOrCreate(req.user.id);
    const { licenseNumber } = req.body;
    const existingDoc = driverDocumentDB.findByDriverAndType(profile.id, 'LICENSE');

    if (!licenseNumber || licenseNumber.trim().length < 4) {
      return res.status(400).json({ success: false, error: 'Valid license number is required (min 4 characters).' });
    }

    const imageFile = req.file;
    const imageUrl = imageFile
      ? `/api/onboarding/document-file/${imageFile.filename}`
      : existingDoc?.documentImageFrontUrl;

    if (!imageUrl) {
      return res.status(400).json({ success: false, error: 'License photo upload is required.' });
    }

    const doc = driverDocumentDB.upsert(profile.id, 'LICENSE', {
      documentNumber: licenseNumber.trim().toUpperCase(),
      documentImageFrontUrl: imageUrl,
      verificationStatus: 'PENDING',
    });

    driverProfileDB.update(profile.id, { currentStep: 'VEHICLE_DETAILS' });

    return res.json({
      success: true,
      document: doc,
      message: 'License details saved successfully.',
    });
  } catch (err) {
    console.error('[License Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to save driving license details.' });
  }
});

// -------------------------------------------------------------
// 7. VEHICLE DETAILS (REGISTRATION NUMBER & PLATE IMAGE)
// -------------------------------------------------------------
router.post('/driver-vehicle-details', authenticate, uploadDoc.single('numberPlateImage'), (req, res) => {
  try {
    const profile = driverProfileDB.findOrCreate(req.user.id);
    const { registrationNumber } = req.body;
    const existingVehicle = driverVehicleDB.findByDriverId(profile.id);

    if (!registrationNumber || registrationNumber.trim().length < 3) {
      return res.status(400).json({ success: false, error: 'Registration / number plate is required (min 3 characters).' });
    }

    const plateFile = req.file;
    const plateUrl = plateFile
      ? `/api/onboarding/document-file/${plateFile.filename}`
      : existingVehicle?.numberPlateImageUrl;

    if (!plateUrl) {
      return res.status(400).json({ success: false, error: 'Number plate image is required.' });
    }

    const vehicle = driverVehicleDB.upsert(profile.id, {
      registrationNumber: registrationNumber.trim().toUpperCase(),
      numberPlateImageUrl: plateUrl,
    });

    driverProfileDB.update(profile.id, { currentStep: 'PHOTO' });

    return res.json({
      success: true,
      vehicle,
      message: 'Vehicle information saved successfully.',
    });
  } catch (err) {
    console.error('[Vehicle Details Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to save vehicle details.' });
  }
});

// -------------------------------------------------------------
// 8. DRIVER PROFILE PHOTO
// -------------------------------------------------------------
router.post('/driver-profile-photo', authenticate, uploadAvatar.single('profilePhoto'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, error: 'Please choose or capture a profile photo.' });
    }

    const profile = driverProfileDB.findOrCreate(req.user.id);
    const photoUrl = `/uploads/avatars/${req.file.filename}`;

    const updated = driverProfileDB.update(profile.id, {
      profileImageUrl: photoUrl,
      currentStep: 'REVIEW',
    });

    // Update user avatar as well
    userDB.update(req.user.id, { avatarUrl: photoUrl });

    return res.json({
      success: true,
      profileImageUrl: photoUrl,
      driverProfile: updated,
      message: 'Driver profile photo uploaded successfully.',
    });
  } catch (err) {
    console.error('[Profile Photo Error]:', err);
    return res.status(500).json({ success: false, error: err.message || 'Failed to upload profile photo.' });
  }
});

// -------------------------------------------------------------
// 9. SUBMIT VERIFICATION (FINAL REVIEW)
// -------------------------------------------------------------
router.post('/submit-verification', authenticate, (req, res) => {
  try {
    const { confirmed } = req.body;
    if (!confirmed) {
      return res.status(400).json({
        success: false,
        error: 'You must confirm that the provided information and documents are accurate and belong to you.',
      });
    }

    const profile = driverProfileDB.findByUserId(req.user.id);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Driver profile not found.' });
    }

    const vehicle = driverVehicleDB.findByDriverId(profile.id);
    const cnicDoc = driverDocumentDB.findByDriverAndType(profile.id, 'CNIC');
    const licenseDoc = driverDocumentDB.findByDriverAndType(profile.id, 'LICENSE');

    // Strict production validation
    if (!profile.fullName || !profile.phone || !profile.email) {
      return res.status(400).json({ success: false, error: 'Driver personal information is incomplete.' });
    }
    if (!vehicle || !vehicle.registrationNumber || !vehicle.numberPlateImageUrl) {
      return res.status(400).json({ success: false, error: 'Vehicle details and number plate image are required.' });
    }
    if (!cnicDoc || !cnicDoc.documentImageFrontUrl || !cnicDoc.documentImageBackUrl) {
      return res.status(400).json({ success: false, error: 'Both CNIC Front and Back documents are required.' });
    }
    if (!licenseDoc || !licenseDoc.documentNumber || !licenseDoc.documentImageFrontUrl) {
      return res.status(400).json({ success: false, error: 'Driving license number and image are required.' });
    }
    if (!profile.profileImageUrl) {
      return res.status(400).json({ success: false, error: 'Driver profile photo is required.' });
    }

    const now = new Date().toISOString();
    const updated = driverProfileDB.update(profile.id, {
      verificationStatus: 'PENDING_VERIFICATION',
      currentStep: 'SUBMITTED',
      submittedAt: now,
      rejectionReason: null,
    });

    driverVerificationDB.create({
      driverId: profile.id,
      status: 'PENDING_VERIFICATION',
      notes: 'Driver onboarding application submitted for compliance verification.',
      reviewedBy: 'System / User Submission',
    });

    return res.json({
      success: true,
      message: 'Your driver application has been submitted successfully.',
      verificationStatus: 'PENDING_VERIFICATION',
      driverProfile: updated,
    });
  } catch (err) {
    console.error('[Submit Verification Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to submit verification.' });
  }
});

// -------------------------------------------------------------
// 10. GET VERIFICATION STATUS
// -------------------------------------------------------------
router.get('/driver-verification', authenticate, (req, res) => {
  try {
    const profile = driverProfileDB.findByUserId(req.user.id);
    if (!profile) {
      return res.status(404).json({ success: false, error: 'Driver profile not found.' });
    }

    const vehicle = driverVehicleDB.findByDriverId(profile.id);
    const documents = driverDocumentDB.findByDriverId(profile.id);

    return res.json({
      success: true,
      verificationStatus: profile.verificationStatus,
      submittedAt: profile.submittedAt,
      verifiedAt: profile.verifiedAt,
      rejectionReason: profile.rejectionReason,
      driverProfile: profile,
      vehicle: vehicle || null,
      documents: documents || [],
    });
  } catch (err) {
    console.error('[Driver Verification Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to retrieve verification status.' });
  }
});

// -------------------------------------------------------------
// 11. SECURE DOCUMENT STREAMING (PROTECTED - AUTHORIZED ONLY)
// -------------------------------------------------------------
router.get('/document-file/:filename', authenticate, (req, res) => {
  try {
    const { filename } = req.params;
    // Sanitize filename to prevent directory traversal
    const safeName = path.basename(filename);
    const filePath = path.join(SECURE_DOCS_DIR, safeName);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ success: false, error: 'Document not found.' });
    }

    // Authorization check: User must own the document or be ADMIN
    const profile = driverProfileDB.findByUserId(req.user.id);
    const isAdmin = ['ADMIN', 'SUPERADMIN'].includes(req.user.role);

    if (!isAdmin && !profile) {
      return res.status(403).json({ success: false, error: 'Access denied.' });
    }

    if (!isAdmin) {
      const docs = driverDocumentDB.findByDriverId(profile.id);
      const vehicle = driverVehicleDB.findByDriverId(profile.id);
      const hasMatch = docs.some(
        d =>
          (d.documentImageFrontUrl && d.documentImageFrontUrl.includes(safeName)) ||
          (d.documentImageBackUrl && d.documentImageBackUrl.includes(safeName))
      ) || (vehicle && vehicle.numberPlateImageUrl && vehicle.numberPlateImageUrl.includes(safeName));

      if (!hasMatch) {
        return res.status(403).json({ success: false, error: 'You do not have permission to view this document.' });
      }
    }

    return res.sendFile(filePath);
  } catch (err) {
    console.error('[Secure Document View Error]:', err);
    return res.status(500).json({ success: false, error: 'Failed to access document.' });
  }
});

export default router;
