import { Plugin, TFile, Notice } from 'obsidian';
import { PlannerSettings, DEFAULT_SETTINGS } from './types/settings';
import { PlannerSettingTab } from './settings/SettingsTab';
import { ItemService } from './services/ItemService';
import { BaseGeneratorService } from './services/BaseGeneratorService';
import { TaskListView, TASK_LIST_VIEW_TYPE } from './views/TaskListView';
import { openItemModal } from './components/ItemModal';
import {
  BASES_TASK_LIST_VIEW_ID,
  createTaskListViewRegistration,
} from './views/BasesTaskListView';
import {
  BASES_CALENDAR_VIEW_ID,
  createCalendarViewRegistration,
} from './views/BasesCalendarView';
import {
  BASES_TIMELINE_VIEW_ID,
  createTimelineViewRegistration,
} from './views/BasesTimelineView';
import {
  BASES_KANBAN_VIEW_ID,
  createKanbanViewRegistration,
} from './views/BasesKanbanView';

export default class PlannerPlugin extends Plugin {
  settings: PlannerSettings;
  itemService: ItemService;
  baseGeneratorService: BaseGeneratorService;

  async onload() {
    // Load settings
    await this.loadSettings();

    // Initialize services
    this.itemService = new ItemService(this.app, () => this.settings);
    this.baseGeneratorService = new BaseGeneratorService(this.app, () => this.settings);

    // Register standalone Task List view (for use outside Bases)
    this.registerView(
      TASK_LIST_VIEW_TYPE,
      (leaf) => new TaskListView(leaf, this)
    );

    // Register Bases views
    this.registerBasesViews();

    // Add settings tab
    this.addSettingTab(new PlannerSettingTab(this.app, this));

    // Register commands
    this.registerCommands();

    // Add ribbon icons
    this.addRibbonIcon('list-checks', 'Open task list', () => {
      void this.activateTaskListView();
    });

    this.addRibbonIcon('calendar-range', 'Open calendar', () => {
      void this.activateCalendarView();
    });

    this.addRibbonIcon('square-chart-gantt', 'Open timeline', () => {
      void this.activateTimelineView();
    });

    this.addRibbonIcon('square-kanban', 'Open kanban', () => {
      void this.activateKanbanView();
    });
  }

  /**
   * Register custom view types with Obsidian Bases
   */
  private registerBasesViews(): void {
    // Register Task List view for Bases
    this.registerBasesView(
      BASES_TASK_LIST_VIEW_ID,
      createTaskListViewRegistration(this)
    );

    // Register Calendar view for Bases
    this.registerBasesView(
      BASES_CALENDAR_VIEW_ID,
      createCalendarViewRegistration(this)
    );

    // Register Timeline view for Bases
    this.registerBasesView(
      BASES_TIMELINE_VIEW_ID,
      createTimelineViewRegistration(this)
    );

    // Register Kanban view for Bases
    this.registerBasesView(
      BASES_KANBAN_VIEW_ID,
      createKanbanViewRegistration(this)
    );
  }

  onunload() {
    // Plugin cleanup handled automatically
  }

