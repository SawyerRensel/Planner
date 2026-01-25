/**
 * Utility functions for handling item templates.
 *
 * Templates allow users to define default frontmatter values and body content
 * that are applied when creating new items.
 */

import { parseYaml, TFile } from 'obsidian';
import type { App } from 'obsidian';
import type { ItemFrontmatter } from '../types/item';
import { FRONTMATTER_FIELD_ORDER } from '../types/item';

/**
 * Parsed template data containing frontmatter and body content.
 */
export interface ParsedTemplate {
  /** Standard Planner frontmatter fields from the template */
  frontmatter: Partial<ItemFrontmatter>;
  /** Custom fields not in FRONTMATTER_FIELD_ORDER */
  customFields: Record<string, unknown>;
  /** Body content (text after frontmatter) */
  body: string;
}

/**
 * Extract and parse frontmatter YAML from file content.
 * This is more reliable than using the metadata cache which may not be populated.
 */
function parseFrontmatterFromContent(content: string): Record<string, unknown> {
  // Match frontmatter block: ---\n...\n---
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match || !match[1]) {
    return {};
  }

  try {
    const parsed: unknown = parseYaml(match[1]);
    return parsed && typeof parsed === 'object' ? parsed as Record<string, unknown> : {};
  } catch (error) {
    console.warn('[Planner] Error parsing template frontmatter YAML:', error);
    return {};
  }
}

/**
 * Normalize a value that could be a string or array to always be an array.
 * This handles YAML where `field: value` is a string but `field:\n  - value` is an array.
 */
function normalizeToArray(value: unknown): string[] | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }
  if (Array.isArray(value)) {
    return value.filter(v => v !== null && v !== undefined).map(String);
  }
  if (typeof value === 'string' && value.trim() !== '') {
    return [value];
  }
  return undefined;
}

/**
 * Read and parse an item template file.
 *
 * @param app - The Obsidian App instance
 * @param templatePath - Path to the template file
 * @returns Parsed template data, or null if template doesn't exist or path is empty
 */
export async function readItemTemplate(
  app: App,
  templatePath: string
): Promise<ParsedTemplate | null> {
  // Skip if path is empty
  if (!templatePath || templatePath.trim() === '') {
    return null;
  }

  try {
    // Try to find the template file (with and without .md extension)
    let file = app.vault.getAbstractFileByPath(templatePath);
    if (!file) {
      file = app.vault.getAbstractFileByPath(`${templatePath}.md`);
    }

    if (!(file instanceof TFile)) {
      // File not found - graceful fallback
      console.warn(`[Planner] Item template not found: ${templatePath}`);
      return null;
    }

    // Read file content
    const content = await app.vault.read(file);

    // Parse frontmatter directly from content (more reliable than metadata cache)
    const rawFrontmatter = parseFrontmatterFromContent(content);

    // Separate standard Planner fields from custom fields
    const frontmatter: Partial<ItemFrontmatter> = {};
    const customFields: Record<string, unknown> = {};
    const standardFieldSet = new Set<string>(FRONTMATTER_FIELD_ORDER as string[]);

    for (const [key, value] of Object.entries(rawFrontmatter)) {
      // Skip null/undefined values
      if (value === null || value === undefined) continue;

      if (standardFieldSet.has(key)) {
        // Standard Planner field - normalize array fields
        if (key === 'calendar' || key === 'tags' || key === 'context' ||
            key === 'people' || key === 'blocked_by' || key === 'related' ||
            key === 'repeat_byday' || key === 'repeat_bymonth' ||
            key === 'repeat_bymonthday' || key === 'repeat_completed_dates' ||
            key === 'children') {
          const normalized = normalizeToArray(value);
          if (normalized && normalized.length > 0) {
            (frontmatter as Record<string, unknown>)[key] = normalized;
          }
        } else {
          (frontmatter as Record<string, unknown>)[key] = value;
        }
      } else {
        // Custom field
        customFields[key] = value;
      }
    }

    // Extract body content (text after frontmatter)
    const body = extractBody(content);

    return {
      frontmatter,
      customFields,
      body,
    };
  } catch (error) {
    console.warn(`[Planner] Error reading item template: ${error}`);
    return null;
  }
}

/**
 * Extract body content from a markdown file with frontmatter.
 */
function extractBody(content: string): string {
  // Match frontmatter block: ---\n...\n---\n
  const match = content.match(/^---\n[\s\S]*?\n---\n?([\s\S]*)$/);
  if (match) {
    return match[1]?.trim() ?? '';
  }
  // No frontmatter, entire content is body
  return content.trim();
}
