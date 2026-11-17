import { Type, type FunctionDeclaration } from '@google/genai';
import {
  PLAYLAND_ATTRACTIONS,
  PLAYLAND_PACKAGES,
  PRODUCTS,
  RESTAURANT_DEALS,
  RESTAURANT_DISHES,
  SHOP_DEPARTMENTS,
  VERIFIED_BRANCHES,
} from '../data/marhabaData';
import { getSellableStock } from '../erp/calculations';
import type { ErpDatabaseState } from '../erp/seedData';
import type { PlayLandDatabaseState } from '../playland/seedData';
import type { InterBusinessRequest } from '../portal/types';
import type { RestaurantDatabaseState } from '../restaurant/seedData';
import {
  calculateDiscountPercent,
  FREE_DELIVERY_THRESHOLD_PKR,
  STANDARD_DELIVERY_FEE_PKR,
} from '../utils/commerce';
import { sanitizeUntrustedText } from './knowledgeBase';
import type {
  CustomerSessionProfile,
  SaathiCard,
  SaathiCartAction,
  SaathiOrderCardData,
  SaathiPageContext,
  SaathiProductCardData,
} from './types';

export interface SaathiToolRuntimeDeps {
  erpDb: ErpDatabaseState;
  restaurantDb: RestaurantDatabaseState;
  playLandDb: PlayLandDatabaseState;
  customerSession: CustomerSessionProfile | null;
  pageContext?: SaathiPageContext;
  processedInquiryKeys: Set<string>;
  onInterBusinessRequest?: (
    reqItem: Omit<InterBusinessRequest, 'id' | 'requestNumber' | 'requestedAt' | 'status'>
  ) => InterBusinessRequest;
}

export interface SaathiToolExecutionContext {
  deps: SaathiToolRuntimeDeps;
  cards: SaathiCard[];
  cartActions: SaathiCartAction[];
  toolsUsed: string[];
  escalationSuggested: boolean;
}

export function normalizePhoneDigits(phone: string | undefined | null): string {
  const digits = String(phone || '').replace(/\D/g, '');
  if (digits.startsWith('92') && digits.length >= 11) {
    return `0${digits.slice(2)}`;
  }
  return digits;
}

function phoneMatchesCustomer(orderPhone: string | undefined, sessionPhone: string | undefined): boolean {
  const a = normalizePhoneDigits(orderPhone);
  const b = normalizePhoneDigits(sessionPhone);
  if (!a || !b) return false;
  if (a === b) return true;
  // Support matching masked seed phones such as 0300-XXXX891 against verified demo account last 3 + prefix
  if (orderPhone && orderPhone.includes('XXXX')) {
    const cleanMasked = orderPhone.replace(/\s|-/g, '');
    const prefix = cleanMasked.slice(0, 4).replace(/\D/g, '');
    const suffix = cleanMasked.slice(-3).replace(/\D/g, '');
    return Boolean(prefix && suffix && b.startsWith(prefix) && b.endsWith(suffix));
  }
  return a.length >= 7 && b.length >= 7 && a.slice(-7) === b.slice(-7);
}

export function orderBelongsToCustomer(
  order: { customerEmail?: string; customerPhone?: string; customerName?: string },
  session: CustomerSessionProfile
): boolean {
  if (order.customerEmail && session.email) {
    if (order.customerEmail.trim().toLowerCase() === session.email.trim().toLowerCase()) {
      return true;
    }
  }
  return phoneMatchesCustomer(order.customerPhone, session.phone);
}

function findDepartmentName(departmentId: string): string {
  return SHOP_DEPARTMENTS.find((d) => d.id === departmentId)?.name || 'Supermarket';
}

function buildProductCard(
  product: (typeof PRODUCTS)[number],
  erpDb: ErpDatabaseState,
  branchId?: string
): SaathiProductCardData {
  const liveProd = erpDb.products.find((ep) => ep.id === product.id);
  const price = liveProd ? liveProd.sellingPrice : product.price;
  const originalPrice = liveProd?.originalPrice ?? product.originalPrice;
  const stockRows = erpDb.stock.filter(
    (s) => s.productId === product.id && (!branchId || s.branchId === branchId)
  );
  const sellableCount = stockRows.reduce((sum, s) => sum + getSellableStock(s), 0);
  const inStock = product.inStock && (stockRows.length === 0 || sellableCount > 0);
  const activeVariants = product.variants.filter((v) => v.inStock);

  return {
    productId: product.id,
    variantId: activeVariants[0]?.id || product.variants[0]?.id || '',
    sku: product.sku,
    name: product.name,
    brand: product.brand,
    departmentName: findDepartmentName(product.departmentId),
    unitLabel: product.unitLabel,
    price,
    originalPrice,
    discountPercent: calculateDiscountPercent(originalPrice, price),
    inStock,
    sellableCount: stockRows.length > 0 ? sellableCount : undefined,
    stockNote: inStock
      ? stockRows.length > 0
        ? `In Stock (${sellableCount} sellable)`
        : product.stockNote || 'In Stock'
      : 'Temporarily Out of Stock',
    requiresVariantChoice: activeVariants.length > 1,
    variants: product.variants.map((v) => ({
      id: v.id,
      label: v.label,
      price: v.id === product.variants[0]?.id ? price : v.price,
      originalPrice: v.originalPrice,
      inStock: v.inStock,
    })),
  };
}

