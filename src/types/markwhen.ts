/**
 * Markwhen types for Timeline View integration
 * These types are defined locally to avoid loading heavy dependencies on mobile
 * Based on @markwhen/parser and @markwhen/view-client
 */

// Define enums locally to avoid importing the full @markwhen/parser package
export enum RangeType {
  Comment = "comment",
  CheckboxItemIndicator = "checkboxItemIndicator",
  listItemIndicator = "listItemIndicator",
  ListItemContents = "listItemContents",
  Tag = "tag",
  tagDefinition = "tagDefinition",
  Title = "title",
  View = "view",
  Viewer = "viewer",
  Description = "description",
  Section = "section",
  DateRange = "dateRange",
  DateRangeColon = "dateRangeColon",
  Event = "event",
  Edit = "edit",
  Editor = "editor",
  Recurrence = "recurrence",
  FrontmatterDelimiter = "frontMatterDelimiter",
  HeaderKey = "headerKey",
  HeaderKeyColon = "headerKeyColon",
  HeaderValue = "headerValue",
  PropertyKey = "propertyKey",
  PropertyKeyColon = "propertyKeyColon",
  PropertyValue = "propertyValue",
  EventDefinition = "eventDefinition",
  SectionDefinition = "sectionDefinition",
  Properties = "properties",
}

export enum BlockType {
  TEXT = "text",
  LIST_ITEM = "listItem",
  CHECKBOX = "checkbox",
  IMAGE = "image",
}

// Define types locally - simplified versions of @markwhen/parser types
export interface DateRangeIso {
  fromDateTimeIso: string;
  toDateTimeIso: string;
}

export interface Range {
  from: number;
  to: number;
  type: RangeType;
}

export interface EventFirstLine {
  full: string;
  datePart: string;
  rest: string;
  restTrimmed: string;
}

/**
 * Recurrence type - matches @markwhen/parser's Recurrence type
 * Based on RRule Options with string dates instead of JS Dates
 */
export interface Recurrence {
  freq?: number;        // RRule.Frequency: YEARLY=0, MONTHLY=1, WEEKLY=2, DAILY=3
  interval?: number;    // Interval between occurrences
  count?: number;       // Number of occurrences
  until?: string;       // ISO date string for end date
  byweekday?: string[]; // Days of week: ['MO', 'TU', 'WE', etc.] - RRule uses byweekday not byday
  bymonth?: number[];   // Months: [1, 2, 3, etc.]
  bymonthday?: number[]; // Days of month: [1, 15, -1, etc.]
  bysetpos?: number;    // Position in set: -1 for last, 1 for first, etc.
  dtstart?: string;     // Start date in ISO format
}

export interface Event {
  firstLine: EventFirstLine;
  textRanges: {
    whole: Range;
    datePart: Range;
    definition: Range;
    recurrence?: Range;
    properties?: Range;
  };
  properties: Record<string, unknown>;
  propOrder: string[];
  dateRangeIso: DateRangeIso;
  tags: string[];
  supplemental: unknown[];
  matchedListItems: unknown[];
  isRelative: boolean;
  id?: string;
  percent?: number;
  completed?: boolean;
  recurrence?: Recurrence;
}

export interface EventGroup {
  textRanges: {
    whole: Range;
    definition: Range;
  };
  properties: Record<string, unknown>;
  propOrder: string[];
  tags: string[];
  title: string;
  startExpanded?: boolean;
  children: (Event | EventGroup)[];
}

export type Eventy = Event | EventGroup;

export interface ParseResult {
  ranges: Range[];
  foldables: Record<string, unknown>;
  events: EventGroup;
  header: Record<string, unknown>;
  ids: Record<string, unknown>;
  parseMessages: unknown[];
  documentMessages: unknown[];
  parser: {
    version: string;
    incremental: boolean;
  };
}

export type DateTimeGranularity = 'instant' | 'day' | 'month' | 'year';
export type DateFormat = string;
export type Path = number[];

export interface MarkdownBlock {
  type: BlockType;
  value?: unknown;
  raw: string;
}

// Define types from @markwhen/view-client locally
export interface AppState {
  isDark?: boolean;
  hoveringPath?: number[];
  detailPath?: number[];
  path?: string;
  colorMap: Record<string, Record<string, string>>;
}

export interface MarkwhenState {
  rawText?: string;
  parsed: ParseResult;
  transformed?: EventGroup;
}

export type DisplayScale = 'second' | 'minute' | 'hour' | 'day' | 'month' | 'year';

/**
 * Event path - array of indices representing position in the event tree
 * e.g., [0, 2, 1] = first group → third child → second sub-child
 */
export type EventPath = number[];

/**
 * Message types for LPC (Local Procedure Call) communication
 * These are the messages exchanged between the host (our view) and the Timeline iframe
 */
export interface LpcMessage<T = unknown> {
  type: string;
  request?: boolean;
  response?: boolean;
  id: string;
  params?: T;
}

/**
 * Messages sent FROM Timeline TO Host
 */
export interface EditEventDateRangeMessage {
  path: EventPath;
  range: DateRangeIso;
  scale: DisplayScale;
  preferredInterpolationFormat: DateFormat | undefined;
}

export interface NewEventMessage {
  dateRangeIso: DateRangeIso;
  granularity?: DateTimeGranularity;
  immediate: boolean;
}

export interface SetPathMessage {
  path: EventPath;
}

/**
 * Configuration options for the Timeline View
 */
export type TimelineGroupBy =
  | 'none'
  | 'calendar'
  | 'status'
  | 'parent'
  | 'people'
  | 'priority';

export type TimelineColorBy =
  | 'note.calendar'
  | 'note.priority'
  | 'note.status';

export interface TimelineViewConfig {
  groupBy: TimelineGroupBy;
  colorBy: TimelineColorBy;
  dateStartField: string;
  dateEndField: string;
  titleField: string;
}

/**
 * Extended event with file path for reverse lookup
 */
export interface TimelineEvent {
  id: string;           // File path for reverse lookup
  filePath: string;     // Explicit file path
  title: string;
  dateRangeIso: DateRangeIso;
  tags: string[];
  percent?: number;
  completed?: boolean;
  properties: Record<string, unknown>;
  groupValue?: string;  // Value of the groupBy field
  recurrence?: Recurrence; // Recurrence data for recurring events
}

/**
 * Path mapping for resolving event paths back to file paths
 */
export interface PathMapping {
  path: EventPath;
  filePath: string;
}
