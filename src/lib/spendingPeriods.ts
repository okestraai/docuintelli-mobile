/**
 * The periods the Spending Breakdown can be filtered to.
 *
 * One list, not two controls. A year picker beside a period picker would offer combinations that
 * contradict each other ("2026" and "last 3 months" at once) and mostly empty ones. Every entry
 * here resolves to exactly one date range.
 *
 * Kept apart from the component so the picker and the fetch agree on what a period means, and so
 * the same rules can be stated once rather than inferred from JSX.
 */

export interface SpendingPeriod {
  id: string;
  label: string;
  /** Which half of the picker this belongs to: a rolling window, or one calendar year. */
  group: 'rolling' | 'year';
  start: string;
  end: string;
}

/** Local calendar date as YYYY-MM-DD. Not toISOString(), which shifts the day across UTC. */
function toYmd(d: Date): string {
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
}

/** `monthsBack` before `from`, clamped so 31 Mar minus one month is 28 Feb rather than 3 Mar. */
function monthsBefore(from: Date, monthsBack: number): Date {
  const d = new Date(from.getFullYear(), from.getMonth() - monthsBack, 1);
  const lastDayOfThatMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  d.setDate(Math.min(from.getDate(), lastDayOfThatMonth));
  return d;
}

/** The window the section shows before anyone touches the picker — the summary's own. */
export const DEFAULT_PERIOD_ID = 'last-12';

/**
 * Builds the picker's options.
 *
 * Years come from the months that actually have data, so the list never offers a year that would
 * come back empty. `monthKeys` are the `month` values of `summary.monthly_averages` (YYYY-MM).
 */
export function buildSpendingPeriods(monthKeys: string[], now: Date = new Date()): SpendingPeriod[] {
  const today = toYmd(now);

  const rolling: SpendingPeriod[] = [
    {
      id: 'this-month',
      label: 'This month',
      group: 'rolling',
      start: toYmd(new Date(now.getFullYear(), now.getMonth(), 1)),
      end: today,
    },
    {
      id: 'last-3',
      label: 'Last 3 months',
      group: 'rolling',
      start: toYmd(monthsBefore(now, 3)),
      end: today,
    },
    {
      // The default reproduces the unfiltered section exactly: the summary queries this same
      // rolling year, so picking it must not change a single figure.
      id: DEFAULT_PERIOD_ID,
      label: 'Last 12 months',
      group: 'rolling',
      start: toYmd(monthsBefore(now, 12)),
      end: today,
    },
  ];

  const years = Array.from(new Set(monthKeys.map(m => m.slice(0, 4))))
    .filter(y => /^\d{4}$/.test(y))
    .sort()
    .reverse()
    .map<SpendingPeriod>(year => ({
      id: `year-${year}`,
      label: year,
      group: 'year',
      start: `${year}-01-01`,
      end: `${year}-12-31`,
    }));

  return [...rolling, ...years];
}

export function findPeriod(periods: SpendingPeriod[], id: string): SpendingPeriod {
  return periods.find(p => p.id === id) || periods[0];
}
