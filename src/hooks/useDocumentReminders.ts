import { useState, useEffect, useCallback } from 'react';
import {
  listObligations, completeObligation, deleteObligation,
  type Obligation,
} from '../lib/obligationsApi';
import { daysUntilDue } from '../lib/obligationScheduling';

/**
 * The reminders set on one document.
 *
 * Called once in DocumentViewer and shared by the header chip and the overdue banner —
 * they sit in different parts of the page, so one hook feeding both avoids a portal and
 * keeps this to a single request.
 */
export function useDocumentReminders(documentId: string) {
  const [reminders, setReminders] = useState<Obligation[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const reload = useCallback(async () => {
    try {
      const res = await listObligations({ documentId, status: ['active'], limit: 100 });
      // Sorted soonest-first here rather than trusting the API's ordering: the chip's
      // entire colour and label come from reminders[0], so the wrong first element would
      // show a calm slate pill while something is overdue.
      const today = new Date();
      setReminders(
        [...res.items].sort((a, b) => {
          const da = daysUntilDue(a.due_date, today);
          const db = daysUntilDue(b.due_date, today);
          if (da === null) return 1;
          if (db === null) return -1;
          return da - db;
        }),
      );
    } catch {
      // Non-critical: the chip simply does not appear.
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => { void reload(); }, [reload]);

  const run = useCallback(async (id: string, action: () => Promise<unknown>) => {
    setBusyId(id);
    try {
      await action();
      await reload();
    } finally {
      setBusyId(null);
    }
  }, [reload]);

  return {
    reminders,
    loading,
    busyId,
    reload,
    complete: (id: string) => run(id, () => completeObligation(id)),
    remove: (id: string) => run(id, () => deleteObligation(id)),
  };
}
