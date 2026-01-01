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
  private endType: 'never' | 'count' | 'until' = 'never';
  private count: number | undefined;
  private until: string = '';

  // UI elements for dynamic updates
  private byDayContainer: HTMLElement | null = null;
  private byMonthDayContainer: HTMLElement | null = null;
  private endCountSetting: Setting | null = null;
  private endUntilSetting: Setting | null = null;

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

    contentEl.createEl('h2', { text: 'Custom Recurrence' });

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
        text.inputEl.style.width = '60px';
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

    // Day of month (for monthly)
    const byMonthDaySetting = new Setting(contentEl)
      .setName('On day of month')
      .setDesc('Select specific day(s) of the month');
    this.byMonthDayContainer = byMonthDaySetting.controlEl;
    this.createMonthDaySelector();

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
        text.inputEl.style.width = '80px';
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
    const previewText = previewEl.createSpan({ cls: 'planner-recurrence-preview-text' });
    this.updatePreview(previewText);

    // Initial visibility updates
    this.updateFrequencySpecificFields();
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
    });
  }

  private updateFrequencySpecificFields(): void {
    // Show/hide days of week (weekly only)
    if (this.byDayContainer) {
      const byDaySetting = this.byDayContainer.closest('.setting-item') as HTMLElement;
      if (byDaySetting) {
        byDaySetting.style.display = this.frequency === 'weekly' ? '' : 'none';
      }
    }

    // Show/hide day of month (monthly only)
    if (this.byMonthDayContainer) {
      const byMonthDaySetting = this.byMonthDayContainer.closest('.setting-item') as HTMLElement;
      if (byMonthDaySetting) {
        byMonthDaySetting.style.display = this.frequency === 'monthly' ? '' : 'none';
      }
    }

    // Update interval unit label
    const unitLabel = this.contentEl.querySelector('.planner-interval-unit');
    if (unitLabel) {
      unitLabel.textContent = this.getIntervalUnitLabel();
    }
  }

  private updateEndFields(): void {
    if (this.endCountSetting) {
      this.endCountSetting.settingEl.style.display = this.endType === 'count' ? '' : 'none';
    }
    if (this.endUntilSetting) {
      this.endUntilSetting.settingEl.style.display = this.endType === 'until' ? '' : 'none';
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

    if (this.frequency === 'monthly' && this.byMonthDay.length > 0) {
      parts.push(`on day ${this.byMonthDay.join(', ')}`);
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

    if (this.frequency === 'monthly' && this.byMonthDay.length > 0) {
      result.repeat_bymonthday = this.byMonthDay;
    }

    if (this.bySetPos !== undefined) {
      result.repeat_bysetpos = this.bySetPos;
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
