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
  TimelineSectionsBy,
  TimelineColorBy,
  MarkwhenState,
  AppState,
  EditEventDateRangeMessage,
  NewEventMessage,
  EventPath,
} from '../types/markwhen';

// Timeline HTML is bundled inline for mobile compatibility
// Runtime file loading doesn't work reliably on mobile platforms
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

  private getSectionsBy(): TimelineSectionsBy {
    const value = this.config?.get('sectionsBy') as string | undefined;
    const validValues: TimelineSectionsBy[] = ['none', 'calendar', 'status', 'priority', 'folder'];
    if (value && validValues.includes(value as TimelineSectionsBy)) {
      return value as TimelineSectionsBy;
    }
    return 'none';
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
    this.adapter = new MarkwhenAdapter(plugin.settings, this.app);

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
   * Set up the container with iframe
   */
  private setupContainer(): void {
    console.log('Timeline: setupContainer() called');

    // Clear container
    this.containerEl.empty();
    this.containerEl.addClass('planner-bases-timeline');

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

  /**
   * Show an error message in the container
   */
  private showError(message: string): void {
    this.containerEl.empty();
    const errorDiv = this.containerEl.createEl('div', {
      cls: 'planner-timeline-error',
    });
    errorDiv.createEl('div', {
      text: '⚠️ Timeline Error',
      cls: 'planner-timeline-error-title',
    });
    errorDiv.createEl('div', {
      text: message,
      cls: 'planner-timeline-error-message',
    });
  }

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

    // Verify bundled HTML is available
    if (!timelineHtml || timelineHtml.length === 0) {
      console.error('Timeline: Bundled HTML is empty');
      this.showError('Timeline HTML not found. Please reinstall the plugin.');
      return;
    }
    console.log('Timeline: HTML length:', timelineHtml.length);

    // Set up error handler
    this.iframe.onerror = (event) => {
      console.error('Timeline: iframe error:', event);
      this.showError('Failed to load Timeline content. Please try reloading.');
    };

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

    // Use srcdoc instead of blob URL for better mobile compatibility
    // srcdoc embeds HTML directly in the iframe attribute, avoiding
    // blob URL issues on mobile browsers
    this.iframe.srcdoc = timelineHtml;
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
      sectionsBy: this.getSectionsBy(),
      colorBy: this.getColorBy(),
      dateStartField: this.getDateStartField(),
      dateEndField: this.getDateEndField(),
      titleField: this.getTitleField(),
    };

    // Adapt entries to Markwhen format
    const { parseResult, colorMap } = this.adapter.adapt(entries, options);
    console.log('Timeline: Adapted to', parseResult.events?.children?.length || 0, 'events/groups');

    // Cache Markwhen state
    // Note: 'transformed' is required by the Timeline's timelineStore
    this.currentMarkwhenState = {
      rawText: '',
      parsed: parseResult,
      transformed: parseResult.events,
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
    icon: 'square-chart-gantt',
    factory: (controller: QueryController, containerEl: HTMLElement) => {
      return new BasesTimelineView(controller, containerEl, plugin);
    },
    options: () => [
      {
        type: 'dropdown',
        key: 'sectionsBy',
        displayName: 'Sections by',
        default: 'none',
        options: {
          none: 'None',
          calendar: 'Calendar',
          status: 'Status',
          priority: 'Priority',
          folder: 'Folder',
        },
      },
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
