import {
  BasesView,
  BasesViewRegistration,
  BasesEntry,
  QueryController,
  setIcon,
} from 'obsidian';
import { gantt, Task, Link } from 'dhtmlx-gantt';
// Import DHTMLX Gantt CSS - will be merged into styles.css by esbuild
import 'dhtmlx-gantt/codebase/dhtmlxgantt.css';
import type PlannerPlugin from '../main';
import { openItemModal } from '../components/ItemModal';

export const BASES_GANTT_VIEW_ID = 'planner-gantt';

type GanttZoomLevel = 'day' | 'week' | 'month' | 'quarter' | 'year';

interface GanttTaskExtended extends Task {
  $entry?: BasesEntry;
}

/**
 * Gantt view for Obsidian Bases
 * Displays items on a Gantt chart using DHTMLX Gantt
 */
export class BasesGanttView extends BasesView {
  type = BASES_GANTT_VIEW_ID;
  private plugin: PlannerPlugin;
  private containerEl: HTMLElement;
  private toolbarEl: HTMLElement | null = null;
  private ganttEl: HTMLElement | null = null;
  private currentZoom: GanttZoomLevel = 'month';
  private resizeObserver: ResizeObserver | null = null;
  private eventIds: string[] = [];
  private isInitialized: boolean = false;

  private getColorByField(): 'note.calendar' | 'note.priority' | 'note.status' {
    const value = this.config?.get('colorBy') as string | undefined;
    if (value === 'note.priority' || value === 'note.status') {
      return value;
    }
    return 'note.calendar';
  }

  private getDefaultZoom(): GanttZoomLevel {
    const value = this.config?.get('defaultZoom') as string | undefined;
    const validZooms: GanttZoomLevel[] = ['day', 'week', 'month', 'quarter', 'year'];
    if (value && validZooms.includes(value as GanttZoomLevel)) {
      return value as GanttZoomLevel;
    }
    return 'month';
  }

  private getDateStartField(): string {
    const value = this.config?.get('dateStartField') as string | undefined;
    return value || 'note.date_start_scheduled';
  }

  private getDateEndField(): string {
    const value = this.config?.get('dateEndField') as string | undefined;
    return value || 'note.date_end_scheduled';
  }

  private getShowProgress(): boolean {
    const value = this.config?.get('showProgress');
    return value !== false;
  }

  private getShowDependencies(): boolean {
    const value = this.config?.get('showDependencies');
    return value !== false;
  }

  private getAutoScrollToday(): boolean {
    const value = this.config?.get('autoScrollToday');
    return value !== false;
  }

  constructor(
    controller: QueryController,
    containerEl: HTMLElement,
    plugin: PlannerPlugin
  ) {
    super(controller);
    this.plugin = plugin;
    this.containerEl = containerEl;
    this.currentZoom = this.getDefaultZoom();
    this.setupContainer();
    this.setupResizeObserver();
  }

  private setupContainer(): void {
    this.containerEl.empty();
    this.containerEl.addClass('planner-bases-gantt');
    this.containerEl.style.cssText = 'height: 100%; display: flex; flex-direction: column;';

    // Create toolbar for zoom controls
    this.toolbarEl = this.containerEl.createDiv({ cls: 'planner-gantt-toolbar' });
    this.createToolbar();

    // Create Gantt container
    this.ganttEl = this.containerEl.createDiv({ cls: 'planner-gantt-container' });
    this.ganttEl.style.cssText = 'flex: 1; min-height: 400px; overflow: hidden;';
  }

