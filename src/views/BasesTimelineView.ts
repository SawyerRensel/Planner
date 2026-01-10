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
  BasesPropertyId,
  QueryController,
  setIcon,
  TFile,
} from 'obsidian';
import type PlannerPlugin from '../main';
import { openItemModal } from '../components/ItemModal';
import { MarkwhenAdapter, AdapterOptions } from '../services/MarkwhenAdapter';
import { PropertyTypeService } from '../services/PropertyTypeService';
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

  // Configuration getters - now accept any property ID for custom properties
  private getGroupBy(): TimelineGroupBy {
    const value = this.config?.get('groupBy') as string | undefined;
    // Accept any property ID; empty string or undefined means 'none'
    if (!value) return 'none';
    return value;
  }

  private getSectionsBy(): TimelineSectionsBy {
    const value = this.config?.get('sectionsBy') as string | undefined;
    // Accept any property ID; empty string or undefined means 'none'
    if (!value) return 'none';
    return value;
  }

  private getColorBy(): TimelineColorBy {
    const value = this.config?.get('colorBy') as string | undefined;
    // Accept any property ID; empty string or undefined defaults to calendar
    if (!value) return 'note.calendar';
    return value;
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

  private getBackgroundColor(): string | undefined {
    const value = this.config?.get('backgroundColor') as string | undefined;
    // Return undefined for 'default' or empty to use theme defaults
    if (!value || value === 'default') return undefined;
    return value;
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
      backgroundColor: this.getBackgroundColor(),
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
    // Use requestAnimationFrame to break out of postMessage context (same as handleSetDetailPath)
    requestAnimationFrame(() => {
      openItemModal(this.plugin, {
        mode: 'create',
        prePopulate: {
          date_start_scheduled: params.dateRangeIso.fromDateTimeIso,
          date_end_scheduled: params.dateRangeIso.toDateTimeIso,
        },
      });
    });
  }

  /**
   * Handle detail path selection (click on event)
   */
  private async handleSetDetailPath(path: EventPath): Promise<void> {
    const filePath = this.adapter.resolvePathToFilePath(path);
    if (!filePath) return;

    // Load the full item data for editing
    const item = await this.plugin.itemService.getItem(filePath);
    if (item) {
      // Use requestAnimationFrame to break out of the postMessage event context.
      // Opening a Modal from within a postMessage handler causes scope registration
      // issues that make Modal.close() fail with "instanceOf is not a function".
      requestAnimationFrame(() => {
        openItemModal(this.plugin, { mode: 'edit', item });
      });
    } else {
      // Fallback to opening the file if item can't be loaded
      const file = this.plugin.app.vault.getAbstractFileByPath(filePath);
      if (file instanceof TFile) {
        await this.plugin.app.workspace.openLinkText(filePath, '', 'tab');
      }
    }
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
        type: 'property',
        key: 'sectionsBy',
        displayName: 'Sections by',
        default: '',
        placeholder: 'None',
        filter: (propId: BasesPropertyId) =>
          PropertyTypeService.isCategoricalProperty(propId, plugin.app),
      },
      {
        type: 'property',
        key: 'groupBy',
        displayName: 'Group by',
        default: 'note.calendar',
        placeholder: 'None',
        filter: (propId: BasesPropertyId) =>
          PropertyTypeService.isCategoricalProperty(propId, plugin.app),
      },
      {
        type: 'property',
        key: 'colorBy',
        displayName: 'Color by',
        default: 'note.calendar',
        placeholder: 'None',
        filter: (propId: BasesPropertyId) =>
          PropertyTypeService.isCategoricalProperty(propId, plugin.app),
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
        type: 'property',
        key: 'titleField',
        displayName: 'Title field',
        default: 'note.title',
        placeholder: 'Select property',
        filter: (propId: BasesPropertyId) =>
          PropertyTypeService.isTextProperty(propId, plugin.app),
      },
      {
        type: 'dropdown',
        key: 'backgroundColor',
        displayName: 'Background color',
        default: 'default',
        options: {
          'default': 'Default (theme)',
          '#1e1e2e': 'Catppuccin Mocha',
          '#24273a': 'Catppuccin Macchiato',
          '#303446': 'Catppuccin Frappe',
          '#eff1f5': 'Catppuccin Latte',
          '#002b36': 'Solarized Dark',
          '#fdf6e3': 'Solarized Light',
          '#282c34': 'One Dark',
          '#fafafa': 'One Light',
          '#1a1b26': 'Tokyo Night',
          '#24283b': 'Tokyo Night Storm',
          '#0d1117': 'GitHub Dark',
          '#ffffff': 'GitHub Light',
          '#2e3440': 'Nord',
          '#282a36': 'Dracula',
          '#1e1e1e': 'VS Code Dark',
        },
      },
    ],
  };
}
