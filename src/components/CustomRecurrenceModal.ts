import { Modal, Setting } from 'obsidian';
import type PlannerPlugin from '../main';
import type { RepeatFrequency, DayOfWeek } from '../types/item';
import type { RecurrenceData } from './menus/RecurrenceContextMenu';

const DAYS_OF_WEEK: { key: DayOfWeek; label: string; short: string }[] = [
  { key: 'MO', label: 'Monday', short: 'Mon' },
  { key: 'TU', label: 'Tuesday', short: 'Tue' },
  { key: 'WE', label: 'Wednesday', short: 'Wed' },
  { key: 'TH', label: 'Thursday', short: 'Thu' },
  { key: 'FR', label: 'Friday', short: 'Fri' },
  { key: 'SA', label: 'Saturday', short: 'Sat' },
  { key: 'SU', label: 'Sunday', short: 'Sun' },
];

const POSITION_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'First' },
  { value: 2, label: 'Second' },
  { value: 3, label: 'Third' },
  { value: 4, label: 'Fourth' },
  { value: -1, label: 'Last' },
];

export class CustomRecurrenceModal extends Modal {
  private plugin: PlannerPlugin;
  private currentValue: RecurrenceData;
  private onSubmit: (result: RecurrenceData | null) => void;

  // Form state
  private frequency: RepeatFrequency = 'daily';
  private interval = 1;
  private byDay: Set<DayOfWeek> = new Set();
  private byMonthDay: number[] = [];
  private bySetPos: number | undefined;
  private monthlyType: 'dayOfMonth' | 'nthWeekday' = 'dayOfMonth';
  private nthWeekdayDay: DayOfWeek = 'MO';
  private nthWeekdayPos: number = 1;
  private endType: 'never' | 'count' | 'until' = 'never';
  private count: number | undefined;
  private until: string = '';

  // UI elements for dynamic updates
  private byDayContainer: HTMLElement | null = null;
  private byMonthDayContainer: HTMLElement | null = null;
  private monthlyTypeSetting: Setting | null = null;
  private nthWeekdaySetting: Setting | null = null;
  private endCountSetting: Setting | null = null;
  private endUntilSetting: Setting | null = null;
  private previewTextEl: HTMLElement | null = null;

  constructor(
    plugin: PlannerPlugin,
    currentValue: RecurrenceData | null,
    onSubmit: (result: RecurrenceData | null) => void
  ) {
    super(plugin.app);
    this.plugin = plugin;
    this.currentValue = currentValue || {};
    this.onSubmit = onSubmit;
    this.parseCurrentValue();
  }

