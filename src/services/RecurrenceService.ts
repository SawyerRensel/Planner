import { RRule, Frequency } from 'rrule';
import { PlannerItem, RepeatFrequency, DayOfWeek } from '../types/item';
import { isOngoing } from '../utils/dateUtils';

/**
 * Service for handling recurring items using iCal RRULE
 */
export class RecurrenceService {
  /**
   * Check if an item is recurring
   */
  isRecurring(item: PlannerItem): boolean {
    return !!item.repeat_frequency;
  }

  /**
   * Parse a date string or Date object into a valid Date
   * Handles the special "ongoing" keyword (resolves to current time)
   */
  private parseDate(value: unknown): Date | null {
    if (!value) return null;

    // Handle "ongoing" keyword - resolve to current time
    if (isOngoing(value)) {
      return new Date();
    }

    let date: Date;
    if (value instanceof Date) {
      date = new Date(value.getTime());
    } else if (typeof value === 'string') {
      date = new Date(value);
    } else if (typeof value === 'number') {
      date = new Date(value);
    } else {
      return null;
    }

    return isNaN(date.getTime()) ? null : date;
  }

  /**
   * Build an RRULE string from item frontmatter fields
   */
  private buildRRuleString(item: PlannerItem): string {
    const parts: string[] = [];

    // Frequency (required)
    const freqMap: Record<RepeatFrequency, string> = {
      daily: 'DAILY',
      weekly: 'WEEKLY',
      monthly: 'MONTHLY',
      yearly: 'YEARLY',
    };
    parts.push(`FREQ=${freqMap[item.repeat_frequency!]}`);

    // Interval
    if (item.repeat_interval && item.repeat_interval > 1) {
      parts.push(`INTERVAL=${item.repeat_interval}`);
    }

    // BYDAY (days of week)
    if (item.repeat_byday?.length) {
      parts.push(`BYDAY=${item.repeat_byday.join(',')}`);
    }

    // BYMONTH
    if (item.repeat_bymonth?.length) {
      parts.push(`BYMONTH=${item.repeat_bymonth.join(',')}`);
    }

    // BYMONTHDAY
    if (item.repeat_bymonthday?.length) {
      parts.push(`BYMONTHDAY=${item.repeat_bymonthday.join(',')}`);
    }

    // BYSETPOS - must be non-zero and within valid range
    if (item.repeat_bysetpos !== undefined && item.repeat_bysetpos !== 0 &&
        item.repeat_bysetpos >= -366 && item.repeat_bysetpos <= 366) {
      parts.push(`BYSETPOS=${item.repeat_bysetpos}`);
    }

    // COUNT
    if (item.repeat_count) {
      parts.push(`COUNT=${item.repeat_count}`);
    }

    // UNTIL
    if (item.repeat_until) {
      const until = this.parseDate(item.repeat_until);
      if (until) {
        // Format as YYYYMMDD or YYYYMMDDTHHMMSSZ
        const year = until.getUTCFullYear();
        const month = String(until.getUTCMonth() + 1).padStart(2, '0');
        const day = String(until.getUTCDate()).padStart(2, '0');
        parts.push(`UNTIL=${year}${month}${day}`);
      }
    }

    return parts.join(';');
  }

  /**
   * Parse a date string into a UTC Date for RRule
   * Uses LOCAL time components to ensure recurrence happens at the same local time
   * regardless of DST changes
   */
  private createUTCDateForRRule(dateStr: string): Date {
    // Check if this is a date-only string (no 'T' means no time component)
    // Date-only strings like "2026-01-05" are parsed as UTC midnight by JavaScript,
    // but we want to treat them as local dates
    const isDateOnly = !dateStr.includes('T');

    if (isDateOnly) {
      // For date-only strings, parse the date parts directly to avoid UTC interpretation
      const [year, month, day] = dateStr.split('-').map(Number);
      return new Date(Date.UTC(year, month - 1, day, 0, 0, 0, 0));
    }

    const date = new Date(dateStr);
    // Use LOCAL time components - this ensures RRule generates occurrences
    // at the same local wall clock time, not the same UTC instant
    return new Date(Date.UTC(
      date.getFullYear(),
      date.getMonth(),
      date.getDate(),
      date.getHours(),
      date.getMinutes(),
      date.getSeconds(),
      0
    ));
  }

