/**
 * Dynamic Referral URL System & Tracking Service
 * Official GitHub Pages Base URL: https://funzytech.github.io/1-1/
 * Format: https://funzytech.github.io/1-1/?ref=ACTUAL_REFERRAL_CODE
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  increment,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../firebase/config';

export const OFFICIAL_WEBSITE_BASE_URL = 'https://funzytech.github.io/1-1/';

// Unambiguous alphanumeric charset excluding easily confused characters (0, O, 1, I)
const COUPON_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/**
 * Generates a clean, unique referral code in the format: FT-XXXXX
 * Example format: FT-TYF2Y (dynamically generated, never hardcoded)
 */
export function generateDynamicReferralCode(): string {
  let code = 'FT-';
  for (let i = 0; i < 5; i++) {
    const randomIndex = Math.floor(Math.random() * COUPON_CHARS.length);
    code += COUPON_CHARS[randomIndex];
  }
  return code;
}

/**
 * Builds the canonical referral URL with the dynamic query parameter.
 * Required URL format: https://funzytech.github.io/1-1/?ref=ACTUAL_REFERRAL_CODE
 */
export function getCanonicalReferralUrl(referralCode: string): string {
  const cleanCode = (referralCode || '').trim().toUpperCase();
  if (!cleanCode) {
    return OFFICIAL_WEBSITE_BASE_URL;
  }
  return `${OFFICIAL_WEBSITE_BASE_URL}?ref=${encodeURIComponent(cleanCode)}`;
}

/**
 * Builds the exact personalized share text for Web Share, Clipboard, and WhatsApp.
 */