  private parseCurrentValue(): void {
    const cv = this.currentValue;
    if (cv.repeat_frequency) this.frequency = cv.repeat_frequency;
    if (cv.repeat_interval) this.interval = cv.repeat_interval;
    if (cv.repeat_byday) this.byDay = new Set(cv.repeat_byday);
    if (cv.repeat_bymonthday) this.byMonthDay = cv.repeat_bymonthday;
    if (cv.repeat_bysetpos) this.bySetPos = cv.repeat_bysetpos;

    // Detect nth weekday pattern for monthly recurrence
    if (
      cv.repeat_frequency === 'monthly' &&
      cv.repeat_bysetpos !== undefined &&
      cv.repeat_byday &&
      cv.repeat_byday.length === 1
    ) {
      this.monthlyType = 'nthWeekday';
      this.nthWeekdayDay = cv.repeat_byday[0];
      this.nthWeekdayPos = cv.repeat_bysetpos;
    }

    if (cv.repeat_count) {
      this.endType = 'count';
      this.count = cv.repeat_count;
    }
    if (cv.repeat_until) {
      this.endType = 'until';
      this.until = cv.repeat_until.split('T')[0];
    }
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('planner-custom-recurrence-modal');

    contentEl.createEl('h2', { text: 'Custom recurrence' });

    // Frequency dropdown
    new Setting(contentEl).setName('Repeat').addDropdown((dropdown) => {
      dropdown
        .addOption('daily', 'Daily')
        .addOption('weekly', 'Weekly')
        .addOption('monthly', 'Monthly')
        .addOption('yearly', 'Yearly')
        .setValue(this.frequency)
        .onChange((value) => {
          this.frequency = value as RepeatFrequency;
          this.updateFrequencySpecificFields();
        });
    });

    // Interval input
    new Setting(contentEl)
      .setName('Every')
      .setDesc('How often to repeat')
      .addText((text) => {
        text
          .setPlaceholder('1')
          .setValue(this.interval.toString())
          .onChange((value) => {
            this.interval = parseInt(value) || 1;
          });
        text.inputEl.type = 'number';
        text.inputEl.min = '1';
        text.inputEl.addClass('planner-input-narrow');
      })
      .addExtraButton((btn) => {
        btn.setDisabled(true);
        // This will be updated based on frequency
        btn.extraSettingsEl.setText(this.getIntervalUnitLabel());
        btn.extraSettingsEl.addClass('planner-interval-unit');
      });

    // Days of week (for weekly)
    const byDaySetting = new Setting(contentEl)
      .setName('On days')
      .setDesc('Select specific days of the week');
    this.byDayContainer = byDaySetting.controlEl;
    this.createDaysOfWeekCheckboxes();

    // Monthly type toggle (day of month vs nth weekday)
    this.monthlyTypeSetting = new Setting(contentEl)
      .setName('Repeat on')
      .setDesc('Choose how to specify the monthly recurrence')
      .addDropdown((dropdown) => {
        dropdown
          .addOption('dayOfMonth', 'Day of month (e.g., the 15th)')
          .addOption('nthWeekday', 'Weekday of month (e.g., second monday)')
          .setValue(this.monthlyType)
          .onChange((value) => {
            this.monthlyType = value as 'dayOfMonth' | 'nthWeekday';
            this.updateMonthlyTypeFields();
            this.refreshPreview();
          });
      });

    // Day of month (for monthly)
    const byMonthDaySetting = new Setting(contentEl)
      .setName('On day of month')
      .setDesc('Select specific day(s) of the month');
    this.byMonthDayContainer = byMonthDaySetting.controlEl;
    this.createMonthDaySelector();

    // Nth weekday selector (for monthly)
    this.nthWeekdaySetting = new Setting(contentEl)
      .setName('On the')
      .setDesc('Select which occurrence and day of the week');
    this.createNthWeekdaySelector();

    // End condition
    contentEl.createEl('h3', { text: 'End' });

    new Setting(contentEl).setName('Ends').addDropdown((dropdown) => {
      dropdown
        .addOption('never', 'Never')
        .addOption('count', 'After number of occurrences')
        .addOption('until', 'On date')
        .setValue(this.endType)
        .onChange((value) => {
          this.endType = value as 'never' | 'count' | 'until';
          this.updateEndFields();
        });
    });

    // End after count
    this.endCountSetting = new Setting(contentEl)
      .setName('Occurrences')
      .addText((text) => {
        text
          .setPlaceholder('10')
          .setValue(this.count?.toString() || '')
          .onChange((value) => {
            this.count = parseInt(value) || undefined;
          });
        text.inputEl.type = 'number';
        text.inputEl.min = '1';
        text.inputEl.addClass('planner-input-narrow');
      });

    // End until date
    this.endUntilSetting = new Setting(contentEl).setName('End date').addText((text) => {
      text.setValue(this.until).onChange((value) => {
        this.until = value;
      });
      text.inputEl.type = 'date';
    });

    // Preview
    const previewEl = contentEl.createDiv({ cls: 'planner-recurrence-preview' });
    previewEl.createEl('strong', { text: 'Preview: ' });
    this.previewTextEl = previewEl.createSpan({ cls: 'planner-recurrence-preview-text' });
    this.refreshPreview();

    // Initial visibility updates
    this.updateFrequencySpecificFields();
    this.updateMonthlyTypeFields();
    this.updateEndFields();

    // Buttons
    const buttonContainer = contentEl.createDiv({ cls: 'planner-modal-buttons' });

    const cancelBtn = buttonContainer.createEl('button', {
      text: 'Cancel',
      cls: 'planner-btn',
    });
    cancelBtn.addEventListener('click', () => this.close());

    const clearBtn = buttonContainer.createEl('button', {
      text: 'Clear',
      cls: 'planner-btn',
    });
    clearBtn.addEventListener('click', () => {
      this.onSubmit(null);
      this.close();
    });

    const saveBtn = buttonContainer.createEl('button', {
      text: 'Save',
      cls: 'planner-btn planner-btn-primary',
    });
    saveBtn.addEventListener('click', () => {
      this.onSubmit(this.buildResult());
      this.close();
    });
  }

