import { Menu } from 'obsidian';
import type PlannerPlugin from '../../main';

export interface StatusContextMenuOptions {
  currentValue: string | null;
  onSelect: (value: string) => void;
  plugin: PlannerPlugin;
}

export class StatusContextMenu {
  private menu: Menu;
  private options: StatusContextMenuOptions;

  constructor(options: StatusContextMenuOptions) {
    this.menu = new Menu();
    this.options = options;
    this.buildMenu();
  }

  private buildMenu(): void {
    const statuses = this.options.plugin.settings.statuses;

    statuses.forEach((status) => {
      const isSelected = status.name === this.options.currentValue;

      this.menu.addItem((item) => {
        item.setTitle(isSelected ? `✓ ${status.name}` : status.name);
        // Use custom icon if set, otherwise fall back to default
        const icon = status.icon || (status.isCompleted ? 'check-circle' : 'circle');
        item.setIcon(icon);
        item.onClick(() => {
          this.options.onSelect(status.name);
        });
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

    // Apply color styling after menu is shown
    setTimeout(() => this.applyColorStyling(), 10);
  }

  public showAtElement(element: HTMLElement): void {
    const rect = element.getBoundingClientRect();
    this.menu.showAtPosition({ x: rect.left, y: rect.bottom + 4 });
    setTimeout(() => this.applyColorStyling(), 10);
  }

  private applyColorStyling(): void {
    const statuses = this.options.plugin.settings.statuses;
    const menuEl = document.querySelector('.menu:last-of-type');

    if (!menuEl) return;

    const menuItems = menuEl.querySelectorAll('.menu-item');

    statuses.forEach((status, index) => {
      const menuItem = menuItems[index] as HTMLElement;
      if (menuItem && status.color) {
        const iconEl = menuItem.querySelector('.menu-item-icon') as HTMLElement;
        if (iconEl) {
          iconEl.style.color = status.color;
        }
      }
    });
  }
}