  private createToolbar(): void {
    if (!this.toolbarEl) return;

    // Zoom label
    const zoomLabel = this.toolbarEl.createSpan({ cls: 'planner-gantt-zoom-label' });
    zoomLabel.textContent = 'Zoom:';

    // Zoom buttons
    const zoomLevels: { level: GanttZoomLevel; label: string }[] = [
      { level: 'day', label: 'D' },
      { level: 'week', label: 'W' },
      { level: 'month', label: 'M' },
      { level: 'quarter', label: 'Q' },
      { level: 'year', label: 'Y' },
    ];

    for (const { level, label } of zoomLevels) {
      const btn = this.toolbarEl.createEl('button', {
        cls: `planner-gantt-zoom-btn ${this.currentZoom === level ? 'active' : ''}`,
        attr: { 'data-zoom': level, title: `${level.charAt(0).toUpperCase() + level.slice(1)} view` },
      });
      btn.textContent = label;
      btn.addEventListener('click', () => this.setZoomLevel(level));
    }

    // Spacer
    this.toolbarEl.createDiv({ cls: 'planner-gantt-toolbar-spacer' });

    // Today button
    const todayBtn = this.toolbarEl.createEl('button', {
      cls: 'planner-gantt-zoom-btn',
      attr: { title: 'Go to today' },
    });
    setIcon(todayBtn, 'calendar-check');
    todayBtn.addEventListener('click', () => this.scrollToToday());

    // Add item button
    const addBtn = this.toolbarEl.createEl('button', {
      cls: 'planner-gantt-zoom-btn',
      attr: { title: 'Add new item' },
    });
    setIcon(addBtn, 'plus');
    addBtn.addEventListener('click', () => this.createNewItem());
  }

  private setupResizeObserver(): void {
    this.resizeObserver = new ResizeObserver(() => {
      if (this.isInitialized) {
        gantt.render();
      }
    });
    this.resizeObserver.observe(this.containerEl);
  }

  onDataUpdated(): void {
    this.render();
  }

  onunload(): void {
    // Detach all event handlers
    this.eventIds.forEach(id => {
      try {
        gantt.detachEvent(id);
      } catch {
        // Ignore errors during cleanup
      }
    });
    this.eventIds = [];

    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }

