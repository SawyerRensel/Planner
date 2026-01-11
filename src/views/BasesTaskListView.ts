import {
  BasesView,
  BasesViewRegistration,
  BasesEntry,
  BasesPropertyId,
  QueryController,
  setIcon,
  Menu,
} from 'obsidian';
import type PlannerPlugin from '../main';
import { openItemModal } from '../components/ItemModal';

export const BASES_TASK_LIST_VIEW_ID = 'planner-task-list';

/**
 * Task List view for Obsidian Bases
 * Displays items in a sortable table format
 */
/**
 * Virtual scroll threshold - enables virtual scrolling when table has 50+ rows
 */
const VIRTUAL_SCROLL_THRESHOLD = 50;

export class BasesTaskListView extends BasesView {
  type = BASES_TASK_LIST_VIEW_ID;
  private plugin: PlannerPlugin;
  private containerEl: HTMLElement;
  private tableEl: HTMLElement | null = null;
  private virtualScrollObserver: IntersectionObserver | null = null;

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
   * Clean up resources when view is unloaded
   */
  onunload(): void {
    if (this.virtualScrollObserver) {
      this.virtualScrollObserver.disconnect();
      this.virtualScrollObserver = null;
    }
  }

  /**
   * Called when data changes - re-render the view
   */
  onDataUpdated(): void {
    this.render();
  }

  private render(): void {
    this.containerEl.empty();
    this.containerEl.addClass('planner-bases-task-list');

    // Create table
    const tableContainer = this.containerEl.createDiv({ cls: 'planner-table-container' });
    this.tableEl = tableContainer.createEl('table', { cls: 'planner-table' });

    this.renderHeader();
    this.renderBody();
  }

  private renderHeader(): void {
    if (!this.tableEl) return;

    const thead = this.tableEl.createEl('thead');
    const headerRow = thead.createEl('tr');

    // Get ordered properties from config, or use defaults
    const orderedProps = this.config.getOrder();
    const propsToShow = orderedProps.length > 0 ? orderedProps : this.getDefaultProperties();

    for (const propId of propsToShow) {
      const th = headerRow.createEl('th');
      const displayName = this.config.getDisplayName(propId);
      th.createSpan({ text: displayName });
    }
  }

  private renderBody(): void {
    if (!this.tableEl) return;

    // Clean up previous observer
    if (this.virtualScrollObserver) {
      this.virtualScrollObserver.disconnect();
      this.virtualScrollObserver = null;
    }

    const tbody = this.tableEl.createEl('tbody');
    const groupedData = this.data.groupedData;

    // Count total entries
    let totalEntries = 0;
    for (const group of groupedData) {
      totalEntries += group.entries.length;
    }

    // Use virtual scrolling for large datasets
    const useVirtualScroll = totalEntries >= VIRTUAL_SCROLL_THRESHOLD;

    if (useVirtualScroll) {
      this.renderBodyVirtual(tbody, groupedData);
    } else {
      this.renderBodyDirect(tbody, groupedData);
    }

    // Empty state
    if (groupedData.length === 0 || groupedData.every(g => g.entries.length === 0)) {
      const emptyRow = tbody.createEl('tr');
      const emptyCell = emptyRow.createEl('td', {
        attr: { colspan: String(this.getPropertyCount()) },
        cls: 'planner-empty'
      });
      emptyCell.createSpan({ text: 'No items found' });
    }
  }

  /**
   * Direct rendering for small datasets
   */
  private renderBodyDirect(tbody: HTMLElement, groupedData: any[]): void {
    for (const group of groupedData) {
      if (group.hasKey()) {
        const groupRow = tbody.createEl('tr', { cls: 'planner-group-row' });
        const groupCell = groupRow.createEl('td', {
          attr: { colspan: String(this.getPropertyCount()) }
        });
        groupCell.createSpan({
          text: String(group.key?.toString() ?? 'Ungrouped'),
          cls: 'planner-group-label'
        });
      }

      for (const entry of group.entries) {
        this.renderEntryRow(tbody, entry);
      }
    }
  }

