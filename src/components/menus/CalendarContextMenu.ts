import { Menu } from 'obsidian';
import type PlannerPlugin from '../../main';

export interface CalendarContextMenuOptions {
  currentValue: string[] | null;
  onSelect: (value: string[]) => void;
  plugin: PlannerPlugin;
  allowMultiple?: boolean;
}

export class CalendarContextMenu {
  private menu: Menu;
  private options: CalendarContextMenuOptions;
  private selectedCalendars: Set<string>;

  constructor(options: CalendarContextMenuOptions) {
    this.menu = new Menu();
    this.options = options;
    this.selectedCalendars = new Set(options.currentValue || []);
    this.buildMenu();
  }

  private buildMenu(): void {
    const calendarConfigs = this.options.plugin.settings.calendars;
    const calendars = Object.keys(calendarConfigs);

    // Add default calendar if not in the list
    const defaultCalendar = this.options.plugin.settings.defaultCalendar;
    if (defaultCalendar && !calendars.includes(defaultCalendar)) {
      calendars.unshift(defaultCalendar);
    }

    if (calendars.length === 0) {
      this.menu.addItem((item) => {
        item.setTitle('No calendars configured');
        item.setDisabled(true);
      });
      return;
    }

    calendars.forEach((calendar) => {
      const isSelected = this.selectedCalendars.has(calendar);

      this.menu.addItem((item) => {
        item.setTitle(isSelected ? `✓ ${calendar}` : calendar);
        item.setIcon('calendar');
        item.onClick(() => {
          if (this.options.allowMultiple) {
            // Toggle selection for multi-select
            if (isSelected) {
              this.selectedCalendars.delete(calendar);
            } else {
              this.selectedCalendars.add(calendar);
            }
            this.options.onSelect(Array.from(this.selectedCalendars));
          } else {
            // Single select - replace selection
            this.options.onSelect([calendar]);
          }
        });
      });
    });

    // Clear option
    if (this.selectedCalendars.size > 0) {
      this.menu.addSeparator();
      this.menu.addItem((item) => {
        item.setTitle('Clear calendar');
        item.setIcon('x');
        item.onClick(() => {
          this.options.onSelect([]);
        });
      });
    }
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
    const calendarConfigs = this.options.plugin.settings.calendars;
    const calendars = Object.keys(calendarConfigs);
    const menuEl = document.querySelector('.menu:last-of-type');

    if (!menuEl) return;

    const menuItems = menuEl.querySelectorAll('.menu-item');

    calendars.forEach((calendar, index) => {
      const menuItem = menuItems[index] as HTMLElement;
      const color = calendarConfigs[calendar]?.color;
      if (menuItem && color) {
        const iconEl = menuItem.querySelector('.menu-item-icon') as HTMLElement;
        if (iconEl) {
          iconEl.style.color = color;
        }
      }
    });
  }
}
