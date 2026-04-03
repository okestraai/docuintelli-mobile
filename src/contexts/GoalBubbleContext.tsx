import React, { useEffect, useRef } from 'react';
import { usePathname } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useGoalBubbleStore, type AppStateInputs } from '../store/goalBubbleStore';
import { AUTO_DETECT_STEPS } from '../content/goalDefinitions';
import { useSubscription } from '../hooks/useSubscription';
import GoalBubbleCard from '../components/ui/GoalBubbleCard';

export function GoalBubbleProvider({ children }: { children: React.ReactNode }) {
  const session = useAuthStore((s) => s.session);
  const pathname = usePathname();
  const { subscription, documentCount } = useSubscription();

  const initialize = useGoalBubbleStore((s) => s.initialize);
  const selectNextGoal = useGoalBubbleStore((s) => s.selectNextGoal);
  const completeStepById = useGoalBubbleStore((s) => s.completeStepById);
  const ready = useGoalBubbleStore((s) => s.ready);
  const setViewState = useGoalBubbleStore((s) => s.setViewState);

  const initTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitialized = useRef(false);

  // Build app state inputs
  const docCount = documentCount || 0;
  const currentPlan = subscription?.plan || null;

  const appState: AppStateInputs = {
    documentCount: docCount,
    hasViewedDocument: pathname.includes('/document/'),
    currentPlan,
    currentPage: pathname,
    globalSearchOpen: pathname === '/search',
  };

  // 1.5s delay after auth → initialize + select first goal
  useEffect(() => {
    if (session && !hasInitialized.current) {
      initTimerRef.current = setTimeout(async () => {
        await initialize();
        hasInitialized.current = true;
      }, 1500);
    } else if (!session) {
      hasInitialized.current = false;
      setViewState('hidden');
      if (initTimerRef.current) clearTimeout(initTimerRef.current);
    }
    return () => {
      if (initTimerRef.current) clearTimeout(initTimerRef.current);
    };
  }, [session]); // eslint-disable-line react-hooks/exhaustive-deps

  // Re-evaluate goal selection whenever app state changes
  useEffect(() => {
    if (ready && session) {
      selectNextGoal(appState);
    }
  }, [ready, docCount, currentPlan, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-detect step completions from app state
  useEffect(() => {
    if (!ready) return;
    const ctx = { documentCount: docCount, currentPage: pathname };
    for (const [stepId, check] of Object.entries(AUTO_DETECT_STEPS)) {
      if (check(ctx)) {
        completeStepById(stepId);
      }
    }
  }, [ready, docCount, pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      {children}
      <GoalBubbleCard />
    </>
  );
}
