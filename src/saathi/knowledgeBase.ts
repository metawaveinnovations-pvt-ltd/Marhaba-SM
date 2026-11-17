import {
  ABOUT_MILESTONES,
  ABOUT_TRUST_CREEDS,
  BOARD_OF_DIRECTORS,
  CORPORATE_WORKFORCE,
  PARENTS_GUIDE_SECTIONS,
  PLAYLAND_ATTRACTIONS,
  PLAYLAND_PACKAGES,
  PRODUCTS,
  RESTAURANT_CUISINES,
  RESTAURANT_DEALS,
  RESTAURANT_DISHES,
  SHOP_DEPARTMENTS,
  VERIFIED_BRANCHES,
  VERIFIED_CONTACT,
} from '../data/marhabaData';
import type { ErpDatabaseState } from '../erp/seedData';
import type { PlayLandDatabaseState } from '../playland/seedData';
import type { RestaurantDatabaseState } from '../restaurant/seedData';
import {
  FREE_DELIVERY_THRESHOLD_PKR,
  STANDARD_DELIVERY_FEE_PKR,
} from '../utils/commerce';
import type {
  KnowledgeDocument,
  KnowledgeDomainId,
  KnowledgeDomainSummary,
  SaathiAdminConfig,
  SaathiFaqEntry,
  SaathiWelcomeSuggestion,
} from './types';

export const KNOWLEDGE_DOMAIN_LABELS: Record<KnowledgeDomainId, string> = {
  company_locations: 'Company & Locations',
  supermarket_products: 'Supermarket Products',
  shopping_promotions: 'Shopping & Promotions',
  orders_delivery: 'Orders & Delivery',
  restaurant_menu: 'Restaurant & Menu',
  playland_attractions: 'Play Land & Attractions',
  customer_policies: 'Customer Policies',
  support_faqs: 'Support & FAQs',
};

export const SMART_WELCOME_SUGGESTIONS: SaathiWelcomeSuggestion[] = [
  {
    id: 'find-products',
    labelEn: 'Find Products',
    labelUr: 'Products Talash Karein',
    promptEn: 'Show me popular grocery, dairy, and household products in stock with prices.',
    promptUr: 'Mujhe stock mein mojood popular grocery aur dairy items ke prices dikhayein.',
    iconName: 'search',
  },
  {
    id: 'track-order',
    labelEn: 'Track My Order',
    labelUr: 'Order Track Karein',
    promptEn: 'I want to track my Marhaba Supermarket order status.',
    promptUr: 'Main apna Marhaba Supermarket order track karna chahta hoon.',
    iconName: 'package',
  },
  {
    id: 'restaurant-menu',
    labelEn: 'Restaurant & Menu',
    labelUr: 'Restaurant aur Menu',
    promptEn: 'What cuisines, signature dishes, and family deals are available at Marhaba Restaurant?',
    promptUr: 'Marhaba Restaurant mein kaunse cuisines, dishes aur family deals mojood hain?',
    iconName: 'utensils',
  },
  {
    id: 'playland-tickets',
    labelEn: 'Play Land & Tickets',
    labelUr: 'Play Land aur Tickets',
    promptEn: 'Tell me about Marhaba Play Land attractions, age groups, and ticket packages.',
    promptUr: 'Marhaba Play Land ke rides, age groups aur ticket packages ke bare mein batayein.',
    iconName: 'sparkles',
  },
  {
    id: 'locations-hours',
    labelEn: 'Locations & Hours',
    labelUr: 'Branches aur Timing',
    promptEn: 'What are Marhaba branch addresses, facilities, and daily opening hours?',
    promptUr: 'Marhaba branches ke addresses, facilities aur daily timing kya hain?',
    iconName: 'map-pin',
  },
  {
    id: 'customer-support',
    labelEn: 'Customer Support',
    labelUr: 'Customer Support',
    promptEn: 'How can I contact Marhaba customer support or submit a support request?',
    promptUr: 'Main Marhaba customer support se kaise rabta kar sakta hoon ya complaint log karaun?',
    iconName: 'headphones',
  },
];

