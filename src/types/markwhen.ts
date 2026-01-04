/**
 * Markwhen types for Timeline View integration
 * These types are based on @markwhen/parser and @markwhen/view-client
 * but simplified for our use case where we generate data from frontmatter
 */

// Re-export types we use directly from the packages
export type {
  Event,
  EventGroup,
  Eventy,
  DateRangeIso,
  DateTimeGranularity,
  DateFormat,
  ParseResult,
  Path,
  Range,
  MarkdownBlock,
} from '@markwhen/parser';

// Re-export enums as values (not types)
export { RangeType, BlockType } from '@markwhen/parser';

export type {
  AppState,
  MarkwhenState,
  DisplayScale,
} from '@markwhen/view-client';

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
}

/**
 * Path mapping for resolving event paths back to file paths
 */
export interface PathMapping {
  path: EventPath;
  filePath: string;
}