  /**
   * Get the RRule object for an item
   * Uses the same approach as TaskNotes: build RRULE string, parse it, set dtstart manually
   */
  getRRule(item: PlannerItem): RRule | null {
    if (!item.repeat_frequency || !item.date_start_scheduled) {
      return null;
    }

    try {
      // Parse the start date as UTC for consistency (like TaskNotes does)
      const dtstart = this.createUTCDateForRRule(item.date_start_scheduled);

      if (isNaN(dtstart.getTime())) {
        console.warn('RecurrenceService: Invalid dtstart date', item.date_start_scheduled);
        return null;
      }

      // Build RRULE string from frontmatter fields
      const rruleString = this.buildRRuleString(item);

      // Parse the RRULE string (like TaskNotes does)
      const rruleOptions = RRule.parseString(rruleString);

      // Set dtstart manually (critical - this is what TaskNotes does)
      rruleOptions.dtstart = dtstart;

      // Create and return the RRule
      return new RRule(rruleOptions);
    } catch (error) {
      console.error('RecurrenceService: Failed to create RRule', error, {
        path: item.path,
        repeat_frequency: item.repeat_frequency,
        date_start_scheduled: item.date_start_scheduled,
        repeat_byday: item.repeat_byday,
      });
      return null;
    }
  }

  /**
   * Get all occurrences within a date range
   * Preserves the original local time for each occurrence to handle DST correctly
   */
  getOccurrences(item: PlannerItem, start: Date, end: Date): Date[] {
    const rule = this.getRRule(item);
    if (!rule) {
      const fallbackDate = this.parseDate(item.date_start_scheduled);
      return fallbackDate ? [fallbackDate] : [];
    }

    // Extract original local time components from the start date
    // Handle date-only strings specially to avoid UTC interpretation issues
    const dateStr = String(item.date_start_scheduled ?? '');
    const isDateOnly = dateStr && !dateStr.includes('T');

    let originalLocalHours: number;
    let originalLocalMinutes: number;
    let originalLocalSeconds: number;

    if (isDateOnly) {
      // For date-only strings, use midnight local time
      originalLocalHours = 0;
      originalLocalMinutes = 0;
      originalLocalSeconds = 0;
    } else {
      const originalDate = this.parseDate(item.date_start_scheduled);
      originalLocalHours = originalDate?.getHours() ?? 0;
      originalLocalMinutes = originalDate?.getMinutes() ?? 0;
      originalLocalSeconds = originalDate?.getSeconds() ?? 0;
    }

    // Convert start and end to UTC to match dtstart
    const utcStart = new Date(Date.UTC(
      start.getFullYear(),
      start.getMonth(),
      start.getDate(),
      0, 0, 0, 0
    ));
    const utcEnd = new Date(Date.UTC(
      end.getFullYear(),
      end.getMonth(),
      end.getDate(),
      23, 59, 59, 999
    ));

    // Get raw occurrences from RRule (in UTC)
    const rawOccurrences = rule.between(utcStart, utcEnd, true);

    // Convert each occurrence to preserve the original LOCAL time
    // This fixes DST issues: the event stays at the same local wall clock time
    return rawOccurrences.map(occ => {
      const year = occ.getUTCFullYear();
      const month = occ.getUTCMonth();
      const day = occ.getUTCDate();

      // Create a new date with the occurrence's date but the original local time
      return new Date(year, month, day, originalLocalHours, originalLocalMinutes, originalLocalSeconds);
    });
  }

