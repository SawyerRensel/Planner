/**
 * BasesTimelineView - Markwhen Timeline integration for Obsidian Bases
 *
 * This view displays items on a beautiful timeline using the Markwhen
 * Timeline component embedded in an iframe with LPC communication.
 */

import {
  BasesView,
  BasesViewRegistration,
  BasesEntry,
  QueryController,
  setIcon,
  TFile,
} from 'obsidian';
import type PlannerPlugin from '../main';
import { openItemModal } from '../components/ItemModal';
import { MarkwhenAdapter, AdapterOptions } from '../services/MarkwhenAdapter';
import { LpcHost, LpcCallbacks } from '../services/LpcHost';
import {
  TimelineGroupBy,
  TimelineColorBy,
  MarkwhenState,
  AppState,
  EditEventDateRangeMessage,
  NewEventMessage,
  EventPath,
} from '../types/markwhen';
// Markwhen Timeline rebuilt with memory router (no History API needed)
import timelineHtml from '../../assets/timeline-markwhen.html';

export const BASES_TIMELINE_VIEW_ID = 'planner-timeline';

/**
 * Timeline View for Obsidian Bases
 * Displays items on a Markwhen Timeline
 */
export class BasesTimelineView extends BasesView {
  type = BASES_TIMELINE_VIEW_ID;
  private plugin: PlannerPlugin;
  private containerEl: HTMLElement;
  private toolbarEl: HTMLElement | null = null;
  private iframeContainer: HTMLElement | null = null;
  private iframe: HTMLIFrameElement | null = null;
  private adapter: MarkwhenAdapter;
  private lpcHost: LpcHost;
  private isInitialized: boolean = false;
  private resizeObserver: ResizeObserver | null = null;
  // Cached state for responding to Timeline requests
  private currentMarkwhenState: MarkwhenState | null = null;
  private currentAppState: AppState | null = null;

  // Configuration getters
  private getGroupBy(): TimelineGroupBy {
    const value = this.config?.get('groupBy') as string | undefined;
    const validValues: TimelineGroupBy[] = ['none', 'calendar', 'status', 'parent', 'people', 'priority'];
    if (value && validValues.includes(value as TimelineGroupBy)) {
      return value as TimelineGroupBy;
    }
    return 'calendar';
  }

  private getColorBy(): TimelineColorBy {
    const value = this.config?.get('colorBy') as string | undefined;
    if (value === 'note.priority' || value === 'note.status') {
      return value;
    }
    return 'note.calendar';
  }

  private getDateStartField(): string {
    const value = this.config?.get('dateStartField') as string | undefined;
    return value || 'note.date_start_scheduled';
  }

  private getDateEndField(): string {
    const value = this.config?.get('dateEndField') as string | undefined;
    return value || 'note.date_end_scheduled';
  }

  private getTitleField(): string {
    const value = this.config?.get('titleField') as string | undefined;
    return value || 'note.title';
  }

  constructor(
    controller: QueryController,
    containerEl: HTMLElement,
    plugin: PlannerPlugin
  ) {
    super(controller, containerEl);
    this.plugin = plugin;
    this.containerEl = containerEl;
    this.adapter = new MarkwhenAdapter(plugin.settings);

    // Set up LPC callbacks
    const callbacks: LpcCallbacks = {
      onEditEventDateRange: this.handleEditEventDateRange.bind(this),
      onNewEvent: this.handleNewEvent.bind(this),
      onSetDetailPath: this.handleSetDetailPath.bind(this),
      onSetHoveringPath: this.handleSetHoveringPath.bind(this),
      // State providers - called when Timeline requests current state
      getMarkwhenState: () => this.currentMarkwhenState,
      getAppState: () => this.currentAppState,
    };
    this.lpcHost = new LpcHost(callbacks);
  }

