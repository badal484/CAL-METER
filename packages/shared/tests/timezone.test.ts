import { describe, it, expect } from 'vitest';
import {
  isWithinQuietHours,
  parseTimeToMinutes,
  formatMinutesToTime,
  isValidIanaTimezone,
  getCurrentTimeInTimezone,
  isReminderDue,
} from '../src/utils/timezone.js';

describe('Timezone & Quiet Hours Utilities (Part 13)', () => {
  describe('parseTimeToMinutes & formatMinutesToTime', () => {
    it('parses valid 24h strings accurately', () => {
      expect(parseTimeToMinutes('00:00')).toBe(0);
      expect(parseTimeToMinutes('08:30')).toBe(510);
      expect(parseTimeToMinutes('13:15')).toBe(795);
      expect(parseTimeToMinutes('23:59')).toBe(1439);
    });

    it('returns -1 for invalid inputs', () => {
      expect(parseTimeToMinutes('24:00')).toBe(-1);
      expect(parseTimeToMinutes('12:60')).toBe(-1);
      expect(parseTimeToMinutes('invalid')).toBe(-1);
      expect(parseTimeToMinutes('')).toBe(-1);
      expect(parseTimeToMinutes(null as unknown as string)).toBe(-1);
    });

    it('formats minutes into standard HH:mm format', () => {
      expect(formatMinutesToTime(0)).toBe('00:00');
      expect(formatMinutesToTime(510)).toBe('08:30');
      expect(formatMinutesToTime(1439)).toBe('23:59');
      // wrapping
      expect(formatMinutesToTime(1440)).toBe('00:00');
    });
  });

  describe('isWithinQuietHours', () => {
    it('handles same-day quiet window (e.g. 13:00 to 15:00)', () => {
      const start = '13:00';
      const end = '15:00';

      expect(isWithinQuietHours('12:59', start, end)).toBe(false);
      expect(isWithinQuietHours('13:00', start, end)).toBe(true);
      expect(isWithinQuietHours('14:30', start, end)).toBe(true);
      expect(isWithinQuietHours('15:00', start, end)).toBe(false);
      expect(isWithinQuietHours('16:00', start, end)).toBe(false);
    });

    it('handles overnight quiet window crossing midnight (e.g. 22:00 to 07:00)', () => {
      const start = '22:00';
      const end = '07:00';

      expect(isWithinQuietHours('21:59', start, end)).toBe(false);
      expect(isWithinQuietHours('22:00', start, end)).toBe(true);
      expect(isWithinQuietHours('23:30', start, end)).toBe(true);
      expect(isWithinQuietHours('00:00', start, end)).toBe(true);
      expect(isWithinQuietHours('04:15', start, end)).toBe(true);
      expect(isWithinQuietHours('06:59', start, end)).toBe(true);
      expect(isWithinQuietHours('07:00', start, end)).toBe(false);
      expect(isWithinQuietHours('12:00', start, end)).toBe(false);
    });

    it('returns false when quiet hours are not configured or invalid', () => {
      expect(isWithinQuietHours('02:00', null, '07:00')).toBe(false);
      expect(isWithinQuietHours('02:00', '22:00', null)).toBe(false);
      expect(isWithinQuietHours('02:00', '', '')).toBe(false);
      expect(isWithinQuietHours('02:00', '08:00', '08:00')).toBe(false);
    });
  });

  describe('isValidIanaTimezone', () => {
    it('validates common timezones across India and global regions', () => {
      expect(isValidIanaTimezone('Asia/Kolkata')).toBe(true);
      expect(isValidIanaTimezone('America/New_York')).toBe(true);
      expect(isValidIanaTimezone('Europe/London')).toBe(true);
      expect(isValidIanaTimezone('UTC')).toBe(true);
      expect(isValidIanaTimezone('Australia/Sydney')).toBe(true);
    });

    it('rejects invalid or corrupted timezone names', () => {
      expect(isValidIanaTimezone('Invalid/Timezone')).toBe(false);
      expect(isValidIanaTimezone('')).toBe(false);
      expect(isValidIanaTimezone(null as unknown as string)).toBe(false);
    });
  });

  describe('getCurrentTimeInTimezone', () => {
    it('computes localized time and ISO date for a fixed UTC instant', () => {
      // 2026-11-10T12:00:00Z -> IST (+5:30) is 17:30
      const utcDate = new Date('2026-11-10T12:00:00Z');
      const ist = getCurrentTimeInTimezone('Asia/Kolkata', utcDate);

      expect(ist.timeHHmm).toBe('17:30');
      expect(ist.dateIso).toBe('2026-11-10');
      expect(ist.minutes).toBe(1050);
    });

    it('handles day boundary transitions correctly', () => {
      // 2026-11-10T22:00:00Z -> IST (+5:30) is 03:30 on next day 2026-11-11
      const utcDate = new Date('2026-11-10T22:00:00Z');
      const ist = getCurrentTimeInTimezone('Asia/Kolkata', utcDate);

      expect(ist.timeHHmm).toBe('03:30');
      expect(ist.dateIso).toBe('2026-11-11');
      expect(ist.minutes).toBe(210);
    });

    it('gracefully falls back to UTC for invalid timezones', () => {
      const utcDate = new Date('2026-11-10T15:45:00Z');
      const fallback = getCurrentTimeInTimezone('Not/ATimezone', utcDate);

      expect(fallback.timeHHmm).toBe('15:45');
      expect(fallback.dateIso).toBe('2026-11-10');
    });
  });

  describe('isReminderDue', () => {
    it('matches target time within default 30 min window', () => {
      expect(isReminderDue('08:30', '08:30')).toBe(true);
      expect(isReminderDue('08:45', '08:30', 30)).toBe(true);
      expect(isReminderDue('08:15', '08:30', 30)).toBe(true);
      expect(isReminderDue('09:15', '08:30', 30)).toBe(false);
    });

    it('handles midnight wrap-around', () => {
      expect(isReminderDue('23:55', '00:05', 15)).toBe(true);
      expect(isReminderDue('00:05', '23:55', 15)).toBe(true);
      expect(isReminderDue('23:30', '00:10', 15)).toBe(false);
    });
  });
});
