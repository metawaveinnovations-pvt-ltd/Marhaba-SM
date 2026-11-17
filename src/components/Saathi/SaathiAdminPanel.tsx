import React, { useCallback, useEffect, useState } from 'react';
import {
  CheckCircle2,
  Database,
  MessageSquareText,
  Plus,
  RefreshCw,
  ShieldCheck,
} from 'lucide-react';
import { hasPermission } from '../../erp/permissions';
import type { StaffRoleId } from '../../erp/types';
import { KNOWLEDGE_DOMAIN_LABELS } from '../../saathi/knowledgeBase';
import type {
  KnowledgeDomainId,
  KnowledgeDomainSummary,
  SaathiAdminConfig,
  SaathiQualityMetrics,
  SaathiUnresolvedEntry,
} from '../../saathi/types';
import { getStoredMgmtToken } from '../Management/managementApi';
import { saathiApi } from './saathiApi';

interface SaathiAdminPanelProps {
  roleId: StaffRoleId;
}

export function SaathiAdminPanel({ roleId }: SaathiAdminPanelProps) {
  const canEdit =
    hasPermission(roleId, 'customers', 'edit') || hasPermission(roleId, 'settings', 'administer');

  const [config, setConfig] = useState<SaathiAdminConfig | null>(null);
  const [metrics, setMetrics] = useState<SaathiQualityMetrics | null>(null);
  const [domains, setDomains] = useState<KnowledgeDomainSummary[]>([]);
  const [unresolved, setUnresolved] = useState<SaathiUnresolvedEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'ok' | 'err'; text: string } | null>(null);

  // Editable config fields
  const [greetingEn, setGreetingEn] = useState('');
  const [greetingUr, setGreetingUr] = useState('');
  const [escalationHours, setEscalationHours] = useState('');
  const [deliveryPolicy, setDeliveryPolicy] = useState('');
  const [returnsPolicy, setReturnsPolicy] = useState('');
  const [safetyPolicy, setSafetyPolicy] = useState('');

  // New FAQ form
  const [faqQuestion, setFaqQuestion] = useState('');
  const [faqAnswer, setFaqAnswer] = useState('');
  const [faqDomain, setFaqDomain] = useState<KnowledgeDomainId>('support_faqs');

  // Resolution inputs
  const [faqPromoteAnswers, setFaqPromoteAnswers] = useState<Record<string, string>>({});

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    try {
      const token = getStoredMgmtToken();
      const data = await saathiApi.getAdminDashboard(token);
      setConfig(data.config);
      setMetrics(data.metrics);
      setDomains(data.domains);
      setUnresolved(data.unresolvedLogs);

      setGreetingEn(data.config.greetingEn);
      setGreetingUr(data.config.greetingUr);
      setEscalationHours(data.config.escalationHours);
      setDeliveryPolicy(data.config.deliveryPolicySummary);
      setReturnsPolicy(data.config.returnsPolicySummary);
      setSafetyPolicy(data.config.safetyPolicySummary);
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not load Marhaba Saathi Admin dashboard.',
      });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const handleSaveConfig = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await saathiApi.updateAdminConfig(
        {
          greetingEn,
          greetingUr,
          escalationHours,
          deliveryPolicySummary: deliveryPolicy,
          returnsPolicySummary: returnsPolicy,
          safetyPolicySummary: safetyPolicy,
        },
        getStoredMgmtToken()
      );
      setConfig(res.config);
      setStatusMsg({
        type: 'ok',
        text: `Assistant greeting, hours & policies updated (Knowledge v${res.config.knowledgeVersion}).`,
      });
      await loadDashboard();
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Failed to save configuration.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleAddFaq = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await saathiApi.addFaq(
        { question: faqQuestion, answer: faqAnswer, domain: faqDomain },
        getStoredMgmtToken()
      );
      setConfig(res.config);
      setFaqQuestion('');
      setFaqAnswer('');
      setStatusMsg({ type: 'ok', text: 'FAQ added to Marhaba Saathi knowledge base.' });
      await loadDashboard();
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Could not add FAQ entry.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleSyncKnowledge = async () => {
    if (!canEdit) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      const res = await saathiApi.syncKnowledge(getStoredMgmtToken());
      setDomains(res.domains);
      setStatusMsg({
        type: 'ok',
        text: `8 knowledge domains synchronized with live catalogs (v${res.knowledgeVersion}).`,
      });
      await loadDashboard();
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Sync failed.',
      });
    } finally {
      setBusy(false);
    }
  };

  const handleResolveUnresolved = async (id: string, promoteToFaq: boolean) => {
    if (!canEdit) return;
    setBusy(true);
    setStatusMsg(null);
    try {
      const answer = faqPromoteAnswers[id] || '';
      await saathiApi.resolveUnresolved(
        id,
        {
          status: promoteToFaq ? 'Converted to FAQ' : 'Resolved',
          promoteToFaq,
          faqAnswer: promoteToFaq ? answer : undefined,
        },
        getStoredMgmtToken()
      );
      setStatusMsg({
        type: 'ok',
        text: promoteToFaq ? 'Unresolved question converted into FAQ.' : 'Unresolved entry marked Resolved.',
      });
      await loadDashboard();
    } catch (err) {
      setStatusMsg({
        type: 'err',
        text: err instanceof Error ? err.message : 'Action failed.',
      });
    } finally {
      setBusy(false);
    }
  };

  if (loading && !config) {
    return (
      <div className="bg-[#FFFFFF] border border-[#E6E2DA] rounded-2xl p-6 text-xs text-[#57534E]">
        Loading Marhaba Saathi AI Administration...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {statusMsg && (
        <div
          role="status"
          className={`p-3.5 rounded-xl border text-xs font-medium flex items-center gap-2 ${
            statusMsg.type === 'ok'
              ? 'bg-[#166534]/8 border-[#166534]/25 text-[#166534]'
              : 'bg-[#9B1C2E]/8 border-[#9B1C2E]/25 text-[#9B1C2E]'
          }`}
        >
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{statusMsg.text}</span>
        </div>
      )}

      {/* QUALITY & USAGE METRICS (NO PII LEAKAGE) */}
      {metrics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-[#FFFFFF] border border-[#E6E2DA] rounded-2xl p-4">
            <p className="text-[11px] font-semibold text-[#57534E]">Total Customer Queries</p>
            <p className="text-2xl font-bold text-[#1C1917] mt-1 tabular-nums">{metrics.totalQueries}</p>
            <p className="text-[11px] text-[#57534E] mt-0.5 tabular-nums">
              {metrics.toolAssistedResponses} live tool-assisted
            </p>
          </div>
          <div className="bg-[#FFFFFF] border border-[#E6E2DA] rounded-2xl p-4">
            <p className="text-[11px] font-semibold text-[#57534E]">Avg Response Latency</p>
            <p className="text-2xl font-bold text-[#1C1917] mt-1 tabular-nums">{metrics.avgLatencyMs} ms</p>
            <p className="text-[11px] text-[#166534] mt-0.5 tabular-nums">
              {metrics.successfulResponses} completed
            </p>
          </div>
          <div className="bg-[#FFFFFF] border border-[#E6E2DA] rounded-2xl p-4">
            <p className="text-[11px] font-semibold text-[#57534E]">Helpful / Feedback</p>
            <p className="text-2xl font-bold text-[#166534] mt-1 tabular-nums">
              +{metrics.helpfulVotes} / -{metrics.notHelpfulVotes}
            </p>
            <p className="text-[11px] text-[#57534E] mt-0.5 tabular-nums">
              {metrics.escalatedCount} escalations created
            </p>
          </div>
          <div className="bg-[#FFFFFF] border border-[#E6E2DA] rounded-2xl p-4">
            <p className="text-[11px] font-semibold text-[#57534E]">Knowledge Version</p>
            <p className="text-2xl font-bold text-[#9B1C2E] mt-1 tabular-nums">
              v{config?.knowledgeVersion || 1}
            </p>
            <p className="text-[11px] text-[#57534E] mt-0.5 tabular-nums">
              {domains.length} domains synced
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* WELCOME GREETING, HOURS & POLICY CONTROLS */}
        <section className="lg:col-span-7 bg-[#FFFFFF] border border-[#E6E2DA] rounded-2xl p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-sm font-bold text-[#1C1917] flex items-center gap-2">
              <MessageSquareText className="w-4 h-4 text-[#9B1C2E]" />
              <span>Greeting, Hours &amp; Grounded Policy Controls</span>
            </h2>
            {!canEdit && (
              <span className="text-[11px] font-semibold text-[#57534E]">Read-Only View</span>
            )}
          </div>

          <form onSubmit={handleSaveConfig} className="space-y-3 text-xs">
            <div>
              <label htmlFor="saathi-admin-greeting-en" className="block font-semibold text-[#1C1917] mb-1">
                Welcome Greeting (English)
              </label>
              <textarea
                id="saathi-admin-greeting-en"
                rows={2}
                disabled={!canEdit || busy}
                value={greetingEn}
                onChange={(e) => setGreetingEn(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6]"
              />
            </div>

            <div>
              <label htmlFor="saathi-admin-greeting-ur" className="block font-semibold text-[#1C1917] mb-1">
                Welcome Greeting (Roman Urdu)
              </label>
              <textarea
                id="saathi-admin-greeting-ur"
                rows={2}
                disabled={!canEdit || busy}
                value={greetingUr}
                onChange={(e) => setGreetingUr(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6]"
              />
            </div>

            <div>
              <label htmlFor="saathi-admin-hours" className="block font-semibold text-[#1C1917] mb-1">
                Support &amp; Escalation Hours
              </label>
              <input
                id="saathi-admin-hours"
                type="text"
                disabled={!canEdit || busy}
                value={escalationHours}
                onChange={(e) => setEscalationHours(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6]"
              />
            </div>

            <div>
              <label htmlFor="saathi-admin-delivery" className="block font-semibold text-[#1C1917] mb-1">
                Delivery Policy Guidance
              </label>
              <textarea
                id="saathi-admin-delivery"
                rows={2}
                disabled={!canEdit || busy}
                value={deliveryPolicy}
                onChange={(e) => setDeliveryPolicy(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6]"
              />
            </div>

            <div>
              <label htmlFor="saathi-admin-returns" className="block font-semibold text-[#1C1917] mb-1">
                Returns &amp; Refunds Policy Guidance
              </label>
              <textarea
                id="saathi-admin-returns"
                rows={2}
                disabled={!canEdit || busy}
                value={returnsPolicy}
                onChange={(e) => setReturnsPolicy(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6]"
              />
            </div>

            <div>
              <label htmlFor="saathi-admin-safety" className="block font-semibold text-[#1C1917] mb-1">
                Play Land Safety Guidance
              </label>
              <textarea
                id="saathi-admin-safety"
                rows={2}
                disabled={!canEdit || busy}
                value={safetyPolicy}
                onChange={(e) => setSafetyPolicy(e.target.value)}
                className="w-full p-2.5 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6]"
              />
            </div>

            {canEdit && (
              <button
                type="submit"
                disabled={busy}
                className="min-h-[40px] px-4 py-2 rounded-lg bg-[#9B1C2E] text-white font-semibold hover:bg-[#7F1524]"
              >
                Save Saathi Configuration
              </button>
            )}
          </form>
        </section>

        {/* 8 KNOWLEDGE DOMAINS & LIVE SYNC STATUS */}
        <section className="lg:col-span-5 space-y-5">
          <div className="bg-[#FFFFFF] border border-[#E6E2DA] rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-sm font-bold text-[#1C1917] flex items-center gap-2">
                <Database className="w-4 h-4 text-[#9B1C2E]" />
                <span>8 Separate Knowledge Domains</span>
              </h2>
              {canEdit && (
                <button
                  type="button"
                  disabled={busy}
                  onClick={handleSyncKnowledge}
                  className="px-3 py-1.5 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6] hover:border-[#9B1C2E] text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Sync Now</span>
                </button>
              )}
            </div>

            <div className="divide-y divide-[#E6E2DA] text-xs">
              {domains.map((dom) => (
                <div key={dom.domain} className="py-2 flex items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold text-[#1C1917]">{dom.label}</p>
                    <p className="text-[11px] text-[#57534E]">
                      {dom.docCount} source doc(s) · v{dom.version}
                    </p>
                  </div>
                  <span className="text-[11px] font-mono text-[#166534]">Synced</span>
                </div>
              ))}
            </div>
          </div>

          {/* ADD / MANAGE CUSTOM FAQS */}
          {canEdit && (
            <form
              onSubmit={handleAddFaq}
              className="bg-[#FFFFFF] border border-[#E6E2DA] rounded-2xl p-5 space-y-3 text-xs"
            >
              <h3 className="text-sm font-bold text-[#1C1917] flex items-center gap-2">
                <Plus className="w-4 h-4 text-[#9B1C2E]" />
                <span>Add Knowledge FAQ Entry</span>
              </h3>
              <select
                value={faqDomain}
                onChange={(e) => setFaqDomain(e.target.value as KnowledgeDomainId)}
                aria-label="FAQ Knowledge Domain"
                className="w-full h-10 px-3 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6]"
              >
                {(Object.keys(KNOWLEDGE_DOMAIN_LABELS) as KnowledgeDomainId[]).map((key) => (
                  <option key={key} value={key}>
                    {KNOWLEDGE_DOMAIN_LABELS[key]}
                  </option>
                ))}
              </select>
              <input
                type="text"
                required
                value={faqQuestion}
                onChange={(e) => setFaqQuestion(e.target.value)}
                placeholder="Customer question (e.g. Do you offer gift hampers?)"
                className="w-full h-10 px-3 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6]"
              />
              <textarea
                rows={2}
                required
                value={faqAnswer}
                onChange={(e) => setFaqAnswer(e.target.value)}
                placeholder="Verified official answer..."
                className="w-full p-2.5 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6]"
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full min-h-[40px] rounded-lg bg-[#1C1917] text-white font-semibold hover:bg-[#292524]"
              >
                Publish FAQ to Knowledge Base
              </button>
            </form>
          )}
        </section>
      </div>

      {/* UNRESOLVED QUESTIONS & ACTIVE FAQS */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-6 bg-[#FFFFFF] border border-[#E6E2DA] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E6E2DA] flex items-center justify-between">
            <h2 className="text-sm font-bold text-[#1C1917] flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-[#9B1C2E]" />
              <span>Unresolved &amp; Low-Confidence Queries ({unresolved.length})</span>
            </h2>
          </div>
          <div className="divide-y divide-[#E6E2DA]">
            {unresolved.length === 0 ? (
              <p className="p-5 text-xs text-[#57534E]">
                No unresolved queries logged yet. Questions marked unhelpful or lacking verified records appear here for staff review.
              </p>
            ) : (
              unresolved.map((u) => (
                <div key={u.id} className="p-4 text-xs space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-[#1C1917]">{u.query}</span>
                    <span className="font-mono text-[11px] text-[#9B1C2E] shrink-0">{u.status}</span>
                  </div>
                  <p className="text-[11px] text-[#57534E]">
                    {u.reason} · {u.branchId} · {u.language}
                  </p>
                  {canEdit && u.status === 'Open' && (
                    <div className="pt-1 flex flex-wrap gap-2">
                      <input
                        type="text"
                        value={faqPromoteAnswers[u.id] || ''}
                        onChange={(e) =>
                          setFaqPromoteAnswers((prev) => ({ ...prev, [u.id]: e.target.value }))
                        }
                        placeholder="Verified FAQ answer..."
                        className="flex-1 min-w-[180px] h-8 px-2.5 rounded border border-[#E6E2DA] bg-[#FAF9F6]"
                      />
                      <button
                        type="button"
                        disabled={busy || !(faqPromoteAnswers[u.id] || '').trim()}
                        onClick={() => handleResolveUnresolved(u.id, true)}
                        className="px-2.5 py-1 rounded bg-[#9B1C2E] text-white font-semibold disabled:opacity-50"
                      >
                        Convert to FAQ
                      </button>
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => handleResolveUnresolved(u.id, false)}
                        className="px-2.5 py-1 rounded border border-[#E6E2DA] text-[#1C1917] font-semibold"
                      >
                        Mark Resolved
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </section>

        <section className="lg:col-span-6 bg-[#FFFFFF] border border-[#E6E2DA] rounded-2xl overflow-hidden">
          <div className="px-5 py-4 border-b border-[#E6E2DA]">
            <h2 className="text-sm font-bold text-[#1C1917]">
              Active Curated FAQs ({config?.faqs.length || 0})
            </h2>
          </div>
          <div className="divide-y divide-[#E6E2DA]">
            {config?.faqs.map((f) => (
              <div key={f.id} className="p-4 text-xs space-y-1">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-semibold text-[#1C1917]">{f.question}</p>
                  {canEdit && (
                    <button
                      type="button"
                      disabled={busy}
                      onClick={async () => {
                        setBusy(true);
                        try {
                          const res = await saathiApi.toggleFaq(
                            f.id,
                            !f.active,
                            getStoredMgmtToken()
                          );
                          setConfig(res.config);
                        } finally {
                          setBusy(false);
                        }
                      }}
                      className={`px-2 py-0.5 rounded border text-[11px] font-semibold shrink-0 ${
                        f.active
                          ? 'border-[#166534]/30 text-[#166534] bg-[#166534]/5'
                          : 'border-[#E6E2DA] text-[#57534E] bg-[#FAF9F6]'
                      }`}
                    >
                      {f.active ? 'Active' : 'Disabled'}
                    </button>
                  )}
                </div>
                <p className="text-[#57534E] leading-relaxed">{f.answer}</p>
                <p className="text-[11px] text-[#57534E]">
                  Domain: {KNOWLEDGE_DOMAIN_LABELS[f.domain]}
                </p>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
