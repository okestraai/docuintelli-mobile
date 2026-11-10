// Direct copy from web — 100% reusable

export interface PlanFeature {
  text: string;
  included: boolean;
}

export interface PlanData {
  id: PlanId;
  name: string;
  price: { monthly: number; yearly: number };
  description: string;
  features: PlanFeature[];
  cta: string;
  popular: boolean;
}

// NOTE: These figures are a fallback only — always prefer the live values on
// the subscription object (document_limit, monthly_upload_limit, …). Kept in
// sync with the backend tier table for the downgrade-compliance helpers below.
export const PLAN_LIMITS: Record<'free' | 'starter' | 'pro' | 'family', { documents: number; monthlyUploads: number; devices: number; aiTokens: number; name: string }> = {
  free: { documents: 5, monthlyUploads: 5, devices: 1, aiTokens: 50000, name: 'Free' },
  starter: { documents: 30, monthlyUploads: 9, devices: 1, aiTokens: 600000, name: 'Starter' },
  pro: { documents: 50, monthlyUploads: 15, devices: 3, aiTokens: 3000000, name: 'Pro' },
  family: { documents: 150, monthlyUploads: 45, devices: 5, aiTokens: 6000000, name: 'Family' },
};

export type PlanId = keyof typeof PLAN_LIMITS;

export type LivePlanLimits = Record<PlanId, { documents: number; monthlyUploads: number; devices: number; aiTokens: number }>;

/** Takes the numbers an admin has set. */
export function applyPlanLimits(limits: LivePlanLimits): void {
  for (const id of Object.keys(PLAN_LIMITS) as PlanId[]) {
    if (limits[id]) Object.assign(PLAN_LIMITS[id], limits[id]);
  }
}

// Counts this high mean no cap; tokens need a higher line because paid plans reach millions.
export const UNLIMITED_COUNT = 99_999;
export const UNLIMITED_TOKENS = 1_000_000_000;

export function isUnlimitedCount(limit: number | null | undefined): boolean {
  return (limit ?? 0) >= UNLIMITED_COUNT;
}

export function isUnlimitedTokens(limit: number | null | undefined): boolean {
  return (limit ?? 0) >= UNLIMITED_TOKENS;
}

export function tokensText(tokens: number): string {
  if (tokens >= 1_000_000) return `${+(tokens / 1_000_000).toFixed(1)}M`;
  return `${Math.round(tokens / 1000)}K`;
}

// Small amounts stay exact, so a low balance doesn't read as 0K.
export function tokensLeftText(tokens: number): string {
  return tokens < 1000 ? String(tokens) : tokensText(tokens);
}

export function devicesText(devices: number): string {
  return devices === 1 ? '1 device' : `Up to ${devices} devices`;
}

export const PLANS: PlanData[] = [
  {
    id: 'free',
    name: 'Free',
    price: { monthly: 0, yearly: 0 },
    description: 'For trial users',
    features: [
      { text: '5 documents', included: true },
      { text: '5 uploads per month', included: true },
      { text: '50K AI tokens per month', included: true },
      { text: 'File upload only', included: true },
      { text: '1 device', included: true },
      { text: 'Standard LLM queue (lowest priority)', included: true },
      { text: 'E-Signatures', included: false },
      { text: 'Financial Insights', included: false },
      { text: 'Life Events planner', included: false },
      { text: 'Emergency Access (Trusted Contacts)', included: false },
      { text: 'URL ingestion', included: false },
      { text: 'Background embedding refresh', included: false },
      { text: 'Auto tag generation', included: false },
      { text: 'OCR for images', included: false },
      { text: 'Email notifications', included: false },
    ],
    cta: 'Current Plan',
    popular: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: { monthly: 9, yearly: 86 },
    description: 'For individuals',
    features: [
      { text: '30 documents', included: true },
      { text: '9 uploads per month', included: true },
      { text: '600K AI tokens per month', included: true },
      { text: 'File + URL ingestion', included: true },
      { text: 'OCR for images', included: true },
      { text: 'Weekly Audit', included: true },
      { text: '1 device', included: true },
      { text: 'Email notifications', included: true },
      { text: 'E-Signatures (5 requests/mo, 3 signers)', included: true },
      { text: 'Life Events (3 active, 3 recomputes/mo)', included: true },
      { text: 'Standard LLM queue (medium priority)', included: true },
      { text: 'Background embedding generation', included: true },
      { text: 'Auto tags enabled', included: true },
      { text: 'Financial Insights & Goals', included: false },
      { text: 'Emergency Access (Trusted Contacts)', included: false },
      { text: 'AI document matching for Life Events', included: false },
      { text: 'Global Search across documents', included: false },
      { text: 'Priority support', included: false },
    ],
    cta: 'Upgrade to Starter',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: { monthly: 19, yearly: 182 },
    description: 'For power users & families',
    features: [
      { text: '50 documents', included: true },
      { text: '15 uploads per month', included: true },
      { text: '3M AI tokens per month', included: true },
      { text: 'File + URL ingestion', included: true },
      { text: 'All Starter features', included: true },
      { text: 'E-Signatures (50 requests/mo, 10 signers)', included: true },
      { text: 'Financial Insights & Goals', included: true },
      { text: 'Life Events (unlimited + AI matching)', included: true },
      { text: 'Emergency Access (Trusted Contacts)', included: true },
      { text: 'Document Health panel', included: true },
      { text: 'Global Search across documents', included: true },
      { text: 'Priority LLM queue', included: true },
      { text: 'Faster embedding generation', included: true },
      { text: 'Advanced tagging & relationship mapping', included: true },
      { text: 'AI summaries + key data extraction', included: true },
      { text: 'Up to 3 devices', included: true },
      { text: 'Priority support', included: true },
    ],
    cta: 'Upgrade to Pro',
    popular: true,
  },
  {
    id: 'family',
    name: 'Family',
    price: { monthly: 34, yearly: 326 },
    description: 'For households & power users',
    features: [
      { text: '150 documents', included: true },
      { text: '45 uploads per month', included: true },
      { text: '6M AI tokens per month', included: true },
      { text: 'Everything in Pro', included: true },
      { text: 'Financial Insights & StockPulse', included: true },
      { text: 'Emergency Access (Trusted Contacts)', included: true },
      { text: 'Life Events (unlimited + AI matching)', included: true },
      { text: 'Action Agent (Coming soon)', included: false },
      { text: 'Up to 5 devices', included: true },
      { text: 'Priority support', included: true },
    ],
    cta: 'Upgrade to Family',
    popular: false,
  },
];

export function getPlanById(id: PlanId): PlanData {
  return PLANS.find((p) => p.id === id)!;
}

export function getDocumentOverage(currentCount: number, targetPlan: PlanId): number {
  return Math.max(0, currentCount - PLAN_LIMITS[targetPlan].documents);
}

export function requiresCompliance(currentCount: number, targetPlan: PlanId): boolean {
  return getDocumentOverage(currentCount, targetPlan) > 0;
}

// The smallest saving across plans, worked out from the prices shown, so the badge never overstates it.
export function yearlySavingLabel(
  prices: ({ monthly?: number | null; yearly?: number | null } | null | undefined)[],
): string | null {
  const paid = prices.filter((price) => price?.monthly !== 0);
  if (paid.length === 0 || paid.some((price) => !price?.monthly || !price?.yearly)) return null;
  // Rounded down, so 19.9% is never shown as 20%.
  const smallest = Math.min(...paid.map((price) => Math.floor((1 - price!.yearly! / (price!.monthly! * 12)) * 100)));
  return smallest >= 1 ? `Save ${smallest}%` : null;
}
