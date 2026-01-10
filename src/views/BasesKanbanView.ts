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
    const value = this.config.get('columnWidth') as number | undefined;
    return value || 280;
  }

  private getHideEmptyColumns(): boolean {
    const value = this.config.get('hideEmptyColumns') as boolean | undefined;
    return value ?? false;
  }

  private getEnableSearch(): boolean {
    const value = this.config.get('enableSearch') as boolean | undefined;
    return value ?? false;
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
    this.containerEl.style.cssText = 'height: 100%; display: flex; flex-direction: column; overflow: hidden;';

    this.boardEl = this.containerEl.createDiv({ cls: 'planner-kanban-board' });
    this.boardEl.style.cssText = `
      flex: 1;
      display: flex;
      gap: 12px;
      padding: 12px;
      overflow-x: auto;
      overflow-y: hidden;
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

    // Group entries by the groupBy field
    const groups = this.groupEntriesByField();

    // Render columns
    this.renderColumns(groups);
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

  private renderColumns(groups: Map<string, BasesEntry[]>): void {
    if (!this.boardEl) return;

    const columnWidth = this.getColumnWidth();
    const hideEmpty = this.getHideEmptyColumns();
    const groupByField = this.getGroupBy();
    const propName = groupByField.replace(/^note\./, '');

    // Get column order - use configured order for status/priority
    let columnKeys: string[];
    if (propName === 'status') {
      columnKeys = this.plugin.settings.statuses.map(s => s.name);
      // Add any extra groups not in settings
      for (const key of groups.keys()) {
        if (!columnKeys.includes(key)) columnKeys.push(key);
      }
    } else if (propName === 'priority') {
      columnKeys = this.plugin.settings.priorities.map(p => p.name);
      for (const key of groups.keys()) {
        if (!columnKeys.includes(key)) columnKeys.push(key);
      }
    } else {
      columnKeys = Array.from(groups.keys()).sort();
    }

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
      max-height: 100%;
    `;
    column.setAttribute('data-group', groupKey);

    // Column header
    const header = this.createColumnHeader(groupKey, entries.length);
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

  private createColumnHeader(groupKey: string, count: number): HTMLElement {
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

    // Title
    const title = entry.getValue('note.title' as BasesPropertyId) || entry.file.basename;
    const titleEl = content.createDiv({ cls: 'planner-kanban-card-title', text: String(title) });
    titleEl.style.cssText = 'font-weight: 500; margin-bottom: 4px;';

    // Summary if present
    const summary = entry.getValue('note.summary' as BasesPropertyId);
    if (summary) {
      const summaryEl = content.createDiv({ cls: 'planner-kanban-card-summary', text: String(summary) });
      summaryEl.style.cssText = `
        font-size: 12px;
        color: var(--text-muted);
        overflow: hidden;
        text-overflow: ellipsis;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      `;
    }

    // Badges
    this.renderBadges(content, entry);

    // Setup drag handlers
    this.setupCardDragHandlers(card, entry);

    // Click handler
    card.addEventListener('click', () => this.handleCardClick(entry));

    return card;
  }

  private renderCover(card: HTMLElement, coverPath: string, display: CoverDisplay): void {
    const coverEl = card.createDiv({ cls: 'planner-kanban-card-cover' });

    // Resolve the image path
    const imgSrc = this.resolveImagePath(coverPath);

    if (display === 'banner') {
      coverEl.style.cssText = `
        width: 100%;
        height: 120px;
        background-image: url('${imgSrc}');
        background-size: cover;
        background-position: center;
      `;
    } else if (display === 'thumbnail-left' || display === 'thumbnail-right') {
      coverEl.style.cssText = `
        width: 60px;
        height: 60px;
        background-image: url('${imgSrc}');
        background-size: cover;
        background-position: center;
        border-radius: 4px;
        flex-shrink: 0;
      `;
      // Adjust card layout for thumbnails
      card.style.display = 'flex';
      card.style.flexDirection = display === 'thumbnail-left' ? 'row' : 'row-reverse';
      card.style.gap = '8px';
    } else if (display === 'background') {
      coverEl.style.cssText = `
        position: absolute;
        inset: 0;
        background-image: url('${imgSrc}');
        background-size: cover;
        background-position: center;
        opacity: 0.2;
      `;
      card.style.position = 'relative';
    }
  }

  private resolveImagePath(path: string): string {
    // If it's a URL, return as-is
    if (path.startsWith('http://') || path.startsWith('https://')) {
      return path;
    }

    // Resolve vault path to resource URL
    const file = this.plugin.app.vault.getAbstractFileByPath(path);
    if (file) {
      return this.plugin.app.vault.getResourcePath(file as any);
    }

    return path;
  }

  private renderBadges(container: HTMLElement, entry: BasesEntry): void {
    const placement = this.getBadgePlacement();
    const groupByField = this.getGroupBy();
    const groupByProp = groupByField.replace(/^note\./, '');

    const badgeContainer = container.createDiv({ cls: 'planner-kanban-badges' });
    badgeContainer.style.cssText = `
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-top: 8px;
    `;

    // Status badge (skip if grouping by status)
    if (groupByProp !== 'status') {
      const status = entry.getValue('note.status' as BasesPropertyId);
      if (status) {
        const config = getStatusConfig(this.plugin.settings, String(status));
        if (config) {
          this.createBadge(badgeContainer, String(status), config.color, config.icon);
        }
      }
    }

    // Priority badge (skip if grouping by priority)
    if (groupByProp !== 'priority') {
      const priority = entry.getValue('note.priority' as BasesPropertyId);
      if (priority) {
        const config = getPriorityConfig(this.plugin.settings, String(priority));
        if (config) {
          this.createBadge(badgeContainer, String(priority), config.color, config.icon);
        }
      }
    }

    // Calendar badge (skip if grouping by calendar)
    if (groupByProp !== 'calendar') {
      const calendar = entry.getValue('note.calendar' as BasesPropertyId);
      if (calendar) {
        const calendarName = Array.isArray(calendar) ? calendar[0] : String(calendar);
        const color = getCalendarColor(this.plugin.settings, calendarName);
        this.createBadge(badgeContainer, calendarName, color);
      }
    }

    // Date badges
    const dateStartField = this.getDateStartField();
    const dateEndField = this.getDateEndField();

    const dateStart = entry.getValue(dateStartField as BasesPropertyId);
    if (dateStart) {
      this.createDateBadge(badgeContainer, dateStart, 'calendar');
    }

    const dateEnd = entry.getValue(dateEndField as BasesPropertyId);
    if (dateEnd) {
      this.createDateBadge(badgeContainer, dateEnd, 'calendar-check');
    }

    // Hide empty badge container
    if (badgeContainer.childElementCount === 0) {
      badgeContainer.style.display = 'none';
    }
  }

  private createBadge(container: HTMLElement, text: string, color: string, icon?: string): void {
    const badge = container.createSpan({ cls: 'planner-badge' });
    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      background-color: ${color};
      color: ${this.getContrastColor(color)};
    `;

    if (icon) {
      const iconEl = badge.createSpan();
      setIcon(iconEl, icon);
      iconEl.style.cssText = 'width: 12px; height: 12px;';
    }

    badge.createSpan({ text });
  }

  private createDateBadge(container: HTMLElement, value: unknown, icon: string): void {
    const dateStr = this.formatDate(value);
    if (!dateStr) return;

    const badge = container.createSpan({ cls: 'planner-badge planner-badge-date' });
    badge.style.cssText = `
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 500;
      background-color: var(--interactive-accent);
      color: var(--text-on-accent);
    `;

    const iconEl = badge.createSpan();
    setIcon(iconEl, icon);
    iconEl.style.cssText = 'width: 12px; height: 12px;';

    badge.createSpan({ text: dateStr });
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
    card.addEventListener('dragstart', (e: DragEvent) => {
      this.draggedCardPath = entry.file.path;
      this.draggedFromColumn = card.closest('.planner-kanban-column')?.getAttribute('data-group') || null;
      card.classList.add('planner-kanban-card--dragging');
      e.dataTransfer?.setData('text/plain', entry.file.path);
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('planner-kanban-card--dragging');
      this.draggedCardPath = null;
      this.draggedFromColumn = null;
    });
  }

  private setupDropHandlers(container: HTMLElement, groupKey: string): void {
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

      if (this.draggedCardPath && this.draggedFromColumn !== groupKey) {
        await this.handleCardDrop(this.draggedCardPath, groupKey);
      }
    });
  }

  private async handleCardDrop(filePath: string, newGroupValue: string): Promise<void> {
    const groupByField = this.getGroupBy();
    const fieldName = groupByField.replace(/^note\./, '');

    const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
    if (!file) return;

    await this.plugin.app.fileManager.processFrontMatter(file as any, (fm) => {
      fm[fieldName] = newGroupValue;
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