  /**
   * Render the timeline view - called internally
   */
  private render(): void {
    console.log('Timeline: render() called');

    // Set up container if needed
    if (!this.iframeContainer || !this.iframeContainer.isConnected) {
      this.setupContainer();
    }

    // Initialize or update timeline
    if (!this.isInitialized) {
      this.initTimeline();
    } else {
      this.updateTimeline();
    }
  }

  /**
   * Set up the container with toolbar and iframe
   */
  private setupContainer(): void {
    console.log('Timeline: setupContainer() called');

    // Clear container
    this.containerEl.empty();
    this.containerEl.addClass('planner-bases-timeline');

    // Build toolbar
    this.buildToolbar();

    // Build iframe container
    this.buildIframeContainer();

    // Set up resize observer
    this.setupResizeObserver();

    console.log('Timeline: container setup complete, iframe exists:', !!this.iframe);
  }

  /**
   * Called by Bases when data is updated
   */
  onDataUpdated(): void {
    console.log('Timeline: onDataUpdated() called');
    this.render();
  }

  /**
   * Build the toolbar
   */
  private buildToolbar(): void {
    this.toolbarEl = this.containerEl.createDiv('planner-timeline-toolbar');

    // Group By dropdown
    const groupByContainer = this.toolbarEl.createDiv('planner-timeline-toolbar-item');
    groupByContainer.createSpan({ text: 'Group: ', cls: 'planner-timeline-label' });
    const groupBySelect = groupByContainer.createEl('select', { cls: 'planner-timeline-select' });

    const groupOptions: { value: TimelineGroupBy; label: string }[] = [
      { value: 'none', label: 'None' },
      { value: 'calendar', label: 'Calendar' },
      { value: 'status', label: 'Status' },
      { value: 'priority', label: 'Priority' },
      { value: 'parent', label: 'Parent' },
      { value: 'people', label: 'People' },
    ];

    const currentGroupBy = this.getGroupBy();
    for (const opt of groupOptions) {
      const option = groupBySelect.createEl('option', {
        value: opt.value,
        text: opt.label,
      });
      if (opt.value === currentGroupBy) {
        option.selected = true;
      }
    }

    groupBySelect.addEventListener('change', () => {
      this.config?.set('groupBy', groupBySelect.value);
      this.updateTimeline();
    });

    // Color By dropdown
    const colorByContainer = this.toolbarEl.createDiv('planner-timeline-toolbar-item');
    colorByContainer.createSpan({ text: 'Color: ', cls: 'planner-timeline-label' });
    const colorBySelect = colorByContainer.createEl('select', { cls: 'planner-timeline-select' });

    const colorOptions: { value: TimelineColorBy; label: string }[] = [
      { value: 'note.calendar', label: 'Calendar' },
      { value: 'note.priority', label: 'Priority' },
      { value: 'note.status', label: 'Status' },
    ];

    const currentColorBy = this.getColorBy();
    for (const opt of colorOptions) {
      const option = colorBySelect.createEl('option', {
        value: opt.value,
        text: opt.label,
      });
      if (opt.value === currentColorBy) {
        option.selected = true;
      }
    }

    colorBySelect.addEventListener('change', () => {
      this.config?.set('colorBy', colorBySelect.value);
      this.updateTimeline();
    });

    // Spacer
    this.toolbarEl.createDiv('planner-timeline-spacer');

    // Add Item button
    const addBtn = this.toolbarEl.createEl('button', {
      cls: 'planner-timeline-btn',
      attr: { 'aria-label': 'Add item' },
    });
    setIcon(addBtn, 'plus');
    addBtn.addEventListener('click', () => {
      openItemModal(this.plugin, { mode: 'create' });
    });
  }

  /**
   * Build the iframe container
   */
  private buildIframeContainer(): void {
    this.iframeContainer = this.containerEl.createDiv('planner-timeline-iframe-container');

    // Create iframe (no sandbox needed - we control the content)
    this.iframe = this.iframeContainer.createEl('iframe', {
      cls: 'planner-timeline-iframe',
      attr: {
        title: 'Markwhen Timeline',
      },
    });

    // Connect LPC host to iframe
    this.lpcHost.connect(this.iframe);
  }

