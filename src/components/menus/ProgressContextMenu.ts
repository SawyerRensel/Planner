import { Menu } from 'obsidian';

export interface ProgressContextMenuOptions {
  currentValue: number | null;
  totalValue: number | null;
  onSelect: (current: number) => void;
  onAdjust: (delta: number) => void;  // Pass delta for +/-10% operations
  onCustom: () => void;
  onClear: () => void;  // Clear progress (set to null, not 0)
}

/**
 * Context menu for quickly updating progress_current value.
 * Shows preset percentages and a stepper for fine control.
 */
export class ProgressContextMenu {
  private menu: Menu;
  private options: ProgressContextMenuOptions;

  constructor(options: ProgressContextMenuOptions) {
    this.menu = new Menu();
    this.options = options;
    this.buildMenu();
  }

  private buildMenu(): void {
    const { currentValue, totalValue, onSelect, onAdjust, onCustom, onClear } = this.options;
    const total = totalValue ?? 100;
    const current = currentValue ?? 0;
    const percentage = total > 0 ? Math.round((current / total) * 100) : 0;

    // Preset percentages (no icons)
    const presets = [
      { label: '0%', value: 0 },
      { label: '25%', value: 25 },
      { label: '50%', value: 50 },
      { label: '75%', value: 75 },
      { label: '100%', value: 100 },
    ];

    presets.forEach((preset) => {
      const targetValue = Math.round((preset.value / 100) * total);
      const isSelected = percentage === preset.value;

      this.menu.addItem((item) => {
        item.setTitle(isSelected ? `✓ ${preset.label}` : preset.label);
        item.onClick(() => {
          onSelect(targetValue);
        });
      });
    });

    // Separator
    this.menu.addSeparator();

    // Fine control: -10% (passes delta, ItemModal calculates from current state)
    this.menu.addItem((item) => {
      item.setTitle('−10%');
      item.setIcon('minus');
      item.onClick(() => {
        onAdjust(-10);
      });
    });

    // Fine control: +10% (passes delta, ItemModal calculates from current state)
    this.menu.addItem((item) => {
      item.setTitle('+10%');
      item.setIcon('plus');
      item.onClick(() => {
        onAdjust(10);
      });
    });

    // Separator
    this.menu.addSeparator();

    // Custom progress
    this.menu.addItem((item) => {
      item.setTitle('Custom progress...');
      item.setIcon('pencil');
      item.onClick(() => {
        onCustom();
      });
    });

    // Clear progress (sets to null, not 0)
    this.menu.addItem((item) => {
      item.setTitle('Clear progress');
      item.setIcon('x');
      item.onClick(() => {
        onClear();
      });
    });
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