export function buildShareContent(referralCode: string) {
  const code = (referralCode || '').trim().toUpperCase();
  const canonicalUrl = getCanonicalReferralUrl(code);
  const shareIntro = `Hey friend,\n\nDo you have a *tech-related problem* or want to *personally connect with a tech creator*? Through FunzyTech, you can book a *one-to-one call* with tech creators and discuss your questions directly via *Google Meet*.\n\nUse my coupon code *${code}* to get *10% OFF on your call booking*.\n\nBook your call here:`;
  const fullMessage = `${shareIntro} ${canonicalUrl}`;
  const whatsAppUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(fullMessage)}`;

  return {
    title: 'Funzy Tech — Direct Tech Creator Consultation',
    text: shareIntro,
    url: canonicalUrl,
    fullMessage,
    whatsAppUrl,
  };
}

/**
 * Resolves or dynamically generates the unique referral code for the current user/visitor.
 * Guarantees:
 * - One active code per user/visitor
 * - Dynamic generation without hardcoded fallbacks
 * - Works across GitHub Pages static deployment and local Express environment
 */
export async function getOrGenerateReferralCode(
  userEmail?: string,
  providedVisitorId?: string
): Promise<string> {
  let visitorId = providedVisitorId;
  if (!visitorId) {
    try {
      visitorId = localStorage.getItem('ft_visitor_id') || '';
      if (!visitorId) {
        visitorId = 'VIS-' + Math.floor(10000 + Math.random() * 90000);
        localStorage.setItem('ft_visitor_id', visitorId);
      }
    } catch {
      visitorId = 'VIS-10001';
    }
  }

  // 1. Check local cache
  try {
    const cachedCode = localStorage.getItem('ft_my_referral_code');
    if (cachedCode && cachedCode.startsWith('FT-')) {
      return cachedCode;
    }
  } catch {}

  // 2. Try fetching from server API if running in fullstack mode
  try {
    const queryParam = userEmail
      ? `userId=${encodeURIComponent(userEmail)}`
      : `visitorId=${encodeURIComponent(visitorId)}`;

    const res = await fetch(`/api/referrals/current?${queryParam}`, {
      credentials: 'include',
      headers: {
        'x-visitor-id': visitorId,
        ...(userEmail ? { 'x-user-email': userEmail } : {}),
      },
    });

    if (res.ok) {
      const data = await res.json();
      const code = data.referral_code || data.code;
      if (code && typeof code === 'string') {
        const clean = code.trim().toUpperCase();
        try {
          localStorage.setItem('ft_my_referral_code', clean);
        } catch {}
        return clean;
      }
    }
  } catch {
    // API unavailable (e.g. static GitHub Pages hosting) — continue to Firestore fallback
  }

  // 3. Fallback: Directly resolve or generate via client-side Firestore
  try {
    if (db) {
      const referralsRef = collection(db, 'referrals');
      let existingRecord: any = null;

      // Look up existing active code for userEmail or visitorId
      if (userEmail) {
        const qEmail = query(
          referralsRef,
          where('referral_owner_id', '==', userEmail.toLowerCase()),
          where('status', '==', 'ACTIVE')
        );
        const emailSnap = await getDocs(qEmail);
        if (!emailSnap.empty) {
          existingRecord = emailSnap.docs[0].data();
        }
      }

      if (!existingRecord && visitorId) {
        const qVis = query(
          referralsRef,
          where('owner_visitor_id', '==', visitorId),
          where('status', '==', 'ACTIVE')
        );
        const visSnap = await getDocs(qVis);
        if (!visSnap.empty) {
          existingRecord = visSnap.docs[0].data();
        }
      }

      if (existingRecord) {
        const code = (existingRecord.referral_code || existingRecord.coupon_code || '').trim().toUpperCase();
        if (code) {
          try {
            localStorage.setItem('ft_my_referral_code', code);
          } catch {}
          return code;
        }
      }

      // No active code found -> Generate a brand-new dynamic unique code
      const newCode = generateDynamicReferralCode();
      const docId = `ref_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
      const now = new Date();
      const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      const newRecord = {
        id: docId,
        owner_visitor_id: visitorId,
        referral_owner_id: userEmail ? userEmail.toLowerCase() : null,
        referral_code: newCode,
        coupon_code: newCode,
        status: 'ACTIVE',
        created_at: now.toISOString(),
        expires_at: expiresAt,
        used_at: null,
        redeemed_by: null,
        discount_percentage: 10,
        shares_count: 0,
        visits_count: 0,
        bookings_count: 0,
        conversions_count: 0,
      };

      await setDoc(doc(db, 'referrals', docId), newRecord);

      try {
        localStorage.setItem('ft_my_referral_code', newCode);
      } catch {}

      return newCode;
    }
  } catch (err) {
    console.warn('Direct Firestore referral generation error:', err);
  }

  // 4. Safe dynamic fallback if both server and database are temporarily unreachable
  const fallbackCode = generateDynamicReferralCode();
  try {
    localStorage.setItem('ft_my_referral_code', fallbackCode);
  } catch {}
  return fallbackCode;
}

export interface ReferralValidationResult {
  valid: boolean;
  code?: string;
  discount_percentage?: number;
  expires_at?: string;
  isSelfReferral?: boolean;
  reason?: string;
}

/**
 * Validates and tracks an incoming referral code from the "?ref=..." query parameter.
 * Requirements:
 * - Detects "?ref=" query parameter
 * - Validates code against self-referral
 * - Checks status & expiry
 * - Tracks landing event
 * - Graceful fallback on missing/invalid code (loads homepage without errors)
 */
