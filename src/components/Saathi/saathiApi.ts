import type {
  CustomerSessionProfile,
  KnowledgeDomainId,
  KnowledgeDomainSummary,
  SaathiAdminConfig,
  SaathiChatRequest,
  SaathiChatResponse,
  SaathiLanguage,
  SaathiQualityMetrics,
  SaathiUnresolvedEntry,
  SaathiWelcomeSuggestion,
} from '../../saathi/types';

export interface SaathiPublicConfig {
  assistantName: string;
  tagline: string;
  greetingEn: string;
  greetingUr: string;
  privacyNoticeEn: string;
  privacyNoticeUr: string;
  escalationHours: string;
  supportPhone: string;
  mobileSupport: string;
  generalEmail: string;
  restaurantEmail: string;
  knowledgeVersion: number;
  lastSyncedAt: string;
  domainCount: number;
  welcomeSuggestions: SaathiWelcomeSuggestion[];
  customerSession: CustomerSessionProfile | null;
}

export class SaathiClientError extends Error {
  status: number;
  errorCode: string;
  messageUr: string;

  constructor(status: number, errorCode: string, message: string, messageUr: string) {
    super(message);
    this.name = 'SaathiClientError';
    this.status = status;
    this.errorCode = errorCode;
    this.messageUr = messageUr;
  }
}

const CUSTOMER_TOKEN_STORAGE = 'marhaba_saathi_customer_token_v1';

export function getStoredCustomerToken(): string | null {
  try {
    return localStorage.getItem(CUSTOMER_TOKEN_STORAGE);
  } catch {
    return null;
  }
}

export function setStoredCustomerToken(token: string | null) {
  try {
    if (token) {
      localStorage.setItem(CUSTOMER_TOKEN_STORAGE, token);
    } else {
      localStorage.removeItem(CUSTOMER_TOKEN_STORAGE);
    }
  } catch {
    // ignore storage errors
  }
}

function customerHeaders(): Record<string, string> {
  const token = getStoredCustomerToken();
  return token ? { 'x-customer-token': token } : {};
}

async function fetchJson<T>(url: string, init: RequestInit = {}, timeoutMs = 65000): Promise<T> {
  const controller = new AbortController();
  const timer = window.setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      ...init,
      credentials: 'include',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...customerHeaders(),
        ...(init.headers || {}),
      },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      throw new SaathiClientError(
        res.status,
        data.errorCode || 'REQUEST_FAILED',
        data.error || `Request failed (${res.status})`,
        data.messageUr || 'Darkhwast mukammal nahi ho saki. Dobara koshish karein.'
      );
    }
    return data as T;
  } catch (err) {
    if (err instanceof SaathiClientError) throw err;
    const isAbort = err instanceof Error && err.name === 'AbortError';
    throw new SaathiClientError(
      504,
      isAbort ? 'REQUEST_TIMEOUT' : 'NETWORK_ERROR',
      isAbort
        ? 'The assistant took too long to respond. Please retry or use Customer Support below.'
        : 'Unable to connect to Marhaba server right now. Please check your connection and retry.',
      isAbort
        ? 'Jawab aane mein waqt laga. Dobara koshish karein ya Customer Support istemal karein.'
        : 'Server se rabta nahi ho saka. Internet check karke dobara koshish karein.'
    );
  } finally {
    window.clearTimeout(timer);
  }
}

export const saathiApi = {
  getConfig: () => fetchJson<SaathiPublicConfig>('/api/saathi/config'),

  sendChat: (payload: SaathiChatRequest) =>
    fetchJson<SaathiChatResponse>('/api/saathi/chat', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  loginCustomer: async (payload: {
    demoProfileId?: string;
    fullName?: string;
    email?: string;
    phone?: string;
    branchId?: string;
  }) => {
    const data = await fetchJson<{
      authenticated: boolean;
      customer: CustomerSessionProfile;
      token: string;
    }>('/api/saathi/customer/login', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    if (data.token) setStoredCustomerToken(data.token);
    return data;
  },

  logoutCustomer: async () => {
    setStoredCustomerToken(null);
    return fetchJson<{ authenticated: boolean }>('/api/saathi/customer/logout', { method: 'POST' });
  },

  submitSupportTicket: (payload: {
    customerName: string;
    contactPhone: string;
    branchId: string;
    orderNumber?: string;
    category: string;
    summary: string;
    idempotencyKey?: string;
  }) =>
    fetchJson<{ created: boolean; caseNumber: string; branchName: string }>('/api/saathi/actions/support', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  sendFeedback: (payload: { vote: 'up' | 'down'; query?: string; language?: SaathiLanguage }) =>
    fetchJson<{ recorded: boolean }>('/api/saathi/feedback', {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Admin API (uses management Bearer / session cookie)
  getAdminDashboard: (mgmtToken?: string | null) =>
    fetchJson<{
      config: SaathiAdminConfig;
      metrics: SaathiQualityMetrics;
      domains: KnowledgeDomainSummary[];
      unresolvedLogs: SaathiUnresolvedEntry[];
    }>('/api/saathi/admin', {
      headers: mgmtToken ? { Authorization: `Bearer ${mgmtToken}` } : {},
    }),

  updateAdminConfig: (patch: Partial<SaathiAdminConfig>, mgmtToken?: string | null) =>
    fetchJson<{ config: SaathiAdminConfig }>('/api/saathi/admin/config', {
      method: 'PATCH',
      headers: mgmtToken ? { Authorization: `Bearer ${mgmtToken}` } : {},
      body: JSON.stringify(patch),
    }),

  addFaq: (
    payload: { question: string; answer: string; domain: KnowledgeDomainId },
    mgmtToken?: string | null
  ) =>
    fetchJson<{ config: SaathiAdminConfig }>('/api/saathi/admin/faqs', {
      method: 'POST',
      headers: mgmtToken ? { Authorization: `Bearer ${mgmtToken}` } : {},
      body: JSON.stringify(payload),
    }),

  toggleFaq: (id: string, active: boolean, mgmtToken?: string | null) =>
    fetchJson<{ config: SaathiAdminConfig }>(`/api/saathi/admin/faqs/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: mgmtToken ? { Authorization: `Bearer ${mgmtToken}` } : {},
      body: JSON.stringify({ active }),
    }),

  syncKnowledge: (mgmtToken?: string | null) =>
    fetchJson<{ knowledgeVersion: number; lastSyncedAt: string; domains: KnowledgeDomainSummary[] }>(
      '/api/saathi/admin/sync',
      {
        method: 'POST',
        headers: mgmtToken ? { Authorization: `Bearer ${mgmtToken}` } : {},
      }
    ),

  resolveUnresolved: (
    id: string,
    payload: {
      status?: SaathiUnresolvedEntry['status'];
      resolutionNote?: string;
      promoteToFaq?: boolean;
      faqAnswer?: string;
    },
    mgmtToken?: string | null
  ) =>
    fetchJson<{ entry: SaathiUnresolvedEntry; config: SaathiAdminConfig }>(
      `/api/saathi/admin/unresolved/${encodeURIComponent(id)}`,
      {
        method: 'PATCH',
        headers: mgmtToken ? { Authorization: `Bearer ${mgmtToken}` } : {},
        body: JSON.stringify(payload),
      }
    ),
};
