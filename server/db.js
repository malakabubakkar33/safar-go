/**
 * SafarGo - Lightweight Persistent Database Layer
 * Always synchronous with disk to guarantee multi-process integrity
 */

import fs from 'fs';
import path from 'path';
import os from 'os';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DEFAULT_DATA_DIR = path.join(__dirname, 'data');
let DATA_DIR = DEFAULT_DATA_DIR;

// Check if running on Vercel or AWS Lambda (read-only filesystem except /tmp)
const isServerless = Boolean(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME);

try {
  if (isServerless) {
    DATA_DIR = path.join(os.tmpdir(), 'safargo_data');
  }
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
} catch (err) {
  DATA_DIR = path.join(os.tmpdir(), 'safargo_data');
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
}

const USERS_FILE = path.join(DATA_DIR, 'users.json');
const OTPS_FILE = path.join(DATA_DIR, 'otps.json');

function readFile(file, defaultValue = []) {
  try {
    if (!fs.existsSync(file)) {
      // Seed template from packaged data directory if available
      const baseName = path.basename(file);
      const defaultFilePath = path.join(DEFAULT_DATA_DIR, baseName);
      if (fs.existsSync(defaultFilePath)) {
        try {
          const defaultContent = fs.readFileSync(defaultFilePath, 'utf8');
          fs.writeFileSync(file, defaultContent, 'utf8');
          return JSON.parse(defaultContent || JSON.stringify(defaultValue));
        } catch {
          // ignore seeding write error
        }
      }
      fs.writeFileSync(file, JSON.stringify(defaultValue, null, 2), 'utf8');
      return defaultValue;
    }
    const content = fs.readFileSync(file, 'utf8');
    return JSON.parse(content || JSON.stringify(defaultValue));
  } catch (err) {
    console.error(`[DB] Error reading ${file}:`, err);
    return defaultValue;
  }
}

function writeFile(file, data) {
  try {
    const dir = path.dirname(file);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const tempFile = `${file}.tmp.${Date.now()}`;
    fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf8');
    fs.renameSync(tempFile, file);
  } catch (err) {
    // Direct write fallback
    try {
      fs.writeFileSync(file, JSON.stringify(data, null, 2), 'utf8');
    } catch (writeErr) {
      console.error(`[DB] Error writing ${file}:`, writeErr);
    }
  }
}

