/**
 * Solarized accent colors for calendars
 * Order: yellow, orange, red, magenta, violet, blue, cyan, green
 */
export const SOLARIZED_ACCENT_COLORS = [
  '#b58900', // yellow
  '#cb4b16', // orange
  '#dc322f', // red
  '#d33682', // magenta
  '#6c71c4', // violet
  '#268bd2', // blue
  '#2aa198', // cyan
  '#859900', // green
] as const;

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

  // Status Configuration
  statuses: StatusConfig[];

  // Priority Configuration
  priorities: PriorityConfig[];

  // Calendar Configuration
  calendars: CalendarConfig[];
  calendarFontSize: number; // px value, range 6-18

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
  icon?: string; // Lucide icon name (e.g., 'lightbulb', 'circle', 'check-circle')
}

/**
 * Priority configuration
 */
export interface PriorityConfig {
  name: string;
  color: string;
  weight: number;
  icon?: string; // Lucide icon name (e.g., 'alert-triangle', 'arrow-up', 'minus')
}

/**
 * Calendar configuration
 */
export interface CalendarConfig {
  name: string;
  color: string;
  folder?: string; // Optional - falls back to global itemsFolder when not set
  template?: string; // Optional - falls back to global itemTemplate when not set
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

  // Status Configuration
  statuses: [
    { name: 'Idea', color: '#f7e955', isCompleted: false, icon: 'circle-dashed' },
    { name: 'To-Do', color: '#9c5ee8', isCompleted: false, icon: 'circle-dot-dashed' },
    { name: 'In-Progress', color: '#3b82f6', isCompleted: false, icon: 'circle-dot' },
    { name: 'In-Review', color: '#f97316', isCompleted: false, icon: 'eye' },
    { name: 'Done', color: '#22c55e', isCompleted: true, icon: 'circle-check-big' },
    { name: 'Cancelled', color: '#ef4444', isCompleted: true, icon: 'ban' },
  ],

  // Priority Configuration
  priorities: [
    { name: 'Urgent', color: '#ef4444', weight: 4, icon: 'signal' },
    { name: 'High', color: '#f97316', weight: 3, icon: 'signal-high' },
    { name: 'Medium', color: '#eab308', weight: 2, icon: 'signal-medium' },
    { name: 'Low', color: '#3b82f6', weight: 1, icon: 'signal-low' },
    { name: 'None', color: '#6b7280', weight: 0, icon: 'signal-zero' },
  ],

  // Calendar Configuration
  calendars: [
    { name: 'Personal', color: '#b58900' }, // Solarized yellow
    { name: 'Work', color: '#cb4b16' },     // Solarized orange
  ],
  calendarFontSize: 10, // 20% smaller than default 12px

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
 * Get calendar config by name
 */
export function getCalendarConfig(settings: PlannerSettings, calendarName: string): CalendarConfig | undefined {
  return settings.calendars.find(c => c.name === calendarName);
}

/**
 * Get calendar color
 */
export function getCalendarColor(settings: PlannerSettings, calendarName: string): string {
  return getCalendarConfig(settings, calendarName)?.color ?? '#6b7280'; // Default gray
}

/**
 * Get calendar folder (falls back to global itemsFolder if not set)
 */
export function getCalendarFolder(settings: PlannerSettings, calendarName: string): string {
  return getCalendarConfig(settings, calendarName)?.folder || settings.itemsFolder;
}

/**
 * Get calendar template (falls back to global itemTemplate if not set)
 */
export function getCalendarTemplate(settings: PlannerSettings, calendarName: string): string {
  return getCalendarConfig(settings, calendarName)?.template || settings.itemTemplate;
}

/**
 * Check if a status is a completed status
 */
export function isCompletedStatus(settings: PlannerSettings, statusName: string): boolean {
  const status = getStatusConfig(settings, statusName);
  return status?.isCompleted ?? false;
}

/**
 * Get the next Solarized accent color based on calendar index
 * Cycles through the 8 colors
 */
export function getNextCalendarColor(calendarIndex: number): string {
  return SOLARIZED_ACCENT_COLORS[calendarIndex % SOLARIZED_ACCENT_COLORS.length];
}
