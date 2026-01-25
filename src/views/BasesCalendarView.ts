import {
  BasesView,
  BasesViewRegistration,
  BasesEntry,
  BasesPropertyId,
  QueryController,
  setIcon,
  App,
  TFile,
} from 'obsidian';
import { Calendar, EventInput, EventClickArg, DateSelectArg, EventDropArg } from '@fullcalendar/core';

/**
 * Type interfaces for FullCalendar event handlers
 */
interface EventResizeArg {
  event: {
    start: Date | null;
    end: Date | null;
    extendedProps: { entry: BasesEntry };
  };
}

/**
 * Type interfaces for Obsidian's undocumented internal plugins API
 */
interface DailyNotesPluginOptions {
  format?: string;
  folder?: string;
  template?: string;
}

interface DailyNotesPluginInstance {
  options?: DailyNotesPluginOptions;
}

interface InternalPlugin {
  enabled?: boolean;
  instance?: DailyNotesPluginInstance;
}

interface InternalPluginsManager {
  getPluginById?(id: string): InternalPlugin | undefined;
}

interface AppWithInternals extends App {
  internalPlugins?: InternalPluginsManager;
}

/**
 * Type interface for BasesView grouped data entries
 */
interface BasesGroupedData {
  entries: BasesEntry[];
  key?: unknown;
  hasKey(): boolean;
}

/**
 * Type interface for frontmatter date fields we modify
 */
interface ItemFrontmatter {
  date_start_scheduled?: string;
  date_end_scheduled?: string;
  date_modified?: string;
}
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import multiMonthPlugin from '@fullcalendar/multimonth';
import { RRule } from 'rrule';
import type PlannerPlugin from '../main';
import { getCalendarColor, type OpenBehavior } from '../types/settings';
import type { PlannerItem, DayOfWeek } from '../types/item';
import { openItemModal } from '../components/ItemModal';
import { PropertyTypeService } from '../services/PropertyTypeService';
import { isOngoing } from '../utils/dateUtils';

export const BASES_CALENDAR_VIEW_ID = 'planner-calendar';

type CalendarViewType = 'multiMonthYear' | 'dayGridYear' | 'dayGridMonth' | 'timeGridWeek' | 'timeGridThreeDay' | 'timeGridDay' | 'listWeek';

/**
 * Solarized Accent Colors (for fields without predefined colors)
 */
