import crypto from 'node:crypto';
import express, { type Request, type Response } from 'express';
import { VERIFIED_BRANCHES } from '../data/marhabaData';
import { hasPermission } from '../erp/permissions';
import type { ErpDatabaseState } from '../erp/seedData';
import type { AuditLogEntry, StaffUser } from '../erp/types';
import type { PlayLandDatabaseState } from '../playland/seedData';
import type { InterBusinessRequest } from '../portal/types';
import type { RestaurantDatabaseState } from '../restaurant/seedData';
import {
  classifyGeminiError,
  runSaathiConversation,
  SaathiServiceError,
  type GenerateContentFn,
} from './geminiService';
import {
  buildKnowledgeBase,
  createInitialSaathiConfig,
  sanitizeUntrustedText,
  SMART_WELCOME_SUGGESTIONS,
  summarizeKnowledgeDomains,
} from './knowledgeBase';
import { executeSaathiTool, normalizePhoneDigits, orderBelongsToCustomer } from './tools';
import type {
  CustomerSessionProfile,
  KnowledgeDomainId,
  SaathiAdminConfig,
  SaathiChatRequest,
  SaathiLanguage,
  SaathiQualityMetrics,
  SaathiUnresolvedEntry,
} from './types';

const CUSTOMER_COOKIE = 'marhaba_customer_session';
const CUSTOMER_SECRET =
  process.env.CUSTOMER_SESSION_SECRET || 'marhaba-saathi-customer-hmac-2026-not-for-prod';

interface CustomerTokenPayload extends CustomerSessionProfile {
  iat: number;
  exp: number;
}

const DEMO_VERIFIED_CUSTOMERS: CustomerSessionProfile[] = [
  {
    customerId: 'cust-nadia-hyd',
    fullName: 'Nadia Hussain',
    email: 'nadia.hussain@marhaba.demo',
    phone: '0300-1234891',
    branchId: 'hyderabad',
  },
  {
    customerId: 'cust-saad-k10',
    fullName: 'Saad Mirza',
    email: 'saad.mirza@marhaba.demo',
    phone: '0321-1234412',
    branchId: 'karachi-p10',
  },
];

function signCustomerToken(payload: CustomerTokenPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', CUSTOMER_SECRET).update(encoded).digest('base64url');
  return `${encoded}.${sig}`;
}

function verifyCustomerToken(token: string): CustomerTokenPayload | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [encoded, sig] = parts;
    const expected = crypto.createHmac('sha256', CUSTOMER_SECRET).update(encoded).digest('base64url');
    const a = Buffer.from(sig, 'utf8');
    const b = Buffer.from(expected, 'utf8');
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(encoded, 'base64url').toString('utf8')) as CustomerTokenPayload;
    if (!payload.customerId || !payload.exp || Date.now() > payload.exp) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(header: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  if (!header) return out;
  for (const part of header.split(';')) {
    const idx = part.indexOf('=');
    if (idx > 0) {
      out[part.slice(0, idx).trim()] = decodeURIComponent(part.slice(idx + 1).trim());
    }
  }
  return out;
}

function extractCustomerSession(req: Request): CustomerSessionProfile | null {
  const custHeader = req.headers['x-customer-token'];
  const rawHeader = typeof custHeader === 'string' ? custHeader.trim() : null;
  const authHeader = req.headers.authorization;
  const bearer = authHeader && authHeader.startsWith('Customer ') ? authHeader.slice(9).trim() : null;
  const cookies = parseCookies(req.headers.cookie);
  const token = rawHeader || bearer || cookies[CUSTOMER_COOKIE] || null;
  if (!token) return null;
  return verifyCustomerToken(token);
}