  /**
   * Virtual scroll rendering for large datasets
   * Only renders visible rows + buffer for smooth scrolling
   */
  private renderBodyVirtual(tbody: HTMLElement, groupedData: any[]): void {
    const BUFFER_SIZE = 10;
    const ESTIMATED_ROW_HEIGHT = 40; // px

    // Flatten entries with group info
    const flatEntries: Array<{ type: 'group' | 'entry'; data: any; groupKey?: string }> = [];

    for (const group of groupedData) {
      if (group.hasKey()) {
        flatEntries.push({ type: 'group', data: null, groupKey: String(group.key?.toString() ?? 'Ungrouped') });
      }
      for (const entry of group.entries) {
        flatEntries.push({ type: 'entry', data: entry });
      }
    }

    // Create placeholder rows
    const placeholders: HTMLElement[] = [];
    const renderedRows = new Set<number>();

    flatEntries.forEach((item, index) => {
      const row = tbody.createEl('tr', { cls: 'planner-row-placeholder' });
      row.setAttribute('data-index', String(index));
      row.style.height = `${ESTIMATED_ROW_HEIGHT}px`;
      placeholders.push(row);
    });

    // Create IntersectionObserver
    this.virtualScrollObserver = new IntersectionObserver(
      (observerEntries) => {
        for (const observerEntry of observerEntries) {
          if (!observerEntry.isIntersecting) continue;

          const row = observerEntry.target as HTMLElement;
          const index = parseInt(row.getAttribute('data-index') || '-1', 10);

          if (index < 0 || renderedRows.has(index)) continue;

          // Render this row and buffer rows
          const start = Math.max(0, index - BUFFER_SIZE);
          const end = Math.min(flatEntries.length, index + BUFFER_SIZE + 1);

          for (let i = start; i < end; i++) {
            if (renderedRows.has(i)) continue;
            renderedRows.add(i);

            const item = flatEntries[i];
            const placeholder = placeholders[i];
            placeholder.style.height = '';
            placeholder.classList.remove('planner-row-placeholder');

            if (item.type === 'group') {
              placeholder.classList.add('planner-group-row');
              const groupCell = placeholder.createEl('td', {
                attr: { colspan: String(this.getPropertyCount()) }
              });
              groupCell.createSpan({
                text: item.groupKey || 'Ungrouped',
                cls: 'planner-group-label'
              });
            } else {
              this.populateEntryRow(placeholder, item.data);
            }
          }
        }
      },
      {
        root: this.containerEl,
        rootMargin: '100px 0px',
        threshold: 0
      }
    );

    // Observe all placeholders
    placeholders.forEach(placeholder => this.virtualScrollObserver?.observe(placeholder));
  }

  /**
   * Populate an existing row element with entry data
   */
  private populateEntryRow(row: HTMLElement, entry: BasesEntry): void {
    row.classList.add('planner-row');

    row.addEventListener('click', async () => {
      const item = await this.plugin.itemService.getItem(entry.file.path);
      if (item) {
        openItemModal(this.plugin, { mode: 'edit', item });
      } else {
        this.app.workspace.openLinkText(entry.file.path, '', false);
      }
    });

    row.addEventListener('contextmenu', (e) => {
      this.showContextMenu(e, entry);
    });

    const orderedProps = this.config.getOrder();
    const propsToShow = orderedProps.length > 0 ? orderedProps : this.getDefaultProperties();

    for (const propId of propsToShow) {
      const td = row.createEl('td');
      const value = entry.getValue(propId);
      if (value !== null) {
        this.renderValue(td, propId, value);
      }
    }
  }

  private renderEntryRow(tbody: HTMLElement, entry: BasesEntry): void {
    const row = tbody.createEl('tr', { cls: 'planner-row' });

    // Click to open ItemModal for editing
    row.addEventListener('click', async () => {
      const item = await this.plugin.itemService.getItem(entry.file.path);
      if (item) {
        openItemModal(this.plugin, { mode: 'edit', item });
      } else {
        // Fallback to opening the file
        this.app.workspace.openLinkText(entry.file.path, '', false);
      }
    });

    // Context menu
    row.addEventListener('contextmenu', (e) => {
      this.showContextMenu(e, entry);
    });

    // Get ordered properties
    const orderedProps = this.config.getOrder();
    const propsToShow = orderedProps.length > 0 ? orderedProps : this.getDefaultProperties();

    for (const propId of propsToShow) {
      const td = row.createEl('td');
      const value = entry.getValue(propId);

      if (value !== null) {
        this.renderValue(td, propId, value);
      }
    }
  }

