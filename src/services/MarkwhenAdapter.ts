/**
 * MarkwhenAdapter - Transforms Obsidian Bases entries to Markwhen format
 *
 * This adapter converts frontmatter data from BasesEntry objects into the
 * JSON format expected by the Markwhen Timeline component, enabling
 * bidirectional sync between Obsidian notes and the Timeline visualization.
 */

import { BasesEntry, App } from 'obsidian';
import {
  Event,
  EventGroup,
  DateRangeIso,
  ParseResult,
  RangeType,
  TimelineEvent,
  TimelineGroupBy,
  TimelineSectionsBy,
  TimelineColorBy,
  PathMapping,
  EventPath,
  Recurrence,
} from '../types/markwhen';
import type { PlannerSettings } from '../types/settings';
import type { PlannerItem, DayOfWeek } from '../types/item';

/**
 * Options for the adapter
 */
export interface AdapterOptions {
  groupBy: TimelineGroupBy;
  sectionsBy: TimelineSectionsBy;
  colorBy: TimelineColorBy;
  dateStartField: string;
  dateEndField: string;
  titleField: string;
}

/**
 * Result of adapting entries to Markwhen format
 */
export interface AdaptedResult {
  parseResult: ParseResult;
  pathMappings: PathMapping[];
  colorMap: Record<string, Record<string, string>>;
}

/**
 * Adapter class for converting BasesEntry to Markwhen format
 */
export class MarkwhenAdapter {
  private settings: PlannerSettings;
  private app: App;
  private pathMappings: PathMapping[] = [];
  private debugCount: number = 0;

  constructor(settings: PlannerSettings, app: App) {
    this.settings = settings;
    this.app = app;
  }

  /**
   * Convert an array of BasesEntry objects to Markwhen ParseResult format
   */
  adapt(entries: BasesEntry[], options: AdapterOptions): AdaptedResult {
    this.pathMappings = [];
    this.debugCount = 0;

    // Convert entries to timeline events
    const timelineEvents = this.entriesToTimelineEvents(entries, options);

    // Build event hierarchy (sections and/or groups)
    const rootGroup = this.buildEventHierarchy(timelineEvents, options);

    // Build the ParseResult structure
    const parseResult = this.buildParseResult(rootGroup);

    // Build color map based on colorBy option
    const colorMap = this.buildColorMap(entries, options.colorBy);

    return {
      parseResult,
      pathMappings: this.pathMappings,
      colorMap,
    };
  }

  /**
   * Convert BasesEntry array to TimelineEvent array
   */
  private entriesToTimelineEvents(
    entries: BasesEntry[],
    options: AdapterOptions
  ): TimelineEvent[] {
    const events: TimelineEvent[] = [];

    for (const entry of entries) {
      // Create single event (with recurrence data if applicable)
      const event = this.entryToTimelineEvent(entry, options);
      if (event) {
        events.push(event);
      }
    }

    // Sort by start date
    events.sort((a, b) => {
      const dateA = new Date(a.dateRangeIso.fromDateTimeIso).getTime();
      const dateB = new Date(b.dateRangeIso.fromDateTimeIso).getTime();
      return dateA - dateB;
    });

    return events;
  }

  /**
   * Get frontmatter from entry using Obsidian's metadata cache
   */
  private getFrontmatter(entry: BasesEntry): Record<string, any> | null {
    try {
      const cache = this.app.metadataCache.getCache(entry.file.path);
      return cache?.frontmatter || null;
    } catch {
      return null;
    }
  }

