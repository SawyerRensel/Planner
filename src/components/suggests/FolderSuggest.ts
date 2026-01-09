import { App, AbstractInputSuggest, TFolder } from 'obsidian';

/**
 * Autocomplete suggest for folder paths (single folder)
 */
export class FolderSuggest extends AbstractInputSuggest<TFolder> {
  private app: App;
  private inputEl: HTMLInputElement;

  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
    this.app = app;
    this.inputEl = inputEl;
  }

  getSuggestions(query: string): TFolder[] {
    const lowerQuery = query.toLowerCase().trim();

    // Get all folders from the vault
    const folders = this.app.vault.getAllFolders();

    if (!lowerQuery) {
      // Show all folders when empty, sorted by path
      return folders
        .filter(folder => !folder.isRoot())
        .sort((a, b) => a.path.localeCompare(b.path))
        .slice(0, 15);
    }

    return folders
      .filter(folder => {
        if (folder.isRoot()) return false;
        return folder.path.toLowerCase().includes(lowerQuery);
      })
      .sort((a, b) => {
        // Prioritize folders that start with the query
        const aStarts = a.path.toLowerCase().startsWith(lowerQuery);
        const bStarts = b.path.toLowerCase().startsWith(lowerQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.path.localeCompare(b.path);
      })
      .slice(0, 15);
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.createEl('div', { text: folder.path, cls: 'suggestion-title' });
  }

  selectSuggestion(folder: TFolder): void {
    this.inputEl.value = folder.path;
    this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    this.close();
  }
}

/**
 * Autocomplete suggest for folder paths (comma-separated list)
 */
export class FolderListSuggest extends AbstractInputSuggest<TFolder> {
  private app: App;
  private inputEl: HTMLInputElement;

  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
    this.app = app;
    this.inputEl = inputEl;
  }

  getSuggestions(query: string): TFolder[] {
    // Find the current segment being typed (after the last comma)
    const segments = query.split(',');
    const currentSegment = segments[segments.length - 1].trim().toLowerCase();

    // Get all folders from the vault
    const folders = this.app.vault.getAllFolders();

    if (!currentSegment) {
      // Show all folders when segment is empty
      return folders
        .filter(folder => !folder.isRoot())
        .sort((a, b) => a.path.localeCompare(b.path))
        .slice(0, 15);
    }

    return folders
      .filter(folder => {
        if (folder.isRoot()) return false;
        return folder.path.toLowerCase().includes(currentSegment);
      })
      .sort((a, b) => {
        // Prioritize folders that start with the query
        const aStarts = a.path.toLowerCase().startsWith(currentSegment);
        const bStarts = b.path.toLowerCase().startsWith(currentSegment);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.path.localeCompare(b.path);
      })
      .slice(0, 15);
  }

  renderSuggestion(folder: TFolder, el: HTMLElement): void {
    el.createEl('div', { text: folder.path, cls: 'suggestion-title' });
  }

  selectSuggestion(folder: TFolder): void {
    const currentValue = this.inputEl.value;
    const segments = currentValue.split(',').map(s => s.trim()).filter(s => s);

    // Replace the last segment (or add if empty)
    if (segments.length > 0 && currentValue.trimEnd().endsWith(',')) {
      // User typed a comma, add new folder
      segments.push(folder.path);
    } else if (segments.length > 0) {
      // Replace last segment
      segments[segments.length - 1] = folder.path;
    } else {
      segments.push(folder.path);
    }

    this.inputEl.value = segments.join(', ');
    this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    this.close();
  }
}
