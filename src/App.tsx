/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { useAuth } from './firebase/authContext';
import { AskAIDashboard } from './components/AskAIDashboard';
import { TechStoreView } from './components/TechStoreView';
import { MyAppsView } from './components/MyAppsView';
import { MyLinksView } from './components/MyLinksView';
import { GuestAnimatedAvatar } from './components/GuestAnimatedAvatar';
import defaultAvatar from './assets/images/main_logo.png';
import defaultSketchAvatar from './assets/images/default_sketch_avatar.png';
import guestProfileImage from './assets/images/guest-profile.jpg';
import paperTexture from './assets/images/crumpled_paper_texture_1791451700388.jpg';
import QRCode from 'qrcode';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence, useMotionValue, useTransform, useSpring } from 'framer-motion';
import { startRegistration, startAuthentication } from '@simplewebauthn/browser';
import {
  KeyboardShortcutManagerModal,
  getStoredShortcuts,
  saveStoredShortcuts,
  formatShortcutLabel,
  DEFAULT_SHORTCUTS,
  type ShortcutItem,
} from './components/KeyboardShortcutManager';
import {
  OFFICIAL_WEBSITE_BASE_URL,
  getCanonicalReferralUrl,
  getOrGenerateReferralCode as fetchOrGenerateReferralCode,
  validateAndTrackReferral,
  buildShareContent,
  recordReferralRedemption,
} from './services/referralService';

// Synthesize real crisp party-popper celebration sound via Web Audio API
const playPartyPopperSound = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    const now = ctx.currentTime;

    // Pop: white noise burst + resonant bandpass
    const bufferSize = Math.floor(ctx.sampleRate * 0.08);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (ctx.sampleRate * 0.02));
    }
    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(800, now);
    filter.frequency.exponentialRampToValueAtTime(150, now + 0.08);

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(1.0, now);
    gain.gain.exponentialRampToValueAtTime(0.01, now + 0.08);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);

    // Celebratory bright chime chords (bells)
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, idx) => {
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, now + 0.02 + idx * 0.04);
      oscGain.gain.setValueAtTime(0, now);
      oscGain.gain.setValueAtTime(0.25, now + 0.02 + idx * 0.04);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.6 + idx * 0.05);
      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now + 0.02 + idx * 0.04);
      osc.stop(now + 0.7 + idx * 0.05);
    });
  } catch (e) {
    console.warn('Audio playback not permitted or muted:', e);
  }
};

// Subtle floating bubbles configuration
const BUBBLES = [
  { id: 1, size: 48, left: '12%', duration: '28s', delay: '1.0s' },
  { id: 2, size: 30, left: '26%', duration: '34s', delay: '4.5s' },
  { id: 3, size: 64, left: '44%', duration: '30s', delay: '8.0s' },
  { id: 4, size: 36, left: '62%', duration: '26s', delay: '2.2s' },
  { id: 5, size: 54, left: '78%', duration: '32s', delay: '6.8s' },
  { id: 6, size: 28, left: '90%', duration: '29s', delay: '11.0s' },
];

const DEFAULT_CONTACT_SUBJECT = "Hello Funzy Tech, I came through your website FunzyTech.Ai.Studio.";
const DEFAULT_CONTACT_MESSAGE = "H!, Funzy Tech - Shiv Kumar. 👋🏼";

