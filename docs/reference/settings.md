# Settings Reference

Complete reference for Planner plugin settings.

## General

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `itemsFolder` | string | `"Planner"` | Default folder for new items |
| `defaultCalendar` | string | `""` | Pre-selected calendar for new items |

## Statuses

Array of status configurations:

```typescript
{
  name: string;      // Display name
  color: string;     // Hex color
  icon: string;      // Lucide icon name
  completed?: boolean; // Is this a "done" status?
}
```

### Default Statuses

| Name | Color | Icon | Completed |
|------|-------|------|-----------|
| To Do | #6b7280 | circle | false |
| In Progress | #3b82f6 | loader | false |
| Blocked | #f59e0b | alert-circle | false |
| Done | #22c55e | check-circle | true |
| Cancelled | #9ca3af | x-circle | true |

## Priorities

Array of priority configurations:

```typescript
{
  name: string;   // Display name
  color: string;  // Hex color
  icon: string;   // Lucide icon name
}
```

### Default Priorities

| Name | Color | Icon |
|------|-------|------|
| Urgent | #ef4444 | alert-triangle |
| High | #f97316 | chevron-up |
| Medium | #eab308 | minus |
| Low | #6b7280 | chevron-down |

## Calendars

Object mapping calendar names to configurations:

```typescript
{
  [name: string]: {
    color: string;   // Hex color
    folder?: string; // Optional folder path
  }
}
```

### Example

```json
{
  "Work": {
    "color": "#3b82f6",
    "folder": "Work/Tasks"
  },
  "Personal": {
    "color": "#22c55e",
    "folder": "Personal/Tasks"
  }
}
```

## Date & Time

| Setting | Type | Options | Default |
|---------|------|---------|---------|
| `dateFormat` | string | `YYYY-MM-DD`, `MM/DD/YYYY`, `DD/MM/YYYY`, `MMM D, YYYY` | `YYYY-MM-DD` |
| `timeFormat` | string | `12h`, `24h` | `24h` |
| `weekStartsOn` | number | `0` (Sunday), `1` (Monday) | `0` |

## Behavior

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| `openBehavior` | string | `"new-tab"` | How to open items |
| `quickCaptureOpenAfterCreate` | boolean | `false` | Open note after creating |

### Open Behavior Options

| Value | Description |
|-------|-------------|
| `same-tab` | Open in current tab |
| `new-tab` | Open in new tab |
| `split-right` | Open in vertical split |
| `split-down` | Open in horizontal split |

## Full Settings Schema

```typescript
interface PlannerSettings {
  // Folders
  itemsFolder: string;
  defaultCalendar: string;

  // Statuses
  statuses: Array<{
    name: string;
    color: string;
    icon: string;
    completed?: boolean;
  }>;

  // Priorities
  priorities: Array<{
    name: string;
    color: string;
    icon: string;
  }>;

  // Calendars
  calendars: Record<string, {
    color: string;
    folder?: string;
  }>;

  // Date & Time
  dateFormat: string;
  timeFormat: string;
  weekStartsOn: number;

  // Behavior
  openBehavior: string;
  quickCaptureOpenAfterCreate: boolean;
}
```

## Accessing Settings

Settings are stored in `.obsidian/plugins/planner/data.json`.

To reset settings, delete this file and reload Obsidian.