export const SAATHI_TOOL_DECLARATIONS: FunctionDeclaration[] = [
  {
    name: 'searchProducts',
    description:
      'Search Marhaba Supermarket catalog with optional department, brand, price range, availability, and promotional discount filters.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Product keywords like milk, rice, oil, shampoo, honey, tea.' },
        departmentId: { type: Type.STRING, description: 'Optional department ID like grocery-pantry, dairy-bakery, fresh-food, beverages, personal-care, beauty-cosmetics.' },
        minPrice: { type: Type.NUMBER, description: 'Minimum price in PKR.' },
        maxPrice: { type: Type.NUMBER, description: 'Maximum price in PKR.' },
        inStockOnly: { type: Type.BOOLEAN, description: 'Set true to only show in-stock products.' },
        offersOnly: { type: Type.BOOLEAN, description: 'Set true to only show discounted products.' },
        limit: { type: Type.INTEGER, description: 'Max number of products to return (1-8).' },
      },
    },
  },
  {
    name: 'getProductDetails',
    description: 'Get full details, variants, specifications, storage notes, and current PKR price for a supermarket product.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        productIdOrSku: { type: Type.STRING, description: 'Product ID, SKU (e.g. MRH-DAI-101), or exact product name.' },
      },
      required: ['productIdOrSku'],
    },
  },
  {
    name: 'checkProductAvailability',
    description: 'Check live branch inventory availability (sellable vs reserved) for a supermarket product across Hyderabad and Karachi branches.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        productIdOrSku: { type: Type.STRING, description: 'Product ID, SKU, or product name.' },
        branchId: { type: Type.STRING, description: 'Optional branch ID: hyderabad, karachi-p10, or karachi-p2.' },
      },
      required: ['productIdOrSku'],
    },
  },
  {
    name: 'getCurrentOffers',
    description: 'Fetch active Marhaba Supermarket promotions, discounted products, and Marhaba Rooftop Restaurant deals.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        branchId: { type: Type.STRING, description: 'Optional branch ID filter.' },
        limit: { type: Type.INTEGER, description: 'Maximum offers to return (1-8).' },
      },
    },
  },
  {
    name: 'addItemToCart',
    description:
      'Add an in-stock supermarket product to the customer cart. Validate stock first; if the product has multiple in-stock variants and variantId is omitted, ask the customer which pack/variant they prefer instead of guessing.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        productIdOrSku: { type: Type.STRING, description: 'Product ID, SKU, or exact name.' },
        variantId: { type: Type.STRING, description: 'Optional variant ID (e.g. olpers-carton, olpers-single, dalda-3l).' },
        quantity: { type: Type.INTEGER, description: 'Quantity to add (1-20).' },
      },
      required: ['productIdOrSku'],
    },
  },
  {
    name: 'readCustomerCart',
    description: 'Read the items, quantities, subtotal, and free delivery threshold progress currently in the customer cart.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        includeThresholdCalc: { type: Type.BOOLEAN, description: 'Whether to include free delivery gap calculation.' },
      },
    },
  },
  {
    name: 'getCustomerOrders',
    description:
      'Fetch orders belonging exclusively to the currently authenticated customer session. If not authenticated, instruct the customer to sign in securely.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        limit: { type: Type.INTEGER, description: 'Maximum recent orders to return (1-5).' },
      },
    },
  },
  {
    name: 'trackAuthorizedOrder',
    description:
      'Track a specific order ONLY if the customer has an authenticated session AND owns that order. Never bypass ownership verification.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        orderNumber: { type: Type.STRING, description: 'Order reference number (e.g. MRH-WEB-90412).' },
      },
      required: ['orderNumber'],
    },
  },
  {
    name: 'getDeliveryInfo',
    description: 'Get verified Marhaba Supermarket delivery fees, free delivery threshold, pickup rules, and branch coverage.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        branchId: { type: Type.STRING, description: 'Optional branch ID (hyderabad, karachi-p10, karachi-p2).' },
      },
    },
  },
  {
    name: 'searchRestaurantMenu',
    description: 'Search Marhaba Rooftop Restaurant cuisines, dishes, portions, prices, dietary tags, and availability.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        query: { type: Type.STRING, description: 'Dish keyword (e.g. karahi, biryani, pizza, kebab, kunafa).' },
        cuisine: { type: Type.STRING, description: 'Optional cuisine: Pakistani, Chinese, Italian, Turkish, or Beverages & Desserts.' },
        availableOnly: { type: Type.BOOLEAN, description: 'Set true to filter available dishes only.' },
      },
    },
  },
  {
    name: 'getRestaurantDish',
    description: 'Get detailed information for a specific Marhaba Restaurant dish including variations, ingredients, and pricing.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        dishIdOrName: { type: Type.STRING, description: 'Dish ID or name.' },
      },
      required: ['dishIdOrName'],
    },
  },
  {
    name: 'submitReservationInquiry',
    description:
      'Submit a dining table reservation inquiry at Marhaba Rooftop Restaurant (always labeled Pending Staff Confirmation). Confirm details with the customer before submitting if anything key is missing.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        branchId: { type: Type.STRING, description: 'Dining branch ID: hyderabad or karachi-p10.' },
        date: { type: Type.STRING, description: 'Preferred date (YYYY-MM-DD).' },
        time: { type: Type.STRING, description: 'Preferred time (e.g. 8:00 PM).' },
        partySize: { type: Type.INTEGER, description: 'Number of guests (1-40).' },
        customerName: { type: Type.STRING, description: 'Guest full name.' },
        contactNumber: { type: Type.STRING, description: 'Guest reachable phone number.' },
        seatingPreference: { type: Type.STRING, description: 'Family Hall, Rooftop Dining, or No Preference.' },
        specialRequests: { type: Type.STRING, description: 'Optional dietary or seating notes.' },
        idempotencyKey: { type: Type.STRING, description: 'Optional idempotency key to prevent duplicate submissions.' },
      },
      required: ['date', 'time', 'partySize', 'customerName', 'contactNumber'],
    },
  },
  {
    name: 'getPlayLandAttractions',
    description:
      'List Marhaba Play Land attractions filtered by child age (in years) or age group, including official safety and height guidelines and live attraction status.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        ageYears: { type: Type.INTEGER, description: 'Optional child age in years (e.g. 3, 6, 10).' },
        category: { type: Type.STRING, description: 'Optional category: Soft Play, Rides, Climbing & Slides, Arcade & Interactive.' },
      },
    },
  },
  {
    name: 'getPlayLandPackages',
    description: 'Retrieve Marhaba Play Land ticket passes and Birthday Celebration package options.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        includeBirthday: { type: Type.BOOLEAN, description: 'Include birthday celebration package details.' },
      },
    },
  },
  {
    name: 'submitVisitInquiry',
    description:
      'Submit a Play Land family visit, birthday celebration, or school/group inquiry (recorded as Inquiry Received — Awaiting Play Land Desk Confirmation).',
    parameters: {
      type: Type.OBJECT,
      properties: {
        inquiryType: { type: Type.STRING, description: 'General Visit, Birthday Celebration, or School / Group Visit.' },
        preferredDate: { type: Type.STRING, description: 'Preferred visit date (YYYY-MM-DD).' },
        childrenCount: { type: Type.INTEGER, description: 'Number of children.' },
        adultsCount: { type: Type.INTEGER, description: 'Number of accompanying adults (min 1).' },
        packageId: { type: Type.STRING, description: 'Optional package ID.' },
        parentName: { type: Type.STRING, description: 'Parent or guardian name.' },
        contactPhone: { type: Type.STRING, description: 'Parent reachable contact phone.' },
        specialRequirements: { type: Type.STRING, description: 'Optional requirements or celebration notes.' },
        idempotencyKey: { type: Type.STRING, description: 'Optional idempotency key.' },
      },
      required: ['preferredDate', 'childrenCount', 'parentName', 'contactPhone'],
    },
  },
  {
    name: 'getBranchLocations',
    description: 'Get verified Marhaba Supermarket, Restaurant & Play Land branch addresses, opening hours, phone numbers, and facilities.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        city: { type: Type.STRING, description: 'Optional city filter: Hyderabad or Karachi.' },
        facility: { type: Type.STRING, description: 'Optional facility filter: Supermarket, Restaurant, or Play Land.' },
      },
    },
  },
  {
    name: 'createSupportRequest',
    description:
      'Create a real Customer Support ticket in Marhaba Customer Care when human assistance, return help, or complaint escalation is requested.',
    parameters: {
      type: Type.OBJECT,
      properties: {
        customerName: { type: Type.STRING, description: 'Customer full name.' },
        contactPhone: { type: Type.STRING, description: 'Customer phone number.' },
        branchId: { type: Type.STRING, description: 'Branch ID (hyderabad, karachi-p10, karachi-p2).' },
        orderNumber: { type: Type.STRING, description: 'Optional related order reference.' },
        category: { type: Type.STRING, description: 'Return & Exchange, Order Assistance, Inquiry, or Complaint.' },
        summary: { type: Type.STRING, description: 'Concise issue summary for support staff.' },
        idempotencyKey: { type: Type.STRING, description: 'Optional idempotency key.' },
      },
      required: ['customerName', 'contactPhone', 'summary'],
    },
  },
];

