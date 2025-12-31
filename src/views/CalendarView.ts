import { ItemView, WorkspaceLeaf, Menu } from 'obsidian';
import { Calendar, EventInput, EventClickArg, DateSelectArg } from '@fullcalendar/core';
import dayGridPlugin from '@fullcalendar/daygrid';
import timeGridPlugin from '@fullcalendar/timegrid';
import listPlugin from '@fullcalendar/list';
import interactionPlugin from '@fullcalendar/interaction';
import type PlannerPlugin from '../main';
import { PlannerItem, isRecurring } from '../types/item';
import { getCalendarColor, getStatusConfig } from '../types/settings';
import { RecurrenceService } from '../services/RecurrenceService';

export const CALENDAR_VIEW_TYPE = 'planner-calendar';

type CalendarViewType = 'dayGridMonth' | 'dayGridYear' | 'timeGridWeek' | 'timeGridDay' | 'listWeek';

export class CalendarView extends ItemView {
  plugin: PlannerPlugin;
  private calendar: Calendar | null = null;
  private items: PlannerItem[] = [];
  private currentView: CalendarViewType = 'dayGridMonth';
  private colorByField: 'calendar' | 'priority' | 'status' = 'calendar';
  private recurrenceService: RecurrenceService;

  constructor(leaf: WorkspaceLeaf, plugin: PlannerPlugin) {
    super(leaf);
    this.plugin = plugin;
    this.recurrenceService = new RecurrenceService();
  }

  getViewType(): string {
    return CALENDAR_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Planner: Calendar';
  }

  getIcon(): string {
    return 'calendar';
  }

  async onOpen() {
    const container = this.containerEl.children[1] as HTMLElement;
    container.empty();
    container.addClass('planner-calendar-view');

    // Toolbar
    const toolbar = container.createDiv({ cls: 'planner-calendar-toolbar' });
    this.renderToolbar(toolbar);

    // Calendar container
    const calendarEl = container.createDiv({ cls: 'planner-calendar-container' });

    // Initialize FullCalendar
    await this.initCalendar(calendarEl);

    // Listen for file changes
    this.registerEvent(
      this.app.metadataCache.on('changed', () => {
        this.refreshEvents();
      })
    );

    this.registerEvent(
      this.app.vault.on('create', () => {
        this.refreshEvents();
      })
    );

    this.registerEvent(
      this.app.vault.on('delete', () => {
        this.refreshEvents();
      })
    );
  }

  async onClose() {
    if (this.calendar) {
      this.calendar.destroy();
      this.calendar = null;
    }
  }

