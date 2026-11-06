/**
 * Intelligent Dynamic URL Router & Navigation System for FunzyTech
 * Semantic stage naming, deep linking, browser back/forward, page refresh, and GitHub Pages (/1-1/)
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
  stage?: string;
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
 * Converts current application UI state into its short, semantic canonical route URL
 */
export function getRouteForState(
  activeScreen: ScreenId | null,
  bookingStep: number = 1,
  hasBookingConfirmed: boolean = false,
  bookingSubStage?: string
): string {
  if (!activeScreen) return '/';

  switch (activeScreen) {
    case 'booking':
      if (hasBookingConfirmed) return '/book/confirmed';
      if (bookingSubStage === 'duration') return '/book/duration';
      if (bookingSubStage === 'details') return '/book/details';
      if (bookingSubStage === 'confirm') return '/book/confirm';
      if (bookingStep === 2) return '/book/schedule';
      return '/book/type';

    case 'my-bookings':
      return '/bookings';

    case 'otp':
      return '/bookings/verify';

    case 'track':
      return '/track';

    case 'about':
      return '/about';

    case 'contact':
      return '/contact';

    case 'donate':
      return '/pay';

    case 'donate-thanks':
      return '/pay/thanks';

    case 'qr':
      return '/referral/qr';

    case 'menu':
      return '/menu';

    case 'admin-password':
      return '/admin/login';

    case 'admin-dashboard':
      return '/admin/dashboard';

    case 'promo':
      return '/promo';

    case 'auth':
      return '/auth';

    case 'shortcuts':
      return '/shortcuts';

    case 'tech-store':
      return '/store';

    case 'my-apps':
      return '/apps';

    case 'my-links':
      return '/links';

    case 'ask-ai':
      return '/ai';

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

  // 1. Bookings (My Bookings)
  if (clean === '/bookings' || clean.startsWith('/bookings/') || clean.startsWith('/my-booking')) {
    if (clean.includes('verify') || clean.includes('otp') || clean.includes('popup-1')) {
      return { screen: 'otp' };
    }
    return { screen: 'my-bookings' };
  }

  // 2. Book a Call stages
  if (clean === '/book' || clean.startsWith('/book/') || clean === '/booking' || clean.startsWith('/booking/')) {
    if (clean.includes('confirmed') || clean.includes('success') || clean.includes('popup-4')) {
      return { screen: 'booking', bookingStep: 2, isConfirmed: true, stage: 'confirmed' };
    }
    if (clean.includes('confirm') || clean.includes('popup-3') || clean.includes('summary')) {
      return { screen: 'booking', bookingStep: 2, stage: 'confirm' };
    }
    if (clean.includes('details') || clean.includes('contact-info')) {
      return { screen: 'booking', bookingStep: 2, stage: 'details' };
    }
    if (clean.includes('duration')) {
      return { screen: 'booking', bookingStep: 2, stage: 'duration' };
    }
    if (clean.includes('schedule') || clean.includes('time') || clean.includes('date') || clean.includes('popup-2')) {
      return { screen: 'booking', bookingStep: 2, stage: 'schedule' };
    }
    if (clean.includes('type') || clean.includes('popup-1')) {
      return { screen: 'booking', bookingStep: 1, stage: 'type' };
    }
    return { screen: 'booking', bookingStep: 1, stage: 'type' };
  }

  // 3. Track Booking
  if (clean.startsWith('/track')) {
    return { screen: 'track' };
  }

  // 4. Help Center
  if (clean.startsWith('/help')) {
    return { screen: 'about' };
  }

  // 5. About Us
  if (clean.startsWith('/about')) {
    if (clean.includes('donate') || clean.includes('pay') || clean.includes('popup-1')) {
      return { screen: 'donate' };
    }
    return { screen: 'about' };
  }

  // 6. Contact Us
  if (clean.startsWith('/contact')) {
    return { screen: 'contact' };
  }

  // 7. Pay / Donate
  if (clean.startsWith('/pay') || clean.startsWith('/donate')) {
    if (clean.includes('thanks') || clean.includes('popup-1')) {
      return { screen: 'donate-thanks' };
    }
    return { screen: 'donate' };
  }

  // 8. Referral / Share QR
  if (clean.startsWith('/referral') || clean.startsWith('/share')) {
    if (clean.includes('qr') || clean.includes('card') || clean.includes('popup-1')) {
      return { screen: 'qr', stage: 'qr' };
    }
    return { screen: 'qr', stage: 'qr' };
  }

  // 9. Admin
  if (clean.startsWith('/admin')) {
    if (clean.includes('dashboard') || clean.includes('popup-2')) {
      return { screen: 'admin-dashboard' };
    }
    if (clean.includes('login') || clean.includes('popup-1')) {
      return { screen: 'admin-password' };
    }
    return { screen: 'admin-password' };
  }

  // 10. Secondary Sections
  if (clean.startsWith('/promo')) return { screen: 'promo' };
  if (clean.startsWith('/menu')) return { screen: 'menu' };
  if (clean.startsWith('/shortcuts')) return { screen: 'shortcuts' };
  if (clean.startsWith('/store') || clean.startsWith('/tech-store')) return { screen: 'tech-store' };
  if (clean.startsWith('/apps') || clean.startsWith('/my-apps')) return { screen: 'my-apps' };
  if (clean.startsWith('/links') || clean.startsWith('/my-links')) return { screen: 'my-links' };
  if (clean.startsWith('/ai') || clean.startsWith('/ask-ai')) return { screen: 'ask-ai' };
  if (clean.startsWith('/auth') || clean.startsWith('/login') || clean.startsWith('/sign-in')) return { screen: 'auth' };

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
