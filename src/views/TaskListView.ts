import { ItemView, WorkspaceLeaf, Menu, setIcon } from 'obsidian';
import type PlannerPlugin from '../main';
import { PlannerItem, isTask, isParent } from '../types/item';
import { getStatusConfig, getPriorityConfig, getCalendarColor } from '../types/settings';

export const TASK_LIST_VIEW_TYPE = 'planner-task-list';

type SortField = 'title' | 'status' | 'priority' | 'date_start' | 'date_due' | 'calendar';
type SortDirection = 'asc' | 'desc';

interface SortState {
  field: SortField;
  direction: SortDirection;
}

export class TaskListView extends ItemView {
  plugin: PlannerPlugin;
  private items: PlannerItem[] = [];
  private sortState: SortState = { field: 'date_due', direction: 'asc' };
  private filterTasksOnly = true;
  private showCompleted = false;
  private contentEl: HTMLElement;

  constructor(leaf: WorkspaceLeaf, plugin: PlannerPlugin) {
    super(leaf);
    this.plugin = plugin;
  }

  getViewType(): string {
    return TASK_LIST_VIEW_TYPE;
  }

  getDisplayText(): string {
    return 'Planner: Task List';
  }

  getIcon(): string {
    return 'list-checks';
  }

  async onOpen() {
    this.contentEl = this.containerEl.children[1] as HTMLElement;
    this.contentEl.empty();
    this.contentEl.addClass('planner-task-list-view');

    await this.refresh();

    // Listen for file changes
    this.registerEvent(
      this.app.metadataCache.on('changed', () => {
        this.refresh();
      })
    );

    this.registerEvent(
      this.app.vault.on('create', () => {
        this.refresh();
      })
    );

    this.registerEvent(
      this.app.vault.on('delete', () => {
        this.refresh();
      })
    );
  }

  async onClose() {
    this.contentEl.empty();
  }

  async refresh() {
    this.items = await this.plugin.itemService.getAllItems();
    this.render();
  }

  private render() {
    this.contentEl.empty();

    // Toolbar
    const toolbar = this.contentEl.createDiv({ cls: 'planner-toolbar' });
    this.renderToolbar(toolbar);

    // Table
    const tableContainer = this.contentEl.createDiv({ cls: 'planner-table-container' });
    this.renderTable(tableContainer);
  }

  private renderToolbar(container: HTMLElement) {
    // Filter: Tasks only toggle
    const tasksToggle = container.createDiv({ cls: 'planner-toggle' });
    const tasksCheckbox = tasksToggle.createEl('input', {
      type: 'checkbox',
      attr: { id: 'filter-tasks' }
    });
    tasksCheckbox.checked = this.filterTasksOnly;
    tasksCheckbox.addEventListener('change', () => {
      this.filterTasksOnly = tasksCheckbox.checked;
      this.render();
    });
    tasksToggle.createEl('label', { text: 'Tasks only', attr: { for: 'filter-tasks' } });

    // Filter: Show completed toggle
    const completedToggle = container.createDiv({ cls: 'planner-toggle' });
    const completedCheckbox = completedToggle.createEl('input', {
      type: 'checkbox',
      attr: { id: 'filter-completed' }
    });
    completedCheckbox.checked = this.showCompleted;
    completedCheckbox.addEventListener('change', () => {
      this.showCompleted = completedCheckbox.checked;
      this.render();
    });
    completedToggle.createEl('label', { text: 'Show completed', attr: { for: 'filter-completed' } });

    // Refresh button
    const refreshBtn = container.createEl('button', { cls: 'planner-btn' });
    setIcon(refreshBtn, 'refresh-cw');
    refreshBtn.setAttribute('aria-label', 'Refresh');
    refreshBtn.addEventListener('click', () => this.refresh());

    // New item button
    const newBtn = container.createEl('button', { cls: 'planner-btn planner-btn-primary' });
    setIcon(newBtn, 'plus');
    newBtn.createSpan({ text: ' New' });
    newBtn.addEventListener('click', () => this.createNewItem());
  }