    // Clear gantt
    if (this.isInitialized) {
      try {
        gantt.clearAll();
      } catch {
        // Ignore errors during cleanup
      }
    }
    this.isInitialized = false;
  }

  private render(): void {
    if (!this.ganttEl || !this.ganttEl.isConnected) {
      this.setupContainer();
    }

    if (this.ganttEl) {
      // Clear and reinitialize
      if (this.isInitialized) {
        gantt.clearAll();
      }
      this.initGantt();
    }
  }

  private initGantt(): void {
    if (!this.ganttEl) return;

    // Configure gantt before init
    this.configureGantt();

    // Initialize gantt
    if (!this.isInitialized) {
      gantt.init(this.ganttEl);
      this.isInitialized = true;
      this.setupEventHandlers();
    }

    // Load data
    const { tasks, links } = this.getTasksFromData();
    console.log('Planner Gantt: Loading tasks:', tasks);
    console.log('Planner Gantt: Loading links:', links);
    gantt.parse({ data: tasks, links: links });

    // Set zoom level
    this.setZoomLevel(this.currentZoom);

    // Add today marker (check if function exists)
    this.addTodayMarker();

    // Scroll to today if enabled
    if (this.getAutoScrollToday()) {
      this.scrollToToday();
    }
  }

  private configureGantt(): void {
    // Date format compatible with ISO 8601
    gantt.config.date_format = '%Y-%m-%d %H:%i';

    // Enable features
    gantt.config.drag_resize = true;
    gantt.config.drag_move = true;
    gantt.config.drag_progress = this.getShowProgress();
    gantt.config.drag_links = this.getShowDependencies();
    gantt.config.show_links = this.getShowDependencies();
    gantt.config.show_progress = this.getShowProgress();

    // Auto-expand all branches
    gantt.config.open_tree_initially = true;

    // Grid columns (left side)
    gantt.config.columns = [
      { name: 'text', label: 'Task', tree: true, width: 200, resize: true },
      { name: 'start_date', label: 'Start', align: 'center', width: 90 },
      {
        name: 'duration',
        label: 'Days',
        align: 'center',
        width: 50,
        template: (task: Task) => {
          const duration = task.duration ?? 0;
          return String(Math.round(duration));
        },
      },
    ];

    if (this.getShowProgress()) {
      gantt.config.columns.push({
        name: 'progress',
        label: '%',
        align: 'center',
        width: 45,
        template: (task: Task) => Math.round((task.progress || 0) * 100) + '%',
      });
    }

    // Today marker
    gantt.config.show_markers = true;

    // Row height - more compact
    gantt.config.row_height = 28;
    gantt.config.bar_height = 18;
    gantt.config.scale_height = 56; // Height for two scale rows

    // Link types (matching PRD requirements)
    gantt.config.links = {
      finish_to_start: '0',
      start_to_start: '1',
      finish_to_finish: '2',
      start_to_finish: '3',
    };

    // Set initial scales based on default zoom
    this.applyZoomScales(this.currentZoom);

    // Custom task rendering for colors
    gantt.templates.task_class = (start: Date, end: Date, task: GanttTaskExtended) => {
      const classes: string[] = [];
      if (task.type === 'milestone') {
        classes.push('gantt_milestone');
      }
      return classes.join(' ');
    };

    // Task bar style - apply color via inline style
    gantt.templates.task_row_class = (start: Date, end: Date, task: GanttTaskExtended) => {
      return '';
    };

    // Apply task color via inline style attribute
    (gantt.templates as any).task_style = (start: Date, end: Date, task: GanttTaskExtended) => {
      const color = task.color || '#6b7280';
      return `background-color: ${color}; border-color: ${color};`;
    };

    // Task text template
    gantt.templates.task_text = (start: Date, end: Date, task: Task) => {
      return task.text || '';
    };

    // Progress text
    if (this.getShowProgress()) {
      gantt.templates.progress_text = (start: Date, end: Date, task: Task) => {
        return Math.round((task.progress || 0) * 100) + '%';
      };
    }
  }

  private applyZoomScales(level: GanttZoomLevel): void {
    const scales: Record<GanttZoomLevel, any[]> = {
      day: [
        { unit: 'day', step: 1, format: '%d %M' },
        { unit: 'hour', step: 4, format: '%H:%i' },
      ],
      week: [
        { unit: 'week', step: 1, format: 'Week %W' },
        { unit: 'day', step: 1, format: '%d %D' },
      ],
      month: [
        { unit: 'month', step: 1, format: '%F %Y' },
        { unit: 'week', step: 1, format: 'W%W' },
      ],
      quarter: [
        { unit: 'year', step: 1, format: '%Y' },
        { unit: 'quarter', step: 1, format: 'Q%q' },
      ],
      year: [
        { unit: 'year', step: 1, format: '%Y' },
        { unit: 'month', step: 1, format: '%M' },
      ],
    };

    const columnWidths: Record<GanttZoomLevel, number> = {
      day: 60,
      week: 100,
      month: 120,
      quarter: 120,
      year: 80,
    };

    gantt.config.scales = scales[level];
    gantt.config.min_column_width = columnWidths[level];
  }

  private setZoomLevel(level: GanttZoomLevel): void {
    this.currentZoom = level;
    this.applyZoomScales(level);

    // Update button states
    if (this.toolbarEl) {
      this.toolbarEl.querySelectorAll('.planner-gantt-zoom-btn[data-zoom]').forEach((btn) => {
        btn.classList.toggle('active', btn.getAttribute('data-zoom') === level);
      });
    }

    if (this.isInitialized) {
      gantt.render();
    }
  }

  private addTodayMarker(): void {
    // Check if addMarker function exists (it's part of marker extension)
    if (typeof gantt.addMarker !== 'function') {
      console.log('Planner Gantt: addMarker not available, using alternative today indicator');
      // Use a template-based approach instead
      return;
    }

    try {
      const today = new Date();
      gantt.addMarker({
        start_date: today,
        css: 'planner-gantt-today-marker',
        text: 'Today',
      });
    } catch (e) {
      console.warn('Planner Gantt: Failed to add today marker:', e);
    }
  }

  private scrollToToday(): void {
    if (this.isInitialized) {
      gantt.showDate(new Date());
    }
  }

  private setupEventHandlers(): void {
    // Clear previous handlers
    this.eventIds.forEach(id => {
      try {
        gantt.detachEvent(id);
      } catch {
        // Ignore
      }
    });
    this.eventIds = [];

    // Task click - open ItemModal
    const clickId = gantt.attachEvent('onTaskClick', (id: string | number) => {
      this.handleTaskClick(String(id));
      return true;
    });
    this.eventIds.push(clickId);

    // Task double-click - open file
    const dblClickId = gantt.attachEvent('onTaskDblClick', (id: string | number) => {
      this.openFile(String(id));
      return true;
    });
    this.eventIds.push(dblClickId);

    // Task drag end - update dates
    const dragId = gantt.attachEvent('onAfterTaskDrag', (id: string | number, mode: string) => {
      this.handleTaskDragEnd(String(id), mode);
    });
    this.eventIds.push(dragId);

    // Link added
    if (this.getShowDependencies()) {
      const linkAddId = gantt.attachEvent('onAfterLinkAdd', (id: string | number, link: Link) => {
        this.handleLinkAdd(link);
      });
      this.eventIds.push(linkAddId);

      const linkDeleteId = gantt.attachEvent('onAfterLinkDelete', (id: string | number, link: Link) => {
        this.handleLinkDelete(link);
      });
      this.eventIds.push(linkDeleteId);
    }
  }

  private getTasksFromData(): { tasks: GanttTaskExtended[]; links: Link[] } {
    const tasks: GanttTaskExtended[] = [];
    const allEntries: BasesEntry[] = [];

    // Collect all entries
    for (const group of this.data.groupedData) {
      allEntries.push(...group.entries);
    }

    // Transform entries to tasks
    for (const entry of allEntries) {
      const task = this.entryToTask(entry);
      if (task) {
        tasks.push(task);
      }
    }

    // Extract dependency links
    const links = this.extractDependencyLinks(allEntries, tasks);

    return { tasks, links };
  }

  private entryToTask(entry: BasesEntry): GanttTaskExtended | null {
    const dateStartField = this.getDateStartField();
    const dateEndField = this.getDateEndField();
    const colorByField = this.getColorByField();

    console.log('Planner Gantt: Processing entry:', entry.file.path);
    console.log('Planner Gantt: Using dateStartField:', dateStartField, 'dateEndField:', dateEndField);

    // Get dates from entry
    const dateStart = entry.getValue(dateStartField as any);
    const dateEnd = entry.getValue(dateEndField as any);
    console.log('Planner Gantt: Raw dates - start:', dateStart, 'end:', dateEnd);

    // Must have at least a start date
    if (!dateStart) return null;

    // Get frontmatter for additional fields
    const fm = this.getFrontmatter(entry);

    // Parse dates
    const startDate = new Date(this.toISOString(dateStart));
    const endDate = dateEnd ? new Date(this.toISOString(dateEnd)) : null;

    // Validate start date
    if (isNaN(startDate.getTime())) return null;

    // Get all_day flag from frontmatter
    const isAllDay = fm?.all_day !== false; // Default to true if not specified

    // Calculate duration
    let duration = 1;
    let durationHours = 0;
    if (endDate && !isNaN(endDate.getTime())) {
      const diffMs = endDate.getTime() - startDate.getTime();
      durationHours = diffMs / (1000 * 60 * 60);
      // For Gantt, use day-based duration (minimum 1 day for display purposes)
      duration = Math.max(1, Math.ceil(diffMs / (1000 * 60 * 60 * 24)));
    }

    // Determine if milestone:
    // - No end date, OR
    // - Same day AND all_day is true AND has no meaningful time span
    // Timed items (all_day: false) with duration should NOT be milestones
    const isSameDay = endDate && startDate.toDateString() === endDate.toDateString();
    const hasTimeDuration = !isAllDay && durationHours > 0;
    const isMilestone = !endDate || (isSameDay && !hasTimeDuration);

    // Get progress (0-100 in Planner, 0-1 in DHTMLX)
    const progressValue = fm?.progress;
    const progress = typeof progressValue === 'number'
      ? Math.min(1, Math.max(0, progressValue / 100))
      : 0;

    // Get parent reference
    const parentLink = fm?.parent;
    const parentId = parentLink
      ? this.resolveWikilinkToId(parentLink)
      : 0;

    // Get color
    const color = this.getEntryColor(entry, colorByField);

    // Get title
    const title = fm?.title || entry.file.basename || 'Untitled';

    const task: GanttTaskExtended = {
      id: entry.file.path,
      text: title,
      start_date: startDate,
      end_date: endDate || undefined,
      duration: duration,
      progress: progress,
      parent: parentId,
      type: isMilestone ? 'milestone' : 'task',
      color: color,
      open: true,
      $entry: entry,
    };
    console.log('Planner Gantt: Created task:', task.text, 'color:', color, 'start:', startDate, 'duration:', duration);
    return task;
  }

  private extractDependencyLinks(entries: BasesEntry[], tasks: GanttTaskExtended[]): Link[] {
    const links: Link[] = [];
    const taskIdSet = new Set(tasks.map(t => String(t.id)));
    let linkId = 1;

    for (const entry of entries) {
      const fm = this.getFrontmatter(entry);
      const blockedBy = fm?.blocked_by;

      if (!Array.isArray(blockedBy) || blockedBy.length === 0) continue;

      const targetId = entry.file.path;

      // Skip if target task doesn't exist
      if (!taskIdSet.has(targetId)) continue;

      for (const blockerLink of blockedBy) {
        const sourceId = this.resolveWikilinkToPath(blockerLink);

        // Only create link if source task exists
        if (sourceId && taskIdSet.has(sourceId)) {
          links.push({
            id: linkId++,
            source: sourceId,
            target: targetId,
            type: '0', // finish-to-start (default)
          });
        }
      }
    }

    return links;
  }

  private resolveWikilinkToId(link: string): string | number {
    const path = this.resolveWikilinkToPath(link);
    return path || 0;
  }

  private resolveWikilinkToPath(link: string): string | null {
    // Extract path from wikilink: "[[path]]" -> "path"
    const match = link.match(/\[\[([^\]|]+)(?:\|[^\]]+)?\]\]/);
    if (!match) return null;

    const linkedPath = match[1];

    // Find the entry with this path/basename
    for (const group of this.data.groupedData) {
      for (const entry of group.entries) {
        if (entry.file.path === linkedPath ||
            entry.file.path === linkedPath + '.md' ||
            entry.file.basename === linkedPath) {
          return entry.file.path;
        }
      }
    }

    return null;
  }

  private getFrontmatter(entry: BasesEntry): Record<string, any> | null {
    try {
      const cache = this.app.metadataCache.getCache(entry.file.path);
      return cache?.frontmatter || null;
    } catch {
      return null;
    }
  }

  private getEntryColor(entry: BasesEntry, colorByProp: string): string {
    const value = entry.getValue(colorByProp as any);

    if (!value) return '#6b7280';

    const propName = colorByProp.split('.')[1];

    if (propName === 'calendar') {
      const calendarName = Array.isArray(value) ? value[0] : String(value);
      return this.plugin.settings.calendarColors[calendarName] ?? '#6b7280';
    }

    if (propName === 'priority') {
      const priority = this.plugin.settings.priorities.find(p => p.name === String(value));
      return priority?.color ?? '#6b7280';
    }

    if (propName === 'status') {
      const status = this.plugin.settings.statuses.find(s => s.name === String(value));
      return status?.color ?? '#6b7280';
    }

    return '#6b7280';
  }

  private toISOString(value: unknown): string {
    if (value instanceof Date) {
      return value.toISOString();
    }
    if (typeof value === 'string') {
      return value;
    }
    if (typeof value === 'number') {
      return new Date(value).toISOString();
    }
    return String(value);
  }

  private async handleTaskClick(id: string): Promise<void> {
    const task = gantt.getTask(id) as GanttTaskExtended;
    if (!task || !task.$entry) return;

    // Open ItemModal for editing
    const item = await this.plugin.itemService.getItem(task.$entry.file.path);
    if (item) {
      openItemModal(this.plugin, { mode: 'edit', item });
    }
  }

  private async openFile(id: string): Promise<void> {
    const task = gantt.getTask(id) as GanttTaskExtended;
    if (!task || !task.$entry) return;

    await this.app.workspace.openLinkText(task.$entry.file.path, '', 'tab');
  }

  private async handleTaskDragEnd(id: string, mode: string): Promise<void> {
    const task = gantt.getTask(id) as GanttTaskExtended;
    if (!task || !task.$entry) return;

    const entry = task.$entry;

    // Get the field names (strip 'note.' prefix)
    const startFieldName = this.getDateStartField().replace('note.', '');
    const endFieldName = this.getDateEndField().replace('note.', '');

    await this.app.fileManager.processFrontMatter(entry.file, (fm) => {
      if (mode === 'move' || mode === 'resize') {
        if (task.start_date) {
          fm[startFieldName] = task.start_date.toISOString();
        }
        if (task.end_date) {
          fm[endFieldName] = task.end_date.toISOString();
        }
      }

      if (mode === 'progress' && this.getShowProgress()) {
        // Convert 0-1 back to 0-100
        fm.progress = Math.round((task.progress || 0) * 100);
      }

      fm.date_modified = new Date().toISOString();
    });
  }

  private async handleLinkAdd(link: Link): Promise<void> {
    // Add to blocked_by of target task
    const targetTask = gantt.getTask(link.target) as GanttTaskExtended;
    const sourceTask = gantt.getTask(link.source) as GanttTaskExtended;

    if (!targetTask?.$entry || !sourceTask?.$entry) return;

    const sourceWikilink = `[[${sourceTask.$entry.file.basename}]]`;

    await this.app.fileManager.processFrontMatter(targetTask.$entry.file, (fm) => {
      if (!fm.blocked_by) {
        fm.blocked_by = [];
      }
      if (!fm.blocked_by.includes(sourceWikilink)) {
        fm.blocked_by.push(sourceWikilink);
      }
      fm.date_modified = new Date().toISOString();
    });
  }

  private async handleLinkDelete(link: Link): Promise<void> {
    // Remove from blocked_by of target task
    const targetTask = gantt.getTask(link.target) as GanttTaskExtended;
    const sourceTask = gantt.getTask(link.source) as GanttTaskExtended;

    if (!targetTask?.$entry || !sourceTask?.$entry) return;

    const sourceBasename = sourceTask.$entry.file.basename;

    await this.app.fileManager.processFrontMatter(targetTask.$entry.file, (fm) => {
      if (Array.isArray(fm.blocked_by)) {
        fm.blocked_by = fm.blocked_by.filter((blockerLink: string) =>
          !blockerLink.includes(sourceBasename)
        );
      }
      fm.date_modified = new Date().toISOString();
    });
  }

  private async createNewItem(): Promise<void> {
    openItemModal(this.plugin, {
      mode: 'create',
      prePopulate: {
        date_start_scheduled: new Date().toISOString(),
        tags: ['task'],
      },
    });
  }
}

