/**
 * Dynamic URL Router & Navigation System for Funzy Tech
 * Supports deep linking, browser back/forward, page refresh, and GitHub Pages (/1-1/)
 */

export type ScreenId =
  | 'menu'
  | 'about'
  | 'donate'
  | 'donate-thanks'
  | 'booking'
  | 'my-bookings'
  | 'track'
  | 'contact'
  | 'auth'
  | 'otp'
  | 'oauth'
  | 'avatar'
  | 'signout-confirm'
  | 'admin-password'
  | 'admin-dashboard'
  | 'promo'
  | 'qr'
  | 'shortcuts'
  | 'tech-store'
  | 'my-apps'
  | 'my-links'
  | 'ask-ai';

export interface ParsedRoute {
  screen: ScreenId | null;
  bookingStep?: number;
  subPopup?: string;
  isConfirmed?: boolean;
}

/**
 * Returns the repository base path if running under GitHub Pages (/1-1)
 */
export function getBasePath(): string {
  if (typeof window === 'undefined') return '';
  const pathname = window.location.pathname || '';
  if (pathname.indexOf('/1-1') === 0 || window.location.hostname.includes('github.io')) {
    return '/1-1';
  }
  return '';
}

/**
 * Extracts and cleans the current route path regardless of host or query format
 */