  private renderTable(container: HTMLElement) {
    const table = container.createEl('table', { cls: 'planner-table' });

    // Header
    const thead = table.createEl('thead');
    const headerRow = thead.createEl('tr');

    const columns: { field: SortField; label: string; width?: string }[] = [
      { field: 'title', label: 'Title' },
      { field: 'status', label: 'Status', width: '120px' },
      { field: 'priority', label: 'Priority', width: '100px' },
      { field: 'date_start', label: 'Start', width: '110px' },
      { field: 'date_due', label: 'Due', width: '110px' },
      { field: 'calendar', label: 'Calendar', width: '120px' },
    ];

    for (const col of columns) {
      const th = headerRow.createEl('th');
      if (col.width) th.style.width = col.width;

      const headerContent = th.createDiv({ cls: 'planner-th-content' });
      headerContent.createSpan({ text: col.label });

      // Sort indicator
      if (this.sortState.field === col.field) {
        const sortIcon = headerContent.createSpan({ cls: 'planner-sort-icon' });
        setIcon(sortIcon, this.sortState.direction === 'asc' ? 'chevron-up' : 'chevron-down');
      }

      th.addEventListener('click', () => this.toggleSort(col.field));
    }

    // Body
    const tbody = table.createEl('tbody');
    const filteredItems = this.getFilteredAndSortedItems();

    if (filteredItems.length === 0) {
      const emptyRow = tbody.createEl('tr');
      const emptyCell = emptyRow.createEl('td', {
        attr: { colspan: String(columns.length) },
        cls: 'planner-empty'
      });
      emptyCell.createSpan({ text: 'No items found' });
    } else {
      for (const item of filteredItems) {
        this.renderItemRow(tbody, item);
      }
    }
  }

  private renderItemRow(tbody: HTMLElement, item: PlannerItem) {
    const row = tbody.createEl('tr', { cls: 'planner-row' });
    row.addEventListener('click', () => this.openItem(item));
    row.addEventListener('contextmenu', (e) => this.showContextMenu(e, item));

    // Title
    const titleCell = row.createEl('td', { cls: 'planner-cell-title' });
    const titleContent = titleCell.createDiv({ cls: 'planner-title-content' });

    // Parent indicator
    if (isParent(item)) {
      const parentIcon = titleContent.createSpan({ cls: 'planner-icon' });
      setIcon(parentIcon, 'folder');
    }

    // Blocked indicator
    if (item.blocked_by && item.blocked_by.length > 0) {
      const blockedIcon = titleContent.createSpan({ cls: 'planner-icon planner-blocked' });
      setIcon(blockedIcon, 'lock');
      blockedIcon.setAttribute('aria-label', `Blocked by ${item.blocked_by.length} item(s)`);
    }

    titleContent.createSpan({ text: item.title || item.path.split('/').pop()?.replace('.md', '') || 'Untitled' });

    // Status
    const statusCell = row.createEl('td');
    if (item.status) {
      const statusConfig = getStatusConfig(this.plugin.settings, item.status);
      const badge = statusCell.createSpan({ cls: 'planner-badge', text: item.status });
      if (statusConfig) {
        badge.style.backgroundColor = statusConfig.color;
        badge.style.color = this.getContrastColor(statusConfig.color);
      }
    }

    // Priority
    const priorityCell = row.createEl('td');
    if (item.priority) {
      const priorityConfig = getPriorityConfig(this.plugin.settings, item.priority);
      const badge = priorityCell.createSpan({ cls: 'planner-badge', text: item.priority });
      if (priorityConfig) {
        badge.style.backgroundColor = priorityConfig.color;
        badge.style.color = this.getContrastColor(priorityConfig.color);
      }
    }

    // Date Start
    const startCell = row.createEl('td', { cls: 'planner-cell-date' });
    if (item.date_start) {
      startCell.setText(this.formatDate(item.date_start));
    }

    // Date Due
    const dueCell = row.createEl('td', { cls: 'planner-cell-date' });
    if (item.date_due) {
      const isOverdue = new Date(item.date_due) < new Date() && !this.isCompleted(item);
      dueCell.setText(this.formatDate(item.date_due));
      if (isOverdue) {
        dueCell.addClass('planner-overdue');
      }
    }

    // Calendar
    const calendarCell = row.createEl('td');
    if (item.calendar && item.calendar.length > 0) {
      const calendarName = item.calendar[0];
      const color = getCalendarColor(this.plugin.settings, calendarName);
      const badge = calendarCell.createSpan({ cls: 'planner-badge', text: calendarName });
      badge.style.backgroundColor = color;
      badge.style.color = this.getContrastColor(color);
    }
  }