/**
 * Create the Bases view registration for the Gantt chart
 */
export function createGanttViewRegistration(plugin: PlannerPlugin): BasesViewRegistration {
  return {
    name: 'Gantt',
    icon: 'gantt-chart',
    factory: (controller: QueryController, containerEl: HTMLElement) => {
      return new BasesGanttView(controller, containerEl, plugin);
    },
    options: () => [
      {
        type: 'dropdown',
        key: 'defaultZoom',
        displayName: 'Default zoom level',
        default: 'month',
        options: {
          'day': 'Day',
          'week': 'Week',
          'month': 'Month',
          'quarter': 'Quarter',
          'year': 'Year',
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
        displayName: 'Bar start date',
        default: 'note.date_start_scheduled',
        options: {
          'note.date_start_scheduled': 'Start Scheduled',
          'note.date_start_actual': 'Start Actual',
          'note.date_created': 'Date Created',
        },
      },
      {
        type: 'dropdown',
        key: 'dateEndField',
        displayName: 'Bar end date',
        default: 'note.date_end_scheduled',
        options: {
          'note.date_end_scheduled': 'End Scheduled',
          'note.date_end_actual': 'End Actual',
          'note.date_modified': 'Date Modified',
        },
      },
      {
        type: 'toggle',
        key: 'showProgress',
        displayName: 'Show progress bars',
        default: true,
      },
      {
        type: 'toggle',
        key: 'showDependencies',
        displayName: 'Show dependencies',
        default: true,
      },
      {
        type: 'toggle',
        key: 'autoScrollToday',
        displayName: 'Auto-scroll to today',
        default: true,
      },
    ],
  };
}
