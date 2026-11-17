import React, { useState } from 'react';
import {
  CheckCircle2,
  ExternalLink,
  Headphones,
  Lock,
  MapPin,
  Package,
  Phone,
  ShoppingBag,
  Sparkles,
  Tag,
  Truck,
  UtensilsCrossed,
} from 'lucide-react';
import { PRODUCTS } from '../../data/marhabaData';
import { useStore } from '../../context/StoreContext';
import type { SaathiCard, SaathiLanguage } from '../../saathi/types';
import { formatPKR } from '../../utils/commerce';

interface SaathiCardsProps {
  cards: SaathiCard[];
  language: SaathiLanguage;
  onCloseMobileSheet?: () => void;
  onOpenCustomerAuth?: () => void;
  onOpenSupportEscalation?: () => void;
}

export function SaathiCards({
  cards,
  language,
  onCloseMobileSheet,
  onOpenCustomerAuth,
  onOpenSupportEscalation,
}: SaathiCardsProps) {
  const { addToCart, navigate } = useStore();
  const [selectedVariants, setSelectedVariants] = useState<Record<string, string>>({});

  if (!cards || cards.length === 0) return null;

  const isUr = language === 'ur-roman';

  return (
    <div className="mt-2.5 space-y-2.5">
      {cards.map((card, idx) => {
        if (card.type === 'product') {
          const p = card.data;
          const activeVariantId = selectedVariants[p.productId] || p.variantId || p.variants[0]?.id || '';
          const activeVariant = p.variants.find((v) => v.id === activeVariantId) || p.variants[0];
          const displayPrice = activeVariant ? activeVariant.price : p.price;
          const displayOrig = activeVariant ? activeVariant.originalPrice : p.originalPrice;

          return (
            <div
              key={`prod-${p.productId}-${idx}`}
              className="rounded-xl border border-[#E6E2DA] bg-[#FFFFFF] p-3 text-xs space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] text-[#57534E] font-medium">
                    {p.brand} · {p.departmentName}
                  </p>
                  <p className="text-sm font-semibold text-[#1C1917] leading-snug mt-0.5">{p.name}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-sm font-bold text-[#9B1C2E] tabular-nums">
                    {formatPKR(displayPrice)}
                  </p>
                  {displayOrig && displayOrig > displayPrice && (
                    <p className="text-[11px] text-[#57534E] line-through tabular-nums">
                      {formatPKR(displayOrig)}
                    </p>
                  )}
                </div>
              </div>

              <p className="text-[11px] text-[#57534E]">
                SKU: {p.sku} ·{' '}
                <span className={p.inStock ? 'text-[#166534] font-semibold' : 'text-[#9B1C2E] font-semibold'}>
                  {p.stockNote}
                </span>
              </p>

              {p.variants.length > 1 && (
                <div>
                  <label
                    htmlFor={`saathi-var-${p.productId}-${idx}`}
                    className="block text-[11px] text-[#57534E] mb-1"
                  >
                    {isUr ? 'Pack size chunein:' : 'Select option:'}
                  </label>
                  <select
                    id={`saathi-var-${p.productId}-${idx}`}
                    value={activeVariantId}
                    onChange={(e) =>
                      setSelectedVariants((prev) => ({ ...prev, [p.productId]: e.target.value }))
                    }
                    className="w-full h-9 px-2.5 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6] text-xs text-[#1C1917]"
                  >
                    {p.variants.map((v) => (
                      <option key={v.id} value={v.id} disabled={!v.inStock}>
                        {v.label} — {formatPKR(v.price)} {!v.inStock ? '(Out of Stock)' : ''}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  disabled={!p.inStock}
                  onClick={() => {
                    const prodObj = PRODUCTS.find((item) => item.id === p.productId);
                    if (prodObj) addToCart(prodObj, activeVariantId, 1);
                  }}
                  className="flex-1 min-h-[40px] px-3 py-2 rounded-lg bg-[#9B1C2E] text-white font-semibold text-xs hover:bg-[#7F1524] disabled:bg-[#E6E2DA] disabled:text-[#57534E] inline-flex items-center justify-center gap-1.5 transition-colors"
                >
                  <ShoppingBag className="w-3.5 h-3.5" aria-hidden="true" />
                  <span>{p.inStock ? (isUr ? 'Cart mein daalein' : 'Add to Cart') : 'Out of Stock'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate('product', { productId: p.productId });
                    onCloseMobileSheet?.();
                  }}
                  className="min-h-[40px] px-3 py-2 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6] text-[#1C1917] font-semibold text-xs hover:border-[#9B1C2E] inline-flex items-center gap-1 transition-colors"
                >
                  <span>{isUr ? 'Tafseel' : 'View Details'}</span>
                  <ExternalLink className="w-3 h-3" aria-hidden="true" />
                </button>
              </div>
            </div>
          );
        }

        if (card.type === 'dish') {
          const d = card.data;
          return (
            <div
              key={`dish-${d.id}-${idx}`}
              className="rounded-xl border border-[#E6E2DA] bg-[#FFFFFF] p-3 text-xs space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] text-[#57534E] font-medium">
                    {d.cuisine} · {d.category}
                  </p>
                  <p className="text-sm font-semibold text-[#1C1917] mt-0.5">{d.name}</p>
                </div>
                {typeof d.price === 'number' && (
                  <p className="text-sm font-bold text-[#9B1C2E] tabular-nums shrink-0">
                    {formatPKR(d.price)}
                  </p>
                )}
              </div>
              <p className="text-[#57534E] leading-relaxed">{d.description}</p>
              <p className="text-[11px] text-[#57534E]">
                {d.portionSize} · {d.available ? (isUr ? 'Dastiyab' : 'Available') : 'Unavailable'}
              </p>
              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigate('restaurant', { restaurantSection: 'menu' });
                    onCloseMobileSheet?.();
                  }}
                  className="flex-1 min-h-[40px] px-3 py-2 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6] text-[#1C1917] font-semibold hover:border-[#9B1C2E] inline-flex items-center justify-center gap-1.5"
                >
                  <UtensilsCrossed className="w-3.5 h-3.5 text-[#9B1C2E]" aria-hidden="true" />
                  <span>{isUr ? 'Menu Dekhein' : 'View Menu'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate('restaurant', { restaurantSection: 'reservations' });
                    onCloseMobileSheet?.();
                  }}
                  className="flex-1 min-h-[40px] px-3 py-2 rounded-lg bg-[#9B1C2E] text-white font-semibold hover:bg-[#7F1524]"
                >
                  {isUr ? 'Table Reserve' : 'Reserve Table'}
                </button>
              </div>
            </div>
          );
        }

        if (card.type === 'attraction') {
          const a = card.data;
          return (
            <div
              key={`attr-${a.id}-${idx}`}
              className="rounded-xl border border-[#E6E2DA] bg-[#FFFFFF] p-3 text-xs space-y-2"
            >
              <p className="text-[11px] text-[#166534] font-semibold">
                {a.category} · {a.ageRangeLabel} · {a.availability}
              </p>
              <p className="text-sm font-semibold text-[#1C1917]">{a.name}</p>
              <p className="text-[11px] text-[#57534E]">
                Height: {a.heightRequirement} · {a.supervisionRule}
              </p>
              <div className="pt-1 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    navigate('playland', { playLandSection: 'attractions' });
                    onCloseMobileSheet?.();
                  }}
                  className="flex-1 min-h-[40px] px-3 py-2 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6] text-[#1C1917] font-semibold hover:border-[#166534] inline-flex items-center justify-center gap-1.5"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#166534]" aria-hidden="true" />
                  <span>{isUr ? 'Play Land Dekhein' : 'Explore Play Land'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    navigate('playland', { playLandSection: 'plan-visit' });
                    onCloseMobileSheet?.();
                  }}
                  className="flex-1 min-h-[40px] px-3 py-2 rounded-lg bg-[#166534] text-white font-semibold hover:bg-[#14532D]"
                >
                  {isUr ? 'Visit Plan' : 'Plan Visit'}
                </button>
              </div>
            </div>
          );
        }

        if (card.type === 'package') {
          const pk = card.data;
          return (
            <div
              key={`pkg-${pk.id}-${idx}`}
              className="rounded-xl border border-[#E6E2DA] bg-[#FFFFFF] p-3 text-xs space-y-2"
            >
              <div className="flex items-start justify-between gap-2">
                <div>
                  <p className="text-[11px] text-[#166534] font-medium">
                    {pk.participants} · {pk.duration}
                  </p>
                  <p className="text-sm font-semibold text-[#1C1917] mt-0.5">{pk.name}</p>
                </div>
                <p className="text-sm font-bold text-[#166534] tabular-nums shrink-0">
                  {formatPKR(pk.price)}
                </p>
              </div>
              <p className="text-[11px] text-[#57534E]">{pk.includedAttractions.join(' · ')}</p>
              <button
                type="button"
                onClick={() => {
                  navigate('playland', { playLandSection: pk.isBirthday ? 'birthdays' : 'plan-visit' });
                  onCloseMobileSheet?.();
                }}
                className="w-full min-h-[40px] px-3 py-2 rounded-lg bg-[#166534] text-white font-semibold hover:bg-[#14532D]"
              >
                {pk.isBirthday
                  ? isUr
                    ? 'Birthday Inquiry Bhejein'
                    : 'Request Birthday Inquiry'
                  : isUr
                  ? 'Visit Plan Karein'
                  : 'Plan Visit Inquiry'}
              </button>
            </div>
          );
        }

        if (card.type === 'location') {
          const b = card.data;
          return (
            <div
              key={`loc-${b.id}-${idx}`}
              className="rounded-xl border border-[#E6E2DA] bg-[#FFFFFF] p-3 text-xs space-y-1.5"
            >
              <p className="text-[11px] font-semibold text-[#9B1C2E]">
                {b.city} · {b.facilities.join(' · ')}
              </p>
              <p className="text-sm font-semibold text-[#1C1917]">{b.name}</p>
              <p className="text-[#57534E] flex items-start gap-1.5">
                <MapPin className="w-3.5 h-3.5 text-[#9B1C2E] shrink-0 mt-0.5" aria-hidden="true" />
                <span>{b.address}</span>
              </p>
              <p className="text-[11px] text-[#57534E]">
                {b.hours} · <Phone className="w-3 h-3 inline mr-0.5" aria-hidden="true" />
                {b.phones[0]}
              </p>
              <button
                type="button"
                onClick={() => {
                  navigate('locations');
                  onCloseMobileSheet?.();
                }}
                className="w-full min-h-[40px] mt-1 px-3 py-2 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6] text-[#1C1917] font-semibold hover:border-[#9B1C2E]"
              >
                {isUr ? 'Branch Details' : 'Open Locations Page'}
              </button>
            </div>
          );
        }

        if (card.type === 'order') {
          const o = card.data;
          return (
            <div
              key={`ord-${o.orderNumber}-${idx}`}
              className="rounded-xl border border-[#E6E2DA] bg-[#FFFFFF] p-3 text-xs space-y-1.5"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="font-mono font-bold text-[#1C1917] inline-flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-[#9B1C2E]" aria-hidden="true" />
                  <span>{o.orderNumber}</span>
                </p>
                <span className="font-semibold text-[#166534]">{o.stage}</span>
              </div>
              <p className="text-[11px] text-[#57534E]">
                {o.branchId} · {o.fulfillmentMethod === 'pickup' ? 'Store Pickup' : 'Delivery'} ·{' '}
                <span className="font-bold text-[#1C1917] tabular-nums">{formatPKR(o.totalAmount)}</span>
              </p>
              <p className="text-[#1C1917]">{o.itemsSummary}</p>
            </div>
          );
        }

        if (card.type === 'offer') {
          const off = card.data;
          return (
            <div
              key={`off-${off.id}-${idx}`}
              className="rounded-xl border border-[#E6E2DA] bg-[#FFFFFF] p-3 text-xs space-y-1.5"
            >
              <div className="flex items-start justify-between gap-2">
                <p className="text-sm font-semibold text-[#1C1917] inline-flex items-center gap-1.5">
                  <Tag className="w-3.5 h-3.5 text-[#9B1C2E] shrink-0" aria-hidden="true" />
                  <span>{off.title}</span>
                </p>
                <span className="text-xs font-bold text-[#9B1C2E] shrink-0">{off.discountLabel}</span>
              </div>
              <p className="text-[#57534E]">{off.summary}</p>
              <p className="text-[11px] text-[#57534E]">{off.validity}</p>
              <button
                type="button"
                onClick={() => {
                  navigate(off.source === 'restaurant' ? 'restaurant' : 'offers', {
                    restaurantSection: off.source === 'restaurant' ? 'offers' : undefined,
                  });
                  onCloseMobileSheet?.();
                }}
                className="w-full min-h-[38px] px-3 py-1.5 rounded-lg border border-[#E6E2DA] bg-[#FAF9F6] text-[#1C1917] font-semibold hover:border-[#9B1C2E]"
              >
                {isUr ? 'Offers Dekhein' : 'View Offers'}
              </button>
            </div>
          );
        }

        if (card.type === 'delivery') {
          const del = card.data;
          return (
            <div
              key={`del-${idx}`}
              className="rounded-xl border border-[#E6E2DA] bg-[#FFFFFF] p-3 text-xs space-y-1.5"
            >
              <p className="text-sm font-semibold text-[#1C1917] inline-flex items-center gap-1.5">
                <Truck className="w-4 h-4 text-[#9B1C2E]" aria-hidden="true" />
                <span>
                  {del.branchName} — {isUr ? 'Delivery aur Pickup' : 'Delivery & Pickup'}
                </span>
              </p>
              <p className="text-[#57534E]">
                Standard fee: <span className="font-semibold text-[#1C1917] tabular-nums">{formatPKR(del.standardFee)}</span> · Free above{' '}
                <span className="font-semibold text-[#166534] tabular-nums">{formatPKR(del.freeThreshold)}</span>
              </p>
              {typeof del.amountRemainingForFree === 'number' && del.amountRemainingForFree > 0 && (
                <p className="text-[11px] text-[#B45309] font-semibold tabular-nums">
                  {formatPKR(del.amountRemainingForFree)} more in your cart qualifies for free delivery.
                </p>
              )}
              <p className="text-[11px] text-[#57534E]">{del.coverageNote}</p>
            </div>
          );
        }

        if (card.type === 'inquiry_confirmation') {
          const conf = card.data;
          return (
            <div
              key={`conf-${conf.referenceId}-${idx}`}
              className="rounded-xl border border-[#166534]/30 bg-[#166534]/5 p-3 text-xs space-y-1.5"
            >
              <p className="text-sm font-bold text-[#166534] inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 shrink-0" aria-hidden="true" />
                <span>Ref: {conf.referenceId}</span>
              </p>
              <p className="font-semibold text-[#1C1917]">{conf.statusLabel}</p>
              <p className="text-[#57534E]">
                {conf.branchName} · {conf.summary}
              </p>
            </div>
          );
        }

        if (card.type === 'auth_required') {
          return (
            <div
              key={`auth-${idx}`}
              className="rounded-xl border border-[#9B1C2E]/30 bg-[#9B1C2E]/5 p-3 text-xs space-y-2"
            >
              <p className="text-sm font-semibold text-[#1C1917] inline-flex items-center gap-1.5">
                <Lock className="w-4 h-4 text-[#9B1C2E]" aria-hidden="true" />
                <span>{card.data.reason}</span>
              </p>
              <p className="text-[#57534E] leading-relaxed">{card.data.instructions}</p>
              <div className="flex flex-wrap gap-2">
                {onOpenCustomerAuth && (
                  <button
                    type="button"
                    onClick={onOpenCustomerAuth}
                    className="flex-1 min-h-[40px] px-3 py-2 rounded-lg bg-[#9B1C2E] text-white font-semibold hover:bg-[#7F1524]"
                  >
                    {isUr ? 'Verify / Sign In Karein' : 'Sign In to Track Order'}
                  </button>
                )}
                {onOpenSupportEscalation && (
                  <button
                    type="button"
                    onClick={onOpenSupportEscalation}
                    className="min-h-[40px] px-3 py-2 rounded-lg border border-[#E6E2DA] bg-[#FFFFFF] text-[#1C1917] font-semibold inline-flex items-center gap-1"
                  >
                    <Headphones className="w-3.5 h-3.5" aria-hidden="true" />
                    <span>{isUr ? 'Support' : 'Support'}</span>
                  </button>
                )}
              </div>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}
