import { Modal, Setting } from 'obsidian';
import type PlannerPlugin from '../main';

export interface CustomProgressResult {
  current: number;
  total: number;
}

/**
 * Modal for setting custom progress values.
 * Allows entering either a percentage or a specific current value.
 */
export class CustomProgressModal extends Modal {
  private plugin: PlannerPlugin;
  private currentValue: number;
  private totalValue: number;
  private onSubmit: (result: CustomProgressResult) => void;

  // Input elements
  private percentInput: HTMLInputElement | null = null;
  private currentInput: HTMLInputElement | null = null;
  private totalInput: HTMLInputElement | null = null;

  constructor(
    plugin: PlannerPlugin,
    currentValue: number | null,
    totalValue: number | null,
    onSubmit: (result: CustomProgressResult) => void
  ) {
    super(plugin.app);
    this.plugin = plugin;
    this.currentValue = currentValue ?? 0;
    this.totalValue = totalValue ?? 100;
    this.onSubmit = onSubmit;
  }

  onOpen(): void {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('planner-custom-progress-modal');

    contentEl.createEl('h3', { text: 'Set progress' });

    const currentPercent = this.totalValue > 0
      ? Math.round((this.currentValue / this.totalValue) * 100)
      : 0;

    // Percentage input
    new Setting(contentEl)
      .setName('Percentage')
      .setDesc('Enter a percentage (0-100)')
      .addText((text) => {
        this.percentInput = text.inputEl;
        text.inputEl.type = 'number';
        text.inputEl.min = '0';
        text.inputEl.max = '100';
        text.inputEl.step = '1';
        text.setValue(String(currentPercent));
        text.inputEl.addEventListener('input', () => {
          this.onPercentChange();
        });
      });

    // Separator
    contentEl.createEl('div', {
      cls: 'planner-progress-separator',
      text: '— or —',
    });

    // Current value input
    new Setting(contentEl)
      .setName('Current value')
      .setDesc('The progress_current value')
      .addText((text) => {
        this.currentInput = text.inputEl;
        text.inputEl.type = 'number';
        text.inputEl.min = '0';
        text.inputEl.step = '1';
        text.setValue(String(this.currentValue));
        text.inputEl.addEventListener('input', () => {
          this.onCurrentChange();
        });
      });

    // Total value input
    new Setting(contentEl)
      .setName('Total value')
      .setDesc('The progress_total value (default: 100)')
      .addText((text) => {
        this.totalInput = text.inputEl;
        text.inputEl.type = 'number';
        text.inputEl.min = '1';
        text.inputEl.step = '1';
        text.setValue(String(this.totalValue));
        text.inputEl.addEventListener('input', () => {
          this.onTotalChange();
        });
      });

    // Buttons
    const buttonContainer = contentEl.createDiv({ cls: 'planner-modal-buttons' });

    const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => this.close());

    const saveBtn = buttonContainer.createEl('button', {
      text: 'Save',
      cls: 'mod-cta',
    });
    saveBtn.addEventListener('click', () => this.handleSave());

    // Focus the percent input
    setTimeout(() => {
      this.percentInput?.focus();
      this.percentInput?.select();
    }, 10);
  }

  private onPercentChange(): void {
    if (!this.percentInput || !this.currentInput || !this.totalInput) return;

    const percent = parseInt(this.percentInput.value) || 0;
    const total = parseInt(this.totalInput.value) || 100;
    const newCurrent = Math.round((percent / 100) * total);

    this.currentInput.value = String(newCurrent);
    this.currentValue = newCurrent;
    this.totalValue = total;
  }

  private onCurrentChange(): void {
    if (!this.percentInput || !this.currentInput || !this.totalInput) return;

    const current = parseInt(this.currentInput.value) || 0;
    const total = parseInt(this.totalInput.value) || 100;
    const newPercent = total > 0 ? Math.round((current / total) * 100) : 0;

    this.percentInput.value = String(newPercent);
    this.currentValue = current;
    this.totalValue = total;
  }

  private onTotalChange(): void {
    if (!this.percentInput || !this.currentInput || !this.totalInput) return;

    const current = parseInt(this.currentInput.value) || 0;
    const total = parseInt(this.totalInput.value) || 100;
    const newPercent = total > 0 ? Math.round((current / total) * 100) : 0;

    this.percentInput.value = String(newPercent);
    this.currentValue = current;
    this.totalValue = total;
  }

  private handleSave(): void {
    const current = parseInt(this.currentInput?.value || '0') || 0;
    const total = parseInt(this.totalInput?.value || '100') || 100;

    this.onSubmit({
      current: Math.max(0, current),
      total: Math.max(1, total),
    });
    this.close();
  }

  onClose(): void {
    const { contentEl } = this;
    contentEl.empty();
  }
}
