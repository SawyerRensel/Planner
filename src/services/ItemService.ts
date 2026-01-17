import { App, TFile, normalizePath } from 'obsidian';
import {
  PlannerItem,
  ItemFrontmatter,
  PlannerItemWithComputed,
  FRONTMATTER_FIELD_ORDER,
} from '../types/item';
import { PlannerSettings, isCompletedStatus, getCalendarFolder } from '../types/settings';
import { isOngoing } from '../utils/dateUtils';

/**
 * Custom error class for ItemService operations
 */
export class ItemServiceError extends Error {
  constructor(
    message: string,
    public readonly code: 'FILE_NOT_FOUND' | 'CREATE_FAILED' | 'UPDATE_FAILED' | 'DELETE_FAILED' | 'MOVE_FAILED' | 'FOLDER_CREATE_FAILED',
    public readonly cause?: unknown
  ) {
    super(message);
    this.name = 'ItemServiceError';
  }
}

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
    const normalizedFolder = normalizePath(settings.itemsFolder);
    return file.path.startsWith(normalizedFolder);
  }

  /**
   * Get a single item by file path
   * Returns Promise for API compatibility with async callers
   */
  getItem(path: string): Promise<PlannerItem | null> {
    const file = this.app.vault.getAbstractFileByPath(path);
    if (!(file instanceof TFile)) {
      return Promise.resolve(null);
    }

    const cache = this.app.metadataCache.getFileCache(file);
    const frontmatter = cache?.frontmatter as ItemFrontmatter | undefined;

    if (!frontmatter) {
      return Promise.resolve({ path });
    }

    return Promise.resolve({
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
    });
  }

  /**
   * Create a new item
   * @throws {ItemServiceError} If file creation fails
   */
  async createItem(
    filename: string,
    frontmatter: Partial<ItemFrontmatter>,
    content: string = '',
    overrideFolder?: string,
    customFields?: Record<string, unknown>
  ): Promise<PlannerItem> {
    try {
      const settings = this.getSettings();

      // Determine folder: use override if provided, then calendar-specific folder, otherwise global itemsFolder
      let folder: string;
      if (overrideFolder) {
        folder = overrideFolder;
      } else {
        const calendarName = frontmatter.calendar?.[0];
        folder = calendarName
          ? getCalendarFolder(settings, calendarName)
          : settings.itemsFolder;
      }

      // Ensure folder exists
      await this.ensureFolderExists(folder);

      // Generate unique filename if needed
      const safeName = this.sanitizeFilename(filename);
      if (!safeName) {
        throw new ItemServiceError('Invalid filename provided', 'CREATE_FAILED');
      }

      let filePath = normalizePath(`${folder}/${safeName}.md`);
      let counter = 1;
      const maxAttempts = 100;

      while (this.app.vault.getAbstractFileByPath(filePath) && counter < maxAttempts) {
        filePath = normalizePath(`${folder}/${safeName} ${counter}.md`);
        counter++;
      }

      if (counter >= maxAttempts) {
        throw new ItemServiceError(`Too many files with name "${safeName}"`, 'CREATE_FAILED');
      }

      // Set auto-generated dates (always override template values for these)
      const now = getLocalISOString();
      const itemFrontmatter: Record<string, unknown> = {
        ...frontmatter,
        ...customFields, // Merge custom fields from template
        date_created: now, // Always set to current time
        date_modified: now, // Always set to current time
      };

      // Apply defaults
      if (!itemFrontmatter.calendar && settings.defaultCalendar) {
        itemFrontmatter.calendar = [settings.defaultCalendar];
      }

      // Build file content
      const fileContent = this.buildFileContent(itemFrontmatter, content);

      // Create file
      await this.app.vault.create(filePath, fileContent);

      const item = await this.getItem(filePath);
      if (!item) {
        throw new ItemServiceError('Failed to read created item', 'CREATE_FAILED');
      }

      return item;
    } catch (error) {
      if (error instanceof ItemServiceError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('Planner: Failed to create item:', error);
      throw new ItemServiceError(`Failed to create item: ${message}`, 'CREATE_FAILED', error);
    }
  }

  /**
   * Update an existing item
   * @throws {ItemServiceError} If file update fails
   */
  async updateItem(
    path: string,
    updates: Partial<ItemFrontmatter>
  ): Promise<PlannerItem | null> {
    try {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) {
        console.warn(`Planner: File not found for update: ${path}`);
        return null;
      }

      const settings = this.getSettings();
      const content = await this.app.vault.read(file);
      const { body } = this.parseFrontmatter(content);

      // Get existing frontmatter from Obsidian's metadata cache
      const cache = this.app.metadataCache.getFileCache(file);
      const rawFrontmatter = (cache?.frontmatter ?? {}) as Record<string, unknown>;

      // Filter out internal Obsidian properties (like 'position') that shouldn't be written back
      const existingFrontmatter: Record<string, unknown> = {};
      for (const key of Object.keys(rawFrontmatter)) {
        if (key !== 'position') {
          existingFrontmatter[key] = rawFrontmatter[key];
        }
      }

      // Apply updates - only merge in fields that are explicitly set in updates
      const updatedFrontmatter: Record<string, unknown> = {
        ...existingFrontmatter,
        ...updates,
        date_modified: getLocalISOString(),
      };

      // Auto-set date_end_actual when status changes to completed
      if (updates.status && isCompletedStatus(settings, updates.status) && !existingFrontmatter.date_end_actual) {
        updatedFrontmatter.date_end_actual = getLocalISOString();
      }

      // Build new file content - pass false to only include existing fields, not all template fields
      const newContent = this.buildFileContent(updatedFrontmatter, body, false);

      // Update file
      await this.app.vault.modify(file, newContent);

      return this.getItem(path);
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Planner: Failed to update item ${path}:`, error);
      throw new ItemServiceError(`Failed to update item: ${message}`, 'UPDATE_FAILED', error);
    }
  }

  /**
   * Delete an item
   * @throws {ItemServiceError} If file deletion fails
   */
  async deleteItem(path: string): Promise<boolean> {
    try {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) {
        console.warn(`Planner: File not found for deletion: ${path}`);
        return false;
      }

      await this.app.fileManager.trashFile(file);
      return true;
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Planner: Failed to delete item ${path}:`, error);
      throw new ItemServiceError(`Failed to delete item: ${message}`, 'DELETE_FAILED', error);
    }
  }

  /**
   * Move an item to a different folder
   * Returns the new path if successful, null if failed
   * @throws {ItemServiceError} If file move fails
   */
  async moveItem(path: string, targetFolder: string): Promise<string | null> {
    try {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (!(file instanceof TFile)) {
        console.warn(`Planner: File not found for move: ${path}`);
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
      const maxAttempts = 100;
      while (this.app.vault.getAbstractFileByPath(newPath) && newPath !== path && counter < maxAttempts) {
        newPath = normalizePath(`${normalizedFolder}/${baseName} ${counter}.${ext}`);
        counter++;
      }

      if (counter >= maxAttempts) {
        throw new ItemServiceError(`Too many files with name "${baseName}" in target folder`, 'MOVE_FAILED');
      }

      // Don't move if already in the target folder
      if (newPath === path) {
        return path;
      }

      // Move the file
      await this.app.fileManager.renameFile(file, newPath);
      return newPath;
    } catch (error) {
      if (error instanceof ItemServiceError) {
        throw error;
      }
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error(`Planner: Failed to move item ${path}:`, error);
      throw new ItemServiceError(`Failed to move item: ${message}`, 'MOVE_FAILED', error);
    }
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

      // Calculate duration (null if either date is "ongoing")
      let duration: number | null = null;
      if (item.date_start_scheduled && item.date_end_scheduled &&
          !isOngoing(item.date_start_scheduled) && !isOngoing(item.date_end_scheduled)) {
        duration = new Date(item.date_end_scheduled).getTime() - new Date(item.date_start_scheduled).getTime();
      }

      // Check if overdue (date_end_scheduled is past and not completed)
      // Items with "ongoing" end dates are never overdue
      const isOverdue = item.date_end_scheduled && !isOngoing(item.date_end_scheduled)
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
   * @param frontmatter The frontmatter to write (may include custom fields not in ItemFrontmatter)
   * @param body The body content
   * @param includeAllFields If true, includes all fields from FRONTMATTER_FIELD_ORDER (for new items)
   *                         If false, only includes fields that exist in the frontmatter object (for updates)
   */
  private buildFileContent(frontmatter: Record<string, unknown>, body: string = '', includeAllFields = true): string {
    const yaml = this.buildYaml(frontmatter, includeAllFields);
    return `---\n${yaml}---\n${body}`;
  }

  /**
   * Build YAML string from frontmatter object
   * @param frontmatter The frontmatter to write
   * @param includeAllFields If true, includes all fields from FRONTMATTER_FIELD_ORDER
   *                         If false, only includes fields that exist in the frontmatter object
   */
  private buildYaml(frontmatter: Record<string, unknown>, includeAllFields = true): string {
    const lines: string[] = [];
    const processedKeys = new Set<string>();

    // First, process fields in FRONTMATTER_FIELD_ORDER (for consistent ordering of Planner fields)
    for (const key of FRONTMATTER_FIELD_ORDER) {
      const value: unknown = frontmatter[key];
      const hasKey = key in frontmatter;
      processedKeys.add(key);

      // If not including all fields, skip keys that aren't in the frontmatter object
      if (!includeAllFields && !hasKey) {
        continue;
      }

      this.appendYamlField(lines, key, value, includeAllFields, hasKey);
    }

    // Then, process any remaining fields NOT in FRONTMATTER_FIELD_ORDER (custom fields like author, isbn, etc.)
    // These should always be preserved when updating
    for (const key of Object.keys(frontmatter)) {
      if (processedKeys.has(key)) {
        continue;
      }
      const value = frontmatter[key];
      this.appendYamlField(lines, key, value, true, true);
    }

    return lines.join('\n') + '\n';
  }

  /**
   * Append a single field to the YAML lines array
   */
  private appendYamlField(lines: string[], key: string, value: unknown, includeAllFields: boolean, hasKey: boolean): void {
    if (value === undefined || value === null || value === '') {
      // Only include empty fields if we're including all fields (new item)
      // or if the field explicitly exists in the object (was intentionally set)
      if (includeAllFields || hasKey) {
        lines.push(`${key}:`);
      }
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
    if (typeof tags === 'string') {
      return [tags.startsWith('#') ? tags.slice(1) : tags];
    }
    if (!Array.isArray(tags)) {
      // Handle non-string, non-array values by converting to string safely
      const str = typeof tags === 'object' && tags !== null ? JSON.stringify(tags) : String(tags as string | number | boolean);
      return [str.startsWith('#') ? str.slice(1) : str];
    }
    return tags.map((t: unknown) => {
      let str: string;
      if (typeof t === 'string') {
        str = t;
      } else if (typeof t === 'object' && t !== null) {
        str = JSON.stringify(t);
      } else {
        str = String(t as string | number | boolean);
      }
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
