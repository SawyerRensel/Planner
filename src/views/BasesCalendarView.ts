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
import type { OpenBehavior } from '../types/settings';
import { RecurrenceService } from '../services/RecurrenceService';
import type { PlannerItem, DayOfWeek } from '../types/item';

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
  private currentView: CalendarViewType | null = null; // null means use config default
  private resizeObserver: ResizeObserver | null = null;
  private yearViewSplit: boolean = true; // true = multiMonthYear (split), false = dayGridYear (continuous)
  private recurrenceService: RecurrenceService;

  private getColorByField(): 'note.calendar' | 'note.priority' | 'note.status' {
    const value = this.config.get('colorBy') as string | undefined;
    if (value === 'note.priority' || value === 'note.status') {
      return value;
    }
    return 'note.calendar'; // default
  }

  private getDefaultView(): CalendarViewType {
    const value = this.config.get('defaultView') as string | undefined;
    const validViews: CalendarViewType[] = ['multiMonthYear', 'dayGridYear', 'dayGridMonth', 'timeGridWeek', 'timeGridDay', 'listWeek'];
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

  constructor(
    controller: QueryController,
    containerEl: HTMLElement,
    plugin: PlannerPlugin
  ) {
    super(controller);
    this.plugin = plugin;
    this.containerEl = containerEl;
    this.recurrenceService = new RecurrenceService();
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

    // Use provided view, or current view if re-rendering, or config default for first render
    const viewToUse = initialView || this.currentView || this.getDefaultView();

    this.calendar = new Calendar(this.calendarEl, {
      plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin, multiMonthPlugin],
      initialView: viewToUse,
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

    const currentColorBy = this.getColorByField();
    for (const opt of options) {
      const option = document.createElement('option');
      option.value = opt.value;
      option.textContent = opt.label;
      if (opt.value === currentColorBy) {
        option.selected = true;
      }
      select.appendChild(option);
    }

    select.addEventListener('change', () => {
      // Update Bases config - this will trigger onDataUpdated and re-render
      this.config.set('colorBy', select.value);
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

    // Get a reasonable date range for recurrence expansion
    // Default to 1 year before and after today
    const now = new Date();
    const rangeStart = new Date(now);
    rangeStart.setFullYear(rangeStart.getFullYear() - 1);
    const rangeEnd = new Date(now);
    rangeEnd.setFullYear(rangeEnd.getFullYear() + 1);

    const validFrequencies = ['daily', 'weekly', 'monthly', 'yearly'];

    for (const group of this.data.groupedData) {
      for (const entry of group.entries) {
        // Check if this is a recurring item with a valid frequency
        const repeatFrequencyRaw = entry.getValue('note.repeat_frequency' as any);

        // Validate that it's actually a valid frequency string, not a placeholder object
        const isValidRecurrence = typeof repeatFrequencyRaw === 'string' &&
                                  validFrequencies.includes(repeatFrequencyRaw);

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
   * Safely extract a string value from Bases
   */
  private getStringValue(value: unknown): string | undefined {
    if (!this.isValidBasesValue(value)) return undefined;
    if (typeof value === 'string') return value;
    return undefined;
  }

  /**
   * Safely extract a number value from Bases
   */
  private getNumberValue(value: unknown): number | undefined {
    if (!this.isValidBasesValue(value)) return undefined;
    if (typeof value === 'number') return value;
    if (typeof value === 'string') {
      const num = parseFloat(value);
      return isNaN(num) ? undefined : num;
    }
    return undefined;
  }

  /**
   * Safely extract an array value from Bases
   */
  private getArrayValue<T>(value: unknown): T[] | undefined {
    if (!this.isValidBasesValue(value)) return undefined;
    if (Array.isArray(value) && value.length > 0) return value as T[];
    return undefined;
  }

  /**
   * Extract a PlannerItem-like object from a BasesEntry for use with RecurrenceService
   */
  private extractRecurrenceData(entry: BasesEntry): Partial<PlannerItem> {
    const dateStartField = this.getDateStartField();
    const dateEndField = this.getDateEndField();

    const dateStart = entry.getValue(dateStartField as any);
    const dateEnd = entry.getValue(dateEndField as any);

    // Extract recurrence fields with proper validation
    const repeatFrequencyRaw = entry.getValue('note.repeat_frequency' as any);
    const repeatIntervalRaw = entry.getValue('note.repeat_interval' as any);
    const repeatUntilRaw = entry.getValue('note.repeat_until' as any);
    const repeatCountRaw = entry.getValue('note.repeat_count' as any);
    const repeatBydayRaw = entry.getValue('note.repeat_byday' as any);
    const repeatBymonthRaw = entry.getValue('note.repeat_bymonth' as any);
    const repeatBymonthdayRaw = entry.getValue('note.repeat_bymonthday' as any);
    const repeatBysetposRaw = entry.getValue('note.repeat_bysetpos' as any);
    const repeatCompletedDatesRaw = entry.getValue('note.repeat_completed_dates' as any);

    // Validate repeat_frequency - must be a valid frequency string
    const repeatFrequency = this.getStringValue(repeatFrequencyRaw);
    const validFrequencies = ['daily', 'weekly', 'monthly', 'yearly'];
    const validatedFrequency = repeatFrequency && validFrequencies.includes(repeatFrequency)
      ? repeatFrequency as PlannerItem['repeat_frequency']
      : undefined;

    // Get numeric bysetpos, ensure it's valid (non-zero, between -366 and 366)
    const bysetposNum = this.getNumberValue(repeatBysetposRaw);
    const validatedBysetpos = bysetposNum !== undefined && bysetposNum !== 0 &&
                              bysetposNum >= -366 && bysetposNum <= 366
      ? bysetposNum
      : undefined;

    return {
      path: entry.file.path,
      date_start_scheduled: this.isValidBasesValue(dateStart) ? this.toISOString(dateStart) : undefined,
      date_end_scheduled: this.isValidBasesValue(dateEnd) ? this.toISOString(dateEnd) : undefined,
      repeat_frequency: validatedFrequency,
      repeat_interval: this.getNumberValue(repeatIntervalRaw),
      repeat_until: this.isValidBasesValue(repeatUntilRaw) ? this.toISOString(repeatUntilRaw) : undefined,
      repeat_count: this.getNumberValue(repeatCountRaw),
      repeat_byday: this.getArrayValue<DayOfWeek>(repeatBydayRaw),
      repeat_bymonth: this.getArrayValue<number>(repeatBymonthRaw),
      repeat_bymonthday: this.getArrayValue<number>(repeatBymonthdayRaw),
      repeat_bysetpos: validatedBysetpos,
      repeat_completed_dates: this.getArrayValue<string>(repeatCompletedDatesRaw),
    };
  }

  /**
   * Expand a recurring entry into multiple calendar events
   */
  private expandRecurringEntry(entry: BasesEntry, rangeStart: Date, rangeEnd: Date): EventInput[] {
    const colorByProp = this.getColorByField();
    const titleField = this.getTitleField();
    const allDayValue = entry.getValue('note.all_day' as any);

    // Get title
    let title: string;
    if (titleField === 'file.basename') {
      title = entry.file.basename;
    } else {
      const titleValue = entry.getValue(titleField as any);
      title = titleValue ? String(titleValue) : entry.file.basename || 'Untitled';
    }

    // Get color
    const color = this.getEntryColor(entry, colorByProp);

    // Extract recurrence data
    const itemData = this.extractRecurrenceData(entry);

    // Debug: log what we're working with
    console.log('Planner: Expanding recurring item', entry.file.path, {
      date_start_scheduled: itemData.date_start_scheduled,
      date_end_scheduled: itemData.date_end_scheduled,
      repeat_frequency: itemData.repeat_frequency,
      repeat_interval: itemData.repeat_interval,
      repeat_until: itemData.repeat_until,
      repeat_byday: itemData.repeat_byday,
    });

    // Use RecurrenceService to generate occurrences
    let occurrences: Array<{ id: string; start: Date; end?: Date; isCompleted: boolean }>;
    try {
      occurrences = this.recurrenceService.generateCalendarEvents(
        itemData as PlannerItem,
        rangeStart,
        rangeEnd
      );
    } catch (error) {
      console.error('Planner: Failed to expand recurring item', entry.file.path, error);
      // Fall back to single event
      const event = this.entryToEvent(entry, colorByProp);
      return event ? [event] : [];
    }

    const events: EventInput[] = [];

    // Convert each occurrence to an EventInput
    for (const occurrence of occurrences) {
      const startStr = occurrence.start.toISOString();
      const endStr = occurrence.end?.toISOString();

      // Determine if all-day event
      const isAllDay = this.isAllDayValue(allDayValue) || !this.hasTime(startStr);

      events.push({
        id: occurrence.id,
        title: String(title),
        start: startStr,
        end: endStr,
        allDay: isAllDay,
        backgroundColor: occurrence.isCompleted ? '#9ca3af' : color, // Gray out completed occurrences
        borderColor: occurrence.isCompleted ? '#9ca3af' : color,
        textColor: this.getContrastColor(occurrence.isCompleted ? '#9ca3af' : color),
        extendedProps: {
          entry,
          occurrenceDate: occurrence.start.toISOString(),
          isRecurring: true,
          isCompleted: occurrence.isCompleted,
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

    const dateStart = entry.getValue(dateStartField as any);
    const dateEnd = entry.getValue(dateEndField as any);
    const allDayValue = entry.getValue('note.all_day' as any);

    // Must have a start date
    if (!dateStart) return null;

    // Get title using configured field, with fallbacks
    let title: string;
    if (titleField === 'file.basename') {
      title = entry.file.basename;
    } else {
      const titleValue = entry.getValue(titleField as any);
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
        if (file && 'extension' in file) {
          await leaf.openFile(file as any);
        }
        break;
      }
      default:
        await this.app.workspace.openLinkText(path, '', 'tab');
    }
  }

  private async handleEventClick(info: EventClickArg): Promise<void> {
    const entry = info.event.extendedProps.entry as BasesEntry;
    await this.openFileWithBehavior(entry.file.path);
  }

  private async handleEventDrop(info: any): Promise<void> {
    const entry = info.event.extendedProps.entry as BasesEntry;
    const newStart = info.event.start;
    const newEnd = info.event.end;

    // Update the file's frontmatter - preserve duration by updating both start and end
    await this.app.fileManager.processFrontMatter(entry.file, (fm) => {
      fm.date_start_scheduled = newStart.toISOString();
      if (newEnd) {
        fm.date_end_scheduled = newEnd.toISOString();
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
        fm.date_start_scheduled = newStart.toISOString();
      }
      if (newEnd) {
        fm.date_end_scheduled = newEnd.toISOString();
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
      date_start_scheduled: startDate || now,
      date_end_scheduled: endDate || undefined,
      all_day: allDay ?? false,
    });

    if (item) {
      await this.openFileWithBehavior(item.path);
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
      {
        type: 'dropdown',
        key: 'titleField',
        displayName: 'Title field',
        default: 'note.title',
        options: {
          'note.title': 'Title',
          'note.summary': 'Summary',
          'file.basename': 'File name',
        },
      },
      {
        type: 'dropdown',
        key: 'dateStartField',
        displayName: 'Date start field',
        default: 'note.date_start_scheduled',
        options: {
          'note.date_start_scheduled': 'Start Scheduled',
          'note.date_start_actual': 'Start Actual',
          'note.date_created': 'Date Created',
        },
      },
      {
        type: 'dropdown',
        key: 'dateEndField',
        displayName: 'Date end field',
        default: 'note.date_end_scheduled',
        options: {
          'note.date_end_scheduled': 'End Scheduled',
          'note.date_end_actual': 'End Actual',
          'note.date_modified': 'Date Modified',
        },
      },
    ],
  };
}
