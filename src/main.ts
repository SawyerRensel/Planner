import { Plugin, WorkspaceLeaf } from 'obsidian';
import { PlannerSettings, DEFAULT_SETTINGS } from './types/settings';
import { PlannerSettingTab } from './settings/SettingsTab';
import { ItemService } from './services/ItemService';
import { TaskListView, TASK_LIST_VIEW_TYPE } from './views/TaskListView';
import { CalendarView, CALENDAR_VIEW_TYPE } from './views/CalendarView';
import { QuickCaptureModal } from './components/QuickCapture';
import {
  BASES_TASK_LIST_VIEW_ID,
  createTaskListViewRegistration,
} from './views/BasesTaskListView';
import {
  BASES_CALENDAR_VIEW_ID,
  createCalendarViewRegistration,
} from './views/BasesCalendarView';

export default class PlannerPlugin extends Plugin {
  settings: PlannerSettings;
  itemService: ItemService;

  async onload() {
    console.log('Loading Planner plugin');

    // Load settings
    await this.loadSettings();

    // Initialize services
    this.itemService = new ItemService(this.app, () => this.settings);

    // Register standalone views (for use outside Bases)
    this.registerView(
      TASK_LIST_VIEW_TYPE,
      (leaf) => new TaskListView(leaf, this)
    );

    this.registerView(
      CALENDAR_VIEW_TYPE,
      (leaf) => new CalendarView(leaf, this)
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

    this.addRibbonIcon('calendar', 'Open Planner Calendar', () => {
      this.activateCalendarView();
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

    if (taskListRegistered || calendarRegistered) {
      console.log('Planner: Registered Bases views');
    } else {
      console.log('Planner: Bases not enabled, skipping Bases view registration');
    }
  }

  onunload() {
    console.log('Unloading Planner plugin');
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
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

    // Create new item command
    this.addCommand({
      id: 'create-item',
      name: 'Create new item',
      callback: async () => {
        await this.createNewItem();
      },
    });

    // Quick capture command
    this.addCommand({
      id: 'quick-capture',
      name: 'Quick capture',
      callback: () => {
        new QuickCaptureModal(this).open();
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
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(TASK_LIST_VIEW_TYPE);

    if (leaves.length > 0) {
      // View already open, focus it
      leaf = leaves[0];
    } else {
      // Create new leaf in right sidebar
      leaf = workspace.getRightLeaf(false);
      if (leaf) {
        await leaf.setViewState({
          type: TASK_LIST_VIEW_TYPE,
          active: true,
        });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  async activateCalendarView() {
    const { workspace } = this.app;

    let leaf: WorkspaceLeaf | null = null;
    const leaves = workspace.getLeavesOfType(CALENDAR_VIEW_TYPE);

    if (leaves.length > 0) {
      // View already open, focus it
      leaf = leaves[0];
    } else {
      // Create new leaf in main area
      leaf = workspace.getLeaf('tab');
      if (leaf) {
        await leaf.setViewState({
          type: CALENDAR_VIEW_TYPE,
          active: true,
        });
      }
    }

    if (leaf) {
      workspace.revealLeaf(leaf);
    }
  }

  private async createNewItem() {
    const title = `New Item ${Date.now()}`;
    const item = await this.itemService.createItem(title, {
      title,
      tags: ['task'],
      status: this.settings.quickCaptureDefaultStatus,
    });

    if (item && this.settings.quickCaptureOpenAfterCreate) {
      const file = this.app.vault.getAbstractFileByPath(item.path);
      if (file) {
        await this.app.workspace.openLinkText(item.path, '', false);
      }
    }
  }
}
