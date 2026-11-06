// Dates travel as YYYY-MM-DD and are read in local time, so the calendar day never shifts.
export function toIso(date: Date): string {
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${date.getFullYear()}-${month}-${day}`;
}

export function fromIso(iso: string | null | undefined): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso ?? '');
  if (!match) return null;
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null;
  return date;
}

// The local day of a stored moment, such as a delay_until time.
export function isoFromInstant(value: string | null | undefined): string {
  if (!value) return '';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '' : toIso(date);
}

export function instantFromIso(iso: string): string {
  return new Date(`${iso}T00:00:00`).toISOString();
}

export function humaniseDate(iso: string): string {
  const date = fromIso(iso);
  return date ? date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : iso;
}

// Sunday first, with blanks so the 1st lands on its weekday.
export function monthGrid(month: Date): (Date | null)[] {
  const year = month.getFullYear();
  const index = month.getMonth();
  const cells: (Date | null)[] = Array(new Date(year, index, 1).getDay()).fill(null);
  const days = new Date(year, index + 1, 0).getDate();
  for (let day = 1; day <= days; day++) cells.push(new Date(year, index, day));
  return cells;
}

export const YEARS_PER_PAGE = 12;

export function yearPage(year: number): number[] {
  const first = Math.floor(year / YEARS_PER_PAGE) * YEARS_PER_PAGE;
  return Array.from({ length: YEARS_PER_PAGE }, (_, i) => first + i);
}