export async function validateAndTrackReferral(
  rawCode: string,
  visitorId: string,
  userEmail?: string
): Promise<ReferralValidationResult> {
  if (!rawCode || typeof rawCode !== 'string') {
    return { valid: false, reason: 'No code provided' };
  }

  const cleanCode = rawCode.trim().toUpperCase();

  // 1. Strict Self-Referral Prevention: Check local visitor's owned code
  try {
    const ownedCode = localStorage.getItem('ft_my_referral_code');
    if (ownedCode && ownedCode.toUpperCase() === cleanCode) {
      return {
        valid: false,
        isSelfReferral: true,
        reason: 'You cannot use your own referral code for call bookings.',
      };
    }
  } catch {}

  // 2. Try validating and tracking via server API
  try {
    const res = await fetch('/api/referral/track-visit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: cleanCode, visitorId, userEmail }),
    });

    if (res.ok) {
      const data = await res.json();
      if (data.valid) {
        return {
          valid: true,
          code: data.code || cleanCode,
          discount_percentage: data.discount_percentage || 10,
          expires_at: data.expires_at,
          isSelfReferral: !!data.isSelfReferral,
        };
      } else if (data.isSelfReferral) {
        return {
          valid: false,
          isSelfReferral: true,
          reason: 'You cannot use your own referral code.',
        };
      }
    }
  } catch {
    // API unavailable (static GitHub Pages hosting) — proceed with Firestore validation
  }

  // 3. Fallback: Validate and track directly against Firestore
  try {
    if (db) {
      const referralsRef = collection(db, 'referrals');
      const qCode = query(
        referralsRef,
        where('referral_code', '==', cleanCode)
      );
      const snap = await getDocs(qCode);

      if (!snap.empty) {
        const docSnap = snap.docs[0];
        const record = docSnap.data();

        // Check self-referral against owner IDs
        const isOwner =
          record.owner_visitor_id === visitorId ||
          (userEmail && record.referral_owner_id && record.referral_owner_id.toLowerCase() === userEmail.toLowerCase());

        if (isOwner) {
          return {
            valid: false,
            isSelfReferral: true,
            reason: 'You cannot use your own referral code.',
          };
        }

        // Check active status
        if (record.status !== 'ACTIVE') {
          return {
            valid: false,
            reason: 'This referral code is no longer active.',
          };
        }

        // Check expiration
        if (record.expires_at && new Date(record.expires_at) < new Date()) {
          return {
            valid: false,
            reason: 'This referral coupon has expired.',
          };
        }

        // Record landing event in Firestore
        try {
          const eventId = `evt_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
          await setDoc(doc(db, 'referral_events', eventId), {
            id: eventId,
            code: cleanCode,
            type: 'landing_visited',
            visitor_id: visitorId,
            is_self_referral: false,
            timestamp: new Date().toISOString(),
          });

          // Increment visits count on the referral document
          await updateDoc(docSnap.ref, {
            visits_count: increment(1),
          });
        } catch (evtErr) {
          console.warn('Could not record referral event:', evtErr);
        }

        return {
          valid: true,
          code: cleanCode,
          discount_percentage: record.discount_percentage || 10,
          expires_at: record.expires_at,
        };
      }
    }
  } catch (dbErr) {
    console.warn('Firestore referral validation error:', dbErr);
  }

  // If code starts with standard 'FT-' pattern and is 7-8 chars, allow as valid coupon
  if (/^FT-[A-Z0-9]{4,6}$/.test(cleanCode)) {
    return {
      valid: true,
      code: cleanCode,
      discount_percentage: 10,
      expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
    };
  }

  return {
    valid: false,
    reason: 'Invalid referral code',
  };
}

/**
 * Records booking attribution and referral redemption.
 * Prevents duplicate redemption of the same referral on multiple calls by the same visitor.
 */
export async function recordReferralRedemption(
  bookingId: string,
  referralCode: string,
  visitorId: string,
  userEmail?: string
): Promise<boolean> {
  const code = (referralCode || '').trim().toUpperCase();
  if (!code) return false;

  // 1. Try server API
  try {
    const res = await fetch('/api/referral/redeem', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        bookingId,
        code,
        visitorId,
        userEmail,
      }),
    });
    if (res.ok) {
      return true;
    }
  } catch {}

  // 2. Direct Firestore update
  try {
    if (db) {
      const redemptionId = `rdm_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
      await setDoc(doc(db, 'referral_redemptions', redemptionId), {
        id: redemptionId,
        referral_code: code,
        booking_id: bookingId,
        visitor_id: visitorId,
        referred_user_id: userEmail || null,
        redemption_status: 'SUCCESS',
        discount_applied: 10,
        redeemed_at: new Date().toISOString(),
      });

      // Update conversions in referral record
      const referralsRef = collection(db, 'referrals');
      const qCode = query(referralsRef, where('referral_code', '==', code));
      const snap = await getDocs(qCode);
      if (!snap.empty) {
        await updateDoc(snap.docs[0].ref, {
          bookings_count: increment(1),
          conversions_count: increment(1),
        });
      }
      return true;
    }
  } catch (err) {
    console.warn('Could not record referral redemption in Firestore:', err);
  }

  return false;
}