  private renderToolbar(toolbar: HTMLElement) {
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
        this.changeView(view.type);
        // Update button states
        viewSelector.querySelectorAll('.planner-view-btn').forEach(b => b.removeClass('active'));
        btn.addClass('active');
      });
    }

    // Color by selector
    const colorByContainer = toolbar.createDiv({ cls: 'planner-color-by' });
    colorByContainer.createSpan({ text: 'Color by: ' });
    const colorBySelect = colorByContainer.createEl('select');

    const colorOptions = [
      { value: 'calendar', label: 'Calendar' },
      { value: 'priority', label: 'Priority' },
      { value: 'status', label: 'Status' },
    ];

    for (const opt of colorOptions) {
      const option = colorBySelect.createEl('option', {
        value: opt.value,
        text: opt.label
      });
      if (opt.value === this.colorByField) {
        option.selected = true;
      }
    }

    colorBySelect.addEventListener('change', () => {
      this.colorByField = colorBySelect.value as typeof this.colorByField;
      this.refreshEvents();
    });

    // New item button
    const newBtn = toolbar.createEl('button', { cls: 'planner-btn planner-btn-primary' });
    newBtn.createSpan({ text: '+ New' });
    newBtn.addEventListener('click', () => this.createNewItem());
  }

  private async initCalendar(containerEl: HTMLElement) {
    this.items = await this.plugin.itemService.getAllItems();

    const weekStartsOn = this.getWeekStartDay();

    this.calendar = new Calendar(containerEl, {
      plugins: [dayGridPlugin, timeGridPlugin, listPlugin, interactionPlugin],
      initialView: this.currentView,
      headerToolbar: {
        left: 'prev,next today',
        center: 'title',
        right: '',
      },
      firstDay: weekStartsOn,
      selectable: true,
      editable: true,
      eventStartEditable: true,
      eventDurationEditable: true,
      events: this.getEvents(),
      eventClick: (info) => this.handleEventClick(info),
      select: (info) => this.handleDateSelect(info),
      eventDrop: (info) => this.handleEventDrop(info),
      eventResize: (info) => this.handleEventResize(info),
      height: '100%',
      nowIndicator: true,
      dayMaxEvents: true,
    });

    this.calendar.render();
  }

  private getEvents(): EventInput[] {
    const events: EventInput[] = [];

    // Get visible date range (default to 3 months ahead)
    const rangeStart = new Date();
    rangeStart.setMonth(rangeStart.getMonth() - 1);
    const rangeEnd = new Date();
    rangeEnd.setMonth(rangeEnd.getMonth() + 3);

    for (const item of this.items) {
      if (!item.date_start && !item.date_due) {
        continue;
      }

      if (isRecurring(item)) {
        // Generate recurring events
        const occurrences = this.recurrenceService.generateCalendarEvents(
          item,
          rangeStart,
          rangeEnd
        );

        for (const occurrence of occurrences) {
          events.push(this.itemToEvent(item, occurrence.start, occurrence.end, occurrence.isCompleted));
        }
      } else {
        // Single event
        events.push(this.itemToEvent(item));
      }
    }

    return events;
  }

  private itemToEvent(
    item: PlannerItem,
    overrideStart?: Date,
    overrideEnd?: Date,
    isInstanceCompleted?: boolean
  ): EventInput {
    const color = this.getItemColor(item);
    const isCompleted = isInstanceCompleted ?? (item.status ? this.isCompletedStatus(item.status) : false);

    const startDate = overrideStart
      ? overrideStart.toISOString()
      : (item.date_start || item.date_due);

    const endDate = overrideEnd
      ? overrideEnd.toISOString()
      : item.date_end;

    // Generate unique ID for recurring instances
    const eventId = overrideStart
      ? `${item.path}::${overrideStart.toISOString()}`
      : item.path;

    return {
      id: eventId,
      title: item.title || item.path.split('/').pop()?.replace('.md', '') || 'Untitled',
      start: startDate,
      end: endDate || undefined,
      allDay: item.all_day ?? !this.hasTime(item.date_start),
      backgroundColor: color,
      borderColor: color,
      textColor: this.getContrastColor(color),
      extendedProps: {
        item,
        isRecurringInstance: !!overrideStart,
        instanceDate: overrideStart,
      },
      classNames: isCompleted ? ['planner-event-completed'] : [],
    };
  }

  private getItemColor(item: PlannerItem): string {
    switch (this.colorByField) {
      case 'calendar': {
        const calendarName = item.calendar?.[0];
        if (calendarName) {
          return getCalendarColor(this.plugin.settings, calendarName);
        }
        break;
      }
      case 'priority': {
        const priority = this.plugin.settings.priorities.find(p => p.name === item.priority);
        if (priority) {
          return priority.color;
        }
        break;
      }
      case 'status': {
        const status = getStatusConfig(this.plugin.settings, item.status ?? '');
        if (status) {
          return status.color;
        }
        break;
      }
    }
    return '#6b7280'; // Default gray
  }

  private hasTime(dateStr: string | undefined): boolean {
    if (!dateStr) return false;
    return dateStr.includes('T') && !dateStr.endsWith('T00:00:00');
  }

  private isCompletedStatus(status: string): boolean {
    const config = getStatusConfig(this.plugin.settings, status);
    return config?.isCompleted ?? false;
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

  private changeView(viewType: CalendarViewType) {
    this.currentView = viewType;
    if (this.calendar) {
      this.calendar.changeView(viewType);
    }
  }

  private async refreshEvents() {
    this.items = await this.plugin.itemService.getAllItems();
    if (this.calendar) {
      this.calendar.removeAllEvents();
      this.calendar.addEventSource(this.getEvents());
    }
  }

  private handleEventClick(info: EventClickArg) {
    const item = info.event.extendedProps.item as PlannerItem;

    // Show context menu on right-click, open on left-click
    this.app.workspace.openLinkText(item.path, '', false);
  }

  private handleDateSelect(info: DateSelectArg) {
    // Create new item on the selected date
    this.createNewItem(info.startStr, info.endStr, info.allDay);
  }

  private async handleEventDrop(info: any) {
    const item = info.event.extendedProps.item as PlannerItem;
    const newStart = info.event.start;
    const newEnd = info.event.end;

    await this.plugin.itemService.updateItem(item.path, {
      date_start: newStart ? newStart.toISOString() : undefined,
      date_end: newEnd ? newEnd.toISOString() : undefined,
    });
  }

  private async handleEventResize(info: any) {
    const item = info.event.extendedProps.item as PlannerItem;
    const newEnd = info.event.end;

    await this.plugin.itemService.updateItem(item.path, {
      date_end: newEnd ? newEnd.toISOString() : undefined,
    });
  }

  private async createNewItem(startDate?: string, endDate?: string, allDay?: boolean) {
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
      await this.refreshEvents();
      await this.app.workspace.openLinkText(item.path, '', false);
    }
  }
}
