/**
 * The periods offered by the Spending Breakdown filter.
 *
 * Date arithmetic that only misbehaves on certain days of certain months is the kind that ships:
 * a naive setMonth(-1) on 31 March lands on 3 March, and nobody notices until March. The cases
 * below are the ones that would go unseen in ordinary use.
 */
import { describe, it, expect } from 'vitest';
import { buildSpendingPeriods, findPeriod, DEFAULT_PERIOD_ID } from './spendingPeriods';

// Local time, matching the module: `new Date(y, m, d)` rather than a UTC string.
const on = (y: number, m: number, d: number) => new Date(y, m - 1, d);

const idsOf = (now: Date, months: string[] = []) =>
  buildSpendingPeriods(months, now).map(p => p.id);

describe('buildSpendingPeriods', () => {
  it('defaults to the summary\'s own window, so the untouched section is unchanged', () => {
    const periods = buildSpendingPeriods(['2026-07'], on(2026, 8, 30));
    expect(findPeriod(periods, DEFAULT_PERIOD_ID).label).toBe('Last 12 months');
  });

  it('offers a year for each year that has data, newest first', () => {
    const years = buildSpendingPeriods(
      ['2024-11', '2025-01', '2025-06', '2026-08'], on(2026, 8, 30),
    ).filter(p => p.group === 'year');

    expect(years.map(p => p.label)).toEqual(['2026', '2025', '2024']);
  });

  it('offers no year that would come back empty', () => {
    // Today only 2026 has data. A "2025" entry would be a control that can only disappoint.
    expect(idsOf(on(2026, 8, 30), ['2026-01', '2026-08']))
      .toEqual(['this-month', 'last-3', 'last-12', 'year-2026']);
  });

  it('covers a whole calendar year when a year is picked', () => {
    const [year] = buildSpendingPeriods(['2025-03'], on(2026, 8, 30)).filter(p => p.group === 'year');
    expect(year.start).toBe('2025-01-01');
    expect(year.end).toBe('2025-12-31');
  });

  it('starts "this month" on the first, not thirty days ago', () => {
    const [thisMonth] = buildSpendingPeriods([], on(2026, 8, 30));
    expect(thisMonth.start).toBe('2026-08-01');
    expect(thisMonth.end).toBe('2026-08-30');
  });

  it('does not overflow into the wrong month on a 31st', () => {
    // The bug this guards: 31 March minus one month is 28 February, not 3 March.
    const periods = buildSpendingPeriods([], on(2026, 3, 31));
    expect(findPeriod(periods, 'last-3').start).toBe('2025-12-31');

    const may31 = buildSpendingPeriods([], on(2026, 5, 31));
    expect(findPeriod(may31, 'last-3').start).toBe('2026-02-28'); // February has no 31st
  });

  it('handles a leap day', () => {
    const periods = buildSpendingPeriods([], on(2024, 2, 29));
    expect(findPeriod(periods, 'last-12').start).toBe('2023-02-28');
  });

  it('uses the local calendar date, not UTC', () => {
    // toISOString() on a late-evening local date reports tomorrow west of Greenwich and would
    // silently shift every boundary by a day.
    const lateEvening = new Date(2026, 7, 30, 23, 30);
    expect(buildSpendingPeriods([], lateEvening)[0].end).toBe('2026-08-30');
  });

  it('gives every period a well-formed range that does not run backwards', () => {
    for (const p of buildSpendingPeriods(['2025-04', '2026-08'], on(2026, 8, 30))) {
      expect(p.start).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.end).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(p.start <= p.end).toBe(true);
    }
  });

  it('ignores month keys that are not months', () => {
    const periods = buildSpendingPeriods(['', 'not-a-month'], on(2026, 8, 30));
    expect(periods.filter(p => p.group === 'year')).toEqual([]);
  });
});

describe('findPeriod', () => {
  it('falls back to the first period rather than returning nothing', () => {
    // A stale id must not leave the section with no range to fetch.
    const periods = buildSpendingPeriods(['2026-08'], on(2026, 8, 30));
    expect(findPeriod(periods, 'year-1999')).toBe(periods[0]);
  });
});
