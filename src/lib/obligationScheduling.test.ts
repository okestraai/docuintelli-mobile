/**
 * Ported from the web app's suite of the same name (Vitest there, Jest here — the
 * assertions are identical).
 *
 * These assert the same rules as the server's `obligationRules.test.ts`. If one suite is
 * changed without the others, a client starts accepting input the server rejects (or vice
 * versa) — the drift this pairing exists to catch.
 */

import {
  daysBetween,
  daysUntilDue,
  obligationUrgency,
  normalizePreNotice,
  validateDueDate,
  describePreNotice,
  suggestedPreNoticeFor,
  groupObligations,
  dueLabel,
  MAX_PRE_NOTICE_ENTRIES,
} from './obligationScheduling';

const TODAY = new Date('2026-08-30T00:00:00Z');

describe('daysBetween', () => {
  it('ignores time of day', () => {
    expect(daysBetween(new Date('2026-08-30T23:59:00Z'), new Date('2026-08-31T00:01:00Z'))).toBe(1);
  });

  it('crosses month and year boundaries', () => {
    expect(daysBetween(new Date('2026-08-30T00:00:00Z'), new Date('2026-09-06T00:00:00Z'))).toBe(7);
    expect(daysBetween(new Date('2026-12-28T00:00:00Z'), new Date('2027-01-04T00:00:00Z'))).toBe(7);
  });

  it('handles a leap day', () => {
    expect(daysBetween(new Date('2028-02-28T00:00:00Z'), new Date('2028-03-01T00:00:00Z'))).toBe(2);
  });
});

describe('daysUntilDue', () => {
  it('parses the date as UTC, not local time', () => {
    // Parsed locally west of Greenwich this lands on the 29th and reads as 6 days.
    expect(daysUntilDue('2026-09-06', TODAY)).toBe(7);
  });

  it('returns null for missing or malformed input', () => {
    expect(daysUntilDue(null, TODAY)).toBeNull();
    expect(daysUntilDue('', TODAY)).toBeNull();
    expect(daysUntilDue('09/06/2026', TODAY)).toBeNull();
    expect(daysUntilDue('tomorrow', TODAY)).toBeNull();
  });

  it('goes negative when overdue', () => {
    expect(daysUntilDue('2026-08-27', TODAY)).toBe(-3);
  });
});

describe('obligationUrgency', () => {
  it.each([
    ['2026-08-25', 'overdue'],
    ['2026-08-29', 'overdue'],
    ['2026-08-30', 'today'],
    ['2026-08-31', 'soon'],
    ['2026-09-06', 'soon'],
    ['2026-09-07', 'upcoming'],
    [null, 'undated'],
  ])('classifies %s as %s', (date, expected) => {
    expect(obligationUrgency(date as string | null, TODAY)).toBe(expected);
  });
});

describe('normalizePreNotice', () => {
  it('dedupes and sorts descending', () => {
    expect(normalizePreNotice([7, 30, 7, 1])).toEqual({ ok: true, days: [30, 7, 1] });
  });

  it('accepts 0 as "on the day"', () => {
    expect(normalizePreNotice([0])).toEqual({ ok: true, days: [0] });
  });

  it('rejects an empty selection', () => {
    expect(normalizePreNotice([]).ok).toBe(false);
  });

  it('rejects non-integers and out-of-range values', () => {
    expect(normalizePreNotice([3.5]).ok).toBe(false);
    expect(normalizePreNotice([-1]).ok).toBe(false);
    expect(normalizePreNotice([366]).ok).toBe(false);
  });

  it('rejects more than the cap, counting after dedupe', () => {
    const tooMany = Array.from({ length: MAX_PRE_NOTICE_ENTRIES + 1 }, (_, i) => i);
    expect(normalizePreNotice(tooMany).ok).toBe(false);

    const withDupe = [...Array.from({ length: MAX_PRE_NOTICE_ENTRIES }, (_, i) => i), 0];
    expect(normalizePreNotice(withDupe).ok).toBe(true);
  });
});

describe('validateDueDate', () => {
  it('accepts a future date', () => {
    expect(validateDueDate('2026-09-06', TODAY)).toEqual({ ok: true, value: '2026-09-06', isPast: false });
  });

  it('accepts today as not past', () => {
    expect(validateDueDate('2026-08-30', TODAY)).toMatchObject({ ok: true, isPast: false });
  });

  it('accepts a past date but flags it', () => {
    expect(validateDueDate('2026-08-01', TODAY)).toMatchObject({ ok: true, isPast: true });
  });

  it.each(['', 'tomorrow', '09/06/2026', '2026-9-6'])('rejects %p', input => {
    expect(validateDueDate(input, TODAY).ok).toBe(false);
  });

  it('rejects a date that does not exist', () => {
    expect(validateDueDate('2026-02-31', TODAY).ok).toBe(false);
    expect(validateDueDate('2026-13-01', TODAY).ok).toBe(false);
  });

  it('rejects the far future', () => {
    expect(validateDueDate('2099-01-01', TODAY).ok).toBe(false);
  });
});

describe('describePreNotice', () => {
  it.each([
    [[], 'No reminders'],
    [[0], 'on the day'],
    [[1], '1 day before'],
    [[7], '7 days before'],
    [[30, 7], '30 and 7 days before'],
    [[30, 7, 1], '30, 7 and 1 days before'],
    [[7, 0], '7 days before, and on the day'],
  ])('describes %j', (days, expected) => {
    expect(describePreNotice(days as number[])).toBe(expected);
  });

  it('sorts an unsorted input before describing it', () => {
    expect(describePreNotice([1, 30, 7])).toBe('30, 7 and 1 days before');
  });
});

describe('suggestedPreNoticeFor', () => {
  it('gives cancellation deadlines the longest runway', () => {
    expect(suggestedPreNoticeFor('cancellation')).toEqual([30, 14, 7]);
  });

  it('reminds on the day for payments', () => {
    expect(suggestedPreNoticeFor('payment')).toContain(0);
  });

  it('falls back to a default for an unknown type', () => {
    expect(suggestedPreNoticeFor('nonsense')).toEqual([7, 1]);
  });
});

describe('groupObligations', () => {
  const items = [
    { id: 'a', due_date: '2026-08-20' },
    { id: 'b', due_date: '2026-08-30' },
    { id: 'c', due_date: '2026-09-02' },
    { id: 'd', due_date: '2026-12-01' },
    { id: 'e', due_date: null },
  ];

  it('groups in urgency order', () => {
    expect(groupObligations(items, TODAY).map(g => g.key)).toEqual([
      'overdue', 'today', 'soon', 'upcoming', 'undated',
    ]);
  });

  it('omits empty groups', () => {
    const groups = groupObligations([{ id: 'x', due_date: '2026-12-01' }], TODAY);
    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('upcoming');
  });

  it('returns nothing for an empty list', () => {
    expect(groupObligations([], TODAY)).toEqual([]);
  });

  it('preserves input order within a group', () => {
    const sameGroup = [
      { id: 'first', due_date: '2026-09-05' },
      { id: 'second', due_date: '2026-09-02' },
    ];
    expect(groupObligations(sameGroup, TODAY)[0].items.map(i => i.id)).toEqual(['first', 'second']);
  });
});

describe('dueLabel', () => {
  it.each([
    ['2026-08-30', 'Today'],
    ['2026-08-31', 'Tomorrow'],
    ['2026-09-06', '7 days'],
    ['2026-08-29', '1d overdue'],
    [null, 'No date'],
  ])('labels %s as %s', (date, expected) => {
    expect(dueLabel(date as string | null, TODAY)).toBe(expected);
  });
});
