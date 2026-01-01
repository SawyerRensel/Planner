import { App, AbstractInputSuggest, TFile } from 'obsidian';

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

    // Check if user prefers markdown links over wikilinks
    // @ts-ignore - getConfig exists but isn't in the type definitions
    const useMarkdownLinks = this.app.vault.getConfig('useMarkdownLinks') === true;

    // Format the link based on user preference
    const linkText = useMarkdownLinks
      ? `[${file.basename}](${file.path})`
      : `[[${file.basename}]]`;

    // Check if we're completing a [[ bracket
    const bracketMatch = lastSegment.match(/^(.*?)\[\[[^\]]*$/);

    if (bracketMatch) {
      // Replace the incomplete [[... with the formatted link
      segments[segments.length - 1] = bracketMatch[1] + linkText;
    } else {
      // Replace the last segment with the formatted link
      segments[segments.length - 1] = ` ${linkText}`;
    }

    const newValue = segments.join(',').replace(/^,\s*/, '').trim();
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