  /**
   * Get the next occurrence after a given date
   * Preserves the original local time to handle DST correctly
   */
  getNextOccurrence(item: PlannerItem, afterDate: Date = new Date()): Date | null {
    const rule = this.getRRule(item);
    if (!rule) {
      return null;
    }

    // Extract original local time components from the start date
    // Handle date-only strings specially to avoid UTC interpretation issues
    const dateStr = String(item.date_start_scheduled ?? '');
    const isDateOnly = dateStr && !dateStr.includes('T');

    let originalLocalHours: number;
    let originalLocalMinutes: number;
    let originalLocalSeconds: number;

    if (isDateOnly) {
      originalLocalHours = 0;
      originalLocalMinutes = 0;
      originalLocalSeconds = 0;
    } else {
      const originalDate = this.parseDate(item.date_start_scheduled);
      originalLocalHours = originalDate?.getHours() ?? 0;
      originalLocalMinutes = originalDate?.getMinutes() ?? 0;
      originalLocalSeconds = originalDate?.getSeconds() ?? 0;
    }

    // Get the next occurrence after the given date (returns UTC)
    const nextOcc = rule.after(afterDate, false);
    if (!nextOcc) {
      return null;
    }

    // Convert to preserve the original LOCAL time
    const year = nextOcc.getUTCFullYear();
    const month = nextOcc.getUTCMonth();
    const day = nextOcc.getUTCDate();

    return new Date(year, month, day, originalLocalHours, originalLocalMinutes, originalLocalSeconds);
  }

  /**
   * Get all occurrences for the next N months
   */
  getUpcomingOccurrences(item: PlannerItem, months: number = 3): Date[] {
    const start = new Date();
    const end = new Date();
    end.setMonth(end.getMonth() + months);

    return this.getOccurrences(item, start, end);
  }

  /**
   * Check if a specific date has been completed for a recurring item
   */
  isDateCompleted(item: PlannerItem, date: Date): boolean {
    if (!item.repeat_completed_dates?.length) {
      return false;
    }

    const dateStr = date.toISOString().split('T')[0];
    return item.repeat_completed_dates.some(completedDate => {
      const completedDateStr = completedDate.split('T')[0];
      return completedDateStr === dateStr;
    });
  }

  /**
   * Get a human-readable description of the recurrence rule
   */
  getDescription(item: PlannerItem): string | null {
    const rule = this.getRRule(item);
    if (!rule) {
      return null;
    }

    return rule.toText();
  }

  /**
   * Generate calendar events for a recurring item within a date range
   */
  generateCalendarEvents(
    item: PlannerItem,
    start: Date,
    end: Date
  ): Array<{
    id: string;
    start: Date;
    end?: Date;
    isCompleted: boolean;
  }> {
    const occurrences = this.getOccurrences(item, start, end);
    const duration = this.getEventDuration(item);

    return occurrences.map((occurrenceStart, index) => {
      const occurrenceEnd = duration
        ? new Date(occurrenceStart.getTime() + duration)
        : undefined;

      return {
        id: `${item.path}::${index}`,
        start: occurrenceStart,
        end: occurrenceEnd,
        isCompleted: this.isDateCompleted(item, occurrenceStart),
      };
    });
  }

  /**
   * Get the duration of an event in milliseconds
   */
  private getEventDuration(item: PlannerItem): number | null {
    const start = this.parseDate(item.date_start_scheduled);
    const end = this.parseDate(item.date_end_scheduled);

    if (!start || !end) {
      return null;
    }

    return end.getTime() - start.getTime();
  }

  /**
   * Map our frequency type to rrule Frequency
   */
  private mapFrequency(freq: RepeatFrequency): Frequency {
    const map: Record<RepeatFrequency, Frequency> = {
      daily: Frequency.DAILY,
      weekly: Frequency.WEEKLY,
      monthly: Frequency.MONTHLY,
      yearly: Frequency.YEARLY,
    };
    return map[freq];
  }

