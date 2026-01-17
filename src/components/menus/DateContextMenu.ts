import { Menu, Platform } from 'obsidian';
import type PlannerPlugin from '../../main';
import { isOngoing, ONGOING_KEYWORD } from '../../utils/dateUtils';

export interface DateContextMenuOptions {
  currentValue: string | null;
  onSelect: (value: string | null) => void;
  plugin: PlannerPlugin;
  title?: string;
  /** Field type - 'end' enables the "Ongoing" option */
  fieldType?: 'start' | 'end';
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
      const submenu = (item as { setSubmenu: () => Menu }).setSubmenu();
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

    // Ongoing option (only for end dates)
    if (this.options.fieldType === 'end') {
      const isCurrentlyOngoing = isOngoing(this.options.currentValue);
      this.menu.addItem((item) => {
        item.setTitle(isCurrentlyOngoing ? '✓ Ongoing' : 'Ongoing');
        item.setIcon('infinity');
        item.onClick(() => {
          this.options.onSelect(ONGOING_KEYWORD);
        });
      });
    }

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
          // Use current date as base if value is "ongoing" or not set
          const baseDate = this.options.currentValue && !isOngoing(this.options.currentValue)
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
    // Don't try to parse "ongoing" as a date
    const currentDateStr = this.options.currentValue && !isOngoing(this.options.currentValue)
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
    // Detect iOS - the native time picker is unstable on iOS and closes unexpectedly
    const isIOS = Platform.isIosApp;

    // Create a simple date/time picker modal
    const modal = document.createElement('div');
    modal.className = 'planner-datetime-picker-overlay';

    const picker = document.createElement('div');
    picker.className = 'planner-datetime-picker';

    const heading = document.createElement('h3');
    heading.textContent = 'Pick date & time';
    picker.appendChild(heading);

    const inputsContainer = document.createElement('div');
    inputsContainer.className = 'planner-datetime-inputs';

    // Date input
    const dateLabel = document.createElement('label');
    dateLabel.textContent = 'Date';
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.className = 'planner-date-input';
    dateLabel.appendChild(dateInput);
    inputsContainer.appendChild(dateLabel);

    // Time input - use custom select-based picker on iOS to avoid native picker issues
    const timeLabel = document.createElement('label');
    timeLabel.textContent = 'Time (optional)';

    let timeInput: HTMLInputElement | null = null;

    // Track time values for iOS custom picker
    let hourValue = -1; // -1 means no time set
    let minuteValue = -1;

