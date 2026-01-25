import { App, TFile, normalizePath } from 'obsidian';
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
  tasksBaseExists(): boolean {
    const path = this.getTasksBasePath();
    return this.app.vault.getAbstractFileByPath(path) instanceof TFile;
  }

  /**
   * Check if the Calendar.base file exists
   */
  calendarBaseExists(): boolean {
    const path = this.getCalendarBasePath();
    return this.app.vault.getAbstractFileByPath(path) instanceof TFile;
  }

  /**
   * Check if the Timeline.base file exists
   */
  timelineBaseExists(): boolean {
    const path = this.getTimelineBasePath();
    return this.app.vault.getAbstractFileByPath(path) instanceof TFile;
  }

  /**
   * Check if the Kanban.base file exists
   */
  kanbanBaseExists(): boolean {
    const path = this.getKanbanBasePath();
    return this.app.vault.getAbstractFileByPath(path) instanceof TFile;
  }

  /**
   * Generate the Task List.base file content
   */
  private generateTasksBaseContent(): string {
    const settings = this.getSettings();
    const sourceFolder = settings.basesFolder.replace(/\/$/, '') + '/';
    const filters = this.generateFiltersSection();

    return `source: ${sourceFolder}
${filters}
properties:
  note.title:
    width: 200
  note.summary:
    width: 200
  file.basename:
    width: 150
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
    order:
      - title
      - calendar
      - status
      - priority
      - date_start_scheduled
      - date_end_scheduled
    sort:
      - property: date_end_scheduled
        direction: DESC
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
    const sourceFolder = settings.basesFolder.replace(/\/$/, '') + '/';
    const filters = this.generateFiltersSection();

    return `source: ${sourceFolder}
${filters}
properties:
  note.title:
    width: 200
  note.summary:
    width: 200
  file.basename:
    width: 150
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
      - title
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
    const sourceFolder = settings.basesFolder.replace(/\/$/, '') + '/';
    const filters = this.generateFiltersSection();

    return `source: ${sourceFolder}
${filters}
properties:
  note.title:
    width: 250
  note.summary:
    width: 200
  file.basename:
    width: 150
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
      - title
      - date_start_scheduled
      - date_end_scheduled
    sort: []
    colorBy: note.calendar
    sectionsBy: note.calendar
  - type: table
    name: Table
`;
  }

  /**
   * Generate the Kanban.base file content
   */
  private generateKanbanBaseContent(): string {
    const settings = this.getSettings();
    const sourceFolder = settings.basesFolder.replace(/\/$/, '') + '/';
    const filters = this.generateFiltersSection();

    return `source: ${sourceFolder}
${filters}
properties:
  note.title:
    width: 200
  note.summary:
    width: 200
  file.basename:
    width: 150
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
      - title
      - status
      - priority
      - calendar
      - tags
      - summary
      - date_end_scheduled
    sort:
      - property: date_end_scheduled
        direction: DESC
    colorBy: note.calendar
    borderStyle: left-accent
    badgePlacement: properties-section
  - type: table
    name: Table
`;
  }

  /**
   * Generate the filters section based on itemsFolder and calendar folders
   * Includes all unique folders where Planner items might exist
   */
  private generateFiltersSection(): string {
    const settings = this.getSettings();
    const itemsFolder = settings.itemsFolder.replace(/\/$/, '');

    // Collect all unique folders (itemsFolder + any custom calendar folders)
    const folders = new Set<string>();
    folders.add(itemsFolder);

    for (const calendar of settings.calendars) {
      if (calendar.folder) {
        folders.add(calendar.folder.replace(/\/$/, ''));
      }
    }

    const folderArray = Array.from(folders);

    if (folderArray.length === 1) {
      // Single folder - simple filter
      return `filters:
  and:
    - file.inFolder("${folderArray[0]}")
    - file.ext == "md"`;
    } else {
      // Multiple folders - use OR for folders
      const folderConditions = folderArray
        .map(folder => `      - file.inFolder("${folder}")`)
        .join('\n');
      return `filters:
  and:
    - or:
${folderConditions}
    - file.ext == "md"`;
    }
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
    const exists = this.tasksBaseExists();

    if (exists && !overwrite) {
      return false;
    }

    await this.ensureBasesFolder();

    const content = this.generateTasksBaseContent();

    if (exists) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        await this.app.vault.modify(file, content);
      }
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
    const exists = this.calendarBaseExists();

    if (exists && !overwrite) {
      return false;
    }

    await this.ensureBasesFolder();

    const content = this.generateCalendarBaseContent();

    if (exists) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        await this.app.vault.modify(file, content);
      }
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
    const exists = this.timelineBaseExists();

    if (exists && !overwrite) {
      return false;
    }

    await this.ensureBasesFolder();

    const content = this.generateTimelineBaseContent();

    if (exists) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        await this.app.vault.modify(file, content);
      }
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
    const exists = this.kanbanBaseExists();

    if (exists && !overwrite) {
      return false;
    }

    await this.ensureBasesFolder();

    const content = this.generateKanbanBaseContent();

    if (exists) {
      const file = this.app.vault.getAbstractFileByPath(path);
      if (file instanceof TFile) {
        await this.app.vault.modify(file, content);
      }
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
