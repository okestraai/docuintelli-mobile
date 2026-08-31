/**
 * Pure helpers for the Obligations tab. Ported verbatim from the web app
 * (`src/lib/obligationScheduling.ts` in the DocuIntelli-azure repo) — keep the two
 * identical, and port the test file alongside any change.
 *
 * These mirror rules the server enforces in `server/src/services/obligationRules.ts`.
 * The server copy is authoritative — it rejects anything that gets past this one. This
 * copy exists so the modal can disable a bad Save before a round trip, and so the panel
 * can group and label without asking the API.
 */

/** Lead times offered as chips. 0 means "on the day it is due". */
export const PRE_NOTICE_PRESETS = [30, 14, 7, 3, 1, 0] as const;

export const MAX_PRE_NOTICE_ENTRIES = 6;
export const MAX_PRE_NOTICE_DAYS = 365;

export type ObligationUrgency = 'overdue' | 'today' | 'soon' | 'upcoming' | 'undated';

export interface SchedulableObligation {
  due_date: string | null;
}

/** Whole days from `from` to `to`, ignoring time of day. */
export function daysBetween(from: Date, to: Date): number {
  const a = Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate());
  const b = Date.UTC(to.getUTCFullYear(), to.getUTCMonth(), to.getUTCDate());
  return Math.round((b - a) / 86_400_000);
}

/**
 * Days until a YYYY-MM-DD due date. Negative when overdue, null when unparseable.
 *
 * Parsed as UTC on purpose: reading "2026-09-06" through the local timezone puts it at
 * the previous evening west of Greenwich, which shifts every countdown by a day.
 */
export function daysUntilDue(dueDate: string | null, today: Date): number | null {
  if (!dueDate || !/^\d{4}-\d{2}-\d{2}$/.test(dueDate)) return null;
  const due = new Date(`${dueDate}T00:00:00Z`);
  if (Number.isNaN(due.getTime())) return null;
  return daysBetween(today, due);
}

/** Bucket an obligation for display. "Soon" is the coming week. */
export function obligationUrgency(dueDate: string | null, today: Date): ObligationUrgency {
  const days = daysUntilDue(dueDate, today);
  if (days === null) return 'undated';
  if (days < 0) return 'overdue';
  if (days === 0) return 'today';
  if (days <= 7) return 'soon';
  return 'upcoming';
}

/**
 * Validate and normalize a pre-notice selection — deduped and sorted descending, so the
 * ladder reads the way people think about it (30 → 7 → 1).
 */
export function normalizePreNotice(input: number[]): { ok: boolean; days: number[]; error?: string } {
  if (!Array.isArray(input) || input.length === 0) {
    return { ok: false, days: [], error: 'Pick at least one reminder time' };
  }

  const days: number[] = [];
  for (const value of input) {
    if (typeof value !== 'number' || !Number.isInteger(value)) {
      return { ok: false, days: [], error: 'Reminder times must be whole days' };
    }
    if (value < 0 || value > MAX_PRE_NOTICE_DAYS) {
      return { ok: false, days: [], error: `Reminder times must be between 0 and ${MAX_PRE_NOTICE_DAYS} days before` };
    }
    if (!days.includes(value)) days.push(value);
  }

  if (days.length > MAX_PRE_NOTICE_ENTRIES) {
    return { ok: false, days: [], error: `Pick at most ${MAX_PRE_NOTICE_ENTRIES} reminder times` };
  }

  return { ok: true, days: days.sort((a, b) => b - a) };
}

/**
 * Validate a due date from the date input.
 *
 * A past date is allowed — people log things they have already missed — but it is
 * reported so the modal can warn that some reminders will not fire.
 */
export function validateDueDate(
  input: string,
  today: Date,
): { ok: true; value: string; isPast: boolean } | { ok: false; error: string } {
  if (!input) return { ok: false, error: 'Pick a due date' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input)) return { ok: false, error: 'Use the date picker to choose a date' };

  const [year, month, day] = input.split('-').map(Number);
  const due = new Date(Date.UTC(year, month - 1, day));
  if (due.getUTCFullYear() !== year || due.getUTCMonth() !== month - 1 || due.getUTCDate() !== day) {
    return { ok: false, error: 'That date does not exist' };
  }
  if (year > today.getUTCFullYear() + 20) {
    return { ok: false, error: 'That due date is too far in the future' };
  }

  return { ok: true, value: input, isPast: daysBetween(today, due) < 0 };
}

/** "30, 7 and 1 day before, and on the day" */
export function describePreNotice(days: number[]): string {
  if (!days.length) return 'No reminders';

  const sorted = [...new Set(days)].sort((a, b) => b - a);
  const onTheDay = sorted.includes(0);
  const leads = sorted.filter(d => d > 0);

  const parts: string[] = [];
  if (leads.length) {
    const unit = leads[leads.length - 1] === 1 && leads.length === 1 ? 'day' : 'days';
    const list =
      leads.length === 1
        ? `${leads[0]}`
        : `${leads.slice(0, -1).join(', ')} and ${leads[leads.length - 1]}`;
    parts.push(`${list} ${unit} before`);
  }
  if (onTheDay) parts.push('on the day');

  return parts.join(', and ');
}

/**
 * The lead times that make sense for a kind of obligation. Used to pre-select chips so
 * the common case is one click, not five.
 */
export function suggestedPreNoticeFor(obligationType: string): number[] {
  switch (obligationType) {
    case 'cancellation':
      return [30, 14, 7];
    case 'payment':
      return [7, 3, 0];
    case 'renewal':
      return [30, 7];
    case 'filing':
    case 'submission':
      return [14, 3];
    default:
      return [7, 1];
  }
}

export interface ObligationGroup<T> {
  key: ObligationUrgency;
  label: string;
  items: T[];
}

const GROUP_ORDER: { key: ObligationUrgency; label: string }[] = [
  { key: 'overdue', label: 'Overdue' },
  { key: 'today', label: 'Due today' },
  { key: 'soon', label: 'This week' },
  { key: 'upcoming', label: 'Upcoming' },
  { key: 'undated', label: 'No date set' },
];

/** Split obligations into display sections, dropping any section that is empty. */
export function groupObligations<T extends SchedulableObligation>(items: T[], today: Date): ObligationGroup<T>[] {
  return GROUP_ORDER.map(({ key, label }) => ({
    key,
    label,
    items: items.filter(item => obligationUrgency(item.due_date, today) === key),
  })).filter(group => group.items.length > 0);
}

/** Short countdown label for a row badge. */
export function dueLabel(dueDate: string | null, today: Date): string {
  const days = daysUntilDue(dueDate, today);
  if (days === null) return 'No date';
  if (days === 0) return 'Today';
  if (days === 1) return 'Tomorrow';
  if (days < 0) return `${Math.abs(days)}d overdue`;
  return `${days} days`;
}
