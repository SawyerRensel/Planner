import { Modal, Notice, setIcon, setTooltip, MarkdownRenderer, Component } from 'obsidian';
import * as chrono from 'chrono-node';
import type PlannerPlugin from '../main';
import type { ItemFrontmatter, PlannerItem, RepeatFrequency, DayOfWeek } from '../types/item';
import {
  DateContextMenu,
  StatusContextMenu,
  PriorityContextMenu,
  CalendarContextMenu,
  RecurrenceContextMenu,
  type RecurrenceData,
} from './menus';
import { CustomRecurrenceModal } from './CustomRecurrenceModal';
import { FileLinkSuggest, TagSuggest, ContextSuggest, convertWikilinksToRelativePaths } from './suggests';

interface ItemModalOptions {
  mode: 'create' | 'edit';
  item?: PlannerItem;
  prePopulate?: Partial<ItemFrontmatter>;
}

interface ParsedNLP {
  title: string;
  date_start_scheduled?: string;
  date_end_scheduled?: string;
  all_day?: boolean;
  context?: string[];
  tags?: string[];
  priority?: string;
  status?: string;
  parent?: string;
  calendar?: string[];
}

export class ItemModal extends Modal {
  private plugin: PlannerPlugin;
  private options: ItemModalOptions;

  // Form state
  private title = '';
  private summary = '';
  private dateStart: string | null = null;
  private dateEnd: string | null = null;
  private allDay = true;
  private status: string | null = null;
  private priority: string | null = null;
  private recurrence: RecurrenceData | null = null;
  private calendars: string[] = [];
  private context: string[] = [];
  private people: string[] = [];
  private parent: string | null = null;
  private blockedBy: string[] = [];
  private details = '';
  private tags: string[] = [];

  // UI elements
  private titleInput: HTMLInputElement | null = null;
  private summaryTextarea: HTMLTextAreaElement | null = null;
  private nlpPreviewEl: HTMLElement | null = null;
  private nlpLegendEl: HTMLElement | null = null;
  private nlpLegendExpanded = false;
  private actionBar: HTMLElement | null = null;
  private detailsTextarea: HTMLTextAreaElement | null = null;
  private detailsSection: HTMLElement | null = null;
  private detailsExpanded = false;
  private detailedOptionsExpanded = false;
  private detailedOptionsContainer: HTMLElement | null = null;
  private markdownPreviewEl: HTMLElement | null = null;
  private markdownComponent: Component | null = null;
  private isEditingDetails = false;

  // Input references for updating
  private contextInput: HTMLInputElement | null = null;
  private peopleInput: HTMLInputElement | null = null;
  private parentInput: HTMLInputElement | null = null;
  private blockedByInput: HTMLInputElement | null = null;
  private tagsInput: HTMLInputElement | null = null;

  constructor(plugin: PlannerPlugin, options: ItemModalOptions) {
    super(plugin.app);
    this.plugin = plugin;
    this.options = options;
    this.detailsExpanded = plugin.settings.quickCaptureOpenAfterCreate || false;
    this.initializeFromOptions();
  }

  private initializeFromOptions(): void {
    const { mode, item, prePopulate } = this.options;

    if (mode === 'edit' && item) {
      // Load from existing item
      this.title = item.title || '';
      this.summary = item.summary || '';
      this.dateStart = item.date_start_scheduled || null;
      this.dateEnd = item.date_end_scheduled || null;
      this.allDay = item.all_day ?? true;
      this.status = item.status || null;
      this.priority = item.priority || null;
      this.calendars = item.calendar || [];
      this.context = item.context || [];
      this.people = item.people || [];
      this.parent = item.parent || null;
      this.blockedBy = item.blocked_by || [];
      this.tags = item.tags || [];

      // Load recurrence data
      if (item.repeat_frequency) {
        this.recurrence = {
          repeat_frequency: item.repeat_frequency,
          repeat_interval: item.repeat_interval,
          repeat_byday: item.repeat_byday,
          repeat_bymonthday: item.repeat_bymonthday,
          repeat_bysetpos: item.repeat_bysetpos,
          repeat_until: item.repeat_until,
          repeat_count: item.repeat_count,
        };
      }
    }

    // Apply pre-population (overrides loaded values)
    if (prePopulate) {
      if (prePopulate.title) this.title = prePopulate.title;
      if (prePopulate.summary) this.summary = prePopulate.summary;
      if (prePopulate.date_start_scheduled) this.dateStart = prePopulate.date_start_scheduled;
      if (prePopulate.date_end_scheduled) this.dateEnd = prePopulate.date_end_scheduled;
      if (prePopulate.all_day !== undefined) this.allDay = prePopulate.all_day;
      if (prePopulate.status) this.status = prePopulate.status;
      if (prePopulate.priority) this.priority = prePopulate.priority;
      if (prePopulate.calendar) this.calendars = prePopulate.calendar;
      if (prePopulate.context) this.context = prePopulate.context;
      if (prePopulate.tags) this.tags = prePopulate.tags;
    }

    // Apply defaults for create mode
    if (mode === 'create') {
      if (!this.status) {
        this.status = this.plugin.settings.quickCaptureDefaultStatus;
      }
      if (this.calendars.length === 0 && this.plugin.settings.defaultCalendar) {
        this.calendars = [this.plugin.settings.defaultCalendar];
      }
      // Prepopulate default tag for new items
      if (this.tags.length === 0) {
        if (this.plugin.settings.quickCaptureDefaultTags.length > 0) {
          this.tags = [...this.plugin.settings.quickCaptureDefaultTags];
        } else {
          this.tags = ['event'];
        }
      }
    }
  }

