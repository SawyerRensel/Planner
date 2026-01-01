import { Menu } from 'obsidian';
import type PlannerPlugin from '../../main';

export interface DateContextMenuOptions {
  currentValue: string | null;
  onSelect: (value: string | null) => void;
  plugin: PlannerPlugin;
  title?: string;
}

export class DateContextMenu {
  private menu: Menu;
  private options: DateContextMenuOptions;

  constructor(options: DateContextMenuOptions) {
    this.menu = new Menu();
    this.options = options;
    this.buildMenu();
  }

  private buildMenu(): void {
    // Title section
    if (this.options.title) {
      this.menu.addItem((item) => {
        item.setTitle(this.options.title!);
        item.setIcon('calendar');
        item.setDisabled(true);
      });
      this.menu.addSeparator();
    }

    // Relative date options
    this.addRelativeOptions();
    this.menu.addSeparator();

    // Quick pick options
    this.addQuickPickOptions();
    this.menu.addSeparator();

    // Weekdays submenu
    this.menu.addItem((item) => {
      item.setTitle('Weekdays');
      item.setIcon('calendar-days');
      const submenu = (item as any).setSubmenu();
      this.addWeekdaySubmenu(submenu);
    });

    this.menu.addSeparator();

    // Pick date & time
    this.menu.addItem((item) => {
      item.setTitle('Pick date & time...');
      item.setIcon('calendar-clock');
      item.onClick(() => {
        this.showDateTimePicker();
      });
    });

    // Clear date (only if there's a current value)
    if (this.options.currentValue) {
      this.menu.addItem((item) => {
        item.setTitle('Clear date');
        item.setIcon('x');
        item.onClick(() => {
          this.options.onSelect(null);
        });
      });
    }
  }

  private addRelativeOptions(): void {
    const relativeOptions = [
      { label: '+ 1 day', days: 1, icon: 'plus' },
      { label: '− 1 day', days: -1, icon: 'minus' },
      { label: '+ 1 week', days: 7, icon: 'plus-circle' },
      { label: '− 1 week', days: -7, icon: 'minus-circle' },
    ];

    relativeOptions.forEach((opt) => {
      this.menu.addItem((item) => {
        item.setTitle(opt.label);
        item.setIcon(opt.icon);
        item.onClick(() => {
          const baseDate = this.options.currentValue
            ? new Date(this.options.currentValue)
            : new Date();
          baseDate.setDate(baseDate.getDate() + opt.days);
          this.options.onSelect(this.formatDateTime(baseDate));
        });
      });
    });
  }

  private addQuickPickOptions(): void {
    const today = new Date();
    const currentDateStr = this.options.currentValue
      ? this.formatDate(new Date(this.options.currentValue))
      : null;

    const quickPicks = [
      { label: 'Today', date: today },
      { label: 'Tomorrow', date: this.addDays(today, 1) },
      { label: 'This weekend', date: this.getNextWeekend(today) },
      { label: 'Next week', date: this.addDays(today, 7) },
      { label: 'Next month', date: this.addMonths(today, 1) },
    ];

    quickPicks.forEach((pick) => {
      const pickDateStr = this.formatDate(pick.date);
      const isSelected = currentDateStr === pickDateStr;

      this.menu.addItem((item) => {
        item.setTitle(isSelected ? `✓ ${pick.label}` : pick.label);
        item.setIcon('calendar');
        item.onClick(() => {
          this.options.onSelect(this.formatDateTime(pick.date));
        });
      });
    });
  }

  private addWeekdaySubmenu(submenu: Menu): void {
    const today = new Date();
    const weekdays = [
      { label: 'Monday', dayOfWeek: 1 },
      { label: 'Tuesday', dayOfWeek: 2 },
      { label: 'Wednesday', dayOfWeek: 3 },
      { label: 'Thursday', dayOfWeek: 4 },
      { label: 'Friday', dayOfWeek: 5 },
      { label: 'Saturday', dayOfWeek: 6 },
      { label: 'Sunday', dayOfWeek: 0 },
    ];

    weekdays.forEach((day) => {
      submenu.addItem((item) => {
        item.setTitle(`Next ${day.label}`);
        item.onClick(() => {
          const nextDay = this.getNextDayOfWeek(today, day.dayOfWeek);
          this.options.onSelect(this.formatDateTime(nextDay));
        });
      });
    });
  }

  private showDateTimePicker(): void {
    // Create a simple date/time picker modal
    const modal = document.createElement('div');
    modal.className = 'planner-datetime-picker-overlay';
    modal.innerHTML = `
      <div class="planner-datetime-picker">
        <h3>Pick date & time</h3>
        <div class="planner-datetime-inputs">
          <label>
            Date
            <input type="date" class="planner-date-input" />
          </label>
          <label>
            Time (optional)
            <input type="time" class="planner-time-input" />
          </label>
        </div>
        <div class="planner-datetime-buttons">
          <button class="planner-btn" data-action="cancel">Cancel</button>
          <button class="planner-btn planner-btn-primary" data-action="confirm">Confirm</button>
        </div>
      </div>
    `;

    const dateInput = modal.querySelector('.planner-date-input') as HTMLInputElement;
    const timeInput = modal.querySelector('.planner-time-input') as HTMLInputElement;

    // Pre-fill with current value if exists
    if (this.options.currentValue) {
      const current = new Date(this.options.currentValue);
      dateInput.value = this.formatDateForInput(current);
      timeInput.value = this.formatTimeForInput(current);
    } else {
      dateInput.value = this.formatDateForInput(new Date());
    }

    modal.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
      modal.remove();
    });

    modal.querySelector('[data-action="confirm"]')?.addEventListener('click', () => {
      if (dateInput.value) {
        let dateStr = dateInput.value;
        if (timeInput.value) {
          dateStr += `T${timeInput.value}:00`;
        } else {
          dateStr += 'T00:00:00';
        }
        this.options.onSelect(new Date(dateStr).toISOString());
      }
      modal.remove();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        modal.remove();
      }
    });

    document.body.appendChild(modal);
    dateInput.focus();
  }

  // Date utility methods
  private formatDateTime(date: Date): string {
    return date.toISOString();
  }

  private formatDate(date: Date): string {
    return date.toISOString().split('T')[0];
  }

  private formatDateForInput(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  private formatTimeForInput(date: Date): string {
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
  }

  private addMonths(date: Date, months: number): Date {
    const result = new Date(date);
    result.setMonth(result.getMonth() + months);
    return result;
  }

  private getNextWeekend(date: Date): Date {
    const result = new Date(date);
    const dayOfWeek = result.getDay();
    const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
    result.setDate(result.getDate() + daysUntilSaturday);
    return result;
  }

  private getNextDayOfWeek(date: Date, targetDay: number): Date {
    const result = new Date(date);
    const currentDay = result.getDay();
    const daysUntilTarget = (targetDay - currentDay + 7) % 7 || 7;
    result.setDate(result.getDate() + daysUntilTarget);
    return result;
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
