import { App, AbstractInputSuggest, TFile, parseLinktext } from 'obsidian';

/**
 * Convert any link format to simple wikilinks for display in the modal
 * Handles: [[path|display]], [display]("path"), [display](path)
 * Output: [[display]] (simple wikilink with just the display name)
 */
export function convertToSimpleWikilinks(value: string | string[] | null): string | string[] | null {
  if (!value) return value;

  const convertSingleValue = (val: string): string => {
    // First, convert markdown links [text]("path") or [text](path) to simple wikilinks
    let result = val.replace(/\[([^\]]+)\]\([^)]+\)/g, (match, displayText) => {
      return `[[${displayText}]]`;
    });

    // Then, convert relative path wikilinks [[path|display]] to simple [[display]]
    result = result.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, (match, path, displayText) => {
      return `[[${displayText}]]`;
    });

    // Convert [[path/to/file]] (no display text) to [[filename]]
    result = result.replace(/\[\[([^\]|]+)\]\]/g, (match, path) => {
      // Extract just the filename from the path
      const parts = path.split('/');
      const filename = parts[parts.length - 1].replace(/\.md$/, '');
      return `[[${filename}]]`;
    });

    return result;
  };

  if (Array.isArray(value)) {
    return value.map(convertSingleValue);
  }

  return convertSingleValue(value);
}

/**
 * Convert simple wikilinks to relative path wikilinks if user has disabled wikilinks in Obsidian settings
 * @param app The Obsidian app instance
 * @param value The value containing wikilinks like [[Note]] or comma-separated [[Note1]], [[Note2]]
 * @param itemsFolder The folder where items are stored (to calculate relative paths)
 * @returns The converted value with relative path wikilinks or original if wikilinks are preferred
 */
export function convertWikilinksToRelativePaths(
  app: App,
  value: string | string[] | null,
  itemsFolder: string
): string | string[] | null {
  if (!value) return value;

  // @ts-ignore - getConfig exists but isn't in the type definitions
  const useMarkdownLinks = app.vault.getConfig('useMarkdownLinks') === true;
  if (!useMarkdownLinks) {
    return value; // Keep simple wikilinks as-is
  }

  // Normalize items folder path (remove trailing slash)
  const normalizedItemsFolder = itemsFolder.replace(/\/$/, '');

  const convertSingleValue = (val: string): string => {
    // Match wikilinks like [[Note Name]] or [[Note Name|Display Text]]
    return val.replace(/\[\[([^\]|]+)(?:\|([^\]]+))?\]\]/g, (match, linkPath, displayText) => {
      const display = displayText || linkPath;
      // Try to resolve the file path
      const linkInfo = parseLinktext(linkPath);
      const file = app.metadataCache.getFirstLinkpathDest(linkInfo.path, '');

      if (file) {
        // Calculate relative path from items folder to the file
        const filePath = file.path.replace(/\.md$/, ''); // Remove .md extension
        const relativePath = calculateRelativePath(normalizedItemsFolder, filePath);
        return `[[${relativePath}|${display}]]`;
      } else {
        // File not found, keep as-is
        return match;
      }
    });
  };

  if (Array.isArray(value)) {
    return value.map(convertSingleValue);
  }

  return convertSingleValue(value);
}

/**
 * Calculate relative path from source folder to target path
 */
function calculateRelativePath(fromFolder: string, toPath: string): string {
  const fromParts = fromFolder.split('/').filter(p => p);
  const toParts = toPath.split('/').filter(p => p);

  // Find common prefix length
  let commonLength = 0;
  while (
    commonLength < fromParts.length &&
    commonLength < toParts.length &&
    fromParts[commonLength] === toParts[commonLength]
  ) {
    commonLength++;
  }

  // Build relative path: go up for remaining fromParts, then down to toParts
  const upCount = fromParts.length - commonLength;
  const upPath = Array(upCount).fill('..').join('/');
  const downPath = toParts.slice(commonLength).join('/');

  if (upPath && downPath) {
    return `${upPath}/${downPath}`;
  } else if (upPath) {
    return upPath;
  } else if (downPath) {
    return downPath;
  } else {
    return toParts[toParts.length - 1]; // Same folder, just return filename
  }
}

/**
 * Autocomplete suggest for file links (wiki-link style [[Note]])
 * Supports both single values and comma-separated lists
 */
export class FileLinkSuggest extends AbstractInputSuggest<TFile> {
  private app: App;
  private inputEl: HTMLInputElement;
  private onSelect: (file: TFile) => void;

  constructor(app: App, inputEl: HTMLInputElement, onSelect?: (file: TFile) => void) {
    super(app, inputEl);
    this.app = app;
    this.inputEl = inputEl;
    this.onSelect = onSelect || (() => {});
  }

