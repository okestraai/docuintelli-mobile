/**
 * The reporting period for Financial Insights.
 *
 * One period governs Money In, Spending Breakdown and Recurring Bills together. Before this they
 * each answered a different window — spending a rolling year, bills a rolling year, money in a
 * single calendar month — and the page never said so, leaving a month's income sitting beside a
 * year's spending with nothing to mark the difference.
 *
 * Balances and net worth are deliberately NOT governed by it: they are point-in-time facts, not
 * period measures, and there is no stored history to report them over.
 */

export interface Period {
  id: string;
  label: string;
  /** Which group the picker lists this under. */
  group: 'period' | 'year' | 'custom';
  start: string;
  end: string;
}

/** Local calendar date as YYYY-MM-DD. Not toISOString(), which shifts the day across UTC. */
export function toYmd(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** Last day of the month `d` falls in. */
const endOfMonth = (d: Date): Date => new Date(d.getFullYear(), d.getMonth() + 1, 0);

/**
 * The last month that has actually finished.
 *
 * Periods are built from whole months because a partial one understates everything measured over
 * it — income looks low, spending looks low — and reporting the part as though it were the whole
 * is the specific way these figures mislead.
 */
function lastCompleteMonth(now: Date): Date {
  return new Date(now.getFullYear(), now.getMonth() - 1, 1);
}

/** `count` whole months ending with the last complete one. */
function completeMonths(now: Date, count: number): { start: string; end: string } {
  const last = lastCompleteMonth(now);
  const first = new Date(last.getFullYear(), last.getMonth() - (count - 1), 1);
  return { start: toYmd(first), end: toYmd(endOfMonth(last)) };
}

export const DEFAULT_PERIOD_ID = 'last-12-complete';

/**
 * A rhythm cannot be seen inside a window too short to hold two of its cycles: a monthly bill
 * charged once in a one-month window has nothing to recur against. Below this the bill list is
 * not wrong so much as unanswerable, and says so rather than quietly emptying.
 */
export const MIN_DAYS_FOR_MONTHLY_RHYTHM = 62;

export function daysInPeriod(period: { start: string; end: string }): number {
  const ms = new Date(`${period.end}T00:00:00`).getTime() - new Date(`${period.start}T00:00:00`).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/** Whether this window is too short for a monthly bill to show a rhythm. */
export const tooShortForRhythm = (period: { start: string; end: string }): boolean =>
  daysInPeriod(period) < MIN_DAYS_FOR_MONTHLY_RHYTHM;

/**
 * The periods offered by the picker.
 *
 * `monthKeys` are the `month` values of `summary.monthly_averages` (YYYY-MM), so the year entries
 * only ever name years that hold data.
 */
export function buildPeriods(monthKeys: string[], now: Date = new Date()): Period[] {
  const monthName = (d: Date) => d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const last = lastCompleteMonth(now);

  const periods: Period[] = [
    { id: DEFAULT_PERIOD_ID, label: 'Last 12 complete months', group: 'period', ...completeMonths(now, 12) },
    { id: 'last-6-complete', label: 'Last 6 complete months', group: 'period', ...completeMonths(now, 6) },
    { id: 'last-3-complete', label: 'Last 3 complete months', group: 'period', ...completeMonths(now, 3) },
    { id: 'last-complete-month', label: monthName(last), group: 'period', ...completeMonths(now, 1) },
    {
      // Named for what it is. The current month is short by definition, and every figure measured
      // over it is a part reported as a whole until the month ends.
      id: 'this-month-so-far',
      label: 'This month so far',
      group: 'period',
      start: toYmd(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: toYmd(now),
    },
  ];

  const years = Array.from(new Set(monthKeys.map(m => m.slice(0, 4))))
    .filter(y => /^\d{4}$/.test(y))
    .sort()
    .reverse()
    .map<Period>(year => ({
      id: `year-${year}`,
      label: year,
      group: 'year',
      start: `${year}-01-01`,
      end: `${year}-12-31`,
    }));

  return [...periods, ...years];
}

export function findPeriod(periods: Period[], id: string): Period {
  return periods.find(p => p.id === id) || periods[0];
}

/** A hand-picked start and end, described the way the preset labels are. */
export function customPeriod(start: string, end: string): Period {
  const pretty = (iso: string) =>
    new Date(`${iso}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  return { id: 'custom', label: `${pretty(start)} – ${pretty(end)}`, group: 'custom', start, end };
}

export const isCompleteDate = (v: string): boolean => /^\d{4}-\d{2}-\d{2}$/.test(v);
