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
   * Get the path to the Task List.base file
   */
  getTasksBasePath(): string {
    const folder = this.getSettings().basesFolder.replace(/\/$/, '');
    return normalizePath(`${folder}/Task List.base`);
  }

  /**
   * Get the path to the Calendar.base file
   */
  getCalendarBasePath(): string {
    const folder = this.getSettings().basesFolder.replace(/\/$/, '');
    return normalizePath(`${folder}/Calendar.base`);
  }

  /**
   * Get the path to the Timeline.base file
   */
  getTimelineBasePath(): string {
    const folder = this.getSettings().basesFolder.replace(/\/$/, '');
    return normalizePath(`${folder}/Timeline.base`);
  }

  /**
   * Get the path to the Kanban.base file
   */
  getKanbanBasePath(): string {
    const folder = this.getSettings().basesFolder.replace(/\/$/, '');
    return normalizePath(`${folder}/Kanban.base`);
  }

  /**
   * Check if the Task List.base file exists
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
   * Check if the Timeline.base file exists
   */
  async timelineBaseExists(): Promise<boolean> {
    const path = this.getTimelineBasePath();
    return this.app.vault.getAbstractFileByPath(path) instanceof TFile;
  }

  /**
   * Check if the Kanban.base file exists
   */
  async kanbanBaseExists(): Promise<boolean> {
    const path = this.getKanbanBasePath();
    return this.app.vault.getAbstractFileByPath(path) instanceof TFile;
  }

  /**
   * Generate the Task List.base file content
   */
  private generateTasksBaseContent(): string {
    const settings = this.getSettings();
    const sourceFolder = settings.itemsFolder.replace(/\/$/, '') + '/';

    return `source: ${sourceFolder}
properties:
  # Text/Title properties
  note.title:
    width: 200
  note.summary:
    width: 200
  file.basename:
    width: 150
  # Categorical properties
  note.status:
    width: 100
  note.priority:
    width: 100
  note.calendar:
    width: 120
  note.parent:
    width: 120
  note.people:
    width: 120
  note.tags:
    width: 120
  note.context:
    width: 100
  note.location:
    width: 120
  note.color:
    width: 80
  # Date properties
  note.date_start_scheduled:
    width: 120
  note.date_start_actual:
    width: 120
  note.date_end_scheduled:
    width: 120
  note.date_end_actual:
    width: 120
  note.date_created:
    width: 120
  note.date_modified:
    width: 120
  note.date_due:
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
  # Text/Title properties
  note.title:
    width: 200
  note.summary:
    width: 200
  file.basename:
    width: 150
  # Categorical properties
  note.status:
    width: 100
  note.priority:
    width: 100
  note.calendar:
    width: 120
  note.parent:
    width: 120
  note.people:
    width: 120
  note.tags:
    width: 120
  note.context:
    width: 100
  note.location:
    width: 120
  note.color:
    width: 80
  # Date properties
  note.date_start_scheduled:
    width: 120
  note.date_start_actual:
    width: 120
  note.date_end_scheduled:
    width: 120
  note.date_end_actual:
    width: 120
  note.date_created:
    width: 120
  note.date_modified:
    width: 120
  note.date_due:
    width: 120
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
   * Generate the Timeline.base file content
   */
  private generateTimelineBaseContent(): string {
    const settings = this.getSettings();
    const sourceFolder = settings.itemsFolder.replace(/\/$/, '') + '/';

    return `source: ${sourceFolder}
properties:
  # Text/Title properties
  note.title:
    width: 250
  note.summary:
    width: 200
  file.basename:
    width: 150
  # Categorical properties
  note.status:
    width: 100
  note.priority:
    width: 100
  note.calendar:
    width: 120
  note.parent:
    width: 120
  note.people:
    width: 120
  note.tags:
    width: 120
  note.context:
    width: 100
  note.location:
    width: 120
  note.color:
    width: 80
  note.progress:
    width: 80
  # Date properties
  note.date_start_scheduled:
    width: 120
  note.date_start_actual:
    width: 120
  note.date_end_scheduled:
    width: 120
  note.date_end_actual:
    width: 120
  note.date_created:
    width: 120
  note.date_modified:
    width: 120
  note.date_due:
    width: 120
views:
  - type: planner-timeline
    name: Timeline
    order:
      - note.title
      - note.date_start_scheduled
      - note.date_end_scheduled
    sort:
      - property: date_start_scheduled
        direction: ASC
    groupBy:
      property: calendar
      direction: ASC
    colorBy: note.calendar
  - type: table
    name: Table
`;
  }

  /**
   * Generate the Kanban.base file content
   */
  private generateKanbanBaseContent(): string {
    const settings = this.getSettings();
    const sourceFolder = settings.itemsFolder.replace(/\/$/, '') + '/';

    return `source: ${sourceFolder}
properties:
  # Text/Title properties
  note.title:
    width: 200
  note.summary:
    width: 200
  file.basename:
    width: 150
  # Categorical properties
  note.status:
    width: 100
  note.priority:
    width: 100
  note.calendar:
    width: 120
  note.parent:
    width: 120
  note.people:
    width: 120
  note.tags:
    width: 120
  note.context:
    width: 100
  note.cover:
    width: 200
  # Date properties
  note.date_start_scheduled:
    width: 120
  note.date_end_scheduled:
    width: 120
  note.date_due:
    width: 120
views:
  - type: planner-kanban
    name: Kanban
    order:
      - note.title
      - note.status
      - note.priority
      - note.calendar
      - note.date_start_scheduled
    groupBy:
      property: status
      direction: ASC
    colorBy: note.calendar
    borderStyle: left-accent
    badgePlacement: properties-section
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
   * Generate the Task List.base file
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
   * Generate the Timeline.base file
   * @param overwrite If true, overwrite existing file
   * @returns true if file was created/updated, false if skipped
   */
  async generateTimelineBase(overwrite: boolean = false): Promise<boolean> {
    const path = this.getTimelineBasePath();
    const exists = await this.timelineBaseExists();

    if (exists && !overwrite) {
      return false;
    }

    await this.ensureBasesFolder();

    const content = this.generateTimelineBaseContent();

    if (exists) {
      const file = this.app.vault.getAbstractFileByPath(path) as TFile;
      await this.app.vault.modify(file, content);
    } else {
      await this.app.vault.create(path, content);
    }

    return true;
  }

  /**
   * Generate the Kanban.base file
   * @param overwrite If true, overwrite existing file
   * @returns true if file was created/updated, false if skipped
   */
  async generateKanbanBase(overwrite: boolean = false): Promise<boolean> {
    const path = this.getKanbanBasePath();
    const exists = await this.kanbanBaseExists();

    if (exists && !overwrite) {
      return false;
    }

    await this.ensureBasesFolder();

    const content = this.generateKanbanBaseContent();

    if (exists) {
      const file = this.app.vault.getAbstractFileByPath(path) as TFile;
      await this.app.vault.modify(file, content);
    } else {
      await this.app.vault.create(path, content);
    }

    return true;
  }

  /**
   * Generate all base files
   * @param overwrite If true, overwrite existing files
   */
  async generateAllBases(overwrite: boolean = false): Promise<{ tasks: boolean; calendar: boolean; timeline: boolean; kanban: boolean }> {
    const tasks = await this.generateTasksBase(overwrite);
    const calendar = await this.generateCalendarBase(overwrite);
    const timeline = await this.generateTimelineBase(overwrite);
    const kanban = await this.generateKanbanBase(overwrite);
    return { tasks, calendar, timeline, kanban };
  }
}
