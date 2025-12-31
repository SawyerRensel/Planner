/**
 * Planner Plugin Settings
 */
export interface PlannerSettings {
  // General
  itemsFolder: string;
  basesFolder: string;
  itemTemplate: string;
  defaultCalendar: string;
  dateFormat: string;
  timeFormat: '12h' | '24h';
  weekStartsOn: WeekDay;

  // Item Identification
  identificationMethod: 'folder' | 'tag' | 'both';
  includeFolders: string[];
  includeTags: string[];

  // Status Configuration
  statuses: StatusConfig[];

  // Priority Configuration
  priorities: PriorityConfig[];

  // Calendar Colors
  calendarColors: Record<string, string>;

  // Quick Capture
  quickCaptureHotkey: string;
  quickCaptureDefaultTags: string[];
  quickCaptureDefaultStatus: string;
  quickCaptureOpenAfterCreate: boolean;

  // Open Behavior
  openBehavior: OpenBehavior;
}

/**
 * Status configuration
 */
export interface StatusConfig {
  name: string;
  color: string;
  isCompleted: boolean;
}

/**
 * Priority configuration
 */
export interface PriorityConfig {
  name: string;
  color: string;
  weight: number;
}

/**
 * Days of the week for week start setting
 */
export type WeekDay = 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday' | 'sunday';

/**
 * How to open items and daily notes
 */
export type OpenBehavior = 'new-tab' | 'same-tab' | 'split-right' | 'split-down';

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: PlannerSettings = {
  // General
  itemsFolder: 'Planner/',
  basesFolder: 'Planner/',
  itemTemplate: '',
  defaultCalendar: 'Personal',
  dateFormat: 'YYYY-MM-DD',
  timeFormat: '24h',
  weekStartsOn: 'monday',

  // Item Identification
  identificationMethod: 'folder',
  includeFolders: ['Planner/'],
  includeTags: [],

  // Status Configuration
  statuses: [
    { name: 'Idea', color: '#a855f7', isCompleted: false },
    { name: 'To-Do', color: '#6b7280', isCompleted: false },
    { name: 'In-Progress', color: '#3b82f6', isCompleted: false },
    { name: 'In-Review', color: '#f97316', isCompleted: false },
    { name: 'Done', color: '#22c55e', isCompleted: true },
    { name: 'Cancelled', color: '#ef4444', isCompleted: true },
  ],

  // Priority Configuration
  priorities: [
    { name: 'Urgent', color: '#ef4444', weight: 4 },
    { name: 'High', color: '#f97316', weight: 3 },
    { name: 'Medium', color: '#eab308', weight: 2 },
    { name: 'Low', color: '#3b82f6', weight: 1 },
    { name: 'None', color: '#6b7280', weight: 0 },
  ],

  // Calendar Colors
  calendarColors: {
    'Personal': '#3b82f6',
    'Work': '#22c55e',
  },

  // Quick Capture
  quickCaptureHotkey: 'Ctrl+Shift+N',
  quickCaptureDefaultTags: [],
  quickCaptureDefaultStatus: 'To-Do',
  quickCaptureOpenAfterCreate: false,

  // Open Behavior
  openBehavior: 'new-tab',
};

/**
 * Get status config by name
 */
export function getStatusConfig(settings: PlannerSettings, statusName: string): StatusConfig | undefined {
  return settings.statuses.find(s => s.name === statusName);
}

/**
 * Get priority config by name
 */
export function getPriorityConfig(settings: PlannerSettings, priorityName: string): PriorityConfig | undefined {
  return settings.priorities.find(p => p.name === priorityName);
}

/**
 * Get calendar color
 */
export function getCalendarColor(settings: PlannerSettings, calendarName: string): string {
  return settings.calendarColors[calendarName] ?? '#6b7280'; // Default gray
}

/**
 * Check if a status is a completed status
 */
export function isCompletedStatus(settings: PlannerSettings, statusName: string): boolean {
  const status = getStatusConfig(settings, statusName);
  return status?.isCompleted ?? false;
}
