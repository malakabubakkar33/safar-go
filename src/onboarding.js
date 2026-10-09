/**
 * SafarGo - Onboarding Controller
 *
 * Manages the 3-step onboarding flow:
 * 1. Your Ride, Your Way (Bike visual)
 * 2. Comfort at Your Door (Car visual)
 * 3. Track Every Journey (Location visual)
 *
 * Includes:
 * - Fluid horizontal carousel transitions
 * - Touch swipe & mouse drag gestures
 * - Smooth expanding pill pagination
 * - Keyboard navigation (Left/Right/Enter)
 * - Seamless handoff to app screen
 */

const ONBOARDING_DATA = [
  {
    image: '/images/onboarding_bike.jpg',
    alt: 'SafarGo Modern Bike',
    heading: 'Your Ride, Your Way',
    description: 'Choose a ride that fits your journey and travel with ease.',
    btnText: 'Continue',
  },
  {
    image: '/images/onboarding_car.jpg',
    alt: 'SafarGo Premium Car',
    heading: 'Comfort at Your Door',
    description: 'Find a comfortable ride from nearby service providers.',
    btnText: 'Continue',
  },
  {
    image: '/images/onboarding_location.jpg',
    alt: 'SafarGo Live Navigation',
    heading: 'Track Every Journey',
    description: 'See your ride and follow its journey in real time.',
    btnText: 'Get Started',
  },
];

export function initOnboarding(onComplete) {
  const onboardingScreen = document.getElementById('onboarding-screen');
  const track = document.getElementById('onboarding-track');
  const slides = document.querySelectorAll('.onboarding-slide');
  const dots = document.querySelectorAll('.onboarding-dot');
  const actionBtn = document.getElementById('onboarding-action-btn');
  const actionBtnText = document.getElementById('onboarding-btn-text');
  const skipBtn = document.getElementById('onboarding-skip-btn');
  const carousel = document.getElementById('onboarding-carousel');

  if (!onboardingScreen || !track || !actionBtn) {
    console.warn('[SafarGo] Onboarding elements missing.');
    if (typeof onComplete === 'function') onComplete();
    return;
  }

  // Preload images for instant rendering
  ONBOARDING_DATA.forEach(item => {
    const img = new Image();
    img.src = item.image;
  });

  let currentIndex = 0;
  let isTransitioning = false;
  let hasCompleted = false;

  // Touch / Drag gesture states
  let startX = 0;
  let currentX = 0;
  let isDragging = false;

  /**
   * Navigate to a specific slide
   */
  function goToSlide(index) {
    if (index < 0 || index >= ONBOARDING_DATA.length || isTransitioning) return;
    isTransitioning = true;
    currentIndex = index;

    // Slide track
    track.style.transform = `translateX(-${currentIndex * 100}%)`;

    // Update active class on slides for text & image animations
    slides.forEach((slide, i) => {
      if (i === currentIndex) {
        slide.classList.add('active');
      } else {
        slide.classList.remove('active');
      }
    });

    // Update pagination dots
    dots.forEach((dot, i) => {
      if (i === currentIndex) {
        dot.classList.add('active');
        dot.setAttribute('aria-selected', 'true');
      } else {
        dot.classList.remove('active');
        dot.setAttribute('aria-selected', 'false');
      }
    });

    // Update button text and skip visibility
    const currentItem = ONBOARDING_DATA[currentIndex];
    if (actionBtnText) {
      actionBtnText.textContent = currentItem.btnText;
    }

    if (skipBtn) {
      // Keep skip button visible or fade on the final screen
      if (currentIndex === ONBOARDING_DATA.length - 1) {
        skipBtn.style.opacity = '0';
        skipBtn.style.pointerEvents = 'none';
      } else {
        skipBtn.style.opacity = '1';
        skipBtn.style.pointerEvents = 'auto';
      }
    }

    setTimeout(() => {
      isTransitioning = false;
    }, 450);
  }

  /**
   * Complete the onboarding and transition to the next phase
   */
  function finishOnboarding() {
    if (hasCompleted) return;
    hasCompleted = true;

    // Fade out onboarding container
    onboardingScreen.classList.add('onboarding-hidden');

    setTimeout(() => {
      onboardingScreen.style.display = 'none';
      if (typeof onComplete === 'function') {
        onComplete();
      }
    }, 400);
  }

  /**
   * Action button handler
   */
  function handleNext() {
    if (currentIndex < ONBOARDING_DATA.length - 1) {
      goToSlide(currentIndex + 1);
    } else {
      finishOnboarding();
    }
  }

  actionBtn.addEventListener('click', handleNext);

  if (skipBtn) {
    skipBtn.addEventListener('click', finishOnboarding);
  }

  // Clickable pagination dots
  dots.forEach((dot, i) => {
    dot.addEventListener('click', () => {
      goToSlide(i);
    });
  });

  // Touch Swipe Handlers
  carousel.addEventListener('touchstart', (e) => {
    startX = e.touches[0].clientX;
    currentX = startX;
    isDragging = true;
  }, { passive: true });

  carousel.addEventListener('touchmove', (e) => {
    if (!isDragging) return;
    currentX = e.touches[0].clientX;
  }, { passive: true });

  carousel.addEventListener('touchend', () => {
    if (!isDragging) return;
    isDragging = false;
    const deltaX = currentX - startX;
    const threshold = 40;

    if (deltaX < -threshold) {
      // Swiped Left -> Next
      if (currentIndex < ONBOARDING_DATA.length - 1) {
        goToSlide(currentIndex + 1);
      }
    } else if (deltaX > threshold) {
      // Swiped Right -> Prev
      if (currentIndex > 0) {
        goToSlide(currentIndex - 1);
      }
    }
  });

  // Mouse Drag (for desktop testing convenience)
  carousel.addEventListener('mousedown', (e) => {
    startX = e.clientX;
    currentX = startX;
    isDragging = true;
  });

  window.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    currentX = e.clientX;
  });

  window.addEventListener('mouseup', () => {
    if (!isDragging) return;
    isDragging = false;
    const deltaX = currentX - startX;
    const threshold = 50;

    if (deltaX < -threshold && currentIndex < ONBOARDING_DATA.length - 1) {
      goToSlide(currentIndex + 1);
    } else if (deltaX > threshold && currentIndex > 0) {
      goToSlide(currentIndex - 1);
    }
  });

  // Keyboard navigation
  window.addEventListener('keydown', (e) => {
    if (onboardingScreen.classList.contains('onboarding-hidden') || onboardingScreen.style.display === 'none') {
      return;
    }

    if (e.key === 'ArrowRight') {
      if (currentIndex < ONBOARDING_DATA.length - 1) goToSlide(currentIndex + 1);
    } else if (e.key === 'ArrowLeft') {
      if (currentIndex > 0) goToSlide(currentIndex - 1);
    } else if (e.key === 'Enter') {
      handleNext();
    }
  });

  // Set initial state
  goToSlide(0);
}