  async loadSettings() {
    type OldCalendarsFormat = Record<string, { color: string; folder?: string }>;
    const loadedData = await this.loadData() as Partial<PlannerSettings & {
      calendarColors?: Record<string, string>;
      calendars?: OldCalendarsFormat | PlannerSettings['calendars'];
    }> | null;
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

    let needsSave = false;

    // Migrate very old calendarColors format (Record<string, string>)
    if (loadedData?.calendarColors && !loadedData?.calendars) {
      const oldCalendarColors = loadedData.calendarColors;
      this.settings.calendars = [];
      for (const [name, color] of Object.entries(oldCalendarColors)) {
        if (typeof color === 'string') {
          this.settings.calendars.push({ name, color });
        }
      }
      needsSave = true;
    }
    // Migrate old calendars object format (Record<string, CalendarConfig>) to array format
    else if (loadedData?.calendars && !Array.isArray(loadedData.calendars)) {
      const oldCalendars = loadedData.calendars as OldCalendarsFormat;
      this.settings.calendars = [];
      for (const [name, config] of Object.entries(oldCalendars)) {
        this.settings.calendars.push({ name, color: config.color, folder: config.folder });
      }
      needsSave = true;
    }

    if (needsSave) {
      await this.saveSettings();
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private registerCommands() {
    // Open Task List View
    this.addCommand({
      id: 'open-task-list',
      name: 'Open task list view',
      callback: () => {
        void this.activateTaskListView();
      },
    });

    // Open Calendar View
    this.addCommand({
      id: 'open-calendar',
      name: 'Open calendar view',
      callback: () => {
        void this.activateCalendarView();
      },
    });

    // Open Timeline View
    this.addCommand({
      id: 'open-timeline',
      name: 'Open timeline view',
      callback: () => {
        void this.activateTimelineView();
      },
    });

    // Open Kanban View
    this.addCommand({
      id: 'open-kanban',
      name: 'Open kanban view',
      callback: () => {
        void this.activateKanbanView();
      },
    });

    // Create New Item command (opens Item Modal)
    this.addCommand({
      id: 'create-item',
      name: 'Create new item',
      callback: () => {
        void openItemModal(this, { mode: 'create' });
      },
    });

    // Quick Capture command (opens Item Modal with NLP support)
    this.addCommand({
      id: 'quick-capture',
      name: 'Quick capture',
      callback: () => {
        void openItemModal(this, { mode: 'create' });
      },
    });

    // Navigate to today in calendar
    this.addCommand({
      id: 'calendar-today',
      name: 'Calendar: go to today',
      callback: () => {
        // Dispatch custom event that calendar view listens for
        window.dispatchEvent(new CustomEvent('planner:calendar-today'));
      },
    });

    // Navigate forward in calendar
    this.addCommand({
      id: 'calendar-next',
      name: 'Calendar: go to next period',
      callback: () => {
        window.dispatchEvent(new CustomEvent('planner:calendar-next'));
      },
    });

    // Navigate backward in calendar
    this.addCommand({
      id: 'calendar-prev',
      name: 'Calendar: go to previous period',
      callback: () => {
        window.dispatchEvent(new CustomEvent('planner:calendar-prev'));
      },
    });
  }

  async activateTaskListView() {
    const basePath = this.baseGeneratorService.getTasksBasePath();
    await this.openBaseFile(basePath, 'Tasks');
  }

  async activateCalendarView() {
    const basePath = this.baseGeneratorService.getCalendarBasePath();
    await this.openBaseFile(basePath, 'Calendar');
  }

  async activateTimelineView() {
    const basePath = this.baseGeneratorService.getTimelineBasePath();
    await this.openBaseFile(basePath, 'Timeline');
  }

  async activateKanbanView() {
    const basePath = this.baseGeneratorService.getKanbanBasePath();
    await this.openBaseFile(basePath, 'Kanban');
  }

  /**
   * Open a .base file, creating it if it doesn't exist
   */
  private async openBaseFile(path: string, name: string): Promise<void> {
    const file = this.app.vault.getAbstractFileByPath(path);

    if (file instanceof TFile) {
      // File exists, open it
      await this.app.workspace.openLinkText(path, '', false);
    } else {
      // File doesn't exist, create it first
      let created = false;
      if (name === 'Tasks') {
        created = await this.baseGeneratorService.generateTasksBase(false);
      } else if (name === 'Calendar') {
        created = await this.baseGeneratorService.generateCalendarBase(false);
      } else if (name === 'Timeline') {
        created = await this.baseGeneratorService.generateTimelineBase(false);
      } else if (name === 'Kanban') {
        created = await this.baseGeneratorService.generateKanbanBase(false);
      }

      if (created) {
        new Notice(`Created ${name}.base file`);
      }

      // Now open it
      await this.app.workspace.openLinkText(path, '', false);
    }
  }

}
