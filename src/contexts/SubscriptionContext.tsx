import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { auth } from '../lib/auth';
import { API_BASE } from '../lib/config';
import { syncFromRevenueCat } from '../lib/subscriptionApi';
import { onCustomerInfoUpdated, isNativeIAP } from '../lib/iapService';
import { useAuthStore } from '../store/authStore';
import type { Subscription } from '../types/subscription';

interface SubscriptionState {
  subscription: Subscription | null;
  loading: boolean;
  error: string | null;
  canUploadDocument: boolean;
  canAskQuestion: boolean;
  isPro: boolean;
  isStarterOrAbove: boolean;
  documentCount: number;
  bankAccountLimit: number;
  refreshSubscription: () => Promise<void>;
  incrementAIQuestions: () => Promise<void>;
  incrementMonthlyUploads: () => Promise<void>;
}

const defaultState: SubscriptionState = {
  subscription: null,
  loading: true,
  error: null,
  canUploadDocument: true,
  canAskQuestion: true,
  isPro: false,
  isStarterOrAbove: false,
  documentCount: 0,
  bankAccountLimit: 0,
  refreshSubscription: async () => {},
  incrementAIQuestions: async () => {},
  incrementMonthlyUploads: async () => {},
};

const SubscriptionContext = createContext<SubscriptionState>(defaultState);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const { session } = useAuthStore();
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [documentCount, setDocumentCount] = useState(0);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchSubscription = useCallback(async () => {
    try {
      const { data: { session: currentSession } } = await auth.getSession();
      if (!currentSession) {
        // Not authenticated — reset to defaults, no error
        setSubscription(null);
        setLoading(false);
        return;
      }

      const res = await fetch(`${API_BASE}/api/subscription/current`, {
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({ error: 'Failed to fetch subscription' }));
        throw new Error(errData.error || 'Failed to fetch subscription');
      }

      const data = await res.json();
      setSubscription(data.subscription);
      setDocumentCount(data.documentCount || 0);
      setError(null);
    } catch (err) {
      console.error('Error fetching subscription:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch subscription');
      // Keep existing subscription data on error — don't reset to null
      // This prevents flashing gates when a single poll fails
    } finally {
      setLoading(false);
    }
  }, []);

  const incrementAIQuestions = useCallback(async () => {
    if (!subscription) return;
    setSubscription({ ...subscription, ai_questions_used: subscription.ai_questions_used + 1 });
    try {
      const { data: { session: currentSession } } = await auth.getSession();
      if (!currentSession) return;
      await fetch(`${API_BASE}/api/subscription/increment-questions`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });
    } catch (err) {
      console.error('Error incrementing AI questions:', err);
    }
  }, [subscription]);

  const incrementMonthlyUploads = useCallback(async () => {
    if (!subscription) return;
    setSubscription({ ...subscription, monthly_uploads_used: subscription.monthly_uploads_used + 1 });
    try {
      const { data: { session: currentSession } } = await auth.getSession();
      if (!currentSession) return;
      await fetch(`${API_BASE}/api/subscription/increment-uploads`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${currentSession.access_token}` },
      });
    } catch (err) {
      console.error('Error incrementing monthly uploads:', err);
    }
  }, [subscription]);

  // Fetch subscription when session changes (login/logout) and poll while authenticated
  useEffect(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }

    if (session) {
      setLoading(true);
      fetchSubscription();
      pollIntervalRef.current = setInterval(fetchSubscription, 60_000);
    } else {
      // Logged out — clear subscription
      setSubscription(null);
      setDocumentCount(0);
      setError(null);
      setLoading(false);
    }

    return () => {
      if (pollIntervalRef.current) {
        clearInterval(pollIntervalRef.current);
      }
    };
  }, [session, fetchSubscription]);

  // Listen for real-time RevenueCat subscription changes (native only)
  useEffect(() => {
    if (!isNativeIAP || !session) return;

    const unsubscribe = onCustomerInfoUpdated(async () => {
      await syncFromRevenueCat().catch(() => {});
      await fetchSubscription();
    });

    return unsubscribe;
  }, [session, fetchSubscription]);

  const plan = subscription?.plan;
  const isPro = plan === 'pro';
  const isStarterOrAbove = plan === 'starter' || plan === 'pro';

  const withinStorageLimit = loading ? true : subscription ? documentCount < subscription.document_limit : true;
  const withinMonthlyQuota = loading ? true : subscription ? subscription.monthly_uploads_used < subscription.monthly_upload_limit : true;
  const canUploadDocument = withinStorageLimit && withinMonthlyQuota;
  const canAskQuestion = loading
    ? true
    : subscription
    ? (subscription.tokens_used ?? 0) < (subscription.tokens_limit ?? 50000)
    : true;
  const bankAccountLimit = subscription?.bank_account_limit ?? 0;

  return (
    <SubscriptionContext.Provider
      value={{
        subscription,
        loading,
        error,
        canUploadDocument,
        canAskQuestion,
        isPro,
        isStarterOrAbove,
        documentCount,
        bankAccountLimit,
        refreshSubscription: fetchSubscription,
        incrementAIQuestions,
        incrementMonthlyUploads,
      }}
    >
      {children}
    </SubscriptionContext.Provider>
  );
}

export function useSubscriptionContext(): SubscriptionState {
  return useContext(SubscriptionContext);
}