  private blobUrl: string | null = null;

  /**
   * Initialize the timeline
   */
  private initTimeline(): void {
    if (!this.iframe) {
      console.log('Timeline: No iframe element');
      return;
    }

    console.log('Timeline: Initializing iframe...');

    // Pre-compute state before loading iframe so it's ready for requests
    this.computeState();

    // Load the Timeline HTML into the iframe using blob URL
    const html = this.getTimelineHtml();
    console.log('Timeline: HTML length:', html.length);

    // Clean up previous blob URL
    if (this.blobUrl) {
      URL.revokeObjectURL(this.blobUrl);
    }

    // Create blob URL
    const blob = new Blob([html], { type: 'text/html' });
    this.blobUrl = URL.createObjectURL(blob);

    // Set up onload handler
    this.iframe.onload = () => {
      console.log('Timeline: iframe loaded');
      this.isInitialized = true;

      // Push initial state to the Timeline after it's loaded
      // The Timeline's useLpc listeners receive state via "request" messages
      if (this.currentMarkwhenState && this.currentAppState) {
        console.log('Timeline: Pushing initial state to iframe');
        this.lpcHost.sendState(this.currentMarkwhenState, this.currentAppState);
      }
    };

    this.iframe.src = this.blobUrl;
  }

  /**
   * Compute and cache the current state
   */
  private computeState(): void {
    // Get entries from Bases data
    const entries = this.getEntriesFromData();
    console.log('Timeline: Computing state for', entries.length, 'entries');

    // Build adapter options
    const options: AdapterOptions = {
      groupBy: this.getGroupBy(),
      colorBy: this.getColorBy(),
      dateStartField: this.getDateStartField(),
      dateEndField: this.getDateEndField(),
      titleField: this.getTitleField(),
    };

    // Adapt entries to Markwhen format
    const { parseResult, colorMap } = this.adapter.adapt(entries, options);
    console.log('Timeline: Adapted to', parseResult.events?.children?.length || 0, 'events/groups');

    // Cache Markwhen state
    this.currentMarkwhenState = {
      rawText: '',
      parsed: parseResult,
    };

    // Cache app state
    this.currentAppState = {
      isDark: document.body.classList.contains('theme-dark'),
      colorMap,
    };
  }

  /**
   * Update the timeline with current data
   */
  private updateTimeline(): void {
    console.log('Timeline: updateTimeline called, initialized:', this.isInitialized, 'iframe:', !!this.iframe);
    if (!this.iframe) return;

    // Compute and cache state
    this.computeState();

    // If initialized, push state update to Timeline
    if (this.isInitialized && this.currentMarkwhenState && this.currentAppState) {
      console.log('Timeline: Pushing state update to iframe');
      this.lpcHost.sendState(this.currentMarkwhenState, this.currentAppState);
    }
  }

  /**
   * Get entries from Bases data
   */
  private getEntriesFromData(): BasesEntry[] {
    const entries: BasesEntry[] = [];

    if (!this.data?.groupedData) return entries;

    for (const group of this.data.groupedData) {
      if (group.entries) {
        entries.push(...group.entries);
      }
    }

    return entries;
  }

  /**
   * Handle edit event date range from Timeline
   */
  private async handleEditEventDateRange(params: EditEventDateRangeMessage): Promise<void> {
    const filePath = this.adapter.resolvePathToFilePath(params.path);
    if (!filePath) {
      console.warn('Timeline: Could not resolve path to file:', params.path);
      return;
    }

    const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) {
      console.warn('Timeline: File not found:', filePath);
      return;
    }