  /**
   * Extract recurrence data from a BasesEntry
   */
  private extractRecurrenceData(entry: BasesEntry, options: AdapterOptions): Partial<PlannerItem> {
    const fm = this.getFrontmatter(entry) || {};
    const startFieldName = options.dateStartField.replace(/^note\./, '');
    const endFieldName = options.dateEndField.replace(/^note\./, '');

    let dateStart = fm[startFieldName];
    let dateEnd = fm[endFieldName];

    // Fall back to Bases getValue
    if (!dateStart) {
      const basesValue = entry.getValue(options.dateStartField);
      if (basesValue !== undefined && basesValue !== null && basesValue !== '') {
        dateStart = this.parseDate(basesValue)?.toISOString();
      }
    }
    if (!dateEnd) {
      const basesValue = entry.getValue(options.dateEndField);
      if (basesValue !== undefined && basesValue !== null && basesValue !== '') {
        dateEnd = this.parseDate(basesValue)?.toISOString();
      }
    }

    // Extract recurrence fields
    const repeatFrequency = fm.repeat_frequency as string | undefined;
    const repeatInterval = fm.repeat_interval as number | undefined;
    const repeatUntil = fm.repeat_until as string | undefined;
    const repeatCount = fm.repeat_count as number | undefined;
    const repeatByday = fm.repeat_byday as DayOfWeek[] | undefined;
    const repeatBymonth = fm.repeat_bymonth as number[] | undefined;
    const repeatBymonthday = fm.repeat_bymonthday as number[] | undefined;
    const repeatBysetpos = fm.repeat_bysetpos as number | undefined;
    const repeatCompletedDates = fm.repeat_completed_dates as string[] | undefined;

    // Validate repeat_frequency
    const validFrequencies = ['daily', 'weekly', 'monthly', 'yearly'];
    const validatedFrequency = typeof repeatFrequency === 'string' && validFrequencies.includes(repeatFrequency)
      ? repeatFrequency as PlannerItem['repeat_frequency']
      : undefined;

    // Validate bysetpos
    const validatedBysetpos = typeof repeatBysetpos === 'number' && repeatBysetpos !== 0 &&
                              repeatBysetpos >= -366 && repeatBysetpos <= 366
      ? repeatBysetpos
      : undefined;

    return {
      path: entry.file.path,
      date_start_scheduled: dateStart ? (typeof dateStart === 'string' ? dateStart : this.parseDate(dateStart)?.toISOString()) : undefined,
      date_end_scheduled: dateEnd ? (typeof dateEnd === 'string' ? dateEnd : this.parseDate(dateEnd)?.toISOString()) : undefined,
      repeat_frequency: validatedFrequency,
      repeat_interval: typeof repeatInterval === 'number' ? repeatInterval : undefined,
      repeat_until: repeatUntil,
      repeat_count: typeof repeatCount === 'number' ? repeatCount : undefined,
      repeat_byday: Array.isArray(repeatByday) && repeatByday.length > 0 ? repeatByday : undefined,
      repeat_bymonth: Array.isArray(repeatBymonth) && repeatBymonth.length > 0 ? repeatBymonth : undefined,
      repeat_bymonthday: Array.isArray(repeatBymonthday) && repeatBymonthday.length > 0 ? repeatBymonthday : undefined,
      repeat_bysetpos: validatedBysetpos,
      repeat_completed_dates: Array.isArray(repeatCompletedDates) ? repeatCompletedDates : undefined,
    };
  }

  /**
   * Build a Markwhen Recurrence object from item data
   * This format is used by Markwhen's timeline to display multiple occurrences on a single row
   */
  private buildRecurrence(item: Partial<PlannerItem>): Recurrence | undefined {
    if (!item.repeat_frequency) {
      return undefined;
    }

    // Map frequency to RRule.Frequency numeric values
    const freqMap: Record<string, number> = {
      yearly: 0,   // RRule.YEARLY
      monthly: 1,  // RRule.MONTHLY
      weekly: 2,   // RRule.WEEKLY
      daily: 3,    // RRule.DAILY
    };

    const recurrence: Recurrence = {
      freq: freqMap[item.repeat_frequency],
    };

    if (item.repeat_interval && item.repeat_interval > 1) {
      recurrence.interval = item.repeat_interval;
    }

    if (item.repeat_count) {
      recurrence.count = item.repeat_count;
    }

    if (item.repeat_until) {
      recurrence.until = item.repeat_until;
    }

    if (item.repeat_byday?.length) {
      recurrence.byweekday = item.repeat_byday;
    }

    if (item.repeat_bymonth?.length) {
      recurrence.bymonth = item.repeat_bymonth;
    }

    if (item.repeat_bymonthday?.length) {
      recurrence.bymonthday = item.repeat_bymonthday;
    }

    if (item.repeat_bysetpos !== undefined && item.repeat_bysetpos !== 0) {
      recurrence.bysetpos = item.repeat_bysetpos;
    }

    // Set dtstart from the item's start date
    if (item.date_start_scheduled) {
      recurrence.dtstart = item.date_start_scheduled;
    }

    return recurrence;
  }

