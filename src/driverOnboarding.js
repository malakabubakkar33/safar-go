import { initCustomerApp } from './customerApp.js';

// Global Onboarding State
const onboardingState = {
  user: null,
  role: null,
  vehicleType: 'BIKE',
  fullName: '',
  phone: '',
  email: '',
  cnicFrontFile: null,
  cnicFrontUrl: null,
  cnicBackFile: null,
  cnicBackUrl: null,
  licenseNumber: '',
  licenseFile: null,
  licenseUrl: null,
  registrationNumber: '',
  plateFile: null,
  plateUrl: null,
  profilePhotoFile: null,
  profilePhotoUrl: null,
  verificationStatus: 'INCOMPLETE',
  currentStep: 0,
  driverProfileId: null,
};

// Client-Side Image Compression Helper (Downsamples giant phone camera photos to smooth max 1600px)
async function compressImage(file, maxWidth = 1600, quality = 0.85) {
  if (!file || !file.type.startsWith('image/')) return file;
  return new Promise((resolve) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        canvas.toBlob(
          (blob) => {
            if (blob && blob.size < file.size) {
              const compressedFile = new File([blob], file.name, { type: 'image/jpeg' });
              resolve(compressedFile);
            } else {
              resolve(file); // Keep original if smaller
            }
          },
          'image/jpeg',
          quality
        );
      };
      img.onerror = () => resolve(file);
      img.src = e.target.result;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

function getAuthToken() {
  return localStorage.getItem('safargo_token') || '';
}

function authHeaders(isJson = true) {
  const headers = {
    Authorization: `Bearer ${getAuthToken()}`,
  };
  if (isJson) headers['Content-Type'] = 'application/json';
  return headers;
}

/**
 * Initialize Onboarding Coordinator
 */
export async function initOnboardingCoordinator(user, isNewSignup = false) {
  onboardingState.user = user;
  if (user) {
    onboardingState.fullName = user.fullName || '';
    onboardingState.phone = user.phone || '';
    onboardingState.email = user.email || '';
    onboardingState.profilePhotoUrl = user.avatarUrl || null;
  }

  // 1. Check existing onboarding state from backend
  try {
    const res = await fetch('/api/onboarding/driver-status', {
      headers: authHeaders(true),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.hasDriverProfile && data.driverProfile) {
        const p = data.driverProfile;
        onboardingState.driverProfileId = p.id;
        onboardingState.verificationStatus = p.verificationStatus;
        onboardingState.role = 'DRIVER';
        if (p.fullName) onboardingState.fullName = p.fullName;
        if (p.phone) onboardingState.phone = p.phone;
        if (p.email) onboardingState.email = p.email;
        if (p.profileImageUrl) onboardingState.profilePhotoUrl = p.profileImageUrl;

        if (data.vehicle) {
          onboardingState.vehicleType = data.vehicle.vehicleType || 'BIKE';
          onboardingState.registrationNumber = data.vehicle.registrationNumber || '';
          onboardingState.plateUrl = data.vehicle.numberPlateImageUrl || null;
        }

        if (Array.isArray(data.documents)) {
          const cnic = data.documents.find((d) => d.documentType === 'CNIC');
          if (cnic) {
            onboardingState.cnicFrontUrl = cnic.documentImageFrontUrl;
            onboardingState.cnicBackUrl = cnic.documentImageBackUrl;
          }
          const lic = data.documents.find((d) => d.documentType === 'LICENSE');
          if (lic) {
            onboardingState.licenseNumber = lic.documentNumber || '';
            onboardingState.licenseUrl = lic.documentImageFrontUrl;
          }
        }

        // If user already submitted or is verified, route appropriately
        if (!isNewSignup && p.verificationStatus === 'APPROVED') {
          showDriverDashboard();
          return;
        }
        if (!isNewSignup && ['PENDING_VERIFICATION', 'REJECTED', 'SUSPENDED'].includes(p.verificationStatus)) {
          showDriverStatusScreen(p.verificationStatus, p.rejectionReason);
          return;
        }

        // Resume incomplete driver onboarding
        if (!isNewSignup && p.verificationStatus === 'INCOMPLETE') {
          openDriverOnboardingFlow(mapStepNameToIndex(p.currentStep));
          return;
        }
      } else if (data.role === 'CUSTOMER' && !isNewSignup) {
        showCustomerDashboard();
        return;
      }
    }
  } catch (err) {
    console.warn('[Onboarding Coordinator] Backend status check error:', err);
  }

  // If new signup or role not yet selected, show Role Selection Screen
  showRoleSelectionScreen();
}

function mapStepNameToIndex(stepName) {
  switch (stepName) {
    case 'VEHICLE_SELECT': return 0;
    case 'PERSONAL_INFO': return 1;
    case 'CNIC': return 2;
    case 'LICENSE': return 3;
    case 'VEHICLE_DETAILS': return 4;
    case 'PHOTO': return 5;
    case 'REVIEW': return 6;
    default: return 0;
  }
}

// ============================================================
// 1. SCREEN: ROLE SELECTION ("How will you use SafarGo?")
// ============================================================
export function showRoleSelectionScreen() {
  hideAllScreens();
  const screen = document.getElementById('role-selection-screen');
  if (!screen) return;
  screen.classList.remove('hidden');
  screen.style.display = 'flex';

  const customerCard = document.getElementById('role-card-customer');
  const driverCard = document.getElementById('role-card-driver');

  if (customerCard) {
    customerCard.onclick = async () => {
      customerCard.classList.add('selected');
      if (driverCard) driverCard.classList.remove('selected');
      await saveRole('CUSTOMER');
      showCustomerDashboard();
    };
  }

  if (driverCard) {
    driverCard.onclick = async () => {
      driverCard.classList.add('selected');
      if (customerCard) customerCard.classList.remove('selected');
      await saveRole('DRIVER');
      openDriverOnboardingFlow(0);
    };
  }
}

async function saveRole(role) {
  onboardingState.role = role;
  try {
    const res = await fetch('/api/onboarding/role', {
      method: 'POST',
      headers: authHeaders(true),
      body: JSON.stringify({ role }),
    });
    const data = await res.json();
    if (data.driverProfile) {
      onboardingState.driverProfileId = data.driverProfile.id;
    }
  } catch (err) {
    console.error('[Save Role Error]:', err);
  }
}

// ============================================================
// 2. DRIVER ONBOARDING FLOW WIZARD
// ============================================================
export function openDriverOnboardingFlow(initialStep = 0) {
  hideAllScreens();
  const screen = document.getElementById('driver-onboarding-screen');
  if (!screen) return;
  screen.classList.remove('hidden');
  screen.style.display = 'flex';

  renderStep(initialStep);
}

function renderStep(stepIndex) {
  onboardingState.currentStep = stepIndex;

  // Update Stepper Progress
  const totalSteps = 6; // 0: Vehicle, 1: Info, 2: CNIC, 3: License, 4: Vehicle Details, 5: Photo, 6: Review
  const stepBadge = document.getElementById('flow-step-badge');
  if (stepBadge) {
    const label = stepIndex === 0 ? 'Vehicle Select' : `Step ${stepIndex} of ${totalSteps}`;
    stepBadge.textContent = label;
  }

  // Update bar segments
  const segments = document.querySelectorAll('.stepper-bar-segment');
  segments.forEach((seg, i) => {
    seg.classList.toggle('active', i <= stepIndex);
    seg.classList.toggle('completed', i < stepIndex);
  });

  // Switch step views
  const stepViews = [
    'step-view-vehicle',
    'step-view-info',
    'step-view-cnic',
    'step-view-license',
    'step-view-veh-details',
    'step-view-photo',
    'step-view-review',
  ];

  stepViews.forEach((id, i) => {
    const el = document.getElementById(id);
    if (el) el.style.display = i === stepIndex ? 'flex' : 'none';
  });

  // Attach step-specific listeners
  switch (stepIndex) {
    case 0: initStep0Vehicle(); break;
    case 1: initStep1Info(); break;
    case 2: initStep2CNIC(); break;
    case 3: initStep3License(); break;
    case 4: initStep4VehicleDetails(); break;
    case 5: initStep5Photo(); break;
    case 6: initStep6Review(); break;
  }
}

// --- Step 0: Vehicle Selection ---
function initStep0Vehicle() {
  const bikeCard = document.getElementById('veh-card-bike');
  const carCard = document.getElementById('veh-card-car');
  const nextBtn = document.getElementById('veh-step-btn');

  function updateSelection(type) {
    onboardingState.vehicleType = type;
    if (bikeCard) bikeCard.classList.toggle('selected', type === 'BIKE');
    if (carCard) carCard.classList.toggle('selected', type === 'CAR');
  }

  updateSelection(onboardingState.vehicleType || 'BIKE');

  if (bikeCard) bikeCard.onclick = () => updateSelection('BIKE');
  if (carCard) carCard.onclick = () => updateSelection('CAR');

  if (nextBtn) {
    nextBtn.onclick = async () => {
      nextBtn.disabled = true;
      nextBtn.innerHTML = '<span>Saving...</span>';
      try {
        await fetch('/api/onboarding/driver-vehicle-type', {
          method: 'POST',
          headers: authHeaders(true),
          body: JSON.stringify({ vehicleType: onboardingState.vehicleType }),
        });
        renderStep(1);
      } catch (err) {
        alert('Failed to save vehicle type.');
      } finally {
        nextBtn.disabled = false;
        nextBtn.innerHTML = '<span>Continue</span>';
      }
    };
  }
}

// --- Step 1: Personal Info ---
function initStep1Info() {
  const nameInput = document.getElementById('driver-info-name');
  const phoneInput = document.getElementById('driver-info-phone');
  const emailInput = document.getElementById('driver-info-email');
  const nextBtn = document.getElementById('driver-info-btn');
  const errorMsg = document.getElementById('driver-info-error');

  if (nameInput) nameInput.value = onboardingState.fullName;
  if (phoneInput) phoneInput.value = onboardingState.phone;
  if (emailInput) emailInput.value = onboardingState.email;

  if (nextBtn) {
    nextBtn.onclick = async () => {
      const fullName = nameInput.value.trim();
      const phone = phoneInput.value.trim();
      const email = emailInput.value.trim().toLowerCase();

      if (errorMsg) errorMsg.classList.remove('visible');

      if (!fullName || fullName.length < 2) {
        showError(errorMsg, 'Please enter your complete legal name.');
        nameInput.focus();
        return;
      }
      if (!phone || phone.length < 8) {
        showError(errorMsg, 'Please enter a valid mobile number.');
        phoneInput.focus();
        return;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showError(errorMsg, 'Please enter a valid email address.');
        emailInput.focus();
        return;
      }

      onboardingState.fullName = fullName;
      onboardingState.phone = phone;
      onboardingState.email = email;

      nextBtn.disabled = true;
      nextBtn.innerHTML = '<span>Saving...</span>';

      try {
        const res = await fetch('/api/onboarding/driver-personal-info', {
          method: 'POST',
          headers: authHeaders(true),
          body: JSON.stringify({ fullName, phone, email }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save information');
        renderStep(2);
      } catch (err) {
        showError(errorMsg, err.message);
      } finally {
        nextBtn.disabled = false;
        nextBtn.innerHTML = '<span>Continue</span>';
      }
    };
  }
}

// --- Step 2: CNIC Verification ---
function initStep2CNIC() {
  const frontInput = document.getElementById('cnic-front-file-input');
  const backInput = document.getElementById('cnic-back-file-input');
  const nextBtn = document.getElementById('cnic-next-btn');
  const errorMsg = document.getElementById('cnic-error-msg');

  setupUploadCard({
    fileInputId: 'cnic-front-file-input',
    triggerBtnId: 'cnic-front-trigger',
    previewContainerId: 'cnic-front-preview-box',
    previewImgId: 'cnic-front-preview-img',
    chipId: 'cnic-front-chip',
    removeBtnId: 'cnic-front-remove',
    cardId: 'cnic-front-card',
    stateKeyFile: 'cnicFrontFile',
    stateKeyUrl: 'cnicFrontUrl',
  });

  setupUploadCard({
    fileInputId: 'cnic-back-file-input',
    triggerBtnId: 'cnic-back-trigger',
    previewContainerId: 'cnic-back-preview-box',
    previewImgId: 'cnic-back-preview-img',
    chipId: 'cnic-back-chip',
    removeBtnId: 'cnic-back-remove',
    cardId: 'cnic-back-card',
    stateKeyFile: 'cnicBackFile',
    stateKeyUrl: 'cnicBackUrl',
  });

  if (nextBtn) {
    nextBtn.onclick = async () => {
      if (!onboardingState.cnicFrontFile && !onboardingState.cnicFrontUrl) {
        showError(errorMsg, 'Please upload the front photo of your CNIC.');
        return;
      }
      if (!onboardingState.cnicBackFile && !onboardingState.cnicBackUrl) {
        showError(errorMsg, 'Please upload the back photo of your CNIC.');
        return;
      }

      nextBtn.disabled = true;
      nextBtn.innerHTML = '<span>Uploading CNIC...</span>';
      if (errorMsg) errorMsg.classList.remove('visible');

      try {
        const formData = new FormData();
        if (onboardingState.cnicFrontFile) {
          const compFront = await compressImage(onboardingState.cnicFrontFile);
          formData.append('cnicFront', compFront);
        }
        if (onboardingState.cnicBackFile) {
          const compBack = await compressImage(onboardingState.cnicBackFile);
          formData.append('cnicBack', compBack);
        }

        const res = await fetch('/api/onboarding/upload-cnic', {
          method: 'POST',
          headers: authHeaders(false),
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Upload failed');

        if (data.document) {
          onboardingState.cnicFrontUrl = data.document.documentImageFrontUrl;
          onboardingState.cnicBackUrl = data.document.documentImageBackUrl;
        }

        renderStep(3);
      } catch (err) {
        showError(errorMsg, err.message);
      } finally {
        nextBtn.disabled = false;
        nextBtn.innerHTML = '<span>Continue</span>';
      }
    };
  }
}

// --- Step 3: Driving License ---
function initStep3License() {
  const numberInput = document.getElementById('license-number-input');
  const nextBtn = document.getElementById('license-next-btn');
  const errorMsg = document.getElementById('license-error-msg');

  if (numberInput && onboardingState.licenseNumber) {
    numberInput.value = onboardingState.licenseNumber;
  }

  setupUploadCard({
    fileInputId: 'license-file-input',
    triggerBtnId: 'license-trigger',
    previewContainerId: 'license-preview-box',
    previewImgId: 'license-preview-img',
    chipId: 'license-chip',
    removeBtnId: 'license-remove',
    cardId: 'license-card',
    stateKeyFile: 'licenseFile',
    stateKeyUrl: 'licenseUrl',
  });

  if (nextBtn) {
    nextBtn.onclick = async () => {
      const licenseNumber = numberInput.value.trim().toUpperCase();
      if (!licenseNumber || licenseNumber.length < 4) {
        showError(errorMsg, 'Please enter a valid driving license number.');
        numberInput.focus();
        return;
      }

      if (!onboardingState.licenseFile && !onboardingState.licenseUrl) {
        showError(errorMsg, 'Please upload a photo of your driving license.');
        return;
      }

      onboardingState.licenseNumber = licenseNumber;
      nextBtn.disabled = true;
      nextBtn.innerHTML = '<span>Saving License...</span>';
      if (errorMsg) errorMsg.classList.remove('visible');

      try {
        const formData = new FormData();
        formData.append('licenseNumber', licenseNumber);
        if (onboardingState.licenseFile) {
          const comp = await compressImage(onboardingState.licenseFile);
          formData.append('licenseImage', comp);
        }

        const res = await fetch('/api/onboarding/driver-license', {
          method: 'POST',
          headers: authHeaders(false),
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save driving license');

        if (data.document) {
          onboardingState.licenseUrl = data.document.documentImageFrontUrl;
        }

        renderStep(4);
      } catch (err) {
        showError(errorMsg, err.message);
      } finally {
        nextBtn.disabled = false;
        nextBtn.innerHTML = '<span>Continue</span>';
      }
    };
  }
}

// --- Step 4: Vehicle Details (Dynamically Bike or Car) ---
function initStep4VehicleDetails() {
  const isBike = onboardingState.vehicleType === 'BIKE';
  const titleEl = document.getElementById('veh-details-title');
  const typeBadge = document.getElementById('veh-type-badge');
  const plateInput = document.getElementById('veh-plate-input');
  const nextBtn = document.getElementById('veh-details-btn');
  const errorMsg = document.getElementById('veh-details-error');

  if (titleEl) titleEl.textContent = isBike ? 'Bike Details' : 'Car Details';
  if (typeBadge) typeBadge.textContent = isBike ? 'Vehicle Type: Bike' : 'Vehicle Type: Car';
  if (plateInput && onboardingState.registrationNumber) {
    plateInput.value = onboardingState.registrationNumber;
  }

  setupUploadCard({
    fileInputId: 'plate-file-input',
    triggerBtnId: 'plate-trigger',
    previewContainerId: 'plate-preview-box',
    previewImgId: 'plate-preview-img',
    chipId: 'plate-chip',
    removeBtnId: 'plate-remove',
    cardId: 'plate-card',
    stateKeyFile: 'plateFile',
    stateKeyUrl: 'plateUrl',
  });

  if (nextBtn) {
    nextBtn.onclick = async () => {
      const reg = plateInput.value.trim().toUpperCase();
      if (!reg || reg.length < 3) {
        showError(errorMsg, `Please enter your ${isBike ? 'bike' : 'car'} number plate.`);
        plateInput.focus();
        return;
      }

      if (!onboardingState.plateFile && !onboardingState.plateUrl) {
        showError(errorMsg, 'Please upload a photo of your vehicle number plate.');
        return;
      }

      onboardingState.registrationNumber = reg;
      nextBtn.disabled = true;
      nextBtn.innerHTML = '<span>Saving Details...</span>';
      if (errorMsg) errorMsg.classList.remove('visible');

      try {
        const formData = new FormData();
        formData.append('registrationNumber', reg);
        if (onboardingState.plateFile) {
          const comp = await compressImage(onboardingState.plateFile);
          formData.append('numberPlateImage', comp);
        }

        const res = await fetch('/api/onboarding/driver-vehicle-details', {
          method: 'POST',
          headers: authHeaders(false),
          body: formData,
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to save vehicle details');

        if (data.vehicle) {
          onboardingState.plateUrl = data.vehicle.numberPlateImageUrl;
        }

        renderStep(5);
      } catch (err) {
        showError(errorMsg, err.message);
      } finally {
        nextBtn.disabled = false;
        nextBtn.innerHTML = '<span>Continue</span>';
      }
    };
  }
}

// --- Step 5: Driver Profile Photo ---
function initStep5Photo() {
  const photoInput = document.getElementById('driver-photo-file-input');
  const triggerBtn = document.getElementById('driver-photo-trigger');
  const previewImg = document.getElementById('driver-photo-preview-img');
  const placeholder = document.getElementById('driver-photo-placeholder');
  const nextBtn = document.getElementById('driver-photo-btn');
  const errorMsg = document.getElementById('driver-photo-error');

  if (onboardingState.profilePhotoUrl && previewImg) {
    previewImg.src = onboardingState.profilePhotoUrl;
    previewImg.style.display = 'block';
    if (placeholder) placeholder.style.display = 'none';
  }

  if (triggerBtn && photoInput) {
    triggerBtn.onclick = () => photoInput.click();
    photoInput.onchange = async () => {
      const file = photoInput.files?.[0];
      if (!file) return;
      onboardingState.profilePhotoFile = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        if (previewImg) {
          previewImg.src = e.target.result;
          previewImg.style.display = 'block';
        }
        if (placeholder) placeholder.style.display = 'none';
      };
      reader.readAsDataURL(file);
    };
  }

  if (nextBtn) {
    nextBtn.onclick = async () => {
      if (!onboardingState.profilePhotoFile && !onboardingState.profilePhotoUrl) {
        showError(errorMsg, 'Please upload a clear profile photo.');
        return;
      }

      nextBtn.disabled = true;
      nextBtn.innerHTML = '<span>Uploading Photo...</span>';
      if (errorMsg) errorMsg.classList.remove('visible');

      try {
        if (onboardingState.profilePhotoFile) {
          const comp = await compressImage(onboardingState.profilePhotoFile, 800, 0.9);
          const formData = new FormData();
          formData.append('profilePhoto', comp);

          const res = await fetch('/api/onboarding/driver-profile-photo', {
            method: 'POST',
            headers: authHeaders(false),
            body: formData,
          });

          const data = await res.json();
          if (!res.ok) throw new Error(data.error || 'Failed to upload photo');
          if (data.profileImageUrl) onboardingState.profilePhotoUrl = data.profileImageUrl;
        }

        renderStep(6);
      } catch (err) {
        showError(errorMsg, err.message);
      } finally {
        nextBtn.disabled = false;
        nextBtn.innerHTML = '<span>Continue</span>';
      }
    };
  }
}

// --- Step 6: Review & Final Submission ---
function initStep6Review() {
  const nameEl = document.getElementById('review-val-name');
  const phoneEl = document.getElementById('review-val-phone');
  const emailEl = document.getElementById('review-val-email');
  const vehTypeEl = document.getElementById('review-val-veh-type');
  const plateEl = document.getElementById('review-val-plate');
  const cnicFrontEl = document.getElementById('review-val-cnic-front');
  const cnicBackEl = document.getElementById('review-val-cnic-back');
  const licenseNumEl = document.getElementById('review-val-license-num');
  const licenseImgEl = document.getElementById('review-val-license-img');
  const photoEl = document.getElementById('review-val-photo');

  if (nameEl) nameEl.textContent = onboardingState.fullName || '—';
  if (phoneEl) phoneEl.textContent = onboardingState.phone || '—';
  if (emailEl) emailEl.textContent = onboardingState.email || '—';
  if (vehTypeEl) vehTypeEl.textContent = onboardingState.vehicleType === 'BIKE' ? 'Bike' : 'Car';
  if (plateEl) plateEl.textContent = onboardingState.registrationNumber || '—';
  if (cnicFrontEl) cnicFrontEl.textContent = (onboardingState.cnicFrontFile || onboardingState.cnicFrontUrl) ? 'Uploaded ✓' : 'Missing';
  if (cnicBackEl) cnicBackEl.textContent = (onboardingState.cnicBackFile || onboardingState.cnicBackUrl) ? 'Uploaded ✓' : 'Missing';
  if (licenseNumEl) licenseNumEl.textContent = onboardingState.licenseNumber || '—';
  if (licenseImgEl) licenseImgEl.textContent = (onboardingState.licenseFile || onboardingState.licenseUrl) ? 'Uploaded ✓' : 'Missing';
  if (photoEl) photoEl.textContent = (onboardingState.profilePhotoFile || onboardingState.profilePhotoUrl) ? 'Uploaded ✓' : 'Missing';

  // Edit Button Jumps
  document.querySelectorAll('[data-edit-step]').forEach((btn) => {
    btn.onclick = () => {
      const stepTarget = parseInt(btn.getAttribute('data-edit-step'), 10);
      renderStep(stepTarget);
    };
  });

  const confirmCheck = document.getElementById('review-confirm-checkbox');
  const submitBtn = document.getElementById('review-submit-btn');
  const errorMsg = document.getElementById('review-error-msg');

  if (submitBtn) {
    submitBtn.onclick = async () => {
      if (!confirmCheck || !confirmCheck.checked) {
        showError(errorMsg, 'Please confirm that your provided information and documents are accurate.');
        return;
      }

      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span>Submitting for Verification...</span>';
      if (errorMsg) errorMsg.classList.remove('visible');

      try {
        const res = await fetch('/api/onboarding/submit-verification', {
          method: 'POST',
          headers: authHeaders(true),
          body: JSON.stringify({ confirmed: true }),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Failed to submit application');

        onboardingState.verificationStatus = 'PENDING_VERIFICATION';
        showDriverStatusScreen('PENDING_VERIFICATION');
      } catch (err) {
        showError(errorMsg, err.message);
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span>Submit for Verification</span>';
      }
    };
  }
}

// Upload Card Reusable Binding
function setupUploadCard(cfg) {
  const fileInput = document.getElementById(cfg.fileInputId);
  const triggerBtn = document.getElementById(cfg.triggerBtnId);
  const previewBox = document.getElementById(cfg.previewContainerId);
  const previewImg = document.getElementById(cfg.previewImgId);
  const chip = document.getElementById(cfg.chipId);
  const removeBtn = document.getElementById(cfg.removeBtnId);
  const card = document.getElementById(cfg.cardId);

  // Pre-load if URL exists
  if (onboardingState[cfg.stateKeyUrl] && previewImg && previewBox) {
    previewImg.src = onboardingState[cfg.stateKeyUrl];
    previewBox.classList.add('active');
    if (chip) {
      chip.textContent = 'Uploaded';
      chip.classList.add('uploaded');
    }
    if (card) card.classList.add('has-file');
  }

  if (triggerBtn && fileInput) {
    triggerBtn.onclick = () => fileInput.click();
    fileInput.onchange = () => {
      const file = fileInput.files?.[0];
      if (!file) return;

      onboardingState[cfg.stateKeyFile] = file;
      const reader = new FileReader();
      reader.onload = (e) => {
        if (previewImg) previewImg.src = e.target.result;
        if (previewBox) previewBox.classList.add('active');
        if (chip) {
          chip.textContent = 'Ready to Upload';
          chip.classList.add('uploaded');
        }
        if (card) card.classList.add('has-file');
      };
      reader.readAsDataURL(file);
    };
  }

  if (removeBtn) {
    removeBtn.onclick = () => {
      onboardingState[cfg.stateKeyFile] = null;
      onboardingState[cfg.stateKeyUrl] = null;
      if (fileInput) fileInput.value = '';
      if (previewBox) previewBox.classList.remove('active');
      if (chip) {
        chip.textContent = 'Required';
        chip.classList.remove('uploaded');
      }
      if (card) card.classList.remove('has-file');
    };
  }
}

// ============================================================
// 3. DRIVER VERIFICATION STATUS SCREEN
// ============================================================
export function showDriverStatusScreen(status = 'PENDING_VERIFICATION', reason = '') {
  hideAllScreens();
  const screen = document.getElementById('driver-status-screen');
  if (!screen) return;
  screen.classList.remove('hidden');
  screen.style.display = 'flex';

  const badgeChip = document.getElementById('status-chip');
  const titleEl = document.getElementById('status-main-title');
  const descEl = document.getElementById('status-main-desc');
  const rejectionBox = document.getElementById('status-rejection-card');
  const rejectionText = document.getElementById('status-rejection-reason');
  const resubmitBtn = document.getElementById('status-resubmit-btn');

  if (status === 'PENDING_VERIFICATION') {
    if (badgeChip) {
      badgeChip.className = 'status-badge-chip pending';
      badgeChip.textContent = 'Pending Verification';
    }
    if (titleEl) titleEl.textContent = 'Verification Submitted';
    if (descEl) descEl.textContent = 'Your driver application has been submitted successfully. Our team will review your information and documents.';
    if (rejectionBox) rejectionBox.style.display = 'none';
    if (resubmitBtn) resubmitBtn.style.display = 'none';
  } else if (status === 'REJECTED') {
    if (badgeChip) {
      badgeChip.className = 'status-badge-chip rejected';
      badgeChip.textContent = 'Verification Needs Correction';
    }
    if (titleEl) titleEl.textContent = 'Corrections Required';
    if (descEl) descEl.textContent = 'Our verification team requested corrections for your driver application.';
    if (rejectionBox) {
      rejectionBox.style.display = 'block';
      if (rejectionText) rejectionText.textContent = reason || 'Please update your document photo so all details are clearly legible.';
    }
    if (resubmitBtn) {
      resubmitBtn.style.display = 'flex';
      resubmitBtn.onclick = () => openDriverOnboardingFlow(2); // Jump back to documents
    }
  } else if (status === 'SUSPENDED') {
    if (badgeChip) {
      badgeChip.className = 'status-badge-chip suspended';
      badgeChip.textContent = 'Driver Account Suspended';
    }
    if (titleEl) titleEl.textContent = 'Account Suspended';
    if (descEl) descEl.textContent = 'Your driver account has been suspended for policy compliance check. Please contact compliance@safargo.com.';
    if (rejectionBox) rejectionBox.style.display = 'none';
    if (resubmitBtn) resubmitBtn.style.display = 'none';
  }

  // Real Admin Approval Status Check & Polling
  async function checkBackendApprovalStatus() {
    try {
      const res = await fetch('/api/onboarding/status', {
        headers: authHeaders(true)
      });
      if (!res.ok) return;
      const data = await res.json();
      if (data.hasDriverProfile && data.driverProfile) {
        const p = data.driverProfile;
        onboardingState.verificationStatus = p.verificationStatus;

        if (p.verificationStatus === 'APPROVED') {
          if (window._safargoApprovalTimer) {
            clearInterval(window._safargoApprovalTimer);
            window._safargoApprovalTimer = null;
          }
          alert('🎉 Congratulations! Your SafarGo Driver Application has been APPROVED by Administration.');
          showDriverDashboard();
        } else if (p.verificationStatus === 'REJECTED') {
          if (window._safargoApprovalTimer) {
            clearInterval(window._safargoApprovalTimer);
            window._safargoApprovalTimer = null;
          }
          showDriverStatusScreen('REJECTED', p.rejectionReason);
        }
      }
    } catch (e) {
      // background poll error
    }
  }

  // Active polling while on pending status screen
  if (status === 'PENDING_VERIFICATION') {
    if (window._safargoApprovalTimer) clearInterval(window._safargoApprovalTimer);
    window._safargoApprovalTimer = setInterval(checkBackendApprovalStatus, 4000);
  } else {
    if (window._safargoApprovalTimer) {
      clearInterval(window._safargoApprovalTimer);
      window._safargoApprovalTimer = null;
    }
  }

  const checkStatusBtn = document.getElementById('check-approval-btn');
  if (checkStatusBtn) {
    checkStatusBtn.onclick = async () => {
      checkStatusBtn.disabled = true;
      checkStatusBtn.textContent = 'Checking with Admin server...';
      await checkBackendApprovalStatus();
      setTimeout(() => {
        if (checkStatusBtn) {
          checkStatusBtn.disabled = false;
          checkStatusBtn.textContent = 'Check Approval Status';
        }
      }, 1000);
    };
  }
}

// ============================================================
// 4. APPROVED DRIVER DASHBOARD
// ============================================================
export function showDriverDashboard() {
  // STRICT GUARD: Driver portal cannot open until approved by Admin
  if (onboardingState.verificationStatus !== 'APPROVED') {
    console.warn('[Driver Guard] Access denied. Verification status is:', onboardingState.verificationStatus);
    showDriverStatusScreen(onboardingState.verificationStatus || 'PENDING_VERIFICATION');
    return;
  }

  hideAllScreens();
  const screen = document.getElementById('driver-dashboard-screen');
  if (!screen) return;
  screen.classList.remove('hidden');
  screen.style.display = 'flex';

  const nameEl = document.getElementById('dash-driver-name');
  const vehEl = document.getElementById('dash-driver-veh');
  if (nameEl) nameEl.textContent = onboardingState.fullName || 'SafarGo Driver';
  if (vehEl) {
    const vehName = onboardingState.vehicleType === 'BIKE' ? 'Honda CD70 / Bike' : 'Toyota Corolla / Car';
    vehEl.textContent = `${vehName} • ${onboardingState.registrationNumber || 'Verified'}`;
  }

  // Online / Offline Switch
  const toggleBtn = document.getElementById('driver-status-toggle');
  const toggleLabel = document.getElementById('driver-status-label');
  if (toggleBtn) {
    toggleBtn.onclick = () => {
      const isOnline = toggleBtn.classList.toggle('online');
      if (toggleLabel) toggleLabel.textContent = isOnline ? 'Online' : 'Offline';
    };
  }

  // Interactive Ride Request Accept Flow
  const acceptBtn = document.getElementById('driver-accept-ride-btn');
  const declineBtn = document.getElementById('driver-decline-ride-btn');
  const rideCard = document.getElementById('driver-ride-request-card');
  const activeRideCard = document.getElementById('driver-active-ride-card');

  if (declineBtn && rideCard) {
    declineBtn.onclick = () => {
      rideCard.style.display = 'none';
      setTimeout(() => { rideCard.style.display = 'block'; }, 4000);
    };
  }

  if (acceptBtn && activeRideCard && rideCard) {
    acceptBtn.onclick = () => {
      rideCard.style.display = 'none';
      activeRideCard.style.display = 'block';
    };
  }

  // Active Ride Progression: Arrive -> Start -> Complete
  const rideProgBtn = document.getElementById('active-ride-action-btn');
  const rideProgStatus = document.getElementById('active-ride-status-text');
  let rideStep = 0;
  if (rideProgBtn) {
    rideProgBtn.onclick = () => {
      rideStep++;
      if (rideStep === 1) {
        if (rideProgStatus) rideProgStatus.textContent = 'Arrived at Pickup (Enter Customer PIN)';
        rideProgBtn.innerHTML = '<span>Start Ride (PIN: 4821)</span>';
      } else if (rideStep === 2) {
        if (rideProgStatus) rideProgStatus.textContent = 'Ride In Progress to Destination';
        rideProgBtn.innerHTML = '<span>Complete Ride & Collect PKR 650</span>';
      } else {
        alert('Ride completed! PKR 650 added to your today earnings.');
        activeRideCard.style.display = 'none';
        rideStep = 0;
        if (rideProgBtn) rideProgBtn.innerHTML = '<span>I have Arrived</span>';
        if (rideProgStatus) rideProgStatus.textContent = 'Heading to pickup location (1.2 km away)';
        setTimeout(() => { if (rideCard) rideCard.style.display = 'block'; }, 2000);
      }
    };
  }

  // Switch to Customer Mode
  const switchBtn = document.getElementById('switch-to-customer-btn');
  if (switchBtn) {
    switchBtn.onclick = () => showCustomerDashboard();
  }

  // Driver Logout
  const driverLogoutBtn = document.getElementById('driver-logout-btn');
  if (driverLogoutBtn) {
    driverLogoutBtn.onclick = () => {
      localStorage.removeItem('safargo_token');
      localStorage.removeItem('safargo_user');
      window.location.reload();
    };
  }
}

// ============================================================
// 5. MAIN CUSTOMER DASHBOARD
// ============================================================
export function showCustomerDashboard() {
  hideAllScreens();
  const screen = document.getElementById('app-screen');
  if (!screen) return;
  screen.classList.remove('hidden');
  screen.style.display = 'block';

  // Initialize production Customer Mobile App (Leaflet, Sockets, Realtime Booking)
  initCustomerApp(onboardingState.user || { fullName: onboardingState.fullName });

  // Populate Customer Info
  const welcomeTitle = document.querySelector('.app-welcome-title');
  const welcomeSubtitle = document.querySelector('.app-welcome-subtitle');
  const avatarBadge = document.getElementById('user-avatar-badge');

  if (welcomeTitle && onboardingState.fullName) {
    welcomeTitle.textContent = `Welcome, ${onboardingState.fullName.split(' ')[0]}!`;
  }
  if (welcomeSubtitle && onboardingState.user?.username) {
    welcomeSubtitle.innerHTML = `Signed in as <strong>@${onboardingState.user.username}</strong><br/>Customer Dashboard Ready.`;
  }
  if (avatarBadge && onboardingState.profilePhotoUrl) {
    avatarBadge.innerHTML = `<img src="${onboardingState.profilePhotoUrl}" style="width: 100%; height: 100%; object-fit: cover;" alt="${onboardingState.fullName}" />`;
  }

  // Register / Switch to Driver Mode Button
  let driverModeBtn = document.getElementById('customer-switch-driver-btn');
  if (!driverModeBtn) {
    const mainEl = document.querySelector('.app-main');
    if (mainEl) {
      const btnWrapper = document.createElement('div');
      btnWrapper.innerHTML = `
        <button id="customer-switch-driver-btn" class="app-brand-center-btn" style="width: 100%; border-color: #86EFAC; background: #F0FDF4; cursor: pointer; margin-top: 10px;">
          <div class="app-brand-btn-icon" style="background: #16A34A; color: white;">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="4"/><line x1="4.93" y1="4.93" x2="9.17" y2="9.17"/><line x1="14.83" y1="14.83" x2="19.07" y2="19.07"/><line x1="14.83" y1="9.17" x2="19.07" y2="4.93"/><line x1="4.93" y1="19.07" x2="9.17" y2="14.83"/></svg>
          </div>
          <div class="app-brand-btn-text">
            <strong>Earn as a SafarGo Driver</strong>
            <small>Provide rides, earn daily fares, and grow with SafarGo</small>
          </div>
          <span class="app-brand-arrow">→</span>
        </button>
        <div style="margin-top: 10px;">
          <button id="customer-logout-btn" style="width: 100%; padding: 12px; background: transparent; border: 1px solid #E2E8F0; border-radius: 14px; color: #64748B; font-size: 13px; font-weight: 600; cursor: pointer;">
            Sign Out of SafarGo
          </button>
        </div>
      `;
      mainEl.appendChild(btnWrapper);
      driverModeBtn = document.getElementById('customer-switch-driver-btn');
      const custLogoutBtn = document.getElementById('customer-logout-btn');
      if (custLogoutBtn) {
        custLogoutBtn.onclick = () => {
          localStorage.removeItem('safargo_token');
          localStorage.removeItem('safargo_user');
          window.location.reload();
        };
      }
    }
  }

  if (driverModeBtn) {
    driverModeBtn.onclick = () => {
      saveRole('DRIVER').then(() => {
        if (onboardingState.verificationStatus === 'APPROVED') {
          showDriverDashboard();
        } else if (['PENDING_VERIFICATION', 'REJECTED', 'SUSPENDED'].includes(onboardingState.verificationStatus)) {
          showDriverStatusScreen(onboardingState.verificationStatus);
        } else {
          openDriverOnboardingFlow(0);
        }
      });
    };
  }
}

// Helper: Hide all active screens
function hideAllScreens() {
  const ids = [
    'role-selection-screen',
    'driver-onboarding-screen',
    'driver-status-screen',
    'driver-dashboard-screen',
    'app-screen',
    'auth-screen',
  ];
  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) {
      el.classList.add('hidden');
      el.style.display = 'none';
    }
  });
}

function showError(el, msg) {
  if (!el) return;
  el.textContent = msg;
  el.classList.add('visible');
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}
