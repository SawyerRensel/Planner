/**
 * Utility functions for handling item templates.
 *
 * Templates allow users to define default frontmatter values and body content
 * that are applied when creating new items.
 */

import type { App, TFile } from 'obsidian';
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

    // Get frontmatter from metadata cache
    const cache = app.metadataCache.getFileCache(file);
    const rawFrontmatter = cache?.frontmatter ?? {};

    // Separate standard Planner fields from custom fields
    const frontmatter: Partial<ItemFrontmatter> = {};
    const customFields: Record<string, unknown> = {};
    const standardFieldSet = new Set<string>(FRONTMATTER_FIELD_ORDER as string[]);

    for (const [key, value] of Object.entries(rawFrontmatter)) {
      // Skip Obsidian's internal 'position' field
      if (key === 'position') continue;

      if (standardFieldSet.has(key)) {
        // Standard Planner field
        (frontmatter as Record<string, unknown>)[key] = value;
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
