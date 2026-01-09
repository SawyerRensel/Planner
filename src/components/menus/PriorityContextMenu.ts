import { Menu } from 'obsidian';
import type PlannerPlugin from '../../main';

export interface PriorityContextMenuOptions {
  currentValue: string | null;
  onSelect: (value: string | null) => void;
  plugin: PlannerPlugin;
}

export class PriorityContextMenu {
  private menu: Menu;
  private options: PriorityContextMenuOptions;

  constructor(options: PriorityContextMenuOptions) {
    this.menu = new Menu();
    this.options = options;
    this.buildMenu();
  }

  private buildMenu(): void {
    const priorities = this.options.plugin.settings.priorities;

    // Sort by weight (higher weight = more important, shown first)
    const sortedPriorities = [...priorities].sort((a, b) => b.weight - a.weight);

    sortedPriorities.forEach((priority) => {
      const isSelected = priority.name === this.options.currentValue;

      this.menu.addItem((item) => {
        item.setTitle(isSelected ? `✓ ${priority.name}` : priority.name);
        // Use custom icon if set, otherwise fall back to default
        const icon = priority.icon || 'star';
        item.setIcon(icon);
        item.onClick(() => {
          this.options.onSelect(priority.name);
        });
      });
    });

    // Add "Clear priority" option
    this.menu.addSeparator();
    this.menu.addItem((item) => {
      item.setTitle('Clear priority');
      item.setIcon('x');
      item.onClick(() => {
        this.options.onSelect(null);
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
    const priorities = this.options.plugin.settings.priorities;
    const sortedPriorities = [...priorities].sort((a, b) => b.weight - a.weight);
    // Get all menus and select the last one (most recently added)
    const menus = document.querySelectorAll('.menu');
    const menuEl = menus[menus.length - 1];

    if (!menuEl) return;

    const menuItems = menuEl.querySelectorAll('.menu-item');

    sortedPriorities.forEach((priority, index) => {
      const menuItem = menuItems[index] as HTMLElement;
      if (menuItem && priority.color) {
        const iconEl = menuItem.querySelector('.menu-item-icon') as HTMLElement;
        if (iconEl) {
          iconEl.style.color = priority.color;
        }
      }
    });
  }
}
