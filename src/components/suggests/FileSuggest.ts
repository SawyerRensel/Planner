import { App, AbstractInputSuggest, TFile } from 'obsidian';

/**
 * Autocomplete suggest for file paths (single file)
 */
export class FileSuggest extends AbstractInputSuggest<TFile> {
  private app: App;
  private inputEl: HTMLInputElement;

  constructor(app: App, inputEl: HTMLInputElement) {
    super(app, inputEl);
    this.app = app;
    this.inputEl = inputEl;
  }

  getSuggestions(query: string): TFile[] {
    const lowerQuery = query.toLowerCase().trim();

    // Get all markdown files from the vault
    const files = this.app.vault.getMarkdownFiles();

    if (!lowerQuery) {
      // Show all files when empty, sorted by path
      return files
        .sort((a, b) => a.path.localeCompare(b.path))
        .slice(0, 15);
    }

    return files
      .filter(file => {
        const fileName = file.basename.toLowerCase();
        const filePath = file.path.toLowerCase();
        return fileName.includes(lowerQuery) || filePath.includes(lowerQuery);
      })
      .sort((a, b) => {
        // Prioritize files that start with the query
        const aStarts = a.path.toLowerCase().startsWith(lowerQuery);
        const bStarts = b.path.toLowerCase().startsWith(lowerQuery);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return a.path.localeCompare(b.path);
      })
      .slice(0, 15);
  }

  renderSuggestion(file: TFile, el: HTMLElement): void {
    el.createEl('div', { text: file.basename, cls: 'suggestion-title' });
    el.createEl('small', { text: file.path, cls: 'suggestion-note' });
  }

  selectSuggestion(file: TFile): void {
    this.inputEl.value = file.path;
    this.inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    this.close();
  }
}