  async onOpen(): Promise<void> {
    const { contentEl } = this;
    contentEl.empty();
    contentEl.addClass('planner-item-modal');

    // Initialize markdown component for rendering
    this.markdownComponent = new Component();
    this.markdownComponent.load();

    // Modal header with title and Open Note button (edit mode only)
    const header = contentEl.createDiv({ cls: 'planner-modal-header' });
    const modalTitle = this.options.mode === 'edit' ? 'Edit Item' : 'New Item';
    header.createEl('h2', { text: modalTitle });

    // Open Note button in header (edit mode only)
    if (this.options.mode === 'edit' && this.options.item) {
      const openNoteBtn = header.createEl('button', {
        cls: 'planner-btn planner-open-note-btn',
      });
      setIcon(openNoteBtn, 'external-link');
      openNoteBtn.createSpan({ text: 'Open Note' });
      openNoteBtn.addEventListener('click', () => this.handleOpenNote());
    }

    // Title input
    this.createTitleInput(contentEl);

    // NLP preview and legend (only in create mode) - now below title
    if (this.options.mode === 'create') {
      // NLP preview - hidden until tokens are detected
      this.nlpPreviewEl = contentEl.createDiv({ cls: 'planner-nlp-preview hidden' });
      this.createNLPLegend(contentEl);
    }

    // Icon action bar
    this.createActionBar(contentEl);

    // Show Detailed Options toggle (below icon row)
    this.createDetailedOptionsToggle(contentEl);

    // Detailed options container (hidden by default) - now BELOW the icon row
    this.detailedOptionsContainer = contentEl.createDiv({
      cls: `planner-detailed-options ${this.detailedOptionsExpanded ? '' : 'collapsed'}`
    });

    // Summary field (resizable) - inside detailed options
    this.createSummaryInput(this.detailedOptionsContainer);

    // Note Content section - inside detailed options
    await this.createDetailsSection(this.detailedOptionsContainer);

    // Additional fields - inside detailed options
    this.createFieldInputs(this.detailedOptionsContainer);

    // Action buttons
    this.createButtons(contentEl);

    // Focus title input
    setTimeout(() => this.titleInput?.focus(), 50);
  }

