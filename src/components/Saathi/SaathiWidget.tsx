import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Headphones,
  Loader2,
  Lock,
  MapPin,
  MessageSquareText,
  Minus,
  Package,
  Phone,
  RotateCcw,
  Search,
  Send,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  UserCheck,
  UtensilsCrossed,
  X,
} from 'lucide-react';
import { PRODUCTS, VERIFIED_BRANCHES, VERIFIED_CONTACT } from '../../data/marhabaData';
import { useStore } from '../../context/StoreContext';
import { SMART_WELCOME_SUGGESTIONS } from '../../saathi/knowledgeBase';
import type {
  CustomerSessionProfile,
  SaathiCard,
  SaathiLanguage,
  SaathiWelcomeSuggestion,
} from '../../saathi/types';
import { SaathiCards } from './SaathiCards';
import { saathiApi, SaathiClientError, type SaathiPublicConfig } from './saathiApi';

interface UiChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  cards?: SaathiCard[];
  quickReplies?: string[];
  queryContext?: string;
  voted?: 'up' | 'down';
}

function SuggestionIcon({ name }: { name: SaathiWelcomeSuggestion['iconName'] }) {
  switch (name) {
    case 'search':
      return <Search className="w-4 h-4 text-[#9B1C2E] shrink-0" aria-hidden="true" />;
    case 'package':
      return <Package className="w-4 h-4 text-[#9B1C2E] shrink-0" aria-hidden="true" />;
    case 'utensils':
      return <UtensilsCrossed className="w-4 h-4 text-[#9B1C2E] shrink-0" aria-hidden="true" />;
    case 'sparkles':
      return <Sparkles className="w-4 h-4 text-[#166534] shrink-0" aria-hidden="true" />;
    case 'map-pin':
      return <MapPin className="w-4 h-4 text-[#9B1C2E] shrink-0" aria-hidden="true" />;
    case 'headphones':
      return <Headphones className="w-4 h-4 text-[#9B1C2E] shrink-0" aria-hidden="true" />;
  }
}

function renderInlineRichText(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, j) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) {
      return (
        <strong key={j} className="font-semibold text-[#1C1917]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) {
      return (
        <em key={j} className="not-italic text-[#57534E]">
          {part.slice(1, -1)}
        </em>
      );
    }
    return <React.Fragment key={j}>{part}</React.Fragment>;
  });
}

