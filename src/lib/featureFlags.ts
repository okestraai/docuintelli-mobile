import type { FeatureFlags, PlanId, Subscription } from '../types/subscription';

/**
 * Feature-flag resolution for the mobile app.
 *
 * The backend returns `subscription.feature_flags` and enforces every flag
 * server-side (source of truth). The mobile app gates UI on these flags so the
 * UX matches — users aren't shown features they can't use, or hit silent 403s.
 *
 * GOLDEN RULE: gate on `feature_flags.<flag>`, never on `plan === 'pro'` — a
 * plan check silently excludes the Family tier.
 *
 * `deriveFeatureFlags()` provides a per-plan fallback used only when the API
 * response is missing `feature_flags` (older responses / a transient poll),
 * so features degrade gracefully instead of vanishing.
 */

const PAID_PLANS: ReadonlySet<PlanId> = new Set(['starter', 'pro', 'family']);
const PRO_FAMILY: ReadonlySet<PlanId> = new Set(['pro', 'family']);

export function isPaidPlan(plan: PlanId | undefined | null): boolean {
  return !!plan && PAID_PLANS.has(plan);
}

/** Pro/Family — the tier that unlocks Document Health (no dedicated flag). */
export function isProOrFamily(plan: PlanId | undefined | null): boolean {
  return !!plan && PRO_FAMILY.has(plan);
}

/**
 * Fallback feature-flag map derived from the plan. Mirrors the backend tier
 * truth table so the app behaves correctly even if `feature_flags` is absent.
 */
export function deriveFeatureFlags(plan: PlanId): FeatureFlags {
  const starterPlus = PAID_PLANS.has(plan);
  const proPlus = PRO_FAMILY.has(plan);
  return {
    url_ingestion: starterPlus,
    ocr_enabled: starterPlus,
    auto_tags: starterPlus,
    background_embedding: true, // universal — powers AI chat/RAG for all tiers
    priority_queue: plan === 'free' ? 0 : plan === 'starter' ? 1 : 2,
    email_notifications: starterPlus,
    multi_device_sync: proPlus,
    priority_support: proPlus,
    global_search: proPlus,
    esignatures: starterPlus,
    financial_insights: proPlus,
    life_events: starterPlus,
    emergency_access: proPlus,
    life_event_ai_matching: proPlus,
    action_agent: proPlus,
    cloud_import: proPlus,
    stockpulse: proPlus,
  };
}

/**
 * Resolve the effective feature flags for a subscription. Backend-provided
 * flags win; any missing key is filled from the plan-derived fallback.
 */
export function getFeatureFlags(subscription: Subscription | null): FeatureFlags {
  const plan: PlanId = subscription?.plan ?? 'free';
  const fallback = deriveFeatureFlags(plan);
  if (!subscription?.feature_flags) return fallback;
  return { ...fallback, ...subscription.feature_flags };
}