// User Methods
export const userDB = {
  getAll() {
    return readFile(USERS_FILE, []);
  },
  findByIdentifier(identifier) {
    if (!identifier) return null;
    const cleanId = String(identifier).trim().toLowerCase();
    const digitsOnly = cleanId.replace(/\D/g, '');
    const users = this.getAll();
    return users.find(u => {
      const uEmail = (u.email || '').trim().toLowerCase();
      const uUser = (u.username || '').trim().toLowerCase();
      const uDigits = (u.phone || '').replace(/\D/g, '');

      if (uEmail === cleanId || uUser === cleanId) return true;
      if (digitsOnly.length >= 9 && uDigits.length >= 9) {
        if (uDigits === digitsOnly) return true;
        const normInput = digitsOnly.replace(/^0+/, '').replace(/^92/, '');
        const normUser = uDigits.replace(/^0+/, '').replace(/^92/, '');
        if (normUser.length >= 9 && normUser === normInput) return true;
      }
      return false;
    }) || null;
  },
  findByEmail(email) {
    if (!email) return null;
    const cleanEmail = String(email).trim().toLowerCase();
    const users = this.getAll();
    return users.find(u => {
      const uEmail = (u.email || '').trim().toLowerCase();
      if (uEmail !== cleanEmail) return false;
      // Only treat completed, active registered accounts as existing
      return Boolean(u.passwordHash && u.isVerified !== false && u.status !== 'INCOMPLETE' && u.status !== 'PENDING');
    }) || null;
  },
  findAnyByEmail(email) {
    if (!email) return null;
    const cleanEmail = String(email).trim().toLowerCase();
    const users = this.getAll();
    return users.find(u => (u.email || '').trim().toLowerCase() === cleanEmail) || null;
  },
  findByUsername(username) {
    if (!username) return null;
    const cleanUser = String(username).trim().toLowerCase();
    const users = this.getAll();
    return users.find(u => {
      const uUser = (u.username || '').trim().toLowerCase();
      if (uUser !== cleanUser) return false;
      return Boolean(u.passwordHash && u.isVerified !== false && u.status !== 'INCOMPLETE' && u.status !== 'PENDING');
    }) || null;
  },
  findByPhone(phone) {
    if (!phone) return null;
    const cleanPhone = String(phone).trim().replace(/\s+/g, '');
    const users = this.getAll();
    return users.find(u => {
      const uPhone = (u.phone || '').trim().replace(/\s+/g, '');
      if (uPhone !== cleanPhone) return false;
      return Boolean(u.passwordHash && u.isVerified !== false && u.status !== 'INCOMPLETE' && u.status !== 'PENDING');
    }) || null;
  },
  findById(id) {
    if (!id) return null;
    const users = this.getAll();
    return users.find(u => u.id === id) || null;
  },
  create(userData) {
    const users = this.getAll();
    users.push(userData);
    writeFile(USERS_FILE, users);
    return userData;
  },
  update(id, updates) {
    const users = this.getAll();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) return null;
    users[index] = {
      ...users[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    writeFile(USERS_FILE, users);
    return users[index];
  }
};

// OTP Methods
export const otpDB = {
  getAll() {
    return readFile(OTPS_FILE, {});
  },
  get(email) {
    if (!email) return null;
    const cleanEmail = String(email).trim().toLowerCase();
    const otps = this.getAll();
    return otps[cleanEmail] || null;
  },
  set(email, otpRecord) {
    if (!email) return;
    const cleanEmail = String(email).trim().toLowerCase();
    const otps = this.getAll();
    otps[cleanEmail] = {
      ...otpRecord,
      updatedAt: Date.now()
    };
    writeFile(OTPS_FILE, otps);
  },
  remove(email) {
    if (!email) return;
    const cleanEmail = String(email).trim().toLowerCase();
    const otps = this.getAll();
    if (otps[cleanEmail]) {
      delete otps[cleanEmail];
      writeFile(OTPS_FILE, otps);
    }
  }
};

// -------------------------------------------------------------
// Driver Onboarding DB Entities
// -------------------------------------------------------------
const DRIVER_PROFILES_FILE = path.join(DATA_DIR, 'driver_profiles.json');
const DRIVER_VEHICLES_FILE = path.join(DATA_DIR, 'driver_vehicles.json');
const DRIVER_DOCUMENTS_FILE = path.join(DATA_DIR, 'driver_documents.json');
const DRIVER_VERIFICATIONS_FILE = path.join(DATA_DIR, 'driver_verifications.json');

// Driver Profile Methods
export const driverProfileDB = {
  getAll() {
    return readFile(DRIVER_PROFILES_FILE, []);
  },
  findById(id) {
    if (!id) return null;
    const profiles = this.getAll();
    return profiles.find(p => p.id === id) || null;
  },
  findByUserId(userId) {
    if (!userId) return null;
    const profiles = this.getAll();
    return profiles.find(p => p.userId === userId) || null;
  },
  create(data) {
    const profiles = this.getAll();
    profiles.push(data);
    writeFile(DRIVER_PROFILES_FILE, profiles);
    return data;
  },
  update(id, updates) {
    const profiles = this.getAll();
    const index = profiles.findIndex(p => p.id === id);
    if (index === -1) return null;
    profiles[index] = {
      ...profiles[index],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    writeFile(DRIVER_PROFILES_FILE, profiles);
    return profiles[index];
  },
  // Idempotent find-or-create for multi-click resilience
  findOrCreate(userId, initialData = {}) {
    const existing = this.findByUserId(userId);
    if (existing) return existing;
    const newProfile = {
      id: `drv_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      userId,
      verificationStatus: 'INCOMPLETE',
      currentStep: 'VEHICLE_SELECT',
      profileImageUrl: initialData.profileImageUrl || null,
      fullName: initialData.fullName || '',
      phone: initialData.phone || '',
      email: initialData.email || '',
      submittedAt: null,
      verifiedAt: null,
      rejectionReason: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    return this.create(newProfile);
  }
};

// Driver Vehicle Methods
export const driverVehicleDB = {
  getAll() {
    return readFile(DRIVER_VEHICLES_FILE, []);
  },
  findByDriverId(driverId) {
    if (!driverId) return null;
    const vehicles = this.getAll();
    return vehicles.find(v => v.driverId === driverId) || null;
  },
  upsert(driverId, vehicleData) {
    const vehicles = this.getAll();
    const index = vehicles.findIndex(v => v.driverId === driverId);
    if (index >= 0) {
      vehicles[index] = {
        ...vehicles[index],
        ...vehicleData,
        updatedAt: new Date().toISOString()
      };
      writeFile(DRIVER_VEHICLES_FILE, vehicles);
      return vehicles[index];
    } else {
      const newVehicle = {
        id: `veh_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        driverId,
        vehicleType: vehicleData.vehicleType || 'BIKE',
        registrationNumber: vehicleData.registrationNumber || '',
        numberPlateImageUrl: vehicleData.numberPlateImageUrl || '',
        vehicleImageUrl: vehicleData.vehicleImageUrl || null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      vehicles.push(newVehicle);
      writeFile(DRIVER_VEHICLES_FILE, vehicles);
      return newVehicle;
    }
  }
};

// Driver Document Methods
export const driverDocumentDB = {
  getAll() {
    return readFile(DRIVER_DOCUMENTS_FILE, []);
  },
  findByDriverId(driverId) {
    if (!driverId) return [];
    const docs = this.getAll();
    return docs.filter(d => d.driverId === driverId);
  },
  findByDriverAndType(driverId, documentType) {
    if (!driverId || !documentType) return null;
    const docs = this.getAll();
    return docs.find(d => d.driverId === driverId && d.documentType === documentType) || null;
  },
  findById(id) {
    if (!id) return null;
    const docs = this.getAll();
    return docs.find(d => d.id === id) || null;
  },
  upsert(driverId, documentType, docData) {
    const docs = this.getAll();
    const index = docs.findIndex(d => d.driverId === driverId && d.documentType === documentType);
    if (index >= 0) {
      docs[index] = {
        ...docs[index],
        ...docData,
        documentType,
        updatedAt: new Date().toISOString()
      };
      writeFile(DRIVER_DOCUMENTS_FILE, docs);
      return docs[index];
    } else {
      const newDoc = {
        id: `doc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
        driverId,
        documentType,
        documentNumber: docData.documentNumber || null,
        documentImageFrontUrl: docData.documentImageFrontUrl || '',
        documentImageBackUrl: docData.documentImageBackUrl || null,
        verificationStatus: docData.verificationStatus || 'PENDING',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      docs.push(newDoc);
      writeFile(DRIVER_DOCUMENTS_FILE, docs);
      return newDoc;
    }
  }
};

// Driver Verification History Methods
export const driverVerificationDB = {
  getAll() {
    return readFile(DRIVER_VERIFICATIONS_FILE, []);
  },
  findByDriverId(driverId) {
    if (!driverId) return [];
    const items = this.getAll();
    return items.filter(v => v.driverId === driverId);
  },
  create(data) {
    const items = this.getAll();
    const record = {
      id: `ver_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      driverId: data.driverId,
      status: data.status,
      notes: data.notes || '',
      reviewedBy: data.reviewedBy || 'System / Admin',
      reviewedAt: new Date().toISOString(),
      createdAt: new Date().toISOString()
    };
    items.push(record);
    writeFile(DRIVER_VERIFICATIONS_FILE, items);
    return record;
  }
};

// -------------------------------------------------------------
// Rides, Payments, Reviews, Complaints, Settings & Audit Logs
// -------------------------------------------------------------
const RIDES_FILE = path.join(DATA_DIR, 'rides.json');
const RIDE_OFFERS_FILE = path.join(DATA_DIR, 'ride_offers.json');
const RIDE_MESSAGES_FILE = path.join(DATA_DIR, 'ride_messages.json');
const SAVED_PLACES_FILE = path.join(DATA_DIR, 'saved_places.json');
const CUSTOMER_NOTIFS_FILE = path.join(DATA_DIR, 'customer_notifications.json');
const PAYMENTS_FILE = path.join(DATA_DIR, 'payments.json');
const REVIEWS_FILE = path.join(DATA_DIR, 'reviews.json');
const COMPLAINTS_FILE = path.join(DATA_DIR, 'complaints.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const NOTIFICATIONS_FILE = path.join(DATA_DIR, 'admin_notifications.json');
const AUDIT_LOGS_FILE = path.join(DATA_DIR, 'audit_logs.json');

export const rideDB = {
  getAll() {
    return readFile(RIDES_FILE, []);
  },
  findById(id) {
    if (!id) return null;
    return this.getAll().find(r => r.id === id) || null;
  },
  findByCustomerId(customerId) {
    if (!customerId) return [];
    return this.getAll().filter(r => r.customerId === customerId);
  },
  findActiveByCustomerId(customerId) {
    if (!customerId) return null;
    const activeStates = [
      'REQUESTED',
      'SEARCHING_DRIVERS',
      'DRIVERS_RESPONDING',
      'DRIVER_SELECTED',
      'NEGOTIATING',
      'FARE_AGREED',
      'PAYMENT_PENDING',
      'CONFIRMED',
      'DRIVER_ASSIGNED',
      'DRIVER_EN_ROUTE',
      'DRIVER_ARRIVED',
      'RIDE_STARTED',
    ];
    return this.getAll().find(r => r.customerId === customerId && activeStates.includes(r.status)) || null;
  },
  create(ride) {
    const rides = this.getAll();
    rides.push(ride);
    writeFile(RIDES_FILE, rides);
    return ride;
  },
  update(id, updates) {
    const rides = this.getAll();
    const idx = rides.findIndex(r => r.id === id);
    if (idx === -1) return null;
    rides[idx] = {
      ...rides[idx],
      ...updates,
      updatedAt: new Date().toISOString()
    };
    writeFile(RIDES_FILE, rides);
    return rides[idx];
  }
};

export const rideOfferDB = {
  getAll() {
    return readFile(RIDE_OFFERS_FILE, []);
  },
  findByRideId(rideId) {
    if (!rideId) return [];
    return this.getAll().filter(o => o.rideId === rideId);
  },
  findById(id) {
    if (!id) return null;
    return this.getAll().find(o => o.id === id) || null;
  },
  create(offer) {
    const list = this.getAll();
    list.push(offer);
    writeFile(RIDE_OFFERS_FILE, list);
    return offer;
  },
  update(id, updates) {
    const list = this.getAll();
    const idx = list.findIndex(o => o.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
    writeFile(RIDE_OFFERS_FILE, list);
    return list[idx];
  }
};

export const rideMessageDB = {
  getAll() {
    return readFile(RIDE_MESSAGES_FILE, []);
  },
  findByRideId(rideId) {
    if (!rideId) return [];
    return this.getAll().filter(m => m.rideId === rideId);
  },
  create(msg) {
    const list = this.getAll();
    list.push(msg);
    writeFile(RIDE_MESSAGES_FILE, list);
    return msg;
  }
};

export const savedPlaceDB = {
  getAll() {
    return readFile(SAVED_PLACES_FILE, []);
  },
  findByUserId(userId) {
    if (!userId) return [];
    return this.getAll().filter(p => p.userId === userId);
  },
  create(place) {
    const list = this.getAll();
    list.push(place);
    writeFile(SAVED_PLACES_FILE, list);
    return place;
  },
  delete(id, userId) {
    const list = this.getAll().filter(p => !(p.id === id && p.userId === userId));
    writeFile(SAVED_PLACES_FILE, list);
    return true;
  }
};

export const customerNotificationDB = {
  getAll() {
    return readFile(CUSTOMER_NOTIFS_FILE, []);
  },
  findByUserId(userId) {
    if (!userId) return [];
    return this.getAll().filter(n => n.userId === userId);
  },
  create(notif) {
    const list = this.getAll();
    const record = {
      id: `cntf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      userId: notif.userId,
      title: notif.title,
      message: notif.message,
      type: notif.type || 'RIDE',
      rideId: notif.rideId || null,
      isRead: false,
      createdAt: new Date().toISOString(),
    };
    list.unshift(record);
    writeFile(CUSTOMER_NOTIFS_FILE, list);
    return record;
  },
  markAsRead(id, userId) {
    const list = this.getAll();
    const idx = list.findIndex(n => n.id === id && n.userId === userId);
    if (idx >= 0) {
      list[idx].isRead = true;
      writeFile(CUSTOMER_NOTIFS_FILE, list);
    }
  }
};


export const paymentDB = {
  getAll() {
    return readFile(PAYMENTS_FILE, []);
  },
  findById(id) {
    if (!id) return null;
    return this.getAll().find(p => p.id === id) || null;
  },
  findByRideId(rideId) {
    if (!rideId) return null;
    return this.getAll().find(p => p.rideId === rideId) || null;
  },
  create(payment) {
    const list = this.getAll();
    list.push(payment);
    writeFile(PAYMENTS_FILE, list);
    return payment;
  },
  update(id, updates) {
    const list = this.getAll();
    const idx = list.findIndex(p => p.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
    writeFile(PAYMENTS_FILE, list);
    return list[idx];
  }
};

export const reviewDB = {
  getAll() {
    return readFile(REVIEWS_FILE, []);
  },
  findById(id) {
    if (!id) return null;
    return this.getAll().find(r => r.id === id) || null;
  },
  create(rev) {
    const list = this.getAll();
    list.push(rev);
    writeFile(REVIEWS_FILE, list);
    return rev;
  },
  update(id, updates) {
    const list = this.getAll();
    const idx = list.findIndex(r => r.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
    writeFile(REVIEWS_FILE, list);
    return list[idx];
  }
};

export const complaintDB = {
  getAll() {
    return readFile(COMPLAINTS_FILE, []);
  },
  findById(id) {
    if (!id) return null;
    return this.getAll().find(c => c.id === id) || null;
  },
  create(complaint) {
    const list = this.getAll();
    list.push(complaint);
    writeFile(COMPLAINTS_FILE, list);
    return complaint;
  },
  update(id, updates) {
    const list = this.getAll();
    const idx = list.findIndex(c => c.id === id);
    if (idx === -1) return null;
    list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
    writeFile(COMPLAINTS_FILE, list);
    return list[idx];
  }
};

export const settingsDB = {
  get() {
    return readFile(SETTINGS_FILE, {
      baseFareBike: 120,
      perKmBike: 35,
      baseFareCar: 350,
      perKmCar: 75,
      driverCommissionPercentage: 12,
      cancellationFee: 100,
      maintenanceMode: false,
      announcementBanner: 'Welcome to SafarGo - Ride safe, travel smart',
      supportPhone: '+92 42 111 723 274',
      supportEmail: 'support@safargo.com',
      updatedAt: new Date().toISOString()
    });
  },
  update(updates) {
    const current = this.get();
    const updated = { ...current, ...updates, updatedAt: new Date().toISOString() };
    writeFile(SETTINGS_FILE, updated);
    return updated;
  }
};

export const adminNotificationDB = {
  getAll() {
    return readFile(NOTIFICATIONS_FILE, []);
  },
  create(notif) {
    const list = this.getAll();
    const record = {
      id: `ntf_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      title: notif.title,
      message: notif.message,
      type: notif.type || 'INFO', // 'APPLICATION' | 'COMPLAINT' | 'PAYMENT' | 'ALERT'
      isRead: false,
      targetId: notif.targetId || null,
      createdAt: new Date().toISOString()
    };
    list.unshift(record);
    writeFile(NOTIFICATIONS_FILE, list);
    return record;
  },
  markRead(id) {
    const list = this.getAll();
    const idx = list.findIndex(n => n.id === id);
    if (idx >= 0) {
      list[idx].isRead = true;
      writeFile(NOTIFICATIONS_FILE, list);
    }
  },
  markAllRead() {
    const list = this.getAll().map(n => ({ ...n, isRead: true }));
    writeFile(NOTIFICATIONS_FILE, list);
  }
};

export const auditLogDB = {
  getAll() {
    return readFile(AUDIT_LOGS_FILE, []);
  },
  create(log) {
    const list = this.getAll();
    const record = {
      id: `aud_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
      adminName: log.adminName || 'Admin',
      action: log.action, // e.g. 'APPROVE_DRIVER', 'SUSPEND_USER', 'CHANGE_SETTINGS'
      target: log.target || 'General',
      details: log.details || '',
      ipAddress: log.ipAddress || '127.0.0.1',
      createdAt: new Date().toISOString()
    };
    list.unshift(record); // append to top
    writeFile(AUDIT_LOGS_FILE, list);
    return record;
  }
};