    // Get the field names
    const startFieldName = this.getDateStartField().replace(/^note\./, '');
    const endFieldName = this.getDateEndField().replace(/^note\./, '');

    // Update frontmatter
    await this.plugin.app.fileManager.processFrontMatter(file, (fm) => {
      fm[startFieldName] = params.range.fromDateTimeIso;
      fm[endFieldName] = params.range.toDateTimeIso;
      fm.date_modified = new Date().toISOString();
    });
  }

  /**
   * Handle new event creation from Timeline
   */
  private handleNewEvent(params: NewEventMessage): void {
    // Open ItemModal with pre-filled dates
    openItemModal(this.plugin, {
      mode: 'create',
      prefill: {
        date_start_scheduled: params.dateRangeIso.fromDateTimeIso,
        date_end_scheduled: params.dateRangeIso.toDateTimeIso,
      },
    });
  }

  /**
   * Handle detail path selection (click on event)
   */
  private handleSetDetailPath(path: EventPath): void {
    const filePath = this.adapter.resolvePathToFilePath(path);
    if (!filePath) return;

    const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
    if (!(file instanceof TFile)) return;

    // Open ItemModal for editing
    openItemModal(this.plugin, {
      mode: 'edit',
      file,
    });
  }

  /**
   * Handle hovering path (hover on event)
   */
  private handleSetHoveringPath(path: EventPath): void {
    // Could show a tooltip or highlight - for now, no-op
  }

  /**
   * Set up resize observer
   */
  private setupResizeObserver(): void {
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
    }

    this.resizeObserver = new ResizeObserver(() => {
      // Resize handling if needed
    });

    if (this.iframeContainer) {
      this.resizeObserver.observe(this.iframeContainer);
    }
  }

  /**
   * Get the Timeline HTML to load into the iframe
   * Uses the pre-built Markwhen Timeline bundled from @markwhen/timeline
   */
  private getTimelineHtml(): string {
    return timelineHtml;
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.lpcHost.disconnect();

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    this.iframe = null;
    this.isInitialized = false;
    this.currentMarkwhenState = null;
    this.currentAppState = null;
  }
}

/**
 * Create the view registration for Obsidian Bases
 */
export function createTimelineViewRegistration(plugin: PlannerPlugin): BasesViewRegistration {
  return {
    name: 'Timeline',
    icon: 'calendar-range',
    factory: (controller: QueryController, containerEl: HTMLElement) => {
      return new BasesTimelineView(controller, containerEl, plugin);
    },
    options: () => [
      {
        type: 'dropdown',
        key: 'groupBy',
        displayName: 'Group by',
        default: 'calendar',
        options: {
          none: 'None',
          calendar: 'Calendar',
          status: 'Status',
          priority: 'Priority',
          parent: 'Parent',
          people: 'People',
        },
      },
      {
        type: 'dropdown',
        key: 'colorBy',
        displayName: 'Color by',
        default: 'note.calendar',
        options: {
          'note.calendar': 'Calendar',
          'note.priority': 'Priority',
          'note.status': 'Status',
        },
      },
      {
        type: 'dropdown',
        key: 'dateStartField',
        displayName: 'Date start field',
        default: 'note.date_start_scheduled',
        options: {
          'note.date_start_scheduled': 'Date Start Scheduled',
          'note.date_start_actual': 'Date Start Actual',
          'note.date_created': 'Date Created',
        },
      },
      {
        type: 'dropdown',
        key: 'dateEndField',
        displayName: 'Date end field',
        default: 'note.date_end_scheduled',
        options: {
          'note.date_end_scheduled': 'Date End Scheduled',
          'note.date_end_actual': 'Date End Actual',
          'note.date_modified': 'Date Modified',
        },
      },
      {
        type: 'dropdown',
        key: 'titleField',
        displayName: 'Title field',
        default: 'note.title',
        options: {
          'note.title': 'Title',
          'note.summary': 'Summary',
        },
      },
    ],
  };
}
