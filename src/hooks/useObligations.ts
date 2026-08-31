import { useState, useEffect, useCallback, useRef } from 'react';
import {
  listObligations,
  getObligationSummary,
  acceptObligation,
  dismissObligation,
  completeObligation,
  deleteObligation,
  type Obligation,
  type ObligationSummary,
} from '../lib/obligationsApi';

const PAGE_SIZE = 25;

/**
 * Loads the two halves of the Obligations tab: action items awaiting a decision, and
 * live reminders. Ported from the web hook of the same name — kept in step with it.
 *
 * Unlike the web version this does not poll on a timer; the Vault screen refetches on
 * focus (`useFocusEffect`), which is the mobile idiom and avoids burning battery on a
 * background interval.
 */
export function useObligations(enabled = true) {
  const [suggestions, setSuggestions] = useState<Obligation[]>([]);
  const [reminders, setReminders] = useState<Obligation[]>([]);
  const [summary, setSummary] = useState<ObligationSummary | null>(null);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [hasMoreReminders, setHasMoreReminders] = useState(false);

  const remindersOffset = useRef(0);

  const refresh = useCallback(async () => {
    if (!enabled) return;
    try {
      setError(null);
      const [suggested, active, nextSummary] = await Promise.all([
        listObligations({ status: ['suggested'], limit: PAGE_SIZE }),
        listObligations({ status: ['active'], limit: PAGE_SIZE }),
        getObligationSummary(),
      ]);
      setSuggestions(suggested.items);
      setReminders(active.items);
      setHasMoreReminders(active.meta.hasMore);
      remindersOffset.current = active.items.length;
      setSummary(nextSummary);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load obligations');
    } finally {
      setLoading(false);
    }
  }, [enabled]);

  useEffect(() => { void refresh(); }, [refresh]);

  const loadMoreReminders = useCallback(async () => {
    try {
      const page = await listObligations({
        status: ['active'],
        limit: PAGE_SIZE,
        offset: remindersOffset.current,
      });
      setReminders(prev => [...prev, ...page.items]);
      remindersOffset.current += page.items.length;
      setHasMoreReminders(page.meta.hasMore);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load more reminders');
    }
  }, []);

  /**
   * Run a mutation and re-sync. Errors are re-thrown so the modal can keep the user's
   * input on screen and show the message inline instead of silently closing.
   */
  const runAction = useCallback(async (id: string, action: () => Promise<unknown>) => {
    setActionLoading(id);
    try {
      await action();
      await refresh();
    } finally {
      setActionLoading(null);
    }
  }, [refresh]);

  return {
    suggestions,
    reminders,
    summary,
    loading,
    error,
    actionLoading,
    hasMoreReminders,
    loadMoreReminders,
    refresh,
    accept: (id: string, dueDate: string, preNoticeDays: number[]) =>
      runAction(id, () => acceptObligation(id, dueDate, preNoticeDays)),
    dismiss: (id: string) => runAction(id, () => dismissObligation(id)),
    complete: (id: string) => runAction(id, () => completeObligation(id)),
    remove: (id: string) => runAction(id, () => deleteObligation(id)),
  };
}
