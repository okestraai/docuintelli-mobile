import { useSubscriptionContext } from '../contexts/SubscriptionContext';

/**
 * Returns the shared subscription state from SubscriptionProvider.
 * All consumers share the same data — no duplicate API calls.
 */
export function useSubscription() {
  return useSubscriptionContext();
}
