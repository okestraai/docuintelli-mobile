import { fromIso, humaniseDate, instantFromIso, isoFromInstant, monthGrid, toIso, yearPage } from './dateInput';

describe('dateInput', () => {
  it('keeps the calendar day both ways', () => {
    expect(toIso(fromIso('2026-03-01')!)).toBe('2026-03-01');
    expect(toIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  });

  it('reads the date part of a full time', () => {
    expect(toIso(fromIso('2026-12-25T00:00:00.000Z')!)).toBe('2026-12-25');
  });

  it.each(['2026-02-31', '2026-13-01', 'next year', '', null, undefined])('refuses %s', (value) => {
    expect(fromIso(value)).toBeNull();
  });

  it('keeps the picked day when it is stored as a moment', () => {
    expect(isoFromInstant(instantFromIso('2027-01-15'))).toBe('2027-01-15');
    expect(isoFromInstant('')).toBe('');
    expect(isoFromInstant('nonsense')).toBe('');
  });

  it('shows the raw text if a date can not be read', () => {
    expect(humaniseDate('bad')).toBe('bad');
    expect(humaniseDate('2026-03-12')).toContain('2026');
  });

  it('lines the month up with its weekday', () => {
    // 1 November 2026 is a Sunday, 1 February 2026 too, 1 March 2027 a Monday.
    expect(monthGrid(new Date(2026, 10, 1))[0]?.getDate()).toBe(1);
    const march = monthGrid(new Date(2027, 2, 1));
    expect(march[0]).toBeNull();
    expect(march[1]?.getDate()).toBe(1);
    expect(march.filter(Boolean)).toHaveLength(31);
    expect(monthGrid(new Date(2028, 1, 1)).filter(Boolean)).toHaveLength(29);
  });

  it('pages years in twelves around the year asked for', () => {
    const page = yearPage(1990);
    expect(page).toHaveLength(12);
    expect(page).toContain(1990);
    expect(page[0] % 12).toBe(0);
  });
});
