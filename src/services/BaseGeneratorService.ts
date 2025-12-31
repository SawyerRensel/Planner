import { App, TFile, TFolder, normalizePath } from 'obsidian';
import type { PlannerSettings } from '../types/settings';

/**
 * Service for generating Obsidian Bases files
 */
export class BaseGeneratorService {
  private app: App;
  private getSettings: () => PlannerSettings;

  constructor(app: App, getSettings: () => PlannerSettings) {
    this.app = app;
    this.getSettings = getSettings;
  }

  /**
   * Get the path to the Tasks.base file
   */
  getTasksBasePath(): string {
    const folder = this.getSettings().basesFolder.replace(/\/$/, '');
    return normalizePath(`${folder}/Tasks.base`);
  }

  /**
   * Get the path to the Calendar.base file
   */
  getCalendarBasePath(): string {
    const folder = this.getSettings().basesFolder.replace(/\/$/, '');
    return normalizePath(`${folder}/Calendar.base`);
  }

  /**
   * Check if the Tasks.base file exists
   */
  async tasksBaseExists(): Promise<boolean> {
    const path = this.getTasksBasePath();
    return this.app.vault.getAbstractFileByPath(path) instanceof TFile;
  }

  /**
   * Check if the Calendar.base file exists
   */
  async calendarBaseExists(): Promise<boolean> {
    const path = this.getCalendarBasePath();
    return this.app.vault.getAbstractFileByPath(path) instanceof TFile;
  }

  /**
   * Generate the Tasks.base file content
   */
  private generateTasksBaseContent(): string {
    const settings = this.getSettings();
    const sourceFolder = settings.itemsFolder.replace(/\/$/, '') + '/';

    return `source: ${sourceFolder}
properties:
  note.title:
    width: 200
  note.status:
    width: 100
  note.priority:
    width: 100
  note.date_due:
    width: 120
  note.calendar:
    width: 120
views:
  - type: planner-task-list
    name: Task List
    groupBy:
      property: calendar
      direction: ASC
    order:
      - note.title
      - note.priority
      - note.status
      - note.date_due
      - note.calendar
    sort:
      - property: priority
        direction: ASC
  - type: table
    name: Table
`;
  }

  /**
   * Generate the Calendar.base file content
   */
  private generateCalendarBaseContent(): string {
    const settings = this.getSettings();
    const sourceFolder = settings.itemsFolder.replace(/\/$/, '') + '/';

    return `source: ${sourceFolder}
properties:
  note.title:
    width: 200
  note.date_start:
    width: 150
  note.date_due:
    width: 150
  note.calendar:
    width: 120
  note.status:
    width: 100
views:
  - type: planner-calendar
    name: Calendar
    order:
      - note.title
    sort: []
    colorBy: note.calendar
  - type: table
    name: Table
`;
  }

  /**
   * Ensure the bases folder exists
   */
  private async ensureBasesFolder(): Promise<void> {
    const folderPath = normalizePath(this.getSettings().basesFolder.replace(/\/$/, ''));
    const folder = this.app.vault.getAbstractFileByPath(folderPath);

    if (!folder) {
      await this.app.vault.createFolder(folderPath);
    }
  }

  /**
   * Generate the Tasks.base file
   * @param overwrite If true, overwrite existing file
   * @returns true if file was created/updated, false if skipped
   */
  async generateTasksBase(overwrite: boolean = false): Promise<boolean> {
    const path = this.getTasksBasePath();
    const exists = await this.tasksBaseExists();

    if (exists && !overwrite) {
      return false;
    }

    await this.ensureBasesFolder();

    const content = this.generateTasksBaseContent();

    if (exists) {
      const file = this.app.vault.getAbstractFileByPath(path) as TFile;
      await this.app.vault.modify(file, content);
    } else {
      await this.app.vault.create(path, content);
    }

    return true;
  }

  /**
   * Generate the Calendar.base file
   * @param overwrite If true, overwrite existing file
   * @returns true if file was created/updated, false if skipped
   */
  async generateCalendarBase(overwrite: boolean = false): Promise<boolean> {
    const path = this.getCalendarBasePath();
    const exists = await this.calendarBaseExists();

    if (exists && !overwrite) {
      return false;
    }

    await this.ensureBasesFolder();

    const content = this.generateCalendarBaseContent();

    if (exists) {
      const file = this.app.vault.getAbstractFileByPath(path) as TFile;
      await this.app.vault.modify(file, content);
    } else {
      await this.app.vault.create(path, content);
    }

    return true;
  }

  /**
   * Generate both base files
   * @param overwrite If true, overwrite existing files
   */
  async generateAllBases(overwrite: boolean = false): Promise<{ tasks: boolean; calendar: boolean }> {
    const tasks = await this.generateTasksBase(overwrite);
    const calendar = await this.generateCalendarBase(overwrite);
    return { tasks, calendar };
  }
}
