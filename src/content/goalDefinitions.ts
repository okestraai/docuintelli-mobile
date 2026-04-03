/**
 * Goal Bubble System — 7 goals across 2 phases.
 * Matches the web spec: floating checklist, auto-detection, sequential goals.
 */

export interface GoalStep {
  id: string;
  label: string;
  navigateTo?: string;
  hint?: string;
}

export type GoalTrigger =
  | { type: 'first-login' }
  | { type: 'after-goal'; goalId: string }
  | { type: 'doc-count'; min: number }
  | { type: 'plan'; plans: string[] }
  | { type: 'manual' };

export type GoalIcon = 'upload' | 'search' | 'signature' | 'heart' | 'wallet' | 'calendar' | 'eye';

export interface GoalDefinition {
  id: string;
  title: string;
  description: string;
  icon: GoalIcon;
  steps: GoalStep[];
  trigger: GoalTrigger;
  phase: 1 | 2;
}

export const GOALS: GoalDefinition[] = [
  // ━━━ Phase 1 — Getting Started ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  {
    id: 'get-started',
    title: 'Set Up Your Vault',
    description: 'Upload your first document and organize it for smart tracking.',
    icon: 'upload',
    trigger: { type: 'first-login' },
    phase: 1,
    steps: [
      { id: 'upload-doc', label: 'Upload your first document', navigateTo: '/(tabs)/vault', hint: 'Tap "+" in your vault to add a document' },
      { id: 'set-category', label: 'Set a category', hint: 'Choose Insurance, Warranty, Lease, etc.' },
      { id: 'set-expiration', label: 'Add an expiration date', hint: 'So we can remind you before it expires' },
    ],
  },
  {
    id: 'explore-vault',
    title: 'Explore Your Vault',
    description: 'View a document, chat with AI, and check its health.',
    icon: 'eye',
    trigger: { type: 'after-goal', goalId: 'get-started' },
    phase: 1,
    steps: [
      { id: 'view-doc', label: 'Open a document', navigateTo: '/(tabs)/vault', hint: 'Tap any document card' },
      { id: 'chat-ai', label: 'Chat with AI about it', hint: 'Tap "Chat with Document" button' },
      { id: 'check-health', label: 'Check document health', hint: 'Scroll to the Health panel' },
    ],
  },
  {
    id: 'master-search',
    title: 'Find Anything Fast',
    description: 'Use search and AI to find answers across your documents.',
    icon: 'search',
    trigger: { type: 'after-goal', goalId: 'explore-vault' },
    phase: 1,
    steps: [
      { id: 'vault-search', label: 'Search in your vault', navigateTo: '/(tabs)/vault', hint: 'Use the search bar at the top' },
      { id: 'global-search', label: 'Try the global AI search', navigateTo: '/search', hint: 'Tap the Search quick action' },
    ],
  },

  // ━━━ Phase 2 — Power Features ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

  {
    id: 'first-signature',
    title: 'Send Your First Signature',
    description: 'Get a document signed electronically in minutes.',
    icon: 'signature',
    trigger: { type: 'plan', plans: ['starter', 'pro'] },
    phase: 2,
    steps: [
      { id: 'open-doc', label: 'Open a document', navigateTo: '/(tabs)/vault', hint: 'Tap any PDF or Word doc' },
      { id: 'click-signature', label: 'Tap "Get Signature"', hint: 'Signature icon in the document header' },
      { id: 'add-signer', label: 'Add a signer', hint: 'Enter their name and email' },
      { id: 'place-fields', label: 'Place signature fields', hint: 'Select a field type and tap on the document' },
      { id: 'send-request', label: 'Send the request', hint: 'Review and hit Send' },
    ],
  },
  {
    id: 'vault-health',
    title: 'Perfect Your Vault Health',
    description: 'Complete metadata and set review schedules to stay organized.',
    icon: 'heart',
    trigger: { type: 'doc-count', min: 3 },
    phase: 2,
    steps: [
      { id: 'view-health-tab', label: 'View the Health tab', navigateTo: '/(tabs)/vault', hint: 'Tap the "Health" tab in your vault' },
      { id: 'complete-metadata', label: 'Complete metadata for a document', hint: 'Fill in issuer, expiration, policy number' },
      { id: 'set-cadence', label: 'Set a review schedule', hint: 'Choose how often to review each document' },
      { id: 'reach-75', label: 'Reach 75+ preparedness score', hint: 'Resolve flagged items in the audit' },
    ],
  },
  {
    id: 'financial-setup',
    title: 'Connect Your Finances',
    description: 'Link your bank to track spending, bills, and financial goals.',
    icon: 'wallet',
    trigger: { type: 'plan', plans: ['starter', 'pro'] },
    phase: 2,
    steps: [
      { id: 'visit-financial', label: 'Go to Financial Insights', navigateTo: '/financial-insights', hint: 'Tap "Financial" in the nav' },
      { id: 'connect-bank', label: 'Connect a bank account', hint: 'Tap "Connect Account" and follow the steps' },
      { id: 'view-spending', label: 'View your spending breakdown', hint: 'Check the spending by category chart' },
    ],
  },
  {
    id: 'life-event',
    title: 'Prepare for a Life Event',
    description: 'Use templates to get your documents ready for what\'s next.',
    icon: 'calendar',
    trigger: { type: 'doc-count', min: 5 },
    phase: 2,
    steps: [
      { id: 'browse-templates', label: 'Browse life event templates', navigateTo: '/life-events', hint: 'Tap "Life Events" in the nav' },
      { id: 'start-event', label: 'Start a life event', hint: 'Choose a template and answer the questions' },
      { id: 'match-doc', label: 'Match a document to a requirement', hint: 'Tap "Search" on a requirement to link a document' },
    ],
  },
];

/** Step IDs that auto-complete from app state (no manual call needed) */
export const AUTO_DETECT_STEPS: Record<string, (ctx: { documentCount: number; currentPage: string }) => boolean> = {
  'upload-doc': (ctx) => ctx.documentCount > 0,
  'set-category': (ctx) => ctx.documentCount > 0,
  'view-doc': (ctx) => ctx.currentPage.includes('/document/'),
  'open-doc': (ctx) => ctx.currentPage.includes('/document/'),
  'global-search': (ctx) => ctx.currentPage === '/search',
  'visit-financial': (ctx) => ctx.currentPage.includes('/financial-insights'),
  'browse-templates': (ctx) => ctx.currentPage.includes('/life-events'),
  'view-health-tab': (ctx) => ctx.currentPage.includes('/vault') && ctx.currentPage.includes('health'),
};
