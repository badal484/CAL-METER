/**
 * Deterministic date and calendar utilities.
 */

export function formatDateToIso(date: Date): string {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function parseIsoDate(isoDateString: string): Date {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(isoDateString)) {
    throw new Error(`Invalid ISO date format: ${isoDateString}. Expected YYYY-MM-DD.`);
  }
  const [yearStr, monthStr, dayStr] = isoDateString.split('-');
  const year = Number(yearStr);
  const month = Number(monthStr) - 1;
  const day = Number(dayStr);
  const parsed = new Date(Date.UTC(year, month, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error(`Invalid calendar date: ${isoDateString}.`);
  }
  return parsed;
}

export function isValidIsoDate(isoDateString: string): boolean {
  try {
    parseIsoDate(isoDateString);
    return true;
  } catch {
    return false;
  }
}

export function addDays(date: Date, days: number): Date {
  const result = new Date(date.getTime());
  result.setUTCDate(result.getUTCDate() + days);
  return result;
}

export function getDaysDifference(dateA: Date, dateB: Date): number {
  const utcA = Date.UTC(dateA.getUTCFullYear(), dateA.getUTCMonth(), dateA.getUTCDate());
  const utcB = Date.UTC(dateB.getUTCFullYear(), dateB.getUTCMonth(), dateB.getUTCDate());
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round((utcB - utcA) / msPerDay);
}
