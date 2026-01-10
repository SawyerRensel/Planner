import { Menu } from 'obsidian';
import type PlannerPlugin from '../../main';
import type { RepeatFrequency, DayOfWeek } from '../../types/item';

export interface RecurrenceData {
  repeat_frequency?: RepeatFrequency;
  repeat_interval?: number;
  repeat_byday?: DayOfWeek[];
  repeat_bymonthday?: number[];
  repeat_bysetpos?: number;
  repeat_until?: string;
  repeat_count?: number;
}

export interface RecurrenceContextMenuOptions {
  currentValue: RecurrenceData | null;
  onSelect: (value: RecurrenceData | null) => void;
  onCustom: () => void;
  plugin: PlannerPlugin;
  referenceDate?: Date;
}

const DAY_NAMES: Record<number, DayOfWeek> = {
  0: 'SU',
  1: 'MO',
  2: 'TU',
  3: 'WE',
  4: 'TH',
  5: 'FR',
  6: 'SA',
};

const DAY_LABELS: Record<DayOfWeek, string> = {
  MO: 'Monday',
  TU: 'Tuesday',
  WE: 'Wednesday',
  TH: 'Thursday',
  FR: 'Friday',
  SA: 'Saturday',
  SU: 'Sunday',
};

export class RecurrenceContextMenu {
  private menu: Menu;
  private options: RecurrenceContextMenuOptions;
  private referenceDate: Date;

  constructor(options: RecurrenceContextMenuOptions) {
    this.menu = new Menu();
    this.options = options;
    this.referenceDate = options.referenceDate || new Date();
    this.buildMenu();
  }

  private buildMenu(): void {
    const dayOfWeek = DAY_NAMES[this.referenceDate.getDay()];
    const dayLabel = DAY_LABELS[dayOfWeek];
    const dayOfMonth = this.referenceDate.getDate();
    const monthName = this.referenceDate.toLocaleString('default', { month: 'long' });

    // Standard recurrence options
    const standardOptions = [
      {
        label: 'Daily',
        value: { repeat_frequency: 'daily' as RepeatFrequency, repeat_interval: 1 },
      },
      {
        label: `Weekly on ${dayLabel}`,
        value: {
          repeat_frequency: 'weekly' as RepeatFrequency,
          repeat_interval: 1,
          repeat_byday: [dayOfWeek],
        },
      },
      {
        label: `Every 2 weeks on ${dayLabel}`,
        value: {
          repeat_frequency: 'weekly' as RepeatFrequency,
          repeat_interval: 2,
          repeat_byday: [dayOfWeek],
        },
      },
      {
        label: `Monthly on the ${this.getOrdinal(dayOfMonth)}`,
        value: {
          repeat_frequency: 'monthly' as RepeatFrequency,
          repeat_interval: 1,
          repeat_bymonthday: [dayOfMonth],
        },
      },
      {
        label: `Every 3 months on the ${this.getOrdinal(dayOfMonth)}`,
        value: {
          repeat_frequency: 'monthly' as RepeatFrequency,
          repeat_interval: 3,
          repeat_bymonthday: [dayOfMonth],
        },
      },
      {
        label: `Yearly on ${monthName} ${this.getOrdinal(dayOfMonth)}`,
        value: {
          repeat_frequency: 'yearly' as RepeatFrequency,
          repeat_interval: 1,
        },
      },
      {
        label: 'Weekdays only',
        value: {
          repeat_frequency: 'weekly' as RepeatFrequency,
          repeat_interval: 1,
          repeat_byday: ['MO', 'TU', 'WE', 'TH', 'FR'] as DayOfWeek[],
        },
      },
    ];

    standardOptions.forEach((opt) => {
      const isSelected = this.isMatchingRecurrence(opt.value);
      this.menu.addItem((item) => {
        item.setTitle(isSelected ? `✓ ${opt.label}` : opt.label);
        item.setIcon('repeat');
        item.onClick(() => {
          this.options.onSelect(opt.value);
        });
      });
    });

    // Separator before "after completion" options
    this.menu.addSeparator();

    // After completion options (these would need special handling in the item)
    const afterCompletionOptions = [
      { label: 'Daily (after completion)', interval: 1, unit: 'daily' },
      { label: 'Every 3 days (after completion)', interval: 3, unit: 'daily' },
      { label: 'Weekly (after completion)', interval: 1, unit: 'weekly' },
      { label: 'Monthly (after completion)', interval: 1, unit: 'monthly' },
    ];

    afterCompletionOptions.forEach((opt) => {
      this.menu.addItem((item) => {
        item.setTitle(opt.label);
        item.setIcon('calendar-check');
        item.onClick(() => {
          // For "after completion" recurrence, we use a special marker
          // The actual implementation would check completion date
          this.options.onSelect({
            repeat_frequency: opt.unit as RepeatFrequency,
            repeat_interval: opt.interval,
            // Add a marker to indicate this is "after completion" type
            // This could be stored in a separate field or convention
          });
        });
      });
    });

    // Separator before custom option
    this.menu.addSeparator();

    // Custom recurrence
    this.menu.addItem((item) => {
      item.setTitle('Custom recurrence...');
      item.setIcon('settings');
      item.onClick(() => {
        this.options.onCustom();
      });
    });

    // Clear recurrence (only if there's a current value)
    if (this.options.currentValue?.repeat_frequency) {
      this.menu.addItem((item) => {
        item.setTitle('Clear recurrence');
        item.setIcon('x');
        item.onClick(() => {
          this.options.onSelect(null);
        });
      });
    }
  }

  private isMatchingRecurrence(value: RecurrenceData): boolean {
    const current = this.options.currentValue;
    if (!current || !current.repeat_frequency) return false;

    if (current.repeat_frequency !== value.repeat_frequency) return false;
    if (current.repeat_interval !== value.repeat_interval) return false;

    // Compare byday arrays
    if (value.repeat_byday) {
      if (!current.repeat_byday) return false;
      if (value.repeat_byday.length !== current.repeat_byday.length) return false;
      if (!value.repeat_byday.every((d) => current.repeat_byday?.includes(d))) return false;
    }

    // Compare bymonthday arrays
    if (value.repeat_bymonthday) {
      if (!current.repeat_bymonthday) return false;
      if (value.repeat_bymonthday.length !== current.repeat_bymonthday.length) return false;
      if (!value.repeat_bymonthday.every((d) => current.repeat_bymonthday?.includes(d)))
        return false;
    }

    return true;
  }

  private getOrdinal(n: number): string {
    const s = ['th', 'st', 'nd', 'rd'];
    const v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  public show(event: MouseEvent | KeyboardEvent): void {
    if (event instanceof MouseEvent) {
      this.menu.showAtMouseEvent(event);
    } else {
      const target = event.currentTarget as HTMLElement;
      const rect = target.getBoundingClientRect();
      this.menu.showAtPosition({ x: rect.left, y: rect.bottom + 4 });
    }
  }

  public showAtElement(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    this.menu.showAtPosition({ x: rect.left, y: rect.bottom + 4 });
  }
}