  private createTitleInput(container: HTMLElement): void {
    const inputContainer = container.createDiv({ cls: 'planner-title-container' });
    inputContainer.createEl('label', { text: 'Title', cls: 'planner-label' });

    this.titleInput = inputContainer.createEl('input', {
      type: 'text',
      placeholder: 'Enter title or use NLP: "Meeting tomorrow at 2pm @work #task"',
      cls: 'planner-title-input',
      value: this.title,
    });

    this.titleInput.addEventListener('input', () => {
      const value = this.titleInput?.value || '';
      if (this.options.mode === 'create') {
        this.parseNLPInput(value);
        this.updateNLPPreview();
      } else {
        this.title = value;
      }
      this.updateIconStates();
    });

    this.titleInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        this.handleSave();
      }
    });
  }

  private createSummaryInput(container: HTMLElement): void {
    const summaryContainer = container.createDiv({ cls: 'planner-summary-container' });
    summaryContainer.createEl('label', { text: 'Summary', cls: 'planner-label' });

    this.summaryTextarea = summaryContainer.createEl('textarea', {
      cls: 'planner-summary-textarea',
      placeholder: 'Brief summary of the item...',
    });
    this.summaryTextarea.value = this.summary;
    this.summaryTextarea.addEventListener('input', () => {
      this.summary = this.summaryTextarea?.value || '';
    });
  }

  private createNLPLegend(container: HTMLElement): void {
    this.nlpLegendEl = container.createDiv({ cls: 'planner-nlp-legend' });

    const toggle = this.nlpLegendEl.createDiv({ cls: 'planner-nlp-legend-toggle' });
    const toggleIcon = toggle.createSpan({ cls: 'planner-toggle-icon' });
    setIcon(toggleIcon, 'help-circle');
    toggle.createSpan({ text: 'NLP Syntax Help' });

    const content = this.nlpLegendEl.createDiv({
      cls: `planner-nlp-legend-content ${this.nlpLegendExpanded ? '' : 'collapsed'}`,
    });

    const examples = [
      { syntax: 'tomorrow at 2pm', desc: 'Natural language dates' },
      { syntax: 'next Friday', desc: 'Relative dates' },
      { syntax: '@work', desc: 'Context (e.g., @home, @errands)' },
      { syntax: '#task', desc: 'Tags (e.g., #event, #project)' },
      { syntax: '!high', desc: 'Priority (e.g., !urgent, !low)' },
      { syntax: '>In-Progress', desc: 'Status (use hyphens for spaces)' },
      { syntax: '+[[Parent Note]]', desc: 'Parent item link' },
      { syntax: '~Work', desc: 'Calendar assignment' },
    ];

    const table = content.createEl('table', { cls: 'planner-nlp-legend-table' });
    for (const { syntax, desc } of examples) {
      const row = table.createEl('tr');
      row.createEl('td', { text: syntax, cls: 'planner-nlp-syntax' });
      row.createEl('td', { text: desc, cls: 'planner-nlp-desc' });
    }

    const exampleText = content.createEl('p', { cls: 'planner-nlp-example' });
    exampleText.createEl('strong', { text: 'Example: ' });
    exampleText.createSpan({ text: '"Team meeting tomorrow at 2pm @work #event !high ~Work"' });

    toggle.addEventListener('click', () => {
      this.nlpLegendExpanded = !this.nlpLegendExpanded;
      content.classList.toggle('collapsed', !this.nlpLegendExpanded);
    });
  }

  private createActionBar(container: HTMLElement): void {
    this.actionBar = container.createDiv({ cls: 'planner-action-bar' });

    // Date Start icon
    this.createActionIcon(
      this.actionBar,
      'calendar',
      'Start date',
      (el, event) => this.showDateContextMenu(event, 'start'),
      'date-start'
    );

    // Date End icon
    this.createActionIcon(
      this.actionBar,
      'calendar-check',
      'End date',
      (el, event) => this.showDateContextMenu(event, 'end'),
      'date-end'
    );

    // Priority icon
    this.createActionIcon(
      this.actionBar,
      'star',
      'Priority',
      (el, event) => this.showPriorityContextMenu(event),
      'priority'
    );

    // Status icon
    this.createActionIcon(
      this.actionBar,
      'circle',
      'Status',
      (el, event) => this.showStatusContextMenu(event),
      'status'
    );

    // Recurrence icon
    this.createActionIcon(
      this.actionBar,
      'repeat',
      'Recurrence',
      (el, event) => this.showRecurrenceContextMenu(event),
      'recurrence'
    );

    // Calendar dropdown
    this.createCalendarDropdown(this.actionBar);

    // Update initial states
    this.updateIconStates();
  }

  private createDetailedOptionsToggle(container: HTMLElement): void {
    const toggleContainer = container.createDiv({ cls: 'planner-detailed-toggle' });
    toggleContainer.setAttribute('tabindex', '0');
    toggleContainer.setAttribute('role', 'button');

    const icon = toggleContainer.createSpan({ cls: 'planner-icon' });
    setIcon(icon, this.detailedOptionsExpanded ? 'chevron-up' : 'chevron-down');

    const label = toggleContainer.createSpan({ cls: 'planner-toggle-label' });
    label.textContent = this.detailedOptionsExpanded ? 'Hide detailed options' : 'Show detailed options';

    const updateToggle = () => {
      this.detailedOptionsExpanded = !this.detailedOptionsExpanded;
      setIcon(icon, this.detailedOptionsExpanded ? 'chevron-up' : 'chevron-down');
      label.textContent = this.detailedOptionsExpanded ? 'Hide detailed options' : 'Show detailed options';
      this.detailedOptionsContainer?.classList.toggle('collapsed', !this.detailedOptionsExpanded);
    };

    toggleContainer.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      updateToggle();
    });

    toggleContainer.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        updateToggle();
      }
    });
  }

  private createActionIcon(
    container: HTMLElement,
    iconName: string,
    tooltip: string,
    onClick: (el: HTMLElement, event: MouseEvent | KeyboardEvent) => void,
    dataType: string
  ): HTMLElement {
    const iconContainer = container.createDiv({ cls: 'planner-action-icon' });
    iconContainer.setAttribute('data-type', dataType);
    iconContainer.setAttribute('tabindex', '0');
    iconContainer.setAttribute('role', 'button');

    const icon = iconContainer.createSpan({ cls: 'planner-icon' });
    setIcon(icon, iconName);
    setTooltip(iconContainer, tooltip, { placement: 'top' });

    iconContainer.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick(iconContainer, e);
    });

    iconContainer.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        e.stopPropagation();
        onClick(iconContainer, e);
      }
    });

    return iconContainer;
  }

  private createCalendarDropdown(container: HTMLElement): void {
    const wrapper = container.createDiv({ cls: 'planner-calendar-dropdown' });

    const btn = wrapper.createEl('button', {
      cls: 'planner-calendar-btn',
      text: this.calendars[0] || this.plugin.settings.defaultCalendar || 'Calendar',
    });

    const icon = btn.createSpan({ cls: 'planner-dropdown-icon' });
    setIcon(icon, 'chevron-down');

    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const menu = new CalendarContextMenu({
        currentValue: this.calendars,
        onSelect: (value) => {
          this.calendars = value;
          btn.textContent = value[0] || 'Calendar';
          btn.appendChild(icon);
          this.updateIconStates();
          this.updateNLPPreview();
        },
        plugin: this.plugin,
      });
      menu.showAtElement(btn);
    });
  }

  private updateIconStates(): void {
    if (!this.actionBar) return;

    // Date start
    const dateStartIcon = this.actionBar.querySelector('[data-type="date-start"]');
    if (dateStartIcon) {
      this.updateIconState(dateStartIcon as HTMLElement, !!this.dateStart, this.formatDateForTooltip(this.dateStart));
    }

    // Date end
    const dateEndIcon = this.actionBar.querySelector('[data-type="date-end"]');
    if (dateEndIcon) {
      this.updateIconState(dateEndIcon as HTMLElement, !!this.dateEnd, this.formatDateForTooltip(this.dateEnd));
    }

    // Priority
    const priorityIcon = this.actionBar.querySelector('[data-type="priority"]');
    if (priorityIcon) {
      this.updateIconState(priorityIcon as HTMLElement, !!this.priority, this.priority || 'Priority');
      const iconEl = priorityIcon.querySelector('.planner-icon') as HTMLElement;
      // Apply priority icon and color
      if (this.priority) {
        const config = this.plugin.settings.priorities.find(p => p.name === this.priority);
        if (config) {
          // Update icon to match priority's custom icon
          const priorityIconName = config.icon || 'star';
          setIcon(iconEl, priorityIconName);
          iconEl?.style.setProperty('color', config.color);
        }
      } else {
        // Reset to default icon and color
        setIcon(iconEl, 'star');
        iconEl?.style.removeProperty('color');
      }
    }

    // Status
    const statusIcon = this.actionBar.querySelector('[data-type="status"]');
    if (statusIcon) {
      this.updateIconState(statusIcon as HTMLElement, !!this.status, this.status || 'Status');
      const iconEl = statusIcon.querySelector('.planner-icon') as HTMLElement;
      // Apply status icon and color
      if (this.status) {
        const config = this.plugin.settings.statuses.find(s => s.name === this.status);
        if (config) {
          // Update icon to match status's custom icon
          const statusIconName = config.icon || (config.isCompleted ? 'check-circle' : 'circle');
          setIcon(iconEl, statusIconName);
          iconEl?.style.setProperty('color', config.color);
        }
      } else {
        // Reset to default icon and color
        setIcon(iconEl, 'circle');
        iconEl?.style.removeProperty('color');
      }
    }

    // Recurrence
    const recurrenceIcon = this.actionBar.querySelector('[data-type="recurrence"]');
    if (recurrenceIcon) {
      const hasRecurrence = !!this.recurrence?.repeat_frequency;
      this.updateIconState(recurrenceIcon as HTMLElement, hasRecurrence, hasRecurrence ? 'Recurring' : 'Recurrence');
    }
  }

  private updateIconState(el: HTMLElement, hasValue: boolean, tooltip: string): void {
    if (hasValue) {
      el.classList.add('has-value');
    } else {
      el.classList.remove('has-value');
    }
    setTooltip(el, tooltip, { placement: 'top' });
  }

  private formatDateForTooltip(dateStr: string | null): string {
    if (!dateStr) return 'Not set';
    const date = new Date(dateStr);
    return date.toLocaleString();
  }

  private showDateContextMenu(event: MouseEvent | KeyboardEvent, type: 'start' | 'end'): void {
    const currentValue = type === 'start' ? this.dateStart : this.dateEnd;
    const menu = new DateContextMenu({
      currentValue,
      onSelect: (value) => {
        if (type === 'start') {
          this.dateStart = value;
          if (value) this.allDay = !value.includes('T') || value.endsWith('T00:00:00');
        } else {
          this.dateEnd = value;
        }
        this.updateIconStates();
        this.updateNLPPreview();
      },
      plugin: this.plugin,
      title: type === 'start' ? 'Start Date' : 'End Date',
    });
    menu.show(event);
  }

  private showStatusContextMenu(event: MouseEvent | KeyboardEvent): void {
    const menu = new StatusContextMenu({
      currentValue: this.status,
      onSelect: (value) => {
        this.status = value;
        this.updateIconStates();
        this.updateNLPPreview();
      },
      plugin: this.plugin,
    });
    menu.show(event);
  }

  private showPriorityContextMenu(event: MouseEvent | KeyboardEvent): void {
    const menu = new PriorityContextMenu({
      currentValue: this.priority,
      onSelect: (value) => {
        this.priority = value;
        this.updateIconStates();
        this.updateNLPPreview();
      },
      plugin: this.plugin,
    });
    menu.show(event);
  }

  private showRecurrenceContextMenu(event: MouseEvent | KeyboardEvent): void {
    // Parse date without timezone conversion to avoid off-by-one errors
    let referenceDate = new Date();
    if (this.dateStart) {
      const dateStr = this.dateStart.split('T')[0];
      const [year, month, day] = dateStr.split('-').map(Number);
      referenceDate = new Date(year, month - 1, day);
    }
    const menu = new RecurrenceContextMenu({
      currentValue: this.recurrence,
      onSelect: (value) => {
        this.recurrence = value;
        this.updateIconStates();
        this.updateNLPPreview();
      },
      onCustom: () => {
        const modal = new CustomRecurrenceModal(this.plugin, this.recurrence, (result) => {
          this.recurrence = result;
          this.updateIconStates();
          this.updateNLPPreview();
        });
        modal.open();
      },
      plugin: this.plugin,
      referenceDate,
    });
    menu.show(event);
  }

  private async createDetailsSection(container: HTMLElement): Promise<void> {
    this.detailsSection = container.createDiv({ cls: 'planner-details-section' });

    // Label (no longer collapsible)
    this.detailsSection.createEl('label', { text: 'Note Content', cls: 'planner-label' });

    const content = this.detailsSection.createDiv({ cls: 'planner-details-content' });

    // Create markdown preview container
    this.markdownPreviewEl = content.createDiv({
      cls: 'planner-details-markdown-preview',
    });

    // Create textarea for editing (hidden by default)
    this.detailsTextarea = content.createEl('textarea', {
      cls: 'planner-details-textarea hidden',
      placeholder: 'Add description or notes... (Markdown supported)',
    });

    // Load existing content from item body in edit mode
    if (this.options.mode === 'edit' && this.options.item) {
      const body = await this.plugin.itemService.getItemBody(this.options.item.path);
      this.details = body;
      this.detailsTextarea.value = body;
    } else {
      this.detailsTextarea.value = this.details;
    }

    // Render initial markdown preview
    await this.renderDetailsMarkdown();

    // Handle textarea input
    this.detailsTextarea.addEventListener('input', () => {
      this.details = this.detailsTextarea?.value || '';
    });

    // Click on preview to edit
    this.markdownPreviewEl.addEventListener('click', (e) => {
      // Don't switch to edit mode if clicking on a link
      if ((e.target as HTMLElement).closest('a')) {
        return;
      }
      this.switchToEditMode();
    });

    // Blur textarea to show preview
    this.detailsTextarea.addEventListener('blur', async () => {
      await this.switchToPreviewMode();
    });

    // Handle Escape key to exit edit mode
    this.detailsTextarea.addEventListener('keydown', async (e) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        await this.switchToPreviewMode();
      }
    });
  }

  private async renderDetailsMarkdown(): Promise<void> {
    if (!this.markdownPreviewEl || !this.markdownComponent) return;

    this.markdownPreviewEl.empty();

    if (!this.details || this.details.trim() === '') {
      // Show placeholder when empty
      this.markdownPreviewEl.createSpan({
        text: 'Click to add notes... (Markdown supported)',
        cls: 'planner-details-placeholder',
      });
      return;
    }

    // Render markdown content
    await MarkdownRenderer.render(
      this.app,
      this.details,
      this.markdownPreviewEl,
      this.options.item?.path || '',
      this.markdownComponent
    );
  }

  private switchToEditMode(): void {
    if (this.isEditingDetails) return;
    this.isEditingDetails = true;

    this.markdownPreviewEl?.classList.add('hidden');
    this.detailsTextarea?.classList.remove('hidden');
    this.detailsTextarea?.focus();

    // Place cursor at end
    if (this.detailsTextarea) {
      const len = this.detailsTextarea.value.length;
      this.detailsTextarea.setSelectionRange(len, len);
    }
  }

  private async switchToPreviewMode(): Promise<void> {
    if (!this.isEditingDetails) return;
    this.isEditingDetails = false;

    this.detailsTextarea?.classList.add('hidden');
    this.markdownPreviewEl?.classList.remove('hidden');

    // Re-render markdown
    await this.renderDetailsMarkdown();
  }

  private createFieldInputs(container: HTMLElement): void {
    const fieldsContainer = container.createDiv({ cls: 'planner-fields' });

    // Context (with autocomplete)
    this.contextInput = this.createTextListInputWithSuggest(
      fieldsContainer,
      'Context',
      this.context,
      (value) => { this.context = value; },
      'work, home, errands',
      'context'
    );

    // People (with file link suggest)
    this.peopleInput = this.createTextListInputWithSuggest(
      fieldsContainer,
      'People',
      this.people,
      (value) => { this.people = value; },
      '[[Person 1]], [[Person 2]]',
      'file'
    );

    // Parent (with file link suggest)
    this.parentInput = this.createTextInputWithSuggest(
      fieldsContainer,
      'Parent',
      this.parent || '',
      (value) => { this.parent = value || null; },
      '[[Parent Item]]',
      'file'
    );

    // Blocked by (with file link suggest)
    this.blockedByInput = this.createTextListInputWithSuggest(
      fieldsContainer,
      'Blocked by',
      this.blockedBy,
      (value) => { this.blockedBy = value; },
      '[[Task 1]], [[Task 2]]',
      'file'
    );

    // Tags (with tag suggest)
    this.tagsInput = this.createTextListInputWithSuggest(
      fieldsContainer,
      'Tags',
      this.tags,
      (value) => { this.tags = value; },
      'task, event, project',
      'tag'
    );
  }

  private createTextInputWithSuggest(
    container: HTMLElement,
    label: string,
    value: string,
    onChange: (value: string) => void,
    placeholder: string,
    suggestType: 'file' | 'tag' | 'context'
  ): HTMLInputElement {
    const field = container.createDiv({ cls: 'planner-field' });
    field.createEl('label', { text: label, cls: 'planner-label' });
    const input = field.createEl('input', {
      type: 'text',
      value,
      placeholder,
      cls: 'planner-field-input',
    });
    input.addEventListener('input', () => onChange(input.value));

    // Attach suggest
    if (suggestType === 'file') {
      new FileLinkSuggest(this.app, input);
    } else if (suggestType === 'tag') {
      new TagSuggest(this.app, input);
    } else if (suggestType === 'context') {
      new ContextSuggest(this.app, input);
    }

    return input;
  }

  private createTextListInputWithSuggest(
    container: HTMLElement,
    label: string,
    values: string[],
    onChange: (value: string[]) => void,
    placeholder: string,
    suggestType: 'file' | 'tag' | 'context'
  ): HTMLInputElement {
    const field = container.createDiv({ cls: 'planner-field' });
    field.createEl('label', { text: label, cls: 'planner-label' });
    const input = field.createEl('input', {
      type: 'text',
      value: values.join(', '),
      placeholder,
      cls: 'planner-field-input',
    });
    input.addEventListener('input', () => {
      const newValues = input.value
        .split(',')
        .map(s => s.trim())
        .filter(s => s.length > 0);
      onChange(newValues);
    });

    // Attach suggest
    if (suggestType === 'file') {
      new FileLinkSuggest(this.app, input);
    } else if (suggestType === 'tag') {
      new TagSuggest(this.app, input);
    } else if (suggestType === 'context') {
      new ContextSuggest(this.app, input);
    }

    return input;
  }

  private createButtons(container: HTMLElement): void {
    const buttonContainer = container.createDiv({ cls: 'planner-modal-buttons' });

    // Delete button (edit mode only) - left side
    if (this.options.mode === 'edit' && this.options.item) {
      const deleteBtn = buttonContainer.createEl('button', {
        text: 'Delete',
        cls: 'planner-btn planner-btn-danger',
      });
      deleteBtn.addEventListener('click', () => this.handleDelete());
    }

    // Spacer
    buttonContainer.createDiv({ cls: 'planner-btn-spacer' });

    // Cancel button
    const cancelBtn = buttonContainer.createEl('button', {
      text: 'Cancel',
      cls: 'planner-btn',
    });
    cancelBtn.addEventListener('click', () => this.close());

    // Save button
    const saveBtn = buttonContainer.createEl('button', {
      text: 'Save',
      cls: 'planner-btn planner-btn-primary',
    });
    saveBtn.addEventListener('click', () => this.handleSave());
  }

  // NLP Parsing (reused from QuickCapture)
  private parseNLPInput(input: string): void {
    let remaining = input.trim();
    const parsed: ParsedNLP = { title: '' };

    // Extract @context
    const contextMatches = remaining.match(/@(\w+)/g);
    if (contextMatches) {
      parsed.context = contextMatches.map(m => m.slice(1));
      remaining = remaining.replace(/@(\w+)/g, '').trim();
    }

    // Extract #tags
    const tagMatches = remaining.match(/#(\w+)/g);
    if (tagMatches) {
      parsed.tags = tagMatches.map(m => m.slice(1));
      remaining = remaining.replace(/#(\w+)/g, '').trim();
    }

    // Extract !priority
    const priorityMatch = remaining.match(/!(\w+)/);
    if (priorityMatch) {
      const priorityName = priorityMatch[1];
      const matchedPriority = this.plugin.settings.priorities.find(
        p => p.name.toLowerCase() === priorityName.toLowerCase()
      );
      if (matchedPriority) {
        parsed.priority = matchedPriority.name;
      }
      remaining = remaining.replace(/!(\w+)/, '').trim();
    }

    // Extract >status
    const statusMatch = remaining.match(/>(\S+)/);
    if (statusMatch) {
      const statusName = statusMatch[1].replace(/-/g, ' ');
      const matchedStatus = this.plugin.settings.statuses.find(
        s => s.name.toLowerCase() === statusName.toLowerCase()
      );
      if (matchedStatus) {
        parsed.status = matchedStatus.name;
      }
      remaining = remaining.replace(/>(\S+)/, '').trim();
    }

    // Extract +[[Parent]]
    const parentMatch = remaining.match(/\+\[\[([^\]]+)\]\]/);
    if (parentMatch) {
      parsed.parent = `[[${parentMatch[1]}]]`;
      remaining = remaining.replace(/\+\[\[([^\]]+)\]\]/, '').trim();
    }

    // Extract ~calendar
    const calendarMatch = remaining.match(/~(\w+)/);
    if (calendarMatch) {
      parsed.calendar = [calendarMatch[1]];
      remaining = remaining.replace(/~(\w+)/, '').trim();
    }

    // Parse dates with chrono
    const chronoResult = chrono.parse(remaining, new Date(), { forwardDate: true });
    if (chronoResult.length > 0) {
      const dateResult = chronoResult[0];
      const startDate = dateResult.start.date();
      parsed.date_start_scheduled = startDate.toISOString();
      parsed.all_day = !dateResult.start.isCertain('hour');

      if (dateResult.end) {
        parsed.date_end_scheduled = dateResult.end.date().toISOString();
      }

      remaining = remaining.replace(dateResult.text, '').trim();
    }

    // Clean up and set title
    parsed.title = remaining.replace(/\s+/g, ' ').trim();

    // Apply parsed values to form state
    this.title = parsed.title;
    if (parsed.date_start_scheduled) this.dateStart = parsed.date_start_scheduled;
    if (parsed.date_end_scheduled) this.dateEnd = parsed.date_end_scheduled;
    if (parsed.all_day !== undefined) this.allDay = parsed.all_day;
    if (parsed.context) this.context = parsed.context;
    if (parsed.tags) this.tags = parsed.tags;
    if (parsed.priority) this.priority = parsed.priority;
    if (parsed.status) this.status = parsed.status;
    if (parsed.parent) this.parent = parsed.parent;
    if (parsed.calendar) this.calendars = parsed.calendar;

    // Update field inputs to reflect parsed values
    if (this.contextInput && parsed.context) {
      this.contextInput.value = parsed.context.join(', ');
    }
    if (this.tagsInput && parsed.tags) {
      this.tagsInput.value = parsed.tags.join(', ');
    }
    if (this.parentInput && parsed.parent) {
      this.parentInput.value = parsed.parent;
    }
  }

  private updateNLPPreview(): void {
    if (!this.nlpPreviewEl) return;
    this.nlpPreviewEl.empty();

    // Show preview if we have any data to display
    const hasData = this.dateStart || this.dateEnd || this.context.length > 0 ||
      this.tags.length > 0 || this.priority || this.status ||
      this.calendars.length > 0 || this.recurrence?.repeat_frequency;

    // Toggle visibility based on whether there's data
    if (!hasData) {
      this.nlpPreviewEl.classList.add('hidden');
      return;
    }

    this.nlpPreviewEl.classList.remove('hidden');
    const preview = this.nlpPreviewEl.createDiv({ cls: 'planner-nlp-preview-content' });

    // Date Start
    if (this.dateStart) {
      const date = new Date(this.dateStart);
      const dateStr = this.allDay ? date.toLocaleDateString() : date.toLocaleString();
      this.addPreviewBadge(preview, `📅 ${dateStr}`, 'date');
    }

    // Date End
    if (this.dateEnd) {
      const date = new Date(this.dateEnd);
      const dateStr = this.allDay ? date.toLocaleDateString() : date.toLocaleString();
      this.addPreviewBadge(preview, `🏁 ${dateStr}`, 'date');
    }

    // Context
    this.context.forEach(ctx => {
      this.addPreviewBadge(preview, `@${ctx}`, 'context');
    });

    // Tags
    this.tags.forEach(tag => {
      this.addPreviewBadge(preview, `#${tag}`, 'tag');
    });

    // Priority
    if (this.priority) {
      const config = this.plugin.settings.priorities.find(p => p.name === this.priority);
      this.addPreviewBadge(preview, `!${this.priority}`, 'priority', config?.color);
    }

    // Status
    if (this.status) {
      const config = this.plugin.settings.statuses.find(s => s.name === this.status);
      this.addPreviewBadge(preview, this.status, 'status', config?.color);
    }

    // Calendar
    if (this.calendars.length > 0) {
      const color = this.plugin.settings.calendarColors[this.calendars[0]];
      this.addPreviewBadge(preview, `~${this.calendars[0]}`, 'calendar', color);
    }

    // Recurrence
    if (this.recurrence?.repeat_frequency) {
      this.addPreviewBadge(preview, `🔄 ${this.recurrence.repeat_frequency}`, 'recurrence');
    }
  }

  private addPreviewBadge(container: HTMLElement, text: string, type: string, color?: string): void {
    const badge = container.createSpan({
      text,
      cls: `planner-preview-badge planner-preview-${type}`,
    });
    if (color) {
      badge.style.backgroundColor = color;
      badge.style.color = this.getContrastColor(color);
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

  // Action handlers
  private async handleSave(): Promise<void> {
    const title = this.title.trim() || this.titleInput?.value.trim() || '';

    if (!title) {
      new Notice('Please enter a title');
      return;
    }

    // Convert wikilinks to relative path wikilinks if user has disabled wikilinks in Obsidian settings
    const itemsFolder = this.plugin.settings.itemsFolder;
    const convertedPeople = convertWikilinksToRelativePaths(this.app, this.people, itemsFolder) as string[];
    const convertedParent = convertWikilinksToRelativePaths(this.app, this.parent, itemsFolder) as string | null;
    const convertedBlockedBy = convertWikilinksToRelativePaths(this.app, this.blockedBy, itemsFolder) as string[];

    const frontmatter: Partial<ItemFrontmatter> = {
      title,
      summary: this.summary || undefined,
      tags: this.tags.length > 0 ? this.tags : ['event'],
      status: this.status || this.plugin.settings.quickCaptureDefaultStatus,
      calendar: this.calendars.length > 0 ? this.calendars : undefined,
    };

    if (this.dateStart) frontmatter.date_start_scheduled = this.dateStart;
    if (this.dateEnd) frontmatter.date_end_scheduled = this.dateEnd;
    frontmatter.all_day = this.allDay;
    if (this.priority) frontmatter.priority = this.priority;
    if (this.context.length > 0) frontmatter.context = this.context;
    if (convertedPeople && convertedPeople.length > 0) frontmatter.people = convertedPeople;
    if (convertedParent) frontmatter.parent = convertedParent;
    if (convertedBlockedBy && convertedBlockedBy.length > 0) frontmatter.blocked_by = convertedBlockedBy;

    // Recurrence fields
    if (this.recurrence?.repeat_frequency) {
      frontmatter.repeat_frequency = this.recurrence.repeat_frequency;
      if (this.recurrence.repeat_interval) frontmatter.repeat_interval = this.recurrence.repeat_interval;
      if (this.recurrence.repeat_byday) frontmatter.repeat_byday = this.recurrence.repeat_byday;
      if (this.recurrence.repeat_bymonthday) frontmatter.repeat_bymonthday = this.recurrence.repeat_bymonthday;
      if (this.recurrence.repeat_bysetpos) frontmatter.repeat_bysetpos = this.recurrence.repeat_bysetpos;
      if (this.recurrence.repeat_until) frontmatter.repeat_until = this.recurrence.repeat_until;
      if (this.recurrence.repeat_count) frontmatter.repeat_count = this.recurrence.repeat_count;
    }

    try {
      if (this.options.mode === 'edit' && this.options.item) {
        // Update existing item
        await this.plugin.itemService.updateItem(this.options.item.path, frontmatter);
        // Also update the body if changed
        if (this.details !== '') {
          await this.plugin.itemService.updateItemBody(this.options.item.path, this.details);
        }
        new Notice(`Updated: ${title}`);
      } else {
        // Create new item
        const item = await this.plugin.itemService.createItem(title, frontmatter, this.details);
        new Notice(`Created: ${title}`);

        if (this.plugin.settings.quickCaptureOpenAfterCreate && item) {
          await this.app.workspace.openLinkText(item.path, '', false);
        }
      }

      this.close();
    } catch (error) {
      console.error('Failed to save item:', error);
      new Notice('Failed to save item');
    }
  }

  private async handleDelete(): Promise<void> {
    if (!this.options.item) return;

    // Show confirmation dialog
    const confirmed = await this.showConfirmDialog(
      'Delete Item',
      `Are you sure you want to delete "${this.options.item.title}"? This action cannot be undone.`
    );

    if (confirmed) {
      try {
        await this.plugin.itemService.deleteItem(this.options.item.path);
        new Notice(`Deleted: ${this.options.item.title}`);
        this.close();
      } catch (error) {
        console.error('Failed to delete item:', error);
        new Notice('Failed to delete item');
      }
    }
  }

  private async handleOpenNote(): Promise<void> {
    if (!this.options.item) return;

    this.close();

    const openBehavior = this.plugin.settings.openBehavior;
    const leaf = (() => {
      switch (openBehavior) {
        case 'same-tab':
          return this.app.workspace.getLeaf(false);
        case 'new-tab':
          return this.app.workspace.getLeaf('tab');
        case 'split-right':
          return this.app.workspace.getLeaf('split', 'vertical');
        case 'split-down':
          return this.app.workspace.getLeaf('split', 'horizontal');
        default:
          return this.app.workspace.getLeaf('tab');
      }
    })();

    await leaf.openFile(
      this.app.vault.getAbstractFileByPath(this.options.item.path) as any
    );
  }

  private showConfirmDialog(title: string, message: string): Promise<boolean> {
    return new Promise((resolve) => {
      const modal = document.createElement('div');
      modal.className = 'planner-confirm-overlay';
      modal.innerHTML = `
        <div class="planner-confirm-dialog">
          <h3>${title}</h3>
          <p>${message}</p>
          <div class="planner-confirm-buttons">
            <button class="planner-btn" data-action="cancel">Cancel</button>
            <button class="planner-btn planner-btn-danger" data-action="confirm">Delete</button>
          </div>
        </div>
      `;

      modal.querySelector('[data-action="cancel"]')?.addEventListener('click', () => {
        modal.remove();
        resolve(false);
      });

      modal.querySelector('[data-action="confirm"]')?.addEventListener('click', () => {
        modal.remove();
        resolve(true);
      });

      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          modal.remove();
          resolve(false);
        }
      });

      document.body.appendChild(modal);
    });
  }

  onClose(): void {
    // Unload the markdown component
    if (this.markdownComponent) {
      this.markdownComponent.unload();
      this.markdownComponent = null;
    }

    const { contentEl } = this;
    contentEl.empty();
  }
}

// Helper function to open the modal from other parts of the plugin
export function openItemModal(
  plugin: PlannerPlugin,
  options: Omit<ItemModalOptions, 'mode'> & { mode?: 'create' | 'edit' }
): void {
  const mode = options.item ? 'edit' : (options.mode || 'create');
  const modal = new ItemModal(plugin, { ...options, mode });
  modal.open();
}
