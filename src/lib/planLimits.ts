// Mirrors the web src/lib/planLimits.ts (4-tier plans). Prices are boss-confirmed:
// Starter $9/$90, Pro $19/$182, Family $34/$326. Note: the app displays the STORE
// price (RevenueCat priceString) at runtime — these values are fallback/reference only.

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

export const PLAN_LIMITS = {
  free: { documents: 5, monthlyUploads: 5, devices: 1, name: 'Free' },
  starter: { documents: 30, monthlyUploads: 9, devices: 2, name: 'Starter' },
  pro: { documents: 50, monthlyUploads: 15, devices: 5, name: 'Pro' },
  family: { documents: 150, monthlyUploads: 45, devices: 5, name: 'Family' },
} as const;

export type PlanId = keyof typeof PLAN_LIMITS;

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
      { text: '1 device', included: true },
      { text: 'File upload only', included: true },
      { text: 'Standard LLM queue', included: true },
      { text: 'In-app expiration reminders', included: true },
      { text: 'URL ingestion', included: false },
      { text: 'OCR for images', included: false },
      { text: 'Auto tag generation', included: false },
      { text: 'E-Signatures', included: false },
      { text: 'Life Events', included: false },
      { text: 'Emergency Access', included: false },
      { text: 'Financial Insights', included: false },
      { text: 'Email notifications', included: false },
    ],
    cta: 'Current Plan',
    popular: false,
  },
  {
    id: 'starter',
    name: 'Starter',
    price: { monthly: 9, yearly: 90 },
    description: 'For students & renters',
    features: [
      { text: '30 documents', included: true },
      { text: '9 uploads per month', included: true },
      { text: '600K AI tokens per month', included: true },
      { text: '2 devices', included: true },
      { text: 'File + URL ingestion', included: true },
      { text: 'OCR for images', included: true },
      { text: 'Auto tags', included: true },
      { text: 'E-Signatures (5/mo, 3 signers)', included: true },
      { text: 'Life Events (3 active, 3 recomputes/mo)', included: true },
      { text: 'Weekly Audit', included: true },
      { text: 'Email + push notifications', included: true },
      { text: 'Emergency Access', included: false },
      { text: 'Global Search', included: false },
      { text: 'Financial Insights', included: false },
      { text: 'Action Agent', included: false },
      { text: 'Priority support', included: false },
    ],
    cta: 'Upgrade to Starter',
    popular: false,
  },
  {
    id: 'pro',
    name: 'Pro',
    price: { monthly: 19, yearly: 182 },
    description: 'For homeowners & power users',
    features: [
      { text: '50 documents', included: true },
      { text: '15 uploads per month', included: true },
      { text: '3M AI tokens per month', included: true },
      { text: 'Up to 5 devices', included: true },
      { text: 'File + URL ingestion', included: true },
      { text: 'Priority LLM queue', included: true },
      { text: 'OCR for images', included: true },
      { text: 'Advanced tags & relationship mapping', included: true },
      { text: 'E-Signatures (20/mo, 10 signers)', included: true },
      { text: 'Life Events (10 active + AI matching)', included: true },
      { text: 'Weekly Audit', included: true },
      { text: 'Email + push notifications', included: true },
      { text: 'Emergency Access (Trusted Contacts)', included: true },
      { text: 'Document Health panel', included: true },
      { text: 'Global Search across documents', included: true },
      { text: 'Cloud import (Drive / Dropbox / OneDrive)', included: true },
      { text: 'Financial Insights + StockPulse', included: true },
      { text: 'Action Agent (AI research)', included: true },
      { text: 'Priority support', included: true },
    ],
    cta: 'Upgrade to Pro',
    popular: true,
  },
  {
    id: 'family',
    name: 'Family',
    price: { monthly: 34, yearly: 326 },
    description: 'For households — up to 5 members',
    features: [
      { text: '150 documents', included: true },
      { text: '45 uploads per month', included: true },
      { text: '6M AI tokens per month', included: true },
      { text: 'Up to 5 members', included: true },
      { text: 'File + URL ingestion', included: true },
      { text: 'Priority LLM queue', included: true },
      { text: 'OCR for images', included: true },
      { text: 'Advanced tags & relationship mapping', included: true },
      { text: 'E-Signatures (50/mo, 10 signers)', included: true },
      { text: 'Life Events (unlimited + AI matching)', included: true },
      { text: 'Weekly Audit', included: true },
      { text: 'Email + push notifications', included: true },
      { text: 'Emergency Access (household hub)', included: true },
      { text: 'Document Health panel', included: true },
      { text: 'Global Search across documents', included: true },
      { text: 'Cloud import (Drive / Dropbox / OneDrive)', included: true },
      { text: 'Financial Insights + StockPulse', included: true },
      { text: 'Action Agent (AI research)', included: true },
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
