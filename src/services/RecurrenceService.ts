import { RRule, Frequency, Weekday } from 'rrule';
import { PlannerItem, RepeatFrequency, DayOfWeek } from '../types/item';

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
   * Get the RRule object for an item
   */
  getRRule(item: PlannerItem): RRule | null {
    if (!item.repeat_frequency || !item.date_start) {
      return null;
    }

    const freq = this.mapFrequency(item.repeat_frequency);
    const dtstart = new Date(item.date_start);

    const options: Partial<ConstructorParameters<typeof RRule>[0]> = {
      freq,
      dtstart,
      interval: item.repeat_interval ?? 1,
    };

    // Until or count
    if (item.repeat_until) {
      options.until = new Date(item.repeat_until);
    }
    if (item.repeat_count) {
      options.count = item.repeat_count;
    }

    // By day of week
    if (item.repeat_byday?.length) {
      options.byweekday = item.repeat_byday.map(d => this.mapWeekday(d));
    }

    // By month
    if (item.repeat_bymonth?.length) {
      options.bymonth = item.repeat_bymonth;
    }

    // By month day
    if (item.repeat_bymonthday?.length) {
      options.bymonthday = item.repeat_bymonthday;
    }

    // By set position
    if (item.repeat_bysetpos !== undefined) {
      options.bysetpos = item.repeat_bysetpos;
    }

    return new RRule(options as ConstructorParameters<typeof RRule>[0]);
  }

  /**
   * Get all occurrences within a date range
   */
  getOccurrences(item: PlannerItem, start: Date, end: Date): Date[] {
    const rule = this.getRRule(item);
    if (!rule) {
      return item.date_start ? [new Date(item.date_start)] : [];
    }

    return rule.between(start, end, true);
  }

  /**
   * Get the next occurrence after a given date
   */
  getNextOccurrence(item: PlannerItem, afterDate: Date = new Date()): Date | null {
    const rule = this.getRRule(item);
    if (!rule) {
      return null;
    }

    // Get the next occurrence after the given date
    const nextOccurrences = rule.after(afterDate, false);
    return nextOccurrences;
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
    if (!item.date_start || !item.date_end) {
      return null;
    }

    return new Date(item.date_end).getTime() - new Date(item.date_start).getTime();
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