  private renderValue(cell: HTMLElement, propId: BasesPropertyId, value: any): void {
    const propName = propId.split('.')[1];

    // Special rendering for known properties
    if (propName === 'status' || propName === 'priority') {
      const config = propName === 'status'
        ? this.plugin.settings.statuses.find(s => s.name === String(value))
        : this.plugin.settings.priorities.find(p => p.name === String(value));

      if (config) {
        const badge = cell.createSpan({ cls: 'planner-badge', text: String(value) });
        badge.style.backgroundColor = config.color;
        badge.style.color = this.getContrastColor(config.color);
        return;
      }
    }

    if (propName === 'calendar' && value) {
      const calendarName = Array.isArray(value) ? value[0] : String(value);
      const color = this.plugin.settings.calendars[calendarName]?.color ?? '#6b7280';
      const badge = cell.createSpan({ cls: 'planner-badge', text: calendarName });
      badge.style.backgroundColor = color;
      badge.style.color = this.getContrastColor(color);
      return;
    }

    if (propName === 'progress' && typeof value === 'number') {
      const progressBar = cell.createDiv({ cls: 'planner-progress-bar' });
      const progressFill = progressBar.createDiv({ cls: 'planner-progress-fill' });
      progressFill.style.width = `${value}%`;
      cell.createSpan({ text: `${value}%`, cls: 'planner-progress-text' });
      return;
    }

    // Date fields
    if (propName?.startsWith('date_') && value) {
      const dateStr = String(value);
      cell.addClass('planner-cell-date');
      cell.setText(this.formatDate(dateStr));

      // Check for overdue
      if (propName === 'date_due') {
        const dueDate = new Date(dateStr);
        if (dueDate < new Date()) {
          cell.addClass('planner-overdue');
        }
      }
      return;
    }

    // Default: just show the value
    if (value !== null && value !== undefined) {
      cell.setText(String(value));
    }
  }

  private getDefaultProperties(): BasesPropertyId[] {
    // Default columns if none configured
    return [
      'note.title',
      'note.status',
      'note.priority',
      'note.date_start',
      'note.date_due',
      'note.calendar',
    ] as BasesPropertyId[];
  }

  private getPropertyCount(): number {
    const orderedProps = this.config.getOrder();
    return orderedProps.length > 0 ? orderedProps.length : this.getDefaultProperties().length;
  }

  private formatDate(dateStr: string): string {
    try {
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
          const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                             'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
          return `${monthNames[date.getMonth()]} ${date.getDate()}, ${year}`;
        }
        default:
          return `${year}-${month}-${day}`;
      }
    } catch {
      return dateStr;
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

  private showContextMenu(event: MouseEvent, entry: BasesEntry): void {
    event.preventDefault();
    const menu = new Menu();

    menu.addItem((item) => {
      item
        .setTitle('Open')
        .setIcon('file')
        .onClick(() => {
          this.app.workspace.openLinkText(entry.file.path, '', false);
        });
    });

    menu.addItem((item) => {
      item
        .setTitle('Open in new tab')
        .setIcon('file-plus')
        .onClick(() => {
          this.app.workspace.openLinkText(entry.file.path, '', true);
        });
    });

    menu.showAtMouseEvent(event);
  }
}

/**
 * Create the Bases view registration for the Task List
 */
export function createTaskListViewRegistration(plugin: PlannerPlugin): BasesViewRegistration {
  return {
    name: 'Task List',
    icon: 'list-checks',
    factory: (controller: QueryController, containerEl: HTMLElement) => {
      return new BasesTaskListView(controller, containerEl, plugin);
    },
    options: () => [
      // View options can be added here in the future
      // These appear in the view's settings menu
    ],
  };
}