export function createInitialSaathiConfig(): SaathiAdminConfig {
  const now = new Date().toISOString();
  const initialFaqs: SaathiFaqEntry[] = [
    {
      id: 'faq-free-delivery',
      question: 'When is grocery delivery free?',
      answer: `Standard delivery is Rs. ${STANDARD_DELIVERY_FEE_PKR}, and orders of Rs. ${FREE_DELIVERY_THRESHOLD_PKR.toLocaleString()} or above qualify for free standard delivery. Store Pickup is free at your selected branch.`,
      domain: 'orders_delivery',
      active: true,
      updatedAt: now,
    },
    {
      id: 'faq-playland-branch',
      question: 'Which Marhaba branch has Play Land?',
      answer:
        'Marhaba Play Land is located exclusively inside our Hyderabad Flagship complex at Fortune Arcade, Behind KFC, Qasim Chowk, Hyderabad (Daily 10:00 AM – 10:00 PM).',
      domain: 'playland_attractions',
      active: true,
      updatedAt: now,
    },
    {
      id: 'faq-restaurant-cuisines',
      question: 'Which cuisines does Marhaba Rooftop Restaurant serve?',
      answer:
        'Marhaba Rooftop Restaurant serves four main cuisines — Pakistani, Chinese, Italian, and Turkish — alongside Drinks & Desserts, with Family Hall and Rooftop Dining options.',
      domain: 'restaurant_menu',
      active: true,
      updatedAt: now,
    },
  ];

  return {
    assistantName: 'Marhaba Saathi AI',
    tagline: 'Your Friendly Shopping & Family Guide.',
    greetingEn:
      "Assalam-o-Alaikum! Welcome to Marhaba. I'm Marhaba Saathi, your AI assistant. How can I help you today?",
    greetingUr:
      'Assalam-o-Alaikum! Marhaba mein khush aamdeed. Main Marhaba Saathi hoon, aapka AI assistant. Aaj main aapki kya madad kar sakta hoon?',
    privacyNoticeEn:
      'AI responses are grounded in Marhaba records. Order tracking requires verified customer sign-in. Never share sensitive financial PINs or passwords here.',
    privacyNoticeUr:
      'AI jawab Marhaba ke verified records par mabni hain. Order track karne ke liye customer sign-in zaroori hai. Apna PIN ya password share na karein.',
    escalationHours: VERIFIED_CONTACT.workingHours,
    supportPhone: VERIFIED_CONTACT.supportPhone,
    mobileSupport: VERIFIED_CONTACT.mobileSupport,
    generalEmail: VERIFIED_CONTACT.generalEmail,
    restaurantEmail: VERIFIED_CONTACT.restaurantEmail,
    deliveryPolicySummary: `Delivery & pickup across Hyderabad and Bahria Town Karachi. Standard delivery fee Rs. ${STANDARD_DELIVERY_FEE_PKR} (Free on orders >= Rs. ${FREE_DELIVERY_THRESHOLD_PKR.toLocaleString()}). Payment: Cash on Delivery or Card at Pickup Counter.`,
    returnsPolicySummary:
      'Eligible unopened supermarket returns and exchanges are inspected at the branch Customer Care desk with order or receipt verification. Chilled/fresh items require prompt inspection.',
    safetyPolicySummary:
      'Play Land toddlers (ages 1–3) require direct adult accompaniment; clean socks are required on padded play mats; follow height limits and attendant instructions.',
    knowledgeVersion: 1,
    lastSyncedAt: now,
    faqs: initialFaqs,
  };
}