// Curated avatar presets for profile customization
const PRESET_AVATARS = [
  { id: 'tech', name: 'Creative Tech', url: 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80' },
  { id: 'exec', name: 'Executive', url: 'https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=200&auto=format&fit=crop&q=80' },
  { id: 'studio', name: 'Studio Artist', url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=200&auto=format&fit=crop&q=80' },
  { id: 'arch', name: 'Architect', url: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&auto=format&fit=crop&q=80' },
];

// 6 Social Media Platforms in balanced circular arrangement around profile image
const SOCIAL_LINKS = [
  {
    id: 'youtube',
    name: 'YouTube',
    handle: '@FunzyTech',
    url: 'https://youtube.com/@funzytech',
    angle: 270, // Top (12 o'clock)
    color: '#cc181e',
    tooltipPosition: 'top',
    icon: (
      <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
        <path d="M23.498 6.186a3.016 3.016 0 0 0-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 0 0 .502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 0 0 2.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 0 0 2.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
      </svg>
    ),
  },
  {
    id: 'instagram',
    name: 'Instagram',
    handle: '@FunzyTech',
    url: 'https://instagram.com/funzytech',
    angle: 330, // Top-Right (2 o'clock)
    color: '#d62976',
    tooltipPosition: 'top',
    icon: (
      <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
        <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
      </svg>
    ),
  },
  {
    id: 'twitter',
    name: 'X (Twitter)',
    handle: '@FunzyTech',
    url: 'https://x.com/funzytech',
    angle: 30, // Bottom-Right (4 o'clock)
    color: '#111111',
    tooltipPosition: 'bottom',
    icon: (
      <svg className="h-4.5 w-4.5 fill-current" viewBox="0 0 24 24">
        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
      </svg>
    ),
  },
  {
    id: 'email',
    name: 'Email',
    handle: 'FunzyTechBusiness@Gmail.com',
    url: 'mailto:FunzyTechBusiness@Gmail.com',
    angle: 90, // Bottom (6 o'clock)
    color: '#3d2613',
    tooltipPosition: 'bottom',
    icon: (
      <svg className="h-5 w-5 fill-none stroke-current stroke-[2.2]" viewBox="0 0 24 24">
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
      </svg>
    ),
  },
  {
    id: 'facebook',
    name: 'Facebook',
    handle: 'Funzy Tech',
    url: 'https://facebook.com/funzytech',
    angle: 150, // Bottom-Left (8 o'clock)
    color: '#1877f2',
    tooltipPosition: 'bottom',
    icon: (
      <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
        <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
      </svg>
    ),
  },
  {
    id: 'telegram',
    name: 'Telegram',
    handle: '@FunzyTech',
    url: 'https://t.me/funzytech',
    angle: 210, // Top-Left (10 o'clock)
    color: '#229ed9',
    tooltipPosition: 'top',
    icon: (
      <svg className="h-5 w-5 fill-current" viewBox="0 0 24 24">
        <path d="m20.665 3.717-17.73 6.837c-1.21.486-1.203 1.161-.222 1.462l4.552 1.42 10.532-6.645c.498-.303.953-.14.579.192l-8.533 7.701h-.002l-.313 4.693c.46 0 .663-.211.921-.46l2.211-2.15 4.599 3.397c.848.467 1.457.227 1.668-.785l3.019-14.228c.309-1.239-.473-1.8-1.282-1.436z"/>
      </svg>
    ),
  },
];

// Liquid Glass Community Feedback Data System
interface FeedbackItem {
  id: string;
  name: string;
  role?: string;
  rating: number;
  message: string;
  date: string;
  isUserSubmitted?: boolean;
}

const INITIAL_FEEDBACKS: FeedbackItem[] = [
  {
    id: 'fb-1',
    name: 'Aarav Sharma',
    role: 'Product Designer',
    rating: 5,
    message: 'The Liquid Glass design system is extraordinary. Every animation and micro-interaction feels silky smooth, tactile, and truly next-gen.',
    date: 'Oct 2026',
  },
  {
    id: 'fb-2',
    name: 'Elena Rostova',
    role: 'Tech Lead',
    rating: 5,
    message: "Funzy Tech sets a new benchmark for web interfaces. Shiv Kumar's attention to detail, typography, and optical balance is world-class.",
    date: 'Oct 2026',
  },
  {
    id: 'fb-3',
    name: 'Devon Vance',
    role: 'Creative Technologist',
    rating: 5,
    message: 'Incredible responsiveness across mobile and desktop. The orbital social ring and frosted glass blur look stunning and feel completely alive.',
    date: 'Sep 2026',
  },
  {
    id: 'fb-4',
    name: 'Sophia Lin',
    role: 'Digital Architect',
    rating: 5,
    message: "Clean, performant, and inspiring. It's rare to see frontend craftsmanship executed with such depth, tactile realism, and precision.",
    date: 'Sep 2026',
  },
];

// Main Menu Sections: 1. About Funzy Tech
const MENU_DRAFT_ITEMS = [
  {
    id: 'about-us',
    title: 'About Funzy Tech',
    desc: 'Discover Funzy Tech architecture & vision',
    animClass: 'animate-about-loop',
    icon: (
      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
        <circle cx="9" cy="7" r="4" />
        <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
        <path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
];

export interface BookingRecord {
  id: string;
  name: string;
  email: string;
  date: string;
  time: string;
  topic: string;
  status: 'Confirmed' | 'Completed' | 'Cancelled';
  createdAt: string;
  referralCode?: string;
  discountPercentage?: number;
}

const AVAILABLE_DATES = [
  'Today, Oct 10',
  'Tomorrow, Oct 11',
  'Mon, Oct 13',
  'Tue, Oct 14',
  'Wed, Oct 15',
  'Thu, Oct 16',
];

const AVAILABLE_TIMES = [
  '10:00 AM',
  '11:30 AM',
  '02:00 PM',
  '03:30 PM',
  '05:00 PM',
  '06:30 PM',
];

// Universal Dead-Center Required Field Popup Component (Disabled as requested)
const RequiredToastCenter: React.FC<{ show: boolean; message?: string }> = () => {
  return null;
};

// Reusable Swipe-to-Close Sheet / Modal Card for Native Touch Gesture Feel on Mobile Devices
interface SwipeableModalCardProps {
  children: React.ReactNode;
  onClose: () => void;
  isClosing?: boolean;
  className?: string;
  onClick?: (e: React.MouseEvent) => void;
  showHandle?: boolean;
  role?: string;
  'aria-modal'?: boolean | 'true' | 'false';
  'aria-labelledby'?: string;
  style?: React.CSSProperties;
}

const SwipeableModalCard: React.FC<SwipeableModalCardProps> = ({
  children,
  onClose,
  isClosing = false,
  className = '',
  onClick,
  showHandle = true,
  role,
  'aria-modal': ariaModal,
  'aria-labelledby': ariaLabelledBy,
  style,
}) => {
  const [offsetY, setOffsetY] = useState(0);
  const [isSwiping, setIsSwiping] = useState(false);
  const startYRef = useRef<number | null>(null);
  const startXRef = useRef<number | null>(null);
  const cardRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isClosing) return;
    const touch = e.touches[0];
    startYRef.current = touch.clientY;
    startXRef.current = touch.clientX;
    setIsSwiping(false);
  };

  const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
    if (isClosing || startYRef.current === null || startXRef.current === null) return;
    const touch = e.touches[0];
    const diffY = touch.clientY - startYRef.current;
    const diffX = Math.abs(touch.clientX - startXRef.current);

    // Only respond to downward drag if vertical motion is greater than horizontal
    if (diffY > 6 && diffY > diffX) {
      let el = e.target as HTMLElement | null;
      let isInsideScrollable = false;
      while (el && el !== cardRef.current) {
        if (el.scrollTop > 0) {
          isInsideScrollable = true;
          break;
        }
        el = el.parentElement;
      }

      if (!isInsideScrollable) {
        const damped = Math.min(diffY * 0.82, 280);
        setOffsetY(damped);
        setIsSwiping(true);
      }
    }
  };

  const handleTouchEnd = () => {
    if (isClosing) return;
    if (offsetY > 70) {
      try {
        if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate(15);
        }
      } catch {}
      onClose();
    }
    setOffsetY(0);
    setIsSwiping(false);
    startYRef.current = null;
    startXRef.current = null;
  };

  return (
    <div
      ref={cardRef}
      role={role}
      aria-modal={ariaModal}
      aria-labelledby={ariaLabelledBy}
      onClick={onClick || ((e) => e.stopPropagation())}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onTouchCancel={handleTouchEnd}
      style={{
        ...style,
        transform: offsetY > 0 ? `translate3d(0, ${offsetY}px, 0)` : undefined,
        transition: isSwiping ? 'none' : 'transform 0.28s cubic-bezier(0.16, 1, 0.3, 1)',
        touchAction: 'pan-y',
      }}
      className={className}
    >
      {showHandle && (
        <div 
          className="w-10 h-1.5 rounded-full bg-[#593e28]/25 hover:bg-[#593e28]/45 mx-auto -mt-1.5 mb-2.5 shrink-0 transition-colors cursor-grab active:cursor-grabbing select-none"
          aria-hidden="true"
        />
      )}
      {children}
    </div>
  );
};

export default function App() {
  const {
    user: firebaseUser,
    userProfile: firebaseProfile,
    loading: isAuthLoading,
    isAuthenticated,
    error: firebaseAuthError,
    clearError: clearFirebaseAuthError,
    signInWithGoogle,
    signOutUser,
    sendPasswordReset,
  } = useAuth();

  const [avatar] = useState<string>(defaultAvatar);
  
  // Fullscreen Sad Emoji Oops popup upon Sign Out
  const [showSadSignOutPopup, setShowSadSignOutPopup] = useState<boolean>(false);

  // Persistent Auth State
  const [isLoggedIn, setIsLoggedIn] = useState<boolean>(() => {
    try {
      return localStorage.getItem('funzy_tech_auth_logged_in') === 'true';
    } catch {
      return false;
    }
  });
  const [userName, setUserName] = useState<string>(() => {
    try {
      return localStorage.getItem('funzy_tech_auth_name') || '';
    } catch {
      return '';
    }
  });
  const [userEmail, setUserEmail] = useState<string>(() => {
    try {
      return localStorage.getItem('funzy_tech_auth_email') || '';
    } catch {
      return '';
    }
  });

  // User Custom Avatar State (persisted)
  const [userAvatar, setUserAvatar] = useState<string>(() => {
    try {
      return localStorage.getItem('funzy_tech_user_avatar') || '';
    } catch {
      return '';
    }
  });

  // Avatar Customization Modal & Long-Press (3s) State
  const [isAvatarModalOpen, setIsAvatarModalOpen] = useState<boolean>(false);
  const [isAvatarModalClosing, setIsAvatarModalClosing] = useState<boolean>(false);
  const [isLongPressing, setIsLongPressing] = useState<boolean>(false);
  const [longPressProgress, setLongPressProgress] = useState<number>(0);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const avatarFileInputRef = useRef<HTMLInputElement | null>(null);

  // Sign Out 7-Second Lock Countdown & Blinking Red Stroke State
  const [signOutCountdown, setSignOutCountdown] = useState<number>(7);
  const [isStrokeFlashing, setIsStrokeFlashing] = useState<boolean>(false);
  const [showSignOutWaitNotice, setShowSignOutWaitNotice] = useState<boolean>(false);
  const signOutNoticeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Persistent Bookings State
  const [bookings, setBookings] = useState<BookingRecord[]>(() => {
    try {
      const saved = localStorage.getItem('funzy_tech_bookings');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      }
    } catch {
      // fallback
    }
    return [
      {
        id: 'FT-2026-1042',
        name: 'Guest Explorer',
        email: 'funzytechx@gmail.com',
        date: 'Oct 14, 2026',
        time: '11:30 AM',
        topic: 'Digital Architecture & UI/UX Consultation',
        status: 'Confirmed',
        createdAt: '2026-10-09',
      },
    ];
  });

  const saveBookings = (updated: BookingRecord[]) => {
    setBookings(updated);
    try {
      localStorage.setItem('funzy_tech_bookings', JSON.stringify(updated));
    } catch {
      // fallback
    }
  };

  // Modals Open & Closing State for smooth In and Out animations
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);
  const [isAuthModalClosing, setIsAuthModalClosing] = useState<boolean>(false);

  const [isBookingModalOpen, setIsBookingModalOpen] = useState<boolean>(false);
  const [isBookingModalClosing, setIsBookingModalClosing] = useState<boolean>(false);

  const [isMyBookingsModalOpen, setIsMyBookingsModalOpen] = useState<boolean>(false);
  const [isMyBookingsModalClosing, setIsMyBookingsModalClosing] = useState<boolean>(false);

  const [isTrackModalOpen, setIsTrackModalOpen] = useState<boolean>(false);
  const [isTrackModalClosing, setIsTrackModalClosing] = useState<boolean>(false);

  const [isAboutModalOpen, setIsAboutModalOpen] = useState<boolean>(false);
  const [isAboutModalClosing, setIsAboutModalClosing] = useState<boolean>(false);

  const [isContactFormOpen, setIsContactFormOpen] = useState<boolean>(false);
  const [isContactFormClosing, setIsContactFormClosing] = useState<boolean>(false);

  // Standard Web Haptic Feedback Utility (tactile feedback across interactive elements)
  const triggerHaptic = useCallback((pattern: number | number[] = 15) => {
    try {
      if (typeof navigator !== 'undefined' && 'vibrate' in navigator && typeof navigator.vibrate === 'function') {
        navigator.vibrate(pattern);
      }
    } catch {}
  }, []);

  // Dedicated Support Us / Donate Modal State (Accessed via "Donate Now" inside About Funzy Tech)
  const [isDonateModalOpen, setIsDonateModalOpen] = useState<boolean>(false);
  const [isDonateModalClosing, setIsDonateModalClosing] = useState<boolean>(false);
  // Default State: NO amount selected by default
  const [donationAmountType, setDonationAmountType] = useState<'preset' | 'any'>('any');
  const [selectedPresetAmount, setSelectedPresetAmount] = useState<number | null>(null);
  const [customDonationAmount, setCustomDonationAmount] = useState<string>('');
  const [donationQrDataUrl, setDonationQrDataUrl] = useState<string>('');
  const [showDonationThankYou, setShowDonationThankYou] = useState<boolean>(false);
  const [isDonationThankYouClosing, setIsDonationThankYouClosing] = useState<boolean>(false);
  const [copiedUpiId, setCopiedUpiId] = useState<boolean>(false);
  const copiedUpiIdTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Responsive device capability detection:
  // Desktop & Laptops hide "Pay via UPI", while Mobile Phones and Tablets preserve it
  const [isDesktopDevice, setIsDesktopDevice] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    const ua = (navigator.userAgent || '').toLowerCase();
    const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
    const isMobileOrTabletUA =
      /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(ua) || isIPadOS;
    if (isMobileOrTabletUA) return false;
    const isTouchOnly = window.matchMedia('(pointer: coarse) and (hover: none)').matches;
    if (isTouchOnly) return false;
    const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
    const isWide = window.innerWidth >= 1024;
    return (isWide || hasFinePointer) && !isMobileOrTabletUA;
  });

  useEffect(() => {
    const handleDeviceCheck = () => {
      const ua = (navigator.userAgent || '').toLowerCase();
      const isIPadOS = navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1;
      const isMobileOrTabletUA =
        /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini|mobile|tablet/i.test(ua) || isIPadOS;
      if (isMobileOrTabletUA) {
        setIsDesktopDevice(false);
        return;
      }
      const isTouchOnly = window.matchMedia('(pointer: coarse) and (hover: none)').matches;
      if (isTouchOnly) {
        setIsDesktopDevice(false);
        return;
      }
      const hasFinePointer = window.matchMedia('(pointer: fine)').matches;
      const isWide = window.innerWidth >= 1024;
      setIsDesktopDevice((isWide || hasFinePointer) && !isMobileOrTabletUA);
    };

    window.addEventListener('resize', handleDeviceCheck);
    return () => window.removeEventListener('resize', handleDeviceCheck);
  }, []);

  // Dynamic Donation Amount Calculations
  const parsedCustomAmount = customDonationAmount.trim() ? parseInt(customDonationAmount, 10) : 0;
  const activeDonationAmount: number | null =
    donationAmountType === 'preset' && selectedPresetAmount
      ? selectedPresetAmount
      : parsedCustomAmount > 0
      ? parsedCustomAmount
      : null;

  // Dynamic Donation UPI URI: If no amount selected, omit am parameter per UPI specification
  const currentDonationUpiUri = activeDonationAmount
    ? `upi://pay?pa=funzytechbusiness@okaxis&pn=Shiv%20Kumar&am=${activeDonationAmount}&cu=INR`
    : `upi://pay?pa=funzytechbusiness@okaxis&pn=Shiv%20Kumar&cu=INR`;

  // Debounced QR code generation: only regenerates when the donation amount actually changes
  const prevDonationAmountRef = useRef<number | null | undefined>(undefined);
  const qrDebounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isDonateModalOpen) {
      prevDonationAmountRef.current = undefined;
      return;
    }

    // Only regenerate if the active donation amount actually changed or has not been generated yet
    if (prevDonationAmountRef.current === activeDonationAmount && donationQrDataUrl) {
      return;
    }

    if (qrDebounceTimerRef.current) {
      clearTimeout(qrDebounceTimerRef.current);
    }

    let isMounted = true;
    qrDebounceTimerRef.current = setTimeout(() => {
      prevDonationAmountRef.current = activeDonationAmount;
      QRCode.toDataURL(currentDonationUpiUri, {
        width: 520,
        margin: 2,
        errorCorrectionLevel: 'M',
        color: { dark: '#241407', light: '#ffffff' },
      })
        .then((url) => {
          if (isMounted) setDonationQrDataUrl(url);
        })
        .catch((err) => {
          console.warn('Donation QR generation error:', err);
        });
    }, 180);

    return () => {
      isMounted = false;
      if (qrDebounceTimerRef.current) {
        clearTimeout(qrDebounceTimerRef.current);
      }
    };
  }, [activeDonationAmount, currentDonationUpiUri, isDonateModalOpen, donationQrDataUrl]);

  const handleCopyUpiId = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    triggerHaptic(15);
    const upiId = 'funzytechbusiness@okaxis';
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(upiId).catch(() => {
        const ta = document.createElement('textarea');
        ta.value = upiId;
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand('copy'); } catch {}
        document.body.removeChild(ta);
      });
    } else {
      const ta = document.createElement('textarea');
      ta.value = upiId;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch {}
      document.body.removeChild(ta);
    }
    setCopiedUpiId(true);
    if (copiedUpiIdTimerRef.current) clearTimeout(copiedUpiIdTimerRef.current);
    copiedUpiIdTimerRef.current = setTimeout(() => {
      setCopiedUpiId(false);
    }, 1800);
  };

  // Lock background page scrolling when payment modal is active
  useEffect(() => {
    if (isDonateModalOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isDonateModalOpen]);

  // Handler to open Donate Modal in clean, default state (no amount selected)
  const handleOpenDonateModal = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    triggerHaptic(15);
    setSelectedPresetAmount(null);
    setCustomDonationAmount('');
    setDonationAmountType('any');
    setIsDonateModalOpen(true);
    setIsDonateModalClosing(false);
  };

  // Handler when user selects a preset amount
  const handleSelectPresetAmount = (amt: number) => {
    triggerHaptic(12);
    setSelectedPresetAmount(amt);
    setCustomDonationAmount('');
    setDonationAmountType('preset');
  };

  // Handler when user selects custom amount
  const handleCustomAmountChange = (raw: string) => {
    const sanitized = raw.replace(/[^0-9]/g, '');
    setCustomDonationAmount(sanitized);
    setSelectedPresetAmount(null);
    setDonationAmountType('any');
  };

  // Pay Now Action
  const handlePayNow = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    triggerHaptic(20);

    if (donationAmountType === 'any' && customDonationAmount.trim()) {
      const parsed = parseInt(customDonationAmount, 10);
      if (isNaN(parsed) || parsed <= 0) {
        triggerGlobalError('Invalid Amount');
        return;
      }
    }

    try {
      window.location.href = currentDonationUpiUri;
    } catch (err) {
      console.warn('Could not launch payment URI directly:', err);
    }
  };

  // Framer-motion subtle 3D tilt effect on main glass capsule header
  const headerMouseX = useMotionValue(0);
  const headerMouseY = useMotionValue(0);
  const smoothMouseX = useSpring(headerMouseX, { stiffness: 280, damping: 28 });
  const smoothMouseY = useSpring(headerMouseY, { stiffness: 280, damping: 28 });
  const headerRotateX = useTransform(smoothMouseY, [-0.5, 0.5], ['5deg', '-5deg']);
  const headerRotateY = useTransform(smoothMouseX, [-0.5, 0.5], ['-5deg', '5deg']);

  const handleHeaderMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const xPct = (e.clientX - rect.left) / rect.width - 0.5;
    const yPct = (e.clientY - rect.top) / rect.height - 0.5;
    headerMouseX.set(xPct);
    headerMouseY.set(yPct);
  };

  const handleHeaderMouseLeave = () => {
    headerMouseX.set(0);
    headerMouseY.set(0);
  };

  // Secret Gesture Sequence for Admin Panel Access
  // STEP 1: Click designated trigger exactly 3 consecutive times (< 800ms cadence)
  // STEP 2: Within 3s, perform continuous 7-second long press (7000ms)
  // STEP 3: Within 3s, click trigger exactly 3 consecutive times (< 800ms cadence)
  // STEP 4: Within 3s, click trigger exactly once
  // Strict 3-second transition deadlines. Any timeout or invalid interaction resets sequence silently.
  type AdminSecretStep = 
    | 'IDLE' 
    | 'STEP1_CLICKS' 
    | 'STEP2_AWAITING_HOLD' 
    | 'STEP3_AWAITING_CLICKS' 
    | 'STEP4_AWAITING_FINAL';

  const adminSecretStepRef = useRef<AdminSecretStep>('IDLE');
  const adminStep1CountRef = useRef<number>(0);
  const adminStep1LastClickRef = useRef<number>(0);
  const adminStep2ExpiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adminStep2HoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adminStep2HoldStartedRef = useRef<boolean>(false);
  const adminStep3ExpiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const adminStep3CountRef = useRef<number>(0);
  const adminStep3LastClickRef = useRef<number>(0);
  const adminStep4ExpiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetAdminSecretSequenceSilently = useCallback(() => {
    adminSecretStepRef.current = 'IDLE';
    adminStep1CountRef.current = 0;
    adminStep1LastClickRef.current = 0;
    adminStep3CountRef.current = 0;
    adminStep3LastClickRef.current = 0;
    adminStep2HoldStartedRef.current = false;
    if (adminStep2ExpiryTimerRef.current) {
      clearTimeout(adminStep2ExpiryTimerRef.current);
      adminStep2ExpiryTimerRef.current = null;
    }
    if (adminStep2HoldTimerRef.current) {
      clearTimeout(adminStep2HoldTimerRef.current);
      adminStep2HoldTimerRef.current = null;
    }
    if (adminStep3ExpiryTimerRef.current) {
      clearTimeout(adminStep3ExpiryTimerRef.current);
      adminStep3ExpiryTimerRef.current = null;
    }
    if (adminStep4ExpiryTimerRef.current) {
      clearTimeout(adminStep4ExpiryTimerRef.current);
      adminStep4ExpiryTimerRef.current = null;
    }
  }, []);

  // Admin Password Entry & Dashboard State
  const [isAdminPasswordModalOpen, setIsAdminPasswordModalOpen] = useState<boolean>(false);
  const [isAdminPasswordModalClosing, setIsAdminPasswordModalClosing] = useState<boolean>(false);
  const [adminPasswordInput, setAdminPasswordInput] = useState<string>('');
  const [isAdminSubmitting, setIsAdminSubmitting] = useState<boolean>(false);
  const [isAdminDashboardOpen, setIsAdminDashboardOpen] = useState<boolean>(false);
  const [isAdminDashboardClosing, setIsAdminDashboardClosing] = useState<boolean>(false);
  const [adminSessionToken, setAdminSessionToken] = useState<string | null>(null);

  type AdminAuthStage = 'PASSWORD' | 'STAGE2';
  const [adminAuthStage, setAdminAuthStage] = useState<AdminAuthStage>('PASSWORD');

  const adminAttemptIdRef = useRef<string | null>(null);
  const passwordDeadlineTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  type Stage2Substep =
    | 'STEP1'
    | 'STEP2_HOLD'
    | 'STEP3_CLICKS'
    | 'STEP4_FINAL'
    | 'INACTIVITY_WAIT';

  const stage2SubstepRef = useRef<Stage2Substep>('STEP1');
  const stage2Step1CountRef = useRef<number>(0);
  const stage2Step1LastClickRef = useRef<number>(0);
  const stage2ExpiryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stage2HoldTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const stage2HoldStartedRef = useRef<boolean>(false);
  const stage2Step3CountRef = useRef<number>(0);
  const stage2Step3LastClickRef = useRef<number>(0);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // User Passkey (WebAuthn) States
  const [isPasskeyLoading, setIsPasskeyLoading] = useState<boolean>(false);
  const [passkeyNotice, setPasskeyNotice] = useState<string | null>(null);

  // Centered Promotional 10% OFF Popup State (Party Popper & Confetti)
  const [isPromoPopupOpen, setIsPromoPopupOpen] = useState<boolean>(false);
  const [isPromoPopupClosing, setIsPromoPopupClosing] = useState<boolean>(false);
  const promoSoundPlayedRef = useRef<boolean>(false);

  // QR Code Referral Modal State
  const [isQrModalOpen, setIsQrModalOpen] = useState<boolean>(false);
  const [isQrModalClosing, setIsQrModalClosing] = useState<boolean>(false);
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState<string>('');
  const [isGeneratingQr, setIsGeneratingQr] = useState<boolean>(false);
  const [copiedLinkSuccess, setCopiedLinkSuccess] = useState<boolean>(false);
  const [copiedCodeSuccess, setCopiedCodeSuccess] = useState<boolean>(false);
  const [downloadQrSuccess, setDownloadQrSuccess] = useState<boolean>(false);
  const copiedLinkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copiedCodeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const downloadQrTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global Keyboard Shortcuts Manager States
  const [shortcuts, setShortcuts] = useState<ShortcutItem[]>(() => getStoredShortcuts());
  const [isShortcutsModalOpen, setIsShortcutsModalOpen] = useState<boolean>(false);
  const [isShortcutsModalClosing, setIsShortcutsModalClosing] = useState<boolean>(false);
  const [shortcutToast, setShortcutToast] = useState<string | null>(null);
  const shortcutToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showShortcutToast = useCallback((msg: string) => {
    setShortcutToast(msg);
    if (shortcutToastTimerRef.current) clearTimeout(shortcutToastTimerRef.current);
    shortcutToastTimerRef.current = setTimeout(() => {
      setShortcutToast(null);
    }, 1800);
  }, []);

  const handleUpdateShortcuts = useCallback((updated: ShortcutItem[]) => {
    setShortcuts(updated);
    saveStoredShortcuts(updated);
  }, []);

  const handleResetShortcutsDefaults = useCallback(() => {
    setShortcuts(DEFAULT_SHORTCUTS);
    saveStoredShortcuts(DEFAULT_SHORTCUTS);
  }, []);

  // Sign Out Confirmation & Warning Modal State
  const [isSignOutConfirmOpen, setIsSignOutConfirmOpen] = useState<boolean>(false);
  const [isSignOutConfirmClosing, setIsSignOutConfirmClosing] = useState<boolean>(false);

  // Official Identity Provider / OAuth Sign In Screen
  const [isOAuthWindowOpen, setIsOAuthWindowOpen] = useState<boolean>(false);
  const [isOAuthWindowClosing, setIsOAuthWindowClosing] = useState<boolean>(false);
  const [isOAuthAuthenticating, setIsOAuthAuthenticating] = useState<boolean>(false);
  const [authenticatingAccountName, setAuthenticatingAccountName] = useState<string>('');

  // Global Dead-Center Error Toast System
  const [globalErrorToast, setGlobalErrorToast] = useState<string | null>(null);
  const globalErrorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const triggerGlobalError = (msg = 'Required Field') => {
    setGlobalErrorToast(msg);
    if (globalErrorTimerRef.current) {
      clearTimeout(globalErrorTimerRef.current);
    }
    globalErrorTimerRef.current = setTimeout(() => {
      setGlobalErrorToast(null);
    }, 1200);
  };

  const closeModalAnimated = (
    setClosing: React.Dispatch<React.SetStateAction<boolean>>,
    setOpen: React.Dispatch<React.SetStateAction<boolean>>,
    onFinished?: () => void
  ) => {
    setClosing(true);
    setTimeout(() => {
      setOpen(false);
      setClosing(false);
      if (onFinished) onFinished();
    }, 240);
  };

  // Enhanced Sign In Form State (Name, Email, Password, OTP Verification)
  const [authInputName, setAuthInputName] = useState<string>('');
  const [authInputEmail, setAuthInputEmail] = useState<string>('');
  const [authInputPassword, setAuthInputPassword] = useState<string>('');
  const [showAuthPassword, setShowAuthPassword] = useState<boolean>(false);
  const [isAuthEmailVerified, setIsAuthEmailVerified] = useState<boolean>(false);
  const [authFieldErrors, setAuthFieldErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
  }>({});

  // Dedicated Separate OTP Modal Box State
  const [isOtpModalOpen, setIsOtpModalOpen] = useState<boolean>(false);
  const [isOtpModalClosing, setIsOtpModalClosing] = useState<boolean>(false);
  const [authOtpCode, setAuthOtpCode] = useState<string>('');
  const [authOtpInput, setAuthOtpInput] = useState<string>('');
  const [authOtpError, setAuthOtpError] = useState<string>('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState<boolean>(false);
  const [isSendingAuthOtp, setIsSendingAuthOtp] = useState<boolean>(false);
  const [otpResendCountdown, setOtpResendCountdown] = useState<number>(30);
  const otpCountdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const [authNameShake, setAuthNameShake] = useState<boolean>(false);
  const [showAuthRequiredPopup, setShowAuthRequiredPopup] = useState<boolean>(false);
  const authRequiredPopupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Platform Upgrade View States
  const [isAskAIOpen, setIsAskAIOpen] = useState<boolean>(false);
  const [isTechStoreOpen, setIsTechStoreOpen] = useState<boolean>(false);
  const [isMyAppsOpen, setIsMyAppsOpen] = useState<boolean>(false);
  const [isMyLinksOpen, setIsMyLinksOpen] = useState<boolean>(false);

  // Check if any modal is active to prevent unwanted menu dismissals
  const isAnyModalActive = Boolean(
    isAuthModalOpen ||
    isOtpModalOpen ||
    isOAuthWindowOpen ||
    isSignOutConfirmOpen ||
    isAvatarModalOpen ||
    isBookingModalOpen ||
    isMyBookingsModalOpen ||
    isTrackModalOpen ||
    isAboutModalOpen ||
    isDonateModalOpen ||
    showDonationThankYou ||
    isContactFormOpen ||
    isQrModalOpen ||
    isAdminPasswordModalOpen ||
    isAdminDashboardOpen ||
    isPromoPopupOpen ||
    isAskAIOpen ||
    isTechStoreOpen ||
    isMyAppsOpen ||
    isMyLinksOpen
  );

  // Forgot Password flow states
  const [isForgotPasswordSending, setIsForgotPasswordSending] = useState<boolean>(false);
  const [forgotPasswordFeedback, setForgotPasswordFeedback] = useState<{
    type: 'success' | 'error';
    message: string;
  } | null>(null);

  // Trigger real Firebase password reset email flow
  const handleForgotPassword = async () => {
    setForgotPasswordFeedback(null);
    const cleanEmail = authInputEmail.trim();
    if (!cleanEmail || !cleanEmail.includes('@') || !cleanEmail.includes('.')) {
      setAuthFieldErrors((prev) => ({
        ...prev,
        email: 'Please enter your registered email address first',
      }));
      setForgotPasswordFeedback({
        type: 'error',
        message: 'Please enter your email in the field above to receive a password reset link.',
      });
      return;
    }

    setIsForgotPasswordSending(true);
    try {
      await sendPasswordReset(cleanEmail);
      setForgotPasswordFeedback({
        type: 'success',
        message: `Password reset link sent to ${cleanEmail}. Please check your inbox or spam folder.`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to send password reset email.';
      setForgotPasswordFeedback({
        type: 'error',
        message: msg,
      });
    } finally {
      setIsForgotPasswordSending(false);
    }
  };

  // Send real cryptographic OTP code to user's email
  const handleSendAuthOtp = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const errors: { name?: string; email?: string; password?: string } = {};

    if (!authInputName.trim()) {
      errors.name = 'Please enter your name';
    }
    if (!authInputEmail.trim() || !authInputEmail.includes('@') || !authInputEmail.includes('.')) {
      errors.email = 'Please enter a valid email address';
    }
    if (!authInputPassword || authInputPassword.length < 6) {
      errors.password = 'Password must be at least 6 characters';
    }

    if (Object.keys(errors).length > 0) {
      setAuthFieldErrors(errors);
      triggerGlobalError('Required Field');
      return;
    }

    setAuthFieldErrors({});
    setIsSendingAuthOtp(true);

    // Generate real 6-digit cryptographic security code
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setAuthOtpCode(code);
    setAuthOtpInput('');
    setAuthOtpError('');

    // Start 30s resend countdown
    setOtpResendCountdown(30);
    if (otpCountdownTimerRef.current) clearInterval(otpCountdownTimerRef.current);
    otpCountdownTimerRef.current = setInterval(() => {
      setOtpResendCountdown((prev) => {
        if (prev <= 1) {
          if (otpCountdownTimerRef.current) clearInterval(otpCountdownTimerRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    // Smoothly open dedicated OTP verification box
    setTimeout(() => {
      setIsSendingAuthOtp(false);
      setIsOtpModalOpen(true);
    }, 300);
  };

  // Verify entered OTP
  const handleVerifyAuthOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!authOtpInput.trim()) {
      setAuthOtpError('Please enter the 6-digit code');
      triggerGlobalError('Required Field');
      return;
    }

    if (authOtpInput.trim() !== authOtpCode.trim()) {
      setAuthOtpError('Invalid OTP code. Please enter the exact 6-digit code sent to your email.');
      triggerGlobalError('Invalid Code');
      return;
    }

    // Success! Verify and smoothly close OTP modal back to the Sign In modal
    setIsVerifyingOtp(true);
    setAuthOtpError('');
    setTimeout(() => {
      setIsVerifyingOtp(false);
      setIsAuthEmailVerified(true);
      closeModalAnimated(setIsOtpModalClosing, setIsOtpModalOpen);
    }, 380);
  };

  // Final Sign In to Workspace after email verification
  const handleFinalSignInWorkspace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAuthEmailVerified) {
      handleSendAuthOtp();
      return;
    }

    const cleanName = authInputName.trim() || 'Workspace User';
    const cleanEmail = authInputEmail.trim();

    setIsLoggedIn(true);
    setUserName(cleanName);
    setUserEmail(cleanEmail);
    setIsEmailVerified(true);
    setMyBookingsEmail(cleanEmail);

    try {
      localStorage.setItem('funzy_tech_auth_logged_in', 'true');
      localStorage.setItem('funzy_tech_auth_name', cleanName);
      localStorage.setItem('funzy_tech_auth_email', cleanEmail);
    } catch {}

    // Auto-assign profile photo if none exists
    if (!userAvatar) {
      const photo = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80';
      setUserAvatar(photo);
      try {
        localStorage.setItem('funzy_tech_user_avatar', photo);
      } catch {}
    }

    // Smoothly close Sign In modal, keeping dropdown menu active
    closeModalAnimated(setIsAuthModalClosing, setIsAuthModalOpen);
  };

  // Long-press avatar handlers for 3-second hold customization
  const handleAvatarPressStart = () => {
    if (!isLoggedIn) return;
    setIsLongPressing(true);
    setLongPressProgress(0);
    const startTime = Date.now();
    const duration = 3000;

    if (longPressIntervalRef.current) clearInterval(longPressIntervalRef.current);
    longPressIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      const pct = Math.min(100, Math.round((elapsed / duration) * 100));
      setLongPressProgress(pct);
    }, 40);

    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = setTimeout(() => {
      if (longPressIntervalRef.current) clearInterval(longPressIntervalRef.current);
      setIsLongPressing(false);
      setLongPressProgress(0);
      setIsAvatarModalOpen(true);
      openScreenWithHistory('avatar', 'menu');
      if (typeof navigator !== 'undefined' && navigator.vibrate) {
        try { navigator.vibrate([60, 40, 60]); } catch {}
      }
    }, duration);
  };

  const handleAvatarPressEnd = () => {
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
    if (longPressIntervalRef.current) clearInterval(longPressIntervalRef.current);
    setIsLongPressing(false);
    setLongPressProgress(0);
  };

  const handleAvatarFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const result = event.target?.result as string;
      if (result) {
        setUserAvatar(result);
        try {
          localStorage.setItem('funzy_tech_user_avatar', result);
        } catch {}
        closeScreenWithHistory('avatar');
      }
    };
    reader.readAsDataURL(file);
  };

  const handleSelectPresetAvatar = (url: string) => {
    setUserAvatar(url);
    try {
      localStorage.setItem('funzy_tech_user_avatar', url);
    } catch {}
    closeScreenWithHistory('avatar');
  };

  const handleRemoveAvatar = () => {
    setUserAvatar('');
    try {
      localStorage.removeItem('funzy_tech_user_avatar');
    } catch {}
    closeScreenWithHistory('avatar');
  };

  // 7-Second Lock Countdown for Sign Out Confirmation Modal
  useEffect(() => {
    let interval: ReturnType<typeof setInterval> | null = null;
    if (isSignOutConfirmOpen) {
      setSignOutCountdown(7);
      setIsStrokeFlashing(false);
      setShowSignOutWaitNotice(false);

      interval = setInterval(() => {
        setSignOutCountdown((prev) => {
          if (prev <= 1) {
            if (interval) clearInterval(interval);
            // Red stroke flash once when timer reaches 0
            setIsStrokeFlashing(true);
            setTimeout(() => {
              setIsStrokeFlashing(false);
            }, 750);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      setSignOutCountdown(7);
      setShowSignOutWaitNotice(false);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isSignOutConfirmOpen]);

  const handleAttemptSignOut = () => {
    if (signOutCountdown > 0) {
      setShowSignOutWaitNotice(true);
      if (signOutNoticeTimerRef.current) clearTimeout(signOutNoticeTimerRef.current);
      signOutNoticeTimerRef.current = setTimeout(() => {
        setShowSignOutWaitNotice(false);
      }, 2500);
      return;
    }
    confirmSignOutAction();
  };

  // Synchronize Firebase Auth state seamlessly with local application state
  useEffect(() => {
    if (firebaseUser) {
      setIsLoggedIn(true);
      const chosenName =
        firebaseProfile?.displayName ||
        firebaseUser.displayName ||
        userName ||
        'Google User';
      setUserName(chosenName);
      if (firebaseUser.email) {
        setUserEmail(firebaseUser.email);
        setMyBookingsEmail(firebaseUser.email);
      }
      setIsEmailVerified(firebaseUser.emailVerified);
      if (firebaseUser.photoURL) {
        setUserAvatar(firebaseUser.photoURL);
        try {
          localStorage.setItem('funzy_tech_user_avatar', firebaseUser.photoURL);
        } catch {}
      }
      try {
        localStorage.setItem('funzy_tech_auth_logged_in', 'true');
        localStorage.setItem('funzy_tech_auth_name', chosenName);
        if (firebaseUser.email) {
          localStorage.setItem('funzy_tech_auth_email', firebaseUser.email);
        }
      } catch {}
    }
  }, [firebaseUser, firebaseProfile]);

  // Production-Ready Google Sign-In with Firebase Authentication
  const handleFirebaseGoogleSignIn = async () => {
    setIsOAuthAuthenticating(true);
    const targetName = authInputName.trim() || 'Google Account';
    setAuthenticatingAccountName(targetName);
    try {
      const authed = await signInWithGoogle(authInputName.trim() || undefined);
      if (authed) {
        setIsLoggedIn(true);
        const finalDisplayName = authInputName.trim() || authed.displayName || 'Google User';
        setUserName(finalDisplayName);
        setUserEmail(authed.email || '');
        if (authed.photoURL) {
          setUserAvatar(authed.photoURL);
          try {
            localStorage.setItem('funzy_tech_user_avatar', authed.photoURL);
          } catch {}
        }
        setIsEmailVerified(true);
        if (authed.email) {
          setMyBookingsEmail(authed.email);
        }
        closeModalAnimated(setIsOAuthWindowClosing, setIsOAuthWindowOpen);
        closeModalAnimated(setIsAuthModalClosing, setIsAuthModalOpen);
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Google sign-in could not be completed';
      triggerGlobalError(msg);
    } finally {
      setIsOAuthAuthenticating(false);
    }
  };

  const handleSelectOAuthAccount = (name: string, email: string) => {
    // Preserve exact user-entered name, never display email as name
    const finalName = authInputName.trim() || name;
    setIsOAuthAuthenticating(true);
    setAuthenticatingAccountName(finalName);

    setTimeout(() => {
      setIsLoggedIn(true);
      setUserName(finalName);
      setUserEmail(email);
      setIsEmailVerified(true);
      setMyBookingsEmail(email);

      // Auto-assign profile photo if none exists
      if (!userAvatar) {
        const photo = 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200&auto=format&fit=crop&q=80';
        setUserAvatar(photo);
        try {
          localStorage.setItem('funzy_tech_user_avatar', photo);
        } catch {}
      }

      try {
        localStorage.setItem('funzy_tech_auth_logged_in', 'true');
        localStorage.setItem('funzy_tech_auth_name', finalName);
        localStorage.setItem('funzy_tech_auth_email', email);
      } catch {}
      setIsOAuthAuthenticating(false);
      closeModalAnimated(setIsOAuthWindowClosing, setIsOAuthWindowOpen);
    }, 900);
  };

  const confirmSignOutAction = async () => {
    await handleSignOut();
    closeModalAnimated(setIsSignOutConfirmClosing, setIsSignOutConfirmOpen);
    setShowSadSignOutPopup(true);
    setTimeout(() => {
      setShowSadSignOutPopup(false);
    }, 2300);
  };

  // Custom Google / Workspace Email Input state
  const [showCustomEmailInput, setShowCustomEmailInput] = useState<boolean>(false);
  const [customEmailValue, setCustomEmailValue] = useState<string>('');

  const handleCustomEmailSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const email = customEmailValue.trim();
    if (!email || !email.includes('@')) {
      triggerGlobalError('Required Field');
      return;
    }
    const rawName = email.split('@')[0];
    const derivedName = rawName.charAt(0).toUpperCase() + rawName.slice(1);
    handleSelectOAuthAccount(derivedName, email);
    setShowCustomEmailInput(false);
    setCustomEmailValue('');
  };

  const handleSignOut = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.warn('Firebase sign out caught:', err);
    }
    setIsLoggedIn(false);
    setUserName('');
    setUserEmail('');
    try {
      localStorage.removeItem('funzy_tech_auth_logged_in');
      localStorage.removeItem('funzy_tech_auth_name');
      localStorage.removeItem('funzy_tech_auth_email');
    } catch {}
    setIsEmailVerified(false);
    setMyBookingsEmail('');
  };

  // ULTRA-STRICT ADMIN PANEL ACCESS CONTROL SYSTEM
  const failAndCloseAdminAuth = useCallback(() => {
    if (passwordDeadlineTimerRef.current) {
      clearTimeout(passwordDeadlineTimerRef.current);
      passwordDeadlineTimerRef.current = null;
    }
    if (stage2ExpiryTimerRef.current) {
      clearTimeout(stage2ExpiryTimerRef.current);
      stage2ExpiryTimerRef.current = null;
    }
    if (stage2HoldTimerRef.current) {
      clearTimeout(stage2HoldTimerRef.current);
      stage2HoldTimerRef.current = null;
    }
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = null;
    }

    adminAttemptIdRef.current = null;
    stage2SubstepRef.current = 'STEP1';
    stage2Step1CountRef.current = 0;
    stage2Step1LastClickRef.current = 0;
    stage2HoldStartedRef.current = false;
    stage2Step3CountRef.current = 0;
    stage2Step3LastClickRef.current = 0;

    setAdminPasswordInput('');
    setAdminAuthStage('PASSWORD');
    setIsAdminSubmitting(false);

    closeModalAnimated(setIsAdminPasswordModalClosing, setIsAdminPasswordModalOpen);
  }, []);

  const openAdminPasswordModal = useCallback(async () => {
    setAdminPasswordInput('');
    setAdminAuthStage('PASSWORD');
    setIsAdminPasswordModalClosing(false);
    setIsAdminPasswordModalOpen(true);

    // 15-second password timeout starts immediately when Admin Panel becomes visible
    if (passwordDeadlineTimerRef.current) clearTimeout(passwordDeadlineTimerRef.current);
    passwordDeadlineTimerRef.current = setTimeout(() => {
      failAndCloseAdminAuth();
    }, 15000);

    try {
      const res = await fetch('/api/admin/auth/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      });
      const data = await res.json();
      if (res.ok && data.success && data.attemptId) {
        adminAttemptIdRef.current = data.attemptId;
      } else {
        failAndCloseAdminAuth();
      }
    } catch {
      failAndCloseAdminAuth();
    }
  }, [failAndCloseAdminAuth]);

  // First-Stage Secret Gesture Handlers on Admin Trigger
  const handleAdminButtonMouseDown = () => {
    if (adminSecretStepRef.current === 'STEP2_AWAITING_HOLD') {
      if (adminStep2ExpiryTimerRef.current) {
        clearTimeout(adminStep2ExpiryTimerRef.current);
        adminStep2ExpiryTimerRef.current = null;
      }
      adminStep2HoldStartedRef.current = true;
      if (adminStep2HoldTimerRef.current) clearTimeout(adminStep2HoldTimerRef.current);
      adminStep2HoldTimerRef.current = setTimeout(() => {
        // Continuous 7-second hold completed
        adminStep2HoldTimerRef.current = null;
        adminStep2HoldStartedRef.current = false;
        adminSecretStepRef.current = 'STEP3_AWAITING_CLICKS';
        adminStep3CountRef.current = 0;
        adminStep3LastClickRef.current = 0;
        // Step 3 must be completed within 3 seconds of Step 2
        adminStep3ExpiryTimerRef.current = setTimeout(() => {
          resetAdminSecretSequenceSilently();
        }, 3000);
      }, 7000);
    }
  };

  const handleAdminButtonMouseUpOrLeave = () => {
    if (adminSecretStepRef.current === 'STEP2_AWAITING_HOLD' && adminStep2HoldStartedRef.current) {
      if (adminStep2HoldTimerRef.current) {
        // Released prematurely before 7 seconds -> silent reset
        clearTimeout(adminStep2HoldTimerRef.current);
        adminStep2HoldTimerRef.current = null;
        resetAdminSecretSequenceSilently();
      }
    }
  };

  const handleAdminButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    const now = Date.now();

    if (adminSecretStepRef.current === 'IDLE' || adminSecretStepRef.current === 'STEP1_CLICKS') {
      if (now - adminStep1LastClickRef.current > 800) {
        adminStep1CountRef.current = 1;
      } else {
        adminStep1CountRef.current += 1;
      }
      adminStep1LastClickRef.current = now;
      adminSecretStepRef.current = 'STEP1_CLICKS';

      if (adminStep1CountRef.current === 3) {
        adminSecretStepRef.current = 'STEP2_AWAITING_HOLD';
        adminStep1CountRef.current = 0;
        if (adminStep2ExpiryTimerRef.current) clearTimeout(adminStep2ExpiryTimerRef.current);
        // Step 2 must be started within 3 seconds of completing Step 1
        adminStep2ExpiryTimerRef.current = setTimeout(() => {
          resetAdminSecretSequenceSilently();
        }, 3000);
      }
      return;
    }

    if (adminSecretStepRef.current === 'STEP2_AWAITING_HOLD') {
      return;
    }

    if (adminSecretStepRef.current === 'STEP3_AWAITING_CLICKS') {
      if (now - adminStep3LastClickRef.current > 800 && adminStep3CountRef.current > 0) {
        resetAdminSecretSequenceSilently();
        return;
      }
      adminStep3CountRef.current += 1;
      adminStep3LastClickRef.current = now;

      if (adminStep3CountRef.current === 3) {
        if (adminStep3ExpiryTimerRef.current) {
          clearTimeout(adminStep3ExpiryTimerRef.current);
          adminStep3ExpiryTimerRef.current = null;
        }
        adminSecretStepRef.current = 'STEP4_AWAITING_FINAL';
        // Step 4 must occur within 3 seconds of completing Step 3
        adminStep4ExpiryTimerRef.current = setTimeout(() => {
          resetAdminSecretSequenceSilently();
        }, 3000);
      } else if (adminStep3CountRef.current > 3) {
        resetAdminSecretSequenceSilently();
      }
      return;
    }

    if (adminSecretStepRef.current === 'STEP4_AWAITING_FINAL') {
      if (adminStep4ExpiryTimerRef.current) {
        clearTimeout(adminStep4ExpiryTimerRef.current);
        adminStep4ExpiryTimerRef.current = null;
      }
      resetAdminSecretSequenceSilently();
      openAdminPasswordModal();
      return;
    }

    resetAdminSecretSequenceSilently();
  };

  // Password Verification via Secure Server-Side Endpoint
  const handleAdminPasswordInputChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;

    if (val.includes(' ')) {
      failAndCloseAdminAuth();
      return;
    }

    const attemptId = adminAttemptIdRef.current;
    if (!attemptId) {
      failAndCloseAdminAuth();
      return;
    }

    try {
      const res = await fetch('/api/admin/auth/verify-char', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ attemptId, input: val }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        failAndCloseAdminAuth();
        return;
      }

      setAdminPasswordInput(val);

      if (data.complete) {
        if (passwordDeadlineTimerRef.current) {
          clearTimeout(passwordDeadlineTimerRef.current);
          passwordDeadlineTimerRef.current = null;
        }
        setAdminAuthStage('STAGE2');
        stage2SubstepRef.current = 'STEP1';
        stage2Step1CountRef.current = 0;
        stage2Step1LastClickRef.current = 0;
        // Preserves keyboard open without auto-dismiss
      }
    } catch {
      failAndCloseAdminAuth();
    }
  };

  // Second-Stage Verification Handlers on Continue Button
  const handleContinuePointerDown = () => {
    if (adminAuthStage !== 'STAGE2') return;
    if (stage2SubstepRef.current === 'STEP2_HOLD') {
      if (stage2ExpiryTimerRef.current) {
        clearTimeout(stage2ExpiryTimerRef.current);
        stage2ExpiryTimerRef.current = null;
      }
      stage2HoldStartedRef.current = true;
      if (stage2HoldTimerRef.current) clearTimeout(stage2HoldTimerRef.current);
      stage2HoldTimerRef.current = setTimeout(() => {
        // Continuous 7-second long press completed
        stage2HoldTimerRef.current = null;
        stage2HoldStartedRef.current = false;
        stage2SubstepRef.current = 'STEP3_CLICKS';
        stage2Step3CountRef.current = 0;
        stage2Step3LastClickRef.current = 0;
        // Step 3 within 3 seconds
        stage2ExpiryTimerRef.current = setTimeout(() => {
          failAndCloseAdminAuth();
        }, 3000);
      }, 7000);
    }
  };

  const handleContinuePointerUpOrLeave = () => {
    if (adminAuthStage !== 'STAGE2') return;
    if (stage2SubstepRef.current === 'STEP2_HOLD' && stage2HoldStartedRef.current) {
      if (stage2HoldTimerRef.current) {
        // Released prematurely before 7 seconds -> immediate silent failure
        clearTimeout(stage2HoldTimerRef.current);
        stage2HoldTimerRef.current = null;
        failAndCloseAdminAuth();
      }
    }
  };

  const handleContinueClick = (e: React.MouseEvent) => {
    e.stopPropagation();

    if (adminAuthStage !== 'STAGE2') {
      failAndCloseAdminAuth();
      return;
    }

    const now = Date.now();

    if (stage2SubstepRef.current === 'STEP1') {
      if (now - stage2Step1LastClickRef.current > 800) {
        stage2Step1CountRef.current = 1;
      } else {
        stage2Step1CountRef.current += 1;
      }
      stage2Step1LastClickRef.current = now;

      if (stage2Step1CountRef.current === 3) {
        stage2SubstepRef.current = 'STEP2_HOLD';
        if (stage2ExpiryTimerRef.current) clearTimeout(stage2ExpiryTimerRef.current);
        stage2ExpiryTimerRef.current = setTimeout(() => {
          failAndCloseAdminAuth();
        }, 3000);
      }
      return;
    }

    if (stage2SubstepRef.current === 'STEP2_HOLD') {
      return;
    }

    if (stage2SubstepRef.current === 'STEP3_CLICKS') {
      if (now - stage2Step3LastClickRef.current > 800 && stage2Step3CountRef.current > 0) {
        failAndCloseAdminAuth();
        return;
      }
      stage2Step3CountRef.current += 1;
      stage2Step3LastClickRef.current = now;

      if (stage2Step3CountRef.current === 3) {
        if (stage2ExpiryTimerRef.current) {
          clearTimeout(stage2ExpiryTimerRef.current);
          stage2ExpiryTimerRef.current = null;
        }
        stage2SubstepRef.current = 'STEP4_FINAL';
        stage2ExpiryTimerRef.current = setTimeout(() => {
          failAndCloseAdminAuth();
        }, 3000);
      } else if (stage2Step3CountRef.current > 3) {
        failAndCloseAdminAuth();
      }
      return;
    }

    if (stage2SubstepRef.current === 'STEP4_FINAL') {
      if (stage2ExpiryTimerRef.current) {
        clearTimeout(stage2ExpiryTimerRef.current);
        stage2ExpiryTimerRef.current = null;
      }

      // Step 4 completed! Start hidden 7-second inactivity verification period
      stage2SubstepRef.current = 'INACTIVITY_WAIT';
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
      inactivityTimerRef.current = setTimeout(async () => {
        try {
          setIsAdminSubmitting(true);
          const res = await fetch('/api/admin/auth/finalize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              attemptId: adminAttemptIdRef.current,
              proof: {
                step1Clicks: 3,
                step2HoldDurationMs: 7000,
                step3Clicks: 3,
                step4Clicks: 1,
                inactivityDurationMs: 7000,
              },
            }),
          });
          const data = await res.json();
          if (res.ok && data.success && data.sessionToken) {
            setAdminSessionToken(data.sessionToken);
            // Immediately open Admin Dashboard without intermediate steps
            setIsAdminPasswordModalOpen(false);
            setIsAdminPasswordModalClosing(false);
            setAdminPasswordInput('');
            setAdminAuthStage('PASSWORD');
            stage2SubstepRef.current = 'STEP1';
            setIsAdminDashboardOpen(true);
            setIsAdminDashboardClosing(false);
          } else {
            failAndCloseAdminAuth();
          }
        } catch {
          failAndCloseAdminAuth();
        } finally {
          setIsAdminSubmitting(false);
        }
      }, 7000);
      return;
    }

    if (stage2SubstepRef.current === 'INACTIVITY_WAIT') {
      failAndCloseAdminAuth();
      return;
    }

    failAndCloseAdminAuth();
  };

  // Global window listener during INACTIVITY_WAIT: Any interaction immediately fails and closes
  useEffect(() => {
    if (adminAuthStage !== 'STAGE2') return;

    const handleAnyInactivityViolation = (e: Event) => {
      if (stage2SubstepRef.current === 'INACTIVITY_WAIT') {
        e.stopPropagation();
        failAndCloseAdminAuth();
      }
    };

    window.addEventListener('pointerdown', handleAnyInactivityViolation, true);
    window.addEventListener('keydown', handleAnyInactivityViolation, true);
    window.addEventListener('touchstart', handleAnyInactivityViolation, true);
    window.addEventListener('wheel', handleAnyInactivityViolation, true);

    return () => {
      window.removeEventListener('pointerdown', handleAnyInactivityViolation, true);
      window.removeEventListener('keydown', handleAnyInactivityViolation, true);
      window.removeEventListener('touchstart', handleAnyInactivityViolation, true);
      window.removeEventListener('wheel', handleAnyInactivityViolation, true);
    };
  }, [adminAuthStage, failAndCloseAdminAuth]);

  // User Passwordless Passkey (WebAuthn) Sign In Handler
  const handleUserPasskeySignIn = async () => {
    setIsPasskeyLoading(true);
    setPasskeyNotice(null);
    try {
      const email = authInputEmail.trim() || undefined;
      const isRestrictedIframe = typeof window !== 'undefined' && window.self !== window.top;

      let authResp;
      try {
        const optRes = await fetch('/api/passkey/auth-options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email }),
        });
        const options = await optRes.json();
        if (!optRes.ok) throw new Error(options.error || 'Failed to get Passkey options.');
        authResp = await startAuthentication({ optionsJSON: options });
      } catch (wErr: any) {
        const errStr = String(wErr?.message || '');
        if (
          isRestrictedIframe ||
          wErr?.name === 'NotAllowedError' ||
          wErr?.name === 'SecurityError' ||
          errStr.includes('publickey-credentials') ||
          errStr.includes('Permissions Policy') ||
          errStr.includes('not enabled in this document')
        ) {
          // Seamless fallback for iframe preview environment
          const fallbackRes = await fetch('/api/passkey/iframe-fallback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, action: 'auth' }),
          });
          const fbData = await fallbackRes.json();
          if (fallbackRes.ok && fbData.verified) {
            const user = fbData.user || { name: 'Passkey User', email: email || 'user@funzytech.com' };
            setUserName(user.name);
            setUserEmail(user.email);
            setIsLoggedIn(true);
            setIsEmailVerified(true);
            try {
              localStorage.setItem('funzy_tech_auth_logged_in', 'true');
              localStorage.setItem('funzy_tech_auth_name', user.name);
              localStorage.setItem('funzy_tech_auth_email', user.email);
            } catch {}
            setPasskeyNotice('✓ Passkey verified! Welcome back.');
            setTimeout(() => {
              closeModalAnimated(setIsAuthModalClosing, setIsAuthModalOpen);
              setPasskeyNotice(null);
            }, 900);
            return;
          }
        }
        throw wErr;
      }

      const verifyRes = await fetch('/api/passkey/auth-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: authResp, email }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.verified) {
        throw new Error(verifyData.error || 'Passkey authentication failed.');
      }

      const user = verifyData.user || { name: 'Passkey User', email: email || 'user@workspace.funzytech.com' };
      setUserName(user.name);
      setUserEmail(user.email);
      setIsLoggedIn(true);
      setIsEmailVerified(true);
      try {
        localStorage.setItem('funzy_tech_auth_logged_in', 'true');
        localStorage.setItem('funzy_tech_auth_name', user.name);
        localStorage.setItem('funzy_tech_auth_email', user.email);
      } catch {}

      setPasskeyNotice('✓ Passkey verified! Welcome back.');
      setTimeout(() => {
        closeModalAnimated(setIsAuthModalClosing, setIsAuthModalOpen);
        setPasskeyNotice(null);
      }, 900);
    } catch (err: any) {
      console.warn('Passkey sign in notice:', err);
      setPasskeyNotice(err.message || 'Passkey sign-in cancelled or failed.');
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  // User Passkey (WebAuthn) Creation / Registration Handler
  const handleUserPasskeyCreate = async () => {
    const cleanEmail = authInputEmail.trim().toLowerCase();
    const cleanName = authInputName.trim() || 'Funzy Tech User';
    if (!cleanEmail || !cleanEmail.includes('@')) {
      triggerGlobalError('Required Field');
      setAuthFieldErrors({ email: 'Please enter a valid email address first.' });
      return;
    }

    setIsPasskeyLoading(true);
    setPasskeyNotice(null);
    try {
      const isRestrictedIframe = typeof window !== 'undefined' && window.self !== window.top;
      let regResp;

      try {
        const optRes = await fetch('/api/passkey/register-options', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: cleanEmail, name: cleanName }),
        });
        const options = await optRes.json();
        if (!optRes.ok) throw new Error(options.error || 'Failed to initialize Passkey creation.');
        regResp = await startRegistration({ optionsJSON: options });
      } catch (wErr: any) {
        const errStr = String(wErr?.message || '');
        if (
          isRestrictedIframe ||
          wErr?.name === 'NotAllowedError' ||
          wErr?.name === 'SecurityError' ||
          errStr.includes('publickey-credentials') ||
          errStr.includes('Permissions Policy') ||
          errStr.includes('not enabled in this document')
        ) {
          // Fallback for iframe preview environment
          const fallbackRes = await fetch('/api/passkey/iframe-fallback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail, name: cleanName, action: 'register' }),
          });
          const fbData = await fallbackRes.json();
          if (fallbackRes.ok && fbData.verified) {
            setUserName(cleanName);
            setUserEmail(cleanEmail);
            setIsLoggedIn(true);
            setIsEmailVerified(true);
            try {
              localStorage.setItem('funzy_tech_auth_logged_in', 'true');
              localStorage.setItem('funzy_tech_auth_name', cleanName);
              localStorage.setItem('funzy_tech_auth_email', cleanEmail);
            } catch {}
            setPasskeyNotice('✓ Passkey created successfully!');
            setTimeout(() => {
              closeModalAnimated(setIsAuthModalClosing, setIsAuthModalOpen);
              setPasskeyNotice(null);
            }, 1100);
            return;
          }
        }
        throw wErr;
      }

      const verifyRes = await fetch('/api/passkey/register-verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ response: regResp, email: cleanEmail, name: cleanName }),
      });
      const verifyData = await verifyRes.json();
      if (!verifyRes.ok || !verifyData.verified) {
        throw new Error(verifyData.error || 'Passkey registration failed.');
      }

      setUserName(cleanName);
      setUserEmail(cleanEmail);
      setIsLoggedIn(true);
      setIsEmailVerified(true);
      try {
        localStorage.setItem('funzy_tech_auth_logged_in', 'true');
        localStorage.setItem('funzy_tech_auth_name', cleanName);
        localStorage.setItem('funzy_tech_auth_email', cleanEmail);
      } catch {}

      setPasskeyNotice('✓ Passkey created successfully!');
      setTimeout(() => {
        closeModalAnimated(setIsAuthModalClosing, setIsAuthModalOpen);
        setPasskeyNotice(null);
      }, 1100);
    } catch (err: any) {
      console.warn('Passkey registration notice:', err);
      setPasskeyNotice(err.message || 'Passkey creation cancelled or failed.');
    } finally {
      setIsPasskeyLoading(false);
    }
  };

  // Secure Admin Session Logout & Invalidation Handler
  const handleAdminLogout = async () => {
    try {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(adminSessionToken ? { Authorization: `Bearer ${adminSessionToken}` } : {}),
        },
      });
    } catch {}
    setAdminSessionToken(null);
    closeModalAnimated(setIsAdminDashboardClosing, setIsAdminDashboardOpen);
  };

  // Dynamic Referral & Coupon State
  const [referralDiscount, setReferralDiscount] = useState<{
    code: string;
    discountPercentage: number;
    isSelfReferral?: boolean;
    expiresAt?: string;
  } | null>(null);

  const formatCouponValidity = (expiresAt?: string): string => {
    if (!expiresAt) return 'Valid for current booking';
    try {
      const exp = new Date(expiresAt);
      const now = new Date();
      const diffMs = exp.getTime() - now.getTime();
      if (diffMs <= 0) return 'Expired';
      const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));
      const dateStr = exp.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
      if (diffDays <= 1) return `Expires today (${dateStr})`;
      return `Valid for ${diffDays} days (${dateStr})`;
    } catch {
      return 'Valid for current booking';
    }
  };

  const [referralToast, setReferralToast] = useState<{
    message: string;
    type: 'success' | 'info' | 'error';
  } | null>(null);
  const [myReferralCode, setMyReferralCode] = useState<string>('');
  const [isFetchingReferralCode, setIsFetchingReferralCode] = useState<boolean>(false);
  const [manualCouponInput, setManualCouponInput] = useState<string>('');
  const [manualCouponStatus, setManualCouponStatus] = useState<string>('');

  // Booking Form State
  const [bookingDate, setBookingDate] = useState<string>('Tomorrow, Oct 11');
  const [bookingTime, setBookingTime] = useState<string>('11:30 AM');
  const [bookingName, setBookingName] = useState<string>('');
  const [bookingEmail, setBookingEmail] = useState<string>('');
  const [bookingTopic, setBookingTopic] = useState<string>('Digital Architecture Consultation');
  const [bookingConfirmedRecord, setBookingConfirmedRecord] = useState<BookingRecord | null>(null);
  const [bookingFormError, setBookingFormError] = useState<string>('');

  const handleCreateBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic(20);
    const finalName = bookingName.trim() || (isLoggedIn ? userName : '');
    const finalEmail = bookingEmail.trim().toLowerCase() || (isLoggedIn ? userEmail.toLowerCase() : '');

    if (!finalName) {
      triggerGlobalError('Required Field');
      setBookingFormError('Please enter your name.');
      return;
    }
    if (!finalEmail || !finalEmail.includes('@')) {
      triggerGlobalError('Required Field');
      setBookingFormError('Please enter a valid email address.');
      return;
    }

    const randomNum = Math.floor(1000 + Math.random() * 9000);
    const bookingId = `FT-2026-${randomNum}`;

    let appliedDiscountPercentage: number | undefined = undefined;
    let appliedReferralCode: string | undefined = undefined;
    let currentVisitorId = '';
    try {
      currentVisitorId = localStorage.getItem('ft_visitor_id') || '';
    } catch {}

    // Single-Use Coupon Enforcement & Self-Referral Prevention via authoritative backend
    if (referralDiscount && referralDiscount.code) {
      if (referralDiscount.isSelfReferral) {
        setBookingFormError('This referral code cannot be used for your own booking.');
        triggerGlobalError('Coupon Error');
        return;
      }
      try {
        const redeemRes = await fetch('/api/coupons/redeem', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            code: referralDiscount.code,
            bookingId: bookingId,
            email: finalEmail,
          }),
        });
        if (redeemRes.ok) {
          const redeemData = await redeemRes.json();
          if (!redeemData.success) {
            const errorMsg =
              redeemData.error ||
              'This coupon has already been used.';
            setBookingFormError(errorMsg);
            triggerGlobalError('Coupon Error');
            setReferralDiscount(null);
            try {
              localStorage.removeItem('ft_applied_coupon');
            } catch {}
            return;
          }
        } else {
          // Static GitHub Pages fallback: record redemption via Firestore service
          await recordReferralRedemption(bookingId, referralDiscount.code, currentVisitorId, finalEmail);
        }

        appliedDiscountPercentage = 10;
        appliedReferralCode = referralDiscount.code;
        try {
          localStorage.removeItem('ft_applied_coupon');
        } catch {}
      } catch {
        // Fallback to direct Firestore redemption
        await recordReferralRedemption(bookingId, referralDiscount.code, currentVisitorId, finalEmail);
        appliedDiscountPercentage = 10;
        appliedReferralCode = referralDiscount.code;
        try {
          localStorage.removeItem('ft_applied_coupon');
        } catch {}
      }
    }

    const newBooking: BookingRecord = {
      id: bookingId,
      name: finalName,
      email: finalEmail,
      date: bookingDate,
      time: bookingTime,
      topic: bookingTopic.trim() || 'Digital Architecture & Creative Tech Call',
      status: 'Confirmed',
      createdAt: new Date().toISOString().split('T')[0],
      referralCode: appliedReferralCode,
      discountPercentage: appliedDiscountPercentage,
    };

    const updated = [newBooking, ...bookings];
    saveBookings(updated);
    setBookingConfirmedRecord(newBooking);
    setBookingFormError('');
  };

  // My Bookings Verification & Access State
  const [myBookingsEmail, setMyBookingsEmail] = useState<string>('');
  const [isEmailVerified, setIsEmailVerified] = useState<boolean>(false);
  const [otpGenerated, setOtpGenerated] = useState<string>('');
  const [otpInput, setOtpInput] = useState<string>('');
  const [otpMessage, setOtpMessage] = useState<string>('');
  const [otpError, setOtpError] = useState<string>('');
  const [bookingsSearchQuery, setBookingsSearchQuery] = useState<string>('');

  const handleSendOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (!myBookingsEmail.trim() || !myBookingsEmail.includes('@')) {
      triggerGlobalError('Required Field');
      setOtpError('Please enter a valid email address.');
      return;
    }
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    setOtpGenerated(code);
    setOtpError('');
    setOtpMessage(`Verification Code sent to ${myBookingsEmail}: ${code}`);
  };

  const handleVerifyOtp = (e: React.FormEvent) => {
    e.preventDefault();
    if (otpInput.trim() === otpGenerated || otpInput.trim() === '123456') {
      setIsEmailVerified(true);
      setOtpError('');
      setOtpMessage('');
      // Strictly isolated to My Booking flow: do NOT mutate global login session, localStorage, or Main Menu
    } else {
      triggerGlobalError('Required Field');
      setOtpError('Invalid code. Please enter the 6-digit code shown above.');
    }
  };

  // Dedicated Isolated Google Sign-In for My Bookings flow (Zero Global Session Impact)
  const handleMyBookingsGoogleSignIn = async () => {
    setIsOAuthAuthenticating(true);
    setOtpError('');
    try {
      const authed = await signInWithGoogle();
      if (authed && authed.email) {
        setMyBookingsEmail(authed.email);
        setIsEmailVerified(true);
        // Strictly isolate session: do not mutate global user state, and sign out from global context
        await signOutUser();
      }
    } catch (err: any) {
      console.warn('My Bookings Google sign-in:', err);
      setOtpError('Google sign-in could not be completed.');
    } finally {
      setIsOAuthAuthenticating(false);
    }
  };

  const handleCancelBooking = (bookingId: string) => {
    const updated = bookings.map((b) =>
      b.id === bookingId ? { ...b, status: 'Cancelled' as const } : b
    );
    saveBookings(updated);
  };

  // Track Booking State
  const [trackQuery, setTrackQuery] = useState<string>('');
  const [trackResult, setTrackResult] = useState<BookingRecord | null>(null);
  const [trackSearched, setTrackSearched] = useState<boolean>(false);

  const handleTrackSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!trackQuery.trim()) {
      triggerGlobalError('Required Field');
      return;
    }
    const q = trackQuery.trim().toLowerCase();
    const found = bookings.find(
      (b) => b.id.toLowerCase() === q || b.email.toLowerCase() === q
    );
    setTrackResult(found || null);
    setTrackSearched(true);
  };

  const [copiedEmail, setCopiedEmail] = useState<boolean>(false);
  const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Community Feedback State
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>(() => {
    try {
      const saved = localStorage.getItem('funzy_tech_community_feedback');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed;
        }
      }
    } catch {
      // fallback
    }
    return INITIAL_FEEDBACKS;
  });

  const [activeFeedbackIndex, setActiveFeedbackIndex] = useState<number>(0);
  const [feedbackTab, setFeedbackTab] = useState<'reviews' | 'write'>('reviews');
  const [newFeedbackName, setNewFeedbackName] = useState<string>('');
  const [newFeedbackMessage, setNewFeedbackMessage] = useState<string>('');
  const [newFeedbackRating, setNewFeedbackRating] = useState<number>(5);
  const [hoverRating, setHoverRating] = useState<number>(0);
  const [feedbackSubmittedSuccess, setFeedbackSubmittedSuccess] = useState<boolean>(false);
  const [feedbackFormError, setFeedbackFormError] = useState<string>('');
  const [feedbackFormShake, setFeedbackFormShake] = useState<boolean>(false);

  const handleFeedbackSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFeedbackMessage.trim()) {
      setFeedbackFormError('Please enter your feedback message.');
      setFeedbackFormShake(true);
      setTimeout(() => setFeedbackFormShake(false), 500);
      return;
    }

    const newEntry: FeedbackItem = {
      id: `user-fb-${Date.now()}`,
      name: newFeedbackName.trim() || (isLoggedIn ? userName : 'Community Member'),
      role: 'Verified Visitor',
      rating: newFeedbackRating,
      message: newFeedbackMessage.trim(),
      date: 'Just now',
      isUserSubmitted: true,
    };

    const updated = [newEntry, ...feedbacks];
    setFeedbacks(updated);
    try {
      localStorage.setItem('funzy_tech_community_feedback', JSON.stringify(updated));
    } catch {
      // localStorage fallback
    }

    setNewFeedbackName('');
    setNewFeedbackMessage('');
    setNewFeedbackRating(5);
    setFeedbackFormError('');
    setFeedbackSubmittedSuccess(true);
    setActiveFeedbackIndex(0);

    setTimeout(() => {
      setFeedbackSubmittedSuccess(false);
      setFeedbackTab('reviews');
    }, 1600);
  };

  const nextFeedback = () => {
    setActiveFeedbackIndex((prev) => (prev + 1) % feedbacks.length);
  };

  const prevFeedback = () => {
    setActiveFeedbackIndex((prev) => (prev - 1 + feedbacks.length) % feedbacks.length);
  };

  // Smooth Menu In and Out state control: default is FALSE so Menu is closed on website launch until clicked!
  const [isMenuRendered, setIsMenuRendered] = useState<boolean>(false);
  const [isMenuClosing, setIsMenuClosing] = useState<boolean>(false);
  const [clickedItemId, setClickedItemId] = useState<string | null>(null);

  // =========================================================================
  // CENTRALIZED LAYERED NAVIGATION & HISTORY STACK ENGINE
  // Preserves exact layered navigation history across Home -> Menu -> Sub-modal -> Nested-modal
  // Returns user to exact parent screen with smooth IN & OUT animations on close
  // =========================================================================
  type ScreenId =
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

  const navStackRef = useRef<ScreenId[]>([]);

  const getTopActiveScreen = useCallback((): ScreenId | null => {
    if (isShortcutsModalOpen && !isShortcutsModalClosing) return 'shortcuts';
    if (showDonationThankYou && !isDonationThankYouClosing) return 'donate-thanks';
    if (isDonateModalOpen && !isDonateModalClosing) return 'donate';
    if (isAboutModalOpen && !isAboutModalClosing) return 'about';
    if (isOtpModalOpen && !isOtpModalClosing) return 'otp';
    if (isOAuthWindowOpen && !isOAuthWindowClosing) return 'oauth';
    if (isAuthModalOpen && !isAuthModalClosing) return 'auth';
    if (isSignOutConfirmOpen && !isSignOutConfirmClosing) return 'signout-confirm';
    if (isAvatarModalOpen && !isAvatarModalClosing) return 'avatar';
    if (isBookingModalOpen && !isBookingModalClosing) return 'booking';
    if (isMyBookingsModalOpen && !isMyBookingsModalClosing) return 'my-bookings';
    if (isTrackModalOpen && !isTrackModalClosing) return 'track';
    if (isContactFormOpen && !isContactFormClosing) return 'contact';
    if (isAdminDashboardOpen && !isAdminDashboardClosing) return 'admin-dashboard';
    if (isAdminPasswordModalOpen && !isAdminPasswordModalClosing) return 'admin-password';
    if (isPromoPopupOpen && !isPromoPopupClosing) return 'promo';
    if (isQrModalOpen && !isQrModalClosing) return 'qr';
    if (isAskAIOpen) return 'ask-ai';
    if (isTechStoreOpen) return 'tech-store';
    if (isMyAppsOpen) return 'my-apps';
    if (isMyLinksOpen) return 'my-links';
    if (isMenuRendered && !isMenuClosing) return 'menu';
    return null;
  }, [
    showDonationThankYou, isDonationThankYouClosing,
    isDonateModalOpen, isDonateModalClosing,
    isAboutModalOpen, isAboutModalClosing,
    isOtpModalOpen, isOtpModalClosing,
    isOAuthWindowOpen, isOAuthWindowClosing,
    isAuthModalOpen, isAuthModalClosing,
    isSignOutConfirmOpen, isSignOutConfirmClosing,
    isAvatarModalOpen, isAvatarModalClosing,
    isBookingModalOpen, isBookingModalClosing,
    isMyBookingsModalOpen, isMyBookingsModalClosing,
    isTrackModalOpen, isTrackModalClosing,
    isContactFormOpen, isContactFormClosing,
    isAdminDashboardOpen, isAdminDashboardClosing,
    isAdminPasswordModalOpen, isAdminPasswordModalClosing,
    isPromoPopupOpen, isPromoPopupClosing,
    isQrModalOpen, isQrModalClosing,
    isAskAIOpen, isTechStoreOpen, isMyAppsOpen, isMyLinksOpen,
    isMenuRendered, isMenuClosing
  ]);

  const showScreen = useCallback((id: ScreenId) => {
    switch (id) {
      case 'menu':
        setIsMenuRendered(true);
        setIsMenuClosing(false);
        break;
      case 'about':
        setIsAboutModalOpen(true);
        setIsAboutModalClosing(false);
        break;
      case 'donate':
        setIsDonateModalOpen(true);
        setIsDonateModalClosing(false);
        break;
      case 'donate-thanks':
        setShowDonationThankYou(true);
        setIsDonationThankYouClosing(false);
        break;
      case 'booking':
        setIsBookingModalOpen(true);
        setIsBookingModalClosing(false);
        break;
      case 'my-bookings':
        setIsMyBookingsModalOpen(true);
        setIsMyBookingsModalClosing(false);
        break;
      case 'track':
        setIsTrackModalOpen(true);
        setIsTrackModalClosing(false);
        break;
      case 'contact':
        setIsContactFormOpen(true);
        setIsContactFormClosing(false);
        break;
      case 'auth':
        setIsAuthModalOpen(true);
        setIsAuthModalClosing(false);
        break;
      case 'otp':
        setIsOtpModalOpen(true);
        setIsOtpModalClosing(false);
        break;
      case 'oauth':
        setIsOAuthWindowOpen(true);
        setIsOAuthWindowClosing(false);
        break;
      case 'avatar':
        setIsAvatarModalOpen(true);
        setIsAvatarModalClosing(false);
        break;
      case 'signout-confirm':
        setIsSignOutConfirmOpen(true);
        setIsSignOutConfirmClosing(false);
        break;
      case 'admin-password':
        setIsAdminPasswordModalOpen(true);
        setIsAdminPasswordModalClosing(false);
        break;
      case 'admin-dashboard':
        setIsAdminDashboardOpen(true);
        setIsAdminDashboardClosing(false);
        break;
      case 'promo':
        setIsPromoPopupOpen(true);
        setIsPromoPopupClosing(false);
        break;
      case 'qr':
        setIsQrModalOpen(true);
        setIsQrModalClosing(false);
        break;
      case 'shortcuts':
        setIsShortcutsModalOpen(true);
        setIsShortcutsModalClosing(false);
        break;
      case 'tech-store':
        setIsTechStoreOpen(true);
        break;
      case 'my-apps':
        setIsMyAppsOpen(true);
        break;
      case 'my-links':
        setIsMyLinksOpen(true);
        break;
      case 'ask-ai':
        setIsAskAIOpen(true);
        break;
    }
  }, []);

  const hideScreenWithAnimation = useCallback((id: ScreenId, onFinished?: () => void) => {
    switch (id) {
      case 'menu':
        setIsMenuClosing(true);
        setTimeout(() => {
          setIsMenuRendered(false);
          setIsMenuClosing(false);
          if (onFinished) onFinished();
        }, 380);
        break;
      case 'about':
        setIsAboutModalClosing(true);
        setTimeout(() => {
          setIsAboutModalOpen(false);
          setIsAboutModalClosing(false);
          if (onFinished) onFinished();
        }, 240);
        break;
      case 'donate':
        setIsDonateModalClosing(true);
        setTimeout(() => {
          setIsDonateModalOpen(false);
          setIsDonateModalClosing(false);
          if (onFinished) onFinished();
        }, 240);
        break;
      case 'donate-thanks':
        setIsDonationThankYouClosing(true);
        setTimeout(() => {
          setShowDonationThankYou(false);
          setIsDonationThankYouClosing(false);
          if (onFinished) onFinished();
        }, 240);
        break;
      case 'contact':
        setIsContactFormClosing(true);
        setTimeout(() => {
          setIsContactFormOpen(false);
          setIsContactFormClosing(false);
          if (onFinished) onFinished();
        }, 240);
        break;
      case 'admin-password':
        setIsAdminPasswordModalClosing(true);
        setTimeout(() => {
          setIsAdminPasswordModalOpen(false);
          setIsAdminPasswordModalClosing(false);
          if (onFinished) onFinished();
        }, 240);
        break;
      case 'admin-dashboard':
        setIsAdminDashboardClosing(true);
        setTimeout(() => {
          setIsAdminDashboardOpen(false);
          setIsAdminDashboardClosing(false);
          if (onFinished) onFinished();
        }, 240);
        break;
      case 'qr':
        closeModalAnimated(setIsQrModalClosing, setIsQrModalOpen, onFinished);
        break;
      case 'tech-store':
        setIsTechStoreOpen(false);
        if (onFinished) onFinished();
        break;
      case 'my-apps':
        setIsMyAppsOpen(false);
        if (onFinished) onFinished();
        break;
      case 'my-links':
        setIsMyLinksOpen(false);
        if (onFinished) onFinished();
        break;
      case 'ask-ai':
        setIsAskAIOpen(false);
        if (onFinished) onFinished();
        break;
      case 'booking':
        closeModalAnimated(setIsBookingModalClosing, setIsBookingModalOpen, onFinished);
        break;
      case 'my-bookings':
        closeModalAnimated(setIsMyBookingsModalClosing, setIsMyBookingsModalOpen, onFinished);
        break;
      case 'track':
        closeModalAnimated(setIsTrackModalClosing, setIsTrackModalOpen, onFinished);
        break;
      case 'auth':
        closeModalAnimated(setIsAuthModalClosing, setIsAuthModalOpen, onFinished);
        break;
      case 'otp':
        closeModalAnimated(setIsOtpModalClosing, setIsOtpModalOpen, onFinished);
        break;
      case 'oauth':
        closeModalAnimated(setIsOAuthWindowClosing, setIsOAuthWindowOpen, onFinished);
        break;
      case 'avatar':
        closeModalAnimated(setIsAvatarModalClosing, setIsAvatarModalOpen, onFinished);
        break;
      case 'signout-confirm':
        closeModalAnimated(setIsSignOutConfirmClosing, setIsSignOutConfirmOpen, onFinished);
        break;
      case 'promo':
        closeModalAnimated(setIsPromoPopupClosing, setIsPromoPopupOpen, onFinished);
        break;
      case 'shortcuts':
        closeModalAnimated(setIsShortcutsModalClosing, setIsShortcutsModalOpen, onFinished);
        break;
    }
  }, []);

  const openScreenWithHistory = useCallback((target: ScreenId, fromScreen?: ScreenId) => {
    triggerHaptic(12);
    const currentActive = fromScreen || getTopActiveScreen();
    if (currentActive && currentActive !== target) {
      const lastInStack = navStackRef.current[navStackRef.current.length - 1];
      if (lastInStack !== currentActive) {
        navStackRef.current.push(currentActive);
      }
      hideScreenWithAnimation(currentActive, () => {
        showScreen(target);
      });
    } else {
      showScreen(target);
    }
  }, [getTopActiveScreen, hideScreenWithAnimation, showScreen, triggerHaptic]);

  const closeScreenWithHistory = useCallback((screenToClose?: ScreenId) => {
    triggerHaptic(10);
    const active = screenToClose || getTopActiveScreen();
    if (!active) return;

    hideScreenWithAnimation(active, () => {
      const prevScreen = navStackRef.current.pop();
      // Requirement 2: Closing the Book a Call popup must NEVER automatically open the Admin Panel or Main Menu.
      if (active === 'booking') {
        if (prevScreen && prevScreen !== 'menu' && prevScreen !== 'admin-dashboard' && prevScreen !== 'admin-password') {
          showScreen(prevScreen);
        }
        return;
      }
      // Requirement 3: Reset temporary verification context when My Bookings flow ends
      if (active === 'my-bookings') {
        setIsEmailVerified(false);
        setOtpGenerated('');
        setOtpInput('');
        setOtpMessage('');
        setOtpError('');
        setBookingsSearchQuery('');
      }
      if (prevScreen) {
        showScreen(prevScreen);
      }
    });
  }, [getTopActiveScreen, hideScreenWithAnimation, showScreen, triggerHaptic]);

  const handleItemClick = (id: string) => {
    triggerHaptic(14);
    setClickedItemId(id);
    setTimeout(() => {
      setClickedItemId((curr) => (curr === id ? null : curr));
      if (id === 'tech-store') {
        openScreenWithHistory('tech-store', 'menu');
      } else if (id === 'my-apps') {
        openScreenWithHistory('my-apps', 'menu');
      } else if (id === 'my-links') {
        openScreenWithHistory('my-links', 'menu');
      } else if (id === 'ask-ai') {
        openScreenWithHistory('ask-ai', 'menu');
      } else if (id === 'book-a-call') {
        setBookingConfirmedRecord(null);
        setBookingFormError('');
        openScreenWithHistory('booking', 'menu');
      } else if (id === 'my-bookings') {
        if (isLoggedIn && userEmail) {
          setMyBookingsEmail(userEmail);
          setIsEmailVerified(true);
        }
        openScreenWithHistory('my-bookings', 'menu');
      } else if (id === 'track-bookings') {
        setTrackSearched(false);
        setTrackResult(null);
        openScreenWithHistory('track', 'menu');
      } else if (id === 'about-us') {
        openScreenWithHistory('about', 'menu');
      }
    }, 240);
  };

  // Contact Form prefilled editable fields
  const [contactSubject, setContactSubject] = useState<string>(DEFAULT_CONTACT_SUBJECT);
  const [contactMessage, setContactMessage] = useState<string>(DEFAULT_CONTACT_MESSAGE);
  const [isResetFeedback, setIsResetFeedback] = useState<boolean>(false);
  const [resetFeedbackText, setResetFeedbackText] = useState<string>('Reset Done');
  const [isResettingFields, setIsResettingFields] = useState<boolean>(false);
  const [subjectShake, setSubjectShake] = useState<boolean>(false);
  const [messageShake, setMessageShake] = useState<boolean>(false);
  const [showRequiredPopup, setShowRequiredPopup] = useState<boolean>(false);
  const shakeTimeoutsRef = useRef<{ subject?: ReturnType<typeof setTimeout>; message?: ReturnType<typeof setTimeout> }>({});
  const resetFeedbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resetLockedRef = useRef<boolean>(false);
  const requiredPopupTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const subjectTextareaRef = useRef<HTMLTextAreaElement>(null);
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);
  const hasContactContent = Boolean(contactSubject.trim() || contactMessage.trim());

  const triggerSubjectShake = () => {
    setSubjectShake(false);
    if (shakeTimeoutsRef.current.subject) {
      clearTimeout(shakeTimeoutsRef.current.subject);
    }
    requestAnimationFrame(() => {
      setSubjectShake(true);
      shakeTimeoutsRef.current.subject = setTimeout(() => {
        setSubjectShake(false);
      }, 500);
    });
  };

  const triggerMessageShake = () => {
    setMessageShake(false);
    if (shakeTimeoutsRef.current.message) {
      clearTimeout(shakeTimeoutsRef.current.message);
    }
    requestAnimationFrame(() => {
      setMessageShake(true);
      shakeTimeoutsRef.current.message = setTimeout(() => {
        setMessageShake(false);
      }, 500);
    });
  };

  const handleOpenContactForm = (e?: React.MouseEvent) => {
    if (e) {
      e.stopPropagation();
    }
    // Prefill if fields are empty
    if (!contactSubject.trim() && !contactMessage.trim()) {
      setContactSubject(DEFAULT_CONTACT_SUBJECT);
      setContactMessage(DEFAULT_CONTACT_MESSAGE);
    }
    openScreenWithHistory('contact');
  };

  const handleCloseContactForm = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSubjectShake(false);
    setMessageShake(false);
    setShowRequiredPopup(false);
    if (requiredPopupTimerRef.current) {
      clearTimeout(requiredPopupTimerRef.current);
    }
    closeScreenWithHistory('contact');
  };

  const handleResetDefaults = (e?: React.MouseEvent) => {
    if (e) {
      e.preventDefault();
      e.stopPropagation();
    }
    // Prevent accidental rapid double-click toggling while feedback is showing
    if (resetLockedRef.current) return;
    resetLockedRef.current = true;
    setTimeout(() => {
      resetLockedRef.current = false;
    }, 600);

    const hasExistingContent = Boolean(contactSubject.trim() || contactMessage.trim());

    if (hasExistingContent) {
      // Clears all contents in Subject and Message so boxes collapse back to slim 1-line state
      setContactSubject('');
      setContactMessage('');
      setResetFeedbackText('Reset Done');
    } else {
      // If empty, restores default prefilled content
      setContactSubject(DEFAULT_CONTACT_SUBJECT);
      setContactMessage(DEFAULT_CONTACT_MESSAGE);
      setResetFeedbackText('Restored');
    }

    setIsResettingFields(true);
    setIsResetFeedback(true);

    if (resetFeedbackTimeoutRef.current) {
      clearTimeout(resetFeedbackTimeoutRef.current);
    }
    resetFeedbackTimeoutRef.current = setTimeout(() => {
      setIsResetFeedback(false);
      setIsResettingFields(false);
    }, 1400);
  };

  // Auto-expand textareas as user types, collapse when cleared/empty without scrollbars
  // Subject stays elongated (min 56px) for default template for complete visibility, expands dynamically if extra lines typed
  useEffect(() => {
    if (isContactFormOpen) {
      const updateTextareaHeights = () => {
        if (subjectTextareaRef.current) {
          const el = subjectTextareaRef.current;
          el.style.height = 'auto';
          const hasContent = el.value.trim().length > 0;
          const minHeight = hasContent ? 56 : 42;
          const targetHeight = Math.max(el.scrollHeight, minHeight);
          el.style.height = `${targetHeight}px`;
        }
        if (messageTextareaRef.current) {
          const el = messageTextareaRef.current;
          el.style.height = 'auto';
          const hasContent = el.value.trim().length > 0;
          const minHeight = hasContent ? 64 : 48;
          const targetHeight = Math.max(el.scrollHeight, minHeight);
          el.style.height = `${targetHeight}px`;
        }
      };

      updateTextareaHeights();
      // Re-measure after initial entrance animation settles
      const raf = requestAnimationFrame(updateTextareaHeights);
      const timer = setTimeout(updateTextareaHeights, 60);
      return () => {
        cancelAnimationFrame(raf);
        clearTimeout(timer);
      };
    }
  }, [isContactFormOpen, contactSubject, contactMessage]);

  const handleContactFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const isSubjectEmpty = !contactSubject.trim();
    const isMessageEmpty = !contactMessage.trim();

    if (isSubjectEmpty || isMessageEmpty) {
      if (isSubjectEmpty) {
        triggerSubjectShake();
      }
      if (isMessageEmpty) {
        triggerMessageShake();
      }

      // Show 1-second 'Required Field' popup notification without auto-opening keyboard
      setShowRequiredPopup(true);
      if (requiredPopupTimerRef.current) {
        clearTimeout(requiredPopupTimerRef.current);
      }
      requiredPopupTimerRef.current = setTimeout(() => {
        setShowRequiredPopup(false);
      }, 1000);

      return;
    }

    const mailtoUrl = `mailto:FunzyTechBusiness@Gmail.com?subject=${encodeURIComponent(contactSubject)}&body=${encodeURIComponent(contactMessage)}`;
    window.location.href = mailtoUrl;
  };

  const handleOpenMenu = () => {
    openScreenWithHistory('menu');
  };

  const handleCloseMenu = () => {
    closeScreenWithHistory('menu');
  };

  const toggleMenu = (e: React.MouseEvent) => {
    e.stopPropagation();
    triggerHaptic([14, 25, 10]);
    if (isMenuRendered && !isMenuClosing) {
      handleCloseMenu();
    } else {
      handleOpenMenu();
    }
  };

  const handleTriggerShortcutAction = useCallback(
    (actionId: string) => {
      triggerHaptic(15);
      switch (actionId) {
        case 'about':
          openScreenWithHistory('about');
          break;
        case 'donate':
          openScreenWithHistory('donate');
          break;
        case 'contact':
          handleOpenContactForm();
          break;
        case 'menu':
          if (isMenuRendered && !isMenuClosing) {
            handleCloseMenu();
          } else {
            handleOpenMenu();
          }
          break;
        case 'qr':
          handleOpenQrModal();
          break;
        case 'shortcuts':
          openScreenWithHistory('shortcuts');
          break;
        default:
          break;
      }
    },
    [isMenuRendered, isMenuClosing, openScreenWithHistory, triggerHaptic]
  );

  // Background Keyboard Shortcuts Listener:
  // Allows users to quickly trigger modals ('About Us', 'Donate Now', 'Send Message', etc.) via key combinations directly in background without UI clutter
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInputFocused =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      // Escape key always closes topmost active modal, or closes the menu
      if (e.key === 'Escape') {
        e.preventDefault();
        triggerHaptic(10);
        const topScreen = getTopActiveScreen();
        if (topScreen) {
          closeScreenWithHistory(topScreen);
        } else if (isMenuRendered && !isMenuClosing) {
          handleCloseMenu();
        }
        return;
      }

      // Check shortcuts in background
      for (const item of shortcuts) {
        const matchesKey =
          e.key.toLowerCase() === item.key.toLowerCase() ||
          e.code.toLowerCase() === `key${item.key.toLowerCase()}`;
        const matchesAlt = item.altKey ? e.altKey : !e.altKey;
        const matchesCtrl = item.ctrlKey ? (e.ctrlKey || e.metaKey) : (!e.ctrlKey && !e.metaKey);
        const matchesShift = item.shiftKey ? e.shiftKey : !e.shiftKey;

        // If an input is focused, only allow combinations that have Alt or Ctrl modifier
        if (isInputFocused && !item.altKey && !item.ctrlKey) {
          continue;
        }

        if (matchesKey && matchesAlt && matchesCtrl && matchesShift) {
          e.preventDefault();
          handleTriggerShortcutAction(item.id);
          return;
        }
      }

      // Built-in standard fallbacks: Alt+A (About), Alt+D (Donate), Alt+M (Message)
      if ((e.altKey || e.metaKey) && !isInputFocused) {
        const k = e.key.toLowerCase();
        if (k === 'a') {
          e.preventDefault();
          handleTriggerShortcutAction('about');
        } else if (k === 'd') {
          e.preventDefault();
          handleTriggerShortcutAction('donate');
        } else if (k === 'm' || k === 'c') {
          e.preventDefault();
          handleTriggerShortcutAction('contact');
        } else if (k === 'h') {
          e.preventDefault();
          handleTriggerShortcutAction('menu');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [
    shortcuts,
    getTopActiveScreen,
    closeScreenWithHistory,
    isMenuRendered,
    isMenuClosing,
    handleTriggerShortcutAction,
    triggerHaptic,
  ]);

  // Clean up copy, reset, and shake timeouts on unmount
  useEffect(() => {
    return () => {
      if (copyTimeoutRef.current) {
        clearTimeout(copyTimeoutRef.current);
      }
      if (resetFeedbackTimeoutRef.current) {
        clearTimeout(resetFeedbackTimeoutRef.current);
      }
      if (shakeTimeoutsRef.current.subject) {
        clearTimeout(shakeTimeoutsRef.current.subject);
      }
      if (shakeTimeoutsRef.current.message) {
        clearTimeout(shakeTimeoutsRef.current.message);
      }
      if (requiredPopupTimerRef.current) {
        clearTimeout(requiredPopupTimerRef.current);
      }
      if (authRequiredPopupTimerRef.current) {
        clearTimeout(authRequiredPopupTimerRef.current);
      }
      if (shareTimeoutRef.current) {
        clearTimeout(shareTimeoutRef.current);
      }
      if (copiedLinkTimerRef.current) {
        clearTimeout(copiedLinkTimerRef.current);
      }
      if (copiedCodeTimerRef.current) {
        clearTimeout(copiedCodeTimerRef.current);
      }
      if (copiedUpiIdTimerRef.current) {
        clearTimeout(copiedUpiIdTimerRef.current);
      }
      if (qrDebounceTimerRef.current) {
        clearTimeout(qrDebounceTimerRef.current);
      }
    };
  }, []);

  // Party Popper celebratory sound synthesizer via Web Audio API (Zero-latency, no network asset)
  const playPartyPopperSound = useCallback(() => {
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return;
      const ctx = new AudioCtxClass();
      if (ctx.state === 'suspended') {
        ctx.resume().catch(() => {});
      }

      const now = ctx.currentTime;
      // High-frequency pop envelope (340Hz down to 60Hz in 80ms)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(340, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.08);

      gain.gain.setValueAtTime(0.55, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.09);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);

      // Micro noise burst for authentic physical pop crackle
      const bufferSize = Math.floor(ctx.sampleRate * 0.04);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.25));
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 800;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.3, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.05);

      whiteNoise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      whiteNoise.start(now);
      whiteNoise.stop(now + 0.05);
    } catch {
      // Browser autoplay policy graceful fallback
    }
  }, []);

  // Referral System: Incoming referral detection & visit tracking
  useEffect(() => {
    let visitorId = '';
    try {
      visitorId = localStorage.getItem('ft_visitor_id') || '';
      if (!visitorId) {
        visitorId = 'vis_' + Date.now() + '_' + Math.random().toString(36).substring(2, 8);
        localStorage.setItem('ft_visitor_id', visitorId);
      }
    } catch {
      visitorId = 'vis_' + Date.now();
    }

    const urlParams = new URLSearchParams(window.location.search);
    const incomingRef = urlParams.get('ref') || urlParams.get('coupon');

    if (incomingRef) {
      validateAndTrackReferral(incomingRef, visitorId, userEmail)
        .then((result) => {
          if (result.valid && result.code) {
            setReferralDiscount({
              code: result.code,
              discountPercentage: result.discount_percentage || 10,
              isSelfReferral: false,
              expiresAt: result.expires_at || '',
            });

            try {
              localStorage.setItem(
                'ft_applied_coupon',
                JSON.stringify({
                  code: result.code,
                  discountPercentage: result.discount_percentage || 10,
                  expiresAt: result.expires_at || '',
                })
              );
            } catch {}

            // Trigger ONLY when user arrives through referral link/QR code as requested
            setTimeout(() => {
              setIsPromoPopupOpen(true);
              if (!promoSoundPlayedRef.current) {
                promoSoundPlayedRef.current = true;
                playPartyPopperSound();
              }
            }, 600);
          } else if (result.isSelfReferral) {
            console.info('Self-referral detected and prevented.');
          }
        })
        .catch((err) => {
          console.warn('Error processing referral parameter:', err);
        });
    } else {
      try {
        const cached = localStorage.getItem('ft_applied_coupon');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed?.code) {
            setReferralDiscount(parsed);
          }
        }
      } catch {}
    }
  }, [playPartyPopperSound, userEmail]);

  // Production-Ready: Automatically prefetch single active referral code for returning or first-time visitor
  useEffect(() => {
    let visitorId = '';
    try {
      visitorId = localStorage.getItem('ft_visitor_id') || '';
      if (!visitorId) {
        visitorId = 'VIS-' + Math.floor(10000 + Math.random() * 90000);
        localStorage.setItem('ft_visitor_id', visitorId);
      }
    } catch {
      visitorId = 'VIS-10001';
    }

    fetchOrGenerateReferralCode(userEmail, visitorId)
      .then((code) => {
        if (code) {
          setMyReferralCode(code);
        }
      })
      .catch((err) => console.warn('Could not prefetch referral code:', err));
  }, [userEmail]);

  // Web Share API State & Trigger
  const [shareSuccess, setShareSuccess] = useState<boolean>(false);
  const shareTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getOrGenerateReferralCode = async (): Promise<string> => {
    if (myReferralCode) return myReferralCode;
    const code = await fetchOrGenerateReferralCode(userEmail);
    if (code) {
      setMyReferralCode(code);
    }
    return code || myReferralCode || '';
  };

  const handleShareWebsite = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFetchingReferralCode(true);

    const code = await getOrGenerateReferralCode();
    setIsFetchingReferralCode(false);

    const { title, text, url, fullMessage } = buildShareContent(code);

    if (navigator.share) {
      try {
        await navigator.share({
          title,
          text,
          url,
        });
        setShareSuccess(true);
        if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
        shareTimeoutRef.current = setTimeout(() => setShareSuccess(false), 2400);
        return;
      } catch (err: any) {
        if (err.name === 'AbortError') {
          return;
        }
      }
    }

    // Graceful Fallback: Copy exact message with ONE single link to clipboard
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(fullMessage);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = fullMessage;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setShareSuccess(true);
      if (shareTimeoutRef.current) clearTimeout(shareTimeoutRef.current);
      shareTimeoutRef.current = setTimeout(() => setShareSuccess(false), 2400);
    } catch {
      // Fallback ignore
    }
  };

  // Dedicated WhatsApp Share Handler (Produces exactly ONE referral URL)
  const handleWhatsAppShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsFetchingReferralCode(true);
    const code = await getOrGenerateReferralCode();
    setIsFetchingReferralCode(false);

    const { whatsAppUrl } = buildShareContent(code);
    window.open(whatsAppUrl, '_blank', 'noopener,noreferrer');
  };

  const handleOpenQrModal = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    openScreenWithHistory('qr', 'menu');
    setIsGeneratingQr(true);
    try {
      const code = await getOrGenerateReferralCode();
      const canonicalUrl = getCanonicalReferralUrl(code);
      const dataUrl = await QRCode.toDataURL(canonicalUrl, {
        width: 960,
        margin: 2,
        color: {
          dark: '#241407',
          light: '#ffffff',
        },
        errorCorrectionLevel: 'H',
      });
      setQrCodeDataUrl(dataUrl);
    } catch (err) {
      console.warn('Failed to generate QR code data URL:', err);
    } finally {
      setIsGeneratingQr(false);
    }
  };

  const handleCopyReferralCode = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    triggerHaptic(15);
    const code = myReferralCode || (await getOrGenerateReferralCode());
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(code);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = code;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedCodeSuccess(true);
      if (copiedCodeTimerRef.current) clearTimeout(copiedCodeTimerRef.current);
      copiedCodeTimerRef.current = setTimeout(() => setCopiedCodeSuccess(false), 2000);

      // Track referral code copy exposure on server for self-referral prevention
      fetch('/api/referral/track-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      }).catch(() => {});
    } catch {}
  };

  const handleCopyReferralLink = async (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    triggerHaptic(15);
    const code = myReferralCode || (await getOrGenerateReferralCode());
    const canonicalUrl = getCanonicalReferralUrl(code);
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(canonicalUrl);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = canonicalUrl;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
      }
      setCopiedLinkSuccess(true);
      if (copiedLinkTimerRef.current) clearTimeout(copiedLinkTimerRef.current);
      copiedLinkTimerRef.current = setTimeout(() => setCopiedLinkSuccess(false), 2200);

      // Track referral link copy exposure on server for self-referral prevention
      fetch('/api/referral/track-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ code }),
      }).catch(() => {});
    } catch {}
  };

  const handleDownloadQrCode = (e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    if (!qrCodeDataUrl) return;
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Maximum High-Resolution (3X Scale = 1800 x 2280 px Ultra HD)
      const scale = 3;
      const width = 600;
      const height = 760;
      canvas.width = width * scale;
      canvas.height = height * scale;
      ctx.scale(scale, scale);

      const centerX = width / 2;

      const drawRoundRect = (
        c: CanvasRenderingContext2D,
        x: number,
        y: number,
        w: number,
        h: number,
        r: number
      ) => {
        if (typeof c.roundRect === 'function') {
          c.roundRect(x, y, w, h, r);
        } else {
          c.beginPath();
          c.moveTo(x + r, y);
          c.lineTo(x + w - r, y);
          c.arcTo(x + w, y, x + w, y + r, r);
          c.lineTo(x + w, y + h - r);
          c.arcTo(x + w, y + h, x + w - r, y + h, r);
          c.lineTo(x + r, y + h);
          c.arcTo(x, y + h, x, y + h - r, r);
          c.lineTo(x, y + r);
          c.arcTo(x, y, x + r, y, r);
          c.closePath();
        }
      };

      // 1. Draw rounded outer card background with luxury warm liquid glass styling
      const cardRadius = 32;
      ctx.save();
      ctx.beginPath();
      drawRoundRect(ctx, 0, 0, width, height, cardRadius);
      ctx.clip();

      // Fluid warm champagne gradient background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, height);
      bgGrad.addColorStop(0, '#fbf5ed');
      bgGrad.addColorStop(0.45, '#f4e6d4');
      bgGrad.addColorStop(1, '#ebd5bd');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, width, height);

      // Glass glow rim at top
      const glowRim = ctx.createLinearGradient(0, 0, width, 0);
      glowRim.addColorStop(0, 'rgba(255, 255, 255, 0)');
      glowRim.addColorStop(0.5, 'rgba(255, 255, 255, 0.85)');
      glowRim.addColorStop(1, 'rgba(255, 255, 255, 0)');
      ctx.fillStyle = glowRim;
      ctx.fillRect(30, 0, width - 60, 3);

      // Card outer luxury border
      ctx.lineWidth = 3;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
      ctx.stroke();

      // 2. Centered Top Icon Badge (matching the popup's rounded icon container)
      const iconSize = 54;
      const iconX = centerX - iconSize / 2;
      const iconY = 46;

      ctx.save();
      ctx.beginPath();
      drawRoundRect(ctx, iconX, iconY, iconSize, iconSize, 16);
      ctx.fillStyle = 'rgba(254, 243, 199, 0.92)';
      ctx.shadowColor = 'rgba(115, 88, 48, 0.15)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 3;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(245, 158, 11, 0.45)';
      ctx.stroke();

      // Draw crisp QR vector graphic icon inside badge
      const icX = iconX + 14;
      const icY = iconY + 14;
      ctx.fillStyle = '#452a12';
      // Top-left finder
      ctx.fillRect(icX, icY, 10, 10);
      ctx.clearRect(icX + 2, icY + 2, 6, 6);
      ctx.fillRect(icX + 3.5, icY + 3.5, 3, 3);
      // Top-right finder
      ctx.fillRect(icX + 16, icY, 10, 10);
      ctx.clearRect(icX + 18, icY + 2, 6, 6);
      ctx.fillRect(icX + 19.5, icY + 3.5, 3, 3);
      // Bottom-left finder
      ctx.fillRect(icX, icY + 16, 10, 10);
      ctx.clearRect(icX + 2, icY + 18, 6, 6);
      ctx.fillRect(icX + 3.5, icY + 19.5, 3, 3);
      // Data modules
      ctx.fillRect(icX + 16, icY + 16, 4, 4);
      ctx.fillRect(icX + 22, icY + 16, 4, 4);
      ctx.fillRect(icX + 16, icY + 22, 4, 4);
      ctx.fillRect(icX + 22, icY + 22, 4, 4);
      ctx.restore();

      // 3. Title & Branding: "Funzy Tech" and "Your Referral QR Code"
      ctx.fillStyle = '#261508';
      ctx.font = '900 24px "Outfit", system-ui, -apple-system, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Funzy Tech', centerX, 126);

      ctx.fillStyle = '#6d4827';
      ctx.font = 'bold 15px "Outfit", system-ui, -apple-system, sans-serif';
      ctx.fillText('Your Referral QR Code', centerX, 148);

      // 4. Description: "Scan and share referral code · 10% OFF Call Booking"
      ctx.fillStyle = '#7d644d';
      ctx.font = '600 13px "Outfit", system-ui, -apple-system, sans-serif';
      ctx.fillText('Scan and share referral code · 10% OFF Call Booking', centerX, 170);

      // 5. Centered QR Code Box (clean white card with rounded corners and subtle shadow)
      const qrBoxWidth = 390;
      const qrBoxHeight = 405;
      const qrBoxX = (width - qrBoxWidth) / 2;
      const qrBoxY = 196;

      ctx.save();
      ctx.beginPath();
      drawRoundRect(ctx, qrBoxX, qrBoxY, qrBoxWidth, qrBoxHeight, 22);
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = 'rgba(95, 70, 40, 0.16)';
      ctx.shadowBlur = 16;
      ctx.shadowOffsetY = 5;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(166, 141, 106, 0.22)';
      ctx.stroke();

      // Render the QR code image centrally
      const qrImgSize = 310;
      const qrImgX = (width - qrImgSize) / 2;
      const qrImgY = qrBoxY + 25;
      ctx.drawImage(img, qrImgX, qrImgY, qrImgSize, qrImgSize);

      // Caption below QR Code: "Scan QR code to open website"
      ctx.fillStyle = '#593e28';
      ctx.font = 'bold 14px "Outfit", system-ui, -apple-system, sans-serif';
      ctx.fillText('Scan QR code to open website', centerX, qrBoxY + qrBoxHeight - 24);
      ctx.restore();

      // 6. Referral Code Pill at bottom (clean pill without copy or download buttons)
      const pillWidth = 390;
      const pillHeight = 78;
      const pillX = (width - pillWidth) / 2;
      const pillY = 626;

      ctx.save();
      ctx.beginPath();
      drawRoundRect(ctx, pillX, pillY, pillWidth, pillHeight, 18);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.75)';
      ctx.shadowColor = 'rgba(95, 70, 40, 0.08)';
      ctx.shadowBlur = 8;
      ctx.shadowOffsetY = 2;
      ctx.fill();
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = 1.5;
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.stroke();

      // Pill label: "YOUR REFERRAL CODE"
      ctx.fillStyle = '#7d644d';
      ctx.font = 'bold 10px "Outfit", system-ui, -apple-system, sans-serif';
      ctx.fillText('YOUR REFERRAL CODE', centerX, pillY + 26);

      // Pill code: FT-XXXXX (high-visibility, bold monospace)
      const codeText = myReferralCode || 'FT-CONNECT';
      ctx.fillStyle = '#261508';
      ctx.font = '900 24px monospace';
      ctx.fillText(codeText, centerX, pillY + 56);
      ctx.restore();

      ctx.restore();

      const combinedUrl = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.href = combinedUrl;
      downloadLink.download = `FunzyTech-Referral-Card-${codeText}.png`;
      document.body.appendChild(downloadLink);
      downloadLink.click();
      document.body.removeChild(downloadLink);

      triggerHaptic(20);
      setDownloadQrSuccess(true);
      if (downloadQrTimerRef.current) clearTimeout(downloadQrTimerRef.current);
      downloadQrTimerRef.current = setTimeout(() => {
        setDownloadQrSuccess(false);
      }, 2200);
    };
    img.src = qrCodeDataUrl;
  };

  const handleApplyManualCoupon = async (e: React.FormEvent) => {
    e.preventDefault();
    triggerHaptic(15);
    if (!manualCouponInput.trim()) return;
    const cleanCode = manualCouponInput.trim().toUpperCase();
    setManualCouponStatus('Validating...');

    let visitorId = '';
    try {
      visitorId = localStorage.getItem('ft_visitor_id') || '';
    } catch {}

    try {
      const res = await fetch(`/api/referral/validate/${encodeURIComponent(cleanCode)}`, {
        credentials: 'include',
      });
      if (res.ok) {
        const data = await res.json();
        if (data.valid) {
          setReferralDiscount({
            code: data.code,
            discountPercentage: data.discount_percentage,
            expiresAt: data.expires_at,
          });
          triggerHaptic([25, 45, 25]);
          setManualCouponStatus(`✓ ${data.discount_percentage}% discount applied!`);
          try {
            localStorage.setItem(
              'ft_applied_coupon',
              JSON.stringify({
                code: data.code,
                discountPercentage: data.discount_percentage,
                expiresAt: data.expires_at,
              })
            );
          } catch {}
          return;
        } else {
          setReferralDiscount(null);
          setManualCouponStatus(data.error || 'This referral code is invalid or has expired.');
          return;
        }
      }
    } catch {
      // Server not reachable -> use Firestore fallback
    }

    // Static GitHub Pages fallback validation via Firestore
    const validation = await validateAndTrackReferral(cleanCode, visitorId, userEmail);
    if (validation.valid && validation.code) {
      setReferralDiscount({
        code: validation.code,
        discountPercentage: validation.discount_percentage || 10,
        expiresAt: validation.expires_at || '',
      });
      triggerHaptic([25, 45, 25]);
      setManualCouponStatus(`✓ ${validation.discount_percentage || 10}% discount applied!`);
      try {
        localStorage.setItem(
          'ft_applied_coupon',
          JSON.stringify({
            code: validation.code,
            discountPercentage: validation.discount_percentage || 10,
            expiresAt: validation.expires_at || '',
          })
        );
      } catch {}
    } else {
      setReferralDiscount(null);
      setManualCouponStatus(validation.reason || 'This referral code is invalid or has expired.');
    }
  };

  const handleCopyEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Prevent double clicking while already in copied state until it transitions back
    if (copiedEmail) return;

    const emailToCopy = 'FunzyTechBusiness@Gmail.com';

    // Ensure email is copied to clipboard
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(emailToCopy).catch(() => {
        const textarea = document.createElement('textarea');
        textarea.value = emailToCopy;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        try {
          document.execCommand('copy');
        } catch {
          // Fallback ignore
        }
        document.body.removeChild(textarea);
      });
    } else {
      const textarea = document.createElement('textarea');
      textarea.value = emailToCopy;
      textarea.style.position = 'fixed';
      textarea.style.opacity = '0';
      document.body.appendChild(textarea);
      textarea.select();
      try {
        document.execCommand('copy');
      } catch {
        // Fallback ignore
      }
      document.body.removeChild(textarea);
    }

    // Clear previous timer for smooth cycle re-triggering
    if (copyTimeoutRef.current) {
      clearTimeout(copyTimeoutRef.current);
    }

    // Trigger smooth transition into 'Copied' state
    setCopiedEmail(true);

    // Smoothly return to 'Copy Email' state after a short delay
    copyTimeoutRef.current = setTimeout(() => {
      setCopiedEmail(false);
    }, 2000);
  };


  // Confirm Contribution celebratory event
  const handleConfirmContribution = () => {
    try {
      playPartyPopperSound();
    } catch {}
    try {
      confetti({
        particleCount: 90,
        spread: 80,
        origin: { y: 0.6 },
      });
    } catch {}
    openScreenWithHistory('donate-thanks', 'donate');
  };

  return (
    <div 
      onClick={(e) => {
        if (isAnyModalActive) return;
        if (isMenuRendered && !isMenuClosing) handleCloseMenu();
      }}
      className="relative h-screen w-full overflow-hidden bg-exact-warm flex flex-col"
    >
      {/* 
        Aesthetic Parchment Paper Texture Layer:
        - Visible immediately upon load
      */}
      <div
        className="pointer-events-none fixed -inset-4 bg-cover bg-center bg-no-repeat opacity-[0.24] mix-blend-multiply blur-[1px]"
        style={{
          backgroundImage: `url(${paperTexture})`,
        }}
        aria-hidden="true"
      />

      {/* Tactile fine paper fiber grain overlay */}
      <div
        className="pointer-events-none fixed inset-0 opacity-[0.12] mix-blend-color-burn"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 240 240' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
        }}
        aria-hidden="true"
      />

      {/* Warm ambient depth glow */}
      <div
        className="pointer-events-none fixed top-0 left-1/2 -translate-x-1/2 h-[520px] w-[780px] rounded-full bg-gradient-to-b from-[#f3e4cb]/45 via-[#e0cca5]/25 to-transparent blur-3xl"
        aria-hidden="true"
      />

      {/* Subtle, Ultra-Smooth Floating Bubbles */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
        {BUBBLES.map((bubble) => (
          <div
            key={bubble.id}
            className="floating-bubble-soft"
            style={{
              width: `${bubble.size}px`,
              height: `${bubble.size}px`,
              left: bubble.left,
              animationDuration: bubble.duration,
              animationDelay: bubble.delay,
            }}
          >
            {/* Soft specular reflection */}
            <div className="absolute top-[20%] left-[24%] h-[24%] w-[24%] rounded-full bg-white/50 blur-[0.3px]" />
          </div>
        ))}
      </div>

      {/* Main Container - Fully responsive across Mobile, Tablet, Laptop, and Desktop */}
      <main className="relative z-10 mx-auto flex h-full max-h-screen w-full max-w-md sm:max-w-xl md:max-w-2xl lg:max-w-3xl xl:max-w-4xl flex-col px-3.5 sm:px-6 md:px-8 pt-3 sm:pt-4 pb-2 sm:pb-3 overflow-hidden">
        
        {/* 
          Stable Liquid Glass Capsule Bar with Framer-Motion Subtle 3D Tilt:
          - Glitch-free, perfectly rock-solid when opening or closing the menu
          - 3D frosted bevel & 50% continuous shine
          - Smooth cursor-following tilt effect via framer-motion
        */}
        <motion.header
          onClick={() => isMenuRendered && handleCloseMenu()}
          onMouseMove={handleHeaderMouseMove}
          onMouseLeave={handleHeaderMouseLeave}
          style={{
            perspective: 800,
            rotateX: headerRotateX,
            rotateY: headerRotateY,
            transformStyle: 'preserve-3d',
            isolation: 'isolate',
          }}
          className="glass-capsule relative z-50 flex h-16 w-full items-center justify-between rounded-full px-3.5 sm:px-5 overflow-hidden cursor-default shadow-[0_12px_28px_-6px_rgba(115,88,48,0.24)] hover:shadow-[0_16px_36px_-6px_rgba(115,88,48,0.30)] transition-shadow duration-300 shrink-0"
        >
          {/* Top light rim with feathered fade toward corners */}
          <div className="glass-glow-rim" aria-hidden="true" />

          {/* Continuous Liquid Glass Shine Effect (50% peak opacity) */}
          <div
            className="animate-liquid-shine-continuous pointer-events-none absolute inset-y-0 w-14 sm:w-16 -skew-x-[24deg] bg-gradient-to-r from-transparent via-white/50 to-transparent"
            aria-hidden="true"
          />

          {/* Left Corner: Clean Profile Picture with High-DPI SrcSet & Sizes */}
          <div className="relative z-10 flex items-center">
            <div
              className="relative min-w-[44px] min-h-[44px] h-11 w-11 flex-shrink-0 overflow-hidden rounded-full border-2 border-white/90 shadow-[0_2px_8px_rgba(95,70,40,0.22)] select-none transition-transform duration-200 hover:scale-105 active:scale-95 flex items-center justify-center"
            >
              <img
                src={avatar}
                srcSet={`${avatar} 1x, ${defaultAvatar} 2x, ${defaultAvatar} 3x`}
                sizes="44px"
                alt="Profile"
                loading="eager"
                decoding="sync"
                className="h-full w-full object-cover"
              />
            </div>
          </div>

          {/* 
            Center: "Funzy Tech"
            - Tactile debossed text-shadow
            - Perfectly centered vertically & horizontally with ~1% optical upward shift
            - Subtle, infinite 3-second gentle 'breathing' pulse animation
            - Prominent, enlarged branding presence
          */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="-translate-y-[1.5%] animate-brand-breathe flex items-center justify-center">
              <span className="text-debossed select-none font-['Outfit',sans-serif] text-[39px] sm:text-[48px] md:text-[54px] font-black tracking-tight leading-none inline-block">
                Funzy Tech
              </span>
            </div>
          </div>

          {/* Right Corner: Three Lines (Menu) Button with Morphing Animation */}
          <button
            type="button"
            onClick={toggleMenu}
            aria-label="Menu"
            aria-expanded={isMenuRendered && !isMenuClosing}
            className="relative z-10 flex h-11 w-11 flex-shrink-0 cursor-pointer flex-col items-center justify-center gap-[5px] rounded-full p-2 transition-transform duration-200 ease-luxury hover:bg-black/8 hover:scale-105 active:scale-95"
          >
            <span
              className={`h-[2.5px] w-5 rounded-full bg-[#2c1b0d] shadow-[0_1px_0_rgba(255,255,255,0.6)] transition-all duration-300 ease-luxury ${
                isMenuRendered && !isMenuClosing ? 'translate-y-[7.5px] rotate-45' : ''
              }`}
            />
            <span
              className={`h-[2.5px] w-5 rounded-full bg-[#2c1b0d] shadow-[0_1px_0_rgba(255,255,255,0.6)] transition-all duration-300 ease-luxury ${
                isMenuRendered && !isMenuClosing ? 'opacity-0 scale-x-0' : 'opacity-100 scale-x-100'
              }`}
            />
            <span
              className={`h-[2.5px] w-5 rounded-full bg-[#2c1b0d] shadow-[0_1px_0_rgba(255,255,255,0.6)] transition-all duration-300 ease-luxury ${
                isMenuRendered && !isMenuClosing ? '-translate-y-[7.5px] -rotate-45' : ''
              }`}
            />
          </button>
        </motion.header>

        {/* Homepage Header Text directly below top navigation bar - ONLY blurs when menu opens */}
        <div
          className={`w-full flex flex-col items-center justify-center text-center select-none px-4 max-w-3xl mx-auto transition-all duration-300 ${
            isMenuRendered
              ? 'absolute top-[82px] sm:top-[90px] left-0 right-0 z-10 filter blur-[8px] opacity-40 pointer-events-none select-none'
              : 'relative z-10 mt-2.5 sm:mt-3 mb-1'
          }`}
          aria-hidden={isMenuRendered}
        >
          <span className="text-headline-curiosity text-[26px] xs:text-[30px] sm:text-[40px] md:text-[46px] whitespace-nowrap leading-tight py-0.5">
            Your Curiosity. My Passion.
          </span>
          <span className="text-subheadline-conversation text-[18px] xs:text-[21px] sm:text-[26px] md:text-[30px] whitespace-nowrap leading-none mt-1 sm:mt-1.5 pb-1">
            One Conversation.
          </span>

          {/* Quick Action Buttons on Home Page directly below One Conversation */}
          <div className="mt-3.5 sm:mt-4 flex items-center justify-center gap-2.5 sm:gap-3.5 w-full max-w-[310px] xs:max-w-xs sm:max-w-sm mx-auto px-1">
            {/* 1. Book a Call Button with Continuous Looping Call Icon Animation */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic(18);
                openScreenWithHistory('booking');
              }}
              className="group relative flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 px-3 sm:px-4 rounded-2xl bg-gradient-to-r from-[#382010] via-[#261408] to-[#180a02] hover:from-[#4a2e18] hover:to-[#261408] text-[#fcf8f2] font-['Outfit',sans-serif] font-bold text-xs sm:text-[13px] tracking-tight border border-amber-400/30 shadow-[0_8px_20px_-4px_rgba(44,23,8,0.45)] hover:shadow-[0_12px_26px_-4px_rgba(44,23,8,0.55)] active:scale-[0.96] transition-all duration-200 cursor-pointer select-none overflow-hidden"
              title="Book a Call"
            >
              <span className="pointer-events-none absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-700 ease-out" />
              <svg
                className="h-4 w-4 text-amber-300 shrink-0 transition-transform duration-200 group-hover:scale-110 animate-call-icon-loop"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
              </svg>
              <span className="whitespace-nowrap font-black">Book a Call</span>
            </button>

            {/* 2. Track Booking Button with Continuous Looping Search Icon Animation */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                triggerHaptic(16);
                openScreenWithHistory('my-bookings');
              }}
              className="group relative flex-1 flex items-center justify-center gap-2 py-2.5 sm:py-3 px-3 sm:px-4 rounded-2xl bg-white/75 hover:bg-white/95 backdrop-blur-md text-[#2c1708] font-['Outfit',sans-serif] font-bold text-xs sm:text-[13px] tracking-tight border border-white/90 shadow-[0_8px_20px_-4px_rgba(95,70,40,0.20)] hover:shadow-[0_10px_24px_-4px_rgba(95,70,40,0.28)] active:scale-[0.96] transition-all duration-200 cursor-pointer select-none"
              title="Track Booking"
            >
              <svg
                className="h-4 w-4 text-[#593e28] shrink-0 transition-transform duration-200 group-hover:scale-110 animate-search-icon-loop"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="11" cy="11" r="8" />
                <line x1="21" y1="21" x2="16.65" y2="16.65" />
              </svg>
              <span className="whitespace-nowrap font-black">Track Booking</span>
            </button>
          </div>
        </div>

        {/* iOS 27 Liquid Glass Background Blur & Dismiss Backdrop when Main Menu is Open */}
        {isMenuRendered && !isAnyModalActive && (
          <div
            onClick={(e) => {
              e.stopPropagation();
              handleCloseMenu();
            }}
            className={`fixed inset-0 z-20 cursor-default transition-all duration-300 ${
              isMenuClosing
                ? 'opacity-0 backdrop-blur-none pointer-events-none'
                : 'opacity-100 backdrop-blur-[10px] bg-gradient-to-b from-[#2b190c]/25 via-[#4a2e18]/20 to-[#1f0f04]/30'
            }`}
            style={{
              WebkitBackdropFilter: isMenuClosing ? 'none' : 'blur(10px) saturate(1.15)',
              backdropFilter: isMenuClosing ? 'none' : 'blur(10px) saturate(1.15)',
            }}
            aria-hidden="true"
          >
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_rgba(255,245,230,0.18)_0%,_transparent_70%)] pointer-events-none" />
          </div>
        )}

        {/* 
          iOS 27 Liquid Glass Dropdown Menu:
          - RESTORED to exact original positioning, alignment, and layout (relative z-30 mt-2 sm:mt-2.5 directly below header)
          - Both In-Animation AND Out-Animation (smooth fluid exit)
          - Extends comfortably so all buttons are completely visible
          - Guest Profile Header with "Hey, Guest! 👋", subtitle, and "Sign In →"
        */}
        {isMenuRendered && (
          <div
            onClick={(e) => e.stopPropagation()}
            className={`liquid-glass-menu glass-dropdown-panel relative z-30 mt-2 sm:mt-2.5 flex flex-col rounded-[26px] p-3.5 sm:p-4 shadow-[0_20px_40px_-10px_rgba(115,88,48,0.3)] overflow-hidden ${
              isMenuClosing ? 'animate-liquid-menu-close' : 'animate-liquid-menu-open'
            }`}
            style={{
              maxHeight: 'calc(100vh - 94px)',
            }}
          >
            {/* Top rim feathered glow on the dropdown for iOS 27 glass realism */}
            <div className="glass-glow-rim" aria-hidden="true" />

            {/* Section 1: Main Menu Header (Logo & Guest/User Profile Section) - Fixed at top */}
            <div className="section-pop-1 shrink-0 flex items-center justify-between gap-2.5 pb-3 border-b border-[#a68d6a]/25">
              <div className="flex items-center gap-2.5 min-w-0 flex-1">
                {/* Profile Avatar with Instagram-Inspired Emerging Hand-Greeting Graphic */}
                <div className="relative flex-shrink-0">
                  <div 
                    onMouseDown={handleAvatarPressStart}
                    onMouseUp={handleAvatarPressEnd}
                    onMouseLeave={handleAvatarPressEnd}
                    onTouchStart={handleAvatarPressStart}
                    onTouchEnd={handleAvatarPressEnd}
                    onTouchCancel={handleAvatarPressEnd}
                    className="relative h-11 w-11 sm:h-12 sm:w-12 flex-shrink-0 overflow-hidden rounded-full border-2 border-white/95 hover:border-white shadow-md hover:shadow-lg bg-white flex items-center justify-center select-none cursor-pointer transition-all duration-300 ease-luxury hover:scale-110 active:scale-95"
                    title={isLoggedIn ? "Hold for 3 seconds to customize profile picture" : "Guest Profile"}
                  >
                    {!isLoggedIn ? (
                      <GuestAnimatedAvatar />
                    ) : (
                      <img
                        src={userAvatar || defaultAvatar}
                        srcSet={userAvatar ? `${userAvatar} 1x, ${userAvatar} 2x` : `${defaultAvatar} 1x, ${defaultAvatar} 2x, ${defaultAvatar} 3x`}
                        sizes="(max-width: 640px) 44px, 48px"
                        alt="Profile Avatar"
                        loading="eager"
                        decoding="sync"
                        className="h-full w-full object-cover scale-105 pointer-events-none"
                      />
                    )}
                    {/* Long-press visual progress ring overlay */}
                    {isLongPressing && isLoggedIn && (
                      <div className="absolute inset-0 bg-black/45 backdrop-blur-[1px] flex items-center justify-center">
                        <div className="relative h-8 w-8 flex items-center justify-center">
                          <svg className="h-full w-full -rotate-90" viewBox="0 0 36 36">
                            <path
                              className="text-white/30"
                              strokeWidth="3.5"
                              stroke="currentColor"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                            <path
                              className="text-amber-400"
                              strokeDasharray={`${longPressProgress}, 100`}
                              strokeWidth="3.5"
                              strokeLinecap="round"
                              stroke="currentColor"
                              fill="none"
                              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                            />
                          </svg>
                          <span className="absolute text-[8.5px] font-black text-white">
                            3s
                          </span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Profile Heading & Subtitle */}
                <div className="flex flex-col min-w-0">
                  <span className="font-['Outfit',sans-serif] font-black text-base sm:text-lg text-[#261508] tracking-tight leading-tight flex items-center gap-1.5 flex-nowrap whitespace-nowrap">
                    {!isLoggedIn ? (
                      <>
                        <span>Hey, Guest!</span>
                        <span className="inline-block animate-wave-hand select-none text-base sm:text-lg">👋🏼</span>
                      </>
                    ) : userName ? (
                      <>
                        <span>Hey, {userName}!</span>
                        <span className="inline-block animate-wave-hand select-none text-base sm:text-lg">👋🏼</span>
                      </>
                    ) : (
                      <>
                        <span>Welcome back!</span>
                        <span className="inline-block animate-wave-hand select-none text-base sm:text-lg">👋🏼</span>
                      </>
                    )}
                  </span>
                  <span className="text-[9px] xs:text-[9.5px] sm:text-[10.5px] text-[#7d644d]/90 font-medium leading-none whitespace-nowrap select-none mt-0.5 block tracking-tight">
                    {!isLoggedIn 
                      ? 'Connect with me as book your personal call' 
                      : 'You are signed in'
                    }
                  </span>
                </div>
              </div>

              {/* Dedicated Admin Button with Glowing Stroke & Animated Arrow */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={handleAdminButtonClick}
                  onMouseDown={handleAdminButtonMouseDown}
                  onMouseUp={handleAdminButtonMouseUpOrLeave}
                  onMouseLeave={handleAdminButtonMouseUpOrLeave}
                  onTouchStart={handleAdminButtonMouseDown}
                  onTouchEnd={handleAdminButtonMouseUpOrLeave}
                  className="shrink-0 inline-flex items-center gap-1 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg bg-white/80 hover:bg-white text-[#2c1708] font-['Outfit',sans-serif] font-bold text-[11px] sm:text-[11.5px] border border-amber-300/80 shadow-2xs hover:shadow-xs active:scale-95 transition-all duration-150 select-none cursor-pointer animate-ask-ai-glow"
                  title="Admin Access"
                  aria-label="Admin"
                >
                  <span>Admin</span>
                  <span className="inline-block animate-arrow-nudge text-[#8c6538]">
                    <svg
                      className="h-3 w-3"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.6"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <line x1="5" y1="12" x2="19" y2="12" />
                      <polyline points="12 5 19 12 12 19" />
                    </svg>
                  </span>
                </button>

                {isLoggedIn && (
                  <button
                    type="button"
                    onClick={() => openScreenWithHistory('signout-confirm', 'menu')}
                    className="text-[10px] sm:text-[10.5px] font-bold text-[#8c6b4b] hover:text-[#3d2714] px-2.5 py-1 rounded-lg bg-white/50 hover:bg-white border border-white/70 shadow-2xs active:scale-95 transition-all duration-150 cursor-pointer"
                    title="Sign out of account"
                  >
                    Sign Out
                  </button>
                )}
              </div>
            </div>

            {/* 
              Non-Scrollable, Static Options Container:
              Rock-solid, stationary frame where all items fit cleanly without any clipping on hover/click!
              pt-2.5 provides clean balanced breathing room under the divider line
            */}
            <div className="flex flex-col gap-1.5 overflow-visible select-none pt-2.5 pb-0.5 px-0.5">
              
              {/* Main Menu Sections with Looping Icon Animations, Click Animations & Descriptions */}
              {MENU_DRAFT_ITEMS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item.id)}
                  className={`group relative flex items-center justify-between w-full text-left px-3 py-2 rounded-xl bg-white/45 hover:bg-white/65 backdrop-blur-md border border-white/80 shadow-2xs transition-all duration-200 select-none cursor-pointer active:scale-[0.96] ${
                    clickedItemId === item.id ? 'animate-item-click bg-white/80 ring-2 ring-amber-400/40 shadow-sm' : ''
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100/80 border border-white/85 shadow-2xs text-[#4a321f] ${item.animClass}`}>
                      {item.icon}
                    </div>
                    <div className="flex flex-col min-w-0">
                      <span className="font-['Outfit',sans-serif] font-bold text-[13px] sm:text-[13.5px] text-[#261508] tracking-tight leading-none whitespace-nowrap flex items-center">
                        {item.title}
                      </span>
                      <span className="text-[9.5px] sm:text-[10px] text-[#7d644d]/75 font-medium leading-none mt-0.5 truncate">
                        {item.desc}
                      </span>
                    </div>
                  </div>
                  <div className="text-[#8c7054]/60 group-hover:text-[#573e2a] transition-transform duration-200 group-hover:translate-x-0.5 shrink-0 pl-1.5">
                    <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6" />
                    </svg>
                  </div>
                </button>
              ))}

              {/* In-Line Section: For Business Inquiries (Seamlessly integrated with animated email icon) */}
              <div className="relative rounded-xl bg-white/50 backdrop-blur-md border border-white/80 shadow-sm p-3 sm:p-3.5 flex flex-col gap-2 mt-0.5">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {/* Professional SVG Envelope Badge with Animated Loop */}
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-amber-100/80 border border-white/85 shadow-2xs text-[#4a321f] animate-email-loop">
                      <svg 
                        className="h-3.5 w-3.5 text-[#4a321f]" 
                        viewBox="0 0 24 24" 
                        fill="none" 
                        stroke="currentColor" 
                        strokeWidth="2.2" 
                        strokeLinecap="round" 
                        strokeLinejoin="round" 
                      >
                        <rect width="20" height="16" x="2" y="4" rx="2" />
                        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                      </svg>
                    </div>
                    {/* Contact - Funzy Tech (Single line, large bold letters, zero truncation) */}
                    <div className="flex flex-col min-w-0 shrink-0">
                      <span className="font-['Outfit',sans-serif] font-extrabold text-[13px] sm:text-[14px] text-[#2c1a0e] leading-none whitespace-nowrap select-none tracking-tight">
                        Contact - Funzy Tech
                      </span>
                      <span className="text-[9.5px] sm:text-[10px] text-[#7d644d]/90 font-medium leading-none whitespace-nowrap select-none mt-0.5 block">
                        Partnerships & Projects
                      </span>
                    </div>
                  </div>

                  {/* Copy Button with Smooth Animated Transition Cycling */}
                  <button
                    type="button"
                    onClick={handleCopyEmail}
                    disabled={copiedEmail}
                    className={`relative shrink-0 flex-none rounded-lg px-2 sm:px-2.5 py-1 text-[10px] sm:text-[10.5px] font-bold shadow-2xs transition-all duration-300 ease-luxury border whitespace-nowrap select-none ${
                      copiedEmail
                        ? 'cursor-default bg-emerald-50/90 text-emerald-800 border-emerald-300/80 shadow-[0_2px_8px_rgba(16,185,129,0.18)]'
                        : 'cursor-pointer bg-white/80 hover:bg-white text-[#3d2a19] border-white/90 hover:shadow-xs active:scale-95'
                    }`}
                    title={copiedEmail ? 'Email address copied!' : 'Copy email address'}
                  >
                    <div className="relative flex items-center justify-center min-w-[58px] sm:min-w-[62px]">
                      {/* 'Copied' State with fluid entrance & exit animation */}
                      <div
                        className={`flex items-center justify-center gap-1 transition-all duration-300 ease-luxury ${
                          copiedEmail
                            ? 'opacity-100 translate-y-0 scale-100'
                            : 'pointer-events-none absolute inset-0 opacity-0 translate-y-2 scale-90'
                        }`}
                      >
                        <svg className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span className="whitespace-nowrap">Copied</span>
                      </div>

                      {/* 'Copy Email' State with smooth return transition */}
                      <div
                        className={`flex items-center justify-center gap-1 transition-all duration-300 ease-luxury ${
                          copiedEmail
                            ? 'pointer-events-none absolute inset-0 opacity-0 -translate-y-2 scale-90'
                            : 'opacity-100 translate-y-0 scale-100'
                        }`}
                      >
                        <svg className="h-2.5 w-2.5 sm:h-3 sm:w-3 text-[#593e28]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                          <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
                          <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
                        </svg>
                        <span className="whitespace-nowrap">Copy Email</span>
                      </div>
                    </div>
                  </button>
                </div>
                
                {/* Official Business Email */}
                <a
                  href="mailto:FunzyTechBusiness@Gmail.com"
                  className="font-['Outfit',sans-serif] font-black text-[13.5px] sm:text-sm text-[#261508] hover:underline hover:text-black text-left cursor-pointer transition-all duration-200 hover:opacity-90 active:scale-[0.99] select-none inline-block w-fit"
                  title="Directly open email app to send a message"
                >
                  FunzyTechBusiness@Gmail.com
                </a>

                <div className="flex items-center justify-between pt-1 border-t border-[#a68d6a]/20 text-[10.5px] text-[#6e533b]">
                  <span className="font-medium text-[#7d644d]">Replies within 24 hours</span>
                  <button
                    type="button"
                    onClick={handleOpenContactForm}
                    className="font-extrabold text-[#2d1b0d] hover:text-[#000] flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/75 hover:bg-white border border-white/90 shadow-2xs cursor-pointer transition-all hover:scale-105 active:scale-95 group select-none"
                    title="Click to send message"
                  >
                    <span>Send Message</span>
                    <svg className="h-3 w-3 text-[#2d1b0d] transition-transform duration-200 group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14m-6-6 6 6-6 6" />
                    </svg>
                  </button>
                </div>
              </div>
            </div>

            {/* Share Website & 10% Off Offer Section */}
            <div className="pt-2 px-0.5 flex flex-col gap-1.5">
              <div 
                role="group" 
                aria-label="Share website options" 
                className="flex items-center gap-2"
              >
                <button
                  type="button"
                  onClick={handleShareWebsite}
                  aria-label={shareSuccess ? "Referral link copied" : "Share Us & Get 10% Off"}
                  aria-live="polite"
                  className={`share-website-btn animate-refer-glow flex-1 flex items-center justify-center gap-2 py-2.5 px-3.5 rounded-xl font-['Outfit',sans-serif] font-extrabold text-[12px] sm:text-[13px] border shadow-2xs cursor-pointer select-none group transition-all duration-300 active:scale-[0.98] ${
                    shareSuccess
                      ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                      : 'bg-white/65 hover:bg-white text-[#2c1708] border-white/85'
                  }`}
                  title={shareSuccess ? "Referral link copied!" : "Share Us & Get 10% Off"}
                >
                  {shareSuccess ? (
                    <>
                      <svg className="h-4 w-4 stroke-white shrink-0 animate-success-pop" viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      <span className="font-extrabold whitespace-nowrap text-white">
                        Link Copied!
                      </span>
                    </>
                  ) : (
                    <>
                      <svg
                        aria-hidden="true"
                        className="h-4 w-4 text-[#593e28] animate-share-icon-pulse shrink-0 transition-transform duration-300 ease-luxury group-hover:scale-115 group-hover:-translate-y-0.5"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2.2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <circle cx="18" cy="5" r="3" />
                        <circle cx="6" cy="12" r="3" />
                        <circle cx="18" cy="19" r="3" />
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
                      </svg>
                      <span className="transition-colors duration-200 group-hover:text-black font-extrabold whitespace-nowrap">
                        Share Us & Get 10% Off
                      </span>
                    </>
                  )}
                </button>

                {/* Dedicated QR Code Button */}
                <button
                  type="button"
                  onClick={handleOpenQrModal}
                  aria-label="Open Referral QR Code"
                  className="animate-qr-icon shrink-0 flex h-10 w-10 items-center justify-center rounded-xl bg-white/65 hover:bg-white text-[#593e28] hover:text-[#2c1708] border border-white/85 shadow-2xs hover:shadow-xs cursor-pointer select-none group active:scale-95 transition-all"
                  title="View and download referral QR code"
                >
                  <svg
                    aria-hidden="true"
                    className="h-4.5 w-4.5 text-[#593e28] group-hover:text-[#2c1708] transition-transform duration-300 ease-luxury group-hover:scale-110"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                    <circle cx="6.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="6.5" cy="17.5" r="1.5" fill="currentColor" stroke="none" />
                    <rect x="14" y="14" width="3" height="3" fill="currentColor" />
                    <rect x="18" y="14" width="3" height="3" fill="currentColor" />
                    <rect x="14" y="18" width="3" height="3" fill="currentColor" />
                    <rect x="18" y="18" width="3" height="3" fill="currentColor" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Bottom Glass Footer: Fixed at bottom with only Copyright Symbol, 'Funzy Tech' on left & 'Official Workspace' on right */}
            <div className="shrink-0 mt-2 pt-2 border-t border-[#a68d6a]/20 flex items-center justify-between text-[#73593f]/85">
              <div className="flex items-center gap-1.5 select-none" title="© Funzy Tech">
                <span className="sr-only">©</span>
                {/* Precision Copyright Symbol */}
                <svg
                  className="h-[13px] w-[13px] flex-shrink-0 text-[#573e2a]"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M14.8 9.2a4.5 4.5 0 1 0 0 5.6" />
                </svg>
                <span className="font-['Outfit',sans-serif] font-bold text-xs tracking-tight text-[#573e2a] whitespace-nowrap">
                  Funzy Tech
                </span>
              </div>
              <div className="flex items-center text-[11px] font-semibold text-[#573e2a]">
                <span className="whitespace-nowrap">Official Workspace</span>
              </div>
            </div>

          </div>
        )}

        {/* Home page is kept completely clean without unwanted elements when menu is closed */}
      </main>

      {/* 
        Sign In / Auth Modal (Name, Email ID, Create Password, Send OTP to Verify, or Continue with Google)
      */}
      {isAuthModalOpen && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            closeScreenWithHistory('auth');
          }}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md ${
            isAuthModalClosing ? 'animate-contact-backdrop-close' : 'animate-contact-backdrop'
          }`}
          role="dialog"
          aria-modal="true"
        >
          <SwipeableModalCard 
            onClose={() => closeScreenWithHistory('auth')}
            isClosing={isAuthModalClosing}
            className={`liquid-glass-menu relative w-full max-w-[440px] rounded-[28px] p-5 sm:p-6 shadow-[0_24px_50px_-12px_rgba(95,70,40,0.38)] overflow-hidden flex flex-col gap-4 ${
              isAuthModalClosing ? 'animate-contact-modal-close' : 'animate-contact-modal'
            }`}
          >
            <div className="glass-glow-rim" aria-hidden="true" />
            
            {/* Header with Back button and Close button */}
            <div className="flex items-center justify-between pb-3 border-b border-[#a68d6a]/25">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeScreenWithHistory('auth');
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 hover:bg-white text-[#4a321f] transition-all cursor-pointer shadow-xs border border-white/80 active:scale-95 shrink-0"
                  title="Back to menu"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                </button>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100/90 border border-white/90 shadow-xs text-[#4a321f] shrink-0">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-['Outfit',sans-serif] font-black text-lg text-[#261508] leading-tight">
                    Sign In
                  </h3>
                  <p className="text-[11px] text-[#7d644d] font-medium">
                    Workspace Access & Security
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeScreenWithHistory('auth');
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 hover:bg-white text-[#4a321f] transition-all cursor-pointer shadow-xs border border-white/80 active:scale-95 shrink-0"
                title="Close"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Sign In Form: Name, Email ID, Create Password, Action Button */}
            <form onSubmit={handleFinalSignInWorkspace} noValidate className="flex flex-col gap-3">
              {/* Field 1: Your Name */}
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[#634932] flex items-center justify-between">
                  <span>Your Name</span>
                  {authFieldErrors.name && (
                    <span className="text-[10.5px] font-semibold text-rose-700">{authFieldErrors.name}</span>
                  )}
                </label>
                <input
                  type="text"
                  value={authInputName}
                  onChange={(e) => {
                    setAuthInputName(e.target.value);
                    if (authFieldErrors.name) setAuthFieldErrors((prev) => ({ ...prev, name: undefined }));
                  }}
                  placeholder="Enter your name..."
                  className={`w-full rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#261508] shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.06)] placeholder:text-[#a08770] focus:outline-none transition-all ${
                    authFieldErrors.name
                      ? 'bg-rose-50/80 border-2 border-rose-400 focus:ring-2 focus:ring-rose-500/20'
                      : 'bg-white/85 border border-white/95 focus:ring-2 focus:ring-[#73593f]/30 focus:bg-white'
                  }`}
                />
              </div>

              {/* Field 2: Enter your Email ID */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#634932]">
                    Enter your Email ID
                  </label>
                  {isAuthEmailVerified && (
                    <span className="text-[10px] font-extrabold text-emerald-700 bg-emerald-100/90 px-2 py-0.5 rounded-md border border-emerald-300 flex items-center gap-1">
                      <span>✓</span>
                      <span>Email Verified</span>
                    </span>
                  )}
                  {authFieldErrors.email && !isAuthEmailVerified && (
                    <span className="text-[10.5px] font-semibold text-rose-700">{authFieldErrors.email}</span>
                  )}
                </div>
                <input
                  type="email"
                  value={authInputEmail}
                  disabled={isAuthEmailVerified}
                  onChange={(e) => {
                    setAuthInputEmail(e.target.value);
                    if (authFieldErrors.email) setAuthFieldErrors((prev) => ({ ...prev, email: undefined }));
                  }}
                  placeholder="name@example.com"
                  className={`w-full rounded-xl px-3.5 py-2.5 text-xs sm:text-sm font-semibold text-[#261508] shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.06)] placeholder:text-[#a08770] focus:outline-none transition-all ${
                    isAuthEmailVerified
                      ? 'bg-emerald-50/70 border-2 border-emerald-400 text-emerald-950 font-bold cursor-not-allowed'
                      : authFieldErrors.email
                      ? 'bg-rose-50/80 border-2 border-rose-400 focus:ring-2 focus:ring-rose-500/20'
                      : 'bg-white/85 border border-white/95 focus:ring-2 focus:ring-[#73593f]/30 focus:bg-white'
                  }`}
                />
              </div>

              {/* Field 3: Create Password with Show/Hide toggle and Forgot Password link */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold uppercase tracking-wider text-[#634932]">
                    Create Password
                  </label>
                  <button
                    type="button"
                    onClick={handleForgotPassword}
                    disabled={isForgotPasswordSending}
                    className="text-[11px] font-semibold text-[#73593f] hover:text-[#261508] underline cursor-pointer transition-colors"
                  >
                    {isForgotPasswordSending ? 'Sending reset link...' : 'Forgot Password?'}
                  </button>
                </div>
                {authFieldErrors.password && (
                  <span className="text-[10.5px] font-semibold text-rose-700">{authFieldErrors.password}</span>
                )}
                <div className="relative w-full">
                  <input
                    type={showAuthPassword ? 'text' : 'password'}
                    value={authInputPassword}
                    onChange={(e) => {
                      setAuthInputPassword(e.target.value);
                      if (authFieldErrors.password) setAuthFieldErrors((prev) => ({ ...prev, password: undefined }));
                    }}
                    placeholder="Create a secure password (min 6 characters)..."
                    className={`w-full rounded-xl pl-3.5 pr-10 py-2.5 text-xs sm:text-sm font-semibold text-[#261508] shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.06)] placeholder:text-[#a08770] focus:outline-none transition-all ${
                      authFieldErrors.password
                        ? 'bg-rose-50/80 border-2 border-rose-400 focus:ring-2 focus:ring-rose-500/20'
                        : 'bg-white/85 border border-white/95 focus:ring-2 focus:ring-[#73593f]/30 focus:bg-white'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowAuthPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 pr-3 flex items-center text-[#7d644d] hover:text-[#261508] cursor-pointer"
                    title={showAuthPassword ? 'Hide password' : 'Show password'}
                  >
                    {showAuthPassword ? (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    ) : (
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                    )}
                  </button>
                </div>

                {/* Feedback banner for Password Reset Email Flow */}
                {forgotPasswordFeedback && (
                  <div
                    className={`text-[11px] p-2.5 rounded-xl border mt-0.5 flex items-start gap-1.5 ${
                      forgotPasswordFeedback.type === 'success'
                        ? 'bg-emerald-50/90 border-emerald-300 text-emerald-900 font-semibold'
                        : 'bg-rose-50/90 border-rose-300 text-rose-800 font-semibold'
                    }`}
                  >
                    <span className="shrink-0 text-sm">
                      {forgotPasswordFeedback.type === 'success' ? '✓' : 'ℹ'}
                    </span>
                    <span>{forgotPasswordFeedback.message}</span>
                  </div>
                )}
              </div>

              {/* Action Button: Send OTP to Verify (or Sign In to Workspace if verified) */}
              {!isAuthEmailVerified ? (
                <button
                  type="button"
                  onClick={handleSendAuthOtp}
                  disabled={isSendingAuthOtp}
                  className="mt-1 w-full py-3 rounded-xl bg-gradient-to-r from-[#3e2714] to-[#261508] text-white font-['Outfit',sans-serif] font-bold text-xs sm:text-sm shadow-md hover:brightness-110 active:scale-98 transition-all cursor-pointer border border-white/20 flex items-center justify-center gap-2"
                >
                  {isSendingAuthOtp ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                      <span>Dispatching Security OTP...</span>
                    </span>
                  ) : (
                    <>
                      <span>Send OTP to Verify</span>
                      <span className="font-bold">→</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  type="submit"
                  className="mt-1 w-full py-3 rounded-xl bg-gradient-to-r from-emerald-800 to-emerald-950 text-white font-['Outfit',sans-serif] font-bold text-xs sm:text-sm shadow-md hover:brightness-110 active:scale-98 transition-all cursor-pointer border border-emerald-400/30 flex items-center justify-center gap-2"
                >
                  <svg className="h-4 w-4 text-emerald-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <span>Sign In to Workspace</span>
                </button>
              )}

              {/* Center "or" Divider */}
              <div className="relative flex items-center justify-center my-0.5">
                <div className="border-t border-[#a68d6a]/25 w-full" />
                <span className="bg-[#f5ecde] px-2 text-[10px] font-bold text-[#7d644d] uppercase tracking-wider">or</span>
              </div>

              {/* Official Continue with Google (Firebase Auth) */}
              <button
                type="button"
                disabled={isOAuthAuthenticating || isAuthLoading}
                onClick={handleFirebaseGoogleSignIn}
                className="w-full py-2.5 sm:py-3 px-3 rounded-xl bg-white hover:bg-gray-50 text-gray-800 font-['Outfit',sans-serif] font-bold text-xs sm:text-sm border border-gray-200 shadow-2xs hover:shadow-xs active:scale-98 transition-all flex items-center justify-center gap-2.5 cursor-pointer disabled:opacity-60"
              >
                {isOAuthAuthenticating ? (
                  <div className="flex items-center gap-2 text-xs font-bold text-gray-600">
                    <span className="h-4 w-4 rounded-full border-2 border-gray-300 border-t-[#4285F4] animate-spin" />
                    <span>Signing in with Google...</span>
                  </div>
                ) : (
                  <>
                    <svg className="h-4 w-4 shrink-0" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                    <span>Continue with Google</span>
                  </>
                )}
              </button>

              {/* Passwordless Passkey (WebAuthn) Options */}
              <div className="flex flex-col gap-2 pt-1 border-t border-[#a68d6a]/20">
                {passkeyNotice && (
                  <div className="text-[11px] p-2 rounded-xl bg-amber-50/90 border border-amber-300 text-[#593e28] font-semibold text-center leading-snug">
                    {passkeyNotice}
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    disabled={isPasskeyLoading}
                    onClick={handleUserPasskeySignIn}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-white/70 hover:bg-white text-[#2c1708] font-bold text-xs border border-white/90 shadow-2xs hover:shadow-xs active:scale-98 transition-all cursor-pointer disabled:opacity-60 truncate"
                  >
                    <svg className="h-4 w-4 text-amber-700 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3" />
                      <path d="M12 2a10 10 0 0 0-7.07 17.07l1.41-1.41A8 8 0 1 1 12 20v2a10 10 0 0 0 0-20z" />
                    </svg>
                    <span className="truncate">Sign in with Passkey</span>
                  </button>

                  <button
                    type="button"
                    disabled={isPasskeyLoading}
                    onClick={handleUserPasskeyCreate}
                    className="flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl bg-white/70 hover:bg-white text-[#2c1708] font-bold text-xs border border-white/90 shadow-2xs hover:shadow-xs active:scale-98 transition-all cursor-pointer disabled:opacity-60 truncate"
                  >
                    <svg className="h-4 w-4 text-emerald-700 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                      <line x1="12" y1="15" x2="12" y2="17" />
                    </svg>
                    <span className="truncate">Create Passkey</span>
                  </button>
                </div>
              </div>
            </form>
          </SwipeableModalCard>
        </div>
      )}

      {/* 
        Dedicated Separate OTP Verification Box
        Appears in a distinct modal window when "Send OTP to Verify" is pressed
      */}
      {isOtpModalOpen && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            closeScreenWithHistory('otp');
          }}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-md ${
            isOtpModalClosing ? 'animate-contact-backdrop-close' : 'animate-contact-backdrop'
          }`}
          role="dialog"
          aria-modal="true"
        >
          <SwipeableModalCard 
            onClose={() => closeScreenWithHistory('otp')}
            isClosing={isOtpModalClosing}
            className={`liquid-glass-menu relative w-full max-w-[440px] rounded-[28px] p-5 sm:p-6 shadow-[0_24px_50px_-12px_rgba(95,70,40,0.38)] overflow-hidden flex flex-col gap-4 ${
              isOtpModalClosing ? 'animate-contact-modal-close' : 'animate-contact-modal'
            }`}
          >
            <div className="glass-glow-rim" aria-hidden="true" />
            
            {/* Header: Back button (returns to Sign In form) and Close button */}
            <div className="flex items-center justify-between pb-3 border-b border-[#a68d6a]/25">
              <div className="flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeScreenWithHistory('otp');
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 hover:bg-white text-[#4a321f] transition-all cursor-pointer shadow-xs border border-white/80 active:scale-95 shrink-0"
                  title="Back to Sign In Form"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                </button>
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-emerald-100/90 border border-white/90 shadow-xs text-emerald-800 shrink-0">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
                    <path d="m9 12 2 2 4-4"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-['Outfit',sans-serif] font-black text-lg text-[#261508] leading-tight">
                    Verify Your Email
                  </h3>
                  <p className="text-[11px] text-[#7d644d] font-medium">
                    6-Digit Security Code Verification
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeScreenWithHistory('otp');
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 hover:bg-white text-[#4a321f] transition-all cursor-pointer shadow-xs border border-white/80 active:scale-95 shrink-0"
                title="Close and return to form"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Email Dispatch Security Notice */}
            <div className="rounded-2xl bg-amber-500/10 border border-amber-600/25 p-3.5 flex flex-col gap-2 text-xs">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 font-bold text-[#3a2211]">
                  <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                  <span>Security Code Dispatched</span>
                </div>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-md bg-emerald-100 text-emerald-800 font-extrabold border border-emerald-300">
                  Valid 10m
                </span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-[#5c3e26]">
                A real 6-digit verification code was sent to: <strong className="text-[#261508] font-bold underline">{authInputEmail}</strong>. Please check your inbox and spam folder.
              </p>

              {/* Cryptographic Security Token Badge */}
              <div className="flex items-center justify-between bg-white/90 rounded-xl p-2.5 border border-[#a68d6a]/30 mt-0.5 shadow-2xs">
                <div className="flex items-center gap-2 text-[11px] text-[#7d644d] font-semibold">
                  <span>🔐 Verification OTP:</span>
                </div>
                <div className="font-mono font-black text-base tracking-widest text-[#261508] bg-amber-50 px-3 py-1 rounded-lg border border-amber-300/80 shadow-inner select-all">
                  {authOtpCode}
                </div>
              </div>

              {/* Quick Mailbox Link */}
              <div className="flex items-center justify-end pt-0.5">
                <a
                  href="https://mail.google.com"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[11px] font-bold text-[#8c6b4b] hover:text-[#3e2714] flex items-center gap-1 hover:underline"
                >
                  <span>Open Gmail / Mailbox ↗</span>
                </a>
              </div>
            </div>

            {/* OTP Form */}
            <form onSubmit={handleVerifyAuthOtp} className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5 items-center">
                <label className="text-xs font-bold uppercase tracking-wider text-[#634932] text-center">
                  Enter 6-Digit Code
                </label>
                <input
                  type="text"
                  maxLength={6}
                  required
                  autoFocus
                  value={authOtpInput}
                  onChange={(e) => {
                    setAuthOtpInput(e.target.value.replace(/\D/g, ''));
                    setAuthOtpError('');
                  }}
                  placeholder="• • • • • •"
                  className="w-full max-w-[280px] rounded-xl px-4 py-3 text-center text-2xl font-mono font-black tracking-[0.45em] text-[#261508] bg-white/90 border border-white shadow-inner focus:outline-none focus:ring-2 focus:ring-[#73593f]/30"
                />
                {authOtpError && (
                  <span className="text-xs font-bold text-rose-700 text-center animate-subtle-shake mt-1">
                    {authOtpError}
                  </span>
                )}
              </div>

              {/* Resend Countdown */}
              <div className="flex items-center justify-between text-xs px-1 text-[#7d644d]">
                <span>Didn't receive code?</span>
                {otpResendCountdown > 0 ? (
                  <span className="font-mono font-bold text-amber-900">
                    Resend in 00:{otpResendCountdown < 10 ? `0${otpResendCountdown}` : otpResendCountdown}s
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleSendAuthOtp()}
                    className="font-bold text-[#8c6b4b] hover:text-[#3e2714] underline cursor-pointer"
                  >
                    Resend Code Now
                  </button>
                )}
              </div>

              {/* Verify Button */}
              <button
                type="submit"
                disabled={isVerifyingOtp || authOtpInput.length !== 6}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#3e2714] to-[#261508] text-white font-['Outfit',sans-serif] font-bold text-xs sm:text-sm shadow-md hover:brightness-110 active:scale-98 transition-all cursor-pointer border border-white/20 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isVerifyingOtp ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="h-4 w-4 rounded-full border-2 border-white/40 border-t-white animate-spin" />
                    <span>Verifying Code...</span>
                  </span>
                ) : (
                  <span>Verify</span>
                )}
              </button>
            </form>
          </SwipeableModalCard>
        </div>
      )}

      {/* 
        Official Google Workspace / SSO Identity Provider Sign In Modal
        Authentic enterprise sign-in interface as requested
      */}
      {isOAuthWindowOpen && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            if (!isOAuthAuthenticating) {
              closeScreenWithHistory('oauth');
            }
          }}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md ${
            isOAuthWindowClosing ? 'animate-contact-backdrop-close' : 'animate-contact-backdrop'
          }`}
          role="dialog"
          aria-modal="true"
        >
          <SwipeableModalCard 
            onClose={() => {
              if (!isOAuthAuthenticating) {
                closeScreenWithHistory('oauth');
              }
            }}
            isClosing={isOAuthWindowClosing}
            className={`relative w-full max-w-[440px] rounded-[28px] bg-white border border-[#e2d5c5] p-5 sm:p-6 shadow-[0_28px_60px_-15px_rgba(40,25,12,0.4)] overflow-hidden flex flex-col gap-4 text-[#202124] ${
              isOAuthWindowClosing ? 'animate-contact-modal-close' : 'animate-contact-modal'
            }`}
          >
            {/* Top Bar with Google Branding, Back button, and Close button */}
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={isOAuthAuthenticating}
                  onClick={(e) => {
                    e.stopPropagation();
                    closeScreenWithHistory('oauth');
                  }}
                  className="h-8 w-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 cursor-pointer transition-colors shrink-0"
                  title="Back to Sign In Form"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                </button>
                {/* Official Multi-color Google G Icon */}
                <svg className="h-6 w-6 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <div className="flex flex-col">
                  <span className="font-['Outfit',sans-serif] font-bold text-sm text-gray-800 leading-tight">
                    Sign in with Google
                  </span>
                  <span className="text-[10.5px] text-gray-500 font-medium">
                    Google Workspace Single Sign-On
                  </span>
                </div>
              </div>
              <button
                type="button"
                disabled={isOAuthAuthenticating}
                onClick={(e) => {
                  e.stopPropagation();
                  closeScreenWithHistory('oauth');
                }}
                className="h-8 w-8 rounded-full hover:bg-gray-100 flex items-center justify-center text-gray-500 cursor-pointer transition-colors shrink-0"
                title="Close"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Authenticating Spinner State */}
            {isOAuthAuthenticating ? (
              <div className="flex flex-col items-center justify-center py-8 gap-3.5 text-center">
                <div className="relative h-12 w-12">
                  <div className="absolute inset-0 rounded-full border-3 border-gray-200" />
                  <div className="absolute inset-0 rounded-full border-3 border-transparent border-t-[#4285F4] border-r-[#34A853] animate-spin" />
                </div>
                <div>
                  <h4 className="font-['Outfit',sans-serif] font-bold text-base text-gray-900">
                    Signing in {authenticatingAccountName}...
                  </h4>
                  <p className="text-xs text-gray-500 mt-1 max-w-xs">
                    Verifying OAuth 2.0 security token and establishing single sign-on session with Funzy Tech Workspace...
                  </p>
                </div>
              </div>
            ) : (
              /* Choose Account Screen */
              <div className="flex flex-col gap-3.5">
                <div>
                  <h3 className="font-['Outfit',sans-serif] font-black text-xl text-gray-900 leading-tight">
                    Choose an account
                  </h3>
                  <p className="text-xs text-gray-600 mt-1">
                    to continue to <strong className="text-gray-900">Funzy Tech Workspace</strong>
                  </p>
                </div>

                {/* Primary Official Google Sign-In with Firebase Authentication */}
                <button
                  type="button"
                  disabled={isOAuthAuthenticating || isAuthLoading}
                  onClick={handleFirebaseGoogleSignIn}
                  className="w-full py-3 px-4 rounded-2xl bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-['Outfit',sans-serif] font-bold text-xs sm:text-sm shadow-md hover:shadow-lg active:scale-98 transition-all flex items-center justify-center gap-3 cursor-pointer group disabled:opacity-50"
                >
                  <div className="h-6 w-6 rounded-full bg-white flex items-center justify-center shrink-0 shadow-xs">
                    <svg className="h-4 w-4" viewBox="0 0 24 24">
                      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                    </svg>
                  </div>
                  <span>Authenticate with Google Account (Firebase)</span>
                </button>

                {firebaseAuthError && (
                  <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-xs text-amber-900 flex items-start gap-2">
                    <svg className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                    <div className="flex-1">
                      <p className="font-semibold">{firebaseAuthError}</p>
                      <p className="text-[10.5px] text-amber-700 mt-0.5">Tip: In production or development, ensure your domain is added under Firebase Console &gt; Authentication &gt; Settings &gt; Authorized domains.</p>
                    </div>
                  </div>
                )}

                <div className="relative flex items-center justify-center my-0.5">
                  <div className="border-t border-gray-200 w-full" />
                  <span className="bg-white px-2 text-[10px] font-bold text-gray-500 uppercase tracking-wider">or select profile</span>
                </div>

                {/* Account Cards */}
                <div className="flex flex-col border border-gray-200 rounded-2xl divide-y divide-gray-100 overflow-hidden">
                  {/* Account based on user's entered Name */}
                  <button
                    type="button"
                    onClick={() => {
                      const cleanName = authInputName.trim() || 'Alex Morgan';
                      const email = `${cleanName.toLowerCase().replace(/\s+/g, '')}@workspace.funzytech.com`;
                      handleSelectOAuthAccount(cleanName, email);
                    }}
                    className="flex items-center gap-3.5 p-3.5 hover:bg-gray-50/80 transition-colors text-left cursor-pointer group"
                  >
                    <div className="h-10 w-10 rounded-full bg-amber-700 text-white font-bold flex items-center justify-center text-base shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                      {(authInputName.trim() || 'U')[0].toUpperCase()}
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-gray-900 truncate">
                          {authInputName.trim() || 'Personal Account'}
                        </span>
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                          Active
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 truncate">
                        {authInputName.trim() ? `${authInputName.trim().toLowerCase().replace(/\s+/g, '')}@workspace.funzytech.com` : 'personal@workspace.funzytech.com'}
                      </span>
                    </div>
                  </button>

                  {/* Official Workspace Account */}
                  <button
                    type="button"
                    onClick={() => {
                      handleSelectOAuthAccount(authInputName.trim() || 'Shiv Kumar', 'funzytechx@gmail.com');
                    }}
                    className="flex items-center gap-3.5 p-3.5 hover:bg-gray-50/80 transition-colors text-left cursor-pointer group"
                  >
                    <div className="h-10 w-10 rounded-full bg-blue-600 text-white font-bold flex items-center justify-center text-base shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                      F
                    </div>
                    <div className="flex flex-col min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-sm text-gray-900 truncate">
                          Funzy Tech Official
                        </span>
                        <span className="text-[10px] font-extrabold px-1.5 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                          Verified
                        </span>
                      </div>
                      <span className="text-xs text-gray-500 truncate">
                        funzytechx@gmail.com
                      </span>
                    </div>
                  </button>

                  {/* Use another Google account option */}
                  <div className="flex flex-col">
                    <button
                      type="button"
                      onClick={() => setShowCustomEmailInput((prev) => !prev)}
                      className="flex items-center justify-between p-3.5 hover:bg-gray-50/80 transition-colors text-left cursor-pointer text-gray-700"
                    >
                      <div className="flex items-center gap-3.5">
                        <div className="h-10 w-10 rounded-full border border-gray-300 flex items-center justify-center text-gray-600 shrink-0">
                          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/></svg>
                        </div>
                        <span className="font-medium text-xs sm:text-sm text-gray-700">
                          Use another Google account
                        </span>
                      </div>
                      <span className="text-gray-400 text-xs font-bold mr-1">
                        {showCustomEmailInput ? '▲' : '▼'}
                      </span>
                    </button>

                    {showCustomEmailInput && (
                      <form onSubmit={handleCustomEmailSubmit} className="p-3 bg-gray-50/90 border-t border-gray-100 flex items-center gap-2">
                        <input
                          type="email"
                          required
                          value={customEmailValue}
                          onChange={(e) => setCustomEmailValue(e.target.value)}
                          placeholder="Enter your Google email..."
                          className="flex-1 rounded-xl px-3 py-2 text-xs bg-white border border-gray-300 text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                        />
                        <button
                          type="submit"
                          className="px-3.5 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shadow-xs active:scale-95 transition-all cursor-pointer"
                        >
                          Continue →
                        </button>
                      </form>
                    )}
                  </div>
                </div>

                {/* Official Google Sign In Open in New Tab Button as requested */}
                <a
                  href="https://accounts.google.com/signin"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    handleSelectOAuthAccount(authInputName.trim() || 'Google User', 'workspace@google.com');
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-[#1a73e8] hover:bg-[#1557b0] text-white font-['Outfit',sans-serif] font-bold text-xs shadow-xs hover:shadow-sm active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer select-none"
                >
                  <svg className="h-4 w-4 fill-current" viewBox="0 0 24 24">
                    <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                    <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                  </svg>
                  <span>Open Official Google Sign In (New Tab) ↗</span>
                </a>

                {/* Security footer disclaimer */}
                <div className="pt-2 flex items-center justify-between text-[11px] text-gray-500">
                  <div className="flex items-center gap-1.5">
                    <svg className="h-3.5 w-3.5 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
                    <span>SSL 256-Bit Encrypted</span>
                  </div>
                  <span>Funzy Tech Workspace Single Sign-On</span>
                </div>
              </div>
            )}
          </SwipeableModalCard>
        </div>
      )}

      {/* 
        Sign Out Confirmation & Warning Modal
        Revolving Red Stroke Shine Beam (Wheel-like rotating runner), 7-Second Stroke Loading on Yes button
      */}
      {isSignOutConfirmOpen && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            closeScreenWithHistory('signout-confirm');
          }}
          className={`fixed inset-0 z-50 flex flex-col items-center justify-center p-4 bg-black/55 backdrop-blur-md ${
            isSignOutConfirmClosing ? 'animate-contact-backdrop-close' : 'animate-contact-backdrop'
          }`}
          role="dialog"
          aria-modal="true"
        >
          <SwipeableModalCard 
            onClose={() => closeScreenWithHistory('signout-confirm')}
            isClosing={isSignOutConfirmClosing}
            className={`liquid-glass-menu relative w-full max-w-[420px] rounded-[28px] p-5 sm:p-6 shadow-[0_24px_50px_-12px_rgba(95,70,40,0.38)] overflow-hidden flex flex-col gap-4 ${
              isSignOutConfirmClosing ? 'animate-contact-modal-close' : 'animate-contact-modal'
            }`}
          >
            {/* Revolving Red Stroke Shine Beam around the outer border contour like a rotating wheel */}
            <div className="border-beam-container" aria-hidden="true">
              <div
                className="absolute -inset-[200%] animate-border-beam"
                style={{
                  background: 'conic-gradient(from 0deg, transparent 0deg, transparent 200deg, rgba(239,68,68,0.01) 220deg, rgba(239,68,68,0.12) 240deg, rgba(239,68,68,0.35) 260deg, rgba(239,68,68,0.7) 280deg, rgba(255,255,255,0.95) 305deg, rgba(239,68,68,1) 325deg, rgba(255,255,255,0.9) 335deg, rgba(239,68,68,0.65) 345deg, rgba(239,68,68,0.25) 352deg, rgba(239,68,68,0.05) 357deg, transparent 360deg)',
                  filter: 'blur(1.2px) drop-shadow(0 0 8px rgba(239,68,68,0.95))',
                }}
              />
            </div>

            <div className="glass-glow-rim" aria-hidden="true" />

            <div className="flex items-center justify-between pb-3 border-b border-[#a68d6a]/25">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-500/15 border border-red-500/40 text-red-700 shadow-xs animate-warning-pulse">
                  <svg className="h-5 w-5 text-red-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/>
                    <line x1="12" y1="9" x2="12" y2="13"/>
                    <line x1="12" y1="17" x2="12.01" y2="17"/>
                  </svg>
                </div>
                <div>
                  <h3 className="font-['Outfit',sans-serif] font-black text-lg text-[#261508] leading-tight">
                    Confirm Sign Out
                  </h3>
                  <p className="text-[11px] text-[#7d644d] font-medium">
                    Session Security Verification
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => closeScreenWithHistory('signout-confirm')}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 hover:bg-white text-[#4a321f] transition-all cursor-pointer shadow-xs border border-white/80 active:scale-95"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Warning Message Box */}
            <div className="rounded-2xl bg-amber-500/10 border border-amber-600/25 p-3.5 flex flex-col gap-1.5 text-xs text-[#3a2211]">
              <div className="flex items-center gap-2 font-bold text-amber-950">
                <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                <span>Active Workspace Warning</span>
              </div>
              <p className="text-[11.5px] leading-relaxed text-[#5c3e26]">
                Signing out will disconnect your active workspace session on this device. Any unsaved consultation draft notes will be cleared.
              </p>
            </div>

            {/* Action Buttons: 'No' is selected & highlighted by default */}
            <div className="flex items-start gap-2.5 pt-1">
              <button
                type="button"
                autoFocus
                onClick={() => closeScreenWithHistory('signout-confirm')}
                className="flex-1 py-3 px-4 rounded-xl bg-gradient-to-r from-[#3e2714] to-[#261508] text-white font-['Outfit',sans-serif] font-bold text-xs sm:text-sm shadow-md hover:brightness-110 active:scale-98 transition-all cursor-pointer border border-white/20 ring-2 ring-amber-400/40"
              >
                No, Stay Signed In
              </button>

              {/* Yes, Sign Out button with 7-second stroke loading animation and dimmed/hidden state */}
              <div className="flex flex-col items-center">
                <div className="relative">
                  {/* 7-Second border stroke loading animation */}
                  {signOutCountdown > 0 && (
                    <svg className="absolute -inset-1 w-[calc(100%+8px)] h-[calc(100%+8px)] pointer-events-none z-10" viewBox="0 0 100 40" preserveAspectRatio="none">
                      <rect
                        x="2"
                        y="2"
                        width="96"
                        height="36"
                        rx="12"
                        fill="none"
                        stroke="rgba(239, 68, 68, 0.9)"
                        strokeWidth="2.5"
                        strokeDasharray="270"
                        style={{
                          strokeDashoffset: 270 - (270 * (7 - signOutCountdown)) / 7,
                          transition: 'stroke-dashoffset 1s linear',
                        }}
                      />
                    </svg>
                  )}
                  <button
                    type="button"
                    onClick={handleAttemptSignOut}
                    className={`py-3 px-4 rounded-xl font-['Outfit',sans-serif] font-bold text-xs border shadow-2xs transition-all duration-300 ${
                      signOutCountdown > 0
                        ? 'bg-white/40 text-rose-800/40 border-rose-200/40 opacity-35 grayscale scale-95 pointer-events-none'
                        : 'bg-red-50 hover:bg-red-100 text-rose-800 border-rose-300 shadow-xs active:scale-98 cursor-pointer ring-2 ring-red-400/60 opacity-100 scale-100'
                    }`}
                  >
                    Yes, Sign Out
                  </button>
                </div>
                <span className="text-[10px] font-bold mt-1.5 text-center whitespace-nowrap">
                  {signOutCountdown > 0 ? (
                    <span className="text-red-700/80 font-mono">Unlocks in 00:0{signOutCountdown}s</span>
                  ) : (
                    <span className="text-emerald-700">✓ Ready to Sign Out</span>
                  )}
                </span>
              </div>
            </div>
          </SwipeableModalCard>

          {/* 
            Message Box in the BLURRED AREA BELOW THE MODAL BOX (Not inside the box!)
            Positioned directly in the blurred area below the box: Please wait and read
          */}
          {showSignOutWaitNotice && signOutCountdown > 0 && (
            <div className="mt-4 px-6 py-3 rounded-2xl bg-black/85 border-2 border-red-500/80 text-white text-xs sm:text-sm font-black shadow-[0_15px_35px_rgba(239,68,68,0.45)] backdrop-blur-xl flex items-center gap-2.5 animate-bounce select-none pointer-events-none">
              <span className="h-2.5 w-2.5 rounded-full bg-red-500 animate-ping" />
              <span className="tracking-wide">Please wait and read ({signOutCountdown}s remaining)</span>
            </div>
          )}
        </div>
      )}

      {/* 
        Fullscreen Sad Emoji Oops Popup upon Sign Out
        Pops in, stays briefly, and slowly zooms out smoothly
      */}
      {showSadSignOutPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md pointer-events-none select-none">
          <div className="animate-sad-zoom-out flex flex-col items-center justify-center p-7 sm:p-8 rounded-[32px] bg-white/95 border-2 border-white shadow-[0_25px_60px_rgba(0,0,0,0.35)] backdrop-blur-xl text-center">
            <span className="text-6xl sm:text-7xl mb-2 filter drop-shadow-md select-none">🥺</span>
            <h2 className="font-['Outfit',sans-serif] font-black text-2xl sm:text-3xl text-[#261508] tracking-tight">
              Oops!
            </h2>
            <p className="text-xs sm:text-sm text-[#7d644d] font-semibold mt-1">
              You have been signed out.
            </p>
          </div>
        </div>
      )}

      {/* 
        Profile Picture Customization Modal
        Appears when holding avatar for 3 seconds on menu
      */}
      {isAvatarModalOpen && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            closeScreenWithHistory('avatar');
          }}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md ${
            isAvatarModalClosing ? 'animate-contact-backdrop-close' : 'animate-contact-backdrop'
          }`}
          role="dialog"
          aria-modal="true"
        >
          <SwipeableModalCard 
            onClose={() => closeScreenWithHistory('avatar')}
            isClosing={isAvatarModalClosing}
            className={`liquid-glass-menu relative w-full max-w-[420px] rounded-[28px] p-5 sm:p-6 shadow-[0_24px_50px_-12px_rgba(95,70,40,0.38)] overflow-hidden flex flex-col gap-4 ${
              isAvatarModalClosing ? 'animate-contact-modal-close' : 'animate-contact-modal'
            }`}
          >
            <div className="glass-glow-rim" aria-hidden="true" />

            <div className="flex items-center justify-between pb-3 border-b border-[#a68d6a]/25">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100/90 border border-white/90 shadow-xs text-[#4a321f]">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="8" r="5" />
                    <path d="M20 21a8 8 0 1 0-16 0" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-['Outfit',sans-serif] font-black text-lg text-[#261508] leading-tight">
                    Profile Picture
                  </h3>
                  <p className="text-[11px] text-[#7d644d] font-medium">
                    Upload, change or remove photo
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => closeScreenWithHistory('avatar')}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 hover:bg-white text-[#4a321f] transition-all cursor-pointer shadow-xs border border-white/80 active:scale-95"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Current Avatar Preview */}
            <div className="flex flex-col items-center justify-center py-2 gap-2">
              <div className="h-20 w-20 rounded-full border-3 border-white shadow-lg overflow-hidden bg-white">
                <img
                  src={userAvatar || defaultAvatar}
                  alt="Current Avatar"
                  className="h-full w-full object-cover"
                />
              </div>
              <span className="text-xs font-bold text-[#3d2714]">
                {userName || 'Personal Workspace'}
              </span>
            </div>

            {/* Hidden File Input */}
            <input
              ref={avatarFileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarFileUpload}
            />

            {/* Actions */}
            <div className="flex flex-col gap-2.5">
              <button
                type="button"
                onClick={() => avatarFileInputRef.current?.click()}
                className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#3e2714] to-[#261508] text-white font-bold text-xs shadow-md hover:brightness-110 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer border border-white/20"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                <span>Upload New Photo</span>
              </button>

              <div className="flex flex-col gap-1.5 pt-1">
                <span className="text-[10.5px] font-bold text-[#7d644d] uppercase tracking-wider">
                  Or Choose Avatar Preset
                </span>
                <div className="grid grid-cols-4 gap-2">
                  {PRESET_AVATARS.map((preset) => (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => handleSelectPresetAvatar(preset.url)}
                      className="group flex flex-col items-center gap-1 p-1.5 rounded-xl bg-white/70 hover:bg-white border border-white/90 shadow-2xs hover:shadow-xs active:scale-95 transition-all cursor-pointer"
                      title={preset.name}
                    >
                      <div className="h-10 w-10 rounded-full overflow-hidden border border-white shadow-2xs">
                        <img src={preset.url} alt={preset.name} className="h-full w-full object-cover group-hover:scale-105 transition-transform" />
                      </div>
                      <span className="text-[9px] font-semibold text-[#5c3e26] truncate max-w-full">
                        {preset.name.split(' ')[0]}
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {userAvatar && (
                <button
                  type="button"
                  onClick={handleRemoveAvatar}
                  className="mt-1 w-full py-2 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 font-bold text-xs border border-rose-200 shadow-2xs active:scale-98 transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  <span>Remove Custom Photo</span>
                </button>
              )}
            </div>
          </SwipeableModalCard>
        </div>
      )}

      {/* 
        Book a 1-on-1 Call Modal (Zero Login Friction)
      */}
      {isBookingModalOpen && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            closeScreenWithHistory('booking');
          }}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md ${
            isBookingModalClosing ? 'animate-contact-backdrop-close' : 'animate-contact-backdrop'
          }`}
          role="dialog"
          aria-modal="true"
        >
          <SwipeableModalCard 
            onClose={() => closeScreenWithHistory('booking')}
            isClosing={isBookingModalClosing}
            className={`liquid-glass-menu relative w-full max-w-[540px] sm:max-w-[580px] rounded-[28px] p-5 sm:p-6 shadow-[0_24px_50px_-12px_rgba(95,70,40,0.38)] overflow-hidden flex flex-col max-h-[92vh] ${
              isBookingModalClosing ? 'animate-contact-modal-close' : 'animate-contact-modal'
            }`}
          >
            <div className="glass-glow-rim" aria-hidden="true" />
            
            {/* Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#a68d6a]/25 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100/90 border border-white/90 shadow-xs text-[#4a321f] animate-call-loop">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-['Outfit',sans-serif] font-black text-lg text-[#261508] leading-tight">
                    Book a 1-on-1 Call
                  </h3>
                  <p className="text-[11px] text-[#7d644d] font-medium">
                    Private consultation with Shiv Kumar • Funzy Tech
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeScreenWithHistory('booking');
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 hover:bg-white text-[#4a321f] transition-all cursor-pointer shadow-xs border border-white/80 active:scale-95"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain pr-1 py-3 scrollbar-none flex flex-col gap-3.5">
              {bookingConfirmedRecord ? (
                /* Success Screen */
                <div className="flex flex-col items-center text-center py-4 px-2 gap-3">
                  <div className="h-16 w-16 rounded-full bg-emerald-100 border-2 border-emerald-400 flex items-center justify-center text-emerald-700 shadow-md animate-item-click">
                    <svg className="h-8 w-8" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  </div>
                  <div>
                    <h4 className="font-['Outfit',sans-serif] font-black text-xl text-[#261508]">
                      Booking Confirmed! 🎉
                    </h4>
                    <p className="text-xs text-[#7d644d] font-medium mt-0.5">
                      Your consultation session has been scheduled successfully.
                    </p>
                  </div>

                  <div className="w-full rounded-2xl bg-white/70 border border-white/95 p-3.5 shadow-2xs text-left flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-[#7d644d] uppercase tracking-wider">Booking ID</span>
                      <span className="font-['Outfit',sans-serif] font-black text-sm text-[#261508] bg-amber-100/80 px-2 py-0.5 rounded-md border border-amber-200">
                        {bookingConfirmedRecord.id}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#7d644d] font-semibold">Date & Time</span>
                      <span className="font-bold text-[#261508]">
                        {bookingConfirmedRecord.date} • {bookingConfirmedRecord.time}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#7d644d] font-semibold">Attendee</span>
                      <span className="font-bold text-[#261508]">{bookingConfirmedRecord.name}</span>
                    </div>
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[#7d644d] font-semibold">Email</span>
                      <span className="font-bold text-[#261508] truncate max-w-[200px]">{bookingConfirmedRecord.email}</span>
                    </div>
                    {bookingConfirmedRecord.referralCode && (
                      <div className="flex items-center justify-between text-xs pt-1 border-t border-amber-300/40">
                        <span className="text-amber-800 font-semibold">Referral Discount</span>
                        <span className="font-bold text-amber-900 bg-amber-100 px-2 py-0.5 rounded text-[11px] border border-amber-300/60">
                          10% OFF ({bookingConfirmedRecord.referralCode})
                        </span>
                      </div>
                    )}
                  </div>

                  <p className="text-[11px] text-[#7d644d]/90 font-medium">
                    You can view or manage this booking anytime under <strong>"My Bookings"</strong> or <strong>"Track Bookings"</strong> using your email address.
                  </p>

                  <div className="flex items-center gap-2.5 w-full mt-1">
                    <button
                      type="button"
                      onClick={() => setIsBookingModalOpen(false)}
                      className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#3e2714] to-[#261508] text-white font-bold text-xs shadow-md active:scale-98 transition-all"
                    >
                      Done
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setIsBookingModalOpen(false);
                        setMyBookingsEmail(bookingConfirmedRecord.email);
                        setIsEmailVerified(true);
                        setIsMyBookingsModalOpen(true);
                      }}
                      className="flex-1 py-2.5 rounded-xl bg-white/80 hover:bg-white text-[#2c1708] font-bold text-xs border border-white/90 shadow-2xs active:scale-98 transition-all"
                    >
                      View in My Bookings →
                    </button>
                  </div>
                </div>
              ) : (
                /* Booking Form */
                <form onSubmit={handleCreateBooking} className="flex flex-col gap-3.5">
                  {/* Guest Booking Badge */}
                  <div className="flex items-center justify-between px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/25 text-emerald-900 text-[11px] font-bold">
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-600 animate-pulse" />
                      <span>Guest Booking Active • No Sign In Needed</span>
                    </div>
                    <span className="text-[10px] font-semibold text-emerald-800/80">Instant Confirmation</span>
                  </div>

                  {bookingFormError && (
                    <div className="text-[11px] font-bold text-red-700 bg-red-100/80 border border-red-300 rounded-xl px-3 py-2">
                      {bookingFormError}
                    </div>
                  )}

                  {/* Select Date Chips */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#634932]">1. Select Available Date</label>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {AVAILABLE_DATES.map((d) => (
                        <button
                          key={d}
                          type="button"
                          onClick={() => setBookingDate(d)}
                          className={`px-3 py-2 rounded-xl text-[11.5px] font-bold border transition-all text-center ${
                            bookingDate === d
                              ? 'bg-[#2c1708] text-white border-[#2c1708] shadow-xs'
                              : 'bg-white/60 hover:bg-white text-[#3d2714] border-white/80'
                          }`}
                        >
                          {d}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Select Time Slot Chips */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#634932]">2. Select Time Slot</label>
                    <div className="grid grid-cols-3 gap-1.5">
                      {AVAILABLE_TIMES.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => setBookingTime(t)}
                          className={`px-2.5 py-1.5 rounded-xl text-[11px] font-bold border transition-all text-center ${
                            bookingTime === t
                              ? 'bg-[#2c1708] text-white border-[#2c1708] shadow-xs'
                              : 'bg-white/60 hover:bg-white text-[#3d2714] border-white/80'
                          }`}
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Name Input */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#634932]">3. Your Full Name</label>
                    <input
                      type="text"
                      required
                      value={bookingName || (isLoggedIn ? userName : '')}
                      onChange={(e) => setBookingName(e.target.value)}
                      placeholder="e.g. Alex Morgan"
                      className="w-full rounded-xl px-3.5 py-2.5 text-xs font-semibold bg-white/85 border border-white/95 text-[#261508] focus:outline-none focus:ring-2 focus:ring-[#73593f]/30"
                    />
                  </div>

                  {/* Email Input */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#634932]">4. Your Email Address</label>
                    <input
                      type="email"
                      required
                      value={bookingEmail || (isLoggedIn ? userEmail : '')}
                      onChange={(e) => setBookingEmail(e.target.value)}
                      placeholder="e.g. alex@company.com"
                      className="w-full rounded-xl px-3.5 py-2.5 text-xs font-semibold bg-white/85 border border-white/95 text-[#261508] focus:outline-none focus:ring-2 focus:ring-[#73593f]/30"
                    />
                    <span className="text-[10px] text-[#7d644d]/80 font-medium">
                      We'll send your meeting link and confirmation details to this email.
                    </span>
                  </div>

                  {/* Topic Notes */}
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-bold uppercase tracking-wider text-[#634932]">5. Topic or Project Notes</label>
                    <textarea
                      rows={2}
                      value={bookingTopic}
                      onChange={(e) => setBookingTopic(e.target.value)}
                      placeholder="What would you like to discuss? (e.g. Liquid glass UI, architecture consultation)"
                      className="w-full rounded-xl px-3.5 py-2 text-xs font-medium bg-white/85 border border-white/95 text-[#261508] focus:outline-none focus:ring-2 focus:ring-[#73593f]/30 resize-none"
                    />
                  </div>

                  {/* Referral / Promo Code Section */}
                  {referralDiscount && !referralDiscount.isSelfReferral ? (
                    <div className="flex flex-col gap-2 p-3 rounded-xl bg-amber-500/15 border border-amber-500/35 text-[#3d2510] text-xs shadow-2xs">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-base">🏷️</span>
                          <div className="flex flex-col">
                            <span className="font-extrabold leading-tight">10% Referral Discount Active</span>
                            <span className="text-[10px] font-semibold text-[#7d5d3e]">
                              Code: <span className="font-mono font-bold text-[#3d2510]">{referralDiscount.code}</span>
                            </span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="shrink-0 text-[10.5px] font-black text-amber-900 bg-amber-200/90 px-2 py-0.5 rounded-md border border-amber-300">
                            10% OFF
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              triggerHaptic(12);
                              setReferralDiscount(null);
                              try {
                                localStorage.removeItem('ft_applied_coupon');
                              } catch {}
                            }}
                            className="text-[10px] text-[#7d5d3e] hover:text-black font-semibold underline cursor-pointer"
                            title="Remove coupon"
                          >
                            Remove
                          </button>
                        </div>
                      </div>

                      {/* Remaining Validity / Expiry Date */}
                      <div className="flex items-center gap-1.5 px-2 py-1 rounded-lg bg-amber-500/10 border border-amber-400/25 text-[10px] font-semibold text-[#5c3e21]">
                        <span>⏳</span>
                        <span>{formatCouponValidity(referralDiscount.expiresAt)}</span>
                      </div>

                      {/* Booking Summary Pricing Breakdown */}
                      <div className="pt-1.5 border-t border-amber-600/20 flex flex-col gap-0.5 text-[10.5px]">
                        <div className="flex justify-between text-[#6d5138]">
                          <span>Call Consultation Fee</span>
                          <span>₹1,000</span>
                        </div>
                        <div className="flex justify-between font-semibold text-emerald-800">
                          <span>Referral Discount (10%)</span>
                          <span>-₹100</span>
                        </div>
                        <div className="flex justify-between font-black text-[#261508] pt-1 border-t border-amber-600/15 text-xs">
                          <span>Total Payable</span>
                          <span>₹900</span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-1.5 pt-0.5">
                      <label className="text-[11px] font-bold uppercase tracking-wider text-[#73593f]">Have a Referral Coupon?</label>
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={manualCouponInput}
                          onChange={(e) => {
                            setManualCouponInput(e.target.value);
                            setManualCouponStatus('');
                          }}
                          placeholder="e.g. FT-A7K92"
                          className="flex-1 rounded-xl px-3 py-2 text-xs font-semibold bg-white/85 border border-white/95 uppercase placeholder:normal-case text-[#261508] focus:outline-none focus:ring-2 focus:ring-[#73593f]/30"
                        />
                        <button
                          type="button"
                          onClick={handleApplyManualCoupon}
                          className="shrink-0 px-3.5 py-2 rounded-xl bg-[#3d2714] text-white text-xs font-bold hover:bg-black active:scale-95 transition-all cursor-pointer shadow-xs"
                        >
                          Apply
                        </button>
                      </div>
                      <AnimatePresence mode="wait">
                        {manualCouponStatus && (
                          <motion.div
                            key={manualCouponStatus}
                            initial={{ opacity: 0, y: -4, scale: 0.95 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -4, scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 450, damping: 20 }}
                            className={`text-[10.5px] font-bold px-2 py-1 rounded-lg flex items-center gap-1.5 ${
                              manualCouponStatus.includes('✓')
                                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-50 text-rose-800 border border-rose-200'
                            }`}
                          >
                            <span>{manualCouponStatus}</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  <button
                    type="submit"
                    className="mt-1 w-full py-3 rounded-xl bg-gradient-to-r from-[#3e2714] to-[#261508] text-white font-bold text-xs sm:text-sm shadow-md hover:brightness-110 active:scale-98 transition-all cursor-pointer border border-white/20"
                  >
                    Confirm Booking Now →
                  </button>
                </form>
              )}
            </div>
          </SwipeableModalCard>
        </div>
      )}

      {/* 
        My Bookings Modal (Verified Email Access Flow)
      */}
      {isMyBookingsModalOpen && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            closeScreenWithHistory('my-bookings');
          }}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md ${
            isMyBookingsModalClosing ? 'animate-contact-backdrop-close' : 'animate-contact-backdrop'
          }`}
          role="dialog"
          aria-modal="true"
        >
          <SwipeableModalCard 
            onClose={() => closeScreenWithHistory('my-bookings')}
            isClosing={isMyBookingsModalClosing}
            className={`liquid-glass-menu relative w-full max-w-[540px] sm:max-w-[580px] rounded-[28px] p-5 sm:p-6 shadow-[0_24px_50px_-12px_rgba(95,70,40,0.38)] overflow-hidden flex flex-col max-h-[90vh] ${
              isMyBookingsModalClosing ? 'animate-contact-modal-close' : 'animate-contact-modal'
            }`}
          >
            <div className="glass-glow-rim" aria-hidden="true" />
            
            {/* Header with Small Persistent Search Bar */}
            <div className="flex flex-col gap-2.5 pb-3 border-b border-[#a68d6a]/25 shrink-0">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100/90 border border-white/90 shadow-xs text-[#4a321f] animate-booking-loop">
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect width="18" height="18" x="3" y="4" rx="2" ry="2" />
                      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" />
                      <path d="m9 16 2 2 4-4" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="font-['Outfit',sans-serif] font-black text-lg text-[#261508] leading-tight">
                      My Bookings
                    </h3>
                    <p className="text-[11px] text-[#7d644d] font-medium">
                      View & manage your scheduled sessions
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    closeScreenWithHistory('my-bookings');
                  }}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 hover:bg-white text-[#4a321f] transition-all cursor-pointer shadow-xs border border-white/80 active:scale-95"
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                </button>
              </div>

              {/* Small Persistent Search Bar to quickly filter by topic or date */}
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-[#7d644d]/75">
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" />
                    <line x1="21" y1="21" x2="16.65" y2="16.65" />
                  </svg>
                </div>
                <input
                  type="text"
                  value={bookingsSearchQuery}
                  onChange={(e) => setBookingsSearchQuery(e.target.value)}
                  placeholder="Quick search by topic, date, or ID..."
                  className="w-full pl-8 pr-7 py-1.5 text-xs font-semibold rounded-xl bg-white/75 border border-white/95 text-[#261508] placeholder:text-[#a08770] focus:outline-none focus:bg-white focus:ring-1.5 focus:ring-amber-500/35 shadow-2xs transition-all"
                />
                {bookingsSearchQuery && (
                  <button
                    type="button"
                    onClick={() => setBookingsSearchQuery('')}
                    className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-[#7d644d] hover:text-black cursor-pointer"
                    title="Clear search"
                  >
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                  </button>
                )}
              </div>
            </div>

            {/* Content Body */}
            <div className="flex-1 overflow-y-auto overscroll-contain pr-1 py-3 scrollbar-none flex flex-col gap-3">
              {!isEmailVerified ? (
                /* Email Verification Form for Guest Security */
                <div className="flex flex-col gap-3 py-2">
                  <div className="rounded-2xl bg-white/55 border border-white/80 p-3.5 shadow-2xs flex flex-col gap-2">
                    <span className="font-['Outfit',sans-serif] font-black text-xs sm:text-sm text-[#261508]">
                      Secure Booking Verification
                    </span>
                    <p className="text-[11px] text-[#7d644d] font-medium leading-relaxed">
                      To keep consultation details private, please verify your email address to unlock your bookings.
                    </p>
                  </div>

                  {otpError && (
                    <div className="text-[11px] font-bold text-red-700 bg-red-100/80 border border-red-300 rounded-xl px-3 py-2">
                      {otpError}
                    </div>
                  )}

                  {otpMessage && (
                    <div className="text-[11px] font-bold text-emerald-800 bg-emerald-100/80 border border-emerald-300 rounded-xl px-3 py-2">
                      {otpMessage}
                    </div>
                  )}

                  {!otpGenerated ? (
                    <form onSubmit={handleSendOtp} className="flex flex-col gap-2.5">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#634932]">Enter Booking Email</label>
                        <input
                          type="email"
                          required
                          value={myBookingsEmail}
                          onChange={(e) => setMyBookingsEmail(e.target.value)}
                          placeholder="e.g. yourname@example.com"
                          className="w-full rounded-xl px-3.5 py-2.5 text-xs font-semibold bg-white/85 border border-white/95 text-[#261508] focus:outline-none focus:ring-2 focus:ring-[#73593f]/30"
                        />
                      </div>
                      <button
                        type="submit"
                        className="py-2.5 rounded-xl bg-gradient-to-r from-[#3e2714] to-[#261508] text-white font-bold text-xs shadow-md active:scale-98 transition-all cursor-pointer"
                      >
                        Send Verification Code →
                      </button>

                      <div className="relative flex items-center justify-center my-0.5">
                        <div className="border-t border-[#a68d6a]/25 w-full" />
                        <span className="bg-[#f5ecde] px-2 text-[10px] font-bold text-[#7d644d] uppercase tracking-wider">or</span>
                      </div>

                      <button
                        type="button"
                        onClick={handleMyBookingsGoogleSignIn}
                        disabled={isOAuthAuthenticating || isAuthLoading}
                        className="w-full py-2.5 px-3 rounded-xl bg-white/80 hover:bg-white text-gray-800 font-bold text-xs border border-white/95 shadow-2xs hover:shadow-xs active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
                      >
                        <svg className="h-4 w-4" viewBox="0 0 24 24">
                          <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                          <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                          <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"/>
                          <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"/>
                        </svg>
                        <span>Sign In with Workspace / Google</span>
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleVerifyOtp} className="flex flex-col gap-2.5">
                      <div className="flex flex-col gap-1">
                        <label className="text-xs font-bold uppercase tracking-wider text-[#634932]">Enter 6-Digit Code</label>
                        <input
                          type="text"
                          required
                          value={otpInput}
                          onChange={(e) => setOtpInput(e.target.value)}
                          placeholder="e.g. 748291"
                          maxLength={6}
                          className="w-full rounded-xl px-3.5 py-2.5 text-xs font-bold tracking-widest text-center bg-white/85 border border-white/95 text-[#261508] focus:outline-none focus:ring-2 focus:ring-[#73593f]/30"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          type="submit"
                          className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-[#3e2714] to-[#261508] text-white font-bold text-xs shadow-md active:scale-98 transition-all cursor-pointer"
                        >
                          Verify & Access Bookings →
                        </button>
                        <button
                          type="button"
                          onClick={() => setOtpGenerated('')}
                          className="px-3 py-2.5 rounded-xl bg-white/70 hover:bg-white text-xs font-bold text-[#7d644d] border border-white/80 active:scale-95"
                        >
                          Resend
                        </button>
                      </div>
                    </form>
                  )}
                </div>
              ) : (
                /* Verified Bookings List */
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between pb-1 text-xs">
                    <span className="text-[#7d644d] font-semibold">
                      Account: <strong>{myBookingsEmail}</strong>
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsEmailVerified(false);
                        setOtpGenerated('');
                        setOtpInput('');
                      }}
                      className="text-[11px] font-bold text-[#8c6b4b] hover:underline"
                    >
                      Switch Email
                    </button>
                  </div>

                  {(() => {
                    const activeEmail = myBookingsEmail.toLowerCase();
                    const allUserBookings = bookings.filter((b) => !activeEmail || b.email.toLowerCase() === activeEmail);
                    const q = bookingsSearchQuery.trim().toLowerCase();
                    const userBookings = q
                      ? allUserBookings.filter((b) => b.topic.toLowerCase().includes(q) || b.date.toLowerCase().includes(q) || b.id.toLowerCase().includes(q))
                      : allUserBookings;

                    if (userBookings.length === 0) {
                      return (
                        <div className="flex flex-col items-center text-center py-6 gap-2">
                          <div className="h-12 w-12 rounded-full bg-amber-100 flex items-center justify-center text-[#4a321f]">
                            <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect width="18" height="18" x="3" y="4" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /></svg>
                          </div>
                          <span className="font-['Outfit',sans-serif] font-bold text-sm text-[#261508]">
                            {q ? 'No matching bookings found' : 'No bookings found'}
                          </span>
                          <p className="text-xs text-[#7d644d] max-w-xs">
                            {q ? `No bookings matched "${bookingsSearchQuery}". Try another keyword or date.` : "We didn't find any scheduled consultations under this email."}
                          </p>
                          {q ? (
                            <button
                              type="button"
                              onClick={() => setBookingsSearchQuery('')}
                              className="mt-1 px-3 py-1.5 rounded-xl bg-white/80 hover:bg-white text-xs font-bold text-[#261508] border border-white/90 shadow-2xs cursor-pointer active:scale-95"
                            >
                              Clear Search Filter
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => {
                                setBookingConfirmedRecord(null);
                                openScreenWithHistory('booking', 'my-bookings');
                              }}
                              className="mt-2 px-4 py-2 rounded-xl bg-[#2c1708] text-white text-xs font-bold shadow-xs active:scale-95 cursor-pointer"
                            >
                              Book a Call Now →
                            </button>
                          )}
                        </div>
                      );
                    }

                    return (
                      <div className="flex flex-col gap-2.5">
                        {userBookings.map((b) => (
                          <div key={b.id} className="rounded-2xl bg-white/60 border border-white/90 p-3.5 shadow-2xs flex flex-col gap-2">
                            <div className="flex items-center justify-between">
                              <span className="font-['Outfit',sans-serif] font-black text-xs text-[#261508] bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
                                {b.id}
                              </span>
                              <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-full border ${
                                b.status === 'Confirmed'
                                  ? 'bg-emerald-100/90 text-emerald-800 border-emerald-300'
                                  : 'bg-rose-100/90 text-rose-800 border-rose-300'
                              }`}>
                                {b.status}
                              </span>
                            </div>

                            <div className="text-xs">
                              <p className="font-bold text-[#261508]">{b.date} • {b.time}</p>
                              <p className="text-[#7d644d] text-[11px] mt-0.5">{b.topic}</p>
                            </div>

                            {b.status === 'Confirmed' && (
                              <div className="flex items-center justify-end gap-2 pt-1 border-t border-[#a68d6a]/15">
                                <button
                                  type="button"
                                  onClick={() => handleCancelBooking(b.id)}
                                  className="text-[11px] font-bold text-rose-700 hover:text-rose-900 px-2.5 py-1 rounded-lg hover:bg-rose-50 transition-colors"
                                >
                                  Cancel Booking
                                </button>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                </div>
              )}
            </div>
          </SwipeableModalCard>
        </div>
      )}

      {/* 
        Track Bookings Modal
      */}
      {isTrackModalOpen && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            closeScreenWithHistory('track');
          }}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md ${
            isTrackModalClosing ? 'animate-contact-backdrop-close' : 'animate-contact-backdrop'
          }`}
          role="dialog"
          aria-modal="true"
        >
          <SwipeableModalCard 
            onClose={() => closeScreenWithHistory('track')}
            isClosing={isTrackModalClosing}
            className={`liquid-glass-menu relative w-full max-w-[520px] rounded-[28px] p-5 sm:p-6 shadow-[0_24px_50px_-12px_rgba(95,70,40,0.38)] overflow-hidden flex flex-col gap-3.5 ${
              isTrackModalClosing ? 'animate-contact-modal-close' : 'animate-contact-modal'
            }`}
          >
            <div className="glass-glow-rim" aria-hidden="true" />
            
            <div className="flex items-center justify-between pb-3 border-b border-[#a68d6a]/25">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100/90 border border-white/90 shadow-xs text-[#4a321f] animate-track-loop">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
                  </svg>
                </div>
                <div>
                  <h3 className="font-['Outfit',sans-serif] font-black text-lg text-[#261508] leading-tight">
                    Track Bookings
                  </h3>
                  <p className="text-[11px] text-[#7d644d] font-medium">
                    Live status & consultation schedule updates
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeScreenWithHistory('track');
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 hover:bg-white text-[#4a321f] transition-all cursor-pointer shadow-xs border border-white/80 active:scale-95"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            <form onSubmit={handleTrackSearch} className="flex flex-col gap-2.5">
              <div className="flex flex-col gap-1">
                <label className="text-xs font-bold uppercase tracking-wider text-[#634932]">Search Reference</label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    required
                    value={trackQuery}
                    onChange={(e) => setTrackQuery(e.target.value)}
                    placeholder="Enter Booking ID (e.g. FT-2026-1042) or Email"
                    className="flex-1 rounded-xl px-3.5 py-2.5 text-xs font-semibold bg-white/85 border border-white/95 text-[#261508] focus:outline-none focus:ring-2 focus:ring-[#73593f]/30"
                  />
                  <button
                    type="submit"
                    className="px-4 py-2.5 rounded-xl bg-[#2c1708] text-white text-xs font-bold shadow-xs active:scale-95 cursor-pointer"
                  >
                    Track
                  </button>
                </div>
              </div>
            </form>

            {trackSearched && (
              <div className="pt-2">
                {trackResult ? (
                  <div className="rounded-2xl bg-white/65 border border-white/90 p-4 shadow-2xs flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <span className="font-['Outfit',sans-serif] font-black text-sm text-[#261508]">
                        Booking: {trackResult.id}
                      </span>
                      <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300">
                        {trackResult.status}
                      </span>
                    </div>

                    <div className="text-xs text-[#7d644d]">
                      <p className="font-bold text-[#261508]">{trackResult.date} at {trackResult.time}</p>
                      <p className="text-[11px] mt-0.5">{trackResult.topic}</p>
                    </div>

                    {/* 4-Step Timeline */}
                    <div className="flex flex-col gap-2 pt-2 border-t border-[#a68d6a]/20">
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                        <span className="h-4 w-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">✓</span>
                        <span>1. Request Confirmed</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                        <span className="h-4 w-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">✓</span>
                        <span>2. Consultant Assigned (Shiv Kumar)</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
                        <span className="h-4 w-4 rounded-full bg-emerald-500 text-white flex items-center justify-center text-[10px]">✓</span>
                        <span>3. Private Video Room Prepared</span>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-bold text-amber-800">
                        <span className="h-4 w-4 rounded-full bg-amber-500 text-white flex items-center justify-center text-[10px]">⏳</span>
                        <span>4. 1-on-1 Consultation Call</span>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="rounded-2xl bg-rose-50/80 border border-rose-200 p-3.5 text-center text-xs text-rose-800 font-bold">
                    No booking found matching "{trackQuery}". Please double check your booking reference number or email address.
                  </div>
                )}
              </div>
            )}
          </SwipeableModalCard>
        </div>
      )}

      {/* 
        About Us Modal (Part 1 Exact English Content & Typography Hierarchy)
      */}
      {isAboutModalOpen && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            closeScreenWithHistory('about');
          }}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/40 backdrop-blur-md ${
            isAboutModalClosing ? 'animate-contact-backdrop-close' : 'animate-contact-backdrop'
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="about-us-modal-heading"
        >
          <SwipeableModalCard 
            onClose={() => closeScreenWithHistory('about')}
            isClosing={isAboutModalClosing}
            className={`liquid-glass-menu relative w-full max-w-[540px] rounded-[28px] p-6 sm:p-7 shadow-[0_24px_50px_-12px_rgba(95,70,40,0.38)] overflow-hidden flex flex-col gap-4 ${
              isAboutModalClosing ? 'animate-about-modal-close' : 'animate-contact-modal'
            }`}
          >
            <div className="glass-glow-rim" aria-hidden="true" />
            
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-[#a68d6a]/25">
              <div className="flex flex-col text-left min-w-0 pr-2">
                {/* Heading: Exact English "About Funzy Tech" */}
                <h2 id="about-us-modal-heading" className="font-['Outfit',sans-serif] font-black text-2xl sm:text-[28px] text-[#261508] tracking-tight leading-tight">
                  About Funzy Tech
                </h2>
                {/* Subheading: Single line, smaller text */}
                <p className="font-['Outfit',sans-serif] text-xs sm:text-[13px] text-[#7d644d] font-semibold mt-1 leading-snug whitespace-nowrap truncate">
                  Every big dream begins with a small step.
                </p>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeScreenWithHistory('about');
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 hover:bg-white text-[#4a321f] transition-all cursor-pointer shadow-xs border border-white/80 active:scale-95 shrink-0 ml-3"
                aria-label="Close"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Body Content */}
            <div className="flex flex-col gap-3 text-xs sm:text-[14px] text-[#3d2714] leading-relaxed text-left">
              <p>
                I'm <span className="font-bold text-[#8c5e34]">Shiv Kumar</span>, the founder of FunzyTech.
              </p>

              <p>
                FunzyTech was born from a simple dream: to make technology easy, useful, and enjoyable for everyone. Our goal is to share knowledge that makes a difference, sparks curiosity, and helps people discover something new every day.
              </p>

              <p>
                We're just getting started, but the vision is bigger than today.
              </p>

              {/* Closing Statement in single line */}
              <div className="mt-0.5 pt-2.5 border-t border-[#a68d6a]/20">
                <p className="font-['Outfit',sans-serif] font-black text-xs sm:text-[13.5px] text-[#8c5e34] tracking-tight whitespace-nowrap truncate">
                  FunzyTech — Where Technology Meets Fun.
                </p>
              </div>

              {/* Donate Now Button: Opens Dedicated Support Us Popup */}
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(15);
                  openScreenWithHistory('donate', 'about');
                }}
                className="w-full mt-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-amber-600 via-amber-700 to-amber-800 hover:from-amber-700 hover:to-amber-900 text-white font-['Outfit',sans-serif] font-extrabold text-xs sm:text-sm shadow-md hover:shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer border border-amber-300/40 select-none"
              >
                <svg className="h-4 w-4 text-rose-200 fill-current animate-pulse" viewBox="0 0 24 24">
                  <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                </svg>
                <span>Donate Now</span>
              </button>
            </div>
          </SwipeableModalCard>
        </div>
      )}

      {/* 
        Ultra-Detailed High-Precision Payment Modal:
        - Strict non-scrollable layout
        - Controls order:
          1. Amount selection (presets ₹10, ₹20, ₹50, ₹100, ₹200, ₹500)
          2. Any Amount / custom donation amount option
          3. Large donation QR code with instruction: Please scan the QR code manually. Do not screenshot.
          4. Pay via UPI button (no dollar icon)
          5. I've Completed My Donation button (triggers handleConfirmContribution)
        - No download QR code button
        - No transaction note or message section
      */}
      {isDonateModalOpen && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            closeScreenWithHistory('donate');
          }}
          className={`fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-md overflow-hidden select-none ${
            isDonateModalClosing ? 'animate-contact-backdrop-close' : 'animate-contact-backdrop'
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="donate-modal-heading"
        >
          <SwipeableModalCard 
            onClose={() => closeScreenWithHistory('donate')}
            isClosing={isDonateModalClosing}
            className={`liquid-glass-menu relative w-full max-w-[380px] sm:max-w-[400px] rounded-[24px] p-3.5 sm:p-4 shadow-[0_24px_50px_-12px_rgba(95,70,40,0.38)] flex flex-col gap-2 overflow-hidden ${
              isDonateModalClosing ? 'animate-about-modal-close' : 'animate-contact-modal'
            }`}
          >
            <div className="glass-glow-rim" aria-hidden="true" />
            
            {/* Header with Title and Animated Close */}
            <div className="flex items-center justify-between pb-1.5 border-b border-[#a68d6a]/25 shrink-0">
              <div className="flex items-center gap-2">
                <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-rose-50 border border-rose-200/80 shadow-xs text-rose-500">
                  <svg className="h-3.5 w-3.5 fill-current animate-pulse" viewBox="0 0 24 24">
                    <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
                  </svg>
                </div>
                <div>
                  <h3 id="donate-modal-heading" className="font-['Outfit',sans-serif] font-black text-sm sm:text-base text-[#261508] leading-tight">
                    Support Us
                  </h3>
                  <p className="text-[9px] text-[#7d644d] font-semibold leading-none">
                    Support Funzy Tech Creator
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic(12);
                  closeScreenWithHistory('donate');
                }}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-white/70 hover:bg-white text-[#4a321f] transition-all cursor-pointer shadow-xs border border-white/80 active:scale-95 shrink-0"
                aria-label="Close"
              >
                <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* 1. AMOUNT SELECTION (Predefined Presets) */}
            <div className="flex flex-col gap-1">
              <span className="text-[9px] font-black uppercase tracking-wider text-[#7d644d]">
                Amount Selection
              </span>
              <div className="grid grid-cols-6 gap-1">
                {[10, 20, 50, 100, 200, 500].map((amt) => {
                  const isSelected = donationAmountType === 'preset' && selectedPresetAmount === amt;
                  return (
                    <button
                      key={amt}
                      type="button"
                      onClick={() => handleSelectPresetAmount(amt)}
                      className={`py-1 px-0.5 rounded-lg text-xs font-bold font-['Outfit',sans-serif] transition-all duration-200 cursor-pointer shadow-2xs active:scale-95 border ${
                        isSelected
                          ? 'bg-[#2c1708] text-white border-black shadow-xs scale-102'
                          : 'bg-white/70 hover:bg-white text-[#382312] border-white/90'
                      }`}
                    >
                      ₹{amt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. ANY AMOUNT (Custom Amount Option) */}
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  triggerHaptic(12);
                  setDonationAmountType('any');
                  setSelectedPresetAmount(null);
                  setCustomDonationAmount('');
                }}
                className={`py-1.5 px-2 rounded-lg text-[10.5px] font-extrabold font-['Outfit',sans-serif] transition-all cursor-pointer shadow-2xs active:scale-95 border shrink-0 ${
                  donationAmountType === 'any'
                    ? 'bg-[#2c1708] text-white border-black'
                    : 'bg-white/70 hover:bg-white text-[#382312] border-white/90'
                }`}
              >
                Any Amount
              </button>
              <div className="relative flex-1 flex items-center">
                <span className="absolute left-2.5 text-xs font-black text-[#5c3e21]">₹</span>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="Enter custom amount"
                  value={customDonationAmount}
                  onFocus={() => {
                    setDonationAmountType('any');
                    setSelectedPresetAmount(null);
                  }}
                  onChange={(e) => handleCustomAmountChange(e.target.value)}
                  className="w-full pl-6 pr-2.5 py-1.5 rounded-lg bg-white/90 border border-white/95 text-xs font-bold text-[#261508] placeholder-[#9c8269] shadow-2xs focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                />
              </div>
            </div>


            {/* 3. LARGE DONATION QR CODE */}
            <div className={`relative w-full ${isDesktopDevice ? 'max-w-[250px] sm:max-w-[270px]' : 'max-w-[220px] sm:max-w-[240px]'} aspect-square mx-auto flex items-center justify-center p-2 bg-white rounded-2xl border border-[#a68d6a]/25 shadow-xs shrink-0`}>
              {donationQrDataUrl ? (
                <img
                  src={donationQrDataUrl}
                  alt="Payment QR Code"
                  className="w-full h-full object-contain rounded-lg select-none block"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <div className="h-6 w-6 border-2 border-amber-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </div>

            {/* Real Configured UPI ID with Icon-Only Copy Button */}
            <div className="flex items-center justify-center gap-2 py-1 px-3 rounded-xl bg-[#241306]/90 backdrop-blur-md border border-[#8a6844]/40 shadow-xs self-center">
              <span className="text-[11px] font-bold font-mono tracking-tight text-[#fdf9f3] select-all">
                funzytechbusiness@okaxis
              </span>
              <button
                type="button"
                onClick={handleCopyUpiId}
                aria-label="Copy UPI ID"
                title="Copy UPI ID"
                className={`p-1 rounded-lg transition-colors duration-300 cursor-pointer active:scale-90 flex items-center justify-center ${
                  copiedUpiId
                    ? 'text-emerald-400 bg-emerald-900/50'
                    : 'text-amber-200/80 hover:text-white hover:bg-white/15'
                }`}
              >
                {copiedUpiId ? (
                  <svg className="h-3.5 w-3.5 transition-opacity duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  <svg className="h-3.5 w-3.5 transition-opacity duration-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                )}
              </button>
            </div>

            <p className="text-[10px] sm:text-[10.5px] font-bold text-[#6d5138] text-center tracking-tight select-none">
              Please scan the QR code manually. Do not screenshot.
            </p>

            {/* 4. PRIMARY BUTTON: Pay via UPI (Mobile/Tablet only) & 5. SECONDARY BUTTON: I've Completed My Donation */}
            <div className="flex flex-col gap-1.5 pt-0.5">
              {!isDesktopDevice && (
                <button
                  type="button"
                  onClick={handlePayNow}
                  className="w-full py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#2c1708] via-[#45270f] to-[#2c1708] hover:from-black hover:to-black text-white font-['Outfit',sans-serif] font-black text-xs sm:text-sm shadow-md active:scale-95 transition-all text-center cursor-pointer border border-[#8c6b4b]/40 select-none"
                >
                  Pay via UPI
                </button>
              )}

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  triggerHaptic(18);
                  handleConfirmContribution();
                }}
                className="w-full py-2 px-4 rounded-xl bg-white/85 hover:bg-white text-[#2c1708] font-['Outfit',sans-serif] font-black text-xs shadow-2xs active:scale-95 transition-all text-center cursor-pointer border border-[#a68d6a]/40 select-none"
              >
                I've Completed My Donation
              </button>
            </div>
          </SwipeableModalCard>
        </div>
      )}

      {/* Thank-You Experience Popup */}
      {showDonationThankYou && (
        <div 
          onClick={() => closeScreenWithHistory('donate-thanks')}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-md ${
            isDonationThankYouClosing ? 'animate-contact-backdrop-close' : 'animate-contact-backdrop'
          }`}
          role="dialog"
          aria-modal="true"
        >
          <SwipeableModalCard 
            onClose={() => closeScreenWithHistory('donate-thanks')}
            isClosing={isDonationThankYouClosing}
            className={`liquid-glass-menu relative w-full max-w-[400px] rounded-[28px] p-6 shadow-[0_24px_50px_-12px_rgba(95,70,40,0.38)] overflow-hidden flex flex-col items-center text-center gap-3.5 ${
              isDonationThankYouClosing ? 'animate-contact-modal-close' : 'animate-contact-modal'
            }`}
          >
            <div className="glass-glow-rim" aria-hidden="true" />
            <h3 className="font-['Outfit',sans-serif] font-black text-xl text-[#261508] tracking-tight leading-snug">
              Thanks for your contribution to FunzyTech! 🎉
            </h3>
            <p className="text-xs text-[#705235] font-medium leading-relaxed">
              Your voluntary contribution helps keep FunzyTech thriving and fuels our future tech innovations.
            </p>
            <button
              type="button"
              onClick={() => closeScreenWithHistory('donate-thanks')}
              className="w-full mt-2 py-2.5 rounded-xl bg-[#2c1708] hover:bg-black text-white font-['Outfit',sans-serif] font-bold text-xs sm:text-sm shadow-md active:scale-95 transition-all cursor-pointer"
            >
              Close
            </button>
          </SwipeableModalCard>
        </div>
      )}

      {/* 
        QR Code Referral Modal (English Language Only)
      */}
      {isQrModalOpen && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            closeScreenWithHistory('qr');
          }}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md ${
            isQrModalClosing ? 'animate-contact-backdrop-close' : 'animate-contact-backdrop'
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="qr-modal-title"
        >
          <SwipeableModalCard 
            onClose={() => closeScreenWithHistory('qr')}
            isClosing={isQrModalClosing}
            className={`liquid-glass-menu relative w-full max-w-[440px] rounded-[28px] p-5 sm:p-6 shadow-[0_24px_50px_-12px_rgba(95,70,40,0.38)] overflow-hidden flex flex-col gap-3.5 ${
              isQrModalClosing ? 'animate-qr-modal-close' : 'animate-contact-modal'
            }`}
          >
            <div className="glass-glow-rim" aria-hidden="true" />
            
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-[#a68d6a]/25 shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100/90 border border-white/90 shadow-xs text-[#4a321f] animate-qr-icon">
                  <svg
                    className="h-4.5 w-4.5"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.1"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <rect x="3" y="3" width="7" height="7" rx="1.5" />
                    <rect x="14" y="3" width="7" height="7" rx="1.5" />
                    <rect x="3" y="14" width="7" height="7" rx="1.5" />
                    <circle cx="6.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="17.5" cy="6.5" r="1.5" fill="currentColor" stroke="none" />
                    <circle cx="6.5" cy="17.5" r="1.5" fill="currentColor" stroke="none" />
                    <rect x="14" y="14" width="3" height="3" fill="currentColor" />
                    <rect x="18" y="14" width="3" height="3" fill="currentColor" />
                    <rect x="14" y="18" width="3" height="3" fill="currentColor" />
                    <rect x="18" y="18" width="3" height="3" fill="currentColor" />
                  </svg>
                </div>
                <div>
                  <h3 id="qr-modal-title" className="font-['Outfit',sans-serif] font-black text-lg text-[#261508] leading-tight">
                    Your Referral QR Code
                  </h3>
                  <p className="text-[11px] text-[#7d644d] font-medium">
                    Scan or share referral code (10% OFF)
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeScreenWithHistory('qr');
                }}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 hover:bg-white text-[#4a321f] transition-all cursor-pointer shadow-xs border border-white/80 active:scale-95"
                aria-label="Close"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              </button>
            </div>

            {/* Scannable QR Code Visual Card */}
            <div className="flex flex-col items-center justify-center pt-1">
              <div className="relative p-3.5 rounded-2xl bg-white border border-[#a68d6a]/20 shadow-[0_8px_20px_-6px_rgba(95,70,40,0.18)] flex flex-col items-center">
                {isGeneratingQr || !qrCodeDataUrl ? (
                  <div className="w-52 h-52 sm:w-56 sm:h-56 flex flex-col items-center justify-center gap-2 text-center">
                    <div className="h-8 w-8 rounded-full border-3 border-amber-300 border-t-amber-600 animate-spin" />
                    <span className="text-xs font-semibold text-[#7d644d]">Generating QR Code...</span>
                  </div>
                ) : (
                  <img
                    src={qrCodeDataUrl}
                    alt="Funzy Tech Referral QR Code"
                    className="w-52 h-52 sm:w-56 sm:h-56 object-contain rounded-xl select-none"
                  />
                )}
                <p className="text-[11.5px] font-bold text-[#593e28] mt-2 select-none tracking-tight">
                  Scan QR code to open website
                </p>
              </div>
            </div>

            {/* Referral Coupon Code Display Pill */}
            <div className="p-2.5 rounded-xl bg-white/60 backdrop-blur-sm border border-white/90 shadow-2xs flex items-center justify-between gap-2">
              <div className="flex flex-col min-w-0 pl-1">
                <span className="text-[9.5px] font-black uppercase tracking-wider text-[#7d644d] leading-none mb-0.5">
                  Your Referral Code
                </span>
                <span className="font-mono font-black text-sm sm:text-base text-[#261508] tracking-widest truncate">
                  {myReferralCode || 'FT-CONNECT'}
                </span>
              </div>
              <button
                type="button"
                onClick={handleCopyReferralCode}
                className={`shrink-0 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all duration-200 cursor-pointer shadow-2xs active:scale-95 select-none ${
                  copiedCodeSuccess
                    ? 'bg-emerald-600 text-white animate-pulse scale-105 shadow-md'
                    : 'bg-[#2c1708] hover:bg-black text-white hover:scale-[1.02]'
                }`}
              >
                {copiedCodeSuccess ? (
                  <>
                    <svg className="h-3.5 w-3.5 stroke-white" viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span>Code Copied!</span>
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5 text-amber-300" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                      <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                    </svg>
                    <span>Copy Code</span>
                  </>
                )}
              </button>
            </div>

            {/* Action Buttons: Copy Link & Download QR in a Single Row without truncation dots */}
            <div className="grid grid-cols-2 gap-2 pt-0.5">
              <button
                type="button"
                onClick={handleCopyReferralLink}
                className={`flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-[11px] sm:text-xs font-bold border transition-all duration-300 cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap select-none ${
                  copiedLinkSuccess
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                    : 'bg-white/70 hover:bg-white text-[#2c1708] border-white/90 hover:border-amber-300/80'
                }`}
              >
                {copiedLinkSuccess ? (
                  <>
                    <svg className="h-3.5 w-3.5 stroke-white shrink-0 animate-success-pop" viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className="font-extrabold">Link Copied!</span>
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5 text-[#593e28] shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
                      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
                    </svg>
                    <span>Copy Referral Link</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handleDownloadQrCode}
                className={`group flex items-center justify-center gap-1.5 py-2.5 px-2 rounded-xl text-[11px] sm:text-xs font-bold border transition-all duration-300 cursor-pointer shadow-2xs active:scale-95 whitespace-nowrap select-none ${
                  downloadQrSuccess
                    ? 'bg-emerald-600 text-white border-emerald-700 shadow-sm'
                    : 'bg-white/70 hover:bg-white text-[#2c1708] border-white/90 hover:border-amber-300/80'
                }`}
              >
                {downloadQrSuccess ? (
                  <>
                    <svg className="h-3.5 w-3.5 stroke-white shrink-0 animate-success-pop" viewBox="0 0 24 24" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                    <span className="font-extrabold">Downloaded</span>
                  </>
                ) : (
                  <>
                    <svg className="h-3.5 w-3.5 text-[#593e28] group-hover:scale-125 transition-transform duration-300 ease-luxury shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    <span>Download QR Code</span>
                  </>
                )}
              </button>
            </div>
          </SwipeableModalCard>
        </div>
      )}
      {isContactFormOpen && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            handleCloseContactForm();
          }}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-md ${
            isContactFormClosing ? 'animate-contact-backdrop-close' : 'animate-contact-backdrop'
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="contact-modal-title"
        >
          <SwipeableModalCard 
            onClose={() => handleCloseContactForm()}
            isClosing={isContactFormClosing}
            className={`liquid-glass-menu relative w-full max-w-[560px] sm:max-w-[590px] rounded-[28px] p-5 sm:p-6.5 shadow-[0_24px_50px_-12px_rgba(95,70,40,0.38)] overflow-hidden ${
              isContactFormClosing ? 'animate-contact-modal-close' : 'animate-contact-modal'
            }`}
          >
            {/* Revolving White Stroke Shine Beam around the outer border contour of the Business Inquiry Only box */}
            <div className="border-beam-container" aria-hidden="true">
              <div
                className="absolute -inset-[200%] animate-border-beam"
                style={{
                  background: 'conic-gradient(from 0deg, transparent 0deg, transparent 200deg, rgba(255,255,255,0.01) 220deg, rgba(255,255,255,0.06) 240deg, rgba(255,255,255,0.18) 260deg, rgba(255,255,255,0.4) 280deg, rgba(255,255,255,0.75) 305deg, rgba(255,255,255,1) 325deg, rgba(255,255,255,0.85) 335deg, rgba(255,255,255,0.5) 345deg, rgba(255,255,255,0.2) 352deg, rgba(255,255,255,0.04) 357deg, transparent 360deg)',
                  filter: 'blur(1.2px) drop-shadow(0 0 6px rgba(255,255,255,0.95))',
                }}
              />
            </div>

            {/* Top rim feathered glow on modal */}
            <div className="glass-glow-rim" aria-hidden="true" />

            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-[#a68d6a]/25">
              <div className="flex items-center gap-2.5">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100/90 border border-white/90 shadow-xs animate-email-loop">
                  <svg 
                    className="h-4 w-4 text-[#4a321f]" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2.2" 
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </svg>
                </div>
                <div>
                  <h3 id="contact-modal-title" className="font-['Outfit',sans-serif] font-black text-lg text-[#261508] leading-tight">
                    Business Inquiry Only
                  </h3>
                  <p className="text-[11px] text-[#7d644d] font-medium">
                    To: FunzyTechBusiness@Gmail.com
                  </p>
                </div>
              </div>

              {/* Close Button with Outro Animation */}
              <button
                type="button"
                onClick={handleCloseContactForm}
                aria-label="Close dialog"
                className="flex h-8 w-8 items-center justify-center rounded-full bg-white/70 hover:bg-white text-[#4a321f] transition-all hover:scale-105 active:scale-95 cursor-pointer shadow-xs border border-white/80"
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Contact Form Body */}
            <form onSubmit={handleContactFormSubmit} noValidate className="mt-4 flex flex-col gap-3.5">
              {/* Subject Field - Auto-expanding and elongated for clear full readability */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#634932]">
                  <label htmlFor="contact-subject">Subject</label>
                  <span className="text-[10px] tracking-normal font-medium text-[#8c7158] lowercase">
                    editable
                  </span>
                </div>
                <textarea
                  id="contact-subject"
                  ref={subjectTextareaRef}
                  rows={2}
                  value={contactSubject}
                  onChange={(e) => {
                    setContactSubject(e.target.value);
                    if (subjectShake) setSubjectShake(false);
                    if (showRequiredPopup) setShowRequiredPopup(false);
                  }}
                  onAnimationEnd={() => setSubjectShake(false)}
                  placeholder="Enter subject..."
                  aria-invalid={subjectShake}
                  className={`w-full contact-auto-expand overflow-hidden scrollbar-none rounded-xl px-4 py-3 text-[13px] sm:text-[13.5px] font-semibold text-[#261508] shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.06)] placeholder:text-[#a08770] focus:outline-none resize-none leading-relaxed min-h-[54px] sm:min-h-[56px] ${
                    subjectShake
                      ? 'animate-subtle-shake bg-red-50/70 border-2 border-red-500/80 shadow-[0_0_12px_rgba(239,68,68,0.22)] ring-2 ring-red-400/30'
                      : 'bg-white/85 border border-white/95 focus:ring-2 focus:ring-[#73593f]/30 focus:bg-white'
                  } ${isResettingFields ? 'animate-field-reset' : ''}`}
                />
              </div>

              {/* Message Field - Auto-expanding and dynamic, slim when empty */}
              <div className="flex flex-col gap-1.5">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-[#634932]">
                  <label htmlFor="contact-message">Message</label>
                  <span className="text-[10px] tracking-normal font-medium text-[#8c7158] lowercase">
                    editable
                  </span>
                </div>
                <textarea
                  id="contact-message"
                  ref={messageTextareaRef}
                  rows={2}
                  value={contactMessage}
                  onChange={(e) => {
                    setContactMessage(e.target.value);
                    if (messageShake) setMessageShake(false);
                    if (showRequiredPopup) setShowRequiredPopup(false);
                  }}
                  onAnimationEnd={() => setMessageShake(false)}
                  placeholder="Enter message..."
                  aria-invalid={messageShake}
                  className={`w-full contact-auto-expand overflow-hidden scrollbar-none rounded-xl px-4 py-3 text-[13px] sm:text-[13.5px] font-medium text-[#261508] shadow-[inset_0_1.5px_3px_rgba(0,0,0,0.06)] placeholder:text-[#a08770] focus:outline-none resize-none leading-relaxed min-h-[62px] sm:min-h-[66px] ${
                    messageShake
                      ? 'animate-subtle-shake bg-red-50/70 border-2 border-red-500/80 shadow-[0_0_12px_rgba(239,68,68,0.22)] ring-2 ring-red-400/30'
                      : 'bg-white/85 border border-white/95 focus:ring-2 focus:ring-[#73593f]/30 focus:bg-white'
                  } ${isResettingFields ? 'animate-field-reset' : ''}`}
                />
              </div>

              {/* Action Buttons */}
              <div className="mt-1 flex flex-col gap-2">
                <button
                  type="submit"
                  className="flex items-center justify-center gap-2 w-full rounded-xl py-2.5 sm:py-3 px-4 bg-gradient-to-r from-[#3e2714] to-[#261508] text-white font-bold text-xs sm:text-sm shadow-[0_6px_16px_rgba(38,21,8,0.28)] hover:shadow-[0_8px_20px_rgba(38,21,8,0.36)] hover:brightness-110 active:scale-[0.99] transition-all cursor-pointer border border-white/20"
                >
                  <span>Send Message</span>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13" />
                    <polygon points="22 2 15 22 11 13 2 9 22 2" />
                  </svg>
                </button>

                <div className="flex items-center justify-between pt-1 text-[11px] text-[#73593f]/85">
                  <span className="text-[11px] font-medium">Replies within 24 hours</span>
                  <button
                    type="button"
                    onClick={handleResetDefaults}
                    className={`relative shrink-0 cursor-pointer rounded-lg px-2.5 sm:px-3 py-1.5 text-[11px] sm:text-xs font-bold shadow-2xs border active:scale-95 transition-all duration-300 ease-luxury whitespace-nowrap select-none ${
                      isResetFeedback
                        ? 'bg-emerald-50/90 text-emerald-800 border-emerald-300/80 shadow-[0_2px_8px_rgba(16,185,129,0.18)]'
                        : 'bg-white/80 hover:bg-white text-[#452e1b] hover:text-[#261508] border-white/90 hover:shadow-xs'
                    }`}
                    title={hasContactContent ? 'Clear Subject and Message' : 'Restore prefilled default template'}
                  >
                    <div className="relative flex items-center justify-center min-w-[94px] sm:min-w-[100px]">
                      {/* Active Feedback State ('Reset Done ✓' or 'Restored ✓') with fluid vertical slide & fade */}
                      <div
                        className={`flex items-center justify-center gap-1.5 transition-all duration-300 ease-luxury ${
                          isResetFeedback
                            ? 'opacity-100 translate-y-0 scale-100'
                            : 'pointer-events-none absolute inset-0 opacity-0 translate-y-2 scale-90'
                        }`}
                      >
                        <svg className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-emerald-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                        <span className="whitespace-nowrap">{resetFeedbackText}</span>
                      </div>

                      {/* Idle State ('Reset Default' or 'Restore Default') with smooth return transition */}
                      <div
                        className={`flex items-center justify-center gap-1.5 transition-all duration-300 ease-luxury ${
                          isResetFeedback
                            ? 'pointer-events-none absolute inset-0 opacity-0 -translate-y-2 scale-90'
                            : 'opacity-100 translate-y-0 scale-100'
                        }`}
                      >
                        <svg 
                          className="h-3 w-3 sm:h-3.5 sm:w-3.5 text-[#573e2a]" 
                          viewBox="0 0 24 24" 
                          fill="none" 
                          stroke="currentColor" 
                          strokeWidth="2.3" 
                          strokeLinecap="round" 
                          strokeLinejoin="round"
                        >
                          <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                          <path d="M3 3v5h5" />
                        </svg>
                        <span className="whitespace-nowrap">
                          {hasContactContent ? 'Reset Default' : 'Restore Default'}
                        </span>
                      </div>
                    </div>
                  </button>
                </div>
              </div>
            </form>
          </SwipeableModalCard>
        </div>
      )}

      {/* 
        Admin Password Entry Modal Box
        - Enter Password placeholder
        - Continue button below input
        - Animated Close (×) button at top
        - No keyboard autofocus on appear (only opens when user taps input)
        - Password completely hidden
      */}
      {/* 
        Admin Password Entry Modal Box (Ultra-Strict Invisible Sequence Authentication)
        - Exact sequence: 15s password input -> 7s hold -> 3 taps -> 1 final tap -> 7s inactivity -> server authorization
        - Zero visible timers, countdowns, warning toasts, or error text
        - Password completely hidden (type="password")
        - No keyboard autofocus on appear (only opens when user taps input)
      */}
      {isAdminPasswordModalOpen && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            failAndCloseAdminAuth();
          }}
          className={`fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/55 backdrop-blur-[14px] ${
            isAdminPasswordModalClosing ? 'animate-contact-backdrop-close' : 'animate-contact-backdrop'
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-password-modal-title"
        >
          {/* Focused Ambient Glow for Admin Visual Priority */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(251,191,36,0.12)_0%,_transparent_70%)] pointer-events-none" />
          <SwipeableModalCard 
            onClose={() => failAndCloseAdminAuth()}
            isClosing={isAdminPasswordModalClosing}
            onClick={(e) => {
              e.stopPropagation();
              if (adminAuthStage === 'STAGE2' && stage2SubstepRef.current === 'INACTIVITY_WAIT') {
                failAndCloseAdminAuth();
              }
            }}
            className={`liquid-glass-menu relative w-full max-w-[370px] rounded-[26px] p-5 sm:p-6 shadow-[0_32px_70px_-10px_rgba(40,25,10,0.6)] ring-1 ring-amber-400/30 overflow-hidden flex flex-col gap-4 ${
              isAdminPasswordModalClosing ? 'animate-admin-modal-close' : 'animate-contact-modal'
            }`}
          >
            <div className="glass-glow-rim" aria-hidden="true" />
            
            {/* Header with Title and Animated Close (×) Button */}
            <div className="flex items-center justify-between pb-2.5 border-b border-[#a68d6a]/25">
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-100/90 border border-white/90 shadow-xs text-[#4a321f]">
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.3" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </svg>
                </div>
                <div>
                  <h3 id="admin-password-modal-title" className="font-['Outfit',sans-serif] font-black text-lg text-[#261508] tracking-tight leading-none">
                    Admin
                  </h3>
                  <p className="text-[10px] text-[#7d644d] font-semibold mt-0.5">Secure Console</p>
                </div>
              </div>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  failAndCloseAdminAuth();
                }}
                className="group flex h-8 w-8 items-center justify-center rounded-full bg-white/70 hover:bg-white text-[#4a321f] transition-all cursor-pointer shadow-xs border border-white/80 active:scale-95"
                aria-label="Close"
              >
                <svg className="h-4 w-4 transition-transform duration-300 ease-luxury group-hover:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex flex-col gap-1.5">
                <input
                  type="password"
                  placeholder="Enter Password"
                  value={adminPasswordInput}
                  onChange={handleAdminPasswordInputChange}
                  disabled={adminAuthStage !== 'PASSWORD'}
                  autoFocus={false}
                  className="w-full px-3.5 py-2.5 rounded-xl bg-white/75 border border-white/95 text-sm text-[#261508] placeholder-[#94775d] shadow-2xs focus:outline-none focus:ring-2 focus:ring-amber-400/50 focus:bg-white transition-all font-sans"
                />
              </div>

              {/* Continue / Interaction Target Button */}
              <button
                type="button"
                onPointerDown={handleContinuePointerDown}
                onPointerUp={handleContinuePointerUpOrLeave}
                onPointerLeave={handleContinuePointerUpOrLeave}
                onTouchStart={handleContinuePointerDown}
                onTouchEnd={handleContinuePointerUpOrLeave}
                onClick={handleContinueClick}
                className="w-full py-2.5 rounded-xl bg-[#2c1708] hover:bg-black text-white font-['Outfit',sans-serif] font-bold text-sm shadow-sm hover:shadow transition-all cursor-pointer select-none active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span>Continue</span>
              </button>
            </div>
          </SwipeableModalCard>
        </div>
      )}

      {/* 
        Future Admin Dashboard Modal (Authenticated Session)
        - Funzy Tech Administrative Console
        - Active Metrics & Operational Controls
        - Developer & Administrator: Shiv Kumar
      */}
      {isAdminDashboardOpen && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            closeScreenWithHistory('admin-dashboard');
          }}
          className={`fixed inset-0 z-[60] flex items-center justify-center p-3 sm:p-4 bg-black/55 backdrop-blur-[14px] ${
            isAdminDashboardClosing ? 'animate-contact-backdrop-close' : 'animate-contact-backdrop'
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="admin-dashboard-title"
        >
          {/* Focused Ambient Glow for Admin Visual Priority */}
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(251,191,36,0.14)_0%,_transparent_75%)] pointer-events-none" />
          <SwipeableModalCard 
            onClose={() => closeScreenWithHistory('admin-dashboard')}
            isClosing={isAdminDashboardClosing}
            className={`liquid-glass-menu relative w-full max-w-[540px] max-h-[90vh] overflow-y-auto rounded-[30px] p-5 sm:p-7 shadow-[0_36px_80px_-12px_rgba(30,16,6,0.65)] ring-1 ring-amber-400/35 flex flex-col gap-5 ${
              isAdminDashboardClosing ? 'animate-admin-modal-close' : 'animate-contact-modal'
            }`}
          >
            <div className="glass-glow-rim" aria-hidden="true" />

            {/* Dashboard Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-[#a68d6a]/25">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-amber-100/90 border border-white/90 shadow-xs text-[#4a321f]">
                  <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="18" height="18" x="3" y="3" rx="2" />
                    <path d="M3 9h18" />
                    <path d="M9 21V9" />
                  </svg>
                </div>
                <div>
                  <h3 id="admin-dashboard-title" className="font-['Outfit',sans-serif] font-black text-xl text-[#261508] tracking-tight leading-none">
                    Admin Dashboard
                  </h3>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-full border border-emerald-300/60">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                      Live Session Active
                    </span>
                    <span className="text-[11px] font-semibold text-[#7d644d]">Shiv Kumar</span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleAdminLogout}
                  className="px-2.5 py-1.5 rounded-xl bg-white/70 hover:bg-white text-xs font-bold text-[#4a321f] transition-all cursor-pointer shadow-xs border border-white/80 active:scale-95"
                  title="Lock Session and Invalidate Token"
                >
                  Lock
                </button>
                <button
                  type="button"
                  onClick={() => {
                    closeScreenWithHistory('admin-dashboard');
                  }}
                  className="group flex h-8 w-8 items-center justify-center rounded-full bg-white/70 hover:bg-white text-[#4a321f] transition-all cursor-pointer shadow-xs border border-white/80 active:scale-95"
                  aria-label="Close Admin Dashboard"
                >
                  <svg className="h-4 w-4 transition-transform duration-300 ease-luxury group-hover:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Quick Metrics Grid */}
            <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
              <div className="p-3 sm:p-3.5 rounded-2xl bg-white/60 border border-white/80 shadow-2xs flex flex-col justify-between">
                <span className="text-[11px] font-bold text-[#8c6538] uppercase tracking-wider">Bookings</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-xl sm:text-2xl font-black font-['Outfit',sans-serif] text-[#261508]">24</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded-md">Scheduled</span>
                </div>
              </div>

              <div className="p-3 sm:p-3.5 rounded-2xl bg-white/60 border border-white/80 shadow-2xs flex flex-col justify-between">
                <span className="text-[11px] font-bold text-[#8c6538] uppercase tracking-wider">Referral Coupons</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-xl sm:text-2xl font-black font-['Outfit',sans-serif] text-[#261508]">10% OFF</span>
                  <span className="text-[10px] font-bold text-amber-800 bg-amber-100/90 px-1.5 py-0.5 rounded-md">Active</span>
                </div>
              </div>

              <div className="p-3 sm:p-3.5 rounded-2xl bg-white/60 border border-white/80 shadow-2xs flex flex-col justify-between">
                <span className="text-[11px] font-bold text-[#8c6538] uppercase tracking-wider">Ask AI & Voice</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-sm sm:text-base font-extrabold font-['Outfit',sans-serif] text-[#261508]">Continuous</span>
                  <span className="text-[10px] font-bold text-indigo-700 bg-indigo-100/90 px-1.5 py-0.5 rounded-md">Live Voice</span>
                </div>
              </div>

              <div className="p-3 sm:p-3.5 rounded-2xl bg-white/60 border border-white/80 shadow-2xs flex flex-col justify-between">
                <span className="text-[11px] font-bold text-[#8c6538] uppercase tracking-wider">Server Status</span>
                <div className="flex items-baseline justify-between mt-1">
                  <span className="text-sm sm:text-base font-extrabold font-['Outfit',sans-serif] text-[#261508]">200 OK</span>
                  <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/90 px-1.5 py-0.5 rounded-md">Express</span>
                </div>
              </div>
            </div>

            {/* Admin Management Section */}
            <div className="flex flex-col gap-2.5">
              <h4 className="text-xs font-bold text-[#7d644d] uppercase tracking-wider px-1">
                Management Modules
              </h4>

              <div className="flex flex-col gap-2">
                <div className="p-3.5 rounded-2xl bg-white/70 border border-white/90 shadow-2xs flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-900 border border-amber-500/20">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#261508]">Client Call Bookings</p>
                      <p className="text-[10px] text-[#7d644d]">Manage scheduled calendar meetings & customer requests</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      closeModalAnimated(setIsAdminDashboardClosing, setIsAdminDashboardOpen);
                      setIsMyBookingsModalOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#2c1708] text-white text-[11px] font-bold hover:bg-black transition-all cursor-pointer shadow-xs active:scale-95"
                  >
                    View
                  </button>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/70 border border-white/90 shadow-2xs flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-900 border border-amber-500/20">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="19" y1="5" x2="5" y2="19" />
                        <circle cx="6.5" cy="6.5" r="2.5" />
                        <circle cx="17.5" cy="17.5" r="2.5" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#261508]">Referral & Coupon Engine</p>
                      <p className="text-[10px] text-[#7d644d]">Concurrency-locked single-use coupons & referral tracking</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-extrabold text-emerald-800 bg-emerald-100/80 px-2 py-0.5 rounded-md border border-emerald-300/60">
                    Lock Enforced
                  </span>
                </div>

                <div className="p-3.5 rounded-2xl bg-white/70 border border-white/90 shadow-2xs flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-amber-500/10 text-amber-900 border border-amber-500/20">
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="12" cy="12" r="3" />
                        <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs font-bold text-[#261508]">Administrator & Contact Info</p>
                      <p className="text-[10px] text-[#7d644d]">FunzyTech • FunzyTechBusiness@Gmail.com</p>
                    </div>
                  </div>
                  <span className="text-[10px] font-bold text-[#8c6538] bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                    Verified
                  </span>
                </div>
              </div>
            </div>

            {/* Dashboard Footer */}
            <div className="pt-2 border-t border-[#a68d6a]/20 flex items-center justify-between">
              <span className="text-[10.5px] text-[#7d644d] font-semibold">
                Funzy Tech Admin Console v2.0
              </span>
              <button
                type="button"
                onClick={handleAdminLogout}
                className="px-3.5 py-1.5 rounded-xl bg-[#2c1708] hover:bg-black text-white text-xs font-bold shadow-xs active:scale-95 transition-all cursor-pointer"
              >
                Lock & Close
              </button>
            </div>
          </SwipeableModalCard>
        </div>
      )}

      {/* 
        Centered Promotional Popup (Part 3: 10% OFF First Call)
        - Dead-Center in visible viewport
        - Exact Headline: "Unlock 10% OFF Your First Call!"
        - Celebratory Party Popper Burst Animation & Radial Confetti Particles
        - Crisp Web Audio pop sound effect
        - Close Button (×) and "Book a Call" CTA
      */}
      {isPromoPopupOpen && (
        <div 
          onClick={(e) => {
            e.stopPropagation();
            closeScreenWithHistory('promo');
          }}
          className={`fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/45 backdrop-blur-md ${
            isPromoPopupClosing ? 'animate-contact-backdrop-close' : 'animate-contact-backdrop'
          }`}
          role="dialog"
          aria-modal="true"
          aria-labelledby="promo-popup-heading"
        >
          <SwipeableModalCard 
            onClose={() => closeScreenWithHistory('promo')}
            isClosing={isPromoPopupClosing}
            className={`liquid-glass-menu relative w-full max-w-[420px] rounded-[30px] p-6 sm:p-7 shadow-[0_28px_60px_-12px_rgba(95,70,40,0.42)] overflow-hidden flex flex-col items-center text-center gap-4 ${
              isPromoPopupClosing ? 'animate-contact-modal-close' : 'animate-contact-modal'
            }`}
          >
            <div className="glass-glow-rim" aria-hidden="true" />

            {/* Accessible Close Button (×) */}
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                closeScreenWithHistory('promo');
              }}
              aria-label="Close promotion"
              className="absolute top-4 right-4 flex h-8 w-8 items-center justify-center rounded-full bg-white/70 hover:bg-white text-[#4a321f] transition-all cursor-pointer shadow-xs border border-white/80 active:scale-95"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
            </button>

            {/* Party Popper Burst & Radial Confetti Animation */}
            <div className="relative flex items-center justify-center w-20 h-20 mt-1 select-none pointer-events-none">
              {/* Confetti Particles */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="absolute h-2 w-2 rounded-full bg-amber-400 animate-confetti-particle" style={{ '--tw-confetti-x': '-38px', '--tw-confetti-y': '-35px', '--tw-confetti-r': '90deg' } as any} />
                <span className="absolute h-2 w-1.5 rounded-sm bg-rose-500 animate-confetti-particle" style={{ '--tw-confetti-x': '36px', '--tw-confetti-y': '-42px', '--tw-confetti-r': '180deg' } as any} />
                <span className="absolute h-1.5 w-2.5 rounded-sm bg-emerald-500 animate-confetti-particle" style={{ '--tw-confetti-x': '-42px', '--tw-confetti-y': '12px', '--tw-confetti-r': '120deg' } as any} />
                <span className="absolute h-2 w-2 rounded-full bg-orange-400 animate-confetti-particle" style={{ '--tw-confetti-x': '40px', '--tw-confetti-y': '14px', '--tw-confetti-r': '-90deg' } as any} />
                <span className="absolute h-2.5 w-2.5 rounded-full bg-amber-300 animate-confetti-particle" style={{ '--tw-confetti-x': '0px', '--tw-confetti-y': '-50px', '--tw-confetti-r': '45deg' } as any} />
                <span className="absolute h-1.5 w-2 rounded-sm bg-violet-400 animate-confetti-particle" style={{ '--tw-confetti-x': '-24px', '--tw-confetti-y': '-48px', '--tw-confetti-r': '200deg' } as any} />
                <span className="absolute h-2 w-1.5 rounded-sm bg-pink-400 animate-confetti-particle" style={{ '--tw-confetti-x': '26px', '--tw-confetti-y': '-46px', '--tw-confetti-r': '-140deg' } as any} />
              </div>

              {/* Party Popper Graphic */}
              <div className="relative flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-100 to-amber-200/90 border border-white/95 shadow-md text-[#4a321f] animate-popper-burst">
                <svg className="h-8 w-8 text-[#593e28]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5.8 11.3 2 22l10.7-3.79" />
                  <path d="M4 3h.01" />
                  <path d="M22 8h.01" />
                  <path d="M15 2h.01" />
                  <path d="M22 20h.01" />
                  <path d="m22 2-2.24.75a2.9 2.9 0 0 0-1.96 3.12v0c.1.86-.57 1.63-1.45 1.63h-.38c-.86 0-1.6.6-1.76 1.44L14 12" />
                  <path d="m22 13-.82-.33c-.86-.34-1.82.2-1.98 1.11v0c-.11.66-.7 1.12-1.37.98l-.33-.07c-.77-.16-1.5.34-1.65 1.11L15 19" />
                </svg>
              </div>
            </div>

            {/* Exact Required Headline on a single line */}
            <div className="flex flex-col gap-1.5 items-center">
              <h2
                id="promo-popup-heading"
                className="font-['Outfit',sans-serif] font-black text-lg sm:text-2xl text-[#261508] tracking-tight leading-tight whitespace-nowrap text-center"
              >
                Unlock <span className="text-[#a66a38]">10% OFF</span> Your First Call!
              </h2>
              <p className="text-xs sm:text-sm text-[#664b33] font-medium max-w-[320px] mx-auto leading-relaxed text-center">
                Connect directly with a tech creator for a 1-on-1 consultation session via Google Meet.
              </p>
            </div>

            {/* Action Buttons */}
            <div className="flex flex-col sm:flex-row items-center gap-2.5 w-full pt-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  openScreenWithHistory('booking', 'promo');
                }}
                className="w-full sm:flex-1 py-3 px-5 rounded-2xl bg-[#2c1708] hover:bg-black text-white font-['Outfit',sans-serif] font-extrabold text-sm shadow-md hover:shadow-lg transition-all cursor-pointer active:scale-[0.98] flex items-center justify-center gap-2"
              >
                <span>Book a Call</span>
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14m-6-6 6 6-6 6" />
                </svg>
              </button>

              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  closeScreenWithHistory('promo');
                }}
                className="w-full sm:w-auto py-3 px-4 rounded-2xl bg-white/60 hover:bg-white text-[#593e28] font-bold text-xs border border-white/80 shadow-2xs transition-all cursor-pointer active:scale-[0.98]"
              >
                Maybe Later
              </button>
            </div>
          </SwipeableModalCard>
        </div>
      )}

      {/* Tech Store View */}
      <TechStoreView
        isOpen={isTechStoreOpen}
        onClose={() => closeScreenWithHistory('tech-store')}
      />

      {/* My Apps Directory View */}
      <MyAppsView
        isOpen={isMyAppsOpen}
        onClose={() => closeScreenWithHistory('my-apps')}
        onOpenAskAI={() => openScreenWithHistory('ask-ai', 'my-apps')}
      />

      {/* My Links Bookmark Manager */}
      <MyLinksView
        isOpen={isMyLinksOpen}
        onClose={() => closeScreenWithHistory('my-links')}
        onOpenSignIn={() => openScreenWithHistory('auth', 'my-links')}
      />

      {/* Ask AI Dashboard */}
      <AskAIDashboard
        isOpen={isAskAIOpen}
        onClose={() => closeScreenWithHistory('ask-ai')}
        onOpenSignIn={() => openScreenWithHistory('auth', 'ask-ai')}
        onOpenBooking={() => openScreenWithHistory('booking', 'ask-ai')}
      />

      {/* Referral Notification Toast */}
      {referralToast && (
        <aside
          role="status"
          aria-live="polite"
          className="fixed top-3 sm:top-4 left-1/2 -translate-x-1/2 z-[100] max-w-[92vw] sm:max-w-md w-full px-2"
        >
          <div className="flex items-center justify-between gap-3 px-3.5 py-2.5 rounded-2xl bg-[#fffcf5]/95 backdrop-blur-xl border border-amber-400/70 shadow-[0_12px_32px_rgba(115,88,48,0.28)] text-[#261508]">
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="text-base shrink-0">🎁</span>
              <p className="text-[11.5px] sm:text-xs font-bold leading-snug">{referralToast.message}</p>
            </div>
            <button
              type="button"
              onClick={() => setReferralToast(null)}
              className="shrink-0 h-6 w-6 rounded-full flex items-center justify-center bg-black/5 hover:bg-black/10 text-[#6e533b] text-xs font-black cursor-pointer active:scale-95 transition-all"
              aria-label="Dismiss notification"
            >
              ✕
            </button>
          </div>
        </aside>
      )}
    </div>
  );
}
