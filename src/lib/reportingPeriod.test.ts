/**
 * The reporting period shared by Money In, Spending Breakdown and Recurring Bills.
 *
 * Two properties matter more than the arithmetic. Periods must be whole months, because a partial
 * one understates every figure measured over it. And a window too short to hold two cycles cannot
 * evidence a rhythm — the bill list must be able to say so instead of appearing to have lost data.
 */
import { describe, it, expect } from 'vitest';
import {
  buildPeriods,
  findPeriod,
  customPeriod,
  daysInPeriod,
  tooShortForRhythm,
  DEFAULT_PERIOD_ID,
} from './reportingPeriod';

// Local time, matching the module: `new Date(y, m, d)` rather than a UTC string.
const on = (y: number, m: number, d: number) => new Date(y, m - 1, d);

describe('buildPeriods', () => {
  it('defaults to the last twelve complete months, excluding the month in progress', () => {
    const periods = buildPeriods([], on(2026, 8, 31));
    const def = findPeriod(periods, DEFAULT_PERIOD_ID);

    expect(def.start).toBe('2025-08-01');
    expect(def.end).toBe('2026-07-31'); // not the 31st of August: August is not over
  });

  it('ends every preset on a month boundary', () => {
    // The reason the whole model is built from complete months: a part reported as a whole is
    // exactly how income and spending come to look lower than they are.
    for (const p of buildPeriods([], on(2026, 8, 14)).filter(p => p.group === 'period')) {
      if (p.id === 'this-month-so-far') continue; // named for being partial
      expect(p.start.slice(8)).toBe('01');
      const end = new Date(`${p.end}T00:00:00`);
      const dayAfter = new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1);
      expect(dayAfter.getDate()).toBe(1);
    }
  });

  it('names the single-month preset after the month it covers', () => {
    const periods = buildPeriods([], on(2026, 8, 31));
    const single = findPeriod(periods, 'last-complete-month');

    expect(single.label).toBe('July 2026');
    expect(single.start).toBe('2026-07-01');
    expect(single.end).toBe('2026-07-31');
  });

  it('says plainly when a period is still running', () => {
    const soFar = findPeriod(buildPeriods([], on(2026, 8, 14)), 'this-month-so-far');

    expect(soFar.label).toBe('This month so far');
    expect(soFar.start).toBe('2026-08-01');
    expect(soFar.end).toBe('2026-08-14');
  });

  it('crosses a year boundary without landing in the wrong year', () => {
    const periods = buildPeriods([], on(2026, 1, 15));

    expect(findPeriod(periods, 'last-complete-month').start).toBe('2025-12-01');
    expect(findPeriod(periods, DEFAULT_PERIOD_ID).start).toBe('2025-01-01');
    expect(findPeriod(periods, DEFAULT_PERIOD_ID).end).toBe('2025-12-31');
  });

  it('ends February on the 28th, and on the 29th in a leap year', () => {
    expect(findPeriod(buildPeriods([], on(2026, 3, 10)), 'last-complete-month').end).toBe('2026-02-28');
    expect(findPeriod(buildPeriods([], on(2024, 3, 10)), 'last-complete-month').end).toBe('2024-02-29');
  });

  it('offers a year only for years that have data, newest first', () => {
    const years = buildPeriods(['2024-11', '2025-01', '2026-08'], on(2026, 8, 31))
      .filter(p => p.group === 'year');

    expect(years.map(p => p.label)).toEqual(['2026', '2025', '2024']);
    expect(years[0].start).toBe('2026-01-01');
    expect(years[0].end).toBe('2026-12-31');
  });

  it('ignores month keys that are not months', () => {
    expect(buildPeriods(['', 'nonsense'], on(2026, 8, 31)).filter(p => p.group === 'year')).toEqual([]);
  });

  it('uses the local calendar date, not UTC', () => {
    // toISOString() on a late local evening reports tomorrow west of Greenwich, which would shift
    // every boundary by a day.
    const lateEvening = new Date(2026, 7, 30, 23, 30);
    expect(findPeriod(buildPeriods([], lateEvening), 'this-month-so-far').end).toBe('2026-08-30');
  });

  it('gives every period a range that does not run backwards', () => {
    for (const p of buildPeriods(['2025-04', '2026-08'], on(2026, 8, 31))) {
      expect(p.start <= p.end).toBe(true);
    }
  });
});

describe('a window too short to show a rhythm', () => {
  it('counts a period inclusively, both ends', () => {
    expect(daysInPeriod({ start: '2026-08-01', end: '2026-08-31' })).toBe(31);
    expect(daysInPeriod({ start: '2026-08-01', end: '2026-08-01' })).toBe(1);
  });

  it('flags one month, where a monthly bill is charged once and cannot recur', () => {
    // Measured against production: a one-month window returned 2 bills where a year returned 17.
    // Showing 2 without explanation reads as data loss.
    expect(tooShortForRhythm({ start: '2026-08-01', end: '2026-08-31' })).toBe(true);
  });

  it('accepts a window wide enough to hold two monthly cycles', () => {
    expect(tooShortForRhythm({ start: '2026-07-01', end: '2026-08-31' })).toBe(false);
  });

  it('does not flag any default preset', () => {
    // A period the picker offers must never open in the unanswerable state.
    for (const p of buildPeriods([], on(2026, 8, 31)).filter(p => p.id !== 'this-month-so-far'
      && p.id !== 'last-complete-month')) {
      expect(tooShortForRhythm(p)).toBe(false);
    }
  });
});

describe('findPeriod', () => {
  it('falls back to the first period rather than returning nothing', () => {
    const periods = buildPeriods(['2026-08'], on(2026, 8, 31));
    expect(findPeriod(periods, 'year-1999')).toBe(periods[0]);
  });
});

describe('customPeriod', () => {
  it('describes a hand-picked range the way the presets are described', () => {
    const p = customPeriod('2026-03-05', '2026-06-18');
    expect(p.label).toBe('Mar 5, 2026 – Jun 18, 2026');
    expect(p.group).toBe('custom');
  });
});
