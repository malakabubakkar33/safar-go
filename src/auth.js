/**
 * SafarGo - Authentication Controller
 *
 * Sequence:
 * Login Screen <-> Signup Multi-step Flow:
 * Step 1: Basic Information (Name, Email, Phone, Username)
 * Step 2: Real Email OTP Verification (Hardened, Mutex-Protected, Auto-Cleared)
 * Step 3: Profile Photo Setup & Compression
 * Step 4: Password Creation & Validation
 * -> Account Created Success Animation -> Proceed
 */

export function initAuth(onAuthSuccess) {
  const authScreen = document.getElementById('auth-screen');
  if (!authScreen) return;

  // View Containers
  const viewLogin = document.getElementById('view-login');
  const viewSignupStep1 = document.getElementById('view-signup-step1');
  const viewSignupOtp = document.getElementById('view-signup-otp');
  const viewSignupAvatar = document.getElementById('view-signup-avatar');
  const viewSignupPassword = document.getElementById('view-signup-password');
  const viewForgotEmail = document.getElementById('view-forgot-email');
  const viewForgotOtp = document.getElementById('view-forgot-otp');
  const viewForgotPassword = document.getElementById('view-forgot-password');
  const viewSuccess = document.getElementById('auth-success-modal');

  // Session Storage Persistence
  const SIGNUP_SESSION_KEY = 'safargo_signup_flow';

  function saveSignupSession(state) {
    try {
      sessionStorage.setItem(SIGNUP_SESSION_KEY, JSON.stringify({
        fullName: state.fullName || '',
        email: state.email || '',
        phone: state.phone || '',
        username: state.username || '',
        emailMasked: state.emailMasked || '',
        verificationToken: state.verificationToken || null,
        avatarUrl: state.avatarUrl || null,
      }));
    } catch {}
  }

  function loadSignupSession() {
    try {
      const raw = sessionStorage.getItem(SIGNUP_SESSION_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  function clearSignupSession() {
    try {
      sessionStorage.removeItem(SIGNUP_SESSION_KEY);
    } catch {}
  }

  // Restore saved session or initialize default
  const savedSession = loadSignupSession();
  const signupState = {
    fullName: savedSession?.fullName || '',
    email: savedSession?.email || '',
    phone: savedSession?.phone || '',
    username: savedSession?.username || '',
    emailMasked: savedSession?.emailMasked || '',
    verificationToken: savedSession?.verificationToken || null,
    avatarFile: null,
    avatarUrl: savedSession?.avatarUrl || null,
  };

  let resendInterval = null;
  let isVerifying = false;
  let isResending = false;
  let autoSubmitDebounce = null;

  // Helper to switch views smoothly
  function switchView(activeView) {
    const allViews = [
      viewLogin,
      viewSignupStep1,
      viewSignupOtp,
      viewSignupAvatar,
      viewSignupPassword,
      viewForgotEmail,
      viewForgotOtp,
      viewForgotPassword,
    ];
    allViews.forEach(v => {
      if (v) v.style.display = 'none';
    });
    if (activeView) {
      activeView.style.display = 'flex';
      hideAlert(activeView);
    }
  }

  function showAlert(container, message, isSuccess = false) {
    if (!container) return;
    const alert = container.querySelector('.auth-alert');
    if (alert) {
      const textSpan = alert.querySelector('.auth-alert-text');
      if (textSpan) textSpan.textContent = message;
      alert.classList.toggle('success', Boolean(isSuccess));
      alert.classList.add('visible');
      alert.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }

  function hideAlert(container) {
    if (!container) return;
    const alert = container.querySelector('.auth-alert');
    if (alert) {
      alert.classList.remove('visible');
      alert.classList.remove('success');
    }
  }

  // ============================================================
  // 1. LOGIN VIEW LOGIC
  // ============================================================
  const loginForm = document.getElementById('login-form');
  const loginIdentifier = document.getElementById('login-identifier');
  const loginPassword = document.getElementById('login-password');
  const loginBtn = document.getElementById('login-btn');
  const toSignupBtn = document.getElementById('to-signup-btn');
  const toggleLoginPwd = document.getElementById('toggle-login-pwd');

  if (toggleLoginPwd && loginPassword) {
    toggleLoginPwd.addEventListener('click', () => {
      const isPwd = loginPassword.type === 'password';
      loginPassword.type = isPwd ? 'text' : 'password';
      toggleLoginPwd.innerHTML = isPwd 
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    });
  }

  if (toSignupBtn) {
    toSignupBtn.addEventListener('click', (e) => {
      e.preventDefault();
      switchView(viewSignupStep1);
    });
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(viewLogin);

      const identifier = loginIdentifier.value.trim();
      const password = loginPassword.value;

      if (!identifier) {
        showAlert(viewLogin, 'Please enter your username, email, or phone number.');
        loginIdentifier.focus();
        return;
      }
      if (!password) {
        showAlert(viewLogin, 'Please enter your password.');
        loginPassword.focus();
        return;
      }

      loginBtn.disabled = true;
      loginBtn.innerHTML = '<span>Logging in...</span>';

      try {
        const res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ identifier, password }),
        });

        let data = {};
        try {
          data = await res.json();
        } catch {
          data = { error: res.statusText || 'Unable to connect to SafarGo Authentication server.' };
        }
        if (!res.ok) {
          throw new Error(data.error || 'Login failed.');
        }

        localStorage.setItem('safargo_token', data.token);
        localStorage.setItem('safargo_user', JSON.stringify(data.user));

        // If user is ADMIN or SUPERADMIN, directly launch Admin Console
        if (data.user && ['ADMIN', 'SUPERADMIN'].includes(data.user.role)) {
          localStorage.setItem('safargo_admin_token', data.token);
          window.location.href = '/admin.html';
          return;
        }

        finishAuthSuccess(data.user, false);

      } catch (err) {
        showAlert(viewLogin, err.message);
      } finally {
        loginBtn.disabled = false;
        loginBtn.innerHTML = '<span>Login</span>';
      }
    });
  }

  // ============================================================
  // 2. SIGNUP STEP 1: Basic Information
  // ============================================================
  const signupStep1Form = document.getElementById('signup-step1-form');
  const step1FullName = document.getElementById('step1-fullname');
  const step1Email = document.getElementById('step1-email');
  const step1Phone = document.getElementById('step1-phone');
  const step1Username = document.getElementById('step1-username');
  const step1NextBtn = document.getElementById('step1-next-btn');
  const toLoginFromStep1 = document.getElementById('to-login-from-step1');
  const backToLoginFromStep1 = document.getElementById('back-to-login-btn');

  if (toLoginFromStep1) toLoginFromStep1.addEventListener('click', () => switchView(viewLogin));
  if (backToLoginFromStep1) backToLoginFromStep1.addEventListener('click', () => switchView(viewLogin));

  // Populate cached fields if available
  if (signupState.fullName && step1FullName) step1FullName.value = signupState.fullName;
  if (signupState.email && step1Email) step1Email.value = signupState.email;
  if (signupState.phone && step1Phone) step1Phone.value = signupState.phone;
  if (signupState.username && step1Username) step1Username.value = signupState.username;

  if (signupStep1Form) {
    signupStep1Form.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(viewSignupStep1);

      const fullName = step1FullName.value.trim();
      const email = step1Email.value.trim().toLowerCase();
      const phone = step1Phone.value.trim();
      const username = step1Username.value.trim().toLowerCase();

      if (!fullName) {
        showAlert(viewSignupStep1, 'Full name is required.');
        step1FullName.focus();
        return;
      }
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showAlert(viewSignupStep1, 'Please enter a valid email address.');
        step1Email.focus();
        return;
      }
      if (!phone || phone.length < 8) {
        showAlert(viewSignupStep1, 'Please enter a valid phone number.');
        step1Phone.focus();
        return;
      }
      if (!username || !/^[a-zA-Z0-9_]{3,24}$/.test(username)) {
        showAlert(viewSignupStep1, 'Username must be 3-24 characters (letters, numbers, underscores).');
        step1Username.focus();
        return;
      }

      step1NextBtn.disabled = true;
      step1NextBtn.innerHTML = '<span>Sending verification code...</span>';

      try {
        const res = await fetch('/api/auth/signup-step1', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ fullName, email, phone, username }),
        });

        let data = {};
        try {
          data = await res.json();
        } catch {
          data = { error: res.statusText || 'Unable to connect to SafarGo Authentication server.' };
        }
        if (!res.ok) {
          throw new Error(data.error || 'Failed to submit information.');
        }

        // Store state & persist session
        signupState.fullName = fullName;
        signupState.email = email;
        signupState.phone = phone;
        signupState.username = username;
        signupState.emailMasked = data.emailMasked || email;
        saveSignupSession(signupState);

        // Transition to Step 2 (OTP)
        setupOtpView(data.cooldownSeconds || 60);
        switchView(viewSignupOtp);

        if (data.devOtp) {
          showAlert(viewSignupOtp, `Testing Verification Code: ${data.devOtp} (or 123456)`, true);
        }

      } catch (err) {
        showAlert(viewSignupStep1, err.message);
      } finally {
        step1NextBtn.disabled = false;
        step1NextBtn.innerHTML = '<span>Next</span>';
      }
    });
  }

  // ============================================================
  // 3. SIGNUP STEP 2: Real Email OTP Verification
  // ============================================================
  const otpBoxes = document.querySelectorAll('.otp-box');
  const otpMaskedEmailText = document.getElementById('otp-masked-email');
  const otpVerifyBtn = document.getElementById('otp-verify-btn');
  const otpResendBtn = document.getElementById('otp-resend-btn');
  const otpCooldownText = document.getElementById('otp-cooldown-text');
  const backToStep1Btn = document.getElementById('back-to-step1-btn');

  if (backToStep1Btn) {
    backToStep1Btn.addEventListener('click', () => {
      clearInterval(resendInterval);
      switchView(viewSignupStep1);
    });
  }

  function setupOtpView(cooldownSec = 60) {
    if (otpMaskedEmailText) {
      otpMaskedEmailText.textContent = signupState.emailMasked || signupState.email;
    }
    // Clear boxes
    otpBoxes.forEach(b => {
      b.value = '';
      b.classList.remove('filled');
      b.disabled = false;
    });
    setTimeout(() => {
      if (otpBoxes[0]) otpBoxes[0].focus();
    }, 80);
    startOtpCooldown(cooldownSec);
  }

  function startOtpCooldown(seconds) {
    clearInterval(resendInterval);
    let remaining = seconds;
    otpResendBtn.disabled = true;
    otpCooldownText.textContent = `(${remaining}s)`;

    resendInterval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(resendInterval);
        otpResendBtn.disabled = false;
        otpCooldownText.textContent = '';
      } else {
        otpCooldownText.textContent = `(${remaining}s)`;
      }
    }, 1000);
  }

  // OTP Box Navigation & Paste Support
  otpBoxes.forEach((box, idx) => {
    box.addEventListener('input', (e) => {
      if (isVerifying) return;
      const val = e.target.value.replace(/\D/g, '');
      e.target.value = val ? val[0] : '';
      if (e.target.value) {
        box.classList.add('filled');
        if (idx < otpBoxes.length - 1) otpBoxes[idx + 1].focus();
      } else {
        box.classList.remove('filled');
      }

      // Check if all 6 filled (debounced to avoid multiple requests)
      const enteredOtp = Array.from(otpBoxes).map(b => b.value.trim()).join('');
      if (enteredOtp.length === 6) {
        clearTimeout(autoSubmitDebounce);
        autoSubmitDebounce = setTimeout(() => {
          if (!isVerifying) {
            submitOtpVerification(enteredOtp);
          }
        }, 100);
      }
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && idx > 0) {
        otpBoxes[idx - 1].focus();
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const full = Array.from(otpBoxes).map(b => b.value.trim()).join('');
        if (full.length === 6 && !isVerifying) {
          submitOtpVerification(full);
        }
      }
    });

    box.addEventListener('paste', (e) => {
      if (isVerifying) return;
      e.preventDefault();
      const pasteData = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
      if (pasteData) {
        for (let i = 0; i < otpBoxes.length; i++) {
          otpBoxes[i].value = pasteData[i] || '';
          if (otpBoxes[i].value) otpBoxes[i].classList.add('filled');
          else otpBoxes[i].classList.remove('filled');
        }
        const full = Array.from(otpBoxes).map(b => b.value.trim()).join('');
        if (full.length === 6) {
          clearTimeout(autoSubmitDebounce);
          autoSubmitDebounce = setTimeout(() => {
            if (!isVerifying) {
              submitOtpVerification(full);
            }
          }, 100);
        } else if (otpBoxes[pasteData.length]) {
          otpBoxes[pasteData.length].focus();
        }
      }
    });
  });

  // Resend OTP Action
  if (otpResendBtn) {
    otpResendBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (isResending || isVerifying) return;

      const emailToResend = String(signupState.email || '').trim().toLowerCase();
      if (!emailToResend) {
        showAlert(viewSignupOtp, 'Signup session expired. Please return to step 1.');
        return;
      }

      hideAlert(viewSignupOtp);
      isResending = true;
      otpResendBtn.disabled = true;
      const originalText = otpResendBtn.textContent;
      otpResendBtn.textContent = 'Sending...';

      try {
        const res = await fetch('/api/auth/resend-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: emailToResend }),
        });

        const data = await res.json().catch(() => ({ error: 'Network error. Please try again.' }));

        if (!res.ok || !data.success) {
          if (data.code === 'OTP_RATE_LIMITED' && data.retryAfter) {
            startOtpCooldown(data.retryAfter);
            showAlert(viewSignupOtp, data.error || `Please wait ${data.retryAfter}s before resending.`);
            return;
          }
          throw new Error(data.error || 'Failed to resend verification code.');
        }

        // 1. Clear old OTP boxes completely
        otpBoxes.forEach(b => {
          b.value = '';
          b.classList.remove('filled');
          b.disabled = false;
        });

        // 2. Focus the first box
        setTimeout(() => {
          if (otpBoxes[0]) otpBoxes[0].focus();
        }, 80);

        // 3. Start countdown timer
        startOtpCooldown(data.cooldownSeconds || 60);

        // 4. Show success banner
        showAlert(viewSignupOtp, 'A new verification code has been sent to your email.', true);

      } catch (err) {
        showAlert(viewSignupOtp, err.message);
        otpResendBtn.disabled = false;
      } finally {
        isResending = false;
        otpResendBtn.textContent = originalText;
      }
    });
  }

  // Verify OTP Action (Race-condition protected with Mutex)
  async function submitOtpVerification(otpCode) {
    if (isVerifying) return;

    const cleanCode = String(otpCode || '').trim().replace(/\D/g, '');
    if (cleanCode.length !== 6) {
      showAlert(viewSignupOtp, 'Please enter the complete 6-digit verification code.');
      return;
    }

    const emailToVerify = String(signupState.email || '').trim().toLowerCase();
    if (!emailToVerify) {
      showAlert(viewSignupOtp, 'Signup session expired. Please return to step 1.');
      return;
    }

    isVerifying = true;
    hideAlert(viewSignupOtp);
    otpVerifyBtn.disabled = true;
    otpVerifyBtn.innerHTML = '<span>Verifying code...</span>';
    otpBoxes.forEach(b => b.disabled = true);

    try {
      const res = await fetch('/api/auth/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailToVerify, otp: cleanCode }),
      });

      const data = await res.json().catch(() => ({ error: 'Network error communicating with server.' }));

      if (!res.ok || !data.success) {
        let userMsg = data.error || 'Invalid verification code.';
        if (data.code === 'OTP_EXPIRED') {
          userMsg = 'This verification code has expired. Please click "Resend Code" below.';
        } else if (data.code === 'OTP_ATTEMPTS_EXCEEDED') {
          userMsg = 'Too many incorrect attempts. Please click "Resend Code" to receive a new code.';
        } else if (data.code === 'OTP_SESSION_NOT_FOUND') {
          userMsg = 'No active verification session. Please click "Resend Code" or start again.';
        }
        throw new Error(userMsg);
      }

      // Success!
      signupState.verificationToken = data.verificationToken;
      saveSignupSession(signupState);
      clearInterval(resendInterval);

      // Smooth transition to Step 3 (Profile Photo)
      switchView(viewSignupAvatar);

    } catch (err) {
      showAlert(viewSignupOtp, err.message);
      otpBoxes.forEach(b => b.disabled = false);
      const firstEmpty = Array.from(otpBoxes).find(b => !b.value);
      if (firstEmpty) firstEmpty.focus();
      else if (otpBoxes[5]) otpBoxes[5].focus();
    } finally {
      isVerifying = false;
      otpBoxes.forEach(b => b.disabled = false);
      otpVerifyBtn.disabled = false;
      otpVerifyBtn.innerHTML = '<span>Verify Code</span>';
    }
  }

  if (otpVerifyBtn) {
    otpVerifyBtn.addEventListener('click', () => {
      if (isVerifying) return;
      const enteredOtp = Array.from(otpBoxes).map(b => b.value.trim()).join('');
      if (enteredOtp.length !== 6) {
        showAlert(viewSignupOtp, 'Please enter the complete 6-digit verification code.');
        return;
      }
      submitOtpVerification(enteredOtp);
    });
  }

  // ============================================================
  // 4. SIGNUP STEP 3: Profile Image Setup & Client Optimization
  // ============================================================
  const avatarFileInput = document.getElementById('avatar-file-input');
  const avatarCameraInput = document.getElementById('avatar-camera-input');
  const avatarPreviewImg = document.getElementById('avatar-preview-img');
  const avatarPlaceholder = document.getElementById('avatar-placeholder');
  const btnChooseGallery = document.getElementById('btn-choose-gallery');
  const btnTakePhoto = document.getElementById('btn-take-photo');
  const avatarNextBtn = document.getElementById('avatar-next-btn');
  const backToOtpBtn = document.getElementById('back-to-otp-btn');

  if (backToOtpBtn) {
    backToOtpBtn.addEventListener('click', () => switchView(viewSignupOtp));
  }

  if (btnChooseGallery && avatarFileInput) {
    btnChooseGallery.addEventListener('click', () => avatarFileInput.click());
  }

  if (btnTakePhoto && avatarCameraInput) {
    btnTakePhoto.addEventListener('click', () => avatarCameraInput.click());
  }

  function handleFileSelected(file) {
    if (!file) return;
    hideAlert(viewSignupAvatar);

    // Optimize image in browser via HTML5 Canvas (max 600x600, quality 0.85 JPEG)
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const maxDim = 600;
        let width = img.width;
        let height = img.height;

        if (width > height && width > maxDim) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else if (height > maxDim) {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        canvas.toBlob((blob) => {
          signupState.avatarFile = new File([blob], 'avatar.jpg', { type: 'image/jpeg' });
          avatarPreviewImg.src = canvas.toDataURL('image/jpeg');
          avatarPreviewImg.style.display = 'block';
          avatarPlaceholder.style.display = 'none';
        }, 'image/jpeg', 0.85);
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  if (avatarFileInput) {
    avatarFileInput.addEventListener('change', (e) => handleFileSelected(e.target.files[0]));
  }
  if (avatarCameraInput) {
    avatarCameraInput.addEventListener('change', (e) => handleFileSelected(e.target.files[0]));
  }

  if (avatarNextBtn) {
    avatarNextBtn.addEventListener('click', async () => {
      hideAlert(viewSignupAvatar);

      // If user selected an image, upload it
      if (signupState.avatarFile) {
        avatarNextBtn.disabled = true;
        avatarNextBtn.innerHTML = '<span>Uploading photo...</span>';

        try {
          const formData = new FormData();
          formData.append('avatar', signupState.avatarFile);

          const res = await fetch('/api/auth/upload-avatar', {
            method: 'POST',
            body: formData,
          });

          const data = await res.json().catch(() => ({ error: 'Upload failed' }));
          if (!res.ok) throw new Error(data.error || 'Failed to upload photo.');
          signupState.avatarUrl = data.avatarUrl;
          saveSignupSession(signupState);
        } catch (err) {
          showAlert(viewSignupAvatar, err.message);
          avatarNextBtn.disabled = false;
          avatarNextBtn.innerHTML = '<span>Next</span>';
          return;
        }
      }

      avatarNextBtn.disabled = false;
      avatarNextBtn.innerHTML = '<span>Next</span>';
      switchView(viewSignupPassword);
    });
  }

  // ============================================================
  // 5. SIGNUP STEP 4: Password Creation & Strength Meter
  // ============================================================
  const signupPasswordForm = document.getElementById('signup-password-form');
  const step4Pwd = document.getElementById('step4-password');
  const step4Confirm = document.getElementById('step4-confirm-password');
  const toggleStep4Pwd = document.getElementById('toggle-step4-pwd');
  const toggleStep4Confirm = document.getElementById('toggle-step4-confirm');
  const step4SubmitBtn = document.getElementById('step4-submit-btn');
  const backToAvatarBtn = document.getElementById('back-to-avatar-btn');

  // Strength rules elements
  const ruleLength = document.getElementById('rule-length');
  const ruleUpper = document.getElementById('rule-upper');
  const ruleLower = document.getElementById('rule-lower');
  const ruleNumber = document.getElementById('rule-number');
  const meterBars = document.querySelectorAll('.meter-bar');

  if (backToAvatarBtn) {
    backToAvatarBtn.addEventListener('click', () => switchView(viewSignupAvatar));
  }

  function setupPasswordToggle(btn, input) {
    if (!btn || !input) return;
    btn.addEventListener('click', () => {
      const isPwd = input.type === 'password';
      input.type = isPwd ? 'text' : 'password';
    });
  }
  setupPasswordToggle(toggleStep4Pwd, step4Pwd);
  setupPasswordToggle(toggleStep4Confirm, step4Confirm);

  function checkPasswordStrength(val) {
    const hasLen = val.length >= 8;
    const hasUp = /[A-Z]/.test(val);
    const hasLow = /[a-z]/.test(val);
    const hasNum = /[0-9]/.test(val);

    if (ruleLength) ruleLength.classList.toggle('valid', hasLen);
    if (ruleUpper) ruleUpper.classList.toggle('valid', hasUp);
    if (ruleLower) ruleLower.classList.toggle('valid', hasLow);
    if (ruleNumber) ruleNumber.classList.toggle('valid', hasNum);

    const score = [hasLen, hasUp, hasLow, hasNum].filter(Boolean).length;

    meterBars.forEach((bar, idx) => {
      bar.className = 'meter-bar';
      if (idx < score) {
        if (score <= 2) bar.classList.add('active-weak');
        else if (score === 3) bar.classList.add('active-medium');
        else bar.classList.add('active-strong');
      }
    });

    return score === 4;
  }

  if (step4Pwd) {
    step4Pwd.addEventListener('input', (e) => checkPasswordStrength(e.target.value));
  }

  if (signupPasswordForm) {
    signupPasswordForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(viewSignupPassword);

      const password = step4Pwd.value;
      const confirmPassword = step4Confirm.value;

      if (!checkPasswordStrength(password)) {
        showAlert(viewSignupPassword, 'Please satisfy all password security requirements.');
        return;
      }

      if (password !== confirmPassword) {
        showAlert(viewSignupPassword, 'Passwords do not match. Please check again.');
        step4Confirm.focus();
        return;
      }

      if (!signupState.verificationToken) {
        showAlert(viewSignupPassword, 'Verification session expired. Please verify your email again.');
        return;
      }

      step4SubmitBtn.disabled = true;
      step4SubmitBtn.innerHTML = '<span>Creating your account...</span>';

      try {
        const res = await fetch('/api/auth/create-account', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            verificationToken: signupState.verificationToken,
            password,
            confirmPassword,
            avatarUrl: signupState.avatarUrl || '/brand/safargo-symbol.svg',
          }),
        });

        let data = {};
        try {
          data = await res.json();
        } catch {
          data = { error: res.statusText || 'Unable to connect to server.' };
        }
        if (!res.ok) throw new Error(data.error || 'Failed to create account.');

        localStorage.setItem('safargo_token', data.token);
        localStorage.setItem('safargo_user', JSON.stringify(data.user));

        clearSignupSession();
        showAccountCreatedSuccess(data.user);

      } catch (err) {
        showAlert(viewSignupPassword, err.message);
        step4SubmitBtn.disabled = false;
        step4SubmitBtn.innerHTML = '<span>Create Account</span>';
      }
    });
  }

  // ============================================================
  // 6. FORGOT PASSWORD FLOW
  // ============================================================
  const authForgotLink = document.getElementById('auth-forgot-link');
  const backToLoginFromForgot = document.getElementById('back-to-login-from-forgot');
  const toLoginFromForgotLink = document.getElementById('to-login-from-forgot-link');
  const forgotEmailForm = document.getElementById('forgot-email-form');
  const forgotEmailInput = document.getElementById('forgot-email-input');
  const forgotEmailSubmitBtn = document.getElementById('forgot-email-submit-btn');
  const backToForgotEmailBtn = document.getElementById('back-to-forgot-email-btn');
  const forgotMaskedEmail = document.getElementById('forgot-masked-email');
  const forgotOtpForm = document.getElementById('forgot-otp-form');
  const forgotOtpBoxes = document.querySelectorAll('.forgot-otp-box');
  const forgotOtpSubmitBtn = document.getElementById('forgot-otp-submit-btn');
  const forgotResendBtn = document.getElementById('forgot-resend-btn');
  const forgotResendTimer = document.getElementById('forgot-resend-timer');
  const forgotNewPwdForm = document.getElementById('forgot-new-pwd-form');
  const forgotNewPwd = document.getElementById('forgot-new-pwd');
  const forgotConfirmPwd = document.getElementById('forgot-confirm-pwd');
  const toggleForgotNewPwd = document.getElementById('toggle-forgot-new-pwd');
  const forgotNewPwdSubmitBtn = document.getElementById('forgot-new-pwd-submit-btn');

  let forgotState = {
    email: '',
    emailMasked: '',
    resetToken: null,
    timerInterval: null,
  };

  // Navigations
  if (authForgotLink) {
    authForgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      switchView(viewForgotEmail);
      if (forgotEmailInput) {
        forgotEmailInput.value = '';
        setTimeout(() => forgotEmailInput.focus(), 80);
      }
    });
  }

  if (backToLoginFromForgot) {
    backToLoginFromForgot.addEventListener('click', () => switchView(viewLogin));
  }
  if (toLoginFromForgotLink) {
    toLoginFromForgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      switchView(viewLogin);
    });
  }
  if (backToForgotEmailBtn) {
    backToForgotEmailBtn.addEventListener('click', () => {
      if (forgotState.timerInterval) clearInterval(forgotState.timerInterval);
      switchView(viewForgotEmail);
    });
  }

  // Toggle Forgot New Password Visibility
  if (toggleForgotNewPwd && forgotNewPwd) {
    toggleForgotNewPwd.addEventListener('click', () => {
      const isPwd = forgotNewPwd.type === 'password';
      forgotNewPwd.type = isPwd ? 'text' : 'password';
      toggleForgotNewPwd.innerHTML = isPwd
        ? '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>'
        : '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>';
    });
  }

  function startForgotCooldown(seconds = 60) {
    if (forgotState.timerInterval) clearInterval(forgotState.timerInterval);
    if (!forgotResendBtn || !forgotResendTimer) return;

    let remaining = seconds;
    forgotResendBtn.disabled = true;
    forgotResendTimer.textContent = String(remaining);

    forgotState.timerInterval = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(forgotState.timerInterval);
        forgotResendBtn.disabled = false;
        forgotResendTimer.textContent = '0';
      } else {
        forgotResendTimer.textContent = String(remaining);
      }
    }, 1000);
  }

  // 1. Submit Forgot Email
  if (forgotEmailForm) {
    forgotEmailForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(viewForgotEmail);

      const email = forgotEmailInput ? forgotEmailInput.value.trim().toLowerCase() : '';
      if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        showAlert(viewForgotEmail, 'Please enter a valid registered email address.');
        if (forgotEmailInput) forgotEmailInput.focus();
        return;
      }

      if (forgotEmailSubmitBtn) {
        forgotEmailSubmitBtn.disabled = true;
        forgotEmailSubmitBtn.innerHTML = '<span>Verifying account...</span>';
      }

      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });

        let data = {};
        try {
          data = await res.json();
        } catch {
          data = { error: res.statusText || 'Unable to connect to server.' };
        }
        if (!res.ok) {
          throw new Error(data.error || 'No account found with this email.');
        }

        forgotState.email = data.email || email;
        forgotState.emailMasked = data.emailMasked || email;

        if (forgotMaskedEmail) {
          forgotMaskedEmail.textContent = forgotState.emailMasked;
        }

        // Reset OTP inputs
        forgotOtpBoxes.forEach((box) => {
          box.value = '';
          box.classList.remove('filled');
        });

        startForgotCooldown(60);
        switchView(viewForgotOtp);

        setTimeout(() => {
          if (forgotOtpBoxes[0]) forgotOtpBoxes[0].focus();
        }, 100);

      } catch (err) {
        showAlert(viewForgotEmail, err.message);
      } finally {
        if (forgotEmailSubmitBtn) {
          forgotEmailSubmitBtn.disabled = false;
          forgotEmailSubmitBtn.innerHTML = '<span>Send Reset Code</span>';
        }
      }
    });
  }

  // Forgot OTP Box inputs logic
  forgotOtpBoxes.forEach((box, idx) => {
    box.addEventListener('input', (e) => {
      const val = e.target.value.replace(/\D/g, '');
      e.target.value = val ? val[0] : '';
      if (e.target.value) {
        box.classList.add('filled');
        if (idx < forgotOtpBoxes.length - 1) {
          forgotOtpBoxes[idx + 1].focus();
        }
      } else {
        box.classList.remove('filled');
      }

      const allFilled = Array.from(forgotOtpBoxes).every(b => b.value.length === 1);
      if (allFilled) {
        submitForgotOtp();
      }
    });

    box.addEventListener('keydown', (e) => {
      if (e.key === 'Backspace' && !box.value && idx > 0) {
        forgotOtpBoxes[idx - 1].focus();
      }
    });

    box.addEventListener('paste', (e) => {
      e.preventDefault();
      const paste = (e.clipboardData || window.clipboardData).getData('text').replace(/\D/g, '').slice(0, 6);
      if (paste) {
        paste.split('').forEach((ch, i) => {
          if (forgotOtpBoxes[i]) {
            forgotOtpBoxes[i].value = ch;
            forgotOtpBoxes[i].classList.add('filled');
          }
        });
        if (paste.length === 6) {
          submitForgotOtp();
        } else if (forgotOtpBoxes[paste.length]) {
          forgotOtpBoxes[paste.length].focus();
        }
      }
    });
  });

  async function submitForgotOtp() {
    hideAlert(viewForgotOtp);
    const otp = Array.from(forgotOtpBoxes).map(b => b.value.trim()).join('');
    if (otp.length !== 6) {
      showAlert(viewForgotOtp, 'Please enter the complete 6-digit verification code.');
      return;
    }

    if (forgotOtpSubmitBtn) {
      forgotOtpSubmitBtn.disabled = true;
      forgotOtpSubmitBtn.innerHTML = '<span>Verifying code...</span>';
    }

    try {
      const res = await fetch('/api/auth/verify-reset-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: forgotState.email, otp }),
      });

      let data = {};
      try {
        data = await res.json();
      } catch {
        data = { error: res.statusText || 'Unable to connect to server.' };
      }
      if (!res.ok) {
        throw new Error(data.error || 'Invalid verification code.');
      }

      forgotState.resetToken = data.resetToken;
      if (forgotState.timerInterval) clearInterval(forgotState.timerInterval);

      switchView(viewForgotPassword);
      if (forgotNewPwd) {
        forgotNewPwd.value = '';
        setTimeout(() => forgotNewPwd.focus(), 100);
      }
      if (forgotConfirmPwd) forgotConfirmPwd.value = '';

    } catch (err) {
      showAlert(viewForgotOtp, err.message);
      forgotOtpBoxes.forEach(b => b.classList.add('error'));
      setTimeout(() => forgotOtpBoxes.forEach(b => b.classList.remove('error')), 1500);
    } finally {
      if (forgotOtpSubmitBtn) {
        forgotOtpSubmitBtn.disabled = false;
        forgotOtpSubmitBtn.innerHTML = '<span>Verify Code</span>';
      }
    }
  }

  if (forgotOtpForm) {
    forgotOtpForm.addEventListener('submit', (e) => {
      e.preventDefault();
      submitForgotOtp();
    });
  }

  // Resend reset code
  if (forgotResendBtn) {
    forgotResendBtn.addEventListener('click', async () => {
      if (!forgotState.email) return;
      hideAlert(viewForgotOtp);
      forgotResendBtn.disabled = true;

      try {
        const res = await fetch('/api/auth/forgot-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: forgotState.email }),
        });

        let data = {};
        try {
          data = await res.json();
        } catch {
          data = { error: res.statusText || 'Unable to connect to server.' };
        }
        if (!res.ok) throw new Error(data.error || 'Failed to resend code.');

        startForgotCooldown(60);
        showAlert(viewForgotOtp, 'A new verification code has been sent to your email.', true);
      } catch (err) {
        showAlert(viewForgotOtp, err.message);
        forgotResendBtn.disabled = false;
      }
    });
  }

  // 3. Submit New Password
  if (forgotNewPwdForm) {
    forgotNewPwdForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      hideAlert(viewForgotPassword);

      const newPassword = forgotNewPwd ? forgotNewPwd.value : '';
      const confirmPassword = forgotConfirmPwd ? forgotConfirmPwd.value : '';

      if (!newPassword || newPassword.length < 8) {
        showAlert(viewForgotPassword, 'Password must be at least 8 characters long.');
        if (forgotNewPwd) forgotNewPwd.focus();
        return;
      }

      if (newPassword !== confirmPassword) {
        showAlert(viewForgotPassword, 'Passwords do not match. Please verify both fields.');
        if (forgotConfirmPwd) forgotConfirmPwd.focus();
        return;
      }

      if (!forgotState.resetToken) {
        showAlert(viewForgotPassword, 'Password reset session expired. Please start again.');
        return;
      }

      if (forgotNewPwdSubmitBtn) {
        forgotNewPwdSubmitBtn.disabled = true;
        forgotNewPwdSubmitBtn.innerHTML = '<span>Updating password...</span>';
      }

      try {
        const res = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            resetToken: forgotState.resetToken,
            newPassword,
          }),
        });

        let data = {};
        try {
          data = await res.json();
        } catch {
          data = { error: res.statusText || 'Unable to connect to server.' };
        }
        if (!res.ok) {
          throw new Error(data.error || 'Failed to update password.');
        }

        // Return to login screen with prefilled email and notification
        switchView(viewLogin);
        if (loginIdentifier) loginIdentifier.value = forgotState.email;
        if (loginPassword) loginPassword.value = '';
        showAlert(
          viewLogin,
          'Password reset successfully! Your previous password has been replaced. Please log in with your new password.',
          true
        );

        // Reset state
        forgotState = {
          email: '',
          emailMasked: '',
          resetToken: null,
          timerInterval: null,
        };

      } catch (err) {
        showAlert(viewForgotPassword, err.message);
      } finally {
        if (forgotNewPwdSubmitBtn) {
          forgotNewPwdSubmitBtn.disabled = false;
          forgotNewPwdSubmitBtn.innerHTML = '<span>Reset & Save Password</span>';
        }
      }
    });
  }

  // ============================================================
  // 7. SUCCESS TRANSITION
  // ============================================================
  function showAccountCreatedSuccess(user) {
    if (viewSuccess) {
      const nameEl = document.getElementById('success-user-name');
      if (nameEl) nameEl.textContent = `Welcome, ${user.fullName}!`;
      viewSuccess.classList.add('visible');

      setTimeout(() => {
        finishAuthSuccess(user, true);
      }, 2000);
    } else {
      finishAuthSuccess(user, true);
    }
  }

  function finishAuthSuccess(user, isNewSignup = false) {
    authScreen.classList.add('auth-hidden');
    setTimeout(() => {
      authScreen.style.display = 'none';
      if (typeof onAuthSuccess === 'function') {
        onAuthSuccess(user, isNewSignup);
      }
    }, 450);
  }

  // Initial View is Login
  switchView(viewLogin);
}
