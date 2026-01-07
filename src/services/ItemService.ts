import { App, TFile, TFolder, normalizePath } from 'obsidian';
import {
  PlannerItem,
  ItemFrontmatter,
  PlannerItemWithComputed,
  FRONTMATTER_FIELD_ORDER,
} from '../types/item';
import { PlannerSettings, isCompletedStatus, getCalendarFolder } from '../types/settings';

/**
 * Get current local time in ISO 8601 format
 * Returns format like "2026-01-06T19:44:23.405Z" using local time
 */
function getLocalISOString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  const ms = String(now.getMilliseconds()).padStart(3, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}:${seconds}.${ms}Z`;
}

/**
 * Service for managing Planner items (CRUD operations)
 */
export class ItemService {
  constructor(
    private app: App,
    private getSettings: () => PlannerSettings
  ) {}

  /**
   * Get all items from the vault based on settings
   */
  async getAllItems(): Promise<PlannerItem[]> {
    const settings = this.getSettings();
    const files = this.app.vault.getMarkdownFiles();
    const items: PlannerItem[] = [];

    for (const file of files) {
      if (this.isItemFile(file, settings)) {
        const item = await this.getItem(file.path);
        if (item) {
          items.push(item);
        }
      }
    }

    return items;
  }

  /**
   * Check if a file is a planner item based on settings
   */
  private isItemFile(file: TFile, settings: PlannerSettings): boolean {
    const { identificationMethod, includeFolders, includeTags } = settings;

    // Check folder
    const inFolder = includeFolders.some(folder => {
      const normalizedFolder = normalizePath(folder);
      return file.path.startsWith(normalizedFolder);
    });

    // Check tags (from frontmatter cache)
    const cache = this.app.metadataCache.getFileCache(file);
    const fileTags = cache?.frontmatter?.tags ?? [];
    const hasTag = includeTags.some(tag => {
      const normalizedTag = tag.startsWith('#') ? tag.slice(1) : tag;
      return fileTags.includes(normalizedTag);
    });

    switch (identificationMethod) {
      case 'folder':
        return inFolder;
      case 'tag':
        return hasTag;
      case 'both':
        return inFolder || hasTag;
      default:
        return inFolder;
    }
  }

  /**
   * Get a single item by file path
   */
  async getItem(path: string): Promise<PlannerItem | null> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      return null;
    }

    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter;

    if (!frontmatter) {
      return { path };
    }

    return {
      path,
      // Identity
      title: frontmatter.title ?? file.basename,
      summary: frontmatter.summary,
      tags: this.normalizeTags(frontmatter.tags),
      // Categorization
      calendar: this.normalizeList(frontmatter.calendar),
      context: this.normalizeList(frontmatter.context),
      people: this.normalizeList(frontmatter.people),
      location: frontmatter.location,
      related: this.normalizeList(frontmatter.related),
      // Status
      status: frontmatter.status,
      priority: frontmatter.priority,
      progress: frontmatter.progress,
      // Dates
      date_created: frontmatter.date_created,
      date_modified: frontmatter.date_modified,
      date_start_scheduled: frontmatter.date_start_scheduled,
      date_start_actual: frontmatter.date_start_actual,
      date_end_scheduled: frontmatter.date_end_scheduled,
      date_end_actual: frontmatter.date_end_actual,
      all_day: frontmatter.all_day,
      // Recurrence
      repeat_frequency: frontmatter.repeat_frequency,
      repeat_interval: frontmatter.repeat_interval,
      repeat_until: frontmatter.repeat_until,
      repeat_count: frontmatter.repeat_count,
      repeat_byday: this.normalizeList(frontmatter.repeat_byday),
      repeat_bymonth: this.normalizeList(frontmatter.repeat_bymonth),
      repeat_bymonthday: this.normalizeList(frontmatter.repeat_bymonthday),
      repeat_bysetpos: frontmatter.repeat_bysetpos,
      repeat_completed_dates: this.normalizeList(frontmatter.repeat_completed_dates),
      // Hierarchy & Dependencies
      parent: frontmatter.parent,
      children: this.normalizeList(frontmatter.children),
      blocked_by: this.normalizeList(frontmatter.blocked_by),
      // Display
      cover: frontmatter.cover,
      color: frontmatter.color,
    };
  }

  /**
   * Create a new item
   */
  async createItem(
    filename: string,
    frontmatter: Partial<ItemFrontmatter>,
    content: string = ''
  ): Promise<PlannerItem> {
    const settings = this.getSettings();

    // Determine folder: use calendar-specific folder if available, otherwise global itemsFolder
    const calendarName = frontmatter.calendar?.[0];
    const folder = calendarName
      ? getCalendarFolder(settings, calendarName)
      : settings.itemsFolder;

    // Ensure folder exists
    await this.ensureFolderExists(folder);

    // Generate unique filename if needed
    const safeName = this.sanitizeFilename(filename);
    let filePath = normalizePath(`${folder}/${safeName}.md`);
    let counter = 1;

    while (this.app.vault.getAbstractFileByPath(filePath)) {
      filePath = normalizePath(`${folder}/${safeName} ${counter}.md`);
      counter++;
    }

    // Set auto-generated dates
    const now = getLocalISOString();
    const itemFrontmatter: Partial<ItemFrontmatter> = {
      ...frontmatter,
      date_created: frontmatter.date_created ?? now,
      date_modified: now,
    };

    // Apply defaults
    if (!itemFrontmatter.calendar && settings.defaultCalendar) {
      itemFrontmatter.calendar = [settings.defaultCalendar];
    }

    // Build file content
    const fileContent = this.buildFileContent(itemFrontmatter, content);

    // Create file
    await this.app.vault.create(filePath, fileContent);

    return this.getItem(filePath) as Promise<PlannerItem>;
  }

  /**
   * Update an existing item
   */
  async updateItem(
    path: string,
    updates: Partial<ItemFrontmatter>
  ): Promise<PlannerItem | null> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      return null;
    }

    const settings = this.getSettings();
    const content = await this.app.vault.read(file);
    const { body } = this.parseFrontmatter(content);

    // Get existing frontmatter from Obsidian's metadata cache
    const cache = this.app.metadataCache.getFileCache(file);
    const existingFrontmatter = cache?.frontmatter ?? {};

    // Apply updates
    const updatedFrontmatter: Partial<ItemFrontmatter> = {
      ...existingFrontmatter,
      ...updates,
      date_modified: getLocalISOString(),
    };

    // Auto-set date_end_actual when status changes to completed
    if (updates.status && isCompletedStatus(settings, updates.status) && !existingFrontmatter.date_end_actual) {
      updatedFrontmatter.date_end_actual = getLocalISOString();
    }

    // Build new file content
    const newContent = this.buildFileContent(updatedFrontmatter, body);

    // Update file
    await this.app.vault.modify(file, newContent);

    return this.getItem(path);
  }

  /**
   * Delete an item
   */
  async deleteItem(path: string): Promise<boolean> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      return false;
    }

    await this.app.vault.delete(file);
    return true;
  }

  /**
   * Move an item to a different folder
   * Returns the new path if successful, null if failed
   */
  async moveItem(path: string, targetFolder: string): Promise<string | null> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      return null;
    }

    // Ensure target folder exists
    await this.ensureFolderExists(targetFolder);

    // Build new path
    const normalizedFolder = normalizePath(targetFolder);
    let newPath = normalizePath(`${normalizedFolder}/${file.name}`);

    // Handle filename conflicts
    let counter = 1;
    const baseName = file.basename;
    const ext = file.extension;
    while (this.app.vault.getAbstractFileByPath(newPath) && newPath !== path) {
      newPath = normalizePath(`${normalizedFolder}/${baseName} ${counter}.${ext}`);
      counter++;
    }

    // Don't move if already in the target folder
    if (newPath === path) {
      return path;
    }

    // Move the file
    await this.app.fileManager.renameFile(file, newPath);
    return newPath;
  }

  /**
   * Get the body content (markdown below frontmatter) of an item
   */
  async getItemBody(path: string): Promise<string> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      return '';
    }

    const content = await this.app.vault.read(file);
    const { body } = this.parseFrontmatter(content);
    return body.trim();
  }

  /**
   * Update an item's body content
   */
  async updateItemBody(path: string, newBody: string): Promise<boolean> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      return false;
    }

    const content = await this.app.vault.read(file);
    const match = content.match(/^---\n[\s\S]*?\n---\n?/);
    if (!match) {
      return false;
    }

    const newContent = match[0] + '\n' + newBody;
    await this.app.vault.modify(file, newContent);
    return true;
  }

  /**
   * Get items with computed fields
   */
  async getItemsWithComputed(): Promise<PlannerItemWithComputed[]> {
    const items = await this.getAllItems();
    const settings = this.getSettings();

    // Build blocking map (reverse lookup of blocked_by)
    const blockingMap = new Map<string, string[]>();
    for (const item of items) {
      if (item.blocked_by) {
        for (const blockedByPath of item.blocked_by) {
          const existing = blockingMap.get(blockedByPath) ?? [];
          existing.push(item.path);
          blockingMap.set(blockedByPath, existing);
        }
      }
    }

    // Add computed fields
    return items.map(item => {
      const blocking = blockingMap.get(item.path) ?? [];

      // Calculate duration
      let duration: number | null = null;
      if (item.date_start_scheduled && item.date_end_scheduled) {
        duration = new Date(item.date_end_scheduled).getTime() - new Date(item.date_start_scheduled).getTime();
      }

      // Check if overdue (date_end_scheduled is past and not completed)
      const isOverdue = item.date_end_scheduled
        ? new Date(item.date_end_scheduled) < new Date() && !isCompletedStatus(settings, item.status ?? '')
        : false;

      return {
        ...item,
        blocking,
        duration,
        is_overdue: isOverdue,
        next_occurrence: null, // TODO: Implement with rrule
      };
    });
  }

  /**
   * Build file content from frontmatter and body
   */
  private buildFileContent(frontmatter: Partial<ItemFrontmatter>, body: string = ''): string {
    const yaml = this.buildYaml(frontmatter);
    return `---\n${yaml}---\n${body}`;
  }

  /**
   * Build YAML string from frontmatter object
   */
  private buildYaml(frontmatter: Partial<ItemFrontmatter>): string {
    const lines: string[] = [];

    for (const key of FRONTMATTER_FIELD_ORDER) {
      const value = frontmatter[key];

      if (value === undefined || value === null || value === '') {
        // Include empty fields for completeness
        lines.push(`${key}:`);
      } else if (Array.isArray(value)) {
        if (value.length === 0) {
          lines.push(`${key}:`);
        } else {
          lines.push(`${key}:`);
          for (const item of value) {
            lines.push(`  - ${this.yamlValue(item)}`);
          }
        }
      } else if (typeof value === 'boolean') {
        lines.push(`${key}: ${value}`);
      } else if (typeof value === 'number') {
        lines.push(`${key}: ${value}`);
      } else {
        lines.push(`${key}: ${this.yamlValue(value)}`);
      }
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Format a value for YAML
   */
  private yamlValue(value: unknown): string {
    if (typeof value === 'string') {
      // Quote strings that need it
      if (value.includes(':') || value.includes('#') || value.includes('\n') || value.startsWith('[[')) {
        return `"${value.replace(/"/g, '\\"')}"`;
      }
      return value;
    }
    return String(value);
  }

  /**
   * Parse frontmatter from file content
   */
  private parseFrontmatter(content: string): { frontmatter: Record<string, unknown>; body: string } {
    const match = content.match(/^---\n([\s\S]*?)\n---\n?([\s\S]*)$/);
    if (!match) {
      return { frontmatter: {}, body: content };
    }

    // Simple YAML parsing (for now, rely on Obsidian's cache)
    // This is a fallback for when we need the raw content
    return {
      frontmatter: {},
      body: match[2] ?? '',
    };
  }

  /**
   * Ensure a folder exists
   */
  private async ensureFolderExists(folderPath: string): Promise<void> {
    const normalized = normalizePath(folderPath);
    const folder = this.app.vault.getAbstractFileByPath(normalized);

    if (!folder) {
      await this.app.vault.createFolder(normalized);
    }
  }

  /**
   * Sanitize a filename
   */
  private sanitizeFilename(name: string): string {
    return name.replace(/[\\/:*?"<>|]/g, '-').trim();
  }

  /**
   * Normalize tags (remove # prefix if present)
   */
  private normalizeTags(tags: unknown): string[] | undefined {
    if (!tags) return undefined;
    if (!Array.isArray(tags)) return [String(tags)];
    return tags.map(t => {
      const str = String(t);
      return str.startsWith('#') ? str.slice(1) : str;
    });
  }

  /**
   * Normalize a value to an array
   */
  private normalizeList<T>(value: unknown): T[] | undefined {
    if (!value) return undefined;
    if (Array.isArray(value)) return value as T[];
    return [value as T];
  }
}