const SOLARIZED_ACCENT_COLORS = [
  '#b58900', // yellow
  '#cb4b16', // orange
  '#dc322f', // red
  '#d33682', // magenta
  '#6c71c4', // violet
  '#268bd2', // blue
  '#2aa198', // cyan
  '#859900', // green
];

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
  private currentView: CalendarViewType | null = null; // null means use config default
  private resizeObserver: ResizeObserver | null = null;
  private yearViewSplit: boolean = true; // true = multiMonthYear (split), false = dayGridYear (continuous)
  private colorMapCache: Record<string, string> = {}; // Cache for color assignments

  // Now accepts any property ID for custom properties
  private getColorByField(): string {
    const value = this.config.get('colorBy') as string | undefined;
    // Accept any property ID; empty string or undefined defaults to calendar
    if (!value) return 'note.calendar';
    return value;
  }

  private getDefaultView(): CalendarViewType {
    const value = this.config.get('defaultView') as string | undefined;
    const validViews: CalendarViewType[] = ['multiMonthYear', 'dayGridYear', 'dayGridMonth', 'timeGridWeek', 'timeGridThreeDay', 'timeGridDay', 'listWeek'];
    if (value && validViews.includes(value as CalendarViewType)) {
      return value as CalendarViewType;
    }
    return 'dayGridMonth'; // default
  }

  private getTitleField(): string {
    const value = this.config.get('titleField') as string | undefined;
    return value || 'note.title';
  }

  private getDateStartField(): string {
    const value = this.config.get('dateStartField') as string | undefined;
    return value || 'note.date_start_scheduled';
  }

  private getDateEndField(): string {
    const value = this.config.get('dateEndField') as string | undefined;
    return value || 'note.date_end_scheduled';
  }

  // Keyboard navigation event handlers
  private keyboardEventHandlers: { event: string; handler: EventListener }[] = [];

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
    this.setupKeyboardNavigation();
  }

  /**
   * Setup keyboard navigation event listeners
   */
  private setupKeyboardNavigation(): void {
    const todayHandler = () => {
      if (this.calendar) {
        this.calendar.today();
      }
    };

    const nextHandler = () => {
      if (this.calendar) {
        this.calendar.next();
      }
    };

    const prevHandler = () => {
      if (this.calendar) {
        this.calendar.prev();
      }
    };

    window.addEventListener('planner:calendar-today', todayHandler);
    window.addEventListener('planner:calendar-next', nextHandler);
    window.addEventListener('planner:calendar-prev', prevHandler);

    this.keyboardEventHandlers = [
      { event: 'planner:calendar-today', handler: todayHandler },
      { event: 'planner:calendar-next', handler: nextHandler },
      { event: 'planner:calendar-prev', handler: prevHandler },
    ];
  }

  private setupContainer(): void {
    this.containerEl.empty();
    this.containerEl.addClass('planner-bases-calendar');

    // Single calendar element - no separate toolbar
    this.calendarEl = this.containerEl.createDiv({ cls: 'planner-calendar-container' });
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
    // Clean up keyboard navigation event listeners
    for (const { event, handler } of this.keyboardEventHandlers) {
      window.removeEventListener(event, handler);
    }
    this.keyboardEventHandlers = [];
    // Clean up styles and classes added to the shared container
    this.containerEl.removeClass('planner-bases-calendar');
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

    // Build color map cache before initializing calendar
    this.buildColorMapCache();

    if (this.calendarEl) {
      this.initCalendar(currentDate, currentViewType);
    }
  }

  private initCalendar(initialDate?: Date, initialView?: CalendarViewType): void {
    if (!this.calendarEl) return;

    const weekStartsOn = this.getWeekStartDay();
    const events = this.getEventsFromData();

    // Use provided view, or current view if re-rendering, or config default for first render
    const viewToUse = initialView || this.currentView || this.getDefaultView();

    this.calendar = new Calendar(this.calendarEl, {
      plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, multiMonthPlugin],
      initialView: viewToUse,
      initialDate: initialDate,
      headerToolbar: {
        left: 'yearToggleButton,yearButton,monthButton,weekButton,threeDayButton,dayButton,listButton',
        center: 'title',
        right: 'refreshButton prev,todayButton,next',
      },
      views: {
        timeGridThreeDay: {
          type: 'timeGrid',
          duration: { days: 3 },
          buttonText: '3',
        },
      },
      customButtons: {
        yearButton: {
          text: 'Y',
          hint: 'Year view',
          click: () => {
            if (this.calendar) {
              const view = this.yearViewSplit ? 'multiMonthYear' : 'dayGridYear';
              this.calendar.changeView(view);
              this.updateActiveViewButton(view);
              this.updateYearToggleEnabled(true);
            }
          },
        },
        monthButton: {
          text: 'M',
          hint: 'Month view',
          click: () => {
            if (this.calendar) {
              this.calendar.changeView('dayGridMonth');
              this.updateActiveViewButton('dayGridMonth');
              this.updateYearToggleEnabled(false);
            }
          },
        },
        weekButton: {
          text: 'W',
          hint: 'Week view',
          click: () => {
            if (this.calendar) {
              this.calendar.changeView('timeGridWeek');
              this.updateActiveViewButton('timeGridWeek');
              this.updateYearToggleEnabled(false);
            }
          },
        },
        threeDayButton: {
          text: '3',
          hint: '3-day view',
          click: () => {
            if (this.calendar) {
              this.calendar.changeView('timeGridThreeDay');
              this.updateActiveViewButton('timeGridThreeDay');
              this.updateYearToggleEnabled(false);
            }
          },
        },
        dayButton: {
          text: 'D',
          hint: 'Day view',
          click: () => {
            if (this.calendar) {
              this.calendar.changeView('timeGridDay');
              this.updateActiveViewButton('timeGridDay');
              this.updateYearToggleEnabled(false);
            }
          },
        },
        listButton: {
          text: 'L',
          hint: 'List view',
          click: () => {
            if (this.calendar) {
              this.calendar.changeView('listWeek');
              this.updateActiveViewButton('listWeek');
              this.updateYearToggleEnabled(false);
            }
          },
        },
        yearToggleButton: {
          text: '',
          hint: 'Toggle year view mode',
          click: () => this.toggleYearViewMode(),
        },
        todayButton: {
          text: '',
          hint: 'Go to today',
          click: () => {
            if (this.calendar) {
              this.calendar.today();
            }
          },
        },
        refreshButton: {
          text: '',
          hint: 'Refresh calendar',
          click: () => this.refreshCalendar(),
        },
      },
      firstDay: weekStartsOn,
      selectable: true,
      editable: true,
      eventStartEditable: true,
      eventDurationEditable: true,
      navLinks: true, // Make day numbers clickable
      navLinkDayClick: (date) => { void this.openDailyNote(date); }, // Click on day number opens daily note
      events: events,
      eventClick: (info) => { void this.handleEventClick(info); },
      eventDrop: (info) => { void this.handleEventDrop(info); },
      eventResize: (info) => { void this.handleEventResize(info); },
      select: (info) => this.handleDateSelect(info),
      dayHeaderDidMount: (arg) => {
        // Make day header clickable in day/week views to open daily note
        const el = arg.el;
        el.addClass('planner-cursor-pointer');
        el.addEventListener('click', (e) => {
          // Prevent if clicking on an actual nav link (already handled)
          if ((e.target as HTMLElement).closest('.fc-col-header-cell-cushion')) {
            void this.openDailyNote(arg.date);
          }
        });
      },
      viewDidMount: (arg) => {
        // Track view type changes
        const newViewType = arg.view.type as CalendarViewType;
        if (newViewType) {
          this.currentView = newViewType;
        }
        // Update year toggle state based on current view
        const isYearView = newViewType === 'multiMonthYear' || newViewType === 'dayGridYear';
        this.updateYearToggleEnabled(isYearView);
        this.updateYearToggleButtonContent();
        // Update active view button
        this.updateActiveViewButton(newViewType);
      },
      height: '100%',
      expandRows: true,
      handleWindowResize: true,
      nowIndicator: true,
      dayMaxEvents: true,
      // Fix drag offset caused by CSS transforms on Obsidian's workspace containers
      fixedMirrorParent: document.body,
    });

    this.calendar.render();

    // Apply font size CSS variable
    this.calendarEl.style.setProperty('--planner-calendar-font-size', `${this.plugin.settings.calendarFontSize}px`);

    // Set today button icon
    const todayBtn = this.calendarEl?.querySelector('.fc-todayButton-button');
    if (todayBtn) {
      todayBtn.empty();
      setIcon(todayBtn, 'square-split-horizontal');
    }

    // Set refresh button icon
    const refreshBtn = this.calendarEl?.querySelector('.fc-refreshButton-button');
    if (refreshBtn) {
      refreshBtn.empty();
      setIcon(refreshBtn, 'refresh-ccw');
    }

    // Set initial active view button
    this.updateActiveViewButton(viewToUse);

    // Set initial year toggle state
    const isYearView = (initialView || this.currentView) === 'multiMonthYear' ||
                       (initialView || this.currentView) === 'dayGridYear';
    this.updateYearToggleEnabled(isYearView);
    this.updateYearToggleButtonContent();
  }

  private toggleYearViewMode(): void {
    if (!this.calendar) return;

    this.yearViewSplit = !this.yearViewSplit;
    const newView = this.yearViewSplit ? 'multiMonthYear' : 'dayGridYear';
    this.calendar.changeView(newView);

    // Update button text/icon
    this.updateYearToggleButtonContent();
  }

  private refreshCalendar(): void {
    // Re-render the calendar (like closing and reopening)
    this.render();
  }

  private updateYearToggleEnabled(enabled: boolean): void {
    const toggleBtn = this.calendarEl?.querySelector('.fc-yearToggleButton-button') as HTMLElement;
    if (toggleBtn) {
      if (enabled) {
        toggleBtn.removeAttribute('disabled');
        toggleBtn.classList.remove('fc-button-disabled');
      } else {
        toggleBtn.setAttribute('disabled', 'true');
        toggleBtn.classList.add('fc-button-disabled');
      }
    }
  }

  private updateYearToggleButtonContent(): void {
    const toggleBtn = this.calendarEl?.querySelector('.fc-yearToggleButton-button') as HTMLElement | null;
    if (toggleBtn) {
      toggleBtn.empty();
      // Use different icons for split vs continuous mode
      // layout-grid = split by month (⧉), align-justify = continuous scroll (☰)
      setIcon(toggleBtn, this.yearViewSplit ? 'layout-grid' : 'align-justify');
      toggleBtn.setAttribute('title', this.yearViewSplit ? 'Switch to continuous scroll' : 'Switch to split by month');
    }
  }

  private updateActiveViewButton(viewType: CalendarViewType): void {
    if (!this.calendarEl) return;

    // Map view types to button selectors
    const viewButtonMap: Record<string, string> = {
      'multiMonthYear': '.fc-yearButton-button',
      'dayGridYear': '.fc-yearButton-button',
      'dayGridMonth': '.fc-monthButton-button',
      'timeGridWeek': '.fc-weekButton-button',
      'timeGridThreeDay': '.fc-threeDayButton-button',
      'timeGridDay': '.fc-dayButton-button',
      'listWeek': '.fc-listButton-button',
    };

    // Remove active class from all view buttons
    const allViewButtons = this.calendarEl.querySelectorAll(
      '.fc-yearButton-button, .fc-monthButton-button, .fc-weekButton-button, .fc-threeDayButton-button, .fc-dayButton-button, .fc-listButton-button'
    );
    allViewButtons.forEach(btn => btn.classList.remove('fc-button-active'));

    // Add active class to current view button
    const activeSelector = viewButtonMap[viewType];
    if (activeSelector) {
      const activeBtn = this.calendarEl.querySelector(activeSelector);
      activeBtn?.classList.add('fc-button-active');
    }
  }

  /**
   * Build color map cache for fields that need auto-assigned colors
   */
  private buildColorMapCache(): void {
    this.colorMapCache = {};
    const colorByField = this.getColorByField();

    // Only build cache for fields that need auto-assigned colors
    const needsCache = ['note.parent', 'note.people', 'note.folder', 'note.tags', 'note.context', 'note.location'];
    if (!needsCache.includes(colorByField)) {
      return;
    }

    // Collect all unique values
    const uniqueValues = new Set<string>();
    const groupedData = this.data.groupedData as BasesGroupedData[];
    for (const group of groupedData) {
      for (const entry of group.entries) {
        let value: unknown;
        if (colorByField === 'note.folder') {
          const folderPath = entry.file.parent?.path || '/';
          value = folderPath === '/' ? 'Root' : entry.file.parent?.name || 'Root';
        } else {
          value = entry.getValue(colorByField as BasesPropertyId);
        }

        if (value) {
          if (Array.isArray(value)) {
            const firstVal = value[0] != null ? String(value[0]) : undefined;
            if (firstVal) uniqueValues.add(firstVal);
          } else if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
            uniqueValues.add(String(value));
          }
        }
      }
    }

    // Sort and assign Solarized colors
    const sortedValues = Array.from(uniqueValues).sort();
    sortedValues.forEach((value, index) => {
      this.colorMapCache[value] = SOLARIZED_ACCENT_COLORS[index % SOLARIZED_ACCENT_COLORS.length];
    });
  }

  /**
   * Get frontmatter directly from Obsidian's metadata cache (bypasses Bases getValue)
   */
  private getFrontmatter(entry: BasesEntry): Record<string, unknown> | undefined {
    const file = entry.file;
    const cache = this.app.metadataCache.getFileCache(file);
    return cache?.frontmatter;
  }

  private getEventsFromData(): EventInput[] {
    const events: EventInput[] = [];

    // Get a reasonable date range for recurrence expansion
    // Default to 1 year before and after today
    const now = new Date();
    const rangeStart = new Date(now);
    rangeStart.setFullYear(rangeStart.getFullYear() - 1);
    const rangeEnd = new Date(now);
    rangeEnd.setFullYear(rangeEnd.getFullYear() + 1);

    const validFrequencies = ['daily', 'weekly', 'monthly', 'yearly'];
    const groupedData = this.data.groupedData as BasesGroupedData[];

    for (const group of groupedData) {
      for (const entry of group.entries) {
        // Get frontmatter directly from Obsidian's metadata cache
        const frontmatter = this.getFrontmatter(entry);
        const repeatFrequency = frontmatter?.repeat_frequency;

        // Validate that it's actually a valid frequency string
        const isValidRecurrence = typeof repeatFrequency === 'string' &&
                                  validFrequencies.includes(repeatFrequency);

        if (isValidRecurrence) {
          // Expand recurring item into multiple events
          const recurringEvents = this.expandRecurringEntry(entry, rangeStart, rangeEnd);
          events.push(...recurringEvents);
        } else {
          // Non-recurring item - single event
          const event = this.entryToEvent(entry, this.getColorByField());
          if (event) {
            events.push(event);
          }
        }
      }
    }

    return events;
  }

  /**
   * Check if a Bases value is actually a valid value (not a placeholder/undefined)
   * Bases returns placeholder objects like {icon: 'lucide-file-question'} for missing fields
   */
  private isValidBasesValue(value: unknown): boolean {
    if (value === null || value === undefined) return false;
    if (typeof value === 'string' && (value === '' || value === 'null')) return false;
    // Check for Bases placeholder objects
    if (typeof value === 'object' && value !== null && 'icon' in value) return false;
    return true;
  }

  /**
   * Extract a PlannerItem-like object from a BasesEntry using Obsidian's metadata cache
   */
  private extractRecurrenceData(entry: BasesEntry): Partial<PlannerItem> {
    // Get frontmatter directly from Obsidian's metadata cache
    const fm = this.getFrontmatter(entry) || {};

    // Extract dates - try frontmatter first, fall back to Bases getValue for configured fields
    const dateStartField = this.getDateStartField();
    const dateEndField = this.getDateEndField();

    let dateStart = fm.date_start_scheduled;
    let dateEnd = fm.date_end_scheduled;

    // If using non-default date fields, try Bases getValue as fallback
    if (!dateStart && dateStartField !== 'note.date_start_scheduled') {
      const basesValue = entry.getValue(dateStartField as unknown);
      if (this.isValidBasesValue(basesValue)) {
        dateStart = basesValue;
      }
    }
    if (!dateEnd && dateEndField !== 'note.date_end_scheduled') {
      const basesValue = entry.getValue(dateEndField as unknown);
      if (this.isValidBasesValue(basesValue)) {
        dateEnd = basesValue;
      }
    }

    // Extract recurrence fields directly from frontmatter
    const repeatFrequency = fm.repeat_frequency as string | undefined;
    const repeatInterval = fm.repeat_interval as number | undefined;
    const repeatUntil = fm.repeat_until as string | undefined;
    const repeatCount = fm.repeat_count as number | undefined;
    const repeatByday = fm.repeat_byday as DayOfWeek[] | undefined;
    const repeatBymonth = fm.repeat_bymonth as number[] | undefined;
    const repeatBymonthday = fm.repeat_bymonthday as number[] | undefined;
    const repeatBysetpos = fm.repeat_bysetpos as number | undefined;
    const repeatCompletedDates = fm.repeat_completed_dates as string[] | undefined;

    // Validate repeat_frequency
    const validFrequencies = ['daily', 'weekly', 'monthly', 'yearly'];
    const validatedFrequency = typeof repeatFrequency === 'string' && validFrequencies.includes(repeatFrequency)
      ? repeatFrequency as PlannerItem['repeat_frequency']
      : undefined;

    // Validate bysetpos
    const validatedBysetpos = typeof repeatBysetpos === 'number' && repeatBysetpos !== 0 &&
                              repeatBysetpos >= -366 && repeatBysetpos <= 366
      ? repeatBysetpos
      : undefined;

    return {
      path: entry.file.path,
      date_start_scheduled: dateStart ? this.toISOString(dateStart) : undefined,
      date_end_scheduled: dateEnd ? this.toISOString(dateEnd) : undefined,
      repeat_frequency: validatedFrequency,
      repeat_interval: typeof repeatInterval === 'number' ? repeatInterval : undefined,
      repeat_until: repeatUntil ? this.toISOString(repeatUntil) : undefined,
      repeat_count: typeof repeatCount === 'number' ? repeatCount : undefined,
      repeat_byday: Array.isArray(repeatByday) && repeatByday.length > 0 ? repeatByday : undefined,
      repeat_bymonth: Array.isArray(repeatBymonth) && repeatBymonth.length > 0 ? repeatBymonth : undefined,
      repeat_bymonthday: Array.isArray(repeatBymonthday) && repeatBymonthday.length > 0 ? repeatBymonthday : undefined,
      repeat_bysetpos: validatedBysetpos,
      repeat_completed_dates: Array.isArray(repeatCompletedDates) ? repeatCompletedDates : undefined,
    };
  }

  /**
   * Build an RRULE string from item data
   */
  private buildRRuleString(item: Partial<PlannerItem>): string {
    const parts: string[] = [];

    // Frequency map
    const freqMap: Record<string, string> = {
      daily: 'DAILY',
      weekly: 'WEEKLY',
      monthly: 'MONTHLY',
      yearly: 'YEARLY',
    };

    if (item.repeat_frequency) {
      parts.push(`FREQ=${freqMap[item.repeat_frequency]}`);
    }

    if (item.repeat_interval && item.repeat_interval > 1) {
      parts.push(`INTERVAL=${item.repeat_interval}`);
    }

    if (item.repeat_byday?.length) {
      parts.push(`BYDAY=${item.repeat_byday.join(',')}`);
    }

    if (item.repeat_bymonth?.length) {
      parts.push(`BYMONTH=${item.repeat_bymonth.join(',')}`);
    }

    if (item.repeat_bymonthday?.length) {
      parts.push(`BYMONTHDAY=${item.repeat_bymonthday.join(',')}`);
    }

    if (item.repeat_bysetpos !== undefined && item.repeat_bysetpos !== 0) {
      parts.push(`BYSETPOS=${item.repeat_bysetpos}`);
    }

    if (item.repeat_count) {
      parts.push(`COUNT=${item.repeat_count}`);
    }

    if (item.repeat_until) {
      const until = new Date(item.repeat_until);
      if (!isNaN(until.getTime())) {
        const year = until.getUTCFullYear();
        const month = String(until.getUTCMonth() + 1).padStart(2, '0');
        const day = String(until.getUTCDate()).padStart(2, '0');
        parts.push(`UNTIL=${year}${month}${day}`);
      }
    }

    return parts.join(';');
  }

  /**
   * Generate recurring occurrences using RRule directly (TaskNotes approach)
   */
  private generateOccurrences(item: Partial<PlannerItem>, rangeStart: Date, rangeEnd: Date): Date[] {
    if (!item.repeat_frequency || !item.date_start_scheduled) {
      return [];
    }

    try {
      const dateStr = String(item.date_start_scheduled);

      // Check if this is a date-only string (no 'T' means no time component)
      // Date-only strings like "2026-01-05" are parsed as UTC midnight by JavaScript,
      // but we want to treat them as local dates for all-day events
      const isDateOnly = !dateStr.includes('T');

      let startDate: Date;
      let originalLocalHours: number;
      let originalLocalMinutes: number;
      let originalLocalSeconds: number;

      if (isDateOnly) {
        // For date-only strings, parse the date parts directly to avoid UTC interpretation
        // "2026-01-05" should mean January 5th in local time, not UTC
        const [year, month, day] = dateStr.split('-').map(Number);
        startDate = new Date(year, month - 1, day, 0, 0, 0);
        originalLocalHours = 0;
        originalLocalMinutes = 0;
        originalLocalSeconds = 0;
      } else {
        // For datetime strings, parse normally and extract local time
        startDate = new Date(dateStr);
        if (isNaN(startDate.getTime())) {
          return [];
        }
        // Extract the original LOCAL time components - this is what the user intended
        // (e.g., "midnight" should stay midnight regardless of DST)
        originalLocalHours = startDate.getHours();
        originalLocalMinutes = startDate.getMinutes();
        originalLocalSeconds = startDate.getSeconds();
      }

      // Create UTC date for RRule - use local date components for date-based recurrence
      // This ensures RRule generates occurrences on the correct calendar days
      const dtstart = new Date(Date.UTC(
        startDate.getFullYear(),
        startDate.getMonth(),
        startDate.getDate(),
        originalLocalHours,
        originalLocalMinutes,
        originalLocalSeconds,
        0
      ));

      // Build RRULE string
      const rruleString = this.buildRRuleString(item);

      // Parse the RRULE string (TaskNotes approach)
      const rruleOptions = RRule.parseString(rruleString);

      // Set dtstart manually (critical - this is what TaskNotes does)
      rruleOptions.dtstart = dtstart;

      // Create the RRule
      const rule = new RRule(rruleOptions);

      // Convert range to UTC (TaskNotes approach)
      const utcStart = new Date(Date.UTC(
        rangeStart.getFullYear(),
        rangeStart.getMonth(),
        rangeStart.getDate(),
        0, 0, 0, 0
      ));
      const utcEnd = new Date(Date.UTC(
        rangeEnd.getFullYear(),
        rangeEnd.getMonth(),
        rangeEnd.getDate(),
        23, 59, 59, 999
      ));

      // Generate occurrences - RRule returns UTC dates
      const rawOccurrences = rule.between(utcStart, utcEnd, true);

      // Convert each occurrence to preserve the original LOCAL time
      // This fixes DST issues: "midnight" stays midnight regardless of timezone offset
      return rawOccurrences.map(occ => {
        // Get the UTC date components from the occurrence
        const year = occ.getUTCFullYear();
        const month = occ.getUTCMonth();
        const day = occ.getUTCDate();

        // Create a new date with the occurrence's date but the original local time
        // Using the Date constructor with individual components treats them as local time
        return new Date(year, month, day, originalLocalHours, originalLocalMinutes, originalLocalSeconds);
      });
    } catch {
      return [];
    }
  }

  /**
   * Check if a date is in the completed dates list
   */
  private isDateCompleted(completedDates: string[] | undefined, date: Date): boolean {
    if (!completedDates?.length) return false;
    const dateStr = date.toISOString().split('T')[0];
    return completedDates.some(d => d.split('T')[0] === dateStr);
  }

  /**
   * Expand a recurring entry into multiple calendar events
   */
  private expandRecurringEntry(entry: BasesEntry, rangeStart: Date, rangeEnd: Date): EventInput[] {
    const colorByProp = this.getColorByField();
    const titleField = this.getTitleField();
    const allDayValue = entry.getValue('note.all_day' as unknown);

    // Get title
    let title: string;
    if (titleField === 'file.basename') {
      title = entry.file.basename;
    } else {
      const titleValue = entry.getValue(titleField as unknown);
      title = titleValue ? String(titleValue) : entry.file.basename || 'Untitled';
    }

    // Get color
    const color = this.getEntryColor(entry, colorByProp);

    // Extract recurrence data
    const itemData = this.extractRecurrenceData(entry);

    // Generate occurrences using RRule directly
    const occurrences = this.generateOccurrences(itemData, rangeStart, rangeEnd);

    if (occurrences.length === 0) {
      // Fall back to single event if no occurrences generated
      const event = this.entryToEvent(entry, colorByProp);
      return event ? [event] : [];
    }

    // Determine if this is an all-day event
    const isAllDay = this.isAllDayValue(allDayValue) ||
      (typeof itemData.date_start_scheduled === 'string' && !itemData.date_start_scheduled.includes('T'));

    // Calculate event duration (in days for all-day events, milliseconds for timed events)
    let durationMs = 0;
    let durationDays = 0;
    if (itemData.date_start_scheduled && itemData.date_end_scheduled) {
      if (isAllDay) {
        // For all-day events, calculate duration in days
        const startStr = String(itemData.date_start_scheduled);
        const endStr = String(itemData.date_end_scheduled);
        const startParts = startStr.split('T')[0].split('-').map(Number);
        const endParts = endStr.split('T')[0].split('-').map(Number);
        const startLocal = new Date(startParts[0], startParts[1] - 1, startParts[2]);
        const endLocal = new Date(endParts[0], endParts[1] - 1, endParts[2]);
        durationDays = Math.round((endLocal.getTime() - startLocal.getTime()) / (24 * 60 * 60 * 1000));
      } else {
        const start = new Date(itemData.date_start_scheduled);
        const end = new Date(itemData.date_end_scheduled);
        durationMs = end.getTime() - start.getTime();
      }
    }

    const events: EventInput[] = [];

    // Convert each occurrence to an EventInput
    for (let i = 0; i < occurrences.length; i++) {
      const occurrenceStart = occurrences[i];
      const isCompleted = this.isDateCompleted(itemData.repeat_completed_dates, occurrenceStart);

      let startStr: string;
      let endStr: string | undefined;

      if (isAllDay) {
        // For all-day events, use date-only strings (YYYY-MM-DD) to avoid timezone issues
        const year = occurrenceStart.getFullYear();
        const month = String(occurrenceStart.getMonth() + 1).padStart(2, '0');
        const day = String(occurrenceStart.getDate()).padStart(2, '0');
        startStr = `${year}-${month}-${day}`;

        if (durationDays > 0) {
          const occurrenceEnd = new Date(occurrenceStart);
          occurrenceEnd.setDate(occurrenceEnd.getDate() + durationDays);
          const endYear = occurrenceEnd.getFullYear();
          const endMonth = String(occurrenceEnd.getMonth() + 1).padStart(2, '0');
          const endDay = String(occurrenceEnd.getDate()).padStart(2, '0');
          endStr = `${endYear}-${endMonth}-${endDay}`;
        }
      } else {
        // For timed events, use ISO strings
        startStr = occurrenceStart.toISOString();
        if (durationMs > 0) {
          const occurrenceEnd = new Date(occurrenceStart.getTime() + durationMs);
          endStr = occurrenceEnd.toISOString();
        }
      }

      events.push({
        id: `${entry.file.path}::${i}`,
        title: String(title),
        start: startStr,
        end: endStr,
        allDay: isAllDay,
        backgroundColor: isCompleted ? '#9ca3af' : color,
        borderColor: isCompleted ? '#9ca3af' : color,
        textColor: this.getContrastColor(isCompleted ? '#9ca3af' : color),
        extendedProps: {
          entry,
          occurrenceDate: startStr,
          isRecurring: true,
          isCompleted,
        },
      });
    }

    return events;
  }

  private entryToEvent(entry: BasesEntry, colorByProp: string): EventInput | null {
    // Get date fields using configured field names
    const dateStartField = this.getDateStartField();
    const dateEndField = this.getDateEndField();
    const titleField = this.getTitleField();

    const dateStart = entry.getValue(dateStartField as unknown);
    const dateEnd = entry.getValue(dateEndField as unknown);
    const allDayValue = entry.getValue('note.all_day' as unknown);

    // Must have a start date
    if (!dateStart) return null;

    // Get title using configured field, with fallbacks
    let title: string;
    if (titleField === 'file.basename') {
      title = entry.file.basename;
    } else {
      const titleValue = entry.getValue(titleField as unknown);
      title = titleValue ? String(titleValue) : entry.file.basename || 'Untitled';
    }

    // Get color
    const color = this.getEntryColor(entry, colorByProp);

    // Convert dates to ISO strings (handles both Date objects and strings)
    const startStr = this.toISOString(dateStart);
    const endStr = dateEnd ? this.toISOString(dateEnd) : undefined;

    // Determine if all-day event:
    // - Explicitly set to true in frontmatter
    // - OR start date has no time component
    const isAllDay = this.isAllDayValue(allDayValue) || !this.hasTime(startStr);

    return {
      id: entry.file.path,
      title: String(title),
      start: startStr,
      end: endStr,
      allDay: isAllDay,
      backgroundColor: color,
      borderColor: color,
      textColor: this.getContrastColor(color),
      extendedProps: {
        entry,
      },
    };
  }

  private getEntryColor(entry: BasesEntry, colorByProp: string): string {
    // Handle 'none' option
    if (colorByProp === 'none' || !colorByProp) {
      return '#6b7280'; // default gray
    }

    const propName = colorByProp.split('.')[1] || colorByProp;

    // Handle 'color' field - use actual hex value from note
    if (propName === 'color') {
      const colorValue = entry.getValue(colorByProp as BasesPropertyId);
      if (colorValue) {
        const colorStr = String(colorValue);
        // Ensure it starts with #
        return colorStr.startsWith('#') ? colorStr : `#${colorStr}`;
      }
      return '#6b7280';
    }

    // Handle 'folder' field specially
    if (propName === 'folder') {
      const folderPath = entry.file.parent?.path || '/';
      const folderName = folderPath === '/' ? 'Root' : entry.file.parent?.name || 'Root';
      return this.colorMapCache[folderName] ?? '#6b7280';
    }

    // Get the value
    const value = entry.getValue(colorByProp as BasesPropertyId);
    if (!value) return '#6b7280';

    // Handle fields with colors defined in settings
    if (propName === 'calendar') {
      const calendarName = Array.isArray(value) ? String(value[0]) : String(value);
      return getCalendarColor(this.plugin.settings, calendarName);
    }

    if (propName === 'priority') {
      const priority = this.plugin.settings.priorities.find(p => p.name === String(value));
      return priority?.color ?? '#6b7280';
    }

    if (propName === 'status') {
      const status = this.plugin.settings.statuses.find(s => s.name === String(value));
      return status?.color ?? '#6b7280';
    }

    // For all other fields (parent, people, tags, context, location, and custom properties):
    // Use auto-assigned Solarized colors from the cache
    const valueStr = Array.isArray(value)
      ? (value[0] != null ? String(value[0]) : undefined)
      : String(value);
    if (valueStr) {
      return this.colorMapCache[valueStr] ?? '#6b7280';
    }

    return '#6b7280';
  }

  private hasTime(dateStr: string): boolean {
    // Check if date string contains a non-midnight time
    if (!dateStr.includes('T')) return false;

    // Extract time portion and check if it's not midnight
    const timePart = dateStr.split('T')[1];
    if (!timePart) return false;

    // Check for midnight patterns: 00:00:00, 00:00:00.000, 00:00:00.000Z, etc.
    const timeWithoutTz = timePart.replace(/[Z+-].*$/, ''); // Remove timezone
    return !timeWithoutTz.startsWith('00:00:00');
  }

  private toISOString(value: unknown): string {
    // Handle "ongoing" keyword - resolve to current time
    if (isOngoing(value)) {
      return new Date().toISOString();
    }
    // Handle Date objects
    if (value instanceof Date) {
      return value.toISOString();
    }
    // Handle strings that might be dates
    if (typeof value === 'string') {
      return value;
    }
    // Handle numbers (timestamps)
    if (typeof value === 'number') {
      return new Date(value).toISOString();
    }
    // Fallback
    return String(value);
  }

  private isAllDayValue(value: unknown): boolean {
    // Handle explicit boolean true
    if (value === true) return true;
    // Handle string "true"
    if (typeof value === 'string' && value.toLowerCase() === 'true') return true;
    // Everything else (false, "false", null, undefined) is not all-day
    return false;
  }

  /**
   * Format a Date object as an ISO string with local timezone offset
   * e.g., "2026-01-06T10:30:00-05:00" instead of "2026-01-06T15:30:00.000Z"
   */
  private toLocalISOString(date: Date): string {
    const tzOffset = date.getTimezoneOffset();
    const offsetHours = Math.abs(Math.floor(tzOffset / 60));
    const offsetMinutes = Math.abs(tzOffset % 60);
    const offsetSign = tzOffset <= 0 ? '+' : '-';
    const offsetStr = `${offsetSign}${String(offsetHours).padStart(2, '0')}:${String(offsetMinutes).padStart(2, '0')}`;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');

    return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}${offsetStr}`;
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

  private async openFileWithBehavior(path: string): Promise<void> {
    const behavior: OpenBehavior = this.plugin.settings.openBehavior;

    switch (behavior) {
      case 'new-tab':
        await this.app.workspace.openLinkText(path, '', 'tab');
        break;
      case 'same-tab':
        await this.app.workspace.openLinkText(path, '', false);
        break;
      case 'split-right':
        await this.app.workspace.openLinkText(path, '', 'split');
        break;
      case 'split-down': {
        const leaf = this.app.workspace.getLeaf('split', 'horizontal');
        const file = this.app.vault.getAbstractFileByPath(path);
        if (file instanceof TFile) {
          await leaf.openFile(file);
        }
        break;
      }
      default:
        await this.app.workspace.openLinkText(path, '', 'tab');
    }
  }

  private async handleEventClick(info: EventClickArg): Promise<void> {
    const entry = info.event.extendedProps.entry as BasesEntry;

    // Load the full item data for editing
    const item = await this.plugin.itemService.getItem(entry.file.path);
    if (item) {
      void openItemModal(this.plugin, { mode: 'edit', item });
    } else {
      // Fallback to opening the file if item can't be loaded
      await this.openFileWithBehavior(entry.file.path);
    }
  }

  private async handleEventDrop(info: EventDropArg): Promise<void> {
    const entry = info.event.extendedProps.entry as BasesEntry;
    const newStart = info.event.start;
    const newEnd = info.event.end;

    // Update the file's frontmatter - preserve duration by updating both start and end
    // Use local timezone format for user-friendly display in frontmatter
    await this.app.fileManager.processFrontMatter(entry.file, (fm: ItemFrontmatter) => {
      fm.date_start_scheduled = this.toLocalISOString(newStart);
      if (newEnd) {
        fm.date_end_scheduled = this.toLocalISOString(newEnd);
      }
      fm.date_modified = new Date().toISOString();
    });
  }

  private async handleEventResize(info: EventResizeArg): Promise<void> {
    const entry = info.event.extendedProps.entry;
    const newStart = info.event.start;
    const newEnd = info.event.end;

    // Update the file's frontmatter with new start/end times
    // Use local timezone format for user-friendly display in frontmatter
    await this.app.fileManager.processFrontMatter(entry.file, (fm: ItemFrontmatter) => {
      if (newStart) {
        fm.date_start_scheduled = this.toLocalISOString(newStart);
      }
      if (newEnd) {
        fm.date_end_scheduled = this.toLocalISOString(newEnd);
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
    const appWithInternals = this.app as AppWithInternals;
    const dailyNotesPlugin = appWithInternals.internalPlugins?.getPluginById?.('daily-notes');

    let path: string;
    let templatePath: string | undefined;
    let folder: string | undefined;

    if (dailyNotesPlugin?.enabled && dailyNotesPlugin.instance?.options) {
      const options = dailyNotesPlugin.instance.options;
      const format = options.format ?? 'YYYY-MM-DD';
      folder = options.folder ?? '';
      templatePath = options.template;

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
        if (templateFile instanceof TFile) {
          try {
            content = await this.app.vault.read(templateFile);
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
    await this.openFileWithBehavior(path);
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
      .replace(/\{\{date:([^}]+)\}\}/g, (_, format: string) => this.formatDate(date, format))
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

  private createNewItem(startDate?: string, endDate?: string, allDay?: boolean): void {
    // Open ItemModal with pre-populated date from calendar click
    void openItemModal(this.plugin, {
      mode: 'create',
      prePopulate: {
        date_start_scheduled: startDate || new Date().toISOString(),
        date_end_scheduled: endDate || undefined,
        all_day: allDay ?? true,
        tags: ['event'],
      },
    });
  }
}

/**
 * Create the Bases view registration for the Calendar
 */
export function createCalendarViewRegistration(plugin: PlannerPlugin): BasesViewRegistration {
  return {
    name: 'Calendar',
    icon: 'calendar-range',
    factory: (controller: QueryController, containerEl: HTMLElement) => {
      return new BasesCalendarView(controller, containerEl, plugin);
    },
    options: () => [
      {
        type: 'dropdown',
        key: 'defaultView',
        displayName: 'Default view',
        default: 'dayGridMonth',
        options: {
          'multiMonthYear': 'Year',
          'dayGridMonth': 'Month',
          'timeGridWeek': 'Week',
          'timeGridDay': 'Day',
          'listWeek': 'List',
        },
      },
      {
        type: 'property',
        key: 'colorBy',
        displayName: 'Color by',
        default: 'note.calendar',
        placeholder: 'Select property',
        filter: (propId: BasesPropertyId) =>
          PropertyTypeService.isCategoricalProperty(propId, plugin.app),
      },
      {
        type: 'property',
        key: 'titleField',
        displayName: 'Title field',
        default: 'note.title',
        placeholder: 'Select property',
        filter: (propId: BasesPropertyId) =>
          PropertyTypeService.isTextProperty(propId, plugin.app),
      },
      {
        type: 'property',
        key: 'dateStartField',
        displayName: 'Date start field',
        default: 'note.date_start_scheduled',
        placeholder: 'Select property',
        filter: (propId: BasesPropertyId) =>
          PropertyTypeService.isDateProperty(propId, plugin.app),
      },
      {
        type: 'property',
        key: 'dateEndField',
        displayName: 'Date end field',
        default: 'note.date_end_scheduled',
        placeholder: 'Select property',
        filter: (propId: BasesPropertyId) =>
          PropertyTypeService.isDateProperty(propId, plugin.app),
      },
    ],
  };
}