    if (isIOS) {
      // iOS: Use fully custom button-based time picker (no native pickers)
      const timePickerContainer = document.createElement('div');
      timePickerContainer.className = 'planner-ios-time-picker';

      // Hour spinner
      const hourSpinner = document.createElement('div');
      hourSpinner.className = 'planner-time-spinner';

      const hourUpBtn = document.createElement('button');
      hourUpBtn.type = 'button';
      hourUpBtn.className = 'planner-time-spinner-btn';
      hourUpBtn.textContent = '▲';

      const hourDisplay = document.createElement('div');
      hourDisplay.className = 'planner-time-display';
      hourDisplay.textContent = '--';

      const hourDownBtn = document.createElement('button');
      hourDownBtn.type = 'button';
      hourDownBtn.className = 'planner-time-spinner-btn';
      hourDownBtn.textContent = '▼';

      hourSpinner.appendChild(hourUpBtn);
      hourSpinner.appendChild(hourDisplay);
      hourSpinner.appendChild(hourDownBtn);

      // Separator
      const timeSeparator = document.createElement('span');
      timeSeparator.className = 'planner-time-separator';
      timeSeparator.textContent = ':';

      // Minute spinner
      const minuteSpinner = document.createElement('div');
      minuteSpinner.className = 'planner-time-spinner';

      const minuteUpBtn = document.createElement('button');
      minuteUpBtn.type = 'button';
      minuteUpBtn.className = 'planner-time-spinner-btn';
      minuteUpBtn.textContent = '▲';

      const minuteDisplay = document.createElement('div');
      minuteDisplay.className = 'planner-time-display';
      minuteDisplay.textContent = '--';

      const minuteDownBtn = document.createElement('button');
      minuteDownBtn.type = 'button';
      minuteDownBtn.className = 'planner-time-spinner-btn';
      minuteDownBtn.textContent = '▼';

      minuteSpinner.appendChild(minuteUpBtn);
      minuteSpinner.appendChild(minuteDisplay);
      minuteSpinner.appendChild(minuteDownBtn);

      // Clear time button
      const clearTimeBtn = document.createElement('button');
      clearTimeBtn.type = 'button';
      clearTimeBtn.className = 'planner-time-clear-btn';
      clearTimeBtn.textContent = '✕';
      clearTimeBtn.title = 'Clear time';

      // Update display helper
      const updateTimeDisplay = () => {
        hourDisplay.textContent = hourValue >= 0 ? String(hourValue).padStart(2, '0') : '--';
        minuteDisplay.textContent = minuteValue >= 0 ? String(minuteValue).padStart(2, '0') : '--';
      };

      // Hour controls
      hourUpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (hourValue < 0) {
          hourValue = 0;
          if (minuteValue < 0) minuteValue = 0;
        } else {
          hourValue = (hourValue + 1) % 24;
        }
        updateTimeDisplay();
      });

      hourDownBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (hourValue < 0) {
          hourValue = 23;
          if (minuteValue < 0) minuteValue = 0;
        } else {
          hourValue = (hourValue - 1 + 24) % 24;
        }
        updateTimeDisplay();
      });

      // Minute controls
      minuteUpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (minuteValue < 0) {
          minuteValue = 0;
          if (hourValue < 0) hourValue = 0;
        } else {
          minuteValue = (minuteValue + 1) % 60;
        }
        updateTimeDisplay();
      });

      minuteDownBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (minuteValue < 0) {
          minuteValue = 0;
          if (hourValue < 0) hourValue = 0;
        } else {
          minuteValue = (minuteValue - 1 + 60) % 60;
        }
        updateTimeDisplay();
      });

      // Clear time
      clearTimeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        hourValue = -1;
        minuteValue = -1;
        updateTimeDisplay();
      });

      timePickerContainer.appendChild(hourSpinner);
      timePickerContainer.appendChild(timeSeparator);
      timePickerContainer.appendChild(minuteSpinner);
      timePickerContainer.appendChild(clearTimeBtn);
      timeLabel.appendChild(timePickerContainer);
    } else {
      // Non-iOS: Use standard time input
      timeInput = document.createElement('input');
      timeInput.type = 'time';
      timeInput.className = 'planner-time-input';
      timeLabel.appendChild(timeInput);
    }

    inputsContainer.appendChild(timeLabel);

    picker.appendChild(inputsContainer);

    // Buttons
    const buttonsContainer = document.createElement('div');
    buttonsContainer.className = 'planner-datetime-buttons';

    const cancelBtn = document.createElement('button');
    cancelBtn.className = 'planner-btn';
    cancelBtn.textContent = 'Cancel';
    cancelBtn.setAttribute('data-action', 'cancel');
    buttonsContainer.appendChild(cancelBtn);

    const confirmBtn = document.createElement('button');
    confirmBtn.className = 'planner-btn planner-btn-primary';
    confirmBtn.textContent = 'Confirm';
    confirmBtn.setAttribute('data-action', 'confirm');
    buttonsContainer.appendChild(confirmBtn);

    picker.appendChild(buttonsContainer);
    modal.appendChild(picker);

    // Pre-fill with current value if exists (skip if "ongoing")
    if (this.options.currentValue && !isOngoing(this.options.currentValue)) {
      const current = new Date(this.options.currentValue);
      dateInput.value = this.formatDateForInput(current);
      if (isIOS) {
        // Set the spinner values - they'll be displayed via the hourValue/minuteValue
        hourValue = current.getHours();
        minuteValue = current.getMinutes();
        // Update the displays (find them in the DOM)
        const hourDisplay = picker.querySelector('.planner-time-spinner:first-child .planner-time-display');
        const minuteDisplay = picker.querySelector('.planner-time-spinner:last-of-type .planner-time-display');
        if (hourDisplay) hourDisplay.textContent = String(hourValue).padStart(2, '0');
        if (minuteDisplay) minuteDisplay.textContent = String(minuteValue).padStart(2, '0');
      } else if (timeInput) {
        timeInput.value = this.formatTimeForInput(current);
      }
    } else {
      dateInput.value = this.formatDateForInput(new Date());
    }

    cancelBtn.addEventListener('click', () => {
      modal.remove();
    });

    confirmBtn.addEventListener('click', () => {
      if (dateInput.value) {
        let dateStr = dateInput.value;

        // Get time value based on input type
        let timeValue = '';
        if (isIOS) {
          if (hourValue >= 0 && minuteValue >= 0) {
            timeValue = `${String(hourValue).padStart(2, '0')}:${String(minuteValue).padStart(2, '0')}`;
          }
        } else if (timeInput) {
          timeValue = timeInput.value;
        }

        if (timeValue) {
          dateStr += `T${timeValue}:00`;
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