export function createSaathiRouter(options: {
  erpDb: ErpDatabaseState;
  restaurantDb: RestaurantDatabaseState;
  playLandDb: PlayLandDatabaseState;
  resolveMgmtStaffUser: (req: Request) => StaffUser | null;
  addAudit: (entry: Omit<AuditLogEntry, 'id' | 'timestamp'>) => void;
  onInterBusinessRequest?: (
    reqItem: Omit<InterBusinessRequest, 'id' | 'requestNumber' | 'requestedAt' | 'status'>
  ) => InterBusinessRequest;
  generateContentFn?: GenerateContentFn | null;
}) {
  const { erpDb, restaurantDb, playLandDb, resolveMgmtStaffUser, addAudit, onInterBusinessRequest } = options;

  let config: SaathiAdminConfig = createInitialSaathiConfig();
  const processedInquiryKeys = new Set<string>();
  const unresolvedLogs: SaathiUnresolvedEntry[] = [];
  const rateLimitWindow = new Map<string, { count: number; resetAt: number }>();

  const metrics: SaathiQualityMetrics = {
    totalQueries: 0,
    successfulResponses: 0,
    toolAssistedResponses: 0,
    escalatedCount: 0,
    unresolvedCount: 0,
    helpfulVotes: 0,
    notHelpfulVotes: 0,
    avgLatencyMs: 0,
  };

  const router = express.Router();

  const checkRateLimit = (req: Request, res: Response): boolean => {
    const key = req.ip || 'local';
    const now = Date.now();
    const bucket = rateLimitWindow.get(key);
    if (!bucket || now > bucket.resetAt) {
      rateLimitWindow.set(key, { count: 1, resetAt: now + 60_000 });
      return true;
    }
    if (bucket.count >= 35) {
      res.status(429).json({
        errorCode: 'RATE_LIMITED',
        error: 'Too many requests in a short window. Please pause briefly before sending another message.',
        messageUr: 'Mukhtasar waqt mein bohot zyada messages bheje gaye. Thori der baad koshish karein.',
      });
      return false;
    }
    bucket.count += 1;
    return true;
  };

  // ==================== PUBLIC CONFIG & KNOWLEDGE SUMMARY ====================
  router.get('/config', (req, res) => {
    const customer = extractCustomerSession(req);
    const docs = buildKnowledgeBase({ erpDb, restaurantDb, playLandDb, config });
    res.json({
      assistantName: config.assistantName,
      tagline: config.tagline,
      greetingEn: config.greetingEn,
      greetingUr: config.greetingUr,
      privacyNoticeEn: config.privacyNoticeEn,
      privacyNoticeUr: config.privacyNoticeUr,
      escalationHours: config.escalationHours,
      supportPhone: config.supportPhone,
      mobileSupport: config.mobileSupport,
      generalEmail: config.generalEmail,
      restaurantEmail: config.restaurantEmail,
      knowledgeVersion: config.knowledgeVersion,
      lastSyncedAt: config.lastSyncedAt,
      domainCount: summarizeKnowledgeDomains(docs).length,
      welcomeSuggestions: SMART_WELCOME_SUGGESTIONS,
      customerSession: customer,
    });
  });

  // ==================== CUSTOMER SESSION & ORDER TRACKING AUTH ====================
  router.get('/customer/session', (req, res) => {
    const customer = extractCustomerSession(req);
    res.json({ authenticated: Boolean(customer), customer });
  });

  router.post('/customer/login', (req, res) => {
    const body = req.body as {
      demoProfileId?: string;
      fullName?: string;
      email?: string;
      phone?: string;
      branchId?: string;
    };

    let sessionProfile: CustomerSessionProfile | null = null;

    if (body.demoProfileId) {
      const demo = DEMO_VERIFIED_CUSTOMERS.find((d) => d.customerId === body.demoProfileId);
      if (!demo) {
        res.status(400).json({ error: 'Unknown demo customer profile.' });
        return;
      }
      sessionProfile = { ...demo };
    } else {
      const cleanName = sanitizeUntrustedText(String(body.fullName || ''), 80);
      const cleanEmail = sanitizeUntrustedText(String(body.email || ''), 120).toLowerCase();
      const cleanPhone = sanitizeUntrustedText(String(body.phone || ''), 30);

      // Allow login matching known seeded demo email/phone OR valid email + phone
      const matchedDemo = DEMO_VERIFIED_CUSTOMERS.find(
        (d) =>
          (cleanEmail && d.email.toLowerCase() === cleanEmail) ||
          (cleanPhone && normalizePhoneDigits(d.phone) === normalizePhoneDigits(cleanPhone))
      );

      if (matchedDemo) {
        sessionProfile = { ...matchedDemo };
      } else {
        const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail);
        const phoneOk = normalizePhoneDigits(cleanPhone).length >= 10;
        if (cleanName.length < 2 || (!emailOk && !phoneOk)) {
          res.status(400).json({
            error: 'Please enter your full name along with a valid email address or mobile number.',
          });
          return;
        }
        sessionProfile = {
          customerId: `cust-${crypto.createHash('sha1').update(cleanEmail || cleanPhone).digest('hex').slice(0, 10)}`,
          fullName: cleanName,
          email: cleanEmail || `${normalizePhoneDigits(cleanPhone)}@customer.marhaba.local`,
          phone: cleanPhone,
          branchId:
            body.branchId && VERIFIED_BRANCHES.some((b) => b.id === body.branchId)
              ? body.branchId
              : 'hyderabad',
        };
      }
    }

    const token = signCustomerToken({
      ...sessionProfile,
      iat: Date.now(),
      exp: Date.now() + 1000 * 60 * 60 * 24,
    });

    res.cookie(CUSTOMER_COOKIE, token, {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      maxAge: 1000 * 60 * 60 * 24,
    });

    res.json({
      authenticated: true,
      customer: sessionProfile,
      token,
    });
  });

  router.post('/customer/logout', (_req, res) => {
    res.clearCookie(CUSTOMER_COOKIE, { path: '/' });
    res.json({ authenticated: false });
  });

  router.get('/customer/orders', (req, res) => {
    const customer = extractCustomerSession(req);
    if (!customer) {
      res.status(401).json({
        error: 'Customer authentication required to view or track orders.',
      });
      return;
    }

    const ownedOrders = erpDb.onlineOrders.filter((o) => orderBelongsToCustomer(o, customer));
    res.json({
      customer,
      orders: ownedOrders,
    });
  });

  // ==================== CONVERSATIONAL AI CHAT ====================
  router.post('/chat', async (req, res) => {
    if (!checkRateLimit(req, res)) return;

    const body = req.body as Partial<SaathiChatRequest>;
    const rawMsg = typeof body.message === 'string' ? body.message.trim() : '';
    if (!rawMsg) {
      res.status(400).json({
        errorCode: 'EMPTY_MESSAGE',
        error: 'Please enter a message before sending.',
        messageUr: 'Bara-e-karam bhejne se pehle apna sawal likhein.',
      });
      return;
    }
    if (rawMsg.length > 1000) {
      res.status(400).json({
        errorCode: 'MESSAGE_TOO_LONG',
        error: 'Please keep each message under 1,000 characters.',
        messageUr: 'Bara-e-karam apna paigham 1,000 huroof se kam rakhein.',
      });
      return;
    }

    const language: SaathiLanguage = body.language === 'ur-roman' ? 'ur-roman' : 'en';
    const customerSession = extractCustomerSession(req);

    try {
      const result = await runSaathiConversation({
        message: rawMsg,
        language,
        history: Array.isArray(body.history) ? body.history : [],
        pageContext: body.pageContext,
        config,
        toolDeps: {
          erpDb,
          restaurantDb,
          playLandDb,
          customerSession,
          pageContext: body.pageContext,
          processedInquiryKeys,
          onInterBusinessRequest,
        },
        metrics,
        unresolvedLogs,
        generateContentFn: options.generateContentFn,
      });
      res.json(result);
    } catch (err) {
      const classified = err instanceof SaathiServiceError ? err : classifyGeminiError(err);
      res.status(classified.status).json({
        errorCode: classified.code,
        error: classified.message,
        messageUr: classified.messageUr,
      });
    }
  });

  // ==================== DIRECT INTERACTIVE ACTION ENDPOINTS ====================
  router.post('/actions/support', async (req, res) => {
    if (!checkRateLimit(req, res)) return;
    const body = req.body as Record<string, unknown>;
    const ctx = {
      deps: {
        erpDb,
        restaurantDb,
        playLandDb,
        customerSession: extractCustomerSession(req),
        processedInquiryKeys,
        onInterBusinessRequest,
      },
      cards: [],
      cartActions: [],
      toolsUsed: [],
      escalationSuggested: false,
    };
    const result = await executeSaathiTool('createSupportRequest', body, ctx);
    if (!result.created) {
      res.status(400).json({ error: result.error || 'Could not submit support request.' });
      return;
    }
    if (!result.duplicatePrevented) {
      metrics.escalatedCount += 1;
    }
    res.status(201).json({ ...result, card: ctx.cards[0] || null });
  });

  router.post('/feedback', (req, res) => {
    const body = req.body as { vote?: 'up' | 'down'; query?: string; language?: SaathiLanguage };
    if (body.vote === 'up') {
      metrics.helpfulVotes += 1;
    } else if (body.vote === 'down') {
      metrics.notHelpfulVotes += 1;
      if (body.query) {
        unresolvedLogs.unshift({
          id: `unr-fb-${Date.now()}`,
          query: sanitizeUntrustedText(body.query, 300),
          language: body.language === 'ur-roman' ? 'ur-roman' : 'en',
          branchId: 'hyderabad',
          route: 'chat',
          reason: 'Customer marked response not helpful',
          createdAt: new Date().toISOString(),
          status: 'Open',
        });
        metrics.unresolvedCount += 1;
      }
    }
    res.json({ recorded: true });
  });

  // ==================== AUTHORIZED MANAGEMENT ADMIN ROUTES ====================
  const requireSaathiAdmin = (req: Request, res: Response, writeRequired: boolean): StaffUser | null => {
    const user = resolveMgmtStaffUser(req);
    if (!user) {
      res.status(401).json({
        error: 'Management authentication required to access Marhaba Saathi AI Administration.',
      });
      return null;
    }
    const action = writeRequired ? 'edit' : 'view';
    const hasAccess =
      hasPermission(user.roleId, 'customers', action) ||
      hasPermission(user.roleId, 'settings', writeRequired ? 'administer' : 'view');
    if (!hasAccess) {
      addAudit({
        actorUserId: user.id,
        actorName: user.fullName,
        actorRole: user.roleId,
        branchId: user.branchId,
        module: 'customers',
        action: `SAATHI_ADMIN_${action.toUpperCase()}`,
        target: req.originalUrl,
        outcome: 'Denied',
        detail: `Role "${user.roleId}" attempted unauthorized Saathi AI admin ${action}.`,
      });
      res.status(403).json({
        error: 'Access denied: only authorized Customer Care, MIS, or Leadership roles can administer Marhaba Saathi AI.',
      });
      return null;
    }
    return user;
  };

  router.get('/admin', (req, res) => {
    const user = requireSaathiAdmin(req, res, false);
    if (!user) return;
    const docs = buildKnowledgeBase({ erpDb, restaurantDb, playLandDb, config });
    res.json({
      config,
      metrics,
      domains: summarizeKnowledgeDomains(docs),
      unresolvedLogs,
    });
  });

  router.patch('/admin/config', (req, res) => {
    const user = requireSaathiAdmin(req, res, true);
    if (!user) return;
    const body = req.body as Partial<SaathiAdminConfig>;

    if (typeof body.greetingEn === 'string' && body.greetingEn.trim().length >= 5) {
      config.greetingEn = sanitizeUntrustedText(body.greetingEn, 320);
    }
    if (typeof body.greetingUr === 'string' && body.greetingUr.trim().length >= 5) {
      config.greetingUr = sanitizeUntrustedText(body.greetingUr, 320);
    }
    if (typeof body.escalationHours === 'string' && body.escalationHours.trim()) {
      config.escalationHours = sanitizeUntrustedText(body.escalationHours, 120);
    }
    if (typeof body.deliveryPolicySummary === 'string' && body.deliveryPolicySummary.trim()) {
      config.deliveryPolicySummary = sanitizeUntrustedText(body.deliveryPolicySummary, 400);
    }
    if (typeof body.returnsPolicySummary === 'string' && body.returnsPolicySummary.trim()) {
      config.returnsPolicySummary = sanitizeUntrustedText(body.returnsPolicySummary, 400);
    }
    if (typeof body.safetyPolicySummary === 'string' && body.safetyPolicySummary.trim()) {
      config.safetyPolicySummary = sanitizeUntrustedText(body.safetyPolicySummary, 400);
    }
    config.knowledgeVersion += 1;
    config.lastSyncedAt = new Date().toISOString();

    addAudit({
      actorUserId: user.id,
      actorName: user.fullName,
      actorRole: user.roleId,
      branchId: user.branchId,
      module: 'customers',
      action: 'UPDATE_SAATHI_CONFIG',
      target: `v${config.knowledgeVersion}`,
      outcome: 'Success',
      detail: 'Updated Marhaba Saathi AI welcome, escalation, and policy guidance.',
    });

    res.json({ config });
  });

  router.post('/admin/faqs', (req, res) => {
    const user = requireSaathiAdmin(req, res, true);
    if (!user) return;
    const body = req.body as { question?: string; answer?: string; domain?: KnowledgeDomainId };
    const question = sanitizeUntrustedText(String(body.question || ''), 240);
    const answer = sanitizeUntrustedText(String(body.answer || ''), 600);
    const validDomains: KnowledgeDomainId[] = [
      'company_locations',
      'supermarket_products',
      'shopping_promotions',
      'orders_delivery',
      'restaurant_menu',
      'playland_attractions',
      'customer_policies',
      'support_faqs',
    ];
    const domain: KnowledgeDomainId =
      body.domain && validDomains.includes(body.domain) ? body.domain : 'support_faqs';

    if (question.length < 5 || answer.length < 8) {
      res.status(400).json({ error: 'FAQ question and answer are required.' });
      return;
    }

    const entry = {
      id: `faq-${Date.now()}`,
      question,
      answer,
      domain,
      active: true,
      updatedAt: new Date().toISOString(),
    };
    config.faqs.unshift(entry);
    config.knowledgeVersion += 1;
    config.lastSyncedAt = new Date().toISOString();

    addAudit({
      actorUserId: user.id,
      actorName: user.fullName,
      actorRole: user.roleId,
      branchId: user.branchId,
      module: 'customers',
      action: 'ADD_SAATHI_FAQ',
      target: entry.id,
      outcome: 'Success',
      detail: `Added Saathi FAQ entry in ${domain}: ${question}`,
    });

    res.status(201).json({ faq: entry, config });
  });

  router.patch('/admin/faqs/:id', (req, res) => {
    const user = requireSaathiAdmin(req, res, true);
    if (!user) return;
    const faq = config.faqs.find((f) => f.id === req.params.id);
    if (!faq) {
      res.status(404).json({ error: 'FAQ entry not found.' });
      return;
    }
    const body = req.body as { active?: boolean; answer?: string };
    if (typeof body.active === 'boolean') faq.active = body.active;
    if (typeof body.answer === 'string' && body.answer.trim().length >= 5) {
      faq.answer = sanitizeUntrustedText(body.answer, 600);
    }
    faq.updatedAt = new Date().toISOString();
    config.knowledgeVersion += 1;
    config.lastSyncedAt = new Date().toISOString();
    res.json({ faq, config });
  });

  router.post('/admin/sync', (req, res) => {
    const user = requireSaathiAdmin(req, res, true);
    if (!user) return;
    config.knowledgeVersion += 1;
    config.lastSyncedAt = new Date().toISOString();
    const docs = buildKnowledgeBase({ erpDb, restaurantDb, playLandDb, config });
    addAudit({
      actorUserId: user.id,
      actorName: user.fullName,
      actorRole: user.roleId,
      branchId: user.branchId,
      module: 'customers',
      action: 'SYNC_SAATHI_KNOWLEDGE',
      target: `v${config.knowledgeVersion}`,
      outcome: 'Success',
      detail: 'Synchronized 8 knowledge domains with live Supermarket, Restaurant & Play Land catalogs.',
    });
    res.json({
      knowledgeVersion: config.knowledgeVersion,
      lastSyncedAt: config.lastSyncedAt,
      domains: summarizeKnowledgeDomains(docs),
    });
  });

  router.patch('/admin/unresolved/:id', (req, res) => {
    const user = requireSaathiAdmin(req, res, true);
    if (!user) return;
    const item = unresolvedLogs.find((u) => u.id === req.params.id);
    if (!item) {
      res.status(404).json({ error: 'Unresolved entry not found.' });
      return;
    }
    const body = req.body as {
      status?: SaathiUnresolvedEntry['status'];
      resolutionNote?: string;
      promoteToFaq?: boolean;
      faqAnswer?: string;
    };
    if (body.status) item.status = body.status;
    if (body.resolutionNote) item.resolutionNote = sanitizeUntrustedText(body.resolutionNote, 300);

    if (body.promoteToFaq && body.faqAnswer && body.faqAnswer.trim().length >= 8) {
      config.faqs.unshift({
        id: `faq-${Date.now()}`,
        question: item.query,
        answer: sanitizeUntrustedText(body.faqAnswer, 600),
        domain: 'support_faqs',
        active: true,
        updatedAt: new Date().toISOString(),
      });
      item.status = 'Converted to FAQ';
      config.knowledgeVersion += 1;
      config.lastSyncedAt = new Date().toISOString();
    }

    res.json({ entry: item, config });
  });

  return router;
}
