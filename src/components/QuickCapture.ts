import { Modal, Notice } from 'obsidian';
import * as chrono from 'chrono-node';
import type PlannerPlugin from '../main';
import { ItemFrontmatter } from '../types/item';

interface ParsedInput {
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

/**
 * Quick Capture modal for rapid item creation with NLP parsing
 *
 * Syntax:
 *   Title text tomorrow at 2pm @context +[[Parent]] #tag !priority >status
 *
 * Examples:
 *   Team meeting tomorrow at 2pm @work #event
 *   Buy groceries Saturday !high #task
 *   Call mom next week @home +[[Family Tasks]]
 */
export class QuickCaptureModal extends Modal {
  plugin: PlannerPlugin;
  private inputEl: HTMLInputElement;
  private previewEl: HTMLElement;
  private parsedInput: ParsedInput = { title: '' };

  constructor(plugin: PlannerPlugin) {
    super(plugin.app);
    this.plugin = plugin;
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.addClass('planner-quick-capture');

    // Title
    contentEl.createEl('h3', { text: 'Quick capture' });

    // Input field
    const inputContainer = contentEl.createDiv({ cls: 'planner-quick-capture-input' });
    this.inputEl = inputContainer.createEl('input', {
      type: 'text',
      placeholder: 'Team meeting tomorrow at 2pm @work #event !high',
      cls: 'planner-quick-capture-field',
    });

    this.inputEl.addEventListener('input', () => {
      this.parseInput(this.inputEl.value);
      this.updatePreview();
    });

    this.inputEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        void this.createItem();
      } else if (e.key === 'Escape') {
        this.close();
      }
    });

    // Preview section
    this.previewEl = contentEl.createDiv({ cls: 'planner-quick-capture-preview' });
    this.previewEl.createEl('p', { text: 'Start typing to see parsed preview...' });

    // Syntax help
    const helpEl = contentEl.createDiv({ cls: 'planner-quick-capture-help' });
    helpEl.createEl('h4', { text: 'Syntax' });
    const helpList = helpEl.createEl('ul');
    // eslint-disable-next-line obsidianmd/ui/sentence-case -- "Friday", "Jan" are proper nouns (day/month names)
    helpList.createEl('li', { text: 'Dates: "tomorrow", "next Friday at 3pm", "Jan 15"' });
    helpList.createEl('li', { text: '@context - add context (e.g., @work, @home)' });
    helpList.createEl('li', { text: '#tag - add tags (e.g., #task, #event)' });
    helpList.createEl('li', { text: '!priority - set priority (e.g., !urgent, !high)' });
    // eslint-disable-next-line obsidianmd/ui/sentence-case -- "In-Progress" is an example status value
    helpList.createEl('li', { text: '>status - set status (e.g., >In-Progress)' });
    // eslint-disable-next-line obsidianmd/ui/sentence-case -- "Note" is an example link target
    helpList.createEl('li', { text: '+[[Note]] - set parent item' });
    // eslint-disable-next-line obsidianmd/ui/sentence-case -- "Work", "Personal" are example calendar names
    helpList.createEl('li', { text: '~calendar - set calendar (e.g., ~Work, ~Personal)' });

    // Buttons
    const buttonContainer = contentEl.createDiv({ cls: 'planner-quick-capture-buttons' });

    const createBtn = buttonContainer.createEl('button', {
      text: 'Create',
      cls: 'planner-btn planner-btn-primary',
    });
    createBtn.addEventListener('click', () => { void this.createItem(); });

    const cancelBtn = buttonContainer.createEl('button', {
      text: 'Cancel',
      cls: 'planner-btn',
    });
    cancelBtn.addEventListener('click', () => this.close());

    // Focus input
    setTimeout(() => this.inputEl.focus(), 50);
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }

  private parseInput(input: string): void {
    let remaining = input.trim();
    const parsed: ParsedInput = { title: '' };

    // Extract @context
    const contextMatches = remaining.match(/@(\w+)/g);
    if (contextMatches) {
      parsed.context = contextMatches.map(m => m.slice(1)); // Remove the @ prefix
      remaining = remaining.replace(/@(\w+)/g, '').trim();
    }

    // Extract #tags
    const tagMatches = remaining.match(/#(\w+)/g);
    if (tagMatches) {
      parsed.tags = tagMatches.map(m => m.slice(1)); // Remove the # prefix
      remaining = remaining.replace(/#(\w+)/g, '').trim();
    }

    // Extract !priority
    const priorityMatch = remaining.match(/!(\w+)/);
    if (priorityMatch) {
      const priorityName = priorityMatch[1];
      // Match against configured priorities (case-insensitive)
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
      const statusName = statusMatch[1].replace(/-/g, ' '); // Allow hyphens for multi-word
      // Match against configured statuses (case-insensitive)
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

      // Get start date
      const startDate = dateResult.start.date();
      parsed.date_start_scheduled = startDate.toISOString();

      // Check if time was specified
      const hasTime = dateResult.start.isCertain('hour');
      parsed.all_day = !hasTime;

      // If there's an end date
      if (dateResult.end) {
        const endDate = dateResult.end.date();
        parsed.date_end_scheduled = endDate.toISOString();
      }

      // Remove the date text from remaining
      remaining = remaining.replace(dateResult.text, '').trim();
    }

    // Clean up extra spaces and what's left is the title
    parsed.title = remaining.replace(/\s+/g, ' ').trim();

    // Default title if empty
    if (!parsed.title) {
      parsed.title = 'New item';
    }

    this.parsedInput = parsed;
  }

  private updatePreview(): void {
    this.previewEl.empty();

    const { parsedInput } = this;

    if (!this.inputEl.value.trim()) {
      this.previewEl.createEl('p', { text: 'Start typing to see parsed preview...' });
      return;
    }

    const previewTitle = this.previewEl.createDiv({ cls: 'planner-preview-title' });
    previewTitle.createEl('strong', { text: parsedInput.title });

    const previewDetails = this.previewEl.createDiv({ cls: 'planner-preview-details' });

    // Date
    if (parsedInput.date_start_scheduled) {
      const date = new Date(parsedInput.date_start_scheduled);
      const dateStr = parsedInput.all_day
        ? date.toLocaleDateString()
        : date.toLocaleString();
      this.addPreviewBadge(previewDetails, `📅 ${dateStr}`, 'date');
    }

    // Context
    if (parsedInput.context?.length) {
      for (const ctx of parsedInput.context) {
        this.addPreviewBadge(previewDetails, `@${ctx}`, 'context');
      }
    }

    // Tags
    if (parsedInput.tags?.length) {
      for (const tag of parsedInput.tags) {
        this.addPreviewBadge(previewDetails, `#${tag}`, 'tag');
      }
    }

    // Priority
    if (parsedInput.priority) {
      const priorityConfig = this.plugin.settings.priorities.find(
        p => p.name === parsedInput.priority
      );
      this.addPreviewBadge(
        previewDetails,
        `!${parsedInput.priority}`,
        'priority',
        priorityConfig?.color
      );
    }

    // Status
    if (parsedInput.status) {
      const statusConfig = this.plugin.settings.statuses.find(
        s => s.name === parsedInput.status
      );
      this.addPreviewBadge(
        previewDetails,
        parsedInput.status,
        'status',
        statusConfig?.color
      );
    }

    // Calendar
    if (parsedInput.calendar?.length) {
      const calendarColor = this.plugin.settings.calendars[parsedInput.calendar[0]]?.color;
      this.addPreviewBadge(
        previewDetails,
        `~${parsedInput.calendar[0]}`,
        'calendar',
        calendarColor
      );
    }

    // Parent
    if (parsedInput.parent) {
      this.addPreviewBadge(previewDetails, parsedInput.parent, 'parent');
    }
  }

  private addPreviewBadge(
    container: HTMLElement,
    text: string,
    type: string,
    color?: string
  ): void {
    const badge = container.createSpan({ text, cls: `planner-preview-badge planner-preview-${type}` });
    if (color) {
      badge.style.backgroundColor = color;
      badge.style.color = this.getContrastColor(color);
    }
  }

  private getContrastColor(hexColor: string): string {
    const hex = hexColor.replace('#', '');
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? '#000000' : '#ffffff';
  }

  private async createItem(): Promise<void> {
    const { parsedInput } = this;

    if (!parsedInput.title || parsedInput.title === 'New Item' && !this.inputEl.value.trim()) {
      new Notice('Please enter some text');
      return;
    }

    // Build frontmatter
    const frontmatter: Partial<ItemFrontmatter> = {
      title: parsedInput.title,
    };

    if (parsedInput.tags?.length) {
      frontmatter.tags = parsedInput.tags;
    } else {
      // Default to task if no tag specified
      frontmatter.tags = ['task'];
    }

    if (parsedInput.date_start_scheduled) {
      frontmatter.date_start_scheduled = parsedInput.date_start_scheduled;
    }
    if (parsedInput.date_end_scheduled) {
      frontmatter.date_end_scheduled = parsedInput.date_end_scheduled;
    }
    if (parsedInput.all_day !== undefined) {
      frontmatter.all_day = parsedInput.all_day;
    }
    if (parsedInput.context?.length) {
      frontmatter.context = parsedInput.context;
    }
    if (parsedInput.priority) {
      frontmatter.priority = parsedInput.priority;
    }
    if (parsedInput.status) {
      frontmatter.status = parsedInput.status;
    } else {
      // Default status for tasks
      frontmatter.status = this.plugin.settings.quickCaptureDefaultStatus;
    }
    if (parsedInput.parent) {
      frontmatter.parent = parsedInput.parent;
    }
    if (parsedInput.calendar?.length) {
      frontmatter.calendar = parsedInput.calendar;
    }

    // Create the item
    try {
      const item = await this.plugin.itemService.createItem(parsedInput.title, frontmatter);

      if (item) {
        new Notice(`Created: ${parsedInput.title}`);

        if (this.plugin.settings.quickCaptureOpenAfterCreate) {
          await this.app.workspace.openLinkText(item.path, '', false);
        }

        this.close();
      }
    } catch (error) {
      console.error('Failed to create item:', error);
      new Notice('Failed to create item');
    }
  }
}
