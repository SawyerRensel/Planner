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
    console.log('Loading Planner plugin');

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
    this.addRibbonIcon('list-checks', 'Open Planner Task List', () => {
      this.activateTaskListView();
    });

    this.addRibbonIcon('calendar-fold', 'Open Planner Calendar', () => {
      this.activateCalendarView();
    });

    this.addRibbonIcon('square-chart-gantt', 'Open Planner Timeline', () => {
      this.activateTimelineView();
    });

    this.addRibbonIcon('kanban', 'Open Planner Kanban', () => {
      this.activateKanbanView();
    });

    console.log('Planner plugin loaded');
  }

  /**
   * Register custom view types with Obsidian Bases
   */
  private registerBasesViews(): void {
    // Register Task List view for Bases
    const taskListRegistered = this.registerBasesView(
      BASES_TASK_LIST_VIEW_ID,
      createTaskListViewRegistration(this)
    );

    // Register Calendar view for Bases
    const calendarRegistered = this.registerBasesView(
      BASES_CALENDAR_VIEW_ID,
      createCalendarViewRegistration(this)
    );

    // Register Timeline view for Bases
    const timelineRegistered = this.registerBasesView(
      BASES_TIMELINE_VIEW_ID,
      createTimelineViewRegistration(this)
    );

    // Register Kanban view for Bases
    const kanbanRegistered = this.registerBasesView(
      BASES_KANBAN_VIEW_ID,
      createKanbanViewRegistration(this)
    );

    if (taskListRegistered || calendarRegistered || timelineRegistered || kanbanRegistered) {
      console.log('Planner: Registered Bases views');
    } else {
      console.log('Planner: Bases not enabled, skipping Bases view registration');
    }
  }

  onunload() {
    console.log('Unloading Planner plugin');
  }

  async loadSettings() {
    const loadedData = await this.loadData();
    this.settings = Object.assign({}, DEFAULT_SETTINGS, loadedData);

    // Migrate old calendarColors format to new calendars format
    if (loadedData?.calendarColors && !loadedData?.calendars) {
      const oldCalendarColors = loadedData.calendarColors as Record<string, string>;
      this.settings.calendars = {};
      for (const [name, color] of Object.entries(oldCalendarColors)) {
        // Only migrate if value is a string (old format)
        if (typeof color === 'string') {
          this.settings.calendars[name] = { color };
        }
      }
      // Save migrated settings
      await this.saveSettings();
      console.log('Planner: Migrated calendarColors to calendars format');
    }
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  private registerCommands() {
    // Open task list view
    this.addCommand({
      id: 'open-task-list',
      name: 'Open task list',
      callback: () => {
        this.activateTaskListView();
      },
    });

    // Open calendar view
    this.addCommand({
      id: 'open-calendar',
      name: 'Open calendar',
      callback: () => {
        this.activateCalendarView();
      },
    });

    // Open Timeline view
    this.addCommand({
      id: 'open-timeline',
      name: 'Open Timeline',
      callback: () => {
        this.activateTimelineView();
      },
    });

    // Create new item command (opens Item Modal)
    this.addCommand({
      id: 'create-item',
      name: 'Create new item',
      callback: () => {
        openItemModal(this, { mode: 'create' });
      },
    });

    // Quick capture command (now opens Item Modal with NLP support)
    this.addCommand({
      id: 'quick-capture',
      name: 'Quick capture',
      callback: () => {
        openItemModal(this, { mode: 'create' });
      },
    });

    // List all items command (for debugging)
    this.addCommand({
      id: 'list-items',
      name: 'List all items (debug)',
      callback: async () => {
        const items = await this.itemService.getAllItems();
        console.log('Planner items:', items);
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
