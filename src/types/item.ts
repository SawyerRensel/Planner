/**
 * Planner Item - The fundamental unit in Planner
 *
 * Every item is a Markdown note with structured frontmatter metadata.
 * All fields are optional. Items can be differentiated using tags (#task, #event).
 */
export interface PlannerItem {
  // File reference (not stored in frontmatter)
  path: string;

  // Identity
  title?: string;
  summary?: string;
  tags?: string[];

  // Categorization
  calendar?: string[];
  context?: string[];
  people?: string[];
  location?: string;
  related?: string[];

  // Status
  status?: string;
  priority?: string;
  progress?: number;

  // Dates (ISO 8601 format)
  date_created?: string;
  date_modified?: string;
  date_start_scheduled?: string;  // When you intend to perform the action
  date_start_actual?: string;     // When you actually started the action
  date_end_scheduled?: string;    // When you intend to complete the action
  date_end_actual?: string;       // When you actually finished the action
  all_day?: boolean;

  // Recurrence (iCal RRULE compatible)
  repeat_frequency?: RepeatFrequency;
  repeat_interval?: number;
  repeat_until?: string;
  repeat_count?: number;
  repeat_byday?: DayOfWeek[];
  repeat_bymonth?: number[];
  repeat_bymonthday?: number[];
  repeat_bysetpos?: number;
  repeat_completed_dates?: string[];

  // Hierarchy & Dependencies
  parent?: string;
  children?: string[];
  blocked_by?: string[];

  // Display
  cover?: string;
  color?: string;
}

/**
 * Frontmatter representation (what's stored in the file)
 * Same as PlannerItem but without the path field
 */
export type ItemFrontmatter = Omit<PlannerItem, 'path'>;

/**
 * Repeat frequency options
 */
export type RepeatFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';

/**
 * Days of the week (iCal format)
 */
export type DayOfWeek = 'MO' | 'TU' | 'WE' | 'TH' | 'FR' | 'SA' | 'SU';

/**
 * Computed fields (calculated at runtime, not stored)
 */
export interface ComputedItemFields {
  blocking: string[];           // Items that have this item in their blocked_by
  duration: number | null;      // date_end_scheduled - date_start_scheduled in milliseconds
  is_overdue: boolean;          // date_end_scheduled < now AND status NOT IN completed_statuses
  next_occurrence: string | null; // Next date from RRULE after today
}

/**
 * Full item with computed fields
 */
export type PlannerItemWithComputed = PlannerItem & Partial<ComputedItemFields>;

/**
 * Default frontmatter field order (for consistent YAML output)
 */
export const FRONTMATTER_FIELD_ORDER: (keyof ItemFrontmatter)[] = [
  // Identity
  'title',
  'summary',
  'tags',
  // Categorization
  'calendar',
  'context',
  'people',
  'location',
  'related',
  // Status
  'status',
  'priority',
  'progress',
  // Dates
  'date_created',
  'date_modified',
  'date_start_scheduled',
  'date_start_actual',
  'date_end_scheduled',
  'date_end_actual',
  'all_day',
  // Recurrence
  'repeat_frequency',
  'repeat_interval',
  'repeat_until',
  'repeat_count',
  'repeat_byday',
  'repeat_bymonth',
  'repeat_bymonthday',
  'repeat_bysetpos',
  'repeat_completed_dates',
  // Hierarchy & Dependencies
  'parent',
  'children',
  'blocked_by',
  // Display
  'cover',
  'color',
];

/**
 * Check if an item has task-like behavior (has #task tag)
 */
export function isTask(item: PlannerItem): boolean {
  return item.tags?.includes('task') ?? false;
}

/**
 * Check if an item is an event (has #event tag)
 */
export function isEvent(item: PlannerItem): boolean {
  return item.tags?.includes('event') ?? false;
}

/**
 * Check if an item has children (is a project/parent)
 */
export function isParent(item: PlannerItem): boolean {
  return (item.children?.length ?? 0) > 0;
}

/**
 * Check if an item is recurring
 */
export function isRecurring(item: PlannerItem): boolean {
  return item.repeat_frequency !== undefined;
}
