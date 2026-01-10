import {
  BasesView,
  BasesViewRegistration,
  BasesEntry,
  BasesPropertyId,
  QueryController,
  setIcon,
} from 'obsidian';
import type PlannerPlugin from '../main';
import { openItemModal } from '../components/ItemModal';
import { PropertyTypeService } from '../services/PropertyTypeService';
import {
  getStatusConfig,
  getPriorityConfig,
  getCalendarColor,
} from '../types/settings';

export const BASES_KANBAN_VIEW_ID = 'planner-kanban';

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

type BorderStyle = 'none' | 'left-accent' | 'full-border';
type CoverDisplay = 'none' | 'banner' | 'thumbnail-left' | 'thumbnail-right' | 'background';
type BadgePlacement = 'inline' | 'properties-section';

/**
 * Virtual scroll threshold - enables virtual scrolling when column has 15+ cards
 */
const VIRTUAL_SCROLL_THRESHOLD = 15;

/**
 * Properties that have special badge rendering (not generic property display)
 */
const BADGE_PROPERTIES = ['status', 'priority', 'calendar', 'repeat_frequency'];

/**
 * Kanban view for Obsidian Bases
 * Displays items in a drag-and-drop board with configurable columns
 */
export class BasesKanbanView extends BasesView {
  type = BASES_KANBAN_VIEW_ID;
  private plugin: PlannerPlugin;
  private containerEl: HTMLElement;
  private boardEl: HTMLElement | null = null;
  private resizeObserver: ResizeObserver | null = null;
  private colorMapCache: Record<string, string> = {};

  // Drag state
  private draggedCardPath: string | null = null;
  private draggedFromColumn: string | null = null;

  // Mobile touch drag state
  private touchDragCard: HTMLElement | null = null;
  private touchDragClone: HTMLElement | null = null;
  private touchStartX: number = 0;
  private touchStartY: number = 0;
  private scrollInterval: number | null = null;
  private touchHoldTimer: number | null = null;
  private touchHoldReady: boolean = false;
  private touchHoldCard: HTMLElement | null = null;
  private touchHoldEntry: BasesEntry | null = null;

  // Column reordering state
  private draggedColumn: HTMLElement | null = null;
  private draggedColumnKey: string | null = null;

  // Swimlane reordering state
  private draggedSwimlane: HTMLElement | null = null;
  private draggedSwimlaneKey: string | null = null;

  // Swimlane touch drag state (for mobile)
  private touchDragSwimlane: HTMLElement | null = null;
  private touchDragSwimlaneClone: HTMLElement | null = null;
  private touchSwimlaneStartX: number = 0;
  private touchSwimlaneStartY: number = 0;
  private touchSwimlaneHoldTimer: number | null = null;
  private touchSwimlaneHoldReady: boolean = false;

  // Configuration getters
  private getGroupBy(): string {
    const value = this.config.get('groupBy') as string | undefined;
    return value || 'note.status';
  }

  private getSwimlaneBy(): string | null {
    const value = this.config.get('swimlaneBy') as string | undefined;
    return value || null;
  }

  private getColorBy(): string {
    const value = this.config.get('colorBy') as string | undefined;
    return value || 'note.calendar';
  }

  private getBorderStyle(): BorderStyle {
    const value = this.config.get('borderStyle') as string | undefined;
    return (value as BorderStyle) || 'left-accent';
  }

  private getCoverField(): string | null {
    const value = this.config.get('coverField') as string | undefined;
    return value || null;
  }

  private getCoverDisplay(): CoverDisplay {
    const value = this.config.get('coverDisplay') as string | undefined;
    return (value as CoverDisplay) || 'banner';
  }

  private getSummaryField(): string | null {
    const value = this.config.get('summaryField') as string | undefined;
    return value || null;
  }

  private getDateStartField(): string {
    const value = this.config.get('dateStartField') as string | undefined;
    return value || 'note.date_start_scheduled';
  }

  private getDateEndField(): string {
    const value = this.config.get('dateEndField') as string | undefined;
    return value || 'note.date_end_scheduled';
  }

  private getBadgePlacement(): BadgePlacement {
    const value = this.config.get('badgePlacement') as string | undefined;
    return (value as BadgePlacement) || 'properties-section';
  }

  private getColumnWidth(): number {
    const value = this.config.get('columnWidth') as string | number | undefined;
    if (typeof value === 'string') {
      return parseInt(value, 10) || 280;
    }
    return value || 280;
  }

  private getHideEmptyColumns(): boolean {
    const value = this.config.get('hideEmptyColumns') as string | boolean | undefined;
    // Handle both string 'true'/'false' and boolean values
    if (typeof value === 'string') {
      return value === 'true';
    }
    return value ?? false;
  }

  private getEnableSearch(): boolean {
    const value = this.config.get('enableSearch') as string | boolean | undefined;
    if (typeof value === 'string') {
      return value === 'true';
    }
    return value ?? false;
  }

  private getCustomColumnOrder(): string[] {
    const value = this.config.get('columnOrder') as string | undefined;
    if (!value) return [];
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }

  private setCustomColumnOrder(order: string[]): void {
    this.config.set('columnOrder', JSON.stringify(order));
  }

  private getCustomSwimlaneOrder(): string[] {
    const value = this.config.get('swimlaneOrder') as string | undefined;
    if (!value) return [];
    try {
      return JSON.parse(value);
    } catch {
      return [];
    }
  }

  private setCustomSwimlaneOrder(order: string[]): void {
    this.config.set('swimlaneOrder', JSON.stringify(order));
  }

  private getCoverHeight(): number {
    const value = this.config.get('coverHeight') as string | number | undefined;
    if (typeof value === 'string') {
      return parseInt(value, 10) || 120;
    }
    return value || 120;
  }

  /**
   * Get the list of visible properties from Bases config
   */
  private getVisibleProperties(): string[] {
    const orderedProps = this.config.getOrder();
    return orderedProps.length > 0 ? orderedProps : this.getDefaultProperties();
  }

  private getDefaultProperties(): string[] {
    return [
      'note.title',
      'note.status',
      'note.priority',
      'note.calendar',
      'note.date_start_scheduled',
      'note.date_end_scheduled',
    ];
  }

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
    this.containerEl.addClass('planner-bases-kanban');
    this.containerEl.style.cssText = 'height: 100%; display: flex; flex-direction: column; overflow: auto;';