function resolveProduct(productIdOrSku: string) {
  const q = sanitizeUntrustedText(productIdOrSku, 120).toLowerCase();
  return PRODUCTS.find(
    (p) =>
      p.id.toLowerCase() === q ||
      p.sku.toLowerCase() === q ||
      p.name.toLowerCase() === q ||
      p.name.toLowerCase().includes(q)
  );
}

export async function executeSaathiTool(
  name: string,
  rawArgs: Record<string, unknown>,
  ctx: SaathiToolExecutionContext
): Promise<Record<string, unknown>> {
  const { deps } = ctx;
  if (!ctx.toolsUsed.includes(name)) {
    ctx.toolsUsed.push(name);
  }
  const branchScope = deps.pageContext?.branchId;

  switch (name) {
    case 'searchProducts': {
      const q = sanitizeUntrustedText(String(rawArgs.query || ''), 120).toLowerCase();
      const dept = typeof rawArgs.departmentId === 'string' ? rawArgs.departmentId.trim() : '';
      const minPrice = typeof rawArgs.minPrice === 'number' ? rawArgs.minPrice : null;
      const maxPrice = typeof rawArgs.maxPrice === 'number' ? rawArgs.maxPrice : null;
      const inStockOnly = Boolean(rawArgs.inStockOnly);
      const offersOnly = Boolean(rawArgs.offersOnly);
      const limit = Math.min(8, Math.max(1, Number(rawArgs.limit || 4)));

      const matches = PRODUCTS.map((p) => buildProductCard(p, deps.erpDb, branchScope))
        .filter((card) => {
          const prod = PRODUCTS.find((p) => p.id === card.productId)!;
          if (dept && prod.departmentId !== dept) return false;
          if (minPrice !== null && card.price < minPrice) return false;
          if (maxPrice !== null && card.price > maxPrice) return false;
          if (inStockOnly && !card.inStock) return false;
          if (offersOnly && card.discountPercent <= 0) return false;
          if (q) {
            const hay = `${prod.name} ${prod.brand} ${prod.subcategory} ${card.departmentName} ${prod.description}`.toLowerCase();
            const qTokens = q.split(/\s+/).filter(Boolean);
            if (!qTokens.every((t) => hay.includes(t)) && !hay.includes(q)) {
              return false;
            }
          }
          return true;
        })
        .slice(0, limit);

      for (const card of matches.slice(0, 4)) {
        if (!ctx.cards.some((c) => c.type === 'product' && c.data.productId === card.productId)) {
          ctx.cards.push({ type: 'product', data: card });
        }
      }
      return {
        count: matches.length,
        products: matches,
      };
    }

    case 'getProductDetails': {
      const target = resolveProduct(String(rawArgs.productIdOrSku || ''));
      if (!target) {
        return { found: false, message: 'No matching product found in Marhaba catalog.' };
      }
      const card = buildProductCard(target, deps.erpDb, branchScope);
      if (!ctx.cards.some((c) => c.type === 'product' && c.data.productId === card.productId)) {
        ctx.cards.push({ type: 'product', data: card });
      }
      return {
        found: true,
        product: {
          ...card,
          description: target.description,
          specifications: target.specifications,
          ingredients: target.ingredients,
          storageUsage: target.storageUsage,
          dataTier: target.dataTier,
        },
      };
    }

    case 'checkProductAvailability': {
      const target = resolveProduct(String(rawArgs.productIdOrSku || ''));
      if (!target) {
        return { found: false, message: 'Product not found in Marhaba Supermarket catalog.' };
      }
      const filterBranch = typeof rawArgs.branchId === 'string' ? rawArgs.branchId.trim() : '';
      const branchStocks = VERIFIED_BRANCHES.filter((b) => !filterBranch || b.id === filterBranch).map((b) => {
        const rec = deps.erpDb.stock.find((s) => s.productId === target.id && s.branchId === b.id);
        return {
          branchId: b.id,
          branchName: b.shortName,
          sellableQty: rec ? getSellableStock(rec) : 0,
          reservedQty: rec ? rec.reserved : 0,
          inStock: target.inStock && (rec ? getSellableStock(rec) > 0 : false),
        };
      });
      const card = buildProductCard(target, deps.erpDb, filterBranch || branchScope);
      if (!ctx.cards.some((c) => c.type === 'product' && c.data.productId === card.productId)) {
        ctx.cards.push({ type: 'product', data: card });
      }
      return {
        found: true,
        productId: target.id,
        productName: target.name,
        branches: branchStocks,
      };
    }

    case 'getCurrentOffers': {
      const limit = Math.min(8, Math.max(1, Number(rawArgs.limit || 6)));
      const campaigns = deps.erpDb.promotions
        .filter((pr) => pr.status === 'Active' || pr.status === 'Scheduled')
        .map((pr) => ({
          id: pr.id,
          title: pr.title,
          source: 'supermarket' as const,
          discountLabel: `${pr.discountPercent}% Off`,
          summary: `${pr.departmentId} (${pr.branchScope === 'all' ? 'All Branches' : pr.branchScope}) · ${pr.status}`,
          validity: `${pr.startDate} to ${pr.endDate}`,
        }));

      const restaurantDeals = RESTAURANT_DEALS.filter((d) => d.available).map((d) => ({
        id: d.id,
        title: d.title,
        source: 'restaurant' as const,
        discountLabel: `Rs. ${d.offerPrice.toLocaleString()}`,
        summary: `${d.servings} — Includes ${d.includedItems.join(', ')}`,
        validity: d.validity,
      }));

      const discountedProducts = PRODUCTS.map((p) => buildProductCard(p, deps.erpDb, branchScope))
        .filter((c) => c.discountPercent > 0 && c.inStock)
        .slice(0, 3);

      const allOffers = [...campaigns, ...restaurantDeals].slice(0, limit);
      for (const offer of allOffers.slice(0, 4)) {
        if (!ctx.cards.some((c) => c.type === 'offer' && c.data.id === offer.id)) {
          ctx.cards.push({ type: 'offer', data: offer });
        }
      }
      for (const card of discountedProducts) {
        if (!ctx.cards.some((c) => c.type === 'product' && c.data.productId === card.productId)) {
          ctx.cards.push({ type: 'product', data: card });
        }
      }
      return {
        campaigns,
        restaurantDeals,
        discountedProducts,
      };
    }

    case 'addItemToCart': {
      const target = resolveProduct(String(rawArgs.productIdOrSku || ''));
      if (!target) {
        return { added: false, message: 'Could not find that product in Marhaba catalog.' };
      }
      const card = buildProductCard(target, deps.erpDb, branchScope);
      if (!card.inStock) {
        ctx.cards.push({ type: 'product', data: card });
        return {
          added: false,
          reason: 'OUT_OF_STOCK',
          message: `${target.name} is currently out of stock.`,
        };
      }
      const requestedVariantId = typeof rawArgs.variantId === 'string' ? rawArgs.variantId.trim() : '';
      const activeVariants = target.variants.filter((v) => v.inStock);
      if (activeVariants.length > 1 && !requestedVariantId) {
        ctx.cards.push({ type: 'product', data: card });
        return {
          added: false,
          requiresConfirmation: true,
          reason: 'MULTIPLE_VARIANTS',
          availableVariants: activeVariants.map((v) => ({ id: v.id, label: v.label, price: v.price })),
          message: `${target.name} has multiple pack options (${activeVariants.map((v) => `${v.label} at Rs. ${v.price}`).join(', ')}). Ask the customer which option they prefer or let them select directly on the product card.`,
        };
      }
      const chosenVariant =
        activeVariants.find((v) => v.id === requestedVariantId) || activeVariants[0];
      if (!chosenVariant) {
        return { added: false, reason: 'VARIANT_UNAVAILABLE', message: 'Selected variant is out of stock.' };
      }
      const qty = Math.min(20, Math.max(1, Math.floor(Number(rawArgs.quantity || 1))));
      ctx.cartActions.push({
        type: 'ADD_TO_CART',
        productId: target.id,
        variantId: chosenVariant.id,
        quantity: qty,
        productName: target.name,
      });
      if (!ctx.cards.some((c) => c.type === 'product' && c.data.productId === card.productId)) {
        ctx.cards.push({ type: 'product', data: card });
      }
      return {
        added: true,
        productId: target.id,
        variantId: chosenVariant.id,
        variantLabel: chosenVariant.label,
        quantity: qty,
        unitPrice: chosenVariant.price,
      };
    }

    case 'readCustomerCart': {
      const items = deps.pageContext?.cartItems || [];
      const subtotal =
        typeof deps.pageContext?.cartSubtotal === 'number'
          ? deps.pageContext.cartSubtotal
          : items.reduce((sum, it) => sum + it.unitPrice * it.quantity, 0);
      const remaining = Math.max(0, FREE_DELIVERY_THRESHOLD_PKR - subtotal);
      return {
        itemCount: items.reduce((s, it) => s + it.quantity, 0),
        subtotal,
        freeDeliveryThreshold: FREE_DELIVERY_THRESHOLD_PKR,
        amountToFreeDelivery: remaining,
        qualifiesForFreeDelivery: items.length > 0 && remaining === 0,
        items,
      };
    }

    case 'getCustomerOrders': {
      if (!deps.customerSession) {
        ctx.cards.push({
          type: 'auth_required',
          data: {
            reason: 'Customer Sign-In Required',
            instructions:
              'For your privacy, order history and live status updates are only visible after signing in to your verified Marhaba customer account.',
          },
        });
        return {
          authorized: false,
          requireAuth: true,
          message:
            'Customer is not signed in with a verified customer session. Do NOT reveal any order data; ask them to sign in securely first.',
        };
      }
      const limit = Math.min(5, Math.max(1, Number(rawArgs.limit || 5)));
      const owned = deps.erpDb.onlineOrders
        .filter((o) => orderBelongsToCustomer(o, deps.customerSession!))
        .slice(0, limit);

      const summaries: SaathiOrderCardData[] = owned.map((o) => ({
        orderNumber: o.orderNumber,
        stage: o.stage,
        branchId: o.branchId,
        fulfillmentMethod: o.fulfillmentMethod,
        paymentMethod: o.paymentMethod,
        paymentStatus: o.paymentStatus,
        totalAmount: o.totalAmount,
        createdAt: o.createdAt,
        itemCount: o.items.reduce((s, it) => s + it.quantity, 0),
        itemsSummary: o.items.map((it) => `${it.name} x${it.quantity}`).join(', '),
      }));

      for (const ord of summaries) {
        ctx.cards.push({ type: 'order', data: ord });
      }

      return {
        authorized: true,
        customerName: deps.customerSession.fullName,
        orderCount: summaries.length,
        orders: summaries,
      };
    }

    case 'trackAuthorizedOrder': {
      const requestedOrderNo = sanitizeUntrustedText(String(rawArgs.orderNumber || ''), 64).toUpperCase();
      if (!deps.customerSession) {
        ctx.cards.push({
          type: 'auth_required',
          data: {
            reason: 'Verification Required to Track Order',
            instructions:
              'Marhaba protects your privacy and never exposes order status using only an order number or phone number. Please sign in to verify account ownership.',
          },
        });
        return {
          authorized: false,
          requireAuth: true,
          message:
            'Unauthenticated visitor attempted order lookup. STRICTLY REFUSE to confirm whether the order exists or reveal any status; instruct the customer to sign in.',
        };
      }

      const match = deps.erpDb.onlineOrders.find(
        (o) =>
          o.orderNumber.toUpperCase() === requestedOrderNo &&
          orderBelongsToCustomer(o, deps.customerSession!)
      );

      if (!match) {
        return {
          authorized: true,
          found: false,
          message:
            'No order matching that reference was found under your verified customer account. Do not disclose or confirm orders belonging to other customers.',
        };
      }

      const card: SaathiOrderCardData = {
        orderNumber: match.orderNumber,
        stage: match.stage,
        branchId: match.branchId,
        fulfillmentMethod: match.fulfillmentMethod,
        paymentMethod: match.paymentMethod,
        paymentStatus: match.paymentStatus,
        totalAmount: match.totalAmount,
        createdAt: match.createdAt,
        itemCount: match.items.reduce((s, it) => s + it.quantity, 0),
        itemsSummary: match.items.map((it) => `${it.name} x${it.quantity}`).join(', '),
      };
      ctx.cards.push({ type: 'order', data: card });
      return {
        authorized: true,
        found: true,
        order: card,
      };
    }

    case 'getDeliveryInfo': {
      const bId = typeof rawArgs.branchId === 'string' && rawArgs.branchId ? rawArgs.branchId : branchScope || 'hyderabad';
      const branch = VERIFIED_BRANCHES.find((b) => b.id === bId) || VERIFIED_BRANCHES[0];
      const subtotal = deps.pageContext?.cartSubtotal || 0;
      const amountRemainingForFree = Math.max(0, FREE_DELIVERY_THRESHOLD_PKR - subtotal);
      ctx.cards.push({
        type: 'delivery',
        data: {
          branchName: branch.shortName,
          standardFee: STANDARD_DELIVERY_FEE_PKR,
          freeThreshold: FREE_DELIVERY_THRESHOLD_PKR,
          amountRemainingForFree: subtotal > 0 ? amountRemainingForFree : undefined,
          pickupAvailable: true,
          coverageNote: 'Local delivery across Hyderabad & Bahria Town Karachi; Store Pickup always free.',
        },
      });
      return {
        branch: branch.shortName,
        standardDeliveryFeePkr: STANDARD_DELIVERY_FEE_PKR,
        freeDeliveryThresholdPkr: FREE_DELIVERY_THRESHOLD_PKR,
        pickupFeePkr: 0,
        paymentMethods: ['Cash on Delivery (COD)', 'Card at Pickup Counter'],
        hours: branch.hours,
      };
    }

    case 'searchRestaurantMenu': {
      const q = sanitizeUntrustedText(String(rawArgs.query || ''), 120).toLowerCase();
      const cuisineFilter = typeof rawArgs.cuisine === 'string' ? rawArgs.cuisine.trim().toLowerCase() : '';
      const availableOnly = rawArgs.availableOnly !== false;

      const results = RESTAURANT_DISHES.map((d) => {
        const live = deps.restaurantDb.menu.find(
          (m) => m.id === d.id || m.name.toLowerCase() === d.name.toLowerCase()
        );
        return {
          id: d.id,
          name: d.name,
          cuisine: d.cuisine,
          category: d.category,
          description: d.description,
          portionSize: d.portionSize,
          price: live?.portions?.[0]?.pricePkr ?? d.price,
          available: live ? live.available : d.available,
          dietaryTags: d.dietaryTags,
        };
      }).filter((dish) => {
        if (availableOnly && !dish.available) return false;
        if (cuisineFilter && !dish.cuisine.toLowerCase().includes(cuisineFilter)) return false;
        if (q) {
          const hay = `${dish.name} ${dish.cuisine} ${dish.category} ${dish.description}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      });

      for (const dish of results.slice(0, 4)) {
        if (!ctx.cards.some((c) => c.type === 'dish' && c.data.id === dish.id)) {
          ctx.cards.push({ type: 'dish', data: dish });
        }
      }
      return {
        count: results.length,
        dishes: results.slice(0, 6),
        deals: RESTAURANT_DEALS.filter((d) => d.available),
      };
    }

    case 'getRestaurantDish': {
      const q = sanitizeUntrustedText(String(rawArgs.dishIdOrName || ''), 120).toLowerCase();
      const dish = RESTAURANT_DISHES.find(
        (d) => d.id.toLowerCase() === q || d.name.toLowerCase().includes(q)
      );
      if (!dish) {
        return { found: false, message: 'Dish not found on Marhaba Rooftop Restaurant menu.' };
      }
      const live = deps.restaurantDb.menu.find(
        (m) => m.id === dish.id || m.name.toLowerCase() === dish.name.toLowerCase()
      );
      const cardData = {
        id: dish.id,
        name: dish.name,
        cuisine: dish.cuisine,
        category: dish.category,
        description: dish.description,
        portionSize: dish.portionSize,
        price: live?.portions?.[0]?.pricePkr ?? dish.price,
        available: live ? live.available : dish.available,
        dietaryTags: dish.dietaryTags,
      };
      ctx.cards.push({ type: 'dish', data: cardData });
      return {
        found: true,
        dish: { ...cardData, variations: dish.variations, ingredients: dish.ingredients },
      };
    }

    case 'submitReservationInquiry': {
      const customerName = sanitizeUntrustedText(String(rawArgs.customerName || ''), 80);
      const contactNumber = sanitizeUntrustedText(String(rawArgs.contactNumber || ''), 30);
      const date = sanitizeUntrustedText(String(rawArgs.date || ''), 20);
      const time = sanitizeUntrustedText(String(rawArgs.time || ''), 20);
      const partySize = Number(rawArgs.partySize || 0);
      const rawBranch = String(rawArgs.branchId || 'hyderabad');
      const branchId = rawBranch === 'karachi-p10' ? 'karachi-p10' : 'hyderabad';
      const seatingPreference =
        rawArgs.seatingPreference === 'Rooftop Dining' || rawArgs.seatingPreference === 'Family Hall'
          ? rawArgs.seatingPreference
          : 'No Preference';
      const specialRequests = sanitizeUntrustedText(String(rawArgs.specialRequests || ''), 200);

      if (
        customerName.length < 2 ||
        normalizePhoneDigits(contactNumber).length < 10 ||
        !date ||
        !time ||
        !Number.isFinite(partySize) ||
        partySize < 1 ||
        partySize > 40
      ) {
        return {
          submitted: false,
          error: 'Valid customer name, contact phone (10+ digits), date, time, and party size (1–40) are required.',
        };
      }

      const idempKey =
        typeof rawArgs.idempotencyKey === 'string' && rawArgs.idempotencyKey
          ? `res:${rawArgs.idempotencyKey}`
          : `res:${customerName}:${contactNumber}:${date}:${time}:${partySize}`;

      if (deps.processedInquiryKeys.has(idempKey)) {
        return {
          submitted: true,
          duplicatePrevented: true,
          status: 'Pending Staff Confirmation',
          message: 'Reservation inquiry was already submitted and is awaiting Restaurant desk confirmation.',
        };
      }

      const refId = `RES-${Math.floor(10000 + Math.random() * 90000)}`;
      deps.restaurantDb.reservations.unshift({
        id: `resv-${Date.now()}`,
        reservationCode: refId,
        branchId,
        guestName: customerName,
        phone: contactNumber,
        partySize: Math.floor(partySize),
        date,
        timeSlot: time,
        specialRequests: specialRequests || `Submitted via Marhaba Saathi AI (${seatingPreference})`,
        source: 'Website Inquiry',
        status: 'Requested',
        createdAt: new Date().toISOString(),
        isDemoRecord: false,
      });
      deps.processedInquiryKeys.add(idempKey);

      const branchName = VERIFIED_BRANCHES.find((b) => b.id === branchId)?.shortName || 'Hyderabad Flagship';
      ctx.cards.push({
        type: 'inquiry_confirmation',
        data: {
          kind: 'restaurant_reservation',
          referenceId: refId,
          statusLabel: 'Pending Staff Confirmation',
          summary: `${partySize} guests on ${date} at ${time} (${seatingPreference})`,
          branchName,
        },
      });
      return {
        submitted: true,
        referenceId: refId,
        status: 'Pending Staff Confirmation',
        branchName,
      };
    }

    case 'getPlayLandAttractions': {
      const ageYears = typeof rawArgs.ageYears === 'number' ? rawArgs.ageYears : null;
      const categoryFilter = typeof rawArgs.category === 'string' ? rawArgs.category.toLowerCase() : '';

      const list = PLAYLAND_ATTRACTIONS.map((a) => {
        const live = deps.playLandDb.attractions.find((la) => la.id === a.id);
        return {
          id: a.id,
          name: a.name,
          category: a.category,
          ageGroup: a.ageGroup,
          ageRangeLabel: a.ageRangeLabel,
          heightRequirement: a.heightRequirement,
          supervisionRule: a.supervisionRule,
          availability: live ? live.status : a.availability,
          safetyGuidelines: a.safetyGuidelines,
        };
      }).filter((attr) => {
        if (categoryFilter && !attr.category.toLowerCase().includes(categoryFilter)) return false;
        if (ageYears !== null && Number.isFinite(ageYears)) {
          if (ageYears <= 3) {
            return attr.ageGroup === 'Little Explorers (1–3 yrs)' || attr.ageGroup === 'Family Activities';
          }
          if (ageYears <= 7) {
            return attr.ageGroup === 'Young Adventurers (4–7 yrs)' || attr.ageGroup === 'Family Activities';
          }
          if (ageYears <= 12) {
            return attr.ageGroup === 'Juniors (8–12 yrs)' || attr.ageGroup === 'Family Activities';
          }
          return attr.ageGroup === 'Family Activities';
        }
        return true;
      });

      for (const attr of list.slice(0, 4)) {
        if (!ctx.cards.some((c) => c.type === 'attraction' && c.data.id === attr.id)) {
          ctx.cards.push({ type: 'attraction', data: attr });
        }
      }
      return {
        branchNote: 'Play Land operates inside Marhaba Hyderabad Flagship (Qasim Chowk) daily 10:00 AM – 10:00 PM.',
        count: list.length,
        attractions: list,
      };
    }

    case 'getPlayLandPackages': {
      const includeBirthday = rawArgs.includeBirthday !== false;
      const packs = PLAYLAND_PACKAGES.filter((pk) => includeBirthday || !pk.isBirthday).map((pk) => {
        const live = deps.playLandDb.packages.find((lp) => lp.id === pk.id);
        return {
          id: pk.id,
          name: pk.name,
          price: live?.pricePkr ?? pk.price,
          participants: pk.participants,
          duration: pk.duration,
          includedAttractions: pk.includedAttractions,
          terms: pk.terms,
          isBirthday: pk.isBirthday,
        };
      });
      for (const p of packs) {
        if (!ctx.cards.some((c) => c.type === 'package' && c.data.id === p.id)) {
          ctx.cards.push({ type: 'package', data: p });
        }
      }
      return {
        count: packs.length,
        packages: packs,
      };
    }

    case 'submitVisitInquiry': {
      const parentName = sanitizeUntrustedText(String(rawArgs.parentName || ''), 80);
      const contactPhone = sanitizeUntrustedText(String(rawArgs.contactPhone || ''), 30);
      const preferredDate = sanitizeUntrustedText(String(rawArgs.preferredDate || ''), 20);
      const childrenCount = Number(rawArgs.childrenCount || 0);
      const adultsCount = Math.max(1, Number(rawArgs.adultsCount || 1));
      const inquiryType =
        rawArgs.inquiryType === 'Birthday Celebration' || rawArgs.inquiryType === 'School / Group Visit'
          ? rawArgs.inquiryType
          : 'General Visit';
      const specialRequirements = sanitizeUntrustedText(String(rawArgs.specialRequirements || ''), 240);

      if (
        parentName.length < 2 ||
        normalizePhoneDigits(contactPhone).length < 10 ||
        !preferredDate ||
        !Number.isFinite(childrenCount) ||
        childrenCount < 1 ||
        childrenCount > 60
      ) {
        return {
          submitted: false,
          error: 'Parent name, valid phone number, preferred date, and number of children (1–60) are required.',
        };
      }

      const idempKey =
        typeof rawArgs.idempotencyKey === 'string' && rawArgs.idempotencyKey
          ? `play:${rawArgs.idempotencyKey}`
          : `play:${parentName}:${contactPhone}:${preferredDate}:${childrenCount}`;

      if (deps.processedInquiryKeys.has(idempKey)) {
        return {
          submitted: true,
          duplicatePrevented: true,
          status: 'Inquiry Received — Awaiting Play Land Desk Confirmation',
        };
      }

      const refId = `PLAY-${Math.floor(10000 + Math.random() * 90000)}`;
      deps.playLandDb.supportCases.unshift({
        id: `pc-${Date.now()}`,
        caseNumber: refId,
        parentName,
        phone: contactPhone.length > 6 ? `${contactPhone.slice(0, 4)}-***-${contactPhone.slice(-3)}` : contactPhone,
        category: 'Parent Question',
        status: 'Open',
        assignedTo: 'Play Land Guest Relations',
        summary: `${inquiryType} on ${preferredDate} for ${childrenCount} child(ren), ${adultsCount} adult(s). ${specialRequirements}`.trim(),
        createdAt: new Date().toISOString(),
      });
      if (inquiryType === 'Birthday Celebration' && deps.onInterBusinessRequest) {
        deps.onInterBusinessRequest({
          sourceSystem: 'playland',
          targetSystem: 'restaurant',
          branchId: 'hyderabad',
          category: 'Event Catering',
          title: `Saathi AI Birthday Coordination (${refId})`,
          itemsSummary: `${parentName} requested Play Land Birthday visit on ${preferredDate} for ${childrenCount} children.`,
          estimatedAmountPkr: 18500,
          requestedByName: 'Marhaba Saathi AI Intake',
        });
      }
      deps.processedInquiryKeys.add(idempKey);

      ctx.cards.push({
        type: 'inquiry_confirmation',
        data: {
          kind: 'playland_visit',
          referenceId: refId,
          statusLabel: 'Inquiry Received — Awaiting Play Land Desk Confirmation',
          summary: `${inquiryType} · ${childrenCount} child(ren), ${adultsCount} adult(s) on ${preferredDate}`,
          branchName: 'Hyderabad Flagship · Qasim Chowk',
        },
      });
      return {
        submitted: true,
        referenceId: refId,
        status: 'Inquiry Received — Awaiting Play Land Desk Confirmation',
      };
    }

    case 'getBranchLocations': {
      const city = typeof rawArgs.city === 'string' ? rawArgs.city.trim().toLowerCase() : '';
      const facility = typeof rawArgs.facility === 'string' ? rawArgs.facility.trim().toLowerCase() : '';

      const branches = VERIFIED_BRANCHES.filter((b) => {
        if (city && b.city.toLowerCase() !== city) return false;
        if (facility && !b.facilities.some((f) => f.toLowerCase().includes(facility))) return false;
        return true;
      });
      for (const b of branches) {
        if (!ctx.cards.some((c) => c.type === 'location' && c.data.id === b.id)) {
          ctx.cards.push({ type: 'location', data: b });
        }
      }
      return {
        count: branches.length,
        branches,
      };
    }

    case 'createSupportRequest': {
      const customerName = sanitizeUntrustedText(String(rawArgs.customerName || ''), 80);
      const contactPhone = sanitizeUntrustedText(String(rawArgs.contactPhone || ''), 30);
      const summary = sanitizeUntrustedText(String(rawArgs.summary || ''), 300);
      const branchId =
        typeof rawArgs.branchId === 'string' && VERIFIED_BRANCHES.some((b) => b.id === rawArgs.branchId)
          ? rawArgs.branchId
          : branchScope || 'hyderabad';
      const orderNumber = sanitizeUntrustedText(String(rawArgs.orderNumber || ''), 40);
      const rawCategory = sanitizeUntrustedText(String(rawArgs.category || 'Inquiry'), 40);
      const validCategories = ['Return & Exchange', 'Order Assistance', 'Inquiry', 'Complaint'] as const;
      const category = validCategories.find((c) => c.toLowerCase() === rawCategory.toLowerCase()) || 'Inquiry';

      if (customerName.length < 2 || normalizePhoneDigits(contactPhone).length < 10 || summary.length < 5) {
        return {
          created: false,
          error: 'Customer name, valid contact phone (10+ digits), and issue summary (5+ chars) are required.',
        };
      }

      const idempKey =
        typeof rawArgs.idempotencyKey === 'string' && rawArgs.idempotencyKey
          ? `sup:${rawArgs.idempotencyKey}`
          : `sup:${customerName}:${contactPhone}:${summary.slice(0, 40)}`;
      if (deps.processedInquiryKeys.has(idempKey)) {
        return {
          created: true,
          duplicatePrevented: true,
          message: 'Support ticket was already logged in Customer Care.',
        };
      }

      const caseNumber = `CS-AI-${Math.floor(1000 + Math.random() * 9000)}`;
      const maskedPhone =
        contactPhone.length > 6 ? `${contactPhone.slice(0, 4)}-***-${contactPhone.slice(-3)}` : contactPhone;
      deps.erpDb.customerCases.unshift({
        id: `case-ai-${Date.now()}`,
        caseNumber,
        customerName,
        maskedPhone,
        branchId,
        orderNumber: orderNumber || undefined,
        category,
        priority: category.toLowerCase().includes('complaint') ? 'High' : 'Normal',
        status: 'Open',
        assignedTo: 'Customer Care Desk',
        notes: `[Marhaba Saathi Escalation] ${summary}`,
        createdAt: new Date().toISOString(),
      });
      deps.processedInquiryKeys.add(idempKey);
      ctx.escalationSuggested = true;

      const branchName = VERIFIED_BRANCHES.find((b) => b.id === branchId)?.shortName || 'Hyderabad Flagship';
      ctx.cards.push({
        type: 'inquiry_confirmation',
        data: {
          kind: 'support_ticket',
          referenceId: caseNumber,
          statusLabel: 'Open — Assigned to Marhaba Customer Care',
          summary,
          branchName,
        },
      });

      return {
        created: true,
        caseNumber,
        status: 'Open',
        branchName,
      };
    }

    default:
      return { error: `Unknown tool capability: ${name}` };
  }
}