  private createDaysOfWeekCheckboxes(): void {
    if (!this.byDayContainer) return;
    this.byDayContainer.empty();

    const container = this.byDayContainer.createDiv({ cls: 'planner-days-checkboxes' });

    DAYS_OF_WEEK.forEach((day) => {
      const label = container.createEl('label', { cls: 'planner-day-checkbox' });
      const checkbox = label.createEl('input', { type: 'checkbox' });
      checkbox.checked = this.byDay.has(day.key);
      checkbox.addEventListener('change', () => {
        if (checkbox.checked) {
          this.byDay.add(day.key);
        } else {
          this.byDay.delete(day.key);
        }
      });
      label.createSpan({ text: day.short });
    });
  }

  private createMonthDaySelector(): void {
    if (!this.byMonthDayContainer) return;
    this.byMonthDayContainer.empty();

    const container = this.byMonthDayContainer.createDiv({ cls: 'planner-monthday-selector' });

    // Simple text input for now - could be enhanced with a grid picker
    const input = container.createEl('input', {
      type: 'text',
      placeholder: 'e.g., 1, 15, -1 (last day)',
      cls: 'planner-monthday-input',
    });
    input.value = this.byMonthDay.join(', ');
    input.addEventListener('change', () => {
      this.byMonthDay = input.value
        .split(',')
        .map((s) => parseInt(s.trim()))
        .filter((n) => !isNaN(n));
      this.refreshPreview();
    });
  }

  private createNthWeekdaySelector(): void {
    if (!this.nthWeekdaySetting) return;
    const controlEl = this.nthWeekdaySetting.controlEl;
    controlEl.empty();

    const container = controlEl.createDiv({ cls: 'planner-nth-weekday-selector' });

    // Position dropdown (First, Second, Third, Fourth, Last)
    const posSelect = container.createEl('select', { cls: 'planner-nth-position-select' });
    POSITION_OPTIONS.forEach((opt) => {
      const option = posSelect.createEl('option', { text: opt.label, value: opt.value.toString() });
      if (opt.value === this.nthWeekdayPos) {
        option.selected = true;
      }
    });
    posSelect.addEventListener('change', () => {
      this.nthWeekdayPos = parseInt(posSelect.value);
      this.refreshPreview();
    });

    // Day of week dropdown
    const daySelect = container.createEl('select', { cls: 'planner-nth-day-select' });
    DAYS_OF_WEEK.forEach((day) => {
      const option = daySelect.createEl('option', { text: day.label, value: day.key });
      if (day.key === this.nthWeekdayDay) {
        option.selected = true;
      }
    });
    daySelect.addEventListener('change', () => {
      this.nthWeekdayDay = daySelect.value as DayOfWeek;
      this.refreshPreview();
    });
  }

  private updateFrequencySpecificFields(): void {
    // Show/hide days of week (weekly only)
    if (this.byDayContainer) {
      const byDaySetting = this.byDayContainer.closest('.setting-item') as HTMLElement;
      if (byDaySetting) {
        byDaySetting.toggleClass('planner-hidden', this.frequency !== 'weekly');
      }
    }

    // Show/hide monthly type toggle (monthly only)
    if (this.monthlyTypeSetting) {
      this.monthlyTypeSetting.settingEl.toggleClass('planner-hidden', this.frequency !== 'monthly');
    }

    // Show/hide day of month and nth weekday based on frequency and monthly type
    this.updateMonthlyTypeFields();

    // Update interval unit label
    const unitLabel = this.contentEl.querySelector('.planner-interval-unit');
    if (unitLabel) {
      unitLabel.textContent = this.getIntervalUnitLabel();
    }

    this.refreshPreview();
  }

