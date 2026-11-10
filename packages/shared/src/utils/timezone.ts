/**
 * Timezone and quiet hours calculation utilities for notification scheduling.
 * Calorie and reminder scheduling must respect the user's local timezone.
 */

/**
 * Validates whether a string is a valid IANA timezone identifier.
 */
export function isValidIanaTimezone(tz: string): boolean {
  if (!tz || typeof tz !== 'string') return false;
  try {
    Intl.DateTimeFormat(undefined, { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/**
 * Parses "HH:mm" 24-hour time string to total minutes since midnight (0-1439).
 * Returns -1 if the format is invalid.
 */
export function parseTimeToMinutes(timeHHmm: string): number {
  if (!timeHHmm || typeof timeHHmm !== 'string') return -1;
  const parts = timeHHmm.trim().split(':');
  if (parts.length !== 2) return -1;
  const rawHour = parts[0];
  const rawMin = parts[1];
  if (!rawHour || !rawMin) return -1;
  const hours = Number.parseInt(rawHour, 10);
  const minutes = Number.parseInt(rawMin, 10);
  if (
    Number.isNaN(hours) ||
    Number.isNaN(minutes) ||
    hours < 0 ||
    hours > 23 ||
    minutes < 0 ||
    minutes > 59
  ) {
    return -1;
  }
  return hours * 60 + minutes;
}

/**
 * Formats hours and minutes into a canonical "HH:mm" string.
 */
export function formatMinutesToTime(minutes: number): string {
  const normalized = ((minutes % 1440) + 1440) % 1440;
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

/**
 * Checks whether a given "HH:mm" time falls within user-specified quiet hours.
 * Accurately handles midnight crossovers (e.g. 22:00 to 07:00).
 */
export function isWithinQuietHours(
  currentTimeHHmm: string,
  quietStartHHmm?: string | null,
  quietEndHHmm?: string | null,
): boolean {
  if (!quietStartHHmm || !quietEndHHmm) {
    return false;
  }

  const cur = parseTimeToMinutes(currentTimeHHmm);
  const start = parseTimeToMinutes(quietStartHHmm);
  const end = parseTimeToMinutes(quietEndHHmm);

  if (cur === -1 || start === -1 || end === -1) {
    return false;
  }

  // Identical start and end means no effective quiet window
  if (start === end) {
    return false;
  }

  if (start < end) {
    // Normal window within the same calendar day (e.g. 13:00 to 15:00)
    return cur >= start && cur < end;
  } else {
    // Overnight window crossing midnight (e.g. 22:00 to 07:00)
    return cur >= start || cur < end;
  }
}

export interface LocalTimeDetails {
  timeHHmm: string;
  dayOfWeek: number; // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  dateIso: string; // YYYY-MM-DD
  minutes: number;
}

/**
 * Returns current local time details for a specified timezone.
 * Falls back to UTC if timezone is invalid.
 */
export function getCurrentTimeInTimezone(
  timezone: string,
  referenceDate: Date = new Date(),
): LocalTimeDetails {
  const validTz = isValidIanaTimezone(timezone) ? timezone : 'UTC';

  const dtf = new Intl.DateTimeFormat('en-US', {
    timeZone: validTz,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    weekday: 'short',
  });

  const parts = dtf.formatToParts(referenceDate);
  const getPart = (type: string) => parts.find(p => p.type === type)?.value ?? '';

  const hour = getPart('hour') === '24' ? '00' : getPart('hour');
  const minute = getPart('minute');
  const year = getPart('year');
  const month = getPart('month');
  const day = getPart('day');

  const timeHHmm = `${hour.padStart(2, '0')}:${minute.padStart(2, '0')}`;
  const dateIso = `${year}-${month}-${day}`;

  const dayOfWeekMap: Record<string, number> = {
    Sun: 0,
    Mon: 1,
    Tue: 2,
    Wed: 3,
    Thu: 4,
    Fri: 5,
    Sat: 6,
  };
  const weekdayStr = getPart('weekday');
  const dayOfWeek = dayOfWeekMap[weekdayStr] ?? referenceDate.getUTCDay();

  return {
    timeHHmm,
    dayOfWeek,
    dateIso,
    minutes: parseTimeToMinutes(timeHHmm),
  };
}

/**
 * Evaluates whether a target reminder time matches the current time within a tolerance window (in minutes).
 */
export function isReminderDue(
  currentTimeHHmm: string,
  targetTimeHHmm: string,
  toleranceMinutes: number = 30,
): boolean {
  const cur = parseTimeToMinutes(currentTimeHHmm);
  const target = parseTimeToMinutes(targetTimeHHmm);

  if (cur === -1 || target === -1) return false;

  // Handle difference including midnight wrap
  let diff = Math.abs(cur - target);
  if (diff > 720) {
    diff = 1440 - diff;
  }

  return diff <= toleranceMinutes;
}