function renderFormattedReply(text: string) {
  const lines = text.split('\n');
  return (
    <div className="space-y-1.5 text-[13px] leading-relaxed text-[#1C1917]">
      {lines.map((line, i) => {
        const trimmed = line.trim();
        if (!trimmed) return null;

        const headingMatch = trimmed.match(/^#{1,4}\s+(.+)$/);
        if (headingMatch) {
          return (
            <p key={i} className="text-[12.5px] font-bold text-[#1C1917] pt-1">
              {renderInlineRichText(headingMatch[1])}
            </p>
          );
        }

        const bulletMatch = trimmed.match(/^(?:[-*•])\s+(.+)$/);
        if (bulletMatch) {
          return (
            <div key={i} className="flex items-start gap-2 pl-1">
              <span className="text-[#9B1C2E] font-bold leading-relaxed select-none" aria-hidden="true">
                •
              </span>
              <span className="flex-1">{renderInlineRichText(bulletMatch[1])}</span>
            </div>
          );
        }

        return <p key={i}>{renderInlineRichText(trimmed)}</p>;
      })}
    </div>
  );
}

export default function SaathiWidget() {
  const {
    route,
    branchId,
    selectedProductId,
    restaurantSection,
    playLandSection,
    cart,
    cartTotals,
    isCartOpen,
    managementPath,
    addToCart,
    accountProfile,
  } = useStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [hintDismissed, setHintDismissed] = useState(false);
  const [language, setLanguage] = useState<SaathiLanguage>('en');
  const [config, setConfig] = useState<SaathiPublicConfig | null>(null);
  const [customerSession, setCustomerSession] = useState<CustomerSessionProfile | null>(null);

  const [messages, setMessages] = useState<UiChatMessage[]>([]);
  const [inputValue, setInputValue] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [errorState, setErrorState] = useState<{
    message: string;
    lastFailedPrompt: string;
  } | null>(null);

  // Sub-panels inside drawer (Customer Auth or Direct Support Escalation)
  const [subPanel, setSubPanel] = useState<'none' | 'auth' | 'support'>('none');
  const [authName, setAuthName] = useState(
    accountProfile.fullName !== 'Marhaba Customer' ? accountProfile.fullName : ''
  );
  const [authEmail, setAuthEmail] = useState(accountProfile.email || '');
  const [authPhone, setAuthPhone] = useState(accountProfile.phone || '');
  const [authFeedback, setAuthFeedback] = useState<string | null>(null);
  const [authBusy, setAuthBusy] = useState(false);

  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supCategory, setSupCategory] = useState('Order Assistance');
  const [supOrderNo, setSupOrderNo] = useState('');
  const [supSummary, setSupSummary] = useState('');
  const [supBusy, setSupBusy] = useState(false);
  const [supResult, setSupResult] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  const scrollRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    let active = true;
    saathiApi
      .getConfig()
      .then((cfg) => {
        if (!active) return;
        setConfig(cfg);
        setCustomerSession(cfg.customerSession || null);
      })
      .catch(() => {
        // Silent baseline config fallback — chat calls still report exact API errors if unreachable
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setIsOpen(false);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [isOpen]);

  useEffect(() => {
    if (isOpen && subPanel === 'none') {
      const t = window.setTimeout(() => inputRef.current?.focus(), 80);
      return () => window.clearTimeout(t);
    }
  }, [isOpen, subPanel]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isSending, errorState, subPanel]);

  const isUr = language === 'ur-roman';
  const suggestions = config?.welcomeSuggestions || SMART_WELCOME_SUGGESTIONS;
  const greetingText = isUr
    ? config?.greetingUr ||
      'Assalam-o-Alaikum! Marhaba mein khush aamdeed. Main Marhaba Saathi hoon, aapka AI assistant. Aaj main aapki kya madad kar sakta hoon?'
    : config?.greetingEn ||
      "Assalam-o-Alaikum! Welcome to Marhaba. I'm Marhaba Saathi, your AI assistant. How can I help you today?";
  const privacyNotice = isUr
    ? config?.privacyNoticeUr ||
      'AI jawab Marhaba ke verified records par mabni hain. Order track karne ke liye sign-in zaroori hai.'
    : config?.privacyNoticeEn ||
      'AI responses are grounded in Marhaba records. Order tracking requires verified customer sign-in.';

  const contextualCue = useMemo(() => {
    if (route === 'product') return isUr ? 'Is product ke bare mein poochein?' : 'Ask about this product?';
    if (route === 'restaurant') return isUr ? 'Menu ya table reservation?' : 'Ask about menu or tables?';
    if (route === 'playland') return isUr ? 'Play Land rides ya tickets?' : 'Ask about rides or tickets?';
    if (route === 'shop') return isUr ? 'Grocery dhoondhne mein madad?' : 'Need help finding items?';
    return null;
  }, [route, isUr]);

  if (managementPath !== null || isCartOpen) {
    return null;
  }

  const handleSend = async (rawText: string, overrideLang?: SaathiLanguage) => {
    const clean = rawText.trim();
    if (!clean || isSending) return;
    const activeLang = overrideLang || language;

    setSubPanel('none');
    setErrorState(null);
    const userMsgId = `u-${Date.now()}`;
    setMessages((prev) => [...prev, { id: userMsgId, role: 'user', text: clean }]);
    setInputValue('');
    setIsSending(true);

    try {
      const historyPayload = messages.slice(-8).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const res = await saathiApi.sendChat({
        message: clean,
        language: activeLang,
        history: historyPayload,
        pageContext: {
          route,
          branchId,
          selectedProductId,
          restaurantSection,
          playLandSection,
          cartItemCount: cartTotals.itemCount,
          cartSubtotal: cartTotals.subtotal,
          cartItems: cart.map((c) => ({
            productId: c.productId,
            variantId: c.variantId,
            name: c.name,
            variantLabel: c.variantLabel,
            unitPrice: c.unitPrice,
            quantity: c.quantity,
          })),
        },
      });

      // Execute any verified Cart Action descriptors requested by the tool
      if (res.cartActions && res.cartActions.length > 0) {
        for (const action of res.cartActions) {
          const prod = PRODUCTS.find((p) => p.id === action.productId);
          if (prod) {
            addToCart(prod, action.variantId, action.quantity);
          }
        }
      }

      setMessages((prev) => [
        ...prev,
        {
          id: `a-${Date.now()}`,
          role: 'assistant',
          text: res.reply,
          cards: res.cards,
          quickReplies: res.quickReplies,
          queryContext: clean,
        },
      ]);
    } catch (err) {
      const clientErr =
        err instanceof SaathiClientError
          ? err
          : new SaathiClientError(
              500,
              'UNKNOWN_ERROR',
              'Unable to reach Marhaba Saathi AI.',
              'Marhaba Saathi AI se rabta nahi ho saka.'
            );
      setErrorState({
        message: activeLang === 'ur-roman' ? clientErr.messageUr : clientErr.message,
        lastFailedPrompt: clean,
      });
    } finally {
      setIsSending(false);
    }
  };

  const handleCustomerLogin = async (payload: {
    demoProfileId?: string;
    fullName?: string;
    email?: string;
    phone?: string;
  }) => {
    setAuthBusy(true);
    setAuthFeedback(null);
    try {
      const res = await saathiApi.loginCustomer({ ...payload, branchId });
      setCustomerSession(res.customer);
      setSubPanel('none');
      setMessages((prev) => [
        ...prev,
        {
          id: `a-auth-${Date.now()}`,
          role: 'assistant',
          text: isUr
            ? `Shukriya ${res.customer.fullName}! Aapka customer account verify ho gaya hai. Ab aap apne orders track kar sakte hain.`
            : `Welcome back, ${res.customer.fullName}. Your verified session is active — you can now track your own orders securely.`,
          quickReplies: isUr
            ? ['Mere orders dikhayein', 'Delivery timing']
            : ['Show my orders', 'Track my latest order'],
        },
      ]);
    } catch (err) {
      setAuthFeedback(err instanceof Error ? err.message : 'Unable to verify customer account.');
    } finally {
      setAuthBusy(false);
    }
  };

  const handleCustomerLogout = async () => {
    await saathiApi.logoutCustomer().catch(() => {});
    setCustomerSession(null);
    setAuthFeedback('Signed out of customer verification session.');
  };

  const handleSupportSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSupBusy(true);
    setSupResult(null);
    try {
      const res = await saathiApi.submitSupportTicket({
        customerName: supName,
        contactPhone: supPhone,
        branchId,
        orderNumber: supOrderNo || undefined,
        category: supCategory,
        summary: supSummary,
      });
      setSupResult({
        type: 'ok',
        text: `Support Ticket ${res.caseNumber} created for ${res.branchName}. Our Customer Care desk will review your request.`,
      });
      setSupSummary('');
    } catch (err) {
      setSupResult({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not create support request.',
      });
    } finally {
      setSupBusy(false);
    }
  };

  const handleFeedback = async (msgId: string, vote: 'up' | 'down', query?: string) => {
    setMessages((prev) => prev.map((m) => (m.id === msgId ? { ...m, voted: vote } : m)));
    await saathiApi.sendFeedback({ vote, query, language }).catch(() => {});
  };

  return (
    <>
      {/* FLOATING LAUNCHER WHEN CLOSED */}
      {!isOpen && (
        <div className="fixed bottom-20 md:bottom-6 right-4 z-40 flex flex-col items-end gap-2">
          {!isMinimized && !hintDismissed && contextualCue && (
            <div className="hidden sm:flex items-center gap-2 bg-[#FFFFFF] border border-[#E6E2DA] rounded-xl shadow-md px-3 py-2 text-xs text-[#1C1917]">
              <button
                type="button"
                onClick={() => {
                  setIsOpen(true);
                  setIsMinimized(false);
                }}
                className="font-medium hover:text-[#9B1C2E] transition-colors text-left"
              >
                {contextualCue}
              </button>
              <button
                type="button"
                onClick={() => setHintDismissed(true)}
                aria-label="Dismiss assistant tip"
                className="p-1 rounded text-[#57534E] hover:text-[#1C1917]"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => {
              setIsOpen(true);
              setIsMinimized(false);
            }}
            aria-label="Open Marhaba Saathi AI assistant"
            className="min-h-[48px] px-4 py-2.5 rounded-2xl bg-[#9B1C2E] text-white shadow-xl border border-[#7F1524] hover:bg-[#7F1524] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#9B1C2E] inline-flex items-center gap-2.5 transition-colors"
          >
            <MessageSquareText className="w-5 h-5 shrink-0" aria-hidden="true" />
            <span className="text-sm font-semibold tracking-tight">
              {isMinimized ? 'Resume Saathi' : 'Marhaba Saathi'}
            </span>
          </button>
        </div>
      )}

      {/* CHAT PANEL (FULL-HEIGHT MOBILE SHEET / ACCESSIBLE DESKTOP PANEL) */}
      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Marhaba Saathi AI Assistant"
          className="fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-4 z-50 w-full sm:w-[420px] max-w-full sm:max-w-[calc(100vw-2rem)] h-[100dvh] sm:h-[min(660px,calc(100dvh-3rem))] bg-[#FAF9F6] sm:rounded-2xl border-0 sm:border sm:border-[#E6E2DA] shadow-2xl flex flex-col overflow-hidden"
        >
          {/* HEADER */}
          <div className="px-4 py-3 bg-[#1C1917] text-white flex items-center justify-between gap-2 shrink-0">
            <div className="flex items-center gap-2.5 min-w-0">
              <button
                type="button"
                onClick={() => {
                  if (subPanel !== 'none') {
                    setSubPanel('none');
                  } else {
                    setIsOpen(false);
                  }
                }}
                aria-label={subPanel !== 'none' ? 'Back to chat' : 'Back to storefront'}
                className="sm:hidden min-w-[44px] min-h-[44px] -ml-2 inline-flex items-center justify-center rounded-xl text-[#E6E2DA] hover:text-white hover:bg-white/10"
              >
                <ArrowLeft className="w-5 h-5" />
              </button>
              <div className="w-9 h-9 rounded-xl bg-[#9B1C2E] flex items-center justify-center shrink-0">
                <MessageSquareText className="w-4 h-4 text-white" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-bold leading-tight truncate">
                  {config?.assistantName || 'Marhaba Saathi AI'}
                </p>
                <p className="text-[11px] text-[#D6D3CD] truncate">
                  {customerSession
                    ? `${isUr ? 'Verified' : 'Verified'} · ${customerSession.fullName}`
                    : isUr
                    ? 'Shopping aur Family Guide'
                    : 'Your Shopping & Family Guide'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-0.5 shrink-0">
              <button
                type="button"
                onClick={() => setSubPanel(subPanel === 'auth' ? 'none' : 'auth')}
                aria-label="Customer account verification"
                title={customerSession ? `Signed in: ${customerSession.fullName}` : 'Customer Sign-In'}
                className={`min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl transition-colors ${
                  customerSession
                    ? 'text-[#4ADE80] hover:bg-white/10'
                    : 'text-[#D6D3CD] hover:text-white hover:bg-white/10'
                }`}
              >
                {customerSession ? <UserCheck className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
              </button>
              <button
                type="button"
                onClick={() => setSubPanel(subPanel === 'support' ? 'none' : 'support')}
                aria-label="Customer support and escalation"
                title="Customer Support"
                className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl text-[#D6D3CD] hover:text-white hover:bg-white/10"
              >
                <Headphones className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsMinimized(true);
                  setIsOpen(false);
                }}
                aria-label="Minimize Marhaba Saathi"
                className="hidden sm:inline-flex min-w-[40px] min-h-[40px] items-center justify-center rounded-xl text-[#D6D3CD] hover:text-white hover:bg-white/10"
              >
                <Minus className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                aria-label="Close Marhaba Saathi"
                className="min-w-[40px] min-h-[40px] inline-flex items-center justify-center rounded-xl text-[#D6D3CD] hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* BODY */}
          {subPanel === 'auth' ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#1C1917]">
                  {isUr ? 'Customer Account Verification' : 'Customer Verification'}
                </h2>
                <button
                  type="button"
                  onClick={() => setSubPanel('none')}
                  className="text-xs font-semibold text-[#9B1C2E] hover:underline"
                >
                  {isUr ? 'Chat par wapas' : 'Back to Chat'}
                </button>
              </div>
              <p className="text-xs text-[#57534E] leading-relaxed">
                {isUr
                  ? 'Aapki privacy ke liye sirf verified customer hi apne orders dekh sakta hai. Sign in karein ya demo profile chunein:'
                  : 'For your privacy, Marhaba Saathi only reveals orders belonging to a verified customer session.'}
              </p>

              {customerSession ? (
                <div className="bg-[#FFFFFF] border border-[#E6E2DA] rounded-xl p-4 space-y-3 text-xs">
                  <p className="font-bold text-[#166534]">Verified Session Active</p>
                  <p className="text-[#1C1917] font-semibold">{customerSession.fullName}</p>
                  <p className="text-[#57534E]">
                    {customerSession.email} · {customerSession.phone}
                  </p>
                  <div className="flex gap-2 pt-1">
                    <button
                      type="button"
                      onClick={() => handleSend(isUr ? 'Mere orders dikhayein' : 'Show my orders')}
                      className="flex-1 min-h-[40px] px-3 py-2 rounded-lg bg-[#9B1C2E] text-white font-semibold"
                    >
                      {isUr ? 'Orders Dekhein' : 'View My Orders'}
                    </button>
                    <button
                      type="button"
                      onClick={handleCustomerLogout}
                      className="min-h-[40px] px-3 py-2 rounded-lg border border-[#E6E2DA] text-[#1C1917] font-semibold"
                    >
                      Sign Out
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="bg-[#FFFFFF] border border-[#E6E2DA] rounded-xl p-3.5 space-y-2">
                    <p className="text-[11px] font-semibold text-[#57534E]">
                      Quick Demo Customer Verification (Seeded Orders)
                    </p>
                    <button
                      type="button"
                      disabled={authBusy}
                      onClick={() => handleCustomerLogin({ demoProfileId: 'cust-nadia-hyd' })}
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6] hover:border-[#9B1C2E] text-left text-xs"
                    >
                      <span className="font-semibold text-[#1C1917] block">Nadia Hussain (Hyderabad)</span>
                      <span className="text-[11px] text-[#57534E]">
                        nadia.hussain@marhaba.demo · Owns MRH-WEB-90412
                      </span>
                    </button>
                    <button
                      type="button"
                      disabled={authBusy}
                      onClick={() => handleCustomerLogin({ demoProfileId: 'cust-saad-k10' })}
                      className="w-full min-h-[42px] px-3 py-2 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6] hover:border-[#9B1C2E] text-left text-xs"
                    >
                      <span className="font-semibold text-[#1C1917] block">Saad Mirza (Karachi Precinct 10-A)</span>
                      <span className="text-[11px] text-[#57534E]">
                        saad.mirza@marhaba.demo · Owns MRH-WEB-90408
                      </span>
                    </button>
                  </div>

                  <form
                    onSubmit={(e) => {
                      e.preventDefault();
                      void handleCustomerLogin({
                        fullName: authName,
                        email: authEmail,
                        phone: authPhone,
                      });
                    }}
                    className="bg-[#FFFFFF] border border-[#E6E2DA] rounded-xl p-4 space-y-3"
                  >
                    <p className="text-xs font-bold text-[#1C1917]">Or Sign In with Your Checkout Details</p>
                    <input
                      type="text"
                      required
                      value={authName}
                      onChange={(e) => setAuthName(e.target.value)}
                      placeholder="Full Name"
                      aria-label="Customer full name"
                      className="w-full h-10 px-3 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6] text-xs"
                    />
                    <input
                      type="email"
                      value={authEmail}
                      onChange={(e) => setAuthEmail(e.target.value)}
                      placeholder="Email address"
                      aria-label="Customer email"
                      className="w-full h-10 px-3 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6] text-xs"
                    />
                    <input
                      type="tel"
                      value={authPhone}
                      onChange={(e) => setAuthPhone(e.target.value)}
                      placeholder="Mobile number (e.g. 0300-1234567)"
                      aria-label="Customer mobile phone"
                      className="w-full h-10 px-3 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6] text-xs"
                    />
                    {authFeedback && <p className="text-xs text-[#9B1C2E]">{authFeedback}</p>}
                    <button
                      type="submit"
                      disabled={authBusy}
                      className="w-full min-h-[42px] rounded-lg bg-[#9B1C2E] text-white text-xs font-semibold hover:bg-[#7F1524]"
                    >
                      {authBusy ? 'Verifying...' : 'Verify & Sign In'}
                    </button>
                  </form>
                </>
              )}
            </div>
          ) : subPanel === 'support' ? (
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-base font-bold text-[#1C1917]">
                  {isUr ? 'Human Customer Support' : 'Customer Support & Escalation'}
                </h2>
                <button
                  type="button"
                  onClick={() => setSubPanel('none')}
                  className="text-xs font-semibold text-[#9B1C2E] hover:underline"
                >
                  {isUr ? 'Chat par wapas' : 'Back to Chat'}
                </button>
              </div>

              <div className="bg-[#FFFFFF] border border-[#E6E2DA] rounded-xl p-3.5 text-xs space-y-1.5">
                <p className="font-semibold text-[#1C1917] inline-flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-[#9B1C2E]" aria-hidden="true" />
                  <span>Verified Marhaba Contacts ({config?.escalationHours || VERIFIED_CONTACT.workingHours})</span>
                </p>
                <p className="text-[#57534E]">
                  Supermarket: <strong className="text-[#1C1917]">{config?.supportPhone || VERIFIED_CONTACT.supportPhone}</strong> ·{' '}
                  {config?.mobileSupport || VERIFIED_CONTACT.mobileSupport}
                </p>
                <p className="text-[#57534E]">
                  Email: <strong className="text-[#1C1917]">{config?.generalEmail || VERIFIED_CONTACT.generalEmail}</strong>
                </p>
                <p className="text-[#57534E]">
                  Restaurant Desk: <strong className="text-[#1C1917]">{VERIFIED_CONTACT.restaurantPhones[0]}</strong> ·{' '}
                  {config?.restaurantEmail || VERIFIED_CONTACT.restaurantEmail}
                </p>
              </div>

              <form
                onSubmit={handleSupportSubmit}
                className="bg-[#FFFFFF] border border-[#E6E2DA] rounded-xl p-4 space-y-3"
              >
                <p className="text-xs font-bold text-[#1C1917]">Submit Direct Support Request</p>
                <input
                  type="text"
                  required
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder="Your full name *"
                  aria-label="Support request name"
                  className="w-full h-10 px-3 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6] text-xs"
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="tel"
                    required
                    value={supPhone}
                    onChange={(e) => setSupPhone(e.target.value)}
                    placeholder="Phone (03XX-...) *"
                    aria-label="Support request phone"
                    className="h-10 px-3 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6] text-xs"
                  />
                  <input
                    type="text"
                    value={supOrderNo}
                    onChange={(e) => setSupOrderNo(e.target.value)}
                    placeholder="Order # (optional)"
                    aria-label="Related order number"
                    className="h-10 px-3 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6] text-xs font-mono"
                  />
                </div>
                <select
                  value={supCategory}
                  onChange={(e) => setSupCategory(e.target.value)}
                  aria-label="Support category"
                  className="w-full h-10 px-3 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6] text-xs"
                >
                  <option value="Order Assistance">Order Assistance</option>
                  <option value="Return & Exchange">Return &amp; Exchange</option>
                  <option value="Inquiry">General / Restaurant / Play Land Inquiry</option>
                  <option value="Complaint">Complaint</option>
                </select>
                <textarea
                  rows={3}
                  required
                  value={supSummary}
                  onChange={(e) => setSupSummary(e.target.value)}
                  placeholder="Briefly describe how our team can help..."
                  aria-label="Support issue summary"
                  className="w-full p-3 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6] text-xs"
                />
                {supResult && (
                  <p
                    role="status"
                    className={`text-xs font-medium ${
                      supResult.type === 'ok' ? 'text-[#166534]' : 'text-[#9B1C2E]'
                    }`}
                  >
                    {supResult.text}
                  </p>
                )}
                <button
                  type="submit"
                  disabled={supBusy}
                  className="w-full min-h-[42px] rounded-lg bg-[#9B1C2E] text-white text-xs font-semibold hover:bg-[#7F1524]"
                >
                  {supBusy ? 'Submitting...' : 'Submit Support Request'}
                </button>
              </form>
            </div>
          ) : (
            <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
              {/* WELCOME GREETING + 6 SMART SUGGESTIONS */}
              <div className="bg-[#FFFFFF] border border-[#E6E2DA] rounded-2xl p-4 space-y-3">
                <p className="text-[11px] font-semibold text-[#9B1C2E]">
                  {VERIFIED_BRANCHES.find((b) => b.id === branchId)?.shortName || 'Hyderabad · Qasim Chowk'} ·{' '}
                  {isUr ? 'Roman Urdu' : 'English'}
                </p>
                <p className="text-sm text-[#1C1917] leading-relaxed">{greetingText}</p>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  {suggestions.map((sug) => (
                    <button
                      key={sug.id}
                      type="button"
                      disabled={isSending}
                      onClick={() => handleSend(isUr ? sug.promptUr : sug.promptEn)}
                      className="min-h-[44px] px-3 py-2 rounded-xl border border-[#E6E2DA] bg-[#FAF9F6] hover:border-[#9B1C2E] hover:bg-[#FFFFFF] text-left text-xs font-semibold text-[#1C1917] flex items-center gap-2 transition-colors"
                    >
                      <SuggestionIcon name={sug.iconName} />
                      <span className="leading-snug">{isUr ? sug.labelUr : sug.labelEn}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* MESSAGE THREAD */}
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[92%] rounded-2xl px-3.5 py-2.5 ${
                      msg.role === 'user'
                        ? 'bg-[#9B1C2E] text-white text-[13px]'
                        : 'bg-[#FFFFFF] border border-[#E6E2DA] text-[#1C1917]'
                    }`}
                  >
                    {msg.role === 'user' ? <p>{msg.text}</p> : renderFormattedReply(msg.text)}
                  </div>

                  {msg.role === 'assistant' && msg.cards && msg.cards.length > 0 && (
                    <div className="w-full max-w-[96%]">
                      <SaathiCards
                        cards={msg.cards}
                        language={language}
                        onCloseMobileSheet={() => {
                          if (window.innerWidth < 640) setIsOpen(false);
                        }}
                        onOpenCustomerAuth={() => setSubPanel('auth')}
                        onOpenSupportEscalation={() => setSubPanel('support')}
                      />
                    </div>
                  )}

                  {msg.role === 'assistant' && (
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      {msg.quickReplies?.slice(0, 3).map((qr) => (
                        <button
                          key={qr}
                          type="button"
                          disabled={isSending}
                          onClick={() => handleSend(qr)}
                          className="min-h-[34px] px-2.5 py-1 rounded-lg border border-[#E6E2DA] bg-[#FFFFFF] hover:border-[#9B1C2E] text-[11px] font-medium text-[#1C1917] transition-colors"
                        >
                          {qr}
                        </button>
                      ))}
                      <div className="inline-flex items-center gap-1 ml-1">
                        <button
                          type="button"
                          aria-label="Helpful response"
                          onClick={() => handleFeedback(msg.id, 'up', msg.queryContext)}
                          className={`p-1.5 rounded-lg ${
                            msg.voted === 'up'
                              ? 'text-[#166534] bg-[#166534]/10'
                              : 'text-[#57534E] hover:text-[#166534]'
                          }`}
                        >
                          <ThumbsUp className="w-3.5 h-3.5" />
                        </button>
                        <button
                          type="button"
                          aria-label="Needs improvement"
                          onClick={() => handleFeedback(msg.id, 'down', msg.queryContext)}
                          className={`p-1.5 rounded-lg ${
                            msg.voted === 'down'
                              ? 'text-[#9B1C2E] bg-[#9B1C2E]/10'
                              : 'text-[#57534E] hover:text-[#9B1C2E]'
                          }`}
                        >
                          <ThumbsDown className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}

              {/* TYPING INDICATOR */}
              {isSending && (
                <div
                  role="status"
                  aria-live="polite"
                  className="inline-flex items-center gap-2 bg-[#FFFFFF] border border-[#E6E2DA] rounded-2xl px-3.5 py-2.5 text-xs text-[#57534E]"
                >
                  <Loader2 className="w-4 h-4 animate-spin text-[#9B1C2E]" aria-hidden="true" />
                  <span>{isUr ? 'Saathi maloomat check kar raha hai...' : 'Marhaba Saathi is checking...'}</span>
                </div>
              )}

              {/* HONEST ERROR BANNER WITH RETRY & ESCALATION */}
              {errorState && (
                <div
                  role="alert"
                  className="rounded-xl border border-[#9B1C2E]/30 bg-[#9B1C2E]/5 p-3 text-xs space-y-2"
                >
                  <p className="font-semibold text-[#9B1C2E] flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" aria-hidden="true" />
                    <span>{errorState.message}</span>
                  </p>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => handleSend(errorState.lastFailedPrompt)}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg bg-[#9B1C2E] text-white font-semibold inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{isUr ? 'Dobara Koshish Karein' : 'Retry'}</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSubPanel('support')}
                      className="min-h-[38px] px-3 py-1.5 rounded-lg border border-[#E6E2DA] bg-[#FFFFFF] text-[#1C1917] font-semibold inline-flex items-center gap-1.5"
                    >
                      <Headphones className="w-3.5 h-3.5" aria-hidden="true" />
                      <span>{isUr ? 'Customer Support' : 'Contact Support'}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* FOOTER COMPOSER & CONTROLS */}
          <div className="p-3 bg-[#FFFFFF] border-t border-[#E6E2DA] space-y-2 shrink-0">
            <div className="flex items-center justify-between gap-2 text-[11px]">
              <div className="inline-flex items-center p-0.5 bg-[#FAF9F6] border border-[#E6E2DA] rounded-lg">
                <button
                  type="button"
                  onClick={() => setLanguage('en')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    language === 'en' ? 'bg-[#FFFFFF] text-[#9B1C2E] shadow-xs' : 'text-[#57534E]'
                  }`}
                >
                  English
                </button>
                <button
                  type="button"
                  onClick={() => setLanguage('ur-roman')}
                  className={`px-2.5 py-1 rounded-md font-semibold transition-colors ${
                    language === 'ur-roman'
                      ? 'bg-[#FFFFFF] text-[#9B1C2E] shadow-xs'
                      : 'text-[#57534E]'
                  }`}
                >
                  Roman Urdu
                </button>
              </div>

              <button
                type="button"
                onClick={() => setSubPanel('support')}
                className="font-semibold text-[#57534E] hover:text-[#9B1C2E] underline-offset-2 hover:underline"
              >
                {isUr ? 'Support se rabta' : 'Help / Contact Support'}
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                void handleSend(inputValue);
              }}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                maxLength={950}
                placeholder={
                  isUr
                    ? 'Products, menu ya Play Land poochein...'
                    : 'Ask about products, dining, Play Land...'
                }
                aria-label="Message Marhaba Saathi AI"
                className="flex-1 min-h-[44px] px-3.5 rounded-xl border border-[#E6E2DA] bg-[#FAF9F6] text-sm text-[#1C1917] placeholder:text-[#57534E] focus:outline-none focus:border-[#9B1C2E]"
              />
              <button
                type="submit"
                disabled={!inputValue.trim() || isSending}
                aria-label="Send message"
                className="min-w-[44px] min-h-[44px] px-3.5 rounded-xl bg-[#9B1C2E] text-white hover:bg-[#7F1524] disabled:bg-[#E6E2DA] disabled:text-[#57534E] inline-flex items-center justify-center transition-colors shrink-0"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>

            <p className="text-[10px] text-[#57534E] leading-snug">{privacyNotice}</p>
          </div>
        </div>
      )}
    </>
  );
}
