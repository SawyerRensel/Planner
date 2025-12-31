import {
  BasesView,
  BasesViewRegistration,
  BasesEntry,
  QueryController,
} from 'obsidian';
import { Calendar, EventInput, EventClickArg, DateSelectArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import multiMonthPlugin from '@fullcalendar/multimonth';
import type PlannerPlugin from '../main';

export const BASES_CALENDAR_VIEW_ID = 'planner-calendar';

type CalendarViewType = 'multiMonthYear' | 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';

/**
 * Calendar view for Obsidian Bases
 * Displays items on a full calendar using FullCalendar's built-in headerToolbar
 */
export class BasesCalendarView extends BasesView {
  type = BASES_CALENDAR_VIEW_ID;
  private plugin: PlannerPlugin;
  private containerEl: HTMLElement;
  private calendarEl: HTMLElement | null = null;
  private calendar: Calendar | null = null;
  private currentView: CalendarViewType = 'dayGridMonth';
  private colorByField: 'note.calendar' | 'note.priority' | 'note.status' = 'note.calendar';
  private resizeObserver: ResizeObserver | null = null;

  constructor(
    controller: QueryController,
    containerEl: HTMLElement,
    plugin: PlannerPlugin
  ) {
    super(controller);
    this.plugin = plugin;
    this.containerEl = containerEl;
    this.setupContainer();
    this.setupResizeObserver();
  }

  private setupContainer(): void {
    this.containerEl.empty();
    this.containerEl.addClass('planner-bases-calendar');
    this.containerEl.style.cssText = 'height: 100%; display: flex; flex-direction: column;';

    // Single calendar element - no separate toolbar
    this.calendarEl = this.containerEl.createDiv({ cls: 'planner-calendar-container' });
    this.calendarEl.style.cssText = 'flex: 1; min-height: 500px; overflow: auto;';
  }

  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver(() => {
      if (this.calendar) {
        this.calendar.updateSize();
      }
    });
    this.resizeObserver.observe(this.containerEl);
  }

  /**
   * Called when data changes - re-render the calendar
   */
  onDataUpdated(): void {
    this.render();
  }

  onunload(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    if (this.calendar) {
      this.calendar.destroy();
      this.calendar = null;
    }
  }

  private render(): void {
    // Preserve current view and date if calendar exists
    let currentDate: Date | undefined;
    let currentViewType: CalendarViewType | undefined;
    if (this.calendar) {
      currentDate = this.calendar.getDate();
      currentViewType = this.calendar.view?.type as CalendarViewType;
      this.calendar.destroy();
      this.calendar = null;
    }

    // Re-setup the container if needed
    if (!this.calendarEl || !this.calendarEl.isConnected) {
      this.setupContainer();
    } else {
      this.calendarEl.empty();
    }

    if (this.calendarEl) {
      this.initCalendar(currentDate, currentViewType);
    }
  }

  private initCalendar(initialDate?: Date, initialView?: CalendarViewType): void {
    if (!this.calendarEl) return;

    const weekStartsOn = this.getWeekStartDay();
    const events = this.getEventsFromData();

    this.calendar = new Calendar(this.calendarEl, {
      plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, multiMonthPlugin],
      initialView: initialView || this.currentView,
      initialDate: initialDate,
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: 'multiMonthYear,dayGridMonth,timeGridWeek,timeGridDay,listWeek,newItemButton',
      },
      buttonText: {
        today: 'Today',
        month: 'Month',
        week: 'Week',
        day: 'Day',
        year: 'Year',
        list: 'List',
      },
      customButtons: {
        newItemButton: {
          text: '+ New',
          hint: 'Create new item',
          click: () => this.createNewItem(),
        },
      },
      firstDay: weekStartsOn,
      selectable: true,
      editable: true,
      eventStartEditable: true,
      eventDurationEditable: true,
      events: events,
      eventClick: (info) => this.handleEventClick(info),
      eventDrop: (info) => this.handleEventDrop(info),
      eventResize: (info) => this.handleEventResize(info),
      select: (info) => this.handleDateSelect(info),
      viewDidMount: (arg) => {
        // Track view type changes
        const newViewType = arg.view.type as CalendarViewType;
        if (newViewType) {
          this.currentView = newViewType;
        }
      },
      height: '100%',
      expandRows: true,
      handleWindowResize: true,
      nowIndicator: true,
      dayMaxEvents: true,
    });

    this.calendar.render();
  }

  private getEventsFromData(): EventInput[] {
    const events: EventInput[] = [];

    for (const group of this.data.groupedData) {
      for (const entry of group.entries) {
        const event = this.entryToEvent(entry, this.colorByField);
        if (event) {
          events.push(event);
        }
      }
    }

    return events;
  }

  private entryToEvent(entry: BasesEntry, colorByProp: string): EventInput | null {
    // Get date fields
    const dateStart = entry.getValue('note.date_start' as any);
    const dateDue = entry.getValue('note.date_due' as any);
    const dateEnd = entry.getValue('note.date_end' as any);
    const allDay = entry.getValue('note.all_day' as any);

    // Must have at least one date
    const startDate = dateStart || dateDue;
    if (!startDate) return null;

    // Get title
    const title = entry.getValue('note.title' as any) ||
                  entry.file.basename ||
                  'Untitled';

    // Get color
    const color = this.getEntryColor(entry, colorByProp);

    return {
      id: entry.file.path,
      title: String(title),
      start: String(startDate),
      end: dateEnd ? String(dateEnd) : undefined,
      allDay: allDay === true || !this.hasTime(String(startDate)),
      backgroundColor: color,
      borderColor: color,
      textColor: this.getContrastColor(color),
      extendedProps: {
        entry,
      },
    };
  }

  private getEntryColor(entry: BasesEntry, colorByProp: string): string {
    const value = entry.getValue(colorByProp as any);

    if (!value) return '#6b7280';

    const propName = colorByProp.split('.')[1];

    if (propName === 'calendar') {
      const calendarName = Array.isArray(value) ? value[0] : String(value);
      return this.plugin.settings.calendarColors[calendarName] ?? '#6b7280';
    }

    if (propName === 'priority') {
      const priority = this.plugin.settings.priorities.find(p => p.name === String(value));
      return priority?.color ?? '#6b7280';
    }

    if (propName === 'status') {
      const status = this.plugin.settings.statuses.find(s => s.name === String(value));
      return status?.color ?? '#6b7280';
    }

    return '#6b7280';
  }

  private hasTime(dateStr: string): boolean {
    return dateStr.includes('T') && !dateStr.endsWith('T00:00:00');
  }

  private getWeekStartDay(): number {
    const dayMap: Record<string, number> = {
      sunday: 0,
      monday: 1,
      tuesday: 2,
      wednesday: 3,
      thursday: 4,
      friday: 5,
      saturday: 6,
    };
    return dayMap[this.plugin.settings.weekStartsOn] ?? 1;
  }

  private getContrastColor(hexColor: string): string {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  private handleEventClick(info: EventClickArg): void {
    const entry = info.event.extendedProps.entry as BasesEntry;
    this.app.workspace.openLinkText(entry.file.path, '', false);
  }

  private async handleEventDrop(info: any): Promise<void> {
    const entry = info.event.extendedProps.entry as BasesEntry;
    const newStart = info.event.start;
    const newEnd = info.event.end;

    // Update the file's frontmatter - preserve duration by updating both start and end
    await this.app.fileManager.processFrontMatter(entry.file, (fm) => {
      // Check if this item uses date_start or date_due as the primary date
      const hasDateStart = fm.date_start !== undefined;
      const hasDateDue = fm.date_due !== undefined && !hasDateStart;

      if (hasDateDue) {
        // Item uses date_due as primary, update it
        fm.date_due = newStart.toISOString();
      } else {
        // Item uses date_start, update both start and end
        fm.date_start = newStart.toISOString();
        if (newEnd) {
          fm.date_end = newEnd.toISOString();
        }
      }
      fm.date_modified = new Date().toISOString();
    });
  }

  private async handleEventResize(info: any): Promise<void> {
    const entry = info.event.extendedProps.entry as BasesEntry;
    const newStart = info.event.start;
    const newEnd = info.event.end;

    // Update the file's frontmatter with new start/end times
    await this.app.fileManager.processFrontMatter(entry.file, (fm) => {
      if (newStart) {
        fm.date_start = newStart.toISOString();
      }
      if (newEnd) {
        fm.date_end = newEnd.toISOString();
      }
      fm.date_modified = new Date().toISOString();
    });
  }

  private handleDateSelect(info: DateSelectArg): void {
    // Create new item on the selected date
    this.createNewItem(info.startStr, info.endStr, info.allDay);
  }

  private async createNewItem(startDate?: string, endDate?: string, allDay?: boolean): Promise<void> {
    const title = 'New Item';
    const now = new Date().toISOString();

    const item = await this.plugin.itemService.createItem(title, {
      title,
      tags: ['event'],
      date_start: startDate || now,
      date_end: endDate || undefined,
      all_day: allDay ?? false,
    });

    if (item) {
      await this.app.workspace.openLinkText(item.path, '', false);
    }
  }
}

/**
 * Create the Bases view registration for the Calendar
 */
export function createCalendarViewRegistration(plugin: PlannerPlugin): BasesViewRegistration {
  return {
    name: 'Calendar',
    icon: 'calendar',
    factory: (controller: QueryController, containerEl: HTMLElement) => {
      return new BasesCalendarView(controller, containerEl, plugin);
    },
    options: () => [
      {
        type: 'dropdown',
        key: 'colorBy',
        displayName: 'Color by',
        default: 'note.calendar',
        options: {
          'note.calendar': 'Calendar',
          'note.priority': 'Priority',
          'note.status': 'Status',
        },
      },
    ],
  };
}