  getSuggestions(query: string): TFile[] {
    // Find the current segment being typed (after the last comma or at start)
    const segments = query.split(',');
    const currentSegment = segments[segments.length - 1].trim();

    // Check if we're inside [[ brackets
    const bracketMatch = currentSegment.match(/\[\[([^\]]*)?$/);
    const searchQuery = bracketMatch ? bracketMatch[1] || '' : currentSegment;

    if (!searchQuery && !bracketMatch) {
      return [];
    }

    const files = this.app.vault.getMarkdownFiles();
    const lowerQuery = searchQuery.toLowerCase();

    return files
      .filter(file => {
        const fileName = file.basename.toLowerCase();
        const filePath = file.path.toLowerCase();
        return fileName.includes(lowerQuery) || filePath.includes(lowerQuery);
      })
      .slice(0, 10); // Limit results
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.createEl('div', { text: file.basename, cls: 'suggestion-title' });
    el.createEl('small', { text: file.path, cls: 'suggestion-path' });
  }

  selectSuggestion(file: TFile): void {
    const currentValue = this.inputEl.value;
    const segments = currentValue.split(',');
    const lastSegment = segments[segments.length - 1];

    // Always display as wikilinks during editing
    // Conversion to markdown links happens on save if user has disabled wikilinks
    const linkText = `[[${file.basename}]]`;

    // Check if we're completing a [[ bracket
    const bracketMatch = lastSegment.match(/^(.*?)\[\[[^\]]*$/);

    if (bracketMatch) {
      const prefix = bracketMatch[1];
      // If there's already a complete wikilink before this one, add a comma separator
      if (prefix.includes(']]')) {
        segments[segments.length - 1] = prefix.replace(/\]\]\s*$/, ']]') + ', ' + linkText;
      } else {
        segments[segments.length - 1] = prefix + linkText;
      }
    } else {
      // Replace the last segment with the formatted link
      segments[segments.length - 1] = ` ${linkText}`;
    }

    let newValue = segments.join(',').replace(/^,\s*/, '').trim();
    // Ensure any remaining space-separated wikilinks are comma-separated
    newValue = newValue.replace(/\]\]\s+\[\[/g, ']], [[');
    this.inputEl.value = newValue;
    this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    this.onSelect(file);
    this.close();
  }
}

/**
 * Autocomplete suggest for tags
 * Shows existing tags from the vault
 */
export class TagSuggest extends AbstractInputSuggest<string> {
  private app: App;
  private inputEl: HTMLInputElement;

  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
    this.app = app;
    this.inputEl = inputEl;
  }

  getSuggestions(query: string): string[] {
    // Find the current segment being typed
    const segments = query.split(',');
    const currentSegment = segments[segments.length - 1].trim().replace(/^#/, '');

    if (!currentSegment) {
      return [];
    }

    // Get all tags from the vault
    const allTags = new Set<string>();
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.frontmatter?.tags) {
        const tags = Array.isArray(cache.frontmatter.tags)
          ? cache.frontmatter.tags
          : [cache.frontmatter.tags];
        tags.forEach((tag: string) => allTags.add(String(tag).replace(/^#/, '')));
      }
      // Also check inline tags
      if (cache?.tags) {
        cache.tags.forEach(t => allTags.add(t.tag.replace(/^#/, '')));
      }
    }

    const lowerQuery = currentSegment.toLowerCase();
    return Array.from(allTags)
      .filter(tag => tag.toLowerCase().includes(lowerQuery))
      .slice(0, 10);
  }

  renderSuggestion(tag: string, el: HTMLElement): void {
    el.createEl('div', { text: `#${tag}`, cls: 'suggestion-title' });
  }

  selectSuggestion(tag: string): void {
    const currentValue = this.inputEl.value;
    const segments = currentValue.split(',').map(s => s.trim()).filter(s => s);

    // Replace or add the tag
    if (segments.length > 0) {
      segments[segments.length - 1] = tag;
    } else {
      segments.push(tag);
    }

    this.inputEl.value = segments.join(', ');
    this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    this.close();
  }
}

/**
 * Autocomplete suggest for context values
 * Shows existing context values from items
 */
export class ContextSuggest extends AbstractInputSuggest<string> {
  private app: App;
  private inputEl: HTMLInputElement;

  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
    this.app = app;
    this.inputEl = inputEl;
  }

  getSuggestions(query: string): string[] {
    // Find the current segment being typed
    const segments = query.split(',');
    const currentSegment = segments[segments.length - 1].trim().replace(/^@/, '');

    if (!currentSegment) {
      return [];
    }

    // Get all context values from the vault
    const allContexts = new Set<string>();
    const files = this.app.vault.getMarkdownFiles();

    for (const file of files) {
      const cache = this.app.metadataCache.getFileCache(file);
      if (cache?.frontmatter?.context) {
        const contexts = Array.isArray(cache.frontmatter.context)
          ? cache.frontmatter.context
          : [cache.frontmatter.context];
        contexts.forEach((ctx: string) => allContexts.add(String(ctx)));
      }
    }

    const lowerQuery = currentSegment.toLowerCase();
    return Array.from(allContexts)
      .filter(ctx => ctx.toLowerCase().includes(lowerQuery))
      .slice(0, 10);
  }

  renderSuggestion(context: string, el: HTMLElement): void {
    el.createEl('div', { text: context, cls: 'suggestion-title' });
  }

  selectSuggestion(context: string): void {
    const currentValue = this.inputEl.value;
    const segments = currentValue.split(',').map(s => s.trim()).filter(s => s);

    if (segments.length > 0) {
      segments[segments.length - 1] = context;
    } else {
      segments.push(context);
    }

    this.inputEl.value = segments.join(', ');
    this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    this.close();
  }
}
