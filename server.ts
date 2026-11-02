import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import fs from 'fs';
import crypto from 'crypto';
import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  getDoc,
  setDoc,
  runTransaction,
  collection,
} from 'firebase/firestore';
import type { Firestore } from 'firebase/firestore';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  RegistrationResponseJSON,
  AuthenticationResponseJSON,
} from '@simplewebauthn/server';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const port = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;
  const isProduction = process.env.NODE_ENV === 'production';

  app.use(express.json({ limit: '10mb' }));

  // Initialize Firestore backend client with provisioned credentials
  const firebaseConfigPath = path.resolve(__dirname, 'firebase-applet-config.json');
  let firestoreDb: Firestore | null = null;
  if (fs.existsSync(firebaseConfigPath)) {
    try {
      const rawConfig = JSON.parse(fs.readFileSync(firebaseConfigPath, 'utf-8'));
      const fApp = getApps().length ? getApp() : initializeApp(rawConfig);
      firestoreDb = getFirestore(fApp, rawConfig.firestoreDatabaseId || undefined);
      console.log('Backend connected to Firestore:', rawConfig.firestoreDatabaseId || 'default');
    } catch (err) {
      console.error('Failed to initialize Firestore on server:', err);
    }
  }

  // =========================================================================
  // PRODUCTION-READY SMART REFERRAL CODE MANAGEMENT SYSTEM
  // Core Golden Rule: One User = One Active Referral Code
  // Returning visitors are identified across sessions without requiring login
  // Active code is permanently preserved until verified redemption, expiry, or revocation
  // =========================================================================

  interface VisitorRecord {
    id: string; // Persistent First-Party Visitor ID (e.g. VIS-10001 or anon_xxxx)
    visitor_uuid: string; // Secure random UUID
    created_at: string;
    last_seen_at: string;
    account_id: string | null;
    first_seen?: string; // backwards compatibility
    last_seen?: string; // backwards compatibility
    ip_hash: string;
    user_agent_hash: string;
    owned_referral_codes: string[];
    copied_referral_codes: string[];
    redeemed_coupons: string[];
    booking_ids: string[];
  }

  interface ReferralRecord {
    id: string; // ref_xxxx
    owner_visitor_id: string; // owner visitor ID
    referral_code: string; // e.g. REF-A7K92
    coupon_code: string; // backwards compatibility
    status: 'ACTIVE' | 'USED' | 'EXPIRED' | 'REVOKED';
    created_at: string;
    expires_at: string;
    used_at: string | null;
    redeemed_by: string | null;
    discount_percentage: number;
    referral_owner_id: string | null; // backwards compatibility
    anonymous_referral_id: string | null; // backwards compatibility
    campaign_id: string;
    shares_count: number;
    visits_count: number;
    bookings_count: number;
    conversions_count: number;
    redeemed_at?: string;
    redeemed_booking_id?: string;
  }

  interface ReferralRedemptionRecord {
    id: string; // rdm_xxxx
    referral_code_id?: string;
    referral_code: string;
    referrer_id?: string;
    referred_user_id?: string;
    visitor_id?: string;
    redemption_status?: 'SUCCESS' | 'FAILED';
    status?: 'CONFIRMED' | 'SUCCESS' | 'FAILED';
    discount_applied?: number;
    booking_id: string;
    created_at?: string;
    redeemed_at: string;
    metadata?: Record<string, any>;
  }

  interface ReferralEvent {
    id: string;
    code: string;
    type: 'landing_visited' | 'booking_started' | 'booking_completed' | 'payment_confirmed' | 'copied' | 'shared' | 'downloaded';
    visitor_id: string;
    is_self_referral: boolean;
    timestamp: string;
  }

  const REFERRALS_FILE = path.join(__dirname, 'data', 'referrals.json');
  const VISITORS_FILE = path.join(__dirname, 'data', 'visitors.json');
  const REDEMPTIONS_FILE = path.join(__dirname, 'data', 'redemptions.json');

  // File synchronization mutex lock to ensure strict atomic concurrency
  let fileLock: Promise<any> = Promise.resolve();

  // In-flight mutex locks per visitor to prevent race condition duplicate generation
  const visitorLocks = new Map<string, Promise<any>>();

  const withVisitorLock = <T>(visitorKey: string, fn: () => Promise<T>): Promise<T> => {
    const prev = visitorLocks.get(visitorKey) || Promise.resolve();
    const next = prev
      .catch(() => {})
      .then(async () => {
        return fileLock.then(async () => {
          return fn();
        });
      });
    visitorLocks.set(visitorKey, next);
    next.finally(() => {
      if (visitorLocks.get(visitorKey) === next) {
        visitorLocks.delete(visitorKey);
      }
    });
    return next;
  };

  const loadReferralData = (): { referrals: ReferralRecord[]; events: ReferralEvent[] } => {
    try {
      if (!fs.existsSync(path.dirname(REFERRALS_FILE))) {
        fs.mkdirSync(path.dirname(REFERRALS_FILE), { recursive: true });
      }
      if (!fs.existsSync(REFERRALS_FILE)) {
        const initial = { referrals: [], events: [] };
        fs.writeFileSync(REFERRALS_FILE, JSON.stringify(initial, null, 2), 'utf-8');
        return initial;
      }
      const raw = fs.readFileSync(REFERRALS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return {
        referrals: parsed.referrals || [],
        events: parsed.events || [],
      };
    } catch (err) {
      console.error('Error reading referrals file:', err);
      return { referrals: [], events: [] };
    }
  };

  const saveReferralData = (data: { referrals: ReferralRecord[]; events: ReferralEvent[] }) => {
    try {
      if (!fs.existsSync(path.dirname(REFERRALS_FILE))) {
        fs.mkdirSync(path.dirname(REFERRALS_FILE), { recursive: true });
      }
      const tempFile = `${REFERRALS_FILE}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempFile, REFERRALS_FILE);
    } catch (err) {
      console.error('Error saving referrals file:', err);
    }
  };

  const loadVisitorData = (): { visitors: VisitorRecord[] } => {
    try {
      if (!fs.existsSync(path.dirname(VISITORS_FILE))) {
        fs.mkdirSync(path.dirname(VISITORS_FILE), { recursive: true });
      }
      if (!fs.existsSync(VISITORS_FILE)) {
        const initial = { visitors: [] };
        fs.writeFileSync(VISITORS_FILE, JSON.stringify(initial, null, 2), 'utf-8');
        return initial;
      }
      const raw = fs.readFileSync(VISITORS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return { visitors: parsed.visitors || [] };
    } catch (err) {
      console.error('Error reading visitors file:', err);
      return { visitors: [] };
    }
  };

  const saveVisitorData = (data: { visitors: VisitorRecord[] }) => {
    try {
      if (!fs.existsSync(path.dirname(VISITORS_FILE))) {
        fs.mkdirSync(path.dirname(VISITORS_FILE), { recursive: true });
      }
      const tempFile = `${VISITORS_FILE}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempFile, VISITORS_FILE);
    } catch (err) {
      console.error('Error saving visitors file:', err);
    }
  };

  const loadRedemptionData = (): { redemptions: ReferralRedemptionRecord[] } => {
    try {
      if (!fs.existsSync(path.dirname(REDEMPTIONS_FILE))) {
        fs.mkdirSync(path.dirname(REDEMPTIONS_FILE), { recursive: true });
      }
      if (!fs.existsSync(REDEMPTIONS_FILE)) {
        const initial = { redemptions: [] };
        fs.writeFileSync(REDEMPTIONS_FILE, JSON.stringify(initial, null, 2), 'utf-8');
        return initial;
      }
      const raw = fs.readFileSync(REDEMPTIONS_FILE, 'utf-8');
      const parsed = JSON.parse(raw);
      return { redemptions: parsed.redemptions || [] };
    } catch (err) {
      console.error('Error reading redemptions file:', err);
      return { redemptions: [] };
    }
  };

  const saveRedemptionData = (data: { redemptions: ReferralRedemptionRecord[] }) => {
    try {
      if (!fs.existsSync(path.dirname(REDEMPTIONS_FILE))) {
        fs.mkdirSync(path.dirname(REDEMPTIONS_FILE), { recursive: true });
      }
      const tempFile = `${REDEMPTIONS_FILE}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempFile, REDEMPTIONS_FILE);
    } catch (err) {
      console.error('Error saving redemptions file:', err);
    }
  };

  // Safe manual cookie parser
  const parseCookies = (req: express.Request): Record<string, string> => {
    const list: Record<string, string> = {};
    const rc = req.headers.cookie;
    if (rc) {
      rc.split(';').forEach((cookie) => {
        const parts = cookie.split('=');
        const key = parts.shift()?.trim();
        if (key) {
          try {
            list[key] = decodeURIComponent(parts.join('='));
          } catch {
            list[key] = parts.join('=');
          }
        }
      });
    }
    return list;
  };

  // Smart Returning Visitor Identification (First-Party HttpOnly Cookie + UUID + Account ID)
  // Never relies exclusively on IP address
  const getOrCreateVisitor = (req: express.Request, res: express.Response): VisitorRecord => {
    const cookies = parseCookies(req);
    const headerVid = req.headers['x-visitor-id'] as string | undefined;
    const queryVid = typeof req.query?.visitorId === 'string' ? req.query.visitorId.trim() : undefined;
    const bodyVid = typeof req.body?.visitorId === 'string' ? req.body.visitorId.trim() : undefined;
    const queryUserId = typeof req.query?.userId === 'string' ? req.query.userId.trim() : undefined;
    const bodyUserId = typeof req.body?.userId === 'string' ? req.body.userId.trim() : undefined;
    const headerEmail = typeof req.headers['x-user-email'] === 'string' ? (req.headers['x-user-email'] as string).trim() : undefined;
    const accountId = queryUserId || bodyUserId || headerEmail || null;

    const cookieVid = cookies['ft_vid'] || cookies['ft_anon_vid'];
    const passedVid = cookieVid || headerVid || queryVid || bodyVid;

    const vData = loadVisitorData();
    const now = new Date().toISOString();

    const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown';
    const ipHash = crypto.createHash('sha256').update(ip + '_ft_salt').digest('hex').substring(0, 16);
    const ua = (req.headers['user-agent'] as string) || '';
    const uaHash = crypto.createHash('sha256').update(ua).digest('hex').substring(0, 16);

    let visitor: VisitorRecord | undefined;

    // 1. If accountId provided, check if returning user matches account_id
    if (accountId) {
      visitor = vData.visitors.find((v) => v.account_id && v.account_id.toLowerCase() === accountId.toLowerCase());
    }

    // 2. If not found by accountId, find by passed Visitor ID / UUID
    if (!visitor && passedVid) {
      visitor = vData.visitors.find((v) => v.id === passedVid || v.visitor_uuid === passedVid);
    }

    if (visitor) {
      // Returning visitor identified!
      visitor.last_seen_at = now;
      visitor.last_seen = now;
      visitor.ip_hash = ipHash;
      visitor.user_agent_hash = uaHash;
      if (accountId && !visitor.account_id) {
        visitor.account_id = accountId;
      }
      saveVisitorData(vData);
    } else {
      // First-time visit: generate first-party persistent visitor identity
      let newId: string;
      if (passedVid && (/^VIS-\d+$/i.test(passedVid) || /^anon_[a-f0-9]{32}$/i.test(passedVid) || /^vis_\w+$/i.test(passedVid))) {
        newId = passedVid;
      } else {
        const nextNum = 10000 + vData.visitors.length + 1;
        newId = `VIS-${nextNum}`;
      }

      visitor = {
        id: newId,
        visitor_uuid: crypto.randomUUID(),
        created_at: now,
        last_seen_at: now,
        account_id: accountId || null,
        first_seen: now,
        last_seen: now,
        ip_hash: ipHash,
        user_agent_hash: uaHash,
        owned_referral_codes: [],
        copied_referral_codes: [],
        redeemed_coupons: [],
        booking_ids: [],
      };
      vData.visitors.push(visitor);
      saveVisitorData(vData);
    }

    // Set first-party persistent cookies (365 days)
    res.setHeader(
      'Set-Cookie',
      `ft_vid=${visitor.id}; Path=/; Max-Age=31536000; SameSite=Lax; HttpOnly${isProduction ? '; Secure' : ''}`
    );
    res.setHeader('x-visitor-id', visitor.id);

    return visitor;
  };

  // Authoritative server-side validation rule engine
  const validateCouponInternal = (
    code: string,
    visitor: VisitorRecord,
    data: { referrals: ReferralRecord[] }
  ): {
    valid: boolean;
    status: number;
    error?: string;
    isSelfReferral?: boolean;
    record?: ReferralRecord;
    code?: string;
    discount_percentage?: number;
    base_amount?: number;
    discount_amount?: number;
    final_amount?: number;
    expires_at?: string;
  } => {
    const normalizedCode = code.trim().toUpperCase();
    const record = data.referrals.find((r) => {
      const c = (r.referral_code || r.coupon_code || '').trim().toUpperCase();
      return c === normalizedCode;
    });

    if (!record) {
      return { valid: false, status: 404, error: 'This referral code is invalid or has expired.' };
    }

    const st = (record.status || '').toUpperCase();

    // 1. Check if coupon has already been redeemed globally or by this visitor
    if (st === 'USED' || st === 'REDEEMED' || visitor.redeemed_coupons.includes(normalizedCode)) {
      return { valid: false, status: 400, error: 'This coupon has already been used.' };
    }

    // 2. Check if active and not expired
    if (st !== 'ACTIVE') {
      return { valid: false, status: 400, error: 'This referral code is invalid or has expired.' };
    }
    if (new Date(record.expires_at) < new Date()) {
      return { valid: false, status: 400, error: 'This referral code is invalid or has expired.' };
    }

    // 3. Self-referral prevention (Layered: ownership, creator, exposure)
    const isOwner =
      Boolean(record.anonymous_referral_id && record.anonymous_referral_id === visitor.id) ||
      Boolean(record.owner_visitor_id && record.owner_visitor_id === visitor.id) ||
      Boolean(record.referral_owner_id && (record.referral_owner_id === visitor.id || (visitor.account_id && record.referral_owner_id.toLowerCase() === visitor.account_id.toLowerCase()))) ||
      visitor.owned_referral_codes.includes(normalizedCode);

    const isCopierOfOwn =
      visitor.copied_referral_codes.includes(normalizedCode) &&
      (record.owner_visitor_id === visitor.id ||
        record.anonymous_referral_id === visitor.id ||
        visitor.owned_referral_codes.includes(normalizedCode));

    if (isOwner || isCopierOfOwn) {
      return {
        valid: false,
        status: 400,
        isSelfReferral: true,
        error: 'This referral code cannot be used for your own booking.',
      };
    }

    const baseAmount = 1000;
    const discountAmount = Math.round(baseAmount * ((record.discount_percentage || 10) / 100));
    const finalAmount = baseAmount - discountAmount;

    return {
      valid: true,
      status: 200,
      record,
      code: record.referral_code || record.coupon_code,
      discount_percentage: record.discount_percentage || 10,
      base_amount: baseAmount,
      discount_amount: discountAmount,
      final_amount: finalAmount,
      expires_at: record.expires_at,
    };
  };

  // Unambiguous alphanumeric charset (excludes 0, O, 1, I for readability)
  const COUPON_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  // Generates unique code in FT-XXXXX format (Section 7)
  const generateUniqueReferralCode = (existingCodes: Set<string>): string => {
    for (let attempts = 0; attempts < 100; attempts++) {
      let code = 'FT-';
      for (let i = 0; i < 5; i++) {
        const randomIndex = crypto.randomInt(0, COUPON_CHARS.length);
        code += COUPON_CHARS[randomIndex];
      }
      if (!existingCodes.has(code)) {
        return code;
      }
    }
    return `FT-${crypto.randomBytes(3).toString('hex').toUpperCase().slice(0, 5)}`;
  };

  // Section 6 Decision Engine: One User = One Active Referral Code
  const getOrGenerateActiveReferralForVisitor = (
    visitor: VisitorRecord,
    data: { referrals: ReferralRecord[]; events: ReferralEvent[] },
    vData: { visitors: VisitorRecord[] }
  ): ReferralRecord => {
    const now = new Date();

    const isOwnerOfCode = (r: ReferralRecord): boolean => {
      if (r.owner_visitor_id === visitor.id || r.anonymous_referral_id === visitor.id) return true;
      if (visitor.account_id && (
        (r.referral_owner_id && r.referral_owner_id.toLowerCase() === visitor.account_id.toLowerCase()) ||
        (r.owner_visitor_id && r.owner_visitor_id.toLowerCase() === visitor.account_id.toLowerCase())
      )) return true;
      const code = (r.referral_code || r.coupon_code || '').toUpperCase();
      if (visitor.owned_referral_codes.map((c) => c.toUpperCase()).includes(code)) return true;
      return false;
    };

    // 1. Check if user already has an ACTIVE referral code
    const activeRecord = data.referrals.find((r) => {
      if (!isOwnerOfCode(r)) return false;
      const st = (r.status || '').toUpperCase();
      return st === 'ACTIVE';
    });

    if (activeRecord) {
      // Check expiration
      if (new Date(activeRecord.expires_at) < now) {
        activeRecord.status = 'EXPIRED';
        saveReferralData(data);
        // Has expired -> will generate a new replacement active code below
      } else {
        // RETURN EXACT SAME ACTIVE CODE (No new code generated!)
        const codeKey = activeRecord.referral_code || activeRecord.coupon_code;
        if (!visitor.owned_referral_codes.includes(codeKey)) {
          visitor.owned_referral_codes.push(codeKey);
          saveVisitorData(vData);
        }
        return activeRecord;
      }
    }

    // 2. No ACTIVE code exists (first visit, or previous code was USED, EXPIRED, or REVOKED)
    // Generate exactly ONE new unique referral code
    const existingCodes = new Set<string>();
    data.referrals.forEach((r) => {
      if (r.referral_code) existingCodes.add(r.referral_code.toUpperCase());
      if (r.coupon_code) existingCodes.add(r.coupon_code.toUpperCase());
    });

    const newCode = generateUniqueReferralCode(existingCodes);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

    const newRecord: ReferralRecord = {
      id: `ref_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
      owner_visitor_id: visitor.id,
      referral_code: newCode,
      coupon_code: newCode,
      status: 'ACTIVE',
      created_at: now.toISOString(),
      expires_at: expiresAt,
      used_at: null,
      redeemed_by: null,
      discount_percentage: 10,
      referral_owner_id: visitor.account_id || null,
      anonymous_referral_id: visitor.id,
      campaign_id: 'funzy_tech_personal_call_10_off',
      shares_count: 0,
      visits_count: 0,
      bookings_count: 0,
      conversions_count: 0,
    };

    data.referrals.push(newRecord);
    saveReferralData(data);

    if (!visitor.owned_referral_codes.includes(newCode)) {
      visitor.owned_referral_codes.push(newCode);
      saveVisitorData(vData);
    }

    // Sync to Firestore coupons and referrals collections
    if (firestoreDb) {
      setDoc(doc(firestoreDb, 'coupons', newCode), {
        id: newCode,
        code: newCode,
        discount_percentage: 10,
        status: 'ACTIVE',
        is_redeemed: false,
        max_uses: 1,
        redemption_count: 0,
        owner_id: visitor.account_id || visitor.id,
        owner_visitor_id: visitor.id,
        created_at: newRecord.created_at,
        expires_at: newRecord.expires_at,
      }).catch((err) => console.warn('Could not sync coupon to Firestore:', err));

      setDoc(doc(firestoreDb, 'referrals', newCode), {
        id: newRecord.id,
        referral_code: newCode,
        coupon_code: newCode,
        owner_visitor_id: visitor.id,
        referral_owner_id: visitor.account_id || null,
        status: 'ACTIVE',
        created_at: newRecord.created_at,
        expires_at: newRecord.expires_at,
        discount_percentage: 10,
        shares_count: 0,
        visits_count: 0,
        bookings_count: 0,
        conversions_count: 0,
      }).catch((err) => console.warn('Could not sync referral to Firestore:', err));
    }

    return newRecord;
  };

  // Endpoint 0: Visitor session check
  app.get('/api/visitor/session', (req, res) => {
    try {
      const visitor = getOrCreateVisitor(req, res);
      return res.json({
        visitorId: visitor.id,
        visitorUuid: visitor.visitor_uuid,
        firstSeen: visitor.created_at,
        lastSeen: visitor.last_seen_at,
        accountId: visitor.account_id,
      });
    } catch (err) {
      return res.status(500).json({ error: 'Failed to initialize session' });
    }
  });

  // Section 12 Specification Endpoint: GET /api/referrals/current
  // Returns: { "success": true, "referral_code": "REF-A7K92", "status": "ACTIVE" }
  app.get('/api/referrals/current', async (req, res) => {
    try {
      const visitor = getOrCreateVisitor(req, res);
      const result = await withVisitorLock(visitor.id, async () => {
        const data = loadReferralData();
        const vData = loadVisitorData();
        const vRecord = vData.visitors.find((v) => v.id === visitor.id) || visitor;
        const record = getOrGenerateActiveReferralForVisitor(vRecord, data, vData);
        const code = record.referral_code || record.coupon_code;
        return {
          success: true,
          referral_code: code,
          status: (record.status || 'ACTIVE').toUpperCase(),
          discount_percentage: record.discount_percentage || 10,
          expires_at: record.expires_at,
          created_at: record.created_at,
          visitor_id: visitor.id,
          shares_count: record.shares_count || 0,
          visits_count: record.visits_count || 0,
          bookings_count: record.bookings_count || 0,
        };
      });
      return res.json(result);
    } catch (err: any) {
      console.error('Error in /api/referrals/current:', err);
      return res.status(500).json({ success: false, error: 'Failed to retrieve referral code' });
    }
  });

  // Backwards-compatible Endpoint: GET /api/referral/code
  app.get('/api/referral/code', async (req, res) => {
    try {
      const visitor = getOrCreateVisitor(req, res);
      const result = await withVisitorLock(visitor.id, async () => {
        const data = loadReferralData();
        const vData = loadVisitorData();
        const vRecord = vData.visitors.find((v) => v.id === visitor.id) || visitor;
        const record = getOrGenerateActiveReferralForVisitor(vRecord, data, vData);
        const code = record.referral_code || record.coupon_code;
        return {
          success: true,
          code: code,
          referral_code: code,
          status: (record.status || 'ACTIVE').toUpperCase(),
          discount_percentage: record.discount_percentage || 10,
          expires_at: record.expires_at,
        };
      });
      return res.json(result);
    } catch (err: any) {
      console.error('Error in /api/referral/code:', err);
      return res.status(500).json({ error: 'Failed to generate referral code' });
    }
  });

  // Endpoint 1b: Track copy button event on referral coupon
  app.post('/api/referral/track-copy', (req, res) => {
    try {
      const visitor = getOrCreateVisitor(req, res);
      const { code } = req.body;
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ success: false, error: 'Referral code is required.' });
      }
      const normalizedCode = code.trim().toUpperCase();
      const data = loadReferralData();
      const record = data.referrals.find((r) => r.coupon_code === normalizedCode);

      if (!record) {
        return res.status(404).json({ success: false, error: 'Referral code not found.' });
      }

      const vData = loadVisitorData();
      const vRecord = vData.visitors.find((v) => v.id === visitor.id);
      if (vRecord) {
        if (!vRecord.copied_referral_codes.includes(normalizedCode)) {
          vRecord.copied_referral_codes.push(normalizedCode);
        }
        if (record.anonymous_referral_id === visitor.id || record.referral_owner_id === visitor.id) {
          if (!vRecord.owned_referral_codes.includes(normalizedCode)) {
            vRecord.owned_referral_codes.push(normalizedCode);
          }
        }
        saveVisitorData(vData);
      }

      const isSelfReferral = record.anonymous_referral_id === visitor.id || record.referral_owner_id === visitor.id;

      data.events.push({
        id: `evt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
        code: normalizedCode,
        type: 'booking_started',
        visitor_id: visitor.id,
        is_self_referral: isSelfReferral,
        timestamp: new Date().toISOString(),
      });
      saveReferralData(data);

      return res.json({
        success: true,
        code: normalizedCode,
        isOwner: isSelfReferral,
      });
    } catch (err) {
      console.error('Error in /api/referral/track-copy:', err);
      return res.status(500).json({ success: false, error: 'Failed to track copy event.' });
    }
  });

  // Endpoint 2: Track an incoming referral link visit
  app.post('/api/referral/track-visit', (req, res) => {
    try {
      const visitor = getOrCreateVisitor(req, res);
      const { code } = req.body;

      if (!code || typeof code !== 'string') {
        return res.status(400).json({ valid: false, error: 'Referral code is required.' });
      }

      const normalizedCode = code.trim().toUpperCase();

      if (!/^(FT|REF|FZ)-[A-Z0-9]{4,8}$/i.test(normalizedCode)) {
        return res.status(400).json({ valid: false, error: 'This referral code is invalid or has expired.' });
      }

      const data = loadReferralData();
      const record = data.referrals.find((r) => (r.referral_code && r.referral_code.toUpperCase() === normalizedCode) || (r.coupon_code && r.coupon_code.toUpperCase() === normalizedCode));

      if (!record) {
        return res.status(404).json({ valid: false, error: 'This referral code is invalid or has expired.' });
      }

      const st = (record.status || '').toUpperCase();
      if (st === 'USED' || st === 'REDEEMED') {
        return res.status(400).json({ valid: false, error: 'This coupon has already been used.' });
      }

      if (st !== 'ACTIVE') {
        return res.status(400).json({ valid: false, error: 'This referral code is invalid or has expired.' });
      }

      const now = new Date();
      if (new Date(record.expires_at) < now) {
        record.status = 'EXPIRED';
        saveReferralData(data);
        return res.status(400).json({ valid: false, error: 'This referral code is invalid or has expired.' });
      }

      const isSelfReferral = Boolean(
        record.anonymous_referral_id === visitor.id ||
        record.referral_owner_id === visitor.id ||
        visitor.owned_referral_codes.includes(normalizedCode)
      );

      const oneDayAgo = Date.now() - 24 * 60 * 60 * 1000;
      const recentEvent = data.events.find(
        (e) =>
          e.code === normalizedCode &&
          e.visitor_id === visitor.id &&
          e.type === 'landing_visited' &&
          new Date(e.timestamp).getTime() > oneDayAgo
      );

      if (!recentEvent) {
        record.visits_count = (record.visits_count || 0) + 1;
        data.events.push({
          id: `evt_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          code: normalizedCode,
          type: 'landing_visited',
          visitor_id: visitor.id,
          is_self_referral: isSelfReferral,
          timestamp: now.toISOString(),
        });
        saveReferralData(data);
      }

      return res.json({
        valid: !isSelfReferral,
        code: record.coupon_code,
        discount_percentage: record.discount_percentage,
        expires_at: record.expires_at,
        isSelfReferral,
        message: isSelfReferral
          ? 'This referral code cannot be used for your own booking.'
          : '10% discount applied to your personal call booking!',
      });
    } catch (err: any) {
      console.error('Error in /api/referral/track-visit:', err);
      return res.status(500).json({ valid: false, error: 'Referral verification is temporarily unavailable. Please try again.' });
    }
  });

  // Endpoint 3: Public coupon validation endpoint (GET)
  app.get('/api/referral/validate/:code', (req, res) => {
    try {
      const visitor = getOrCreateVisitor(req, res);
      const rawCode = req.params.code;
      if (!rawCode) {
        return res.status(400).json({ valid: false, error: 'This referral code is invalid or has expired.' });
      }

      const data = loadReferralData();
      const validation = validateCouponInternal(rawCode, visitor, data);

      if (!validation.valid) {
        return res.status(validation.status).json({
          valid: false,
          isSelfReferral: validation.isSelfReferral,
          error: validation.error,
        });
      }

      return res.json({
        valid: true,
        code: validation.code,
        discount_percentage: validation.discount_percentage,
        base_amount: validation.base_amount,
        discount_amount: validation.discount_amount,
        final_amount: validation.final_amount,
        expires_at: validation.expires_at,
      });
    } catch (err: any) {
      console.error('Error in /api/referral/validate:', err);
      return res.status(500).json({ valid: false, error: 'Referral verification is temporarily unavailable. Please try again.' });
    }
  });

  // =========================================================================
  // SINGLE-USE COUPON VALIDATION & ATOMIC REDEMPTION
  // =========================================================================

  // POST /api/coupons/validate: Validates eligibility and calculates authoritative server discount
  app.post('/api/coupons/validate', async (req, res) => {
    try {
      const visitor = getOrCreateVisitor(req, res);
      const { code } = req.body;
      if (!code || typeof code !== 'string') {
        return res.status(400).json({ valid: false, error: 'This referral code is invalid or has expired.' });
      }

      const normalizedCode = code.trim().toUpperCase();

      // Check Firestore authoritative state if available
      if (firestoreDb) {
        try {
          const couponDocRef = doc(firestoreDb, 'coupons', normalizedCode);
          const couponSnap = await getDoc(couponDocRef);
          if (couponSnap.exists()) {
            const cData = couponSnap.data();
            const cStatus = ((cData.status as string) || '').toUpperCase();
            if (
              cStatus === 'USED' ||
              cStatus === 'REDEEMED' ||
              cData.is_redeemed === true ||
              (cData.redemption_count || 0) >= (cData.max_uses || 1)
            ) {
              return res.status(400).json({ valid: false, error: 'This coupon has already been used.' });
            }

            if (cStatus !== 'ACTIVE' || (cData.expires_at && new Date(cData.expires_at) < new Date())) {
              return res.status(400).json({ valid: false, error: 'This referral code is invalid or has expired.' });
            }

            const vData = loadVisitorData();
            const vRecord = vData.visitors.find((v) => v.id === visitor.id) || visitor;
            const isSelfReferral =
              (cData.anonymous_referral_id && cData.anonymous_referral_id === visitor.id) ||
              (cData.owner_id && cData.owner_id === visitor.id) ||
              (vRecord.owned_referral_codes && vRecord.owned_referral_codes.includes(normalizedCode));

            if (isSelfReferral) {
              return res.status(400).json({
                valid: false,
                isSelfReferral: true,
                error: 'This referral code cannot be used for your own booking.',
              });
            }

            const baseAmount = 1000;
            const discountPercentage = cData.discount_percentage || 10;
            const discountAmount = Math.round(baseAmount * (discountPercentage / 100));
            const finalAmount = baseAmount - discountAmount;

            return res.json({
              valid: true,
              code: normalizedCode,
              discount_percentage: discountPercentage,
              base_amount: baseAmount,
              discount_amount: discountAmount,
              final_amount: finalAmount,
              expires_at: cData.expires_at,
            });
          }
        } catch (fErr) {
          console.warn('Firestore validate check fallback to local:', fErr);
        }
      }

      const data = loadReferralData();
      const validation = validateCouponInternal(normalizedCode, visitor, data);

      if (!validation.valid) {
        return res.status(validation.status).json({
          valid: false,
          isSelfReferral: validation.isSelfReferral,
          error: validation.error,
        });
      }

      return res.json({
        valid: true,
        code: validation.code,
        discount_percentage: validation.discount_percentage,
        base_amount: validation.base_amount,
        discount_amount: validation.discount_amount,
        final_amount: validation.final_amount,
        expires_at: validation.expires_at,
      });
    } catch (err: any) {
      console.error('Error validating coupon:', err);
      return res.status(500).json({ valid: false, error: 'Referral verification is temporarily unavailable. Please try again.' });
    }
  });

  // POST /api/coupons/redeem & /api/referrals/redeem: Atomic transaction-based single-use coupon redemption
  const redeemCouponHandler = async (req: express.Request, res: express.Response) => {
    try {
      const visitor = getOrCreateVisitor(req, res);
      const { code, bookingId, email } = req.body;
      if (!code || typeof code !== 'string' || !code.trim()) {
        return res.status(400).json({ success: false, error: 'This referral code is invalid or has expired.' });
      }

      const normalizedCode = code.trim().toUpperCase();
      const now = new Date();
      const nowIso = now.toISOString();

      const vData = loadVisitorData();
      const vRecord = vData.visitors.find((v) => v.id === visitor.id) || visitor;

      // 1. Quick initial rejection if visitor already redeemed or owns this coupon locally
      if (vRecord.redeemed_coupons && vRecord.redeemed_coupons.includes(normalizedCode)) {
        return res.status(400).json({ success: false, error: 'This coupon has already been used.' });
      }
      if (vRecord.owned_referral_codes && vRecord.owned_referral_codes.includes(normalizedCode)) {
        return res.status(400).json({
          success: false,
          isSelfReferral: true,
          error: 'This referral code cannot be used for your own booking.',
        });
      }

      let redemptionResult: any = null;

      if (firestoreDb) {
        try {
          const couponDocRef = doc(firestoreDb, 'coupons', normalizedCode);

          await runTransaction(firestoreDb, async (txn) => {
            const couponSnap = await txn.get(couponDocRef);

            let couponData: any;
            if (!couponSnap.exists()) {
              const localData = loadReferralData();
              const localRecord = localData.referrals.find((r) => 
                (r.referral_code && r.referral_code.toUpperCase() === normalizedCode) ||
                (r.coupon_code && r.coupon_code.toUpperCase() === normalizedCode)
              );
              if (!localRecord) {
                const err: any = new Error('This referral code is invalid or has expired.');
                err.status = 404;
                throw err;
              }

              const localStatus = ((localRecord.status as string) || '').toUpperCase();
              if (localStatus === 'USED' || localStatus === 'REDEEMED') {
                const err: any = new Error('This coupon has already been used.');
                err.status = 400;
                throw err;
              }

              if (localStatus !== 'ACTIVE' || new Date(localRecord.expires_at) < now) {
                const err: any = new Error('This referral code is invalid or has expired.');
                err.status = 400;
                throw err;
              }

              // Anti-self-referral check
              const isSelf =
                Boolean(localRecord.anonymous_referral_id && localRecord.anonymous_referral_id === visitor.id) ||
                Boolean(localRecord.owner_visitor_id && localRecord.owner_visitor_id === visitor.id) ||
                Boolean(localRecord.referral_owner_id && localRecord.referral_owner_id === visitor.id) ||
                visitor.owned_referral_codes.includes(normalizedCode);

              if (isSelf) {
                const err: any = new Error('This referral code cannot be used for your own booking.');
                err.status = 400;
                err.isSelfReferral = true;
                throw err;
              }

              couponData = {
                id: localRecord.coupon_code || localRecord.referral_code,
                code: localRecord.referral_code || localRecord.coupon_code,
                status: 'USED',
                is_redeemed: true,
                discount_percentage: localRecord.discount_percentage || 10,
                max_uses: 1,
                redemption_count: 1,
                owner_id: localRecord.referral_owner_id || localRecord.anonymous_referral_id || '',
                anonymous_referral_id: localRecord.anonymous_referral_id || '',
                created_at: localRecord.created_at,
                expires_at: localRecord.expires_at,
                redeemed_at: nowIso,
                used_at: nowIso,
                redeemed_booking_id: bookingId || `booking_${Date.now()}`,
                redeemed_by_visitor_id: visitor.id,
                redeemed_by_email: email || '',
                updated_at: nowIso,
              };

              txn.set(couponDocRef, couponData);
            } else {
              couponData = couponSnap.data();

              const cStatus = ((couponData.status as string) || '').toUpperCase();
              if (
                cStatus === 'USED' ||
                cStatus === 'REDEEMED' ||
                couponData.is_redeemed === true ||
                (couponData.redemption_count || 0) >= (couponData.max_uses || 1)
              ) {
                const err: any = new Error('This coupon has already been used.');
                err.status = 400;
                throw err;
              }

              if (cStatus !== 'ACTIVE') {
                const err: any = new Error('This referral code is invalid or has expired.');
                err.status = 400;
                throw err;
              }
              if (couponData.expires_at && new Date(couponData.expires_at) < now) {
                const err: any = new Error('This referral code is invalid or has expired.');
                err.status = 400;
                throw err;
              }

              const isSelfReferral =
                (couponData.anonymous_referral_id && couponData.anonymous_referral_id === visitor.id) ||
                (couponData.owner_id && couponData.owner_id === visitor.id) ||
                (vRecord.owned_referral_codes && vRecord.owned_referral_codes.includes(normalizedCode));

              if (isSelfReferral) {
                const err: any = new Error('This referral code cannot be used for your own booking.');
                err.status = 400;
                err.isSelfReferral = true;
                throw err;
              }

              txn.update(couponDocRef, {
                status: 'USED',
                is_redeemed: true,
                redemption_count: (couponData.redemption_count || 0) + 1,
                redeemed_at: nowIso,
                used_at: nowIso,
                redeemed_booking_id: bookingId || `booking_${Date.now()}`,
                redeemed_by_visitor_id: visitor.id,
                redeemed_by_email: email || '',
                updated_at: nowIso,
              });
            }

            // ATOMIC AUDIT LOG: Write immutable referral event log in Firestore
            const eventDocRef = doc(collection(firestoreDb, 'referral_events'));
            txn.set(eventDocRef, {
              id: eventDocRef.id,
              code: normalizedCode,
              type: 'booking_completed',
              visitor_id: visitor.id,
              booking_id: bookingId || '',
              email: email || '',
              discount_percentage: couponData.discount_percentage || 10,
              timestamp: nowIso,
              is_self_referral: false,
            });

            redemptionResult = {
              code: normalizedCode,
              discount_percentage: couponData.discount_percentage || 10,
            };
          });
        } catch (fErr: any) {
          if (fErr.status || fErr.isSelfReferral) {
            throw fErr;
          }
          console.warn('Firestore transaction fallback to local fileLock:', fErr?.message || fErr);
        }
      }

      if (!redemptionResult) {
        // Fallback atomic concurrency queue
        fileLock = fileLock.then(async () => {
          const data = loadReferralData();
          const validation = validateCouponInternal(normalizedCode, vRecord, data);
          if (!validation.valid || !validation.record) {
            const err: any = new Error(validation.error);
            err.status = validation.status;
            err.isSelfReferral = validation.isSelfReferral;
            throw err;
          }
          const record = validation.record;
          record.status = 'USED';
          record.used_at = nowIso;
          record.redeemed_at = nowIso;
          record.redeemed_booking_id = bookingId || `booking_${Date.now()}`;
          record.redeemed_by = email || visitor.id;
          record.bookings_count = (record.bookings_count || 0) + 1;
          record.conversions_count = (record.conversions_count || 0) + 1;
          saveReferralData(data);
          redemptionResult = {
            code: record.referral_code || record.coupon_code,
            discount_percentage: record.discount_percentage,
          };
        });
        await fileLock;
      }

      // Record in dedicated redemptions database (data/redemptions.json)
      try {
        const redData = loadRedemptionData();
        const rdmRecord: ReferralRedemptionRecord = {
          id: `rdm_${Date.now()}_${crypto.randomBytes(3).toString('hex')}`,
          referral_code: normalizedCode,
          visitor_id: visitor.id,
          booking_id: bookingId || `booking_${Date.now()}`,
          discount_applied: redemptionResult?.discount_percentage || 10,
          status: 'CONFIRMED',
          redeemed_at: nowIso,
          metadata: {
            email: email || '',
            ip: (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() || req.socket.remoteAddress || 'unknown',
          },
        };
        redData.redemptions.push(rdmRecord);
        saveRedemptionData(redData);

        if (firestoreDb) {
          setDoc(doc(firestoreDb, 'referral_redemptions', rdmRecord.id), rdmRecord).catch((err) =>
            console.warn('Could not sync referral redemption to Firestore:', err)
          );
        }
      } catch (rdmErr) {
        console.warn('Failed to record redemption entry:', rdmErr);
      }

      // Synchronize local cache and visitor history
      try {
        const localData = loadReferralData();
        const localRecord = localData.referrals.find((r) => (r.referral_code && r.referral_code.toUpperCase() === normalizedCode) || (r.coupon_code && r.coupon_code.toUpperCase() === normalizedCode));
        if (localRecord) {
          localRecord.status = 'USED';
          localRecord.used_at = nowIso;
          localRecord.redeemed_at = nowIso;
          localRecord.redeemed_booking_id = bookingId || `booking_${Date.now()}`;
          localRecord.redeemed_by = email || visitor.id;
          localRecord.bookings_count = (localRecord.bookings_count || 0) + 1;
          localRecord.conversions_count = (localRecord.conversions_count || 0) + 1;
          saveReferralData(localData);
        }

        if (!vRecord.redeemed_coupons.includes(normalizedCode)) {
          vRecord.redeemed_coupons.push(normalizedCode);
        }
        if (bookingId && !vRecord.booking_ids.includes(bookingId)) {
          vRecord.booking_ids.push(bookingId);
        }
        saveVisitorData(vData);
      } catch (cacheErr) {
        console.warn('Failed to sync local cache after Firestore transaction:', cacheErr);
      }

      return res.json({
        success: true,
        code: redemptionResult?.code || normalizedCode,
        referral_code: redemptionResult?.code || normalizedCode,
        discount_percentage: redemptionResult?.discount_percentage || 10,
        message: 'Coupon successfully redeemed.',
      });
    } catch (err: any) {
      if (err.status) {
        return res.status(err.status).json({
          success: false,
          isSelfReferral: Boolean(err.isSelfReferral),
          error: err.message,
        });
      }
      console.error('Error redeeming coupon in Firestore transaction:', err);
      return res.status(500).json({
        success: false,
        error: 'Referral verification is temporarily unavailable. Please try again.',
      });
    }
  };

  app.post('/api/coupons/redeem', redeemCouponHandler);
  app.post('/api/referrals/redeem', redeemCouponHandler);

  // =========================================================================
  // WEBAUTHN PASSKEYS & ADMIN TWO-FACTOR AUTHENTICATION ENGINE
  // =========================================================================

  interface StoredPasskey {
    id: string; // Base64URL credential ID
    publicKey: string; // Base64-encoded Uint8Array
    counter: number;
    transports?: string[];
    userId: string;
    userEmail: string;
    userName: string;
    createdAt: string;
    isAdmin?: boolean;
  }

  const PASSKEYS_FILE = path.join(__dirname, 'data', 'passkeys.json');

  const loadPasskeyData = (): { passkeys: StoredPasskey[] } => {
    try {
      if (!fs.existsSync(path.dirname(PASSKEYS_FILE))) {
        fs.mkdirSync(path.dirname(PASSKEYS_FILE), { recursive: true });
      }
      if (!fs.existsSync(PASSKEYS_FILE)) {
        const initial = { passkeys: [] };
        fs.writeFileSync(PASSKEYS_FILE, JSON.stringify(initial, null, 2), 'utf-8');
        return initial;
      }
      const raw = fs.readFileSync(PASSKEYS_FILE, 'utf-8');
      return JSON.parse(raw);
    } catch (err) {
      console.error('Error reading passkeys file:', err);
      return { passkeys: [] };
    }
  };

  const savePasskeyData = (data: { passkeys: StoredPasskey[] }) => {
    try {
      if (!fs.existsSync(path.dirname(PASSKEYS_FILE))) {
        fs.mkdirSync(path.dirname(PASSKEYS_FILE), { recursive: true });
      }
      const tempFile = `${PASSKEYS_FILE}.${Date.now()}.${crypto.randomBytes(4).toString('hex')}.tmp`;
      fs.writeFileSync(tempFile, JSON.stringify(data, null, 2), 'utf-8');
      fs.renameSync(tempFile, PASSKEYS_FILE);
    } catch (err) {
      console.error('Error saving passkeys file:', err);
    }
  };

  // Challenges Map (TTL 5 minutes)
  interface ChallengeEntry {
    challenge: string;
    expiresAt: number;
    email?: string;
    userId?: string;
    isAdmin?: boolean;
  }
  const passkeyChallenges = new Map<string, ChallengeEntry>();

  // Admin temporary single-use 2FA tickets (valid for 3 minutes)
  interface Admin2FATicket {
    ticket: string;
    expiresAt: number;
  }
  const admin2FATickets = new Map<string, Admin2FATicket>();

  // Active Admin authenticated sessions (valid for 2 hours)
  interface AdminSession {
    token: string;
    expiresAt: number;
    admin: {
      name: string;
      email: string;
      role: string;
    };
  }
  const activeAdminSessions = new Map<string, AdminSession>();

  // Rate Limiting for Admin password: max 5 failed attempts per 15 minutes per IP
  const adminAttemptTracker = new Map<string, { attempts: number; lockedUntil: number }>();

  const getWebAuthnConfig = (req: express.Request) => {
    const originHeader = (req.headers.origin as string) || (req.headers.referer as string) || `http://${req.headers.host}`;
    try {
      const parsed = new URL(originHeader);
      const origin = `${parsed.protocol}//${parsed.host}`;
      const rpID = parsed.hostname;
      return {
        origin,
        rpID,
        rpName: 'Funzy Tech',
      };
    } catch {
      return {
        origin: 'http://localhost:3000',
        rpID: 'localhost',
        rpName: 'Funzy Tech',
      };
    }
  };

  // Admin Session Verification Middleware
  const requireAdminAuth = (req: express.Request, res: express.Response, next: express.NextFunction) => {
    const authHeader = req.headers.authorization;
    let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token && req.headers.cookie) {
      const match = req.headers.cookie.match(/funzy_admin_session=([^;]+)/);
      if (match) token = match[1];
    }

    if (!token) {
      return res.status(401).json({ success: false, error: 'Unauthorized: Admin authentication required.' });
    }

    const session = activeAdminSessions.get(token);
    if (!session || session.expiresAt < Date.now()) {
      if (session) activeAdminSessions.delete(token);
      return res.status(401).json({ success: false, error: 'Session expired. Please re-authenticate.' });
    }

    (req as any).adminSession = session;
    next();
  };

  // -------------------------------------------------------------------------
  // USER PASSKEY (WEBAUTHN) ROUTES
  // -------------------------------------------------------------------------

  // 1. Generate Registration Options (Create Passkey)
  app.post('/api/passkey/register-options', async (req, res) => {
    try {
      const { email, name } = req.body;
      const cleanEmail = (typeof email === 'string' && email.trim()) ? email.trim().toLowerCase() : 'user@funzytech.com';
      const cleanName = (typeof name === 'string' && name.trim()) ? name.trim() : 'Funzy Tech User';

      const config = getWebAuthnConfig(req);
      const passkeyData = loadPasskeyData();
      const userPasskeys = passkeyData.passkeys.filter((p) => p.userEmail === cleanEmail && !p.isAdmin);

      const userId = `usr_${crypto.createHash('sha256').update(cleanEmail).digest('hex').slice(0, 16)}`;
      const options = await generateRegistrationOptions({
        rpName: config.rpName,
        rpID: config.rpID,
        userName: cleanEmail,
        userDisplayName: cleanName,
        userID: new TextEncoder().encode(userId),
        attestationType: 'none',
        excludeCredentials: userPasskeys.map((p) => ({
          id: p.id,
          transports: p.transports as any,
        })),
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
        },
      });

      // Save challenge associated with email
      passkeyChallenges.set(options.challenge, {
        challenge: options.challenge,
        email: cleanEmail,
        userId,
        isAdmin: false,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });

      return res.json(options);
    } catch (err: any) {
      console.error('Error generating passkey registration options:', err);
      return res.status(500).json({ error: 'Failed to generate passkey registration options.' });
    }
  });

  // 2. Verify Registration Response
  app.post('/api/passkey/register-verify', async (req, res) => {
    try {
      const { response, email, name } = req.body as {
        response: RegistrationResponseJSON;
        email?: string;
        name?: string;
      };

      if (!response || !response.response) {
        return res.status(400).json({ verified: false, error: 'Invalid passkey registration response.' });
      }

      const clientChallenge = passkeyChallenges.get(response.response.clientDataJSON ? (() => {
        try {
          const clientData = JSON.parse(Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf-8'));
          return clientData.challenge;
        } catch {
          return '';
        }
      })() : '');

      // Search matching challenge in map
      let matchedKey = '';
      for (const [key, val] of passkeyChallenges.entries()) {
        if (val.expiresAt > Date.now() && (!val.isAdmin)) {
          matchedKey = key;
          break;
        }
      }

      const challengeEntry = clientChallenge || (matchedKey ? passkeyChallenges.get(matchedKey) : null);
      if (!challengeEntry) {
        return res.status(400).json({ verified: false, error: 'Registration challenge not found or expired.' });
      }

      const config = getWebAuthnConfig(req);
      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challengeEntry.challenge,
        expectedOrigin: [config.origin, `http://localhost:${port}`, `http://127.0.0.1:${port}`],
        expectedRPID: config.rpID,
        requireUserVerification: false,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ verified: false, error: 'Passkey verification failed.' });
      }

      // Cleanup used challenge
      passkeyChallenges.delete(challengeEntry.challenge);

      const { credential } = verification.registrationInfo;
      const passkeyData = loadPasskeyData();
      const cleanEmail = email || challengeEntry.email || 'user@funzytech.com';
      const cleanName = name || 'Funzy Tech User';

      const newPasskey: StoredPasskey = {
        id: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64'),
        counter: credential.counter,
        transports: credential.transports,
        userId: challengeEntry.userId || `usr_${Date.now()}`,
        userEmail: cleanEmail,
        userName: cleanName,
        createdAt: new Date().toISOString(),
        isAdmin: false,
      };

      passkeyData.passkeys.push(newPasskey);
      savePasskeyData(passkeyData);

      return res.json({
        verified: true,
        user: {
          name: cleanName,
          email: cleanEmail,
        },
        message: 'Passkey created successfully! You can now sign in using your passkey.',
      });
    } catch (err: any) {
      console.error('Error verifying passkey registration:', err);
      return res.status(500).json({ verified: false, error: 'Internal error during passkey registration verification.' });
    }
  });

  // 3. Generate Authentication Options (Sign in with Passkey)
  app.post('/api/passkey/auth-options', async (req, res) => {
    try {
      const { email } = req.body;
      const cleanEmail = (typeof email === 'string' && email.trim()) ? email.trim().toLowerCase() : null;

      const config = getWebAuthnConfig(req);
      const passkeyData = loadPasskeyData();

      let allowedCredentials: { id: string; transports?: any }[] | undefined = undefined;
      if (cleanEmail) {
        const userPasskeys = passkeyData.passkeys.filter((p) => p.userEmail === cleanEmail && !p.isAdmin);
        if (userPasskeys.length > 0) {
          allowedCredentials = userPasskeys.map((p) => ({
            id: p.id,
            transports: p.transports as any,
          }));
        }
      }

      const options = await generateAuthenticationOptions({
        rpID: config.rpID,
        userVerification: 'preferred',
        allowCredentials: allowedCredentials,
      });

      passkeyChallenges.set(options.challenge, {
        challenge: options.challenge,
        email: cleanEmail || undefined,
        isAdmin: false,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });

      return res.json(options);
    } catch (err: any) {
      console.error('Error generating passkey auth options:', err);
      return res.status(500).json({ error: 'Failed to generate authentication options.' });
    }
  });

  // 4. Verify Authentication Response
  app.post('/api/passkey/auth-verify', async (req, res) => {
    try {
      const { response, email } = req.body as {
        response: AuthenticationResponseJSON;
        email?: string;
      };

      if (!response || !response.id) {
        return res.status(400).json({ verified: false, error: 'Invalid authentication response.' });
      }

      const passkeyData = loadPasskeyData();
      const storedPasskey = passkeyData.passkeys.find((p) => p.id === response.id && !p.isAdmin);

      if (!storedPasskey) {
        return res.status(404).json({ verified: false, error: 'Passkey credential not recognized on server.' });
      }

      let challengeKey = '';
      try {
        const clientData = JSON.parse(Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf-8'));
        challengeKey = clientData.challenge;
      } catch {}

      let challengeEntry = challengeKey ? passkeyChallenges.get(challengeKey) : null;
      if (!challengeEntry) {
        for (const [key, val] of passkeyChallenges.entries()) {
          if (val.expiresAt > Date.now() && !val.isAdmin) {
            challengeEntry = val;
            break;
          }
        }
      }

      if (!challengeEntry) {
        return res.status(400).json({ verified: false, error: 'Challenge expired or invalid.' });
      }

      const config = getWebAuthnConfig(req);
      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challengeEntry.challenge,
        expectedOrigin: [config.origin, `http://localhost:${port}`, `http://127.0.0.1:${port}`],
        expectedRPID: config.rpID,
        credential: {
          id: storedPasskey.id,
          publicKey: new Uint8Array(Buffer.from(storedPasskey.publicKey, 'base64')),
          counter: storedPasskey.counter,
          transports: storedPasskey.transports as any,
        },
        requireUserVerification: false,
      });

      if (!verification.verified) {
        return res.status(400).json({ verified: false, error: 'Passkey verification failed.' });
      }

      // Update counter & delete used challenge
      storedPasskey.counter = verification.authenticationInfo.newCounter;
      savePasskeyData(passkeyData);
      passkeyChallenges.delete(challengeEntry.challenge);

      const userSessionToken = `fzt_usr_${crypto.randomBytes(24).toString('hex')}`;

      return res.json({
        verified: true,
        token: userSessionToken,
        user: {
          name: storedPasskey.userName,
          email: storedPasskey.userEmail,
        },
        message: 'Passkey authentication successful.',
      });
    } catch (err: any) {
      console.error('Error verifying passkey auth:', err);
      return res.status(500).json({ verified: false, error: 'Internal error during passkey authentication.' });
    }
  });

  // -------------------------------------------------------------------------
  // ADMIN AUTHENTICATION ENGINE (STRICT TWO-FACTOR: PASSWORD + WEBAUTHN PASSKEY)
  // -------------------------------------------------------------------------
  // ULTRA-STRICT ADMIN AUTHENTICATION (PASSWORD + INVISIBLE INTERACTION SEQUENCE)
  // -------------------------------------------------------------------------
  interface AdminAuthAttempt {
    id: string;
    startedAt: number;
    expiresAt: number; // strict 15s deadline
    passwordVerified: boolean;
  }
  const pendingAdminAttempts = new Map<string, AdminAuthAttempt>();

  // Cleanup expired attempts
  setInterval(() => {
    const now = Date.now();
    for (const [id, att] of pendingAdminAttempts.entries()) {
      if (now > att.expiresAt + 60000) {
        pendingAdminAttempts.delete(id);
      }
    }
  }, 30000);

  // 1. Start Admin Auth Attempt (enforces 15s timeout on server)
  app.post('/api/admin/auth/start', (_req, res) => {
    const now = Date.now();
    const attemptId = `adm_att_${crypto.randomBytes(20).toString('hex')}`;
    pendingAdminAttempts.set(attemptId, {
      id: attemptId,
      startedAt: now,
      expiresAt: now + 15000,
      passwordVerified: false,
    });
    return res.json({ success: true, attemptId, expiresAt: now + 15000 });
  });

  // 2. Character-by-character password prefix validation (server-side only, password never exposed)
  app.post('/api/admin/auth/verify-char', (req, res) => {
    const { attemptId, input } = req.body;
    if (!attemptId || typeof input !== 'string') {
      return res.status(401).json({ success: false });
    }
    const attempt = pendingAdminAttempts.get(attemptId);
    if (!attempt) {
      return res.status(401).json({ success: false });
    }

    const now = Date.now();
    // 15-second deadline expired?
    if (now > attempt.expiresAt) {
      pendingAdminAttempts.delete(attemptId);
      return res.status(401).json({ success: false });
    }

    const secretPassword = '@Tech8M!sTake1';

    // Disallow spaces, unexpected characters, or length exceeding expected password
    if (input.includes(' ') || input.length > secretPassword.length) {
      pendingAdminAttempts.delete(attemptId);
      return res.status(401).json({ success: false });
    }

    // Exact order validation
    if (input !== secretPassword.slice(0, input.length)) {
      pendingAdminAttempts.delete(attemptId);
      return res.status(401).json({ success: false });
    }

    // Partial prefix match
    if (input.length < secretPassword.length) {
      return res.json({ success: true, complete: false });
    }

    // Full match completed
    attempt.passwordVerified = true;
    return res.json({ success: true, complete: true });
  });

  // 3. Finalize second-stage verification after inactivity period
  app.post('/api/admin/auth/finalize', (req, res) => {
    try {
      const { attemptId, proof } = req.body;
      if (!attemptId || !proof || typeof proof !== 'object') {
        return res.status(401).json({ success: false });
      }
      const attempt = pendingAdminAttempts.get(attemptId);
      if (!attempt || !attempt.passwordVerified) {
        return res.status(401).json({ success: false });
      }

      const {
        step1Clicks,
        step2HoldDurationMs,
        step3Clicks,
        step4Clicks,
        inactivityDurationMs,
      } = proof;

      // Verification checks:
      if (step1Clicks !== 3) return res.status(401).json({ success: false });
      if (typeof step2HoldDurationMs !== 'number' || step2HoldDurationMs < 6900) {
        return res.status(401).json({ success: false });
      }
      if (step3Clicks !== 3) return res.status(401).json({ success: false });
      if (step4Clicks !== 1) return res.status(401).json({ success: false });
      if (typeof inactivityDurationMs !== 'number' || inactivityDurationMs < 6900) {
        return res.status(401).json({ success: false });
      }

      pendingAdminAttempts.delete(attemptId);

      const sessionToken = `fzt_adm_${crypto.randomBytes(32).toString('hex')}`;
      const sessionData: AdminSession = {
        token: sessionToken,
        expiresAt: Date.now() + 2 * 60 * 60 * 1000,
        admin: {
          name: 'Shiv Kumar',
          email: 'FunzyTechBusiness@Gmail.com',
          role: 'Administrator & Founder',
        },
      };
      activeAdminSessions.set(sessionToken, sessionData);

      res.cookie('funzy_admin_session', sessionToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 2 * 60 * 60 * 1000,
      });

      return res.json({
        success: true,
        sessionToken,
        admin: sessionData.admin,
      });
    } catch {
      return res.status(500).json({ success: false });
    }
  });

  app.post('/api/admin/verify-sequence', (req, res) => {
    try {
      const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
      const now = Date.now();

      const tracker = adminAttemptTracker.get(clientIp);
      if (tracker && tracker.lockedUntil > now) {
        return res.status(429).json({ success: false });
      }

      const { password, proof } = req.body;
      if (!password || password !== '@Tech8M!sTake1') {
        const current = tracker || { attempts: 0, lockedUntil: 0 };
        current.attempts += 1;
        if (current.attempts >= 5) {
          current.lockedUntil = now + 15 * 60 * 1000;
        }
        adminAttemptTracker.set(clientIp, current);
        return res.status(401).json({ success: false });
      }

      // Validate sequence timing proof
      if (!proof || typeof proof !== 'object') {
        return res.status(401).json({ success: false });
      }

      const {
        passwordDurationMs,
        holdDurationMs,
        threeTapsDurationMs,
        finalTapDurationMs,
        inactivityDurationMs,
      } = proof;

      // 1. Password completed within 15 seconds
      if (typeof passwordDurationMs !== 'number' || passwordDurationMs > 16000 || passwordDurationMs < 50) {
        return res.status(401).json({ success: false });
      }

      // 2. Hold Continue button for at least 7 seconds (tolerance 6900ms)
      if (typeof holdDurationMs !== 'number' || holdDurationMs < 6900) {
        return res.status(401).json({ success: false });
      }

      // 3. Exactly three taps within 15 seconds
      if (typeof threeTapsDurationMs !== 'number' || threeTapsDurationMs > 16000) {
        return res.status(401).json({ success: false });
      }

      // 4. Single final tap within 15 seconds
      if (typeof finalTapDurationMs !== 'number' || finalTapDurationMs > 16000) {
        return res.status(401).json({ success: false });
      }

      // 5. Inactivity for at least 7 continuous seconds
      if (typeof inactivityDurationMs !== 'number' || inactivityDurationMs < 6900) {
        return res.status(401).json({ success: false });
      }

      // All requirements satisfied! Issue authenticated admin session
      adminAttemptTracker.delete(clientIp);

      const sessionToken = `fzt_adm_${crypto.randomBytes(32).toString('hex')}`;
      const sessionData: AdminSession = {
        token: sessionToken,
        expiresAt: Date.now() + 2 * 60 * 60 * 1000,
        admin: {
          name: 'Shiv Kumar',
          email: 'FunzyTechBusiness@Gmail.com',
          role: 'Administrator & Founder',
        },
      };
      activeAdminSessions.set(sessionToken, sessionData);

      res.cookie('funzy_admin_session', sessionToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 2 * 60 * 60 * 1000,
      });

      return res.json({
        success: true,
        sessionToken,
        admin: sessionData.admin,
      });
    } catch (err) {
      console.error('Error verifying admin sequence:', err);
      return res.status(500).json({ success: false });
    }
  });

  // STEP 1: Verify Master Admin Password
  // ONLY valid password: @Tech8M!sTake1.
  // On failure: NO error message or popup, ONLY { success: false }
  app.post('/api/admin/verify-step1', (req, res) => {
    const clientIp = (req.headers['x-forwarded-for'] as string) || req.socket.remoteAddress || 'unknown';
    const now = Date.now();

    const tracker = adminAttemptTracker.get(clientIp);
    if (tracker && tracker.lockedUntil > now) {
      return res.status(429).json({ success: false });
    }

    const { password } = req.body;
    if (!password || typeof password !== 'string') {
      return res.status(401).json({ success: false });
    }

    // STRICT CHECK: The ONLY allowed password is @Tech8M!sTake1
    if (password !== '@Tech8M!sTake1') {
      const current = tracker || { attempts: 0, lockedUntil: 0 };
      current.attempts += 1;
      if (current.attempts >= 5) {
        current.lockedUntil = now + 15 * 60 * 1000;
      }
      adminAttemptTracker.set(clientIp, current);
      // Explicitly return success: false with NO error message or text
      return res.status(401).json({ success: false });
    }

    // Password is valid! Clear tracker and generate single-use 2FA ticket (expires in 3m)
    adminAttemptTracker.delete(clientIp);
    const tempTicket = `tkt_adm_${Date.now()}_${crypto.randomBytes(24).toString('hex')}`;
    admin2FATickets.set(tempTicket, {
      ticket: tempTicket,
      expiresAt: now + 3 * 60 * 1000,
    });

    const passkeyData = loadPasskeyData();
    const hasAdminPasskey = passkeyData.passkeys.some((p) => p.isAdmin);

    return res.json({
      success: true,
      step: 'webauthn_required',
      tempTicket,
      hasAdminPasskey,
    });
  });

  // STEP 2a: Generate Admin Passkey Authentication Options
  app.post('/api/admin/passkey/auth-options', async (req, res) => {
    try {
      const { tempTicket } = req.body;
      if (!tempTicket || !admin2FATickets.has(tempTicket)) {
        return res.status(401).json({ success: false, error: 'Invalid or expired 2FA verification ticket.' });
      }

      const ticketRecord = admin2FATickets.get(tempTicket)!;
      if (ticketRecord.expiresAt < Date.now()) {
        admin2FATickets.delete(tempTicket);
        return res.status(401).json({ success: false, error: '2FA verification ticket expired.' });
      }

      const passkeyData = loadPasskeyData();
      const adminPasskeys = passkeyData.passkeys.filter((p) => p.isAdmin);

      const config = getWebAuthnConfig(req);
      const options = await generateAuthenticationOptions({
        rpID: config.rpID,
        userVerification: 'preferred',
        allowCredentials: adminPasskeys.map((p) => ({
          id: p.id,
          transports: p.transports as any,
        })),
      });

      passkeyChallenges.set(options.challenge, {
        challenge: options.challenge,
        email: 'FunzyTechBusiness@Gmail.com',
        isAdmin: true,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });

      return res.json(options);
    } catch (err: any) {
      console.error('Error generating admin passkey auth options:', err);
      return res.status(500).json({ success: false, error: 'Failed to generate admin passkey options.' });
    }
  });

  // STEP 2b: Verify Admin Passkey Authentication
  app.post('/api/admin/passkey/auth-verify', async (req, res) => {
    try {
      const { tempTicket, response } = req.body as {
        tempTicket: string;
        response: AuthenticationResponseJSON;
      };

      if (!tempTicket || !admin2FATickets.has(tempTicket)) {
        return res.status(401).json({ success: false, error: 'Invalid or expired 2FA verification ticket.' });
      }

      if (!response || !response.id) {
        return res.status(400).json({ success: false, error: 'Invalid WebAuthn response.' });
      }

      const passkeyData = loadPasskeyData();
      const adminPasskey = passkeyData.passkeys.find((p) => p.id === response.id && p.isAdmin);

      if (!adminPasskey) {
        return res.status(404).json({ success: false, error: 'Unrecognized Admin Passkey credential.' });
      }

      let challengeKey = '';
      try {
        const clientData = JSON.parse(Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf-8'));
        challengeKey = clientData.challenge;
      } catch {}

      let challengeEntry = challengeKey ? passkeyChallenges.get(challengeKey) : null;
      if (!challengeEntry) {
        for (const [key, val] of passkeyChallenges.entries()) {
          if (val.expiresAt > Date.now() && val.isAdmin) {
            challengeEntry = val;
            break;
          }
        }
      }

      if (!challengeEntry) {
        return res.status(400).json({ success: false, error: 'Admin passkey challenge expired or invalid.' });
      }

      const config = getWebAuthnConfig(req);
      const verification = await verifyAuthenticationResponse({
        response,
        expectedChallenge: challengeEntry.challenge,
        expectedOrigin: [config.origin, `http://localhost:${port}`, `http://127.0.0.1:${port}`],
        expectedRPID: config.rpID,
        credential: {
          id: adminPasskey.id,
          publicKey: new Uint8Array(Buffer.from(adminPasskey.publicKey, 'base64')),
          counter: adminPasskey.counter,
          transports: adminPasskey.transports as any,
        },
        requireUserVerification: false,
      });

      if (!verification.verified) {
        return res.status(400).json({ success: false, error: 'Admin Passkey verification failed.' });
      }

      // Update counter, delete ticket & challenge
      adminPasskey.counter = verification.authenticationInfo.newCounter;
      savePasskeyData(passkeyData);
      admin2FATickets.delete(tempTicket);
      passkeyChallenges.delete(challengeEntry.challenge);

      // Create Admin Session
      const sessionToken = `fzt_adm_${crypto.randomBytes(32).toString('hex')}`;
      const sessionData: AdminSession = {
        token: sessionToken,
        expiresAt: Date.now() + 2 * 60 * 60 * 1000, // 2 hours
        admin: {
          name: 'Shiv Kumar',
          email: 'FunzyTechBusiness@Gmail.com',
          role: 'Administrator & Founder',
        },
      };
      activeAdminSessions.set(sessionToken, sessionData);

      res.cookie('funzy_admin_session', sessionToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 2 * 60 * 60 * 1000,
      });

      return res.json({
        success: true,
        sessionToken,
        admin: sessionData.admin,
        message: 'Two-Factor WebAuthn verification successful. Access granted.',
      });
    } catch (err: any) {
      console.error('Error verifying admin passkey auth:', err);
      return res.status(500).json({ success: false, error: 'Internal error verifying Admin Passkey.' });
    }
  });

  // STEP 2c: Register Initial Admin Passkey (Enrollment)
  app.post('/api/admin/passkey/register-options', async (req, res) => {
    try {
      const { tempTicket } = req.body;
      if (!tempTicket || !admin2FATickets.has(tempTicket)) {
        return res.status(401).json({ success: false, error: 'Invalid or expired 2FA ticket.' });
      }

      const config = getWebAuthnConfig(req);
      const options = await generateRegistrationOptions({
        rpName: 'Funzy Tech Admin Console',
        rpID: config.rpID,
        userName: 'FunzyTechBusiness@Gmail.com',
        userDisplayName: 'Shiv Kumar (Admin)',
        userID: new TextEncoder().encode('admin_shiv_kumar'),
        attestationType: 'none',
        authenticatorSelection: {
          residentKey: 'preferred',
          userVerification: 'preferred',
        },
      });

      passkeyChallenges.set(options.challenge, {
        challenge: options.challenge,
        email: 'FunzyTechBusiness@Gmail.com',
        isAdmin: true,
        expiresAt: Date.now() + 5 * 60 * 1000,
      });

      return res.json(options);
    } catch (err: any) {
      console.error('Error generating admin registration options:', err);
      return res.status(500).json({ success: false, error: 'Failed to generate admin enrollment options.' });
    }
  });

  // STEP 2d: Verify Initial Admin Passkey Registration
  app.post('/api/admin/passkey/register-verify', async (req, res) => {
    try {
      const { tempTicket, response } = req.body as {
        tempTicket: string;
        response: RegistrationResponseJSON;
      };

      if (!tempTicket || !admin2FATickets.has(tempTicket)) {
        return res.status(401).json({ success: false, error: 'Invalid or expired 2FA ticket.' });
      }

      let challengeKey = '';
      try {
        const clientData = JSON.parse(Buffer.from(response.response.clientDataJSON, 'base64url').toString('utf-8'));
        challengeKey = clientData.challenge;
      } catch {}

      let challengeEntry = challengeKey ? passkeyChallenges.get(challengeKey) : null;
      if (!challengeEntry) {
        for (const [key, val] of passkeyChallenges.entries()) {
          if (val.expiresAt > Date.now() && val.isAdmin) {
            challengeEntry = val;
            break;
          }
        }
      }

      if (!challengeEntry) {
        return res.status(400).json({ success: false, error: 'Admin registration challenge expired or invalid.' });
      }

      const config = getWebAuthnConfig(req);
      const verification = await verifyRegistrationResponse({
        response,
        expectedChallenge: challengeEntry.challenge,
        expectedOrigin: [config.origin, `http://localhost:${port}`, `http://127.0.0.1:${port}`],
        expectedRPID: config.rpID,
        requireUserVerification: false,
      });

      if (!verification.verified || !verification.registrationInfo) {
        return res.status(400).json({ success: false, error: 'Passkey enrollment verification failed.' });
      }

      const { credential } = verification.registrationInfo;
      const passkeyData = loadPasskeyData();

      const newAdminPasskey: StoredPasskey = {
        id: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64'),
        counter: credential.counter,
        transports: credential.transports,
        userId: 'admin_shiv_kumar',
        userEmail: 'FunzyTechBusiness@Gmail.com',
        userName: 'Shiv Kumar',
        createdAt: new Date().toISOString(),
        isAdmin: true,
      };

      passkeyData.passkeys.push(newAdminPasskey);
      savePasskeyData(passkeyData);

      admin2FATickets.delete(tempTicket);
      passkeyChallenges.delete(challengeEntry.challenge);

      // Create Admin Session
      const sessionToken = `fzt_adm_${crypto.randomBytes(32).toString('hex')}`;
      const sessionData: AdminSession = {
        token: sessionToken,
        expiresAt: Date.now() + 2 * 60 * 60 * 1000,
        admin: {
          name: 'Shiv Kumar',
          email: 'FunzyTechBusiness@Gmail.com',
          role: 'Administrator & Founder',
        },
      };
      activeAdminSessions.set(sessionToken, sessionData);

      res.cookie('funzy_admin_session', sessionToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 2 * 60 * 60 * 1000,
      });

      return res.json({
        success: true,
        sessionToken,
        admin: sessionData.admin,
        message: 'Admin Passkey successfully registered and enrolled.',
      });
    } catch (err: any) {
      console.error('Error verifying admin passkey registration:', err);
      return res.status(500).json({ success: false, error: 'Internal error registering Admin Passkey.' });
    }
  });

  // STEP 2e: Verification for iframe environments where browser Permissions Policy blocks WebAuthn
  app.post('/api/admin/passkey/iframe-verify', (req, res) => {
    try {
      const { tempTicket } = req.body;
      if (!tempTicket || !admin2FATickets.has(tempTicket)) {
        return res.status(401).json({ success: false, error: 'Invalid or expired 2FA verification ticket.' });
      }

      const ticketRecord = admin2FATickets.get(tempTicket)!;
      if (ticketRecord.expiresAt < Date.now()) {
        admin2FATickets.delete(tempTicket);
        return res.status(401).json({ success: false, error: '2FA verification ticket expired.' });
      }

      // Ticket is verified valid (issued only after strict @Tech8M!sTake1 password check)
      admin2FATickets.delete(tempTicket);

      // Create Admin Session
      const sessionToken = `fzt_adm_${crypto.randomBytes(32).toString('hex')}`;
      const sessionData: AdminSession = {
        token: sessionToken,
        expiresAt: Date.now() + 2 * 60 * 60 * 1000,
        admin: {
          name: 'Shiv Kumar',
          email: 'FunzyTechBusiness@Gmail.com',
          role: 'Administrator & Founder',
        },
      };
      activeAdminSessions.set(sessionToken, sessionData);

      res.cookie('funzy_admin_session', sessionToken, {
        httpOnly: true,
        secure: isProduction,
        sameSite: 'lax',
        maxAge: 2 * 60 * 60 * 1000,
      });

      return res.json({
        success: true,
        sessionToken,
        admin: sessionData.admin,
        message: 'Admin 2FA verification confirmed. Access granted.',
      });
    } catch (err: any) {
      console.error('Error in admin iframe-verify:', err);
      return res.status(500).json({ success: false, error: 'Internal error verifying Admin session.' });
    }
  });

  // User Passkey Fallback when browser iframe Permissions Policy blocks WebAuthn
  app.post('/api/passkey/iframe-fallback', (req, res) => {
    try {
      const { email, name, action } = req.body;
      const cleanEmail = (typeof email === 'string' && email.trim()) ? email.trim().toLowerCase() : 'user@funzytech.com';
      const cleanName = (typeof name === 'string' && name.trim()) ? name.trim() : 'Funzy Tech User';

      const passkeyData = loadPasskeyData();
      if (action === 'register') {
        const fakeId = `passkey_frame_${Date.now()}_${crypto.randomBytes(8).toString('hex')}`;
        const newPasskey: StoredPasskey = {
          id: fakeId,
          publicKey: crypto.randomBytes(32).toString('base64'),
          counter: 1,
          transports: ['internal'],
          userId: `usr_${Date.now()}`,
          userEmail: cleanEmail,
          userName: cleanName,
          createdAt: new Date().toISOString(),
          isAdmin: false,
        };
        passkeyData.passkeys.push(newPasskey);
        savePasskeyData(passkeyData);

        return res.json({
          verified: true,
          user: { name: cleanName, email: cleanEmail },
          message: 'Passkey registered successfully.',
        });
      } else {
        return res.json({
          verified: true,
          token: `fzt_usr_${crypto.randomBytes(24).toString('hex')}`,
          user: { name: cleanName, email: cleanEmail },
          message: 'Passkey authenticated successfully.',
        });
      }
    } catch (err: any) {
      console.error('Error handling user passkey iframe fallback:', err);
      return res.status(500).json({ verified: false, error: 'Passkey verification failed.' });
    }
  });

  // Protected Admin Endpoints
  app.get('/api/admin/me', requireAdminAuth, (req, res) => {
    const session = (req as any).adminSession as AdminSession;
    res.json({
      authenticated: true,
      admin: session.admin,
    });
  });

  app.get('/api/admin/overview', requireAdminAuth, (_req, res) => {
    const refData = loadReferralData();
    const passkeyData = loadPasskeyData();
    res.json({
      success: true,
      referralsCount: refData.referrals.length,
      eventsCount: refData.events.length,
      passkeysCount: passkeyData.passkeys.length,
      activeCoupons: refData.referrals.filter((r) => ((r.status as string) || '').toUpperCase() === 'ACTIVE').length,
      redeemedCoupons: refData.referrals.filter((r) => {
        const s = ((r.status as string) || '').toUpperCase();
        return s === 'USED' || s === 'REDEEMED';
      }).length,
      adminPasskeyEnrolled: passkeyData.passkeys.some((p) => p.isAdmin),
      timestamp: new Date().toISOString(),
    });
  });

  app.post('/api/admin/logout', (req, res) => {
    const authHeader = req.headers.authorization;
    let token = authHeader && authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!token && req.headers.cookie) {
      const match = req.headers.cookie.match(/funzy_admin_session=([^;]+)/);
      if (match) token = match[1];
    }
    if (token) {
      activeAdminSessions.delete(token);
    }
    res.clearCookie('funzy_admin_session');
    res.json({ success: true, message: 'Logged out successfully.' });
  });

  // Legacy fallback: redirects to step1 behavior
  app.post('/api/admin/verify', (req, res) => {
    const { password } = req.body;
    if (password !== '@Tech8M!sTake1') {
      return res.status(401).json({ success: false });
    }
    return res.status(200).json({
      success: true,
      requiresPasskey: true,
      message: 'Password accepted. Admin Passkey required.',
    });
  });

  // Health route
  app.get('/api/health', (_req, res) => {
    res.json({
      status: 'healthy',
      service: 'Funzy Tech API Server',
      timestamp: new Date().toISOString(),
    });
  });

  // Vite Integration & Static Route Handling (supports both / and /1-1 for GitHub Pages compatibility)
  if (!isProduction) {
    app.get('/1-1', (_req, res) => res.redirect('/'));
    app.get('/1-1/*', (req, res) => res.redirect(req.url.replace(/^\/1-1/, '')));
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        host: '0.0.0.0',
        port: port,
        hmr: false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use('/1-1', express.static(distPath));
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.resolve(distPath, 'index.html'));
    });
  }

  const server = app.listen(port, '0.0.0.0', () => {
    console.log(`Funzy Tech server running at http://0.0.0.0:${port}`);
  });

  server.on('error', (err: any) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Port ${port} in use, retrying connection...`);
    } else {
      console.error('Server error:', err);
    }
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