export function buildKnowledgeBase(deps: {
  erpDb: ErpDatabaseState;
  restaurantDb: RestaurantDatabaseState;
  playLandDb: PlayLandDatabaseState;
  config: SaathiAdminConfig;
}): KnowledgeDocument[] {
  const { erpDb, restaurantDb, playLandDb, config } = deps;
  const now = config.lastSyncedAt || new Date().toISOString();
  const ver = config.knowledgeVersion || 1;
  const docs: KnowledgeDocument[] = [];

  // 1. COMPANY & LOCATIONS
  docs.push({
    id: 'doc-company-branches',
    domain: 'company_locations',
    domainLabel: KNOWLEDGE_DOMAIN_LABELS.company_locations,
    title: 'Verified Marhaba Branches, Facilities & Daily Hours',
    content: VERIFIED_BRANCHES.map(
      (b) =>
        `${b.name} (${b.shortName}, City: ${b.city}${b.isFlagship ? ', Flagship' : ''}): Address: ${b.address}. Hours: ${b.hours}. Facilities: ${b.facilities.join(', ')}. Phones: ${b.phones.join(', ')}${b.restaurantPhones ? `. Restaurant Phones: ${b.restaurantPhones.join(', ')}` : ''}. Email: ${b.email}.`
    ).join('\n'),
    tags: ['branches', 'locations', 'hyderabad', 'karachi', 'hours', 'timing', 'address', 'facilities', 'playland branch'],
    dataTier: 'verified',
    version: ver,
    lastUpdated: now,
    active: true,
  });

  docs.push({
    id: 'doc-company-history',
    domain: 'company_locations',
    domainLabel: KNOWLEDGE_DOMAIN_LABELS.company_locations,
    title: 'Marhaba Heritage, Historical Origins & Leadership',
    content: [
      'IMPORTANT HISTORICAL VS CURRENT DISTINCTION:',
      ...ABOUT_MILESTONES.map((m) => `Historical Milestone ${m.year} (${m.location}): ${m.headline} — ${m.summary}`),
      `Board of Directors: ${BOARD_OF_DIRECTORS.map((d) => `${d.name} (${d.role})`).join('; ')}.`,
      `Three Trust Creeds: ${ABOUT_TRUST_CREEDS.map((c) => `${c.title}: ${c.creedStatement}`).join(' | ')}.`,
      `Corporate Workforce Overview: Reported ~${CORPORATE_WORKFORCE.reportedHeadcount} team members (${CORPORATE_WORKFORCE.statusLabel}) across Supermarket Retail, Rooftop Restaurant, Play Land Supervision, and Administration/MIS.`,
    ].join('\n'),
    tags: ['about', 'history', 'jeddah', 'national supermarket', '1998', '2015', 'uk', 'memon travels', '2018', 'r&b associates', 'directors', 'riaz ahmed memon', 'ceo', 'creed'],
    dataTier: 'verified',
    version: ver,
    lastUpdated: now,
    active: true,
  });

  // 2. SUPERMARKET PRODUCTS
  docs.push({
    id: 'doc-supermarket-departments',
    domain: 'supermarket_products',
    domainLabel: KNOWLEDGE_DOMAIN_LABELS.supermarket_products,
    title: '17 Marhaba Supermarket Departments',
    content: SHOP_DEPARTMENTS.map(
      (d) => `${d.name} (id: ${d.id}): ${d.shortDescription} Subcategories: ${d.subcategories.join(', ')}.`
    ).join('\n'),
    tags: ['departments', 'categories', 'grocery', 'dairy', 'fresh', 'beauty', 'electronics', 'baby', 'pets'],
    dataTier: 'verified',
    version: ver,
    lastUpdated: now,
    active: true,
  });

  const activeErpById = new Map(erpDb.products.map((p) => [p.id, p]));
  docs.push({
    id: 'doc-supermarket-catalog',
    domain: 'supermarket_products',
    domainLabel: KNOWLEDGE_DOMAIN_LABELS.supermarket_products,
    title: 'Current Supermarket Products & Live Prices',
    content: PRODUCTS.map((p) => {
      const live = activeErpById.get(p.id);
      const price = live ? live.sellingPrice : p.price;
      const orig = live ? live.originalPrice : p.originalPrice;
      return `${p.name} (SKU: ${p.sku}, Brand: ${p.brand}, Dept: ${p.departmentId}, Price: Rs. ${price}${orig ? `, Original: Rs. ${orig}` : ''}, Unit: ${p.unitLabel}, InStock: ${p.inStock ? 'Yes' : 'Out of Stock'}, Tier: ${p.dataTier}).`;
    }).join('\n'),
    tags: ['products', 'price', 'olpers', 'milk', 'rice', 'basmati', 'oil', 'dalda', 'tea', 'tapal', 'chicken', 'diapers', 'honey', 'detergent'],
    dataTier: 'verified',
    version: ver,
    lastUpdated: now,
    active: true,
  });

  // 3. SHOPPING & PROMOTIONS
  const activePromos = erpDb.promotions.filter((pr) => pr.status === 'Active' || pr.status === 'Scheduled');
  const discountedProducts = PRODUCTS.filter((p) => p.originalPrice && p.originalPrice > p.price);
  docs.push({
    id: 'doc-shopping-promotions',
    domain: 'shopping_promotions',
    domainLabel: KNOWLEDGE_DOMAIN_LABELS.shopping_promotions,
    title: 'Active Supermarket Promotions & Discounted Items',
    content: [
      ...activePromos.map(
        (pr) =>
          `Campaign: ${pr.title} — ${pr.discountPercent}% discount in ${pr.departmentId} (${pr.branchScope}), Status: ${pr.status}, Valid: ${pr.startDate} to ${pr.endDate}.`
      ),
      `Discounted Supermarket Products (${discountedProducts.length}): ${discountedProducts
        .map((p) => `${p.name}: Rs. ${p.price} (was Rs. ${p.originalPrice})`)
        .join('; ')}.`,
    ].join('\n'),
    tags: ['offers', 'promotions', 'discount', 'sale', 'savings', 'deals'],
    dataTier: 'demonstration',
    version: ver,
    lastUpdated: now,
    active: true,
  });

  // 4. ORDERS & DELIVERY
  docs.push({
    id: 'doc-orders-delivery',
    domain: 'orders_delivery',
    domainLabel: KNOWLEDGE_DOMAIN_LABELS.orders_delivery,
    title: 'Delivery Fees, Free Delivery Threshold, Pickup & Order Tracking Privacy',
    content: [
      config.deliveryPolicySummary,
      `Free Delivery Threshold: Rs. ${FREE_DELIVERY_THRESHOLD_PKR.toLocaleString()}. Standard Delivery Fee below threshold: Rs. ${STANDARD_DELIVERY_FEE_PKR}.`,
      'Store Pickup is always free at Hyderabad Flagship (Qasim Chowk) and Bahria Town Karachi (Precinct 10-A & Precinct 2).',
      'Order Tracking Security Rule: Customers must be signed in with a verified customer session to view or track their own orders. Never look up or reveal any order solely because an order number, phone number, or customer name was typed without verified account ownership.',
    ].join('\n'),
    tags: ['delivery', 'shipping', 'fee', 'free delivery', 'pickup', 'cod', 'order', 'track', 'tracking'],
    dataTier: 'policy',
    version: ver,
    lastUpdated: now,
    active: true,
  });

  // 5. RESTAURANT & MENU
  docs.push({
    id: 'doc-restaurant-overview',
    domain: 'restaurant_menu',
    domainLabel: KNOWLEDGE_DOMAIN_LABELS.restaurant_menu,
    title: 'Marhaba Rooftop Restaurant Cuisines, Menu & Deals',
    content: [
      'Facilities: Rooftop Restaurant available at Hyderabad Flagship (Qasim Chowk) and Karachi Precinct 10-A (Daily 10:00 AM – 10:00 PM). Seating: Family Hall & Rooftop Dining.',
      `Cuisines: ${RESTAURANT_CUISINES.map((c) => `${c.title} (${c.categories.join(', ')})`).join(' | ')}.`,
      `Signature Dishes (Demo pricing): ${RESTAURANT_DISHES.map((d) => {
        const liveItem = restaurantDb.menu.find((m) => m.name.toLowerCase() === d.name.toLowerCase() || m.id === d.id);
        const avail = liveItem ? liveItem.available : d.available;
        const livePrice = liveItem?.portions?.[0]?.pricePkr;
        return `${d.name} [${d.cuisine} · ${d.category}] — Rs. ${livePrice ?? d.price ?? 'Ask Counter'} (${d.portionSize}, Available: ${avail ? 'Yes' : 'No'})`;
      }).join('; ')}.`,
      `Restaurant Deals (Demo): ${RESTAURANT_DEALS.map((deal) => `${deal.title} — Rs. ${deal.offerPrice} (${deal.servings}, ${deal.validity}): ${deal.includedItems.join(', ')}`).join(' | ')}.`,
      'Reservations submitted online or via Marhaba Saathi are always recorded as "Pending Staff Confirmation" until confirmed by the Restaurant host/reservation desk.',
    ].join('\n'),
    tags: ['restaurant', 'menu', 'rooftop', 'dining', 'pakistani', 'chinese', 'italian', 'turkish', 'karahi', 'kebab', 'pizza', 'biryani', 'reservation', 'table', 'deals'],
    dataTier: 'demonstration',
    version: ver,
    lastUpdated: now,
    active: true,
  });

  // 6. PLAY LAND & ATTRACTIONS
  docs.push({
    id: 'doc-playland-attractions',
    domain: 'playland_attractions',
    domainLabel: KNOWLEDGE_DOMAIN_LABELS.playland_attractions,
    title: 'Marhaba Play Land Attractions, Age Suitability, Packages & Parent Guide',
    content: [
      'Location: Inside Hyderabad Flagship (Fortune Arcade, Behind KFC, Qasim Chowk, Hyderabad). Not located at Bahria Town Karachi.',
      `Attractions: ${PLAYLAND_ATTRACTIONS.map((a) => {
        const liveAttr = playLandDb.attractions.find((la) => la.id === a.id);
        const status = liveAttr ? liveAttr.status : a.availability;
        return `${a.name} (${a.category}, ${a.ageRangeLabel}, Height: ${a.heightRequirement}, Supervision: ${a.supervisionRule}, Status: ${status})`;
      }).join('; ')}.`,
      `Packages (Proposed Demo): ${PLAYLAND_PACKAGES.map((pk) => {
        const livePk = playLandDb.packages.find((lp) => lp.id === pk.id);
        return `${pk.name}: Rs. ${livePk?.pricePkr ?? pk.price} (${pk.participants}, ${pk.duration}) — Includes: ${pk.includedAttractions.join(', ')}`;
      }).join(' | ')}.`,
      `Parent Guide & Facilities: ${PARENTS_GUIDE_SECTIONS.map((s) => `${s.title}: ${s.content}`).join(' ')}`,
      'Note: Only mention verified/documented mall facilities (Parent Lounge seating overlooking floor, stroller bay at entrance desk, indoor Restaurant & Restrooms access). Never invent medical clinics or unverified rooms.',
    ].join('\n'),
    tags: ['playland', 'play land', 'kids', 'toddler', 'children', 'rides', 'soft play', 'climbing', 'arcade', 'packages', 'tickets', 'birthday', 'socks', 'parent lounge'],
    dataTier: 'demonstration',
    version: ver,
    lastUpdated: now,
    active: true,
  });

  // 7. CUSTOMER POLICIES
  docs.push({
    id: 'doc-customer-policies',
    domain: 'customer_policies',
    domainLabel: KNOWLEDGE_DOMAIN_LABELS.customer_policies,
    title: 'Returns, Refunds, Privacy & Safety Policies',
    content: [
      `Returns & Exchanges: ${config.returnsPolicySummary}`,
      `Play Land Safety & Supervision: ${config.safetyPolicySummary}`,
      'Privacy Policy: Customer account details, personal phone numbers, and order history are private and strictly limited to the verified account owner. Do not expose internal staff systems, cost prices, margins, or management credentials.',
    ].join('\n'),
    tags: ['return', 'refund', 'exchange', 'policy', 'privacy', 'safety', 'socks', 'supervision'],
    dataTier: 'policy',
    version: ver,
    lastUpdated: now,
    active: true,
  });

  // 8. SUPPORT & FAQS
  docs.push({
    id: 'doc-support-faqs',
    domain: 'support_faqs',
    domainLabel: KNOWLEDGE_DOMAIN_LABELS.support_faqs,
    title: 'Verified Support Channels, Escalation & Frequently Asked Questions',
    content: [
      `Support Hours: ${config.escalationHours}.`,
      `Supermarket Support Phone: ${config.supportPhone} | Mobile Support: ${config.mobileSupport}.`,
      `General & Support Email: ${config.generalEmail}.`,
      `Restaurant Reservations & Dining Email: ${config.restaurantEmail} | Restaurant Phones: ${VERIFIED_CONTACT.restaurantPhones.join(', ')}.`,
      ...config.faqs
        .filter((f) => f.active)
        .map((f) => `FAQ [${f.domain}]: Q: ${f.question} A: ${f.answer}`),
    ].join('\n'),
    tags: ['support', 'help', 'contact', 'phone', 'email', 'complaint', 'escalate', 'human', 'faq'],
    dataTier: 'verified',
    version: ver,
    lastUpdated: now,
    active: true,
  });

  // Also include each custom FAQ as an individual searchable doc if added after initial
  for (const faq of config.faqs) {
    if (!faq.active) continue;
    docs.push({
      id: `doc-faq-${faq.id}`,
      domain: faq.domain,
      domainLabel: KNOWLEDGE_DOMAIN_LABELS[faq.domain],
      title: faq.question,
      content: `Q: ${faq.question}\nA: ${faq.answer}`,
      tags: faq.question.toLowerCase().split(/\W+/).filter((w) => w.length > 2),
      dataTier: 'policy',
      version: ver,
      lastUpdated: faq.updatedAt,
      active: true,
    });
  }

  return docs;
}

