import {
  BasesView,
  BasesViewRegistration,
  BasesEntry,
  QueryController,
} from 'obsidian';
import { Calendar, EventInput, EventClickArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type PlannerPlugin from '../main';

export const BASES_CALENDAR_VIEW_ID = 'planner-calendar';

type CalendarViewType = 'dayGridMonth' | 'dayGridYear' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';

/**
 * Calendar view for Obsidian Bases
 * Displays items on a full calendar
 */
export class BasesCalendarView extends BasesView {
  type = BASES_CALENDAR_VIEW_ID;
  private plugin: PlannerPlugin;
  private containerEl: HTMLElement;
  private calendar: Calendar | null = null;
  private currentView: CalendarViewType = 'dayGridMonth';

  constructor(
    controller: QueryController,
    containerEl: HTMLElement,
    plugin: PlannerPlugin
  ) {
    super(controller);
    this.plugin = plugin;
    this.containerEl = containerEl;
  }

  /**
   * Called when data changes - re-render the calendar
   */
  onDataUpdated(): void {
    this.render();
  }

  onunload(): void {
    if (this.calendar) {
      this.calendar.destroy();
      this.calendar = null;
    }
  }

  private render(): void {
    // Preserve current view and date if calendar exists
    let currentDate: Date | undefined;
    if (this.calendar) {
      currentDate = this.calendar.getDate();
      this.calendar.destroy();
    }

    this.containerEl.empty();
    this.containerEl.addClass('planner-bases-calendar');

    // Toolbar
    const toolbar = this.containerEl.createDiv({ cls: 'planner-calendar-toolbar' });
    this.renderToolbar(toolbar);

    // Calendar container
    const calendarEl = this.containerEl.createDiv({ cls: 'planner-calendar-container' });

    this.initCalendar(calendarEl, currentDate);
  }

  private renderToolbar(toolbar: HTMLElement): void {
    // View selector
    const viewSelector = toolbar.createDiv({ cls: 'planner-view-selector' });

    const views: { type: CalendarViewType; label: string; icon: string }[] = [
      { type: 'dayGridYear', label: 'Year', icon: 'Y' },
      { type: 'dayGridMonth', label: 'Month', icon: 'M' },
      { type: 'timeGridWeek', label: 'Week', icon: 'W' },
      { type: 'timeGridDay', label: 'Day', icon: 'D' },
      { type: 'listWeek', label: 'List', icon: 'L' },
    ];

    for (const view of views) {
      const btn = viewSelector.createEl('button', {
        cls: `planner-view-btn ${this.currentView === view.type ? 'active' : ''}`,
        text: view.icon,
        attr: { title: view.label }
      });
      btn.addEventListener('click', () => {
        this.currentView = view.type;
        if (this.calendar) {
          this.calendar.changeView(view.type);
        }
        // Update button states
        viewSelector.querySelectorAll('.planner-view-btn').forEach(b => b.removeClass('active'));
        btn.addClass('active');
      });
    }
  }

  private initCalendar(containerEl: HTMLElement, initialDate?: Date): void {
    const weekStartsOn = this.getWeekStartDay();
    const events = this.getEventsFromData();

    this.calendar = new Calendar(containerEl, {
      plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
      initialView: this.currentView,
      initialDate: initialDate,
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: '',
      },
      firstDay: weekStartsOn,
      selectable: true,
      editable: true,
      events: events,
      eventClick: (info) => this.handleEventClick(info),
      eventDrop: (info) => this.handleEventDrop(info),
      height: '100%',
      nowIndicator: true,
      dayMaxEvents: true,
    });

    this.calendar.render();
  }

  private getEventsFromData(): EventInput[] {
    const events: EventInput[] = [];
    const colorByProp = this.config.get('colorBy') as string || 'note.calendar';

    for (const group of this.data.groupedData) {
      for (const entry of group.entries) {
        const event = this.entryToEvent(entry, colorByProp);
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

    // Update the file's frontmatter
    await this.app.fileManager.processFrontMatter(entry.file, (fm) => {
      fm.date_start = newStart.toISOString();
      fm.date_modified = new Date().toISOString();
    });
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
        id: 'colorBy',
        name: 'Color by',
        description: 'Which property to use for event colors',
        defaultValue: 'note.calendar',
        options: [
          { value: 'note.calendar', label: 'Calendar' },
          { value: 'note.priority', label: 'Priority' },
          { value: 'note.status', label: 'Status' },
        ],
      },
    ],
  };
}
