/**
 * SafarGo - Main Application Coordinator
 *
 * Lifecycle Sequence:
 * 0. Sentry Error Tracking & Device Location Initialization
 * 1. Splash Screen (Muted Video Animation)
 * 2. Onboarding Experience (Bike -> Car -> Location)
 * 3. Authentication Flow (Login <-> 4-Step Signup: Info -> Real Email OTP -> Profile Photo -> Password)
 * 4. Account Created -> Application State
 */

import { Sentry, mountErrorButton } from './sentry.js';
import { locationService } from './locationService.js';
import { initSplashScreen } from './splash.js';
import { initOnboarding } from './onboarding.js';
import { initAuth } from './auth.js';

import { initOnboardingCoordinator } from './driverOnboarding.js';

// Phase 0: Initialize Sentry Monitoring & Error Tracking
Sentry.init({
  dsn: "https://a28109ca331da63b2173a570b29c2112@o4512215495868416.ingest.de.sentry.io/4512215507927120",
  tracesSampleRate: 1.0,
  tracePropagationTargets: ["localhost", /^https:\/\/yourserver\.io\/api/, "/api"],
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Mount the test ErrorButton requested to verify Sentry error tracking
mountErrorButton();

// Pre-fetch device location in background for ride matching
locationService.getCurrentPosition().catch((err) => {
  Sentry.logger.warn('Failed to pre-fetch location', { error: err.message });
});

// Auto-login & Direct App Launch: Skip Splash, Onboarding & Login if already authenticated
const savedToken = localStorage.getItem('safargo_token');

if (savedToken) {
  // Immediately suppress splash & onboarding screens to prevent any flash
  const splashEl = document.getElementById('splash-screen');
  if (splashEl) splashEl.style.display = 'none';

  const onboardingEl = document.getElementById('onboarding-screen');
  if (onboardingEl) onboardingEl.style.display = 'none';

  const authEl = document.getElementById('auth-screen');
  if (authEl) {
    authEl.style.display = 'none';
    authEl.classList.add('auth-hidden');
  }

  fetch('/api/auth/me', {
    headers: { Authorization: `Bearer ${savedToken}` },
  })
    .then((res) => {
      if (!res.ok) throw new Error('Session expired');
      return res.json();
    })
    .then((data) => {
      const activeUser = data.user;
      localStorage.setItem('safargo_user', JSON.stringify(activeUser));

      // Direct Admin Console launch if user is ADMIN or SUPERADMIN
      if (activeUser && ['ADMIN', 'SUPERADMIN'].includes(activeUser.role)) {
        localStorage.setItem('safargo_admin_token', savedToken);
        window.location.href = '/admin.html';
        return;
      }

      // Direct app launch
      initOnboardingCoordinator(activeUser, false);
    })
    .catch(() => {
      localStorage.removeItem('safargo_token');
      localStorage.removeItem('safargo_user');
      if (splashEl) splashEl.style.display = '';
      runInitialFreshFlow();
    });
} else {
  runInitialFreshFlow();
}

function runInitialFreshFlow() {
  // Phase 1: Start Splash Screen
  initSplashScreen(() => {
    // Phase 2: Start Onboarding Experience
    const onboardingEl = document.getElementById('onboarding-screen');
    if (onboardingEl) {
      onboardingEl.style.display = 'flex';
    }

    initOnboarding(() => {
      // Phase 3: Transition smoothly from Onboarding to Authentication (Login)
      const authEl = document.getElementById('auth-screen');
      if (authEl) {
        authEl.style.display = 'flex';
        authEl.classList.remove('auth-hidden');
      }

      initAuth((user, isNewSignup) => {
        // Phase 4: Authentication complete -> Transfer to Customer & Driver Onboarding Coordinator
        initOnboardingCoordinator(user, Boolean(isNewSignup));
      });
    });
  });
}


