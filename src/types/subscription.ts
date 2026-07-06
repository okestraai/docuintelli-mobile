export type PlanId = 'free' | 'starter' | 'pro' | 'family';

/**
 * Per-tier feature flags returned on the subscription object by
 * `GET /api/subscription/current`. The backend is the source of truth and
 * enforces every flag server-side — the mobile app gates UI on these booleans
 * (never on `plan === 'pro'`, which silently excludes the Family tier).
 *
 * All values are booleans except `priority_queue`, which is a numeric tier.
 */
export interface FeatureFlags {
  url_ingestion: boolean;
  ocr_enabled: boolean;
  auto_tags: boolean;
  background_embedding: boolean;
  priority_queue: number;
  email_notifications: boolean;
  multi_device_sync: boolean;
  priority_support: boolean;
  global_search: boolean;
  esignatures: boolean;
  financial_insights: boolean;
  life_events: boolean;
  emergency_access: boolean;
  life_event_ai_matching: boolean;
  action_agent: boolean;
  cloud_import: boolean;
  stockpulse: boolean;
}

export interface Subscription {
  id: string;
  user_id: string;
  plan: PlanId;
  status: 'active' | 'canceling' | 'canceled' | 'expired' | 'trialing';
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  document_limit: number;
  ai_questions_limit: number;
  ai_questions_used: number;
  ai_questions_reset_date: string;
  tokens_used: number;
  tokens_limit: number;
  tokens_reset_date: string | null;
  monthly_upload_limit: number;
  monthly_uploads_used: number;
  monthly_upload_reset_date: string;
  bank_account_limit: number;
  // Per-tier limits — read live, never hardcode. Optional so older API
  // responses (before these were returned) don't break typing.
  esign_monthly_limit?: number;
  esign_max_signers?: number;
  life_event_active_limit?: number;
  agent_monthly_limit?: number;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  pending_plan: string | null;
  documents_to_keep: string[] | null;
  // Feature flags — gate all UI on these. Optional because a subscription may
  // momentarily arrive without them; consumers use `getFeatureFlags()` which
  // falls back to a plan-derived map.
  feature_flags?: FeatureFlags;
}