export function summarizeKnowledgeDomains(docs: KnowledgeDocument[]): KnowledgeDomainSummary[] {
  const order: KnowledgeDomainId[] = [
    'company_locations',
    'supermarket_products',
    'shopping_promotions',
    'orders_delivery',
    'restaurant_menu',
    'playland_attractions',
    'customer_policies',
    'support_faqs',
  ];
  return order.map((domain) => {
    const matching = docs.filter((d) => d.domain === domain && d.active);
    const maxVer = matching.reduce((m, d) => Math.max(m, d.version), 1);
    const latest = matching.reduce(
      (acc, d) => (d.lastUpdated > acc ? d.lastUpdated : acc),
      matching[0]?.lastUpdated || ''
    );
    return {
      domain,
      label: KNOWLEDGE_DOMAIN_LABELS[domain],
      docCount: matching.length,
      version: maxVer,
      lastUpdated: latest,
    };
  });
}

export function sanitizeUntrustedText(raw: string, maxLen = 1200): string {
  const stripped = String(raw || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/<\/?(system|instruction|developer|assistant|tool_call|function_call)[^>]*>/gi, '')
    .trim();
  return stripped.slice(0, maxLen);
}

export function searchKnowledgeDomains(
  docs: KnowledgeDocument[],
  query: string,
  topK = 5
): KnowledgeDocument[] {
  const clean = sanitizeUntrustedText(query, 400).toLowerCase();
  const tokens = Array.from(new Set(clean.split(/[^a-z0-9]+/).filter((t) => t.length >= 2)));

  if (tokens.length === 0) {
    return docs.filter((d) => d.active).slice(0, topK);
  }

  const scored = docs
    .filter((d) => d.active)
    .map((doc) => {
      const titleLower = doc.title.toLowerCase();
      const contentLower = doc.content.toLowerCase();
      const tagSet = doc.tags.map((t) => t.toLowerCase());
      let score = 0;

      for (const tok of tokens) {
        if (tagSet.some((t) => t === tok || t.includes(tok))) score += 4;
        if (titleLower.includes(tok)) score += 3;
        if (contentLower.includes(tok)) score += 1.5;
      }

      // Boost specific domain keywords in English or Roman Urdu
      if (
        (clean.includes('play') || clean.includes('bach') || clean.includes('kids') || clean.includes('ride') || clean.includes('birthday') || clean.includes('toddler')) &&
        doc.domain === 'playland_attractions'
      ) {
        score += 5;
      }
      if (
        (clean.includes('menu') || clean.includes('khana') || clean.includes('dinner') || clean.includes('lunch') || clean.includes('karahi') || clean.includes('pizza') || clean.includes('kebab') || clean.includes('table') || clean.includes('reserv')) &&
        doc.domain === 'restaurant_menu'
      ) {
        score += 5;
      }
      if (
        (clean.includes('deliver') || clean.includes('order') || clean.includes('track') || clean.includes('shipping') || clean.includes('pickup')) &&
        doc.domain === 'orders_delivery'
      ) {
        score += 5;
      }
      if (
        (clean.includes('branch') || clean.includes('address') || clean.includes('time') || clean.includes('timing') || clean.includes('history') || clean.includes('founder') || clean.includes('jeddah') || clean.includes('location')) &&
        doc.domain === 'company_locations'
      ) {
        score += 5;
      }
      if (
        (clean.includes('offer') || clean.includes('discount') || clean.includes('sale') || clean.includes('promo') || clean.includes('sasta')) &&
        doc.domain === 'shopping_promotions'
      ) {
        score += 5;
      }
      if (
        (clean.includes('return') || clean.includes('refund') || clean.includes('policy') || clean.includes('privacy')) &&
        doc.domain === 'customer_policies'
      ) {
        score += 5;
      }
      if (
        (clean.includes('support') || clean.includes('help') || clean.includes('contact') || clean.includes('phone') || clean.includes('complaint') || clean.includes('madad')) &&
        doc.domain === 'support_faqs'
      ) {
        score += 5;
      }

      return { doc, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score);

  if (scored.length === 0) {
    return docs.filter((d) => d.domain === 'support_faqs' || d.domain === 'company_locations').slice(0, topK);
  }

  return scored.slice(0, topK).map((s) => s.doc);
}
