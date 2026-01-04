/**
 * MarkwhenAdapter - Transforms Obsidian Bases entries to Markwhen format
 *
 * This adapter converts frontmatter data from BasesEntry objects into the
 * JSON format expected by the Markwhen Timeline component, enabling
 * bidirectional sync between Obsidian notes and the Timeline visualization.
 */

import { BasesEntry } from 'obsidian';
import {
  Event,
  EventGroup,
  DateRangeIso,
  ParseResult,
  RangeType,
  TimelineEvent,
  TimelineGroupBy,
  TimelineColorBy,
  PathMapping,
  EventPath,
} from '../types/markwhen';
import type { PlannerSettings } from '../types/settings';

/**
 * Options for the adapter
 */
export interface AdapterOptions {
  groupBy: TimelineGroupBy;
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
  private pathMappings: PathMapping[] = [];
  private debugCount: number = 0;

  constructor(settings: PlannerSettings) {
    this.settings = settings;
  }

  /**
   * Convert an array of BasesEntry objects to Markwhen ParseResult format
   */
  adapt(entries: BasesEntry[], options: AdapterOptions): AdaptedResult {
    this.pathMappings = [];
    this.debugCount = 0;

    // Convert entries to timeline events
    const timelineEvents = this.entriesToTimelineEvents(entries, options);

    // Group events if needed
    const rootGroup = this.buildEventGroups(timelineEvents, options.groupBy);

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

    // Get tags
    const tagsValue = entry.getValue('note.tags');
    const tags: string[] = Array.isArray(tagsValue)
      ? tagsValue.map(t => String(t).replace(/^#/, ''))
      : [];

    // Get progress
    const progressValue = entry.getValue('note.progress');
    const percent = typeof progressValue === 'number' ? progressValue : undefined;

    // Get status for completion check
    const statusValue = entry.getValue('note.status');
    const completed = this.isCompletedStatus(String(statusValue || ''));

    // Get group value
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
      groupValue,
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
   * Build event groups from timeline events
   */
  private buildEventGroups(
    events: TimelineEvent[],
    groupBy: TimelineGroupBy
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

    if (groupBy === 'none') {
      // No grouping - add all events directly
      let pathIndex = 0;
      for (const event of events) {
        const mwEvent = this.timelineEventToMarkwhenEvent(event);
        rootGroup.children.push(mwEvent);
        this.pathMappings.push({
          path: [pathIndex],
          filePath: event.filePath,
        });
        pathIndex++;
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
        const eventGroup = this.createEventGroup(groupName, groupEvents, groupIndex);
        rootGroup.children.push(eventGroup);
        groupIndex++;
      }
    }

    return rootGroup;
  }

  /**
   * Create an EventGroup from a group name and events
   */
  private createEventGroup(
    name: string,
    events: TimelineEvent[],
    groupIndex: number
  ): EventGroup {
    const group: EventGroup = {
      textRanges: {
        whole: { from: 0, to: 0, type: RangeType.Section },
        definition: { from: 0, to: 0, type: RangeType.SectionDefinition },
      },
      properties: {},
      propOrder: [],
      tags: [],
      title: name,
      startExpanded: true,
      children: [],
    };

    let eventIndex = 0;
    for (const event of events) {
      const mwEvent = this.timelineEventToMarkwhenEvent(event);
      group.children.push(mwEvent);
      this.pathMappings.push({
        path: [groupIndex, eventIndex],
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
   */
  private buildColorMap(
    entries: BasesEntry[],
    colorBy: TimelineColorBy
  ): Record<string, Record<string, string>> {
    const colorMap: Record<string, Record<string, string>> = {};

    const fieldName = colorBy.replace(/^note\./, '');

    if (fieldName === 'calendar') {
      // Use calendar colors from settings
      for (const [name, color] of Object.entries(this.settings.calendarColors)) {
        colorMap[name] = { color };
      }
    } else if (fieldName === 'priority') {
      // Use priority colors from settings
      for (const priority of this.settings.priorities) {
        colorMap[priority.name] = { color: priority.color };
      }
    } else if (fieldName === 'status') {
      // Use status colors from settings
      for (const status of this.settings.statuses) {
        colorMap[status.name] = { color: status.color };
      }
    }

    return colorMap;
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
