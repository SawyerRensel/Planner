import { App } from 'obsidian';

/**
 * Property category for filtering which menus a property appears in
 */
export type PropertyCategory = 'date' | 'categorical' | 'text' | 'unknown';

/**
 * Service for determining property types and filtering properties for configuration menus.
 * Uses Obsidian's metadataTypeManager when available, with fallback inference.
 */
export class PropertyTypeService {
  /**
   * Get the Obsidian property type for a given property ID.
   * Uses Obsidian's metadataTypeManager (undocumented API).
   *
   * @param propId - Property ID in format "note.fieldName" or "file.fieldName"
   * @param app - Obsidian App instance
   * @returns The Obsidian property type, or undefined if not found
   */
  static getObsidianPropertyType(propId: string, app: App): string | undefined {
    // Extract the field name from the property ID (e.g., "note.date_start" -> "date_start")
    const fieldName = propId.replace(/^(note|file|formula)\./, '');

    // Access Obsidian's metadataTypeManager (undocumented API)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const metadataTypeManager = (app as any).metadataTypeManager;
    if (metadataTypeManager?.getPropertyInfo) {
      const info = metadataTypeManager.getPropertyInfo(fieldName);
      return info?.type;
    }

    return undefined;
  }

  /**
   * Infer property category from property ID using naming conventions.
   * Used as fallback when Obsidian's type system doesn't have info.
   *
   * @param propId - Property ID in format "note.fieldName"
   * @returns Inferred property category
   */
  static inferPropertyCategory(propId: string): PropertyCategory {
    const fieldName = propId.replace(/^(note|file|formula)\./, '');

    // Check for date properties by naming convention
    if (fieldName.startsWith('date_') ||
        fieldName.includes('date') ||
        fieldName === 'created' ||
        fieldName === 'modified') {
      return 'date';
    }

    // Known categorical properties
    const categoricalFields = [
      'calendar', 'status', 'priority', 'parent', 'people',
      'folder', 'tags', 'context', 'location', 'color'
    ];
    if (categoricalFields.includes(fieldName)) {
      return 'categorical';
    }

    // Known text properties
    const textFields = ['title', 'summary', 'basename', 'name', 'path'];
    if (textFields.includes(fieldName)) {
      return 'text';
    }

    // Default to categorical (can be used for grouping)
    return 'categorical';
  }

  /**
   * Determine property category using Obsidian types with fallback inference.
   *
   * @param propId - Property ID
   * @param app - Obsidian App instance
   * @returns Property category
   */
  static getPropertyCategory(propId: string, app: App): PropertyCategory {
    const obsidianType = this.getObsidianPropertyType(propId, app);

    if (obsidianType) {
      // Map Obsidian types to our categories
      switch (obsidianType) {
        case 'date':
        case 'datetime':
          return 'date';
        case 'text':
          return 'text';
        case 'multitext':
        case 'tags':
        case 'aliases':
          return 'categorical';
        case 'number':
        case 'checkbox':
          // Numbers and checkboxes don't fit well in any menu category
          return 'unknown';
        default:
          return this.inferPropertyCategory(propId);
      }
    }

    // Fall back to inference
    return this.inferPropertyCategory(propId);
  }

  /**
   * Check if a property should appear in date field menus.
   *
   * @param propId - Property ID
   * @param app - Obsidian App instance
   * @returns true if this is a date property
   */
  static isDateProperty(propId: string, app: App): boolean {
    return this.getPropertyCategory(propId, app) === 'date';
  }

  /**
   * Check if a property should appear in categorical menus (Color by, Group by, Section by).
   *
   * @param propId - Property ID
   * @param app - Obsidian App instance
   * @returns true if this is a categorical property
   */
  static isCategoricalProperty(propId: string, app: App): boolean {
    const category = this.getPropertyCategory(propId, app);
    // Both categorical and text properties can be used for grouping/coloring
    return category === 'categorical' || category === 'text';
  }

  /**
   * Check if a property should appear in text field menus (Title field).
   *
   * @param propId - Property ID
   * @param app - Obsidian App instance
   * @returns true if this is a text property
   */
  static isTextProperty(propId: string, app: App): boolean {
    const category = this.getPropertyCategory(propId, app);
    return category === 'text' || category === 'categorical';
  }

  /**
   * Get a human-readable display name for a property ID.
   *
   * @param propId - Property ID (e.g., "note.date_start_scheduled")
   * @returns Display name (e.g., "Date Start Scheduled")
   */
  static getDisplayName(propId: string): string {
    // Handle file.* properties
    if (propId.startsWith('file.')) {
      const fieldName = propId.replace('file.', '');
      return fieldName.charAt(0).toUpperCase() + fieldName.slice(1).replace(/_/g, ' ');
    }

    // Handle note.* properties
    const fieldName = propId.replace(/^(note|formula)\./, '');

    // Convert snake_case to Title Case
    return fieldName
      .split('_')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  }
}
