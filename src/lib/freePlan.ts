import { useEffect, useState } from 'react';
import { API_BASE } from './config';
import { getSubscriptionStorage, type SubscriptionStorage } from './api';

/** What the Free plan is right now, from admin settings. Today's plan is the fallback. */
export interface FreePlanFacts {
  storageBased: boolean;
  storageLimitMB: number;
  aiQuestions: number;
  esignPerMonth: number;
  esignSigners: number;
}

const TODAY: FreePlanFacts = {
  storageBased: false,
  storageLimitMB: 10,
  aiQuestions: 10,
  esignPerMonth: 0,
  esignSigners: 0,
};

// Facts expire, so a change an admin makes reaches an app that stays open.
const FACTS_MAX_AGE_MS = 5 * 60 * 1000;
let loading: Promise<FreePlanFacts> | null = null;
let loadedAt = 0;

async function fetchFreePlan(): Promise<FreePlanFacts | null> {
  try {
    const res = await fetch(`${API_BASE}/api/plans/free`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export function useFreePlan(): FreePlanFacts {
  const [facts, setFacts] = useState(TODAY);
  useEffect(() => {
    let active = true;
    if (!loading || Date.now() - loadedAt > FACTS_MAX_AGE_MS) {
      loadedAt = Date.now();
      loading = fetchFreePlan().then((next) => {
        // A failure isn't kept, so the next screen tries again.
        if (!next) loading = null;
        return next ?? TODAY;
      });
    }
    loading.then((next) => {
      if (active) setFacts(next);
    });
    return () => {
      active = false;
    };
  }, []);
  return facts;
}

/** The server sends a very high document limit on the storage-based plan, for old app versions. */
export function isStorageBased(subscription: { plan?: string; document_limit?: number } | null | undefined): boolean {
  return subscription?.plan === 'free' && (subscription.document_limit ?? 0) >= 99_999;
}

export function formatStorage(bytes: number): string {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function useStorage(enabled: boolean, refreshKey?: unknown) {
  const [storage, setStorage] = useState<SubscriptionStorage | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setFailed(false);
    getSubscriptionStorage()
      .then((next) => {
        if (active) setStorage(next);
      })
      .catch(() => {
        if (active) setFailed(true);
      });
    return () => {
      active = false;
    };
  }, [enabled, refreshKey, attempt]);
  return { storage, failed, retry: () => setAttempt((n) => n + 1) };
}

/** The Free plan's card on the billing screen. Other plans stay as they are. */
export function freePlanFeatures(features: string[], facts: FreePlanFacts): string[] {
  if (!facts.storageBased) return features;
  const signers = `${facts.esignSigners} signer${facts.esignSigners === 1 ? '' : 's'}`;
  const added = facts.esignPerMonth > 0 ? [`E-Signatures (${facts.esignPerMonth}/mo, ${signers})`, 'Weekly Audit'] : ['Weekly Audit'];
  return [
    ...features
      .filter((feature) => !/uploads\/month$/.test(feature))
      .map((feature) => (/^\d+ documents$/.test(feature) ? `${facts.storageLimitMB} MB of storage` : feature)),
    ...added,
  ];
}

function storageAnswers(facts: FreePlanFacts): Record<string, string> {
  const mb = `${facts.storageLimitMB} MB`;
  return {
    'What counts toward my upload limit?': `On the Free plan, your limit is ${mb} of storage, which counts your files and the search data that lets you chat with them. On paid plans, each successful upload counts toward your monthly quota. Failed uploads do not count. URL and text imports also count as uploads.`,
    'What happens if I downgrade?': `Downgrades take effect at the end of your current billing period. Moving to the Free plan keeps all your documents. If they're over your ${mb} of storage, they stay available, and you can't upload more until you delete some or upgrade. Between paid plans, if you exceed the new plan's document limit, you'll need to select which documents to keep.`,
  };
}

/** Swaps the answers that describe document counts. Questions not listed stay as they are. */
export function withFreePlanAnswers<T extends { questions: { question: string; answer: string }[] }>(topics: T[], facts: FreePlanFacts): T[] {
  if (!facts.storageBased) return topics;
  const answers = storageAnswers(facts);
  return topics.map((topic) => ({
    ...topic,
    questions: topic.questions.map((q) => (answers[q.question] ? { ...q, answer: answers[q.question] } : q)),
  }));
}