  /**
   * Convert a single BasesEntry to a TimelineEvent
   */
  private entryToTimelineEvent(
    entry: BasesEntry,
    options: AdapterOptions
  ): TimelineEvent | null {
    const filePath = entry.file.path;

    // Get dates from configured fields
    const startFieldName = options.dateStartField.replace(/^note\./, '');
    const endFieldName = options.dateEndField.replace(/^note\./, '');
    const titleFieldName = options.titleField.replace(/^note\./, '');

    const startValue = entry.getValue(options.dateStartField);
    const endValue = entry.getValue(options.dateEndField);
    const titleValue = entry.getValue(options.titleField);

    // Debug: Log first few entries
    if (this.debugCount < 3) {
      console.log('Timeline Adapter: Entry', filePath);
      console.log('  dateStartField:', options.dateStartField);
      console.log('  startValue type:', typeof startValue);
      if (startValue && typeof startValue === 'object') {
        console.log('  startValue keys:', Object.keys(startValue));
        console.log('  startValue.ts:', (startValue as any).ts);
        console.log('  startValue.toISO?:', typeof (startValue as any).toISO === 'function' ? (startValue as any).toISO() : 'N/A');
        console.log('  startValue.toString():', startValue.toString());
        console.log('  startValue.valueOf():', startValue.valueOf());
      } else {
        console.log('  startValue:', startValue);
      }
      this.debugCount++;
    }

    // Parse start date - skip if no valid date
    const startDate = this.parseDate(startValue);
    if (!startDate) {
      return null;
    }

    // Parse end date - default to start date if not set
    const endDate = this.parseDate(endValue) || startDate;

    // Get title
    const title = titleValue?.toString() || entry.file.basename;

    // Get tags from note
    const tagsValue = entry.getValue('note.tags');
    const noteTags: string[] = Array.isArray(tagsValue)
      ? tagsValue.map(t => String(t).replace(/^#/, ''))
      : [];

    // Get progress
    const progressValue = entry.getValue('note.progress');
    const percent = typeof progressValue === 'number' ? progressValue : undefined;

    // Get status for completion check
    const statusValue = entry.getValue('note.status');
    const completed = this.isCompletedStatus(String(statusValue || ''));

    // Get section and group values
    const sectionValue = this.getSectionValue(entry, options.sectionsBy);
    const groupValue = this.getGroupValue(entry, options.groupBy);

    // Build properties object
    const properties: Record<string, unknown> = {};
    const calendarValue = entry.getValue('note.calendar');
    if (calendarValue) {
      properties.calendar = Array.isArray(calendarValue) ? calendarValue[0] : calendarValue;
    }
    const priorityValue = entry.getValue('note.priority');
    if (priorityValue) {
      properties.priority = priorityValue;
    }
    const statusVal = entry.getValue('note.status');
    if (statusVal) {
      properties.status = statusVal;
    }

    // Build recurrence data if this is a recurring event
    const itemData = this.extractRecurrenceData(entry, options);
    const recurrence = this.buildRecurrence(itemData);

    // Add color tag based on colorBy setting
    // The Timeline uses tags[0] to look up colors in the colorMap
    const colorTag = this.getColorTag(entry, options.colorBy);
    const tags = colorTag ? [colorTag, ...noteTags] : noteTags;

    return {
      id: filePath,
      filePath,
      title,
      dateRangeIso: {
        fromDateTimeIso: startDate.toISOString(),
        toDateTimeIso: endDate.toISOString(),
      },
      tags,
      percent,
      completed,
      properties,
      sectionValue,
      groupValue,
      recurrence,
    };
  }

  /**
   * Parse a date value from frontmatter
   * Handles Date instances, strings, numbers, and Bases date objects
   * that have toString() returning ISO date strings
   */
  private parseDate(value: unknown): Date | null {
    if (!value) return null;

    if (value instanceof Date) {
      return value;
    }

    if (typeof value === 'string') {
      const date = new Date(value);
      return isNaN(date.getTime()) ? null : date;
    }

    if (typeof value === 'number') {
      return new Date(value);
    }

    // Handle Bases date objects that have toString() returning ISO strings
    if (typeof value === 'object' && value !== null) {
      const str = value.toString();
      if (str && str !== '[object Object]') {
        const date = new Date(str);
        return isNaN(date.getTime()) ? null : date;
      }
    }

    return null;
  }

  /**
   * Check if a status is considered completed
   */
  private isCompletedStatus(status: string): boolean {
    const completedStatuses = this.settings.statuses
      .filter(s => s.isCompleted)
      .map(s => s.name.toLowerCase());
    return completedStatuses.includes(status.toLowerCase());
  }

  /**
   * Get the value to section by for an entry
   */
  private getSectionValue(entry: BasesEntry, sectionsBy: TimelineSectionsBy): string | undefined {
    if (sectionsBy === 'none') return undefined;

    if (sectionsBy === 'folder') {
      // Get the parent folder path
      const folderPath = entry.file.parent?.path || '/';
      return folderPath === '/' ? 'Root' : entry.file.parent?.name || 'Root';
    }

    const fieldMap: Record<Exclude<TimelineSectionsBy, 'none' | 'folder'>, string> = {
      calendar: 'note.calendar',
      status: 'note.status',
      priority: 'note.priority',
    };

    const field = fieldMap[sectionsBy as Exclude<TimelineSectionsBy, 'none' | 'folder'>];
    if (!field) return undefined;

    const value = entry.getValue(field);
    if (!value) return 'Unsectioned';

    if (Array.isArray(value)) {
      return value[0]?.toString() || 'Unsectioned';
    }

    return value.toString();
  }

  /**
   * Get the value to group by for an entry
   */
  private getGroupValue(entry: BasesEntry, groupBy: TimelineGroupBy): string | undefined {
    if (groupBy === 'none') return undefined;

    const fieldMap: Record<TimelineGroupBy, string> = {
      none: '',
      calendar: 'note.calendar',
      status: 'note.status',
      parent: 'note.parent',
      people: 'note.people',
      priority: 'note.priority',
    };

    const field = fieldMap[groupBy];
    if (!field) return undefined;

    const value = entry.getValue(field);
    if (!value) return 'Ungrouped';

    if (Array.isArray(value)) {
      return value[0]?.toString() || 'Ungrouped';
    }

    return value.toString();
  }

  /**
   * Get the tag to use for coloring based on colorBy setting
   * The Timeline looks for tags[0] in the colorMap to determine event color
   */
  private getColorTag(entry: BasesEntry, colorBy: TimelineColorBy): string | undefined {
    const value = entry.getValue(colorBy);
    if (!value) return undefined;

    if (Array.isArray(value)) {
      return value[0]?.toString();
    }

    return value.toString();
  }

  /**
   * Build event hierarchy with sections and/or groups
   */
  private buildEventHierarchy(
    events: TimelineEvent[],
    options: AdapterOptions
  ): EventGroup {
    const rootGroup: EventGroup = {
      textRanges: {
        whole: { from: 0, to: 0, type: RangeType.Section },
        definition: { from: 0, to: 0, type: RangeType.SectionDefinition },
      },
      properties: {},
      propOrder: [],
      tags: [],
      title: 'Timeline',
      children: [],
    };

    if (options.sectionsBy === 'none') {
      // No sections - just build groups
      this.buildGroupsIntoContainer(rootGroup, events, options.groupBy, []);
    } else {
      // Build sections, then groups within each section
      const sections = new Map<string, TimelineEvent[]>();

      for (const event of events) {
        const sectionValue = event.sectionValue || 'Unsectioned';
        if (!sections.has(sectionValue)) {
          sections.set(sectionValue, []);
        }
        sections.get(sectionValue)!.push(event);
      }

      // Sort sections alphabetically
      const sortedSectionNames = Array.from(sections.keys()).sort();

      let sectionIndex = 0;
      for (const sectionName of sortedSectionNames) {
        const sectionEvents = sections.get(sectionName)!;
        const section = this.createSection(sectionName, sectionEvents, options.groupBy, [sectionIndex]);
        rootGroup.children.push(section);
        sectionIndex++;
      }
    }

    return rootGroup;
  }

  /**
   * Build groups into a container (root or section)
   */
  private buildGroupsIntoContainer(
    container: EventGroup,
    events: TimelineEvent[],
    groupBy: TimelineGroupBy,
    pathPrefix: number[]
  ): void {
    if (groupBy === 'none') {
      // No grouping - add all events directly
      let eventIndex = 0;
      for (const event of events) {
        const mwEvent = this.timelineEventToMarkwhenEvent(event);
        container.children.push(mwEvent);
        this.pathMappings.push({
          path: [...pathPrefix, eventIndex],
          filePath: event.filePath,
        });
        eventIndex++;
      }
    } else {
      // Group events by the specified field
      const groups = new Map<string, TimelineEvent[]>();

      for (const event of events) {
        const groupValue = event.groupValue || 'Ungrouped';
        if (!groups.has(groupValue)) {
          groups.set(groupValue, []);
        }
        groups.get(groupValue)!.push(event);
      }

      // Sort groups alphabetically
      const sortedGroupNames = Array.from(groups.keys()).sort();

      let groupIndex = 0;
      for (const groupName of sortedGroupNames) {
        const groupEvents = groups.get(groupName)!;
        const eventGroup = this.createEventGroup(groupName, groupEvents, [...pathPrefix, groupIndex]);
        container.children.push(eventGroup);
        groupIndex++;
      }
    }
  }

  /**
   * Create a Section from a section name and events
   * Sections can contain groups
   */
  private createSection(
    name: string,
    events: TimelineEvent[],
    groupBy: TimelineGroupBy,
    pathPrefix: number[]
  ): EventGroup {
    // Add the section name as a tag so the section header gets colored
    const tags = name !== 'Unsectioned' ? [name] : [];

    const section: EventGroup = {
      textRanges: {
        whole: { from: 0, to: 0, type: RangeType.Section },
        definition: { from: 0, to: 0, type: RangeType.SectionDefinition },
      },
      properties: {},
      propOrder: [],
      tags,
      title: name,
      startExpanded: true,
      style: 'section', // Mark as section (spans full timeline width)
      children: [],
    };

    // Build groups within this section
    this.buildGroupsIntoContainer(section, events, groupBy, pathPrefix);

    return section;
  }

  /**
   * Create an EventGroup from a group name and events
   */
  private createEventGroup(
    name: string,
    events: TimelineEvent[],
    pathPrefix: number[]
  ): EventGroup {
    // Add the group name as a tag so the group header gets colored
    const tags = name !== 'Ungrouped' ? [name] : [];

    const group: EventGroup = {
      textRanges: {
        whole: { from: 0, to: 0, type: RangeType.Section },
        definition: { from: 0, to: 0, type: RangeType.SectionDefinition },
      },
      properties: {},
      propOrder: [],
      tags,
      title: name,
      startExpanded: true,
      style: 'group', // Mark as group (contained within timeline)
      children: [],
    };

    let eventIndex = 0;
    for (const event of events) {
      const mwEvent = this.timelineEventToMarkwhenEvent(event);
      group.children.push(mwEvent);
      this.pathMappings.push({
        path: [...pathPrefix, eventIndex],
        filePath: event.filePath,
      });
      eventIndex++;
    }

    return group;
  }

  /**
   * Convert a TimelineEvent to a Markwhen Event
   */
  private timelineEventToMarkwhenEvent(event: TimelineEvent): Event {
    const datePart = event.dateRangeIso.fromDateTimeIso.split('T')[0];

    // Create a minimal Event object that Markwhen Timeline can render
    const mwEvent: Event = {
      firstLine: {
        full: `${datePart}: ${event.title}`,
        datePart,
        rest: event.title,
        restTrimmed: event.title,
      },
      textRanges: {
        whole: { from: 0, to: 0, type: RangeType.Event },
        datePart: { from: 0, to: datePart.length, type: RangeType.DateRange },
        definition: { from: 0, to: 0, type: RangeType.EventDefinition },
      },
      properties: event.properties,
      propOrder: Object.keys(event.properties),
      dateRangeIso: event.dateRangeIso,
      tags: event.tags,
      supplemental: [],
      matchedListItems: [],
      isRelative: false,
      id: event.id,
      percent: event.percent,
      completed: event.completed,
      recurrence: event.recurrence,
    };

    return mwEvent;
  }

  /**
   * Build the full ParseResult structure
   */
  private buildParseResult(rootGroup: EventGroup): ParseResult {
    return {
      ranges: [],
      foldables: {},
      events: rootGroup,
      header: {},
      ids: {},
      parseMessages: [],
      documentMessages: [],
      parser: {
        version: '0.16.0',
        incremental: false,
      },
    };
  }

  /**
   * Build color map for events based on colorBy setting
   * Returns a nested map: { "default": { "tagName": "r, g, b" } }
   */
  private buildColorMap(
    entries: BasesEntry[],
    colorBy: TimelineColorBy
  ): Record<string, Record<string, string>> {
    const innerMap: Record<string, string> = {};
    const fieldName = colorBy.replace(/^note\./, '');

    if (fieldName === 'calendar') {
      // Use calendar colors from settings
      for (const [name, config] of Object.entries(this.settings.calendars)) {
        innerMap[name] = this.hexToRgb(config.color);
      }
    } else if (fieldName === 'priority') {
      // Use priority colors from settings
      for (const priority of this.settings.priorities) {
        innerMap[priority.name] = this.hexToRgb(priority.color);
      }
    } else if (fieldName === 'status') {
      // Use status colors from settings
      for (const status of this.settings.statuses) {
        innerMap[status.name] = this.hexToRgb(status.color);
      }
    }

    // Timeline expects colorMap["default"][tagName] = "r, g, b"
    return { default: innerMap };
  }

  /**
   * Convert hex color to RGB string format expected by Timeline
   * e.g., "#ff0000" -> "255, 0, 0"
   */
  private hexToRgb(hex: string): string {
    // Remove # if present
    hex = hex.replace('#', '');

    // Handle shorthand hex (e.g., #f00)
    const isShortHex = hex.length === 3;

    const r = parseInt(
      isShortHex ? hex.slice(0, 1).repeat(2) : hex.slice(0, 2),
      16
    );
    const g = parseInt(
      isShortHex ? hex.slice(1, 2).repeat(2) : hex.slice(2, 4),
      16
    );
    const b = parseInt(
      isShortHex ? hex.slice(2, 3).repeat(2) : hex.slice(4, 6),
      16
    );

    // Return RGB string in format "r, g, b"
    return `${r}, ${g}, ${b}`;
  }

  /**
   * Resolve an event path back to a file path
   */
  resolvePathToFilePath(path: EventPath): string | null {
    const pathKey = path.join(',');
    for (const mapping of this.pathMappings) {
      if (mapping.path.join(',') === pathKey) {
        return mapping.filePath;
      }
    }
    return null;
  }

  /**
   * Get current path mappings
   */
  getPathMappings(): PathMapping[] {
    return [...this.pathMappings];
  }
}
