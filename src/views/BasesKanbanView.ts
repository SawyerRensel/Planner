import {
  BasesView,
  BasesViewRegistration,
  BasesEntry,
  BasesPropertyId,
  QueryController,
  setIcon,
  TFile,
  TFolder,
  Notice,
} from 'obsidian';
import type PlannerPlugin from '../main';
import type { ItemFrontmatter } from '../types/item';
import { openItemModal } from '../components/ItemModal';
import { PropertyTypeService } from '../services/PropertyTypeService';
import {
  getStatusConfig,
  getPriorityConfig,
  getCalendarColor,
} from '../types/settings';

/**
 * Type interface for BasesView grouped data entries
 */
interface BasesGroupedData {
  entries: BasesEntry[];
  key?: unknown;
  hasKey(): boolean;
}

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
type FreezeHeaders = 'off' | 'columns' | 'swimlanes' | 'both';
type SwimHeaderDisplay = 'horizontal' | 'vertical';

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

  // Keyboard navigation state
  private focusedCardIndex: number = -1;
  private keyboardHandler: ((e: KeyboardEvent) => void) | null = null;

  // Render debouncing
  private renderDebounceTimer: number | null = null;
  private static readonly RENDER_DEBOUNCE_MS = 50;

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

  private getTitleBy(): string {
    const value = this.config.get('titleBy') as string | undefined;
    return value || 'note.title';
  }

  private getBorderStyle(): BorderStyle {
    const value = this.config.get('borderStyle') as string | undefined;
    return (value as BorderStyle) || 'left-accent';
  }

  private getCoverField(): string | null {
    const value = this.config.get('coverField') as string | undefined;
    return value || 'note.cover';
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

  private getShowAddNewButtons(): boolean {
    const value = this.config.get('showAddNewButtons') as string | boolean | undefined;
    if (typeof value === 'string') {
      return value !== 'false';
    }
    return value ?? true;
  }

  private getEnableSearch(): boolean {
    const value = this.config.get('enableSearch') as string | boolean | undefined;
    if (typeof value === 'string') {
      return value === 'true';
    }
    return value ?? false;
  }

  private getFreezeHeaders(): FreezeHeaders {
    const value = this.config.get('freezeHeaders') as string | undefined;
    return (value as FreezeHeaders) || 'both';
  }

  private getSwimHeaderDisplay(): SwimHeaderDisplay {
    const value = this.config.get('swimHeaderDisplay') as string | undefined;
    return (value as SwimHeaderDisplay) || 'vertical';
  }

  private getCustomColumnOrder(): string[] {
    const value = this.config.get('columnOrder') as string | undefined;
    if (!value) return [];
    try {
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
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
      const parsed = JSON.parse(value) as unknown;
      return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
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
      return parseInt(value, 10) || 100;
    }
    return value || 100;
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

  /**
   * Build a prePopulate object for creating a new item based on column and swimlane values.
   */
  private buildPrePopulateForNewItem(
    columnValue: string,
    swimlaneValue?: string
  ): { prePopulate: Partial<ItemFrontmatter>; targetFolder?: string } {
    const prePopulate: Partial<ItemFrontmatter> = {};
    let targetFolder: string | undefined;

    const groupByField = this.getGroupBy();
    const swimlaneByField = this.getSwimlaneBy();

    // Handle column (groupBy) - check if folder property
    if (columnValue && columnValue !== 'None') {
      if (groupByField === 'file.folder') {
        targetFolder = columnValue;
      } else {
        const fieldName = groupByField.replace(/^note\./, '');
        this.setPrePopulateField(prePopulate, fieldName, columnValue);
      }
    }

    // Handle swimlane (swimlaneBy)
    if (swimlaneValue && swimlaneValue !== 'None' && swimlaneByField) {
      if (swimlaneByField === 'file.folder') {
        targetFolder = swimlaneValue;
      } else {
        const fieldName = swimlaneByField.replace(/^note\./, '');
        this.setPrePopulateField(prePopulate, fieldName, swimlaneValue);
      }
    }

    return { prePopulate, targetFolder };
  }

  private setPrePopulateField(
    prePopulate: Partial<ItemFrontmatter>,
    fieldName: string,
    value: string
  ): void {
    const arrayFields = ['calendar', 'tags', 'context', 'people', 'related'];
    if (arrayFields.includes(fieldName)) {
      (prePopulate as Record<string, unknown>)[fieldName] = [value];
    } else {
      (prePopulate as Record<string, unknown>)[fieldName] = value;
    }
  }

  /**
   * Create an "Add New" button for a column or swimlane cell.
   */
  private createAddNewButton(groupKey: string, swimlaneKey?: string): HTMLElement {
    const button = document.createElement('button');
    button.className = 'planner-kanban-add-button';
    button.setAttribute('aria-label', 'Add new item');

    const iconSpan = document.createElement('span');
    iconSpan.className = 'planner-kanban-add-icon';
    setIcon(iconSpan, 'plus');
    button.appendChild(iconSpan);

    button.addEventListener('click', (e) => {
      e.stopPropagation();
      this.handleAddNewClick(groupKey, swimlaneKey);
    });

    return button;
  }

  /**
   * Handle click on the Add New button.
   */
  private handleAddNewClick(columnValue: string, swimlaneValue?: string): void {
    const { prePopulate, targetFolder } = this.buildPrePopulateForNewItem(columnValue, swimlaneValue);

    void openItemModal(this.plugin, {
      mode: 'create',
      prePopulate,
      targetFolder,
    });
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
    this.setupKeyboardNavigation();
  }

  /**
   * Setup keyboard navigation for the Kanban board
   * Allows navigating between cards with arrow keys
   */
  private setupKeyboardNavigation(): void {
    this.keyboardHandler = (e: KeyboardEvent) => {
      // Only handle if board is focused or a card is focused
      if (!this.boardEl?.contains(document.activeElement) &&
          document.activeElement !== this.containerEl) {
        return;
      }

      const cards = this.getAllCards();
      if (cards.length === 0) return;

      switch (e.key) {
        case 'ArrowDown':
        case 'j': // vim-style
          e.preventDefault();
          this.navigateCards(cards, 'down');
          break;
        case 'ArrowUp':
        case 'k': // vim-style
          e.preventDefault();
          this.navigateCards(cards, 'up');
          break;
        case 'ArrowRight':
        case 'l': // vim-style
          e.preventDefault();
          this.navigateCards(cards, 'right');
          break;
        case 'ArrowLeft':
        case 'h': // vim-style
          e.preventDefault();
          this.navigateCards(cards, 'left');
          break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          this.activateFocusedCard();
          break;
        case 'Escape':
          e.preventDefault();
          this.clearCardFocus();
          break;
      }
    };

    this.containerEl.addEventListener('keydown', this.keyboardHandler);
    // Make container focusable
    this.containerEl.setAttribute('tabindex', '0');
  }

  /**
   * Get all card elements in the board
   */
  private getAllCards(): HTMLElement[] {
    if (!this.boardEl) return [];
    return Array.from(this.boardEl.querySelectorAll('.planner-kanban-card'));
  }

  /**
   * Navigate between cards using arrow keys
   */
  private navigateCards(cards: HTMLElement[], direction: 'up' | 'down' | 'left' | 'right'): void {
    const currentFocused = this.boardEl?.querySelector('.planner-kanban-card--focused') as HTMLElement | null;
    let currentIndex = currentFocused ? cards.indexOf(currentFocused) : -1;

    if (currentIndex === -1) {
      // No card focused, focus first card
      this.focusCard(cards[0]);
      return;
    }

    // Get cards organized by columns for left/right navigation
    if (direction === 'left' || direction === 'right') {
      const columnCards = this.getCardsByColumn();
      const currentCard = cards[currentIndex];
      const currentColumn = currentCard.closest('[data-group]') as HTMLElement;
      const currentGroup = currentColumn?.getAttribute('data-group');

      if (!currentGroup) return;

      const columnKeys = Array.from(columnCards.keys());
      const currentColumnIndex = columnKeys.indexOf(currentGroup);
      const targetColumnIndex = direction === 'right'
        ? Math.min(currentColumnIndex + 1, columnKeys.length - 1)
        : Math.max(currentColumnIndex - 1, 0);

      const targetColumnKey = columnKeys[targetColumnIndex];
      const targetColumnCards = columnCards.get(targetColumnKey) || [];

      if (targetColumnCards.length > 0) {
        // Find card at same position in target column, or last card
        const currentColumnCards = columnCards.get(currentGroup) || [];
        const positionInColumn = currentColumnCards.indexOf(currentCard);
        const targetCard = targetColumnCards[Math.min(positionInColumn, targetColumnCards.length - 1)];
        this.focusCard(targetCard);
      }
    } else {
      // Up/down navigation within column
      const currentCard = cards[currentIndex];
      const currentColumn = currentCard.closest('[data-group]') as HTMLElement;
      const cardsInColumn = Array.from(currentColumn?.querySelectorAll('.planner-kanban-card') || []);
      const positionInColumn = cardsInColumn.indexOf(currentCard);

      let targetIndex: number;
      if (direction === 'down') {
        targetIndex = Math.min(positionInColumn + 1, cardsInColumn.length - 1);
      } else {
        targetIndex = Math.max(positionInColumn - 1, 0);
      }

      this.focusCard(cardsInColumn[targetIndex]);
    }
  }

  /**
   * Get cards organized by column
   */
  private getCardsByColumn(): Map<string, HTMLElement[]> {
    const result = new Map<string, HTMLElement[]>();
    if (!this.boardEl) return result;

    const columns = this.boardEl.querySelectorAll('[data-group]');
    columns.forEach(column => {
      const group = column.getAttribute('data-group');
      if (group) {
        const cards = Array.from(column.querySelectorAll('.planner-kanban-card'));
        if (cards.length > 0) {
          result.set(group, cards);
        }
      }
    });

    return result;
  }

  /**
   * Focus a specific card
   */
  private focusCard(card: HTMLElement | null): void {
    if (!card) return;

    // Remove focus from all cards
    this.boardEl?.querySelectorAll('.planner-kanban-card--focused').forEach(el => {
      el.classList.remove('planner-kanban-card--focused');
    });

    // Add focus to target card
    card.classList.add('planner-kanban-card--focused');
    card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

    // Update focus index
    const cards = this.getAllCards();
    this.focusedCardIndex = cards.indexOf(card);
  }

  /**
   * Activate (click) the currently focused card
   */
  private activateFocusedCard(): void {
    const focused = this.boardEl?.querySelector('.planner-kanban-card--focused') as HTMLElement | null;
    if (focused) {
      focused.click();
    }
  }

  /**
   * Clear card focus
   */
  private clearCardFocus(): void {
    this.boardEl?.querySelectorAll('.planner-kanban-card--focused').forEach(el => {
      el.classList.remove('planner-kanban-card--focused');
    });
    this.focusedCardIndex = -1;
  }

  private setupContainer(): void {
    this.containerEl.empty();
    this.containerEl.addClass('planner-bases-kanban');

    this.boardEl = this.containerEl.createDiv({ cls: 'planner-kanban-board' });
  }

  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver(() => {
      // Handle resize if needed
    });
    this.resizeObserver.observe(this.containerEl);
  }

  onDataUpdated(): void {
    // Debounce rapid data updates to prevent performance issues
    if (this.renderDebounceTimer !== null) {
      window.clearTimeout(this.renderDebounceTimer);
    }
    this.renderDebounceTimer = window.setTimeout(() => {
      this.renderDebounceTimer = null;
      this.render();
    }, BasesKanbanView.RENDER_DEBOUNCE_MS);
  }

  onunload(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
    // Clean up debounce timer
    if (this.renderDebounceTimer !== null) {
      window.clearTimeout(this.renderDebounceTimer);
      this.renderDebounceTimer = null;
    }
    // Clean up virtual scroll observers
    this.cleanupVirtualScroll();
    // Clean up keyboard navigation
    if (this.keyboardHandler) {
      this.containerEl.removeEventListener('keydown', this.keyboardHandler);
      this.keyboardHandler = null;
    }
    this.containerEl.removeAttribute('tabindex');
    // Clean up styles and classes added to the shared container
    this.containerEl.removeClass('planner-bases-kanban');
  }

  private render(): void {
    // Clean up virtual scroll observers before re-render
    this.cleanupVirtualScroll();

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
    const groupedData = this.data.groupedData as BasesGroupedData[];
    for (const group of groupedData) {
      for (const entry of group.entries) {
        const value = entry.getValue(colorByField as BasesPropertyId);
        if (value) {
          const strValue = Array.isArray(value) ? String(value[0]) : String(value);
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
      const calendarName = Array.isArray(value) ? String(value[0]) : String(value);
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
    const strValue = Array.isArray(value) ? String(value[0]) : String(value);
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
    if (Array.isArray(value)) {
      const filtered = value.filter(v => v !== null && v !== undefined && v !== '' && v !== 'null');
      if (filtered.length === 0) return 'None';
      return filtered.join(', ');
    }
    if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
      return String(value);
    }
    return 'None';
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
    const freezeHeaders = this.getFreezeHeaders();
    const freezeColumns = freezeHeaders === 'columns' || freezeHeaders === 'both';
    const freezeSwimlanes = freezeHeaders === 'swimlanes' || freezeHeaders === 'both';
    const swimHeaderDisplay = this.getSwimHeaderDisplay();
    const isVerticalSwimHeader = swimHeaderDisplay === 'vertical';

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
    const swimLabelWidth = isVerticalSwimHeader ? 48 : 150;
    headerRow.setCssProps({ '--swim-label-width': `${swimLabelWidth}px` });
    if (freezeColumns) {
      headerRow.classList.add('planner-kanban-header-row--frozen');
    }

    const groupByProp = groupByField.replace(/^note\./, '');

    for (const columnKey of columnKeys) {
      const headerCell = document.createElement('div');
      headerCell.className = 'planner-kanban-swimlane-header-cell';
      headerCell.setAttribute('data-group', columnKey);
      headerCell.setCssProps({ '--column-width': `${columnWidth}px` });

      // Grab handle for column reordering (CSS handles styles and hover states)
      const grabHandle = document.createElement('span');
      grabHandle.className = 'planner-kanban-column-grab';
      setIcon(grabHandle, 'grip-vertical');
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

      // Title (CSS class handles flex: 1)
      const titleSpan = document.createElement('span');
      titleSpan.className = 'planner-kanban-column-title';
      titleSpan.textContent = columnKey;
      headerCell.appendChild(titleSpan);

      // Count badge (CSS class handles all styles)
      const count = columnCounts.get(columnKey) || 0;
      const countBadge = document.createElement('span');
      countBadge.className = 'planner-kanban-column-count';
      countBadge.textContent = String(count);
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

      // Swimlane label with drag handle, icon, title, and count
      const swimlaneLabel = document.createElement('div');
      swimlaneLabel.setAttribute('data-swimlane', swimlaneKey);

      if (isVerticalSwimHeader) {
        swimlaneLabel.className = 'planner-kanban-swimlane-label planner-kanban-swimlane-label--vertical';
        if (freezeSwimlanes) {
          swimlaneLabel.classList.add('planner-kanban-swimlane-label--frozen');
        }
      } else {
        swimlaneLabel.className = 'planner-kanban-swimlane-label planner-kanban-swimlane-label--horizontal';
        if (freezeSwimlanes) {
          swimlaneLabel.classList.add('planner-kanban-swimlane-label--frozen');
        }
      }

      // Header row with grab handle, icon, and title
      const labelHeader = document.createElement('div');
      if (isVerticalSwimHeader) {
        labelHeader.className = 'planner-kanban-label-header--vertical';
      } else {
        labelHeader.className = 'planner-kanban-label-header--horizontal';
      }

      // Grab handle for swimlane reordering (CSS handles styles and hover states)
      const grabHandle = document.createElement('span');
      grabHandle.className = 'planner-kanban-swimlane-grab';
      setIcon(grabHandle, 'grip-vertical');
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

      // Title (CSS class handles styles based on orientation)
      const titleSpan = document.createElement('span');
      titleSpan.className = isVerticalSwimHeader
        ? 'planner-kanban-swimlane-title--vertical'
        : 'planner-kanban-swimlane-title--horizontal';
      titleSpan.textContent = swimlaneKey;
      labelHeader.appendChild(titleSpan);

      swimlaneLabel.appendChild(labelHeader);

      // Count badge (CSS class handles styles based on orientation)
      const count = swimlaneCounts.get(swimlaneKey) || 0;
      const countBadge = document.createElement('span');
      countBadge.className = isVerticalSwimHeader
        ? 'planner-kanban-swimlane-count planner-kanban-swimlane-count--vertical'
        : 'planner-kanban-swimlane-count planner-kanban-swimlane-count--horizontal';
      countBadge.textContent = String(count);
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
          placeholder.className = 'planner-kanban-placeholder';
          placeholder.setCssProps({ '--column-width': `${columnWidth}px` });
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
    cell.setCssProps({ '--column-width': `${width}px` });
    cell.setAttribute('data-group', groupKey);
    cell.setAttribute('data-swimlane', swimlaneKey);

    // Setup drop handlers
    this.setupDropHandlers(cell, groupKey, swimlaneKey);

    // Render cards
    for (const entry of entries) {
      const card = this.createCard(entry);
      cell.appendChild(card);
    }

    // Add the "Add New" button if enabled
    if (this.getShowAddNewButtons()) {
      const addButton = this.createAddNewButton(groupKey, swimlaneKey);
      cell.appendChild(addButton);
    }

    return cell;
  }

  private renderColumns(groups: Map<string, BasesEntry[]>): void {
    if (!this.boardEl) return;

    const columnWidth = this.getColumnWidth();
    const hideEmpty = this.getHideEmptyColumns();
    const columnKeys = this.getColumnKeys(groups);
    const freezeHeaders = this.getFreezeHeaders();
    const freezeColumns = freezeHeaders === 'columns' || freezeHeaders === 'both';

    // Create a wrapper that holds both header row (if sticky) and columns
    const wrapperContainer = document.createElement('div');
    wrapperContainer.className = 'planner-kanban-wrapper';

    // If freeze columns is enabled, create a sticky header row
    if (freezeColumns) {
      const headerRow = document.createElement('div');
      headerRow.className = 'planner-kanban-header-row planner-kanban-header-row--frozen';

      const groupByField = this.getGroupBy();
      const propName = groupByField.replace(/^note\./, '');

      for (const columnKey of columnKeys) {
        const entries = groups.get(columnKey) || [];
        if (hideEmpty && entries.length === 0) continue;

        const headerCell = document.createElement('div');
        headerCell.className = 'planner-kanban-column-header-cell';
        headerCell.setAttribute('data-group', columnKey);
        headerCell.setCssProps({ '--column-width': `${columnWidth}px` });

        // Grab handle for column reordering
        const grabHandle = document.createElement('span');
        grabHandle.className = 'planner-kanban-column-grab';
        setIcon(grabHandle, 'grip-vertical');
        grabHandle.setAttribute('draggable', 'true');
        this.setupSwimlaneColumnDragHandlers(grabHandle, headerCell, columnKey);
        headerCell.appendChild(grabHandle);

        // Add icon for status/priority/calendar columns
        if (propName === 'status') {
          const config = getStatusConfig(this.plugin.settings, columnKey);
          if (config) {
            const iconEl = document.createElement('span');
            iconEl.className = 'planner-kanban-column-icon';
            setIcon(iconEl, config.icon || 'circle');
             
            iconEl.style.color = config.color;
            headerCell.appendChild(iconEl);
          }
        } else if (propName === 'priority') {
          const config = getPriorityConfig(this.plugin.settings, columnKey);
          if (config) {
            const iconEl = document.createElement('span');
            iconEl.className = 'planner-kanban-column-icon';
            setIcon(iconEl, config.icon || 'signal');
             
            iconEl.style.color = config.color;
            headerCell.appendChild(iconEl);
          }
        } else if (propName === 'calendar') {
          const color = getCalendarColor(this.plugin.settings, columnKey);
          const iconEl = document.createElement('span');
          iconEl.className = 'planner-kanban-column-icon';
          setIcon(iconEl, 'calendar');
           
          iconEl.style.color = color;
          headerCell.appendChild(iconEl);
        }

        // Title (CSS class handles flex: 1)
        const titleSpan = document.createElement('span');
        titleSpan.className = 'planner-kanban-column-title';
        titleSpan.textContent = columnKey;
        headerCell.appendChild(titleSpan);

        // Count badge (CSS class handles all styles)
        const countBadge = document.createElement('span');
        countBadge.className = 'planner-kanban-column-count';
        countBadge.textContent = String(entries.length);
        headerCell.appendChild(countBadge);

        headerRow.appendChild(headerCell);
      }

      wrapperContainer.appendChild(headerRow);
    }

    // Create columns container (CSS class handles all styles)
    const columnsContainer = document.createElement('div');
    columnsContainer.className = 'planner-kanban-columns-container';

    for (const columnKey of columnKeys) {
      const entries = groups.get(columnKey) || [];

      // Skip empty columns if configured
      if (hideEmpty && entries.length === 0) continue;

      const column = this.createColumn(columnKey, entries, columnWidth, freezeColumns);
      columnsContainer.appendChild(column);
    }

    wrapperContainer.appendChild(columnsContainer);
    this.boardEl.appendChild(wrapperContainer);
  }

  private createColumn(groupKey: string, entries: BasesEntry[], width: number, skipHeader = false): HTMLElement {
    const column = document.createElement('div');
    column.className = 'planner-kanban-column';
    // Dynamic width from user setting requires inline style
    column.setCssProps({ '--column-width': `${width}px` });
    column.setAttribute('data-group', groupKey);

    // Column header (pass column for drag handlers) - skip if using sticky header row
    if (!skipHeader) {
      const header = this.createColumnHeader(groupKey, entries.length, column);
      column.appendChild(header);
    }

    // Cards container - fills column, no internal scrolling so content expands column (CSS class handles styles)
    const cardsContainer = document.createElement('div');
    cardsContainer.className = 'planner-kanban-cards';

    // Setup drop handlers on cards container
    this.setupDropHandlers(cardsContainer, groupKey);

    // Render cards
    if (entries.length >= VIRTUAL_SCROLL_THRESHOLD) {
      this.renderVirtualCards(cardsContainer, entries);
    } else {
      this.renderCards(cardsContainer, entries);
    }

    // Add the "Add New" button if enabled
    if (this.getShowAddNewButtons()) {
      const addButton = this.createAddNewButton(groupKey);
      cardsContainer.appendChild(addButton);
    }

    column.appendChild(cardsContainer);
    return column;
  }

  private createColumnHeader(groupKey: string, count: number, column: HTMLElement): HTMLElement {
    // CSS class handles all header styles
    const header = document.createElement('div');
    header.className = 'planner-kanban-column-header';

    // Grab handle for column reordering (CSS class handles styles and hover states)
    const grabHandle = header.createSpan({ cls: 'planner-kanban-column-grab' });
    setIcon(grabHandle, 'grip-vertical');

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

    // Title (CSS class handles flex: 1)
    header.createSpan({ cls: 'planner-kanban-column-title', text: groupKey });

    // Count badge (CSS class handles all styles)
    header.createSpan({ cls: 'planner-kanban-column-count', text: String(count) });

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
      this.touchDragSwimlaneClone.className = 'planner-kanban-swimlane-drag-clone';
      this.touchDragSwimlaneClone.setCssProps({ '--clone-width': `${labelEl.clientWidth}px` });
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

  /**
   * Virtual scroll state for columns with many cards
   */
  private virtualScrollObservers: Map<HTMLElement, IntersectionObserver> = new Map();
  private renderedCardRanges: Map<HTMLElement, { start: number; end: number }> = new Map();

  /**
   * Render cards with virtual scrolling for performance
   * Only renders visible cards + a buffer for smooth scrolling
   */
  private renderVirtualCards(container: HTMLElement, entries: BasesEntry[]): void {
    const BUFFER_SIZE = 5; // Cards to render above/below viewport
    const ESTIMATED_CARD_HEIGHT = 100; // px - used for placeholder sizing

    // Create a wrapper to hold placeholders and cards (CSS class handles position)
    const wrapper = document.createElement('div');
    wrapper.className = 'planner-kanban-virtual-wrapper';

    // Create placeholder elements for all entries
    const placeholders: HTMLElement[] = [];
    entries.forEach((entry, index) => {
      const placeholder = document.createElement('div');
      placeholder.className = 'planner-kanban-card-placeholder';
      placeholder.setAttribute('data-index', String(index));
      placeholder.setAttribute('data-path', entry.file.path);
      // Dynamic min-height for virtual scrolling placeholder sizing
      placeholder.setCssProps({ '--placeholder-height': `${ESTIMATED_CARD_HEIGHT}px` });
      placeholders.push(placeholder);
      wrapper.appendChild(placeholder);
    });

    container.appendChild(wrapper);

    // Track which cards are rendered
    const renderedCards = new Set<number>();

    // Create IntersectionObserver to detect visible placeholders
    const observer = new IntersectionObserver(
      (observerEntries) => {
        for (const observerEntry of observerEntries) {
          const placeholder = observerEntry.target as HTMLElement;
          const index = parseInt(placeholder.getAttribute('data-index') || '-1', 10);

          if (index < 0 || index >= entries.length) continue;

          if (observerEntry.isIntersecting && !renderedCards.has(index)) {
            // Render this card and buffer cards around it
            const start = Math.max(0, index - BUFFER_SIZE);
            const end = Math.min(entries.length, index + BUFFER_SIZE + 1);

            for (let i = start; i < end; i++) {
              if (!renderedCards.has(i)) {
                renderedCards.add(i);
                const entry = entries[i];
                const card = this.createCard(entry);
                const targetPlaceholder = placeholders[i];

                // Replace placeholder content with actual card (CSS class handles min-height reset)
                targetPlaceholder.empty();
                targetPlaceholder.appendChild(card);
                targetPlaceholder.classList.add('planner-kanban-card-rendered');
              }
            }
          }
        }
      },
      {
        root: this.boardEl,
        rootMargin: '200px 0px', // Load cards 200px before they enter viewport
        threshold: 0
      }
    );

    // Observe all placeholders
    placeholders.forEach(placeholder => observer.observe(placeholder));

    // Store observer for cleanup
    this.virtualScrollObservers.set(container, observer);
  }

  /**
   * Clean up virtual scroll observers when view is destroyed
   */
  private cleanupVirtualScroll(): void {
    for (const [, observer] of this.virtualScrollObservers) {
      observer.disconnect();
    }
    this.virtualScrollObservers.clear();
    this.renderedCardRanges.clear();
  }

  private createCard(entry: BasesEntry): HTMLElement {
    const card = document.createElement('div');
    card.className = 'planner-kanban-card';
    card.setAttribute('data-path', entry.file.path);
    card.setAttribute('draggable', 'true');

    const color = this.getEntryColor(entry);
    const borderStyle = this.getBorderStyle();

    // Apply base card styles and border variant via CSS classes
    card.classList.add('planner-kanban-card-base');
    if (borderStyle === 'left-accent') {
      card.classList.add('planner-kanban-card-base--left-accent');
      card.setCssProps({ '--card-accent-color': color });
    } else if (borderStyle === 'full-border') {
      card.classList.add('planner-kanban-card-base--full-border');
      card.setCssProps({ '--card-accent-color': color });
    } else {
      card.classList.add('planner-kanban-card-base--default-border');
    }

    // Cover image
    const coverField = this.getCoverField();
    const coverDisplay = this.getCoverDisplay();
    if (coverField && coverDisplay !== 'none') {
      const coverValue = entry.getValue(coverField as BasesPropertyId);
      if (coverValue) {
        this.renderCover(card, String(coverValue), coverDisplay);
      }
    }

    // Card content container (CSS class handles padding)
    const content = card.createDiv({ cls: 'planner-kanban-card-content' });

    const placement = this.getBadgePlacement();

    // Title row (may include inline badges - CSS class handles inline layout)
    const titleRowCls = placement === 'inline'
      ? 'planner-kanban-card-title-row planner-kanban-card-title-row--inline'
      : 'planner-kanban-card-title-row';
    const titleRow = content.createDiv({ cls: titleRowCls });

    // Title (CSS class handles font-weight)
    const titleField = this.getTitleBy();
    const title = entry.getValue(titleField as BasesPropertyId) || entry.file.basename;
    titleRow.createSpan({ cls: 'planner-kanban-card-title', text: String(title) });

    // For inline placement, render badges in title row
    if (placement === 'inline') {
      this.renderBadges(titleRow, entry);
    }

    // Summary - only show if configured and visible (CSS class handles all styles)
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
        content.createDiv({ cls: 'planner-kanban-card-summary', text: String(summary) });
      }
    }

    // For properties-section placement, render badges below content
    if (placement === 'properties-section') {
      this.renderBadges(content, entry);
    }

    // Setup drag handlers
    this.setupCardDragHandlers(card, entry);

    // Click handler
    card.addEventListener('click', () => { void this.handleCardClick(entry); });

    return card;
  }

  private renderCover(card: HTMLElement, coverPath: string, display: CoverDisplay): void {
    // Resolve the image path - returns null if not found
    const imgSrc = this.resolveImagePath(coverPath);
    if (!imgSrc) {
      return; // Don't render cover if image path can't be resolved
    }

    const coverHeight = this.getCoverHeight();

    // Create actual img element - works better with Obsidian's resource paths
    if (display === 'banner') {
      const coverEl = card.createDiv({ cls: 'planner-kanban-card-cover planner-kanban-cover--banner' });
      // Dynamic cover height from user settings
      coverEl.setCssProps({ '--cover-height': `${coverHeight}px` });
      const img = coverEl.createEl('img');
      img.src = imgSrc;
      img.alt = '';
      this.setupCoverErrorHandler(coverEl, img);
    } else if (display === 'thumbnail-left' || display === 'thumbnail-right') {
      const coverEl = card.createDiv({ cls: 'planner-kanban-card-cover planner-kanban-cover--thumbnail planner-kanban-cover--thumbnail-small' });
      const img = coverEl.createEl('img');
      img.src = imgSrc;
      img.alt = '';
      // Adjust card layout for thumbnails (CSS classes handle styles)
      const thumbnailCls = display === 'thumbnail-left'
        ? 'planner-kanban-card--thumbnail-left'
        : 'planner-kanban-card--thumbnail-right';
      card.addClass(thumbnailCls);
      this.setupCoverErrorHandler(coverEl, img);
    } else if (display === 'background') {
      const coverEl = card.createDiv({ cls: 'planner-kanban-card-cover planner-kanban-cover--background' });
      const img = coverEl.createEl('img');
      img.src = imgSrc;
      img.alt = '';
      card.addClass('planner-kanban-card--background-cover');
      this.setupCoverErrorHandler(coverEl, img);
    }
  }

  private setupCoverErrorHandler(coverEl: HTMLElement, img: HTMLImageElement): void {
    // Handle image load errors - hide cover if image fails
    img.addEventListener('error', () => {
      coverEl.addClass('planner-display-none');
    });
  }

  private resolveImagePath(path: string): string | null {
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

    // If empty after cleaning, return null
    if (!cleanPath) {
      return null;
    }

    // Normalize relative paths - remove leading ../ or ./ segments
    // Obsidian's vault API expects paths relative to vault root
    const normalizedPath = cleanPath.replace(/^(\.\.\/)+|^\.\//, '');

    // Extract just the filename for fallback searches
    const filename = normalizedPath.split('/').pop() || normalizedPath;

    // Try direct path lookup first (works for absolute vault paths)
    const file = this.plugin.app.vault.getAbstractFileByPath(normalizedPath);
    if (file) {
      return this.plugin.app.vault.getResourcePath(file as unknown);
    }

    // Try with common image extensions if no extension present
    const hasExtension = /\.\w+$/.test(normalizedPath);
    if (!hasExtension) {
      for (const ext of ['.png', '.jpg', '.jpeg', '.gif', '.webp', '.svg']) {
        const fileWithExt = this.plugin.app.vault.getAbstractFileByPath(normalizedPath + ext);
        if (fileWithExt) {
          return this.plugin.app.vault.getResourcePath(fileWithExt as unknown);
        }
      }
    }

    // Search all files in vault for matching path or filename
    // This handles: relative paths, shortest path format, and various link styles
    const files = this.plugin.app.vault.getFiles();
    const matchingFile = files.find(f =>
      f.path === normalizedPath ||
      f.path.endsWith('/' + normalizedPath) ||
      f.basename === filename.replace(/\.\w+$/, '') ||  // Match without extension
      f.name === filename                                // Match with extension
    );
    if (matchingFile) {
      return this.plugin.app.vault.getResourcePath(matchingFile);
    }

    // Return null if file not found - caller should handle this gracefully
    return null;
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

    // CSS classes handle badge container layout based on placement
    if (placement === 'inline') {
      badgeContainer.classList.add('planner-kanban-badges--inline');
    } else {
      badgeContainer.classList.add('planner-kanban-badges--bottom');
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
        const calendarName = Array.isArray(calendar) ? String(calendar[0]) : String(calendar);
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

    // Hide empty badge container (use CSS class)
    if (badgeContainer.childElementCount === 0) {
      badgeContainer.addClass('planner-display-none');
    }
  }

  private createBadge(container: HTMLElement, text: string, color: string, icon?: string): void {
    const badge = container.createSpan({ cls: 'planner-badge planner-kanban-badge' });
    // Dynamic color from user config - use setCssProps for background, inline for computed text color
    badge.setCssProps({ '--badge-bg': color });
     
    badge.style.backgroundColor = color;
     
    badge.style.color = this.getContrastColor(color);

    if (icon) {
      const iconEl = badge.createSpan({ cls: 'planner-kanban-badge-icon' });
      setIcon(iconEl, icon);
    }

    badge.createSpan({ text });
  }

  private createDateBadge(container: HTMLElement, value: unknown, icon: string): void {
    const dateStr = this.formatDate(value);
    if (!dateStr) return;

    // CSS class handles all styles for date badge
    const badge = container.createSpan({ cls: 'planner-badge planner-kanban-badge planner-kanban-badge-date' });

    const iconEl = badge.createSpan({ cls: 'planner-kanban-badge-icon' });
    setIcon(iconEl, icon);

    badge.createSpan({ text: dateStr });
  }

  private createGenericBadge(container: HTMLElement, label: string, value: string): void {
    // CSS class handles all styles for generic badge
    const badge = container.createSpan({ cls: 'planner-badge planner-kanban-badge planner-kanban-badge-generic' });

    // Truncate long values
    const displayValue = value.length > 20 ? value.substring(0, 18) + '…' : value;
    badge.createSpan({ text: displayValue });
    badge.setAttribute('title', `${label}: ${value}`);
  }

  private formatDate(value: unknown): string | null {
    if (!value) return null;
    if (typeof value !== 'string' && typeof value !== 'number' && !(value instanceof Date)) return null;

    try {
      const date = value instanceof Date ? value : new Date(value);
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
    this.touchDragClone.className = 'planner-kanban-drag-clone';
    this.touchDragClone.setCssProps({ '--clone-width': `${card.offsetWidth}px` });
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
        void this.handleCardDrop(this.draggedCardPath, dropTarget.group, dropTarget.swimlane);
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

    container.addEventListener('drop', (e: DragEvent) => {
      e.preventDefault();
      container.classList.remove('planner-kanban-cards--dragover');

      if (this.draggedCardPath) {
        void this.handleCardDrop(this.draggedCardPath, groupKey, swimlaneKey);
      }
    });
  }

  private async handleCardDrop(filePath: string, newGroupValue: string, newSwimlaneValue?: string): Promise<void> {
    try {
      const groupByField = this.getGroupBy();
      const fieldName = groupByField.replace(/^(note|file)\./, '');
      const swimlaneBy = this.getSwimlaneBy();
      const swimlaneFieldName = swimlaneBy ? swimlaneBy.replace(/^(note|file)\./, '') : null;

      const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
      if (!(file instanceof TFile)) return;

      // Check if we need to handle folder moves
      const isFolderGroupBy = this.isFolderProperty(groupByField);
      const isFolderSwimlane = swimlaneBy ? this.isFolderProperty(swimlaneBy) : false;

      // Determine target folder from either groupBy or swimlane (folder takes priority)
      let targetFolder: string | null = null;
      if (isFolderGroupBy && newGroupValue && newGroupValue !== 'None') {
        targetFolder = this.findFolderPath(newGroupValue);
      } else if (isFolderSwimlane && newSwimlaneValue && newSwimlaneValue !== 'None') {
        targetFolder = this.findFolderPath(newSwimlaneValue);
      }

      // Move file if folder changed
      let newFilePath = filePath;
      if (targetFolder !== null) {
        const currentFolder = file.parent?.path || '';
        if (targetFolder !== currentFolder) {
          const movedPath = await this.plugin.itemService.moveItem(filePath, targetFolder);
          if (movedPath) {
            newFilePath = movedPath;
          }
        }
      }

      // Now update frontmatter for non-folder properties
      const needsFrontmatterUpdate =
        (!isFolderGroupBy && newGroupValue !== undefined) ||
        (!isFolderSwimlane && swimlaneFieldName && newSwimlaneValue !== undefined);

      if (needsFrontmatterUpdate) {
        const fileToUpdate = this.plugin.app.vault.getAbstractFileByPath(newFilePath);
        if (!(fileToUpdate instanceof TFile)) return;

        await this.plugin.app.fileManager.processFrontMatter(fileToUpdate, (fm: Record<string, unknown>) => {
          // Update groupBy field (if not folder)
          if (!isFolderGroupBy) {
            fm[fieldName] = this.convertValueForField(fieldName, newGroupValue);
          }
          // Update swimlane field (if not folder)
          if (!isFolderSwimlane && swimlaneFieldName && newSwimlaneValue !== undefined) {
            fm[swimlaneFieldName] = this.convertValueForField(swimlaneFieldName, newSwimlaneValue);
          }
          fm.date_modified = new Date().toISOString();
        });
      }
    } catch (error) {
      console.error('Planner: Failed to update card:', error);
      new Notice('Failed to move card. Check console for details.');
    }
  }

  /**
   * Check if a property ID refers to folder
   */
  private isFolderProperty(propId: string): boolean {
    const normalized = propId.replace(/^(note|file)\./, '');
    return normalized === 'folder';
  }

  /**
   * Convert a value for a specific field, handling special cases like tags and multi-value properties
   */
  private convertValueForField(fieldName: string, value: string): string | string[] {
    // If the value contains a comma, it was joined from an array by valueToString
    // and should be split back into an array
    const hasMultipleValues = value.includes(',');

    if (hasMultipleValues) {
      // Split comma-separated values into array
      const values = value.split(',').map(v => v.trim()).filter(v => v.length > 0);

      // For tags, ensure each value has # prefix
      if (fieldName === 'tags') {
        return values.map(v => v.startsWith('#') ? v : `#${v}`);
      }

      return values;
    }

    // Single value - check if it should still be an array (for tags)
    if (fieldName === 'tags') {
      const normalizedTag = value.startsWith('#') ? value : `#${value}`;
      return [normalizedTag];
    }

    return value;
  }

  /**
   * Find the full path to a folder by its name
   * Returns the first matching folder path, or null if not found
   */
  private findFolderPath(folderName: string): string | null {
    if (folderName === 'Root' || folderName === '/') {
      return '';
    }

    const allFiles = this.plugin.app.vault.getAllLoadedFiles();
    for (const file of allFiles) {
      if (file instanceof TFolder && file.name === folderName) {
        return file.path;
      }
    }
    return null;
  }

  private async handleCardClick(entry: BasesEntry): Promise<void> {
    const item = await this.plugin.itemService.getItem(entry.file.path);
    if (item) {
      void openItemModal(this.plugin, { mode: 'edit', item });
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
    icon: 'square-kanban',
    factory: (controller: QueryController, containerEl: HTMLElement) => {
      return new BasesKanbanView(controller, containerEl, plugin);
    },
    options: () => [
      {
        type: 'property',
        key: 'groupBy',
        displayName: 'Columns by',
        default: 'note.status',
        placeholder: 'Select property',
        filter: (propId: BasesPropertyId) =>
          PropertyTypeService.isCategoricalProperty(propId, plugin.app),
      },
      {
        type: 'property',
        key: 'swimlaneBy',
        displayName: 'Swimlanes by',
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
        type: 'property',
        key: 'titleBy',
        displayName: 'Title by',
        default: 'note.title',
        placeholder: 'Select property',
        filter: (propId: BasesPropertyId) =>
          PropertyTypeService.isTextProperty(propId, plugin.app),
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
        default: 'note.cover',
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
        default: '100',
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
      {
        type: 'dropdown',
        key: 'showAddNewButtons',
        displayName: 'Show add new buttons',
        default: 'true',
        options: {
          'true': 'Show',
          'false': 'Hide',
        },
      },
      {
        type: 'dropdown',
        key: 'freezeHeaders',
        displayName: 'Freeze headers',
        default: 'both',
        options: {
          'off': 'Off',
          'columns': 'Columns',
          'swimlanes': 'Swimlanes',
          'both': 'Both',
        },
      },
      {
        type: 'dropdown',
        key: 'swimHeaderDisplay',
        displayName: 'Swimlane header display',
        default: 'vertical',
        options: {
          'horizontal': 'Horizontal',
          'vertical': 'Vertical',
        },
      },
    ],
  };
}
