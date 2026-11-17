export type SaathiLanguage = 'en' | 'ur-roman';

export type KnowledgeDomainId =
  | 'company_locations'
  | 'supermarket_products'
  | 'shopping_promotions'
  | 'orders_delivery'
  | 'restaurant_menu'
  | 'playland_attractions'
  | 'customer_policies'
  | 'support_faqs';

export interface KnowledgeDocument {
  id: string;
  domain: KnowledgeDomainId;
  domainLabel: string;
  title: string;
  content: string;
  tags: string[];
  dataTier: 'verified' | 'demonstration' | 'policy';
  version: number;
  lastUpdated: string;
  active: boolean;
}

export interface KnowledgeDomainSummary {
  domain: KnowledgeDomainId;
  label: string;
  docCount: number;
  version: number;
  lastUpdated: string;
}

export interface SaathiWelcomeSuggestion {
  id: string;
  labelEn: string;
  labelUr: string;
  promptEn: string;
  promptUr: string;
  iconName: 'search' | 'package' | 'utensils' | 'sparkles' | 'map-pin' | 'headphones';
}

export interface SaathiFaqEntry {
  id: string;
  question: string;
  answer: string;
  domain: KnowledgeDomainId;
  active: boolean;
  updatedAt: string;
}

export interface SaathiAdminConfig {
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
  deliveryPolicySummary: string;
  returnsPolicySummary: string;
  safetyPolicySummary: string;
  knowledgeVersion: number;
  lastSyncedAt: string;
  faqs: SaathiFaqEntry[];
}

export interface SaathiProductCardData {
  productId: string;
  variantId: string;
  sku: string;
  name: string;
  brand: string;
  departmentName: string;
  unitLabel: string;
  price: number;
  originalPrice?: number;
  discountPercent: number;
  inStock: boolean;
  sellableCount?: number;
  stockNote: string;
  requiresVariantChoice?: boolean;
  variants: { id: string; label: string; price: number; originalPrice?: number; inStock: boolean }[];
}

export interface SaathiDishCardData {
  id: string;
  name: string;
  cuisine: string;
  category: string;
  description: string;
  portionSize: string;
  price?: number;
  available: boolean;
  dietaryTags?: string[];
}

export interface SaathiAttractionCardData {
  id: string;
  name: string;
  category: string;
  ageGroup: string;
  ageRangeLabel: string;
  heightRequirement: string;
  supervisionRule: string;
  availability: string;
  safetyGuidelines: string[];
}

export interface SaathiPackageCardData {
  id: string;
  name: string;
  price: number;
  participants: string;
  duration: string;
  includedAttractions: string[];
  terms: string;
  isBirthday?: boolean;
}

export interface SaathiLocationCardData {
  id: string;
  name: string;
  shortName: string;
  city: string;
  address: string;
  hours: string;
  phones: string[];
  restaurantPhones?: string[];
  email: string;
  facilities: string[];
  isFlagship?: boolean;
}

export interface SaathiOrderCardData {
  orderNumber: string;
  stage: string;
  branchId: string;
  fulfillmentMethod: string;
  paymentMethod: string;
  paymentStatus: string;
  totalAmount: number;
  createdAt: string;
  itemCount: number;
  itemsSummary: string;
}

export interface SaathiOfferCardData {
  id: string;
  title: string;
  source: 'supermarket' | 'restaurant' | 'playland';
  discountLabel: string;
  summary: string;
  validity: string;
}

export type SaathiCard =
  | { type: 'product'; data: SaathiProductCardData }
  | { type: 'dish'; data: SaathiDishCardData }
  | { type: 'attraction'; data: SaathiAttractionCardData }
  | { type: 'package'; data: SaathiPackageCardData }
  | { type: 'location'; data: SaathiLocationCardData }
  | { type: 'order'; data: SaathiOrderCardData }
  | { type: 'offer'; data: SaathiOfferCardData }
  | {
      type: 'delivery';
      data: {
        branchName: string;
        standardFee: number;
        freeThreshold: number;
        amountRemainingForFree?: number;
        pickupAvailable: boolean;
        coverageNote: string;
      };
    }
  | {
      type: 'inquiry_confirmation';
      data: {
        kind: 'restaurant_reservation' | 'playland_visit' | 'support_ticket';
        referenceId: string;
        statusLabel: string;
        summary: string;
        branchName: string;
      };
    }
  | {
      type: 'auth_required';
      data: {
        reason: string;
        instructions: string;
      };
    };

export interface SaathiCartAction {
  type: 'ADD_TO_CART';
  productId: string;
  variantId: string;
  quantity: number;
  productName: string;
}

export interface SaathiPageContext {
  route: string;
  branchId: string;
  selectedProductId?: string | null;
  restaurantSection?: string;
  playLandSection?: string;
  cartItemCount?: number;
  cartSubtotal?: number;
  cartItems?: {
    productId: string;
    variantId: string;
    name: string;
    variantLabel: string;
    unitPrice: number;
    quantity: number;
  }[];
}

export interface SaathiChatHistoryItem {
  role: 'user' | 'assistant';
  text: string;
}

export interface SaathiChatRequest {
  message: string;
  language?: SaathiLanguage;
  history?: SaathiChatHistoryItem[];
  pageContext?: SaathiPageContext;
  conversationId?: string;
}

export interface SaathiChatResponse {
  reply: string;
  language: SaathiLanguage;
  cards: SaathiCard[];
  quickReplies: string[];
  cartActions: SaathiCartAction[];
  toolsUsed: string[];
  escalationSuggested?: boolean;
}

export interface SaathiUnresolvedEntry {
  id: string;
  query: string;
  language: SaathiLanguage;
  branchId: string;
  route: string;
  reason: string;
  createdAt: string;
  status: 'Open' | 'Resolved' | 'Converted to FAQ';
  resolutionNote?: string;
}

export interface SaathiQualityMetrics {
  totalQueries: number;
  successfulResponses: number;
  toolAssistedResponses: number;
  escalatedCount: number;
  unresolvedCount: number;
  helpfulVotes: number;
  notHelpfulVotes: number;
  avgLatencyMs: number;
  lastErrorCode?: string;
  lastErrorAt?: string;
}

export interface CustomerSessionProfile {
  customerId: string;
  fullName: string;
  email: string;
  phone: string;
  branchId: string;
}