    this.boardEl = this.containerEl.createDiv({ cls: 'planner-kanban-board' });
    this.boardEl.style.cssText = `
      flex: 1;
      display: flex;
      gap: 12px;
      padding: 12px;
      overflow-x: auto;
      overflow-y: auto;
      min-height: min-content;
    `;
  }

  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver(() => {
      // Handle resize if needed
    });
    this.resizeObserver.observe(this.containerEl);
  }

  onDataUpdated(): void {
    this.render();
  }

  onunload(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  private render(): void {
    if (!this.boardEl || !this.boardEl.isConnected) {
      this.setupContainer();
    }

    if (this.boardEl) {
      this.boardEl.empty();
    }

    // Build color map for colorBy field
    this.buildColorMapCache();

    // Check if swimlanes are enabled
    const swimlaneBy = this.getSwimlaneBy();

    if (swimlaneBy) {
      // Render with swimlanes (2D grid)
      this.renderWithSwimlanes(swimlaneBy);
    } else {
      // Group entries by the groupBy field
      const groups = this.groupEntriesByField();
      // Render columns
      this.renderColumns(groups);
    }
  }

  private buildColorMapCache(): void {
    this.colorMapCache = {};
    const colorByField = this.getColorBy();
    const propName = colorByField.replace(/^note\./, '');

    // Skip building cache for fields with predefined colors
    if (['calendar', 'status', 'priority'].includes(propName)) {
      return;
    }

    // Collect unique values and assign Solarized colors
    const uniqueValues = new Set<string>();
    for (const group of this.data.groupedData) {
      for (const entry of group.entries) {
        const value = entry.getValue(colorByField as BasesPropertyId);
        if (value) {
          const strValue = Array.isArray(value) ? value[0] : String(value);
          if (strValue) uniqueValues.add(strValue);
        }
      }
    }

    const sortedValues = Array.from(uniqueValues).sort();
    sortedValues.forEach((value, index) => {
      this.colorMapCache[value] = SOLARIZED_ACCENT_COLORS[index % SOLARIZED_ACCENT_COLORS.length];
    });
  }

  private getEntryColor(entry: BasesEntry): string {
    const colorByField = this.getColorBy();
    const propName = colorByField.replace(/^note\./, '');
    const value = entry.getValue(colorByField as BasesPropertyId);

    if (!value) return '#6b7280';

    // Handle special properties with predefined colors
    if (propName === 'calendar') {
      const calendarName = Array.isArray(value) ? value[0] : String(value);
      return getCalendarColor(this.plugin.settings, calendarName);
    }

    if (propName === 'priority') {
      const config = getPriorityConfig(this.plugin.settings, String(value));
      return config?.color ?? '#6b7280';
    }

    if (propName === 'status') {
      const config = getStatusConfig(this.plugin.settings, String(value));
      return config?.color ?? '#6b7280';
    }

    // Use cached color for other fields
    const strValue = Array.isArray(value) ? value[0] : String(value);
    return this.colorMapCache[strValue] ?? '#6b7280';
  }

  private groupEntriesByField(): Map<string, BasesEntry[]> {
    const groupByField = this.getGroupBy();
    const groups = new Map<string, BasesEntry[]>();

    for (const group of this.data.groupedData) {
      for (const entry of group.entries) {
        const value = entry.getValue(groupByField as BasesPropertyId);
        const groupKey = this.valueToString(value);

        if (!groups.has(groupKey)) {
          groups.set(groupKey, []);
        }
        groups.get(groupKey)!.push(entry);
      }
    }

    // Augment with empty columns for status/priority if grouping by those fields
    const propName = groupByField.replace(/^note\./, '');
    if (propName === 'status') {
      this.plugin.settings.statuses.forEach(status => {
        if (!groups.has(status.name)) {
          groups.set(status.name, []);
        }
      });
    } else if (propName === 'priority') {
      this.plugin.settings.priorities.forEach(priority => {
        if (!groups.has(priority.name)) {
          groups.set(priority.name, []);
        }
      });
    }

    return groups;
  }

  private valueToString(value: unknown): string {
    if (value === null || value === undefined) return 'None';
    if (Array.isArray(value)) return value[0]?.toString() ?? 'None';
    return String(value);
  }

  /**
   * Get ordered column keys based on the groupBy field and custom order
   */
  private getColumnKeys(groups: Map<string, BasesEntry[]>): string[] {
    const groupByField = this.getGroupBy();
    const propName = groupByField.replace(/^note\./, '');
    const customOrder = this.getCustomColumnOrder();

    let defaultKeys: string[];
    if (propName === 'status') {
      defaultKeys = this.plugin.settings.statuses.map(s => s.name);
      for (const key of groups.keys()) {
        if (!defaultKeys.includes(key)) defaultKeys.push(key);
      }
    } else if (propName === 'priority') {
      defaultKeys = this.plugin.settings.priorities.map(p => p.name);
      for (const key of groups.keys()) {
        if (!defaultKeys.includes(key)) defaultKeys.push(key);
      }
    } else {
      defaultKeys = Array.from(groups.keys()).sort();
    }

    // If we have a custom order, use it (but include any new keys that weren't in the saved order)
    if (customOrder.length > 0) {
      const orderedKeys: string[] = [];
      // First, add keys in custom order that still exist
      for (const key of customOrder) {
        if (defaultKeys.includes(key)) {
          orderedKeys.push(key);
        }
      }
      // Then add any new keys that weren't in custom order
      for (const key of defaultKeys) {
        if (!orderedKeys.includes(key)) {
          orderedKeys.push(key);
        }
      }
      return orderedKeys;
    }

    return defaultKeys;
  }

  /**
   * Get ordered swimlane keys based on the swimlaneBy field and custom order
   */
  private getOrderedSwimlaneKeys(swimlaneKeys: string[], swimlaneBy: string): string[] {
    const propName = swimlaneBy.replace(/^note\./, '');
    const customOrder = this.getCustomSwimlaneOrder();

    let defaultKeys: string[];
    if (propName === 'status') {
      defaultKeys = this.plugin.settings.statuses.map(s => s.name);
      for (const key of swimlaneKeys) {
        if (!defaultKeys.includes(key)) defaultKeys.push(key);
      }
    } else if (propName === 'priority') {
      defaultKeys = this.plugin.settings.priorities.map(p => p.name);
      for (const key of swimlaneKeys) {
        if (!defaultKeys.includes(key)) defaultKeys.push(key);
      }
    } else {
      defaultKeys = [...swimlaneKeys].sort();
    }

    // If we have a custom order, use it (but include any new keys that weren't in the saved order)
    if (customOrder.length > 0) {
      const orderedKeys: string[] = [];
      // First, add keys in custom order that still exist
      for (const key of customOrder) {
        if (defaultKeys.includes(key)) {
          orderedKeys.push(key);
        }
      }
      // Then add any new keys that weren't in custom order
      for (const key of defaultKeys) {
        if (!orderedKeys.includes(key)) {
          orderedKeys.push(key);
        }
      }
      return orderedKeys;
    }

    return defaultKeys;
  }

  /**
   * Render with swimlanes (2D grid layout)
   */
  private renderWithSwimlanes(swimlaneBy: string): void {
    if (!this.boardEl) return;

    const columnWidth = this.getColumnWidth();
    const hideEmpty = this.getHideEmptyColumns();
    const groupByField = this.getGroupBy();

    // First, collect all entries and group by swimlane then by column
    const swimlaneGroups = new Map<string, Map<string, BasesEntry[]>>();
    const allColumnKeys = new Set<string>();

    for (const group of this.data.groupedData) {
      for (const entry of group.entries) {
        const swimlaneValue = entry.getValue(swimlaneBy as BasesPropertyId);
        const swimlaneKey = this.valueToString(swimlaneValue);

        const columnValue = entry.getValue(groupByField as BasesPropertyId);
        const columnKey = this.valueToString(columnValue);

        allColumnKeys.add(columnKey);

        if (!swimlaneGroups.has(swimlaneKey)) {
          swimlaneGroups.set(swimlaneKey, new Map());
        }
        const swimlane = swimlaneGroups.get(swimlaneKey)!;

        if (!swimlane.has(columnKey)) {
          swimlane.set(columnKey, []);
        }
        swimlane.get(columnKey)!.push(entry);
      }
    }

    // Get sorted column keys
    const columnKeys = this.getColumnKeys(new Map([...allColumnKeys].map(k => [k, []])));
    const swimlaneKeys = Array.from(swimlaneGroups.keys()).sort();

    // Create swimlane container
    const swimlaneContainer = document.createElement('div');
    swimlaneContainer.className = 'planner-kanban-swimlanes';
    swimlaneContainer.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 16px;
      min-width: fit-content;
    `;

    // Calculate column totals across all swimlanes
    const columnCounts = new Map<string, number>();
    for (const columnKey of columnKeys) {
      let total = 0;
      for (const swimlane of swimlaneGroups.values()) {
        total += (swimlane.get(columnKey) || []).length;
      }
      columnCounts.set(columnKey, total);
    }

    // Render column headers row first
    const headerRow = document.createElement('div');
    headerRow.className = 'planner-kanban-header-row';
    headerRow.style.cssText = `
      display: flex;
      gap: 12px;
      padding-left: 150px;
      position: sticky;
      top: 0;
      background: var(--background-primary);
      z-index: 10;
      padding-bottom: 8px;
    `;

    const groupByProp = groupByField.replace(/^note\./, '');

    for (const columnKey of columnKeys) {
      const headerCell = document.createElement('div');
      headerCell.className = 'planner-kanban-swimlane-header-cell';
      headerCell.setAttribute('data-group', columnKey);
      headerCell.style.cssText = `
        width: ${columnWidth}px;
        min-width: ${columnWidth}px;
        font-weight: 600;
        padding: 8px 12px;
        background: var(--background-secondary);
        border-radius: 6px;
        display: flex;
        align-items: center;
        gap: 6px;
      `;

      // Grab handle for column reordering
      const grabHandle = document.createElement('span');
      grabHandle.className = 'planner-kanban-column-grab';
      grabHandle.style.cssText = `
        cursor: grab;
        opacity: 0.4;
        transition: opacity 0.15s ease;
        display: flex;
        align-items: center;
      `;
      setIcon(grabHandle, 'grip-vertical');
      grabHandle.addEventListener('mouseenter', () => {
        grabHandle.style.opacity = '1';
      });
      grabHandle.addEventListener('mouseleave', () => {
        grabHandle.style.opacity = '0.4';
      });
      grabHandle.setAttribute('draggable', 'true');
      this.setupSwimlaneColumnDragHandlers(grabHandle, headerCell, columnKey);
      headerCell.appendChild(grabHandle);

      // Add icon for status/priority/calendar columns
      if (groupByProp === 'status') {
        const config = getStatusConfig(this.plugin.settings, columnKey);
        if (config) {
          const iconEl = document.createElement('span');
          iconEl.className = 'planner-kanban-column-icon';
          setIcon(iconEl, config.icon || 'circle');
          iconEl.style.color = config.color;
          headerCell.appendChild(iconEl);
        }
      } else if (groupByProp === 'priority') {
        const config = getPriorityConfig(this.plugin.settings, columnKey);
        if (config) {
          const iconEl = document.createElement('span');
          iconEl.className = 'planner-kanban-column-icon';
          setIcon(iconEl, config.icon || 'signal');
          iconEl.style.color = config.color;
          headerCell.appendChild(iconEl);
        }
      } else if (groupByProp === 'calendar') {
        const color = getCalendarColor(this.plugin.settings, columnKey);
        const iconEl = document.createElement('span');
        iconEl.className = 'planner-kanban-column-icon';
        setIcon(iconEl, 'calendar');
        iconEl.style.color = color;
        headerCell.appendChild(iconEl);
      }

      // Title (with flex: 1 to push count to the right)
      const titleSpan = document.createElement('span');
      titleSpan.style.flex = '1';
      titleSpan.textContent = columnKey;
      headerCell.appendChild(titleSpan);

      // Count badge
      const count = columnCounts.get(columnKey) || 0;
      const countBadge = document.createElement('span');
      countBadge.className = 'planner-kanban-column-count';
      countBadge.textContent = String(count);
      countBadge.style.cssText = `
        background: var(--background-modifier-border);
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 12px;
        font-weight: 500;
      `;
      headerCell.appendChild(countBadge);

      headerRow.appendChild(headerCell);
    }
    swimlaneContainer.appendChild(headerRow);

    // Calculate swimlane counts
    const swimlaneCounts = new Map<string, number>();
    for (const [swimlaneKey, swimlane] of swimlaneGroups) {
      let total = 0;
      for (const entries of swimlane.values()) {
        total += entries.length;
      }
      swimlaneCounts.set(swimlaneKey, total);
    }

    // Get ordered swimlane keys
    const orderedSwimlaneKeys = this.getOrderedSwimlaneKeys(swimlaneKeys, swimlaneBy);

    // Render each swimlane row
    for (const swimlaneKey of orderedSwimlaneKeys) {
      const swimlaneRow = document.createElement('div');
      swimlaneRow.className = 'planner-kanban-swimlane-row';
      swimlaneRow.setAttribute('data-swimlane-row', swimlaneKey);
      swimlaneRow.style.cssText = `
        display: flex;
        gap: 12px;
        align-items: stretch;
      `;

      // Swimlane label with drag handle, icon, title, and count
      const swimlaneLabel = document.createElement('div');
      swimlaneLabel.className = 'planner-kanban-swimlane-label';
      swimlaneLabel.setAttribute('data-swimlane', swimlaneKey);
      swimlaneLabel.style.cssText = `
        width: 138px;
        min-width: 138px;
        font-weight: 600;
        padding: 8px;
        background: var(--background-modifier-border);
        border-radius: 6px;
        position: sticky;
        left: 0;
        z-index: 5;
        display: flex;
        flex-direction: column;
        gap: 4px;
        min-height: 60px;
      `;

      // Header row with grab handle, icon, and title
      const labelHeader = document.createElement('div');
      labelHeader.style.cssText = `
        display: flex;
        align-items: center;
        gap: 4px;
      `;

      // Grab handle for swimlane reordering
      const grabHandle = document.createElement('span');
      grabHandle.className = 'planner-kanban-swimlane-grab';
      grabHandle.style.cssText = `
        cursor: grab;
        opacity: 0.4;
        transition: opacity 0.15s ease;
        display: flex;
        align-items: center;
      `;
      setIcon(grabHandle, 'grip-vertical');
      grabHandle.addEventListener('mouseenter', () => {
        grabHandle.style.opacity = '1';
      });
      grabHandle.addEventListener('mouseleave', () => {
        grabHandle.style.opacity = '0.4';
      });
      grabHandle.setAttribute('draggable', 'true');
      this.setupSwimlaneDragHandlers(grabHandle, swimlaneRow, swimlaneKey);
      labelHeader.appendChild(grabHandle);

      // Add icon for status/priority/calendar swimlanes
      const swimlaneProp = swimlaneBy.replace(/^note\./, '');
      if (swimlaneProp === 'status') {
        const config = getStatusConfig(this.plugin.settings, swimlaneKey);
        if (config) {
          const iconEl = document.createElement('span');
          iconEl.className = 'planner-kanban-swimlane-icon';
          setIcon(iconEl, config.icon || 'circle');
          iconEl.style.color = config.color;
          labelHeader.appendChild(iconEl);
        }
      } else if (swimlaneProp === 'priority') {
        const config = getPriorityConfig(this.plugin.settings, swimlaneKey);
        if (config) {
          const iconEl = document.createElement('span');
          iconEl.className = 'planner-kanban-swimlane-icon';
          setIcon(iconEl, config.icon || 'signal');
          iconEl.style.color = config.color;
          labelHeader.appendChild(iconEl);
        }
      } else if (swimlaneProp === 'calendar') {
        const color = getCalendarColor(this.plugin.settings, swimlaneKey);
        const iconEl = document.createElement('span');
        iconEl.className = 'planner-kanban-swimlane-icon';
        setIcon(iconEl, 'calendar');
        iconEl.style.color = color;
        labelHeader.appendChild(iconEl);
      }

      // Title
      const titleSpan = document.createElement('span');
      titleSpan.style.cssText = 'flex: 1; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;';
      titleSpan.textContent = swimlaneKey;
      labelHeader.appendChild(titleSpan);

      swimlaneLabel.appendChild(labelHeader);

      // Count badge
      const count = swimlaneCounts.get(swimlaneKey) || 0;
      const countBadge = document.createElement('span');
      countBadge.className = 'planner-kanban-swimlane-count';
      countBadge.textContent = String(count);
      countBadge.style.cssText = `
        background: var(--background-primary);
        padding: 2px 8px;
        border-radius: 10px;
        font-size: 11px;
        font-weight: 500;
        align-self: flex-start;
      `;
      swimlaneLabel.appendChild(countBadge);

      swimlaneRow.appendChild(swimlaneLabel);

      // Get swimlane data, defaulting to empty Map if this swimlane key has no entries
      // (can happen with predefined priority/status values that have no data)
      const swimlane = swimlaneGroups.get(swimlaneKey) || new Map<string, BasesEntry[]>();

      // Render columns in this swimlane
      for (const columnKey of columnKeys) {
        const entries = swimlane.get(columnKey) || [];

        if (hideEmpty && entries.length === 0) {
          // Add empty placeholder to maintain grid alignment
          const placeholder = document.createElement('div');
          placeholder.style.cssText = `
            width: ${columnWidth}px;
            min-width: ${columnWidth}px;
            min-height: 60px;
            background: var(--background-secondary);
            border-radius: 6px;
            opacity: 0.5;
            flex: 1;
          `;
          swimlaneRow.appendChild(placeholder);
        } else {
          const cell = this.createSwimlaneCell(columnKey, swimlaneKey, entries, columnWidth);
          swimlaneRow.appendChild(cell);
        }
      }

      swimlaneContainer.appendChild(swimlaneRow);
    }

    this.boardEl.appendChild(swimlaneContainer);
  }

  /**
   * Create a cell for swimlane view (simplified column without header)
   */
  private createSwimlaneCell(groupKey: string, swimlaneKey: string, entries: BasesEntry[], width: number): HTMLElement {
    const cell = document.createElement('div');
    cell.className = 'planner-kanban-swimlane-cell';
    cell.style.cssText = `
      width: ${width}px;
      min-width: ${width}px;
      min-height: 60px;
      background: var(--background-secondary);
      border-radius: 6px;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;
    cell.setAttribute('data-group', groupKey);
    cell.setAttribute('data-swimlane', swimlaneKey);

    // Setup drop handlers
    this.setupDropHandlers(cell, groupKey, swimlaneKey);

    // Render cards
    for (const entry of entries) {
      const card = this.createCard(entry);
      cell.appendChild(card);
    }

    return cell;
  }

  private renderColumns(groups: Map<string, BasesEntry[]>): void {
    if (!this.boardEl) return;

    const columnWidth = this.getColumnWidth();
    const hideEmpty = this.getHideEmptyColumns();
    const columnKeys = this.getColumnKeys(groups);

    for (const columnKey of columnKeys) {
      const entries = groups.get(columnKey) || [];

      // Skip empty columns if configured
      if (hideEmpty && entries.length === 0) continue;

      const column = this.createColumn(columnKey, entries, columnWidth);
      this.boardEl.appendChild(column);
    }
  }

  private createColumn(groupKey: string, entries: BasesEntry[], width: number): HTMLElement {
    const column = document.createElement('div');
    column.className = 'planner-kanban-column';
    column.style.cssText = `
      width: ${width}px;
      min-width: ${width}px;
      display: flex;
      flex-direction: column;
      background: var(--background-secondary);
      border-radius: 8px;
      flex-shrink: 0;
    `;
    column.setAttribute('data-group', groupKey);

    // Column header (pass column for drag handlers)
    const header = this.createColumnHeader(groupKey, entries.length, column);
    column.appendChild(header);

    // Cards container
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'planner-kanban-cards';
    cardsContainer.style.cssText = `
      flex: 1;
      overflow-y: auto;
      padding: 8px;
      display: flex;
      flex-direction: column;
      gap: 8px;
    `;

    // Setup drop handlers on cards container
    this.setupDropHandlers(cardsContainer, groupKey);

    // Render cards
    if (entries.length >= VIRTUAL_SCROLL_THRESHOLD) {
      this.renderVirtualCards(cardsContainer, entries);
    } else {
      this.renderCards(cardsContainer, entries);
    }

    column.appendChild(cardsContainer);
    return column;
  }

  private createColumnHeader(groupKey: string, count: number, column: HTMLElement): HTMLElement {
    const header = document.createElement('div');
    header.className = 'planner-kanban-column-header';
    header.style.cssText = `
      padding: 12px;
      font-weight: 600;
      display: flex;
      align-items: center;
      gap: 8px;
      border-bottom: 1px solid var(--background-modifier-border);
    `;

    // Grab handle for column reordering
    const grabHandle = header.createSpan({ cls: 'planner-kanban-column-grab' });
    grabHandle.style.cssText = `
      cursor: grab;
      opacity: 0.4;
      transition: opacity 0.15s ease;
      display: flex;
      align-items: center;
    `;
    setIcon(grabHandle, 'grip-vertical');
    grabHandle.addEventListener('mouseenter', () => {
      grabHandle.style.opacity = '1';
    });
    grabHandle.addEventListener('mouseleave', () => {
      grabHandle.style.opacity = '0.4';
    });

    // Make the grab handle draggable for column reordering
    grabHandle.setAttribute('draggable', 'true');
    this.setupColumnDragHandlers(grabHandle, column, groupKey);

    // Icon for status/priority
    const groupByField = this.getGroupBy();
    const propName = groupByField.replace(/^note\./, '');

    if (propName === 'status') {
      const config = getStatusConfig(this.plugin.settings, groupKey);
      if (config) {
        const iconEl = header.createSpan({ cls: 'planner-kanban-column-icon' });
        setIcon(iconEl, config.icon || 'circle');
        iconEl.style.color = config.color;
      }
    } else if (propName === 'priority') {
      const config = getPriorityConfig(this.plugin.settings, groupKey);
      if (config) {
        const iconEl = header.createSpan({ cls: 'planner-kanban-column-icon' });
        setIcon(iconEl, config.icon || 'signal');
        iconEl.style.color = config.color;
      }
    }

    // Title
    const title = header.createSpan({ cls: 'planner-kanban-column-title', text: groupKey });
    title.style.flex = '1';

    // Count badge
    const countBadge = header.createSpan({ cls: 'planner-kanban-column-count', text: String(count) });
    countBadge.style.cssText = `
      background: var(--background-modifier-border);
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 12px;
      font-weight: 500;
    `;

    return header;
  }

  private setupColumnDragHandlers(grabHandle: HTMLElement, column: HTMLElement, groupKey: string): void {
    grabHandle.addEventListener('dragstart', (e: DragEvent) => {
      e.stopPropagation(); // Don't trigger card drag
      this.draggedColumn = column;
      this.draggedColumnKey = groupKey;
      column.classList.add('planner-kanban-column--dragging');
      e.dataTransfer?.setData('text/plain', `column:${groupKey}`);
      e.dataTransfer!.effectAllowed = 'move';
    });

    // Handle edge scrolling during column drag
    grabHandle.addEventListener('drag', (e: DragEvent) => {
      if (!this.boardEl || !e.clientX) return;
      this.handleEdgeScroll(e.clientX, e.clientY);
    });

    grabHandle.addEventListener('dragend', () => {
      if (this.draggedColumn) {
        this.draggedColumn.classList.remove('planner-kanban-column--dragging');
      }
      this.draggedColumn = null;
      this.draggedColumnKey = null;
      this.stopAutoScroll(); // Stop any auto-scrolling
      // Remove all drop indicators
      document.querySelectorAll('.planner-kanban-column--drop-left, .planner-kanban-column--drop-right').forEach(el => {
        el.classList.remove('planner-kanban-column--drop-left', 'planner-kanban-column--drop-right');
      });
    });

    // Setup drop handlers on the column itself
    column.addEventListener('dragover', (e: DragEvent) => {
      // Only handle column drops, not card drops
      if (!this.draggedColumn || this.draggedColumn === column) return;
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'move';

      // Determine drop position (left or right half of column)
      const rect = column.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      column.classList.remove('planner-kanban-column--drop-left', 'planner-kanban-column--drop-right');
      if (e.clientX < midpoint) {
        column.classList.add('planner-kanban-column--drop-left');
      } else {
        column.classList.add('planner-kanban-column--drop-right');
      }
    });

    column.addEventListener('dragleave', () => {
      column.classList.remove('planner-kanban-column--drop-left', 'planner-kanban-column--drop-right');
    });

    column.addEventListener('drop', (e: DragEvent) => {
      if (!this.draggedColumn || !this.draggedColumnKey || this.draggedColumn === column) return;
      e.preventDefault();

      const rect = column.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      const insertBefore = e.clientX < midpoint;

      // Reorder columns
      this.reorderColumns(this.draggedColumnKey, groupKey, insertBefore);

      column.classList.remove('planner-kanban-column--drop-left', 'planner-kanban-column--drop-right');
    });
  }

  private reorderColumns(draggedKey: string, targetKey: string, insertBefore: boolean): void {
    // Get current column order
    const groups = this.groupEntriesByField();
    let currentOrder = this.getColumnKeys(groups);

    // Remove dragged column from current position
    currentOrder = currentOrder.filter(k => k !== draggedKey);

    // Find target position
    const targetIndex = currentOrder.indexOf(targetKey);
    const insertIndex = insertBefore ? targetIndex : targetIndex + 1;

    // Insert at new position
    currentOrder.splice(insertIndex, 0, draggedKey);

    // Save custom order
    this.setCustomColumnOrder(currentOrder);

    // Re-render
    this.render();
  }

  /**
   * Setup drag handlers for swimlane column headers (for reordering columns in swimlane view)
   */
  private setupSwimlaneColumnDragHandlers(grabHandle: HTMLElement, headerCell: HTMLElement, groupKey: string): void {
    grabHandle.addEventListener('dragstart', (e: DragEvent) => {
      e.stopPropagation();
      this.draggedColumn = headerCell;
      this.draggedColumnKey = groupKey;
      headerCell.classList.add('planner-kanban-column--dragging');
      e.dataTransfer?.setData('text/plain', `column:${groupKey}`);
      e.dataTransfer!.effectAllowed = 'move';
    });

    // Handle edge scrolling during column drag
    grabHandle.addEventListener('drag', (e: DragEvent) => {
      if (!this.boardEl || !e.clientX) return;
      this.handleEdgeScroll(e.clientX, e.clientY);
    });

    grabHandle.addEventListener('dragend', () => {
      if (this.draggedColumn) {
        this.draggedColumn.classList.remove('planner-kanban-column--dragging');
      }
      this.draggedColumn = null;
      this.draggedColumnKey = null;
      this.stopAutoScroll(); // Stop any auto-scrolling
      // Remove all drop indicators
      document.querySelectorAll('.planner-kanban-column--drop-left, .planner-kanban-column--drop-right').forEach(el => {
        el.classList.remove('planner-kanban-column--drop-left', 'planner-kanban-column--drop-right');
      });
    });

    // Setup drop handlers on the header cell itself
    headerCell.addEventListener('dragover', (e: DragEvent) => {
      // Only handle column drops
      if (!this.draggedColumn || this.draggedColumn === headerCell) return;
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'move';

      // Determine drop position (left or right half)
      const rect = headerCell.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      headerCell.classList.remove('planner-kanban-column--drop-left', 'planner-kanban-column--drop-right');
      if (e.clientX < midpoint) {
        headerCell.classList.add('planner-kanban-column--drop-left');
      } else {
        headerCell.classList.add('planner-kanban-column--drop-right');
      }
    });

    headerCell.addEventListener('dragleave', () => {
      headerCell.classList.remove('planner-kanban-column--drop-left', 'planner-kanban-column--drop-right');
    });

    headerCell.addEventListener('drop', (e: DragEvent) => {
      if (!this.draggedColumn || !this.draggedColumnKey || this.draggedColumn === headerCell) return;
      e.preventDefault();

      const rect = headerCell.getBoundingClientRect();
      const midpoint = rect.left + rect.width / 2;
      const insertBefore = e.clientX < midpoint;

      // Reorder columns
      this.reorderColumns(this.draggedColumnKey, groupKey, insertBefore);

      headerCell.classList.remove('planner-kanban-column--drop-left', 'planner-kanban-column--drop-right');
    });
  }

  /**
   * Setup drag handlers for swimlane rows (for reordering swimlanes)
   */
  private setupSwimlaneDragHandlers(grabHandle: HTMLElement, swimlaneRow: HTMLElement, swimlaneKey: string): void {
    grabHandle.addEventListener('dragstart', (e: DragEvent) => {
      e.stopPropagation();
      this.draggedSwimlane = swimlaneRow;
      this.draggedSwimlaneKey = swimlaneKey;
      swimlaneRow.classList.add('planner-kanban-swimlane--dragging');
      e.dataTransfer?.setData('text/plain', `swimlane:${swimlaneKey}`);
      e.dataTransfer!.effectAllowed = 'move';
    });

    // Handle edge scrolling during swimlane drag
    grabHandle.addEventListener('drag', (e: DragEvent) => {
      if (!this.boardEl || !e.clientX) return;
      this.handleEdgeScroll(e.clientX, e.clientY);
    });

    grabHandle.addEventListener('dragend', () => {
      if (this.draggedSwimlane) {
        this.draggedSwimlane.classList.remove('planner-kanban-swimlane--dragging');
      }
      this.draggedSwimlane = null;
      this.draggedSwimlaneKey = null;
      this.stopAutoScroll(); // Stop any auto-scrolling
      // Remove all drop indicators
      document.querySelectorAll('.planner-kanban-swimlane--drop-above, .planner-kanban-swimlane--drop-below').forEach(el => {
        el.classList.remove('planner-kanban-swimlane--drop-above', 'planner-kanban-swimlane--drop-below');
      });
    });

    // Setup drop handlers on the swimlane row itself
    swimlaneRow.addEventListener('dragover', (e: DragEvent) => {
      // Only handle swimlane drops
      if (!this.draggedSwimlane || this.draggedSwimlane === swimlaneRow) return;
      e.preventDefault();
      e.dataTransfer!.dropEffect = 'move';

      // Determine drop position (top or bottom half)
      const rect = swimlaneRow.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      swimlaneRow.classList.remove('planner-kanban-swimlane--drop-above', 'planner-kanban-swimlane--drop-below');
      if (e.clientY < midpoint) {
        swimlaneRow.classList.add('planner-kanban-swimlane--drop-above');
      } else {
        swimlaneRow.classList.add('planner-kanban-swimlane--drop-below');
      }
    });

    swimlaneRow.addEventListener('dragleave', () => {
      swimlaneRow.classList.remove('planner-kanban-swimlane--drop-above', 'planner-kanban-swimlane--drop-below');
    });

    swimlaneRow.addEventListener('drop', (e: DragEvent) => {
      if (!this.draggedSwimlane || !this.draggedSwimlaneKey || this.draggedSwimlane === swimlaneRow) return;
      e.preventDefault();

      const rect = swimlaneRow.getBoundingClientRect();
      const midpoint = rect.top + rect.height / 2;
      const insertBefore = e.clientY < midpoint;

      // Reorder swimlanes
      this.reorderSwimlanes(this.draggedSwimlaneKey, swimlaneKey, insertBefore);

      swimlaneRow.classList.remove('planner-kanban-swimlane--drop-above', 'planner-kanban-swimlane--drop-below');
    });

    // Mobile touch handlers for swimlane reordering with hold delay
    const HOLD_DELAY_MS = 200;

    grabHandle.addEventListener('touchstart', (e: TouchEvent) => {
      this.touchSwimlaneStartX = e.touches[0].clientX;
      this.touchSwimlaneStartY = e.touches[0].clientY;
      this.touchSwimlaneHoldReady = false;

      this.touchSwimlaneHoldTimer = window.setTimeout(() => {
        this.touchSwimlaneHoldReady = true;
        grabHandle.classList.add('planner-kanban-grab--hold-ready');
      }, HOLD_DELAY_MS);
    }, { passive: true });

    grabHandle.addEventListener('touchmove', (e: TouchEvent) => {
      const dx = Math.abs(e.touches[0].clientX - this.touchSwimlaneStartX);
      const dy = Math.abs(e.touches[0].clientY - this.touchSwimlaneStartY);

      // If moved before hold timer completed, cancel and allow normal scrolling
      if (!this.touchSwimlaneHoldReady && (dx > 10 || dy > 10)) {
        this.cancelSwimlaneTouchHold(grabHandle);
        return;
      }

      // Start touch drag if hold completed and moved enough
      if (this.touchSwimlaneHoldReady && !this.touchDragSwimlane) {
        if (dx > 10 || dy > 10) {
          this.startSwimlaneTouchDrag(swimlaneRow, swimlaneKey, e);
        }
      } else if (this.touchDragSwimlaneClone) {
        e.preventDefault();
        this.updateSwimlaneTouchDrag(e);
      }
    }, { passive: false });

    grabHandle.addEventListener('touchend', (e: TouchEvent) => {
      this.cancelSwimlaneTouchHold(grabHandle);
      if (this.touchDragSwimlane) {
        this.endSwimlaneTouchDrag(e);
      }
    });

    grabHandle.addEventListener('touchcancel', () => {
      this.cancelSwimlaneTouchHold(grabHandle);
      this.cleanupSwimlaneTouchDrag();
    });
  }

  private cancelSwimlaneTouchHold(grabHandle: HTMLElement): void {
    if (this.touchSwimlaneHoldTimer) {
      clearTimeout(this.touchSwimlaneHoldTimer);
      this.touchSwimlaneHoldTimer = null;
    }
    grabHandle.classList.remove('planner-kanban-grab--hold-ready');
    this.touchSwimlaneHoldReady = false;
  }

  private startSwimlaneTouchDrag(swimlaneRow: HTMLElement, swimlaneKey: string, e: TouchEvent): void {
    this.touchDragSwimlane = swimlaneRow;
    this.draggedSwimlaneKey = swimlaneKey;

    // Create visual clone
    const labelEl = swimlaneRow.querySelector('.planner-kanban-swimlane-label');
    if (labelEl) {
      this.touchDragSwimlaneClone = labelEl.cloneNode(true) as HTMLElement;
      this.touchDragSwimlaneClone.style.cssText = `
        position: fixed;
        pointer-events: none;
        z-index: 1000;
        opacity: 0.9;
        transform: scale(1.02);
        box-shadow: 0 4px 12px rgba(0,0,0,0.3);
        width: ${labelEl.clientWidth}px;
      `;
      document.body.appendChild(this.touchDragSwimlaneClone);
    }

    swimlaneRow.classList.add('planner-kanban-swimlane--dragging');
    this.updateSwimlaneTouchDrag(e);
  }

  private updateSwimlaneTouchDrag(e: TouchEvent): void {
    if (!this.touchDragSwimlaneClone || !this.boardEl) return;

    const touch = e.touches[0];
    this.touchDragSwimlaneClone.style.left = `${touch.clientX - 50}px`;
    this.touchDragSwimlaneClone.style.top = `${touch.clientY - 20}px`;

    // Handle edge scrolling
    this.handleEdgeScroll(touch.clientX, touch.clientY);

    // Highlight drop target
    this.highlightSwimlaneDropTarget(touch.clientY);
  }

  private highlightSwimlaneDropTarget(clientY: number): void {
    // Clear previous highlights
    document.querySelectorAll('.planner-kanban-swimlane--drop-above, .planner-kanban-swimlane--drop-below').forEach(el => {
      el.classList.remove('planner-kanban-swimlane--drop-above', 'planner-kanban-swimlane--drop-below');
    });

    // Find swimlane row under touch point
    const rows = Array.from(document.querySelectorAll('.planner-kanban-swimlane-row'));
    for (const row of rows) {
      if (row === this.touchDragSwimlane) continue;
      const rect = row.getBoundingClientRect();
      if (clientY >= rect.top && clientY <= rect.bottom) {
        const midpoint = rect.top + rect.height / 2;
        if (clientY < midpoint) {
          row.classList.add('planner-kanban-swimlane--drop-above');
        } else {
          row.classList.add('planner-kanban-swimlane--drop-below');
        }
        break;
      }
    }
  }

  private endSwimlaneTouchDrag(e: TouchEvent): void {
    this.stopAutoScroll();

    const touch = e.changedTouches[0];

    // Find drop target
    const rows = Array.from(document.querySelectorAll('.planner-kanban-swimlane-row'));
    for (const row of rows) {
      if (row === this.touchDragSwimlane) continue;
      const rect = row.getBoundingClientRect();
      if (touch.clientY >= rect.top && touch.clientY <= rect.bottom) {
        const targetKey = row.getAttribute('data-swimlane-row');
        if (targetKey && this.draggedSwimlaneKey) {
          const midpoint = rect.top + rect.height / 2;
          const insertBefore = touch.clientY < midpoint;
          this.reorderSwimlanes(this.draggedSwimlaneKey, targetKey, insertBefore);
        }
        break;
      }
    }

    this.cleanupSwimlaneTouchDrag();
  }

  private cleanupSwimlaneTouchDrag(): void {
    if (this.touchDragSwimlaneClone) {
      this.touchDragSwimlaneClone.remove();
      this.touchDragSwimlaneClone = null;
    }
    if (this.touchDragSwimlane) {
      this.touchDragSwimlane.classList.remove('planner-kanban-swimlane--dragging');
      this.touchDragSwimlane = null;
    }
    this.draggedSwimlaneKey = null;
    this.stopAutoScroll();

    // Clear all drop indicators
    document.querySelectorAll('.planner-kanban-swimlane--drop-above, .planner-kanban-swimlane--drop-below').forEach(el => {
      el.classList.remove('planner-kanban-swimlane--drop-above', 'planner-kanban-swimlane--drop-below');
    });
  }

  private reorderSwimlanes(draggedKey: string, targetKey: string, insertBefore: boolean): void {
    const swimlaneBy = this.getSwimlaneBy();
    if (!swimlaneBy) return;

    // Collect current swimlane keys
    const swimlaneKeys: string[] = [];
    for (const group of this.data.groupedData) {
      for (const entry of group.entries) {
        const value = entry.getValue(swimlaneBy as BasesPropertyId);
        const key = this.valueToString(value);
        if (!swimlaneKeys.includes(key)) {
          swimlaneKeys.push(key);
        }
      }
    }

    // Get current order
    let currentOrder = this.getOrderedSwimlaneKeys(swimlaneKeys, swimlaneBy);

    // Remove dragged swimlane from current position
    currentOrder = currentOrder.filter(k => k !== draggedKey);

    // Find target position
    const targetIndex = currentOrder.indexOf(targetKey);
    const insertIndex = insertBefore ? targetIndex : targetIndex + 1;

    // Insert at new position
    currentOrder.splice(insertIndex, 0, draggedKey);

    // Save custom order
    this.setCustomSwimlaneOrder(currentOrder);

    // Re-render
    this.render();
  }

  private renderCards(container: HTMLElement, entries: BasesEntry[]): void {
    for (const entry of entries) {
      const card = this.createCard(entry);
      container.appendChild(card);
    }
  }

  private renderVirtualCards(container: HTMLElement, entries: BasesEntry[]): void {
    // For now, render all cards - virtual scrolling can be added later
    // This is a placeholder for the virtual scroll implementation
    this.renderCards(container, entries);
  }

  private createCard(entry: BasesEntry): HTMLElement {
    const card = document.createElement('div');
    card.className = 'planner-kanban-card';
    card.setAttribute('data-path', entry.file.path);
    card.setAttribute('draggable', 'true');

    const color = this.getEntryColor(entry);
    const borderStyle = this.getBorderStyle();

    // Base card styles
    let cardStyles = `
      background: var(--background-primary);
      border-radius: 6px;
      cursor: pointer;
      transition: box-shadow 0.15s ease;
      overflow: hidden;
    `;

    // Apply border style
    if (borderStyle === 'left-accent') {
      cardStyles += `border-left: 4px solid ${color};`;
    } else if (borderStyle === 'full-border') {
      cardStyles += `border: 2px solid ${color};`;
    } else {
      cardStyles += `border: 1px solid var(--background-modifier-border);`;
    }

    card.style.cssText = cardStyles;

    // Cover image
    const coverField = this.getCoverField();
    const coverDisplay = this.getCoverDisplay();
    if (coverField && coverDisplay !== 'none') {
      const coverValue = entry.getValue(coverField as BasesPropertyId);
      if (coverValue) {
        this.renderCover(card, String(coverValue), coverDisplay);
      }
    }

    // Card content container
    const content = card.createDiv({ cls: 'planner-kanban-card-content' });
    content.style.padding = '12px';

    const placement = this.getBadgePlacement();

    // Title row (may include inline badges)
    const titleRow = content.createDiv({ cls: 'planner-kanban-card-title-row' });
    if (placement === 'inline') {
      titleRow.style.cssText = 'display: flex; flex-wrap: wrap; align-items: center; gap: 4px; margin-bottom: 4px;';
    }

    // Title
    const title = entry.getValue('note.title' as BasesPropertyId) || entry.file.basename;
    const titleEl = titleRow.createSpan({ cls: 'planner-kanban-card-title', text: String(title) });
    titleEl.style.cssText = 'font-weight: 500;';

    // For inline placement, render badges in title row
    if (placement === 'inline') {
      this.renderBadges(titleRow, entry);
    }

    // Summary - only show if configured and visible
    const summaryField = this.getSummaryField();
    const visibleProps = this.getVisibleProperties();
    const summaryFieldProp = summaryField ? summaryField.replace(/^note\./, '') : 'summary';
    const isSummaryVisible = visibleProps.some(p =>
      p === summaryField ||
      p === `note.${summaryFieldProp}` ||
      p.endsWith(`.${summaryFieldProp}`)
    );

    if (isSummaryVisible) {
      const summarySource = summaryField || 'note.summary';
      const summary = entry.getValue(summarySource as BasesPropertyId);
      if (summary && summary !== 'null' && summary !== null) {
        const summaryEl = content.createDiv({ cls: 'planner-kanban-card-summary', text: String(summary) });
        summaryEl.style.cssText = `
          font-size: 12px;
          color: var(--text-muted);
          overflow: hidden;
          text-overflow: ellipsis;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          margin-top: 4px;
        `;
      }
    }

    // For properties-section placement, render badges below content
    if (placement === 'properties-section') {
      this.renderBadges(content, entry);
    }

    // Setup drag handlers
    this.setupCardDragHandlers(card, entry);

    // Click handler
    card.addEventListener('click', () => this.handleCardClick(entry));

    return card;
  }

  private renderCover(card: HTMLElement, coverPath: string, display: CoverDisplay): void {
    const coverEl = card.createDiv({ cls: 'planner-kanban-card-cover' });
    const coverHeight = this.getCoverHeight();

    // Resolve the image path
    const imgSrc = this.resolveImagePath(coverPath);

    // Create actual img element - works better with Obsidian's resource paths
    const img = coverEl.createEl('img');
    img.src = imgSrc;
    img.alt = '';

    if (display === 'banner') {
      coverEl.style.cssText = `
        width: 100%;
        height: ${coverHeight}px;
        overflow: hidden;
      `;
      img.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        display: block;
      `;
    } else if (display === 'thumbnail-left' || display === 'thumbnail-right') {
      coverEl.style.cssText = `
        width: 60px;
        height: 60px;
        flex-shrink: 0;
        overflow: hidden;
        border-radius: 4px;
      `;
      img.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        display: block;
      `;
      // Adjust card layout for thumbnails
      card.style.display = 'flex';
      card.style.flexDirection = display === 'thumbnail-left' ? 'row' : 'row-reverse';
      card.style.gap = '8px';
      card.style.alignItems = 'flex-start';
    } else if (display === 'background') {
      coverEl.style.cssText = `
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
      `;
      img.style.cssText = `
        width: 100%;
        height: 100%;
        object-fit: cover;
        object-position: center;
        opacity: 0.2;
      `;
      card.style.position = 'relative';
    }

    // Handle image load errors - hide cover if image fails
    img.addEventListener('error', () => {
      coverEl.style.display = 'none';
    });
  }

  private resolveImagePath(path: string): string {
    // If it's already a URL, return as-is
    if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('app://')) {
      return path;
    }

    // Clean up the path - remove any wiki link brackets (handle [[path]] and [[path|alias]])
    // Also handle cases where brackets appear anywhere in the string (not just start/end)
    let cleanPath = path
      .replace(/\[\[/g, '')       // Remove all [[ occurrences
      .replace(/\]\]/g, '')       // Remove all ]] occurrences
      .replace(/\|.*$/, '')       // Remove alias if present (e.g., path|alias -> path)
      .trim();

    // If path doesn't include extension, it might be a wiki link without extension
    // Try to find the file in the vault
    const file = this.plugin.app.vault.getAbstractFileByPath(cleanPath);
    if (file) {
      return this.plugin.app.vault.getResourcePath(file as any);
    }

    // Try with common image extensions
    for (const ext of ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']) {
      const fileWithExt = this.plugin.app.vault.getAbstractFileByPath(cleanPath + ext);
      if (fileWithExt) {
        return this.plugin.app.vault.getResourcePath(fileWithExt as any);
      }
    }

    // Try to find by searching (in case path is relative or short name)
    const files = this.plugin.app.vault.getFiles();
    const matchingFile = files.find(f =>
      f.path === cleanPath ||
      f.path.endsWith('/' + cleanPath) ||
      f.basename === cleanPath ||
      f.name === cleanPath
    );
    if (matchingFile) {
      return this.plugin.app.vault.getResourcePath(matchingFile);
    }

    return path;
  }

  private renderBadges(container: HTMLElement, entry: BasesEntry): void {
    const placement = this.getBadgePlacement();
    const groupByField = this.getGroupBy();
    const groupByProp = groupByField.replace(/^note\./, '');
    const visibleProps = this.getVisibleProperties();

    // Create badge container with appropriate styling based on placement
    const badgeContainer = container.createDiv({
      cls: `planner-kanban-badges planner-kanban-badges--${placement}`
    });

    if (placement === 'inline') {
      badgeContainer.style.cssText = `
        display: inline-flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-left: 8px;
        vertical-align: middle;
      `;
    } else {
      badgeContainer.style.cssText = `
        display: flex;
        flex-wrap: wrap;
        gap: 4px;
        margin-top: 8px;
        padding-top: 8px;
        border-top: 1px solid var(--background-modifier-border);
      `;
    }

    // Helper to check if a property is visible
    const isVisible = (propName: string) => {
      return visibleProps.some(p => p === `note.${propName}` || p.endsWith(`.${propName}`));
    };

    // Status badge (skip if grouping by status)
    if (groupByProp !== 'status' && isVisible('status')) {
      const status = entry.getValue('note.status' as BasesPropertyId);
      if (status) {
        const config = getStatusConfig(this.plugin.settings, String(status));
        if (config) {
          this.createBadge(badgeContainer, String(status), config.color, config.icon);
        }
      }
    }

    // Priority badge (skip if grouping by priority)
    if (groupByProp !== 'priority' && isVisible('priority')) {
      const priority = entry.getValue('note.priority' as BasesPropertyId);
      if (priority) {
        const config = getPriorityConfig(this.plugin.settings, String(priority));
        if (config) {
          this.createBadge(badgeContainer, String(priority), config.color, config.icon);
        }
      }
    }

    // Calendar badge (skip if grouping by calendar)
    if (groupByProp !== 'calendar' && isVisible('calendar')) {
      const calendar = entry.getValue('note.calendar' as BasesPropertyId);
      if (calendar) {
        const calendarName = Array.isArray(calendar) ? calendar[0] : String(calendar);
        const color = getCalendarColor(this.plugin.settings, calendarName);
        this.createBadge(badgeContainer, calendarName, color);
      }
    }

    // Recurrence badge
    if (isVisible('repeat_frequency')) {
      const repeatFreq = entry.getValue('note.repeat_frequency' as BasesPropertyId);
      if (repeatFreq) {
        this.createBadge(badgeContainer, String(repeatFreq), '#6c71c4', 'repeat');
      }
    }

    // Date badges - check if the configured date fields are visible
    const dateStartField = this.getDateStartField();
    const dateEndField = this.getDateEndField();
    const dateStartProp = dateStartField.replace(/^note\./, '');
    const dateEndProp = dateEndField.replace(/^note\./, '');

    if (isVisible(dateStartProp)) {
      const dateStart = entry.getValue(dateStartField as BasesPropertyId);
      if (dateStart) {
        this.createDateBadge(badgeContainer, dateStart, 'calendar');
      }
    }

    if (isVisible(dateEndProp)) {
      const dateEnd = entry.getValue(dateEndField as BasesPropertyId);
      if (dateEnd) {
        this.createDateBadge(badgeContainer, dateEnd, 'calendar-check');
      }
    }

    // Render other visible properties as generic badges
    for (const propId of visibleProps) {
      const propName = propId.replace(/^note\./, '');

      // Skip properties already handled above or that shouldn't be shown as badges
      if (['title', 'summary', 'status', 'priority', 'calendar', 'repeat_frequency'].includes(propName)) continue;
      if (propName === dateStartProp || propName === dateEndProp) continue;
      if (propName === groupByProp) continue;
      // Skip cover field - it's for images, not badges
      const coverField = this.getCoverField();
      if (coverField && propId === coverField) continue;

      const value = entry.getValue(propId as BasesPropertyId);
      // Skip null, undefined, empty, and "null" string values
      if (value === null || value === undefined || value === '' || value === 'null') continue;

      // Render as generic badge
      const displayValue = Array.isArray(value) ? value.filter(v => v && v !== 'null').join(', ') : String(value);
      if (displayValue && displayValue !== 'null') {
        this.createGenericBadge(badgeContainer, propName, displayValue);
      }
    }

    // Hide empty badge container
    if (badgeContainer.childElementCount === 0) {
      badgeContainer.style.display = 'none';
    }
  }

  private createBadge(container: HTMLElement, text: string, color: string, icon?: string): void {
    const badge = container.createSpan({ cls: 'planner-badge planner-kanban-badge' });
    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 500;
      background-color: ${color};
      color: ${this.getContrastColor(color)};
      line-height: 1.2;
      max-height: 18px;
    `;

    if (icon) {
      const iconEl = badge.createSpan({ cls: 'planner-kanban-badge-icon' });
      setIcon(iconEl, icon);
    }

    badge.createSpan({ text });
  }

  private createDateBadge(container: HTMLElement, value: unknown, icon: string): void {
    const dateStr = this.formatDate(value);
    if (!dateStr) return;

    const badge = container.createSpan({ cls: 'planner-badge planner-badge-date planner-kanban-badge' });
    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 500;
      background-color: var(--interactive-accent);
      color: var(--text-on-accent);
      line-height: 1.2;
      max-height: 18px;
    `;

    const iconEl = badge.createSpan({ cls: 'planner-kanban-badge-icon' });
    setIcon(iconEl, icon);

    badge.createSpan({ text: dateStr });
  }

  private createGenericBadge(container: HTMLElement, label: string, value: string): void {
    const badge = container.createSpan({ cls: 'planner-badge planner-kanban-badge planner-kanban-badge-generic' });
    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 3px;
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 10px;
      font-weight: 500;
      background-color: var(--background-modifier-border);
      color: var(--text-normal);
      line-height: 1.2;
      max-height: 18px;
    `;

    // Truncate long values
    const displayValue = value.length > 20 ? value.substring(0, 18) + '…' : value;
    badge.createSpan({ text: displayValue });
    badge.setAttribute('title', `${label}: ${value}`);
  }

  private formatDate(value: unknown): string | null {
    if (!value) return null;

    try {
      const date = new Date(String(value));
      if (isNaN(date.getTime())) return null;

      // Format as short date
      return date.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric',
      });
    } catch {
      return null;
    }
  }

  private getContrastColor(hexColor: string): string {
    // Remove # if present
    const hex = hexColor.replace('#', '');

    // Parse RGB
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    // Calculate luminance
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  private setupCardDragHandlers(card: HTMLElement, entry: BasesEntry): void {
    // Desktop drag handlers
    card.addEventListener('dragstart', (e: DragEvent) => {
      this.draggedCardPath = entry.file.path;
      this.draggedFromColumn = card.closest('.planner-kanban-column')?.getAttribute('data-group') ||
                               card.closest('.planner-kanban-swimlane-cell')?.getAttribute('data-group') || null;
      card.classList.add('planner-kanban-card--dragging');
      e.dataTransfer?.setData('text/plain', entry.file.path);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('planner-kanban-card--dragging');
      this.draggedCardPath = null;
      this.draggedFromColumn = null;
      this.stopAutoScroll();
    });

    // Desktop dragover for edge scrolling
    card.addEventListener('drag', (e: DragEvent) => {
      if (!this.boardEl || !e.clientX) return;
      this.handleEdgeScroll(e.clientX, e.clientY);
    });

    // Mobile touch handlers with tap-hold delay to prevent accidental drags while scrolling
    const HOLD_DELAY_MS = 200; // Time finger must be held before drag is enabled

    card.addEventListener('touchstart', (e: TouchEvent) => {
      this.touchStartX = e.touches[0].clientX;
      this.touchStartY = e.touches[0].clientY;
      this.touchHoldReady = false;
      this.touchHoldCard = card;
      this.touchHoldEntry = entry;

      // Start hold timer - drag only enabled after delay
      this.touchHoldTimer = window.setTimeout(() => {
        this.touchHoldReady = true;
        // Add visual feedback that card is ready to drag
        card.classList.add('planner-kanban-card--hold-ready');
      }, HOLD_DELAY_MS);
    }, { passive: true });

    card.addEventListener('touchmove', (e: TouchEvent) => {
      const dx = Math.abs(e.touches[0].clientX - this.touchStartX);
      const dy = Math.abs(e.touches[0].clientY - this.touchStartY);

      // If moved before hold timer completed, cancel and allow normal scrolling
      if (!this.touchHoldReady && (dx > 10 || dy > 10)) {
        this.cancelTouchHold();
        return; // Allow default scroll behavior
      }

      // Only start drag if hold delay completed and we're not already dragging
      if (this.touchHoldReady && !this.touchDragCard && !this.touchDragClone) {
        if (dx > 10 || dy > 10) {
          this.startTouchDrag(card, entry, e);
        }
      } else if (this.touchDragClone) {
        e.preventDefault();
        this.updateTouchDrag(e);
      }
    }, { passive: false });

    card.addEventListener('touchend', (e: TouchEvent) => {
      this.cancelTouchHold();
      if (this.touchDragCard) {
        this.endTouchDrag(e);
      }
    });

    card.addEventListener('touchcancel', () => {
      this.cancelTouchHold();
      if (this.touchDragCard) {
        // Clean up drag state on cancel
        if (this.touchDragClone) {
          this.touchDragClone.remove();
          this.touchDragClone = null;
        }
        if (this.touchDragCard) {
          this.touchDragCard.classList.remove('planner-kanban-card--dragging');
          this.touchDragCard = null;
        }
        this.draggedCardPath = null;
        this.draggedFromColumn = null;
        this.stopAutoScroll();
      }
    });
  }

  private cancelTouchHold(): void {
    if (this.touchHoldTimer) {
      clearTimeout(this.touchHoldTimer);
      this.touchHoldTimer = null;
    }
    if (this.touchHoldCard) {
      this.touchHoldCard.classList.remove('planner-kanban-card--hold-ready');
    }
    this.touchHoldReady = false;
    this.touchHoldCard = null;
    this.touchHoldEntry = null;
  }

  private startTouchDrag(card: HTMLElement, entry: BasesEntry, e: TouchEvent): void {
    this.touchDragCard = card;
    this.draggedCardPath = entry.file.path;
    this.draggedFromColumn = card.closest('.planner-kanban-column')?.getAttribute('data-group') ||
                             card.closest('.planner-kanban-swimlane-cell')?.getAttribute('data-group') || null;

    // Create a clone for visual feedback
    this.touchDragClone = card.cloneNode(true) as HTMLElement;
    this.touchDragClone.style.cssText = `
      position: fixed;
      pointer-events: none;
      z-index: 1000;
      opacity: 0.8;
      transform: rotate(2deg) scale(1.02);
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      width: ${card.offsetWidth}px;
    `;
    document.body.appendChild(this.touchDragClone);

    card.classList.add('planner-kanban-card--dragging');

    this.updateTouchDrag(e);
  }

  private updateTouchDrag(e: TouchEvent): void {
    if (!this.touchDragClone || !this.boardEl) return;

    const touch = e.touches[0];
    this.touchDragClone.style.left = `${touch.clientX - 50}px`;
    this.touchDragClone.style.top = `${touch.clientY - 20}px`;

    // Handle edge scrolling
    this.handleEdgeScroll(touch.clientX, touch.clientY);

    // Highlight drop target
    this.highlightDropTarget(touch.clientX, touch.clientY);
  }

  private endTouchDrag(e: TouchEvent): void {
    this.stopAutoScroll();

    if (this.touchDragClone) {
      this.touchDragClone.remove();
      this.touchDragClone = null;
    }

    if (this.touchDragCard) {
      this.touchDragCard.classList.remove('planner-kanban-card--dragging');

      // Find drop target
      const touch = e.changedTouches[0];
      const dropTarget = this.findDropTarget(touch.clientX, touch.clientY);

      if (dropTarget && this.draggedCardPath) {
        this.handleCardDrop(this.draggedCardPath, dropTarget.group, dropTarget.swimlane);
      }

      this.touchDragCard = null;
    }

    this.draggedCardPath = null;
    this.draggedFromColumn = null;

    // Clear all dragover highlights
    document.querySelectorAll('.planner-kanban-cards--dragover').forEach(el => {
      el.classList.remove('planner-kanban-cards--dragover');
    });
  }

  private handleEdgeScroll(clientX: number, clientY: number): void {
    if (!this.boardEl) return;

    const boardRect = this.boardEl.getBoundingClientRect();
    const edgeThreshold = 60;
    const scrollSpeed = 15;

    let scrollX = 0;
    let scrollY = 0;

    // Check horizontal edges (always use boardEl rect)
    if (clientX < boardRect.left + edgeThreshold) {
      scrollX = -scrollSpeed;
    } else if (clientX > boardRect.right - edgeThreshold) {
      scrollX = scrollSpeed;
    }

    // Check vertical edges
    // When swimlanes are enabled, use containerEl rect since that's the vertical scroll container
    const verticalRect = this.getSwimlaneBy()
      ? this.containerEl.getBoundingClientRect()
      : boardRect;

    if (clientY < verticalRect.top + edgeThreshold) {
      scrollY = -scrollSpeed;
    } else if (clientY > verticalRect.bottom - edgeThreshold) {
      scrollY = scrollSpeed;
    }

    if (scrollX !== 0 || scrollY !== 0) {
      this.startAutoScroll(scrollX, scrollY);
    } else {
      this.stopAutoScroll();
    }
  }

  private startAutoScroll(scrollX: number, scrollY: number): void {
    if (this.scrollInterval) {
      clearInterval(this.scrollInterval);
    }

    this.scrollInterval = window.setInterval(() => {
      if (this.boardEl) {
        // Horizontal scrolling always uses boardEl
        this.boardEl.scrollLeft += scrollX;

        // Vertical scrolling: when swimlanes are enabled, use containerEl
        // because boardEl has min-height: min-content and expands to fit content
        if (scrollY !== 0 && this.getSwimlaneBy()) {
          this.containerEl.scrollTop += scrollY;
        } else {
          this.boardEl.scrollTop += scrollY;
        }
      }
    }, 16);
  }

  private stopAutoScroll(): void {
    if (this.scrollInterval) {
      clearInterval(this.scrollInterval);
      this.scrollInterval = null;
    }
  }

  private highlightDropTarget(clientX: number, clientY: number): void {
    // Clear previous highlights
    document.querySelectorAll('.planner-kanban-cards--dragover').forEach(el => {
      el.classList.remove('planner-kanban-cards--dragover');
    });

    // Find and highlight current target
    const target = document.elementFromPoint(clientX, clientY);
    const dropZone = target?.closest('.planner-kanban-cards, .planner-kanban-swimlane-cell');
    if (dropZone) {
      dropZone.classList.add('planner-kanban-cards--dragover');
    }
  }

  private findDropTarget(clientX: number, clientY: number): { group: string; swimlane?: string } | null {
    const target = document.elementFromPoint(clientX, clientY);
    const dropZone = target?.closest('.planner-kanban-cards, .planner-kanban-swimlane-cell, .planner-kanban-column');
    const group = dropZone?.getAttribute('data-group');
    if (!group) return null;

    const swimlane = dropZone?.getAttribute('data-swimlane') || undefined;
    return { group, swimlane };
  }

  private setupDropHandlers(container: HTMLElement, groupKey: string, swimlaneKey?: string): void {
    container.addEventListener('dragover', (e: DragEvent) => {
      e.preventDefault();
      container.classList.add('planner-kanban-cards--dragover');
    });

    container.addEventListener('dragleave', () => {
      container.classList.remove('planner-kanban-cards--dragover');
    });

    container.addEventListener('drop', async (e: DragEvent) => {
      e.preventDefault();
      container.classList.remove('planner-kanban-cards--dragover');

      if (this.draggedCardPath) {
        await this.handleCardDrop(this.draggedCardPath, groupKey, swimlaneKey);
      }
    });
  }

  private async handleCardDrop(filePath: string, newGroupValue: string, newSwimlaneValue?: string): Promise<void> {
    const groupByField = this.getGroupBy();
    const fieldName = groupByField.replace(/^note\./, '');
    const swimlaneBy = this.getSwimlaneBy();
    const swimlaneFieldName = swimlaneBy ? swimlaneBy.replace(/^note\./, '') : null;

    const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
    if (!file) return;

    await this.plugin.app.fileManager.processFrontMatter(file as any, (fm) => {
      fm[fieldName] = newGroupValue;
      // Also update swimlane field if swimlanes are enabled and a target swimlane was specified
      if (swimlaneFieldName && newSwimlaneValue !== undefined) {
        fm[swimlaneFieldName] = newSwimlaneValue;
      }
      fm.date_modified = new Date().toISOString();
    });
  }

  private async handleCardClick(entry: BasesEntry): Promise<void> {
    const item = await this.plugin.itemService.getItem(entry.file.path);
    if (item) {
      openItemModal(this.plugin, { mode: 'edit', item });
    } else {
      // Fallback: open the file
      const leaf = this.plugin.app.workspace.getLeaf();
      await leaf.openFile(entry.file);
    }
  }
}

/**
 * Create the Bases view registration for the Kanban
 */
export function createKanbanViewRegistration(plugin: PlannerPlugin): BasesViewRegistration {
  return {
    name: 'Kanban',
    icon: 'kanban',
    factory: (controller: QueryController, containerEl: HTMLElement) => {
      return new BasesKanbanView(controller, containerEl, plugin);
    },
    options: () => [
      {
        type: 'property',
        key: 'groupBy',
        displayName: 'Group by (columns)',
        default: 'note.status',
        placeholder: 'Select property',
        filter: (propId: BasesPropertyId) =>
          PropertyTypeService.isCategoricalProperty(propId, plugin.app),
      },
      {
        type: 'property',
        key: 'swimlaneBy',
        displayName: 'Swimlane by',
        default: '',
        placeholder: 'None',
        filter: (propId: BasesPropertyId) =>
          PropertyTypeService.isCategoricalProperty(propId, plugin.app),
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
        type: 'dropdown',
        key: 'borderStyle',
        displayName: 'Border style',
        default: 'left-accent',
        options: {
          'none': 'None',
          'left-accent': 'Left accent',
          'full-border': 'Full border',
        },
      },
      {
        type: 'property',
        key: 'coverField',
        displayName: 'Cover field',
        default: '',
        placeholder: 'None',
        filter: (propId: BasesPropertyId) =>
          PropertyTypeService.isTextProperty(propId, plugin.app),
      },
      {
        type: 'dropdown',
        key: 'coverDisplay',
        displayName: 'Cover display',
        default: 'banner',
        options: {
          'none': 'None',
          'banner': 'Banner (top)',
          'thumbnail-left': 'Thumbnail (left)',
          'thumbnail-right': 'Thumbnail (right)',
          'background': 'Background',
        },
      },
      {
        type: 'dropdown',
        key: 'coverHeight',
        displayName: 'Cover height (banner)',
        default: '120',
        options: {
          '60': 'Extra small (60px)',
          '80': 'Small (80px)',
          '100': 'Medium-small (100px)',
          '120': 'Medium (120px)',
          '150': 'Medium-large (150px)',
          '180': 'Large (180px)',
          '200': 'Extra large (200px)',
        },
      },
      {
        type: 'property',
        key: 'summaryField',
        displayName: 'Summary field',
        default: 'note.summary',
        placeholder: 'None',
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
      {
        type: 'dropdown',
        key: 'badgePlacement',
        displayName: 'Badge placement',
        default: 'properties-section',
        options: {
          'inline': 'Inline',
          'properties-section': 'Properties section',
        },
      },
      {
        type: 'dropdown',
        key: 'columnWidth',
        displayName: 'Column width',
        default: '280',
        options: {
          '200': 'Narrow (200px)',
          '240': 'Medium-narrow (240px)',
          '280': 'Medium (280px)',
          '320': 'Medium-wide (320px)',
          '360': 'Wide (360px)',
          '400': 'Extra wide (400px)',
        },
      },
      {
        type: 'dropdown',
        key: 'hideEmptyColumns',
        displayName: 'Hide empty columns',
        default: 'false',
        options: {
          'false': 'No',
          'true': 'Yes',
        },
      },
    ],
  };
}