  /**
   * Map our day of week to rrule Weekday
   */
  private mapWeekday(day: DayOfWeek): Weekday {
    const map: Record<DayOfWeek, Weekday> = {
      MO: RRule.MO,
      TU: RRule.TU,
      WE: RRule.WE,
      TH: RRule.TH,
      FR: RRule.FR,
      SA: RRule.SA,
      SU: RRule.SU,
    };
    return map[day];
  }

  /**
   * Parse an RRule string into frontmatter fields
   */
  parseRRuleString(rruleStr: string): Partial<PlannerItem> {
    const rule = RRule.fromString(rruleStr);
    const options = rule.options;

    const result: Partial<PlannerItem> = {};

    // Frequency
    result.repeat_frequency = this.reverseMapFrequency(options.freq);

    // Interval
    if (options.interval && options.interval > 1) {
      result.repeat_interval = options.interval;
    }

    // Until
    if (options.until) {
      result.repeat_until = options.until.toISOString();
    }

    // Count
    if (options.count) {
      result.repeat_count = options.count;
    }

    // By day
    if (options.byweekday?.length) {
      result.repeat_byday = options.byweekday.map(w =>
        this.reverseMapWeekday(typeof w === 'number' ? w : w.weekday)
      );
    }

    // By month
    if (options.bymonth?.length) {
      result.repeat_bymonth = options.bymonth;
    }

    // By month day
    if (options.bymonthday?.length) {
      result.repeat_bymonthday = options.bymonthday;
    }

    // By set position
    if (options.bysetpos?.length) {
      result.repeat_bysetpos = options.bysetpos[0];
    }

    return result;
  }

  /**
   * Reverse map rrule Frequency to our type
   */
  private reverseMapFrequency(freq: Frequency): RepeatFrequency {
    const map: Record<Frequency, RepeatFrequency> = {
      [Frequency.YEARLY]: 'yearly',
      [Frequency.MONTHLY]: 'monthly',
      [Frequency.WEEKLY]: 'weekly',
      [Frequency.DAILY]: 'daily',
      [Frequency.HOURLY]: 'daily', // Fallback
      [Frequency.MINUTELY]: 'daily', // Fallback
      [Frequency.SECONDLY]: 'daily', // Fallback
    };
    return map[freq];
  }

  /**
   * Reverse map weekday number to our type
   */
  private reverseMapWeekday(weekday: number): DayOfWeek {
    const days: DayOfWeek[] = ['MO', 'TU', 'WE', 'TH', 'FR', 'SA', 'SU'];
    return days[weekday];
  }

  /**
   * Get common recurrence presets
   */
  static getPresets(): Array<{
    label: string;
    value: Partial<PlannerItem>;
  }> {
    return [
      {
        label: 'Daily',
        value: { repeat_frequency: 'daily', repeat_interval: 1 },
      },
      {
        label: 'Weekdays',
        value: {
          repeat_frequency: 'weekly',
          repeat_interval: 1,
          repeat_byday: ['MO', 'TU', 'WE', 'TH', 'FR'],
        },
      },
      {
        label: 'Weekly',
        value: { repeat_frequency: 'weekly', repeat_interval: 1 },
      },
      {
        label: 'Bi-weekly',
        value: { repeat_frequency: 'weekly', repeat_interval: 2 },
      },
      {
        label: 'Monthly',
        value: { repeat_frequency: 'monthly', repeat_interval: 1 },
      },
      {
        label: 'Yearly',
        value: { repeat_frequency: 'yearly', repeat_interval: 1 },
      },
      {
        label: 'First of month',
        value: {
          repeat_frequency: 'monthly',
          repeat_interval: 1,
          repeat_bymonthday: [1],
        },
      },
      {
        label: 'Last Friday of month',
        value: {
          repeat_frequency: 'monthly',
          repeat_interval: 1,
          repeat_byday: ['FR'],
          repeat_bysetpos: -1,
        },
      },
    ];
  }
}