export function getCleanRoute(): string {
  if (typeof window === 'undefined') return '/';
  let path = (window.location.pathname || '/').toLowerCase();

  const basePath = getBasePath().toLowerCase();
  if (basePath && path.startsWith(basePath)) {
    path = path.slice(basePath.length);
  }

  // Check if router redirect or 404 handler forwarded path via query param (?route= or ?p=)
  const search = window.location.search;
  if (search) {
    try {
      const params = new URLSearchParams(search);
      const queryRoute = params.get('route') || params.get('p');
      if (queryRoute) {
        path = (queryRoute.startsWith('/') ? queryRoute : '/' + queryRoute).toLowerCase();
      }
    } catch {}
  }

  // Fallback: check hash if SPA hash routing was used
  if ((!path || path === '/') && window.location.hash) {
    const hash = window.location.hash.replace(/^#\/?/, '/').toLowerCase();
    if (hash && hash !== '/') {
      path = hash;
    }
  }

  // Remove trailing slashes (except root '/')
  if (path.length > 1 && path.endsWith('/')) {
    path = path.replace(/\/+$/, '');
  }

  return path || '/';
}

/**
 * Converts the current application UI state into its exact canonical route URL
 */
export function getRouteForState(
  activeScreen: ScreenId | null,
  bookingStep: number = 1,
  hasBookingConfirmed: boolean = false
): string {
  if (!activeScreen) return '/';

  switch (activeScreen) {
    case 'booking':
      if (hasBookingConfirmed) return '/book-a-call/popup-4';
      if (bookingStep === 1) return '/book-a-call/popup-1';
      if (bookingStep === 2) return '/book-a-call/popup-2';
      if (bookingStep === 3) return '/book-a-call/popup-3';
      return '/book-a-call';

    case 'my-bookings':
      return '/my-bookings';

    case 'otp':
      return '/my-bookings/popup-1';

    case 'track':
      return '/track-booking';

    case 'about':
      return '/about-us';

    case 'contact':
      return '/contact-us';

    case 'donate':
      return '/pay';

    case 'donate-thanks':
      return '/pay/popup-1';

    case 'qr':
      return '/referral/popup-1';

    case 'menu':
      return '/menu';

    case 'admin-password':
      return '/admin/popup-1';

    case 'admin-dashboard':
      return '/admin/popup-2';

    case 'promo':
      return '/promo';

    case 'auth':
      return '/auth';

    case 'shortcuts':
      return '/shortcuts';

    case 'tech-store':
      return '/tech-store';

    case 'my-apps':
      return '/my-apps';

    case 'my-links':
      return '/my-links';

    case 'ask-ai':
      return '/ask-ai';

    default:
      return '/';
  }
}

/**
 * Parses an incoming route string into target UI screen and step state
 */
export function parseRoute(rawRoute: string): ParsedRoute {
  const clean = (rawRoute || '/').toLowerCase().trim();

  // Root Homepage
  if (clean === '' || clean === '/' || clean === '/home') {
    return { screen: null };
  }

  // Book a Call & its distinct popups
  if (clean.includes('book-a-call') || clean.includes('booking')) {
    if (clean.includes('popup-4')) {
      return { screen: 'booking', bookingStep: 2, isConfirmed: true };
    }
    if (clean.includes('popup-3')) {
      return { screen: 'booking', bookingStep: 2, subPopup: 'popup-3' };
    }
    if (clean.includes('popup-2')) {
      return { screen: 'booking', bookingStep: 2 };
    }
    if (clean.includes('popup-1')) {
      return { screen: 'booking', bookingStep: 1 };
    }
    return { screen: 'booking', bookingStep: 1 };
  }

  // My Bookings
  if (clean.includes('my-bookings') || clean.includes('mybookings')) {
    if (clean.includes('popup-1') || clean.includes('otp')) {
      return { screen: 'otp' };
    }
    return { screen: 'my-bookings' };
  }

  // Track Booking
  if (clean.includes('track-booking') || clean.includes('track')) {
    return { screen: 'track' };
  }

  // Help Center / About Us
  if (clean.includes('help-center') || clean.includes('help')) {
    return { screen: 'about' };
  }

  if (clean.includes('about-us') || clean.includes('about')) {
    if (clean.includes('popup-1')) {
      return { screen: 'donate' };
    }
    return { screen: 'about' };
  }

  // Contact Us
  if (clean.includes('contact-us') || clean.includes('contact')) {
    return { screen: 'contact' };
  }

  // Pay / Donate
  if (clean.includes('pay') || clean.includes('donate')) {
    if (clean.includes('popup-1') || clean.includes('thanks')) {
      return { screen: 'donate-thanks' };
    }
    return { screen: 'donate' };
  }

  // Referral / Share QR
  if (clean.includes('referral') || clean.includes('share') || clean.includes('qr')) {
    return { screen: 'qr', subPopup: 'popup-1' };
  }

  // Menu
  if (clean.includes('menu')) {
    return { screen: 'menu' };
  }

  // Admin
  if (clean.includes('admin')) {
    if (clean.includes('popup-2') || clean.includes('dashboard')) {
      return { screen: 'admin-dashboard' };
    }
    return { screen: 'admin-password' };
  }

  // Secondary Features
  if (clean.includes('promo')) return { screen: 'promo' };
  if (clean.includes('shortcuts')) return { screen: 'shortcuts' };
  if (clean.includes('tech-store')) return { screen: 'tech-store' };
  if (clean.includes('my-apps')) return { screen: 'my-apps' };
  if (clean.includes('my-links')) return { screen: 'my-links' };
  if (clean.includes('ask-ai')) return { screen: 'ask-ai' };
  if (clean.includes('auth') || clean.includes('sign-in')) return { screen: 'auth' };

  return { screen: null };
}

/**
 * Synchronously updates browser address bar without full page reload.
 * Preserves search parameters (e.g. ?ref=FT-XXXXX) and hash.
 */
export function updateBrowserUrl(cleanRoute: string, replace: boolean = false): void {
  if (typeof window === 'undefined') return;

  const basePath = getBasePath();
  const normalizedRoute = cleanRoute.startsWith('/') ? cleanRoute : '/' + cleanRoute;
  const targetPath = (basePath + (normalizedRoute === '/' ? '/' : normalizedRoute)).replace(/\/+$/, '') || '/';

  // Compare against current pathname
  const currentPath = (window.location.pathname || '/').replace(/\/+$/, '') || '/';
  if (currentPath === targetPath) {
    return;
  }

  const fullUrl = targetPath + window.location.search + window.location.hash;

  try {
    if (replace) {
      window.history.replaceState({ route: cleanRoute }, '', fullUrl);
    } else {
      window.history.pushState({ route: cleanRoute }, '', fullUrl);
    }
  } catch (err) {
    console.warn('Could not update browser history state:', err);
  }
}
