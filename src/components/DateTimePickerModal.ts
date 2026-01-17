import { Modal, Setting, Platform } from 'obsidian';
import type PlannerPlugin from '../main';

export interface DateTimePickerOptions {
  currentDate?: string | null;
  currentTime?: string | null;
  title?: string;
  onSelect: (isoDateTime: string | null) => void;
}

/**
 * Modal for picking date and time using Obsidian's native Modal class.
 * This approach works correctly on iOS where raw DOM date/time inputs
 * have issues with native picker dismissal.
 */
export class DateTimePickerModal extends Modal {
  private options: DateTimePickerOptions;
  private plugin: PlannerPlugin;
  private dateInput!: HTMLInputElement;
  private timeInput!: HTMLInputElement;

  constructor(plugin: PlannerPlugin, options: DateTimePickerOptions) {
    super(plugin.app);
    this.plugin = plugin;
    this.options = options;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('planner-datetime-picker-modal');

    // Title
    contentEl.createEl('h3', {
      text: this.options.title || 'Pick date & time',
      cls: 'planner-datetime-picker-title'
    });

    // Date input using Setting API
    new Setting(contentEl)
      .setName('Date')
      .addText((text) => {
        this.dateInput = text.inputEl;
        this.dateInput.type = 'date';
        this.dateInput.addClass('planner-date-input');
        if (this.options.currentDate) {
          this.dateInput.value = this.options.currentDate;
        } else {
          // Default to today
          this.dateInput.value = this.formatDateForInput(new Date());
        }
      });

    // Time input using Setting API
    new Setting(contentEl)
      .setName('Time (optional)')
      .addText((text) => {
        this.timeInput = text.inputEl;
        this.timeInput.type = 'time';
        this.timeInput.addClass('planner-time-input');
        if (this.options.currentTime) {
          this.timeInput.value = this.options.currentTime;
        }
      });

    // Quick action buttons
    const quickActionsContainer = contentEl.createDiv({ cls: 'planner-datetime-quick-actions' });

    const resetBtn = quickActionsContainer.createEl('button', {
      text: 'Reset',
      cls: 'planner-btn'
    });
    resetBtn.addEventListener('click', () => {
      this.dateInput.value = this.formatDateForInput(new Date());
      this.timeInput.value = '';
    });

    // Buttons container
    const buttonsContainer = contentEl.createDiv({ cls: 'planner-datetime-buttons' });

    const cancelBtn = buttonsContainer.createEl('button', {
      text: 'Cancel',
      cls: 'planner-btn'
    });
    cancelBtn.addEventListener('click', () => {
      this.close();
    });

    const confirmBtn = buttonsContainer.createEl('button', {
      text: 'Done',
      cls: 'planner-btn planner-btn-primary'
    });
    confirmBtn.addEventListener('click', () => {
      this.handleConfirm();
    });

    // Handle Enter key on inputs
    const handleEnter = (e: KeyboardEvent) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleConfirm();
      }
    };
    this.dateInput.addEventListener('keydown', handleEnter);
    this.timeInput.addEventListener('keydown', handleEnter);

    // Only auto-focus on desktop - iOS has issues with focus stealing
    // that causes native pickers to close immediately
    if (!Platform.isMobile) {
      setTimeout(() => {
        this.dateInput.focus();
      }, 100);
    }
  }

  private handleConfirm(): void {
    if (this.dateInput.value) {
      let dateStr = this.dateInput.value;
      if (this.timeInput.value) {
        dateStr += `T${this.timeInput.value}:00`;
      } else {
        dateStr += 'T00:00:00';
      }
      this.options.onSelect(new Date(dateStr).toISOString());
    }
    this.close();
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

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