  private updateMonthlyTypeFields(): void {
    const isMonthly = this.frequency === 'monthly';

    // Show/hide day of month selector
    if (this.byMonthDayContainer) {
      const byMonthDaySetting = this.byMonthDayContainer.closest('.setting-item') as HTMLElement;
      if (byMonthDaySetting) {
        byMonthDaySetting.toggleClass('planner-hidden', !(isMonthly && this.monthlyType === 'dayOfMonth'));
      }
    }

    // Show/hide nth weekday selector
    if (this.nthWeekdaySetting) {
      this.nthWeekdaySetting.settingEl.toggleClass('planner-hidden', !(isMonthly && this.monthlyType === 'nthWeekday'));
    }
  }

  private refreshPreview(): void {
    if (this.previewTextEl) {
      this.updatePreview(this.previewTextEl);
    }
  }

  private updateEndFields(): void {
    if (this.endCountSetting) {
      this.endCountSetting.settingEl.toggleClass('planner-hidden', this.endType !== 'count');
    }
    if (this.endUntilSetting) {
      this.endUntilSetting.settingEl.toggleClass('planner-hidden', this.endType !== 'until');
    }
  }

  private getIntervalUnitLabel(): string {
    const units: Record<RepeatFrequency, string> = {
      daily: 'day(s)',
      weekly: 'week(s)',
      monthly: 'month(s)',
      yearly: 'year(s)',
    };
    return units[this.frequency];
  }

  private updatePreview(element: HTMLElement): void {
    // Build a human-readable preview
    const parts: string[] = [];

    if (this.interval === 1) {
      parts.push(this.frequency.charAt(0).toUpperCase() + this.frequency.slice(1));
    } else {
      parts.push(`Every ${this.interval} ${this.getIntervalUnitLabel()}`);
    }

    if (this.frequency === 'weekly' && this.byDay.size > 0) {
      const days = Array.from(this.byDay)
        .map((d) => DAYS_OF_WEEK.find((day) => day.key === d)?.short)
        .filter(Boolean);
      parts.push(`on ${days.join(', ')}`);
    }

    if (this.frequency === 'monthly') {
      if (this.monthlyType === 'nthWeekday') {
        const posLabel =
          POSITION_OPTIONS.find((p) => p.value === this.nthWeekdayPos)?.label.toLowerCase() ||
          'first';
        const dayLabel = DAYS_OF_WEEK.find((d) => d.key === this.nthWeekdayDay)?.label || 'Monday';
        parts.push(`on the ${posLabel} ${dayLabel}`);
      } else if (this.byMonthDay.length > 0) {
        parts.push(`on day ${this.byMonthDay.join(', ')}`);
      }
    }

    if (this.endType === 'count' && this.count) {
      parts.push(`for ${this.count} occurrences`);
    } else if (this.endType === 'until' && this.until) {
      parts.push(`until ${this.until}`);
    }

    element.textContent = parts.join(' ');
  }

  private buildResult(): RecurrenceData {
    const result: RecurrenceData = {
      repeat_frequency: this.frequency,
      repeat_interval: this.interval,
    };

    if (this.frequency === 'weekly' && this.byDay.size > 0) {
      result.repeat_byday = Array.from(this.byDay);
    }

    if (this.frequency === 'monthly') {
      if (this.monthlyType === 'nthWeekday') {
        // Nth weekday of month (e.g., second Sunday)
        result.repeat_byday = [this.nthWeekdayDay];
        result.repeat_bysetpos = this.nthWeekdayPos;
      } else if (this.byMonthDay.length > 0) {
        // Specific day(s) of month
        result.repeat_bymonthday = this.byMonthDay;
      }
    }

    if (this.endType === 'count' && this.count) {
      result.repeat_count = this.count;
    } else if (this.endType === 'until' && this.until) {
      result.repeat_until = new Date(this.until).toISOString();
    }

    return result;
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