  private getFilteredAndSortedItems(): PlannerItem[] {
    let items = [...this.items];

    // Filter: tasks only
    if (this.filterTasksOnly) {
      items = items.filter(item => isTask(item));
    }

    // Filter: hide completed
    if (!this.showCompleted) {
      items = items.filter(item => !this.isCompleted(item));
    }

    // Sort
    items.sort((a, b) => {
      const aVal = this.getSortValue(a, this.sortState.field);
      const bVal = this.getSortValue(b, this.sortState.field);

      let comparison = 0;
      if (aVal === null && bVal === null) comparison = 0;
      else if (aVal === null) comparison = 1;
      else if (bVal === null) comparison = -1;
      else if (aVal < bVal) comparison = -1;
      else if (aVal > bVal) comparison = 1;

      return this.sortState.direction === 'asc' ? comparison : -comparison;
    });

    return items;
  }

  private getSortValue(item: PlannerItem, field: SortField): string | number | null {
    switch (field) {
      case 'title':
        return item.title?.toLowerCase() ?? item.path.toLowerCase();
      case 'status':
        return item.status ?? null;
      case 'priority': {
        const config = getPriorityConfig(this.plugin.settings, item.priority ?? '');
        return config?.weight ?? -1;
      }
      case 'date_start':
        return item.date_start ?? null;
      case 'date_due':
        return item.date_due ?? null;
      case 'calendar':
        return item.calendar?.[0] ?? null;
      default:
        return null;
    }
  }

  private toggleSort(field: SortField) {
    if (this.sortState.field === field) {
      this.sortState.direction = this.sortState.direction === 'asc' ? 'desc' : 'asc';
    } else {
      this.sortState.field = field;
      this.sortState.direction = 'asc';
    }
    this.render();
  }

  private isCompleted(item: PlannerItem): boolean {
    if (!item.status) return false;
    const config = getStatusConfig(this.plugin.settings, item.status);
    return config?.isCompleted ?? false;
  }

  private formatDate(dateStr: string): string {
    const date = new Date(dateStr);
    const format = this.plugin.settings.dateFormat;

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    switch (format) {
      case 'MM/DD/YYYY':
        return `${month}/${day}/${year}`;
      case 'DD/MM/YYYY':
        return `${day}/${month}/${year}`;
      case 'MMM D, YYYY': {
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        return `${monthNames[date.getMonth()]} ${date.getDate()}, ${year}`;
      }
      default:
        return `${year}-${month}-${day}`;
    }
  }

  private getContrastColor(hexColor: string): string {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substr(0, 2), 16);
    const g = parseInt(hex.substr(2, 2), 16);
    const b = parseInt(hex.substr(4, 2), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  private async openItem(item: PlannerItem) {
    await this.app.workspace.openLinkText(item.path, '', false);
  }

  private showContextMenu(event: MouseEvent, item: PlannerItem) {
    event.preventDefault();
    const menu = new Menu();

    menu.addItem((menuItem) => {
      menuItem
        .setTitle('Open')
        .setIcon('file')
        .onClick(() => this.openItem(item));
    });

    menu.addItem((menuItem) => {
      menuItem
        .setTitle('Open in new tab')
        .setIcon('file-plus')
        .onClick(() => {
          this.app.workspace.openLinkText(item.path, '', true);
        });
    });

    menu.addSeparator();

    // Quick status change
    menu.addItem((menuItem) => {
      menuItem
        .setTitle('Set status')
        .setIcon('check-circle');

      const submenu = (menuItem as any).setSubmenu();
      for (const status of this.plugin.settings.statuses) {
        submenu.addItem((subItem: any) => {
          subItem
            .setTitle(status.name)
            .onClick(async () => {
              await this.plugin.itemService.updateItem(item.path, { status: status.name });
              await this.refresh();
            });
        });
      }
    });

    menu.addSeparator();

    menu.addItem((menuItem) => {
      menuItem
        .setTitle('Delete')
        .setIcon('trash')
        .onClick(async () => {
          await this.plugin.itemService.deleteItem(item.path);
          await this.refresh();
        });
    });

    menu.showAtMouseEvent(event);
  }

  private async createNewItem() {
    const title = `New Task`;
    const item = await this.plugin.itemService.createItem(title, {
      title,
      tags: ['task'],
      status: this.plugin.settings.quickCaptureDefaultStatus,
    });

    if (item) {
      await this.refresh();
      await this.openItem(item);
    }
  }
}
