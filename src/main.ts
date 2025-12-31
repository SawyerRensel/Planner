import { Plugin, WorkspaceLeaf } from 'obsidian';
import { PlannerSettings, DEFAULT_SETTINGS } from './types/settings';
import { PlannerSettingTab } from './settings/SettingsTab';
import { ItemService } from './services/ItemService';
import { TaskListView, TASK_LIST_VIEW_TYPE } from './views/TaskListView';

export default class PlannerPlugin extends Plugin {
  settings: PlannerSettings;
  itemService: ItemService;

  async onload() {
    console.log('Loading Planner plugin');

    // Load settings
    await this.loadSettings();

    // Initialize services
    this.itemService = new ItemService(this.app, () => this.settings);

    // Register views
    this.registerView(
      TASK_LIST_VIEW_TYPE,
      (leaf) => new TaskListView(leaf, this)
    );

    // Add settings tab
    this.addSettingTab(new PlannerSettingTab(this.app, this));

    // Register commands
    this.registerCommands();

    // Add ribbon icon for task list
    this.addRibbonIcon('list-checks', 'Open Planner Task List', () => {
      this.activateTaskListView();
    });

    console.log('Planner plugin loaded');
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

    // Create new item command
    this.addCommand({
      id: 'create-item',
      name: 'Create new item',
      callback: async () => {
        await this.createNewItem();
      },
    });

    // Quick capture command (placeholder)
    this.addCommand({
      id: 'quick-capture',
      name: 'Quick capture',
      callback: () => {
        // TODO: Implement quick capture modal
        console.log('Quick capture triggered');
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
