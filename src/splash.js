/**
 * SafarGo - Splash Screen Controller
 *
 * Handles the splash video lifecycle:
 * - Autoplay with muted audio
 * - Fallback if video fails to load
 * - Smooth fade transition to the app screen
 * - Cleanup after splash completes
 */

const SPLASH_CONFIG = {
  /** Maximum time (ms) to wait for video to start playing before showing fallback */
  VIDEO_LOAD_TIMEOUT: 8000,
  /** Duration (ms) of the fallback display before transitioning */
  FALLBACK_DISPLAY_DURATION: 3000,
  /** Duration (ms) of the fade-out transition (must match CSS transition) */
  FADE_DURATION: 600,
};

/**
 * Initialize and manage the splash screen lifecycle.
 * Called once on application startup.
 */
export function initSplashScreen(onComplete) {
  const splashScreen = document.getElementById('splash-screen');
  const splashVideo = document.getElementById('splash-video');
  const splashFallback = document.getElementById('splash-fallback');
  const appScreen = document.getElementById('app-screen');

  if (!splashScreen) {
    console.warn('[SafarGo] Splash screen elements not found.');
    if (typeof onComplete === 'function') onComplete();
    return;
  }

  let hasTransitioned = false;
  let loadTimeoutId = null;

  /**
   * Transition from splash to app screen.
   * Ensures this only runs once.
   */
  function transitionToApp() {
    if (hasTransitioned) return;
    hasTransitioned = true;

    // Clear any pending timeout
    if (loadTimeoutId) {
      clearTimeout(loadTimeoutId);
      loadTimeoutId = null;
    }

    // Fade out splash
    splashScreen.classList.add('splash-hidden');

    // Notify caller or fallback to showing app screen directly
    if (typeof onComplete === 'function') {
      onComplete();
    } else if (appScreen) {
      appScreen.style.display = 'block';
    }

    // After fade completes, remove splash from DOM and clean up
    setTimeout(() => {
      // Pause and unload the video to free resources
      if (splashVideo) {
        splashVideo.pause();
        splashVideo.removeAttribute('src');
        splashVideo.load(); // Reset the video element
      }

      // Remove splash from DOM entirely
      splashScreen.remove();
    }, SPLASH_CONFIG.FADE_DURATION + 50);
  }

  /**
   * Show the fallback UI (logo + brand name) and schedule transition.
   */
  function showFallback() {
    if (hasTransitioned) return;

    // Hide the video container
    const videoContainer = splashScreen.querySelector('.splash-video-container');
    if (videoContainer) {
      videoContainer.style.display = 'none';
    }

    // Show fallback
    if (splashFallback) {
      splashFallback.style.display = 'flex';
    }

    // After fallback displays for a moment, transition to app
    setTimeout(transitionToApp, SPLASH_CONFIG.FALLBACK_DISPLAY_DURATION);
  }

  /**
   * Set up video event listeners and fallback timeout.
   */
  function setupVideo() {
    if (!splashVideo) {
      showFallback();
      return;
    }

    // Ensure video is muted (belt and suspenders)
    splashVideo.muted = true;
    splashVideo.volume = 0;

    // When video ends naturally, transition to app
    splashVideo.addEventListener('ended', () => {
      transitionToApp();
    }, { once: true });

    // Handle video load errors
    splashVideo.addEventListener('error', () => {
      showFallback();
    }, { once: true });

    // Also listen on the source element for errors
    const sourceEl = splashVideo.querySelector('source');
    if (sourceEl) {
      sourceEl.addEventListener('error', () => {
        showFallback();
      }, { once: true });
    }

    // Set a timeout: if video hasn't started playing within threshold, show fallback
    loadTimeoutId = setTimeout(() => {
      // Check if video is actually playing
      if (splashVideo.readyState < 3 || splashVideo.paused) {
        showFallback();
      }
    }, SPLASH_CONFIG.VIDEO_LOAD_TIMEOUT);

    // If the video can play, ensure it starts
    splashVideo.addEventListener('canplay', () => {
      // Ensure muted again when ready
      splashVideo.muted = true;
      splashVideo.volume = 0;

      // Try to play
      const playPromise = splashVideo.play();
      if (playPromise !== undefined) {
        playPromise.catch(() => {
          // Autoplay was blocked, show fallback
          showFallback();
        });
      }
    }, { once: true });

    // Handle the stalled event (network issues mid-load)
    splashVideo.addEventListener('stalled', () => {
      // Give it a couple more seconds, then fallback
      setTimeout(() => {
        if (!hasTransitioned && (splashVideo.paused || splashVideo.readyState < 3)) {
          showFallback();
        }
      }, 3000);
    }, { once: true });
  }

  // Start the splash flow
  setupVideo();
}
