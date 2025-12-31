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

type CalendarViewType = 'multiMonthYear' | 'dayGridYear' | 'dayGridMonth' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';

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
  private yearViewSplit: boolean = true; // true = multiMonthYear (split), false = dayGridYear (continuous)

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
        right: 'yearToggleButton,yearButton,monthButton,weekButton,dayButton,listButton,newItemButton',
      },
      customButtons: {
        yearButton: {
          text: 'Y',
          hint: 'Year view',
          click: () => {
            if (this.calendar) {
              const view = this.yearViewSplit ? 'multiMonthYear' : 'dayGridYear';
              this.calendar.changeView(view);
              this.updateYearToggleVisibility(true);
            }
          },
        },
        monthButton: {
          text: 'M',
          hint: 'Month view',
          click: () => {
            if (this.calendar) {
              this.calendar.changeView('dayGridMonth');
              this.updateYearToggleVisibility(false);
            }
          },
        },
        weekButton: {
          text: 'W',
          hint: 'Week view',
          click: () => {
            if (this.calendar) {
              this.calendar.changeView('timeGridWeek');
              this.updateYearToggleVisibility(false);
            }
          },
        },
        dayButton: {
          text: 'D',
          hint: 'Day view',
          click: () => {
            if (this.calendar) {
              this.calendar.changeView('timeGridDay');
              this.updateYearToggleVisibility(false);
            }
          },
        },
        listButton: {
          text: 'L',
          hint: 'List view',
          click: () => {
            if (this.calendar) {
              this.calendar.changeView('listWeek');
              this.updateYearToggleVisibility(false);
            }
          },
        },
        yearToggleButton: {
          text: this.yearViewSplit ? '⧉' : '☰',
          hint: this.yearViewSplit ? 'Switch to continuous scroll' : 'Switch to split by month',
          click: () => this.toggleYearViewMode(),
        },
        newItemButton: {
          text: '+',
          hint: 'Create new item',
          click: () => this.createNewItem(),
        },
      },
      firstDay: weekStartsOn,
      selectable: true,
      editable: true,
      eventStartEditable: true,
      eventDurationEditable: true,
      navLinks: true, // Make day numbers clickable
      navLinkDayClick: (date) => this.openDailyNote(date), // Click on day number opens daily note
      events: events,
      eventClick: (info) => this.handleEventClick(info),
      eventDrop: (info) => this.handleEventDrop(info),
      eventResize: (info) => this.handleEventResize(info),
      select: (info) => this.handleDateSelect(info),
      dayHeaderDidMount: (arg) => {
        // Make day header clickable in day/week views to open daily note
        const el = arg.el;
        el.style.cursor = 'pointer';
        el.addEventListener('click', (e) => {
          // Prevent if clicking on an actual nav link (already handled)
          if ((e.target as HTMLElement).closest('.fc-col-header-cell-cushion')) {
            this.openDailyNote(arg.date);
          }
        });
      },
      viewDidMount: (arg) => {
        // Track view type changes
        const newViewType = arg.view.type as CalendarViewType;
        if (newViewType) {
          this.currentView = newViewType;
        }
        // Update year toggle visibility based on current view
        const isYearView = newViewType === 'multiMonthYear' || newViewType === 'dayGridYear';
        this.updateYearToggleVisibility(isYearView);
      },
      height: '100%',
      expandRows: true,
      handleWindowResize: true,
      nowIndicator: true,
      dayMaxEvents: true,
    });

    this.calendar.render();

    // Inject color-by dropdown into the left toolbar section
    this.injectColorByDropdown();

    // Set initial year toggle visibility
    const isYearView = (initialView || this.currentView) === 'multiMonthYear' ||
                       (initialView || this.currentView) === 'dayGridYear';
    this.updateYearToggleVisibility(isYearView);
  }

  private injectColorByDropdown(): void {
    if (!this.calendarEl) return;

    // Find the left toolbar chunk (contains prev, next, today)
    const leftToolbar = this.calendarEl.querySelector('.fc-toolbar-chunk:first-child');
    if (!leftToolbar) return;

    // Create the color-by container
    const colorByContainer = document.createElement('div');
    colorByContainer.className = 'planner-color-by-container';

    // Create label
    const label = document.createElement('span');
    label.className = 'planner-color-by-label';
    label.textContent = 'Color:';
    colorByContainer.appendChild(label);

    // Create select dropdown
    const select = document.createElement('select');
    select.className = 'planner-color-by-select';

    const options = [
      { value: 'note.calendar', label: 'Calendar' },
      { value: 'note.priority', label: 'Priority' },
      { value: 'note.status', label: 'Status' },
    ];

    for (const opt of options) {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (opt.value === this.colorByField) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      this.colorByField = select.value as typeof this.colorByField;
      // Re-render calendar with new colors
      if (this.calendar) {
        const events = this.getEventsFromData();
        this.calendar.removeAllEvents();
        this.calendar.addEventSource(events);
      }
    });

    colorByContainer.appendChild(select);
    leftToolbar.appendChild(colorByContainer);
  }

  private toggleYearViewMode(): void {
    if (!this.calendar) return;

    this.yearViewSplit = !this.yearViewSplit;
    const newView = this.yearViewSplit ? 'multiMonthYear' : 'dayGridYear';
    this.calendar.changeView(newView);

    // Update button text/icon
    const toggleBtn = this.calendarEl?.querySelector('.fc-yearToggleButton-button');
    if (toggleBtn) {
      toggleBtn.textContent = this.yearViewSplit ? '▦' : '☰';
      toggleBtn.setAttribute('title', this.yearViewSplit ? 'Switch to continuous scroll' : 'Switch to split by month');
    }
  }

  private updateYearToggleVisibility(show: boolean): void {
    const toggleBtn = this.calendarEl?.querySelector('.fc-yearToggleButton-button') as HTMLElement;
    if (toggleBtn) {
      toggleBtn.style.display = show ? '' : 'none';
    }
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
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
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

  private async openDailyNote(date: Date): Promise<void> {
    // Format date as YYYY-MM-DD for daily note filename (fallback)
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Try to use the daily-notes core plugin settings
    const internalPlugins = (this.app as any).internalPlugins;
    const dailyNotesPlugin = internalPlugins?.getPluginById?.('daily-notes');

    let path: string;
    let templatePath: string | undefined;
    let folder: string | undefined;

    if (dailyNotesPlugin?.enabled && dailyNotesPlugin?.instance?.options) {
      const options = dailyNotesPlugin.instance.options;
      const format = options.format || 'YYYY-MM-DD';
      folder = options.folder || '';
      templatePath = options.template || undefined;

      // Format the date according to the daily notes format
      const filename = this.formatDate(date, format);
      path = folder ? `${folder}/${filename}.md` : `${filename}.md`;
    } else {
      // Fallback: just use YYYY-MM-DD format
      path = `${dateStr}.md`;
    }

    // Check if the file already exists
    const existingFile = this.app.vault.getAbstractFileByPath(path);

    if (!existingFile) {
      // File doesn't exist - create it with template if specified
      let content = '';

      if (templatePath) {
        // Try to load the template
        const templateFile = this.app.vault.getAbstractFileByPath(templatePath) ||
                             this.app.vault.getAbstractFileByPath(`${templatePath}.md`);
        if (templateFile && 'path' in templateFile) {
          try {
            content = await this.app.vault.read(templateFile as any);
            // Process template variables
            content = this.processTemplateVariables(content, date);
          } catch {
            // Template couldn't be read, use empty content
            content = '';
          }
        }
      }

      // Ensure folder exists
      if (folder) {
        const folderExists = this.app.vault.getAbstractFileByPath(folder);
        if (!folderExists) {
          await this.app.vault.createFolder(folder);
        }
      }

      // Create the daily note
      await this.app.vault.create(path, content);
    }

    // Open the file
    await this.app.workspace.openLinkText(path, '', false);
  }

  private processTemplateVariables(content: string, date: Date): string {
    // Replace common template variables
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];

    return content
      // Date patterns
      .replace(/\{\{date\}\}/g, `${year}-${month}-${day}`)
      .replace(/\{\{date:([^}]+)\}\}/g, (_, format) => this.formatDate(date, format))
      // Title patterns
      .replace(/\{\{title\}\}/g, `${year}-${month}-${day}`)
      // Time patterns
      .replace(/\{\{time\}\}/g, date.toLocaleTimeString())
      // Day/week patterns
      .replace(/\{\{weekday\}\}/g, weekdays[date.getDay()])
      .replace(/\{\{month\}\}/g, months[date.getMonth()]);
  }

  private formatDate(date: Date, format: string): string {
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
    const weekdaysShort = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const months = ['January', 'February', 'March', 'April', 'May', 'June',
                    'July', 'August', 'September', 'October', 'November', 'December'];
    const monthsShort = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

    // Replace format tokens (order matters - longer tokens first)
    return format
      .replace(/YYYY/g, String(year))
      .replace(/YY/g, String(year).slice(-2))
      .replace(/MMMM/g, months[month - 1])
      .replace(/MMM/g, monthsShort[month - 1])
      .replace(/MM/g, String(month).padStart(2, '0'))
      .replace(/M/g, String(month))
      .replace(/DDDD/g, weekdays[date.getDay()])
      .replace(/DDD/g, weekdaysShort[date.getDay()])
      .replace(/DD/g, String(day).padStart(2, '0'))
      .replace(/D/g, String(day))
      .replace(/dddd/g, weekdays[date.getDay()])
      .replace(/ddd/g, weekdaysShort[date.getDay()]);
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
