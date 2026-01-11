# Configuration

Customize Planner to match your workflow.

## Accessing Settings

1. Open **Settings** > **Plugin Options**
2. Click **Planner**

## Status Options

Configure the statuses available for your items:

| Setting | Description |
|---------|-------------|
| Name | Display name (e.g., "To Do", "In Progress") |
| Color | Background color for badges |
| Icon | Lucide icon name |
| Completed | Mark as a "done" status |

Default statuses:

- **To Do** - Not started
- **In Progress** - Currently working
- **Blocked** - Waiting on something
- **Done** - Completed
- **Cancelled** - No longer needed

## Priority Options

Configure priority levels:

| Setting | Description |
|---------|-------------|
| Name | Display name (e.g., "High", "Medium") |
| Color | Background color for badges |
| Icon | Lucide icon name |

Default priorities:

- **Urgent** - Needs immediate attention
- **High** - Important
- **Medium** - Normal priority
- **Low** - Can wait

## Calendar Categories

Organize items by calendar/project:

| Setting | Description |
|---------|-------------|
| Name | Calendar name |
| Color | Color for events |
| Folder | Optional folder path for items |

!!! tip "Folder Organization"
    Setting a folder for a calendar automatically files new items there.

## Date & Time

| Setting | Description |
|---------|-------------|
| Date Format | YYYY-MM-DD, MM/DD/YYYY, DD/MM/YYYY, etc. |
| Time Format | 12h or 24h |
| Week Starts On | Sunday or Monday |

## Folders

| Setting | Description |
|---------|-------------|
| Items Folder | Default folder for new items |
| Default Calendar | Pre-selected calendar for new items |

## Behavior

| Setting | Description |
|---------|-------------|
| Open Behavior | How to open items: same tab, new tab, split |
| Open After Create | Open note after creating item |

## Example Configuration

```yaml
# Status configuration
statuses:
  - name: To Do
    color: "#6b7280"
    icon: circle
  - name: In Progress
    color: "#3b82f6"
    icon: loader
  - name: Done
    color: "#22c55e"
    icon: check-circle
    completed: true

# Priority configuration
priorities:
  - name: High
    color: "#ef4444"
    icon: alert-triangle
  - name: Medium
    color: "#f59e0b"
    icon: minus
  - name: Low
    color: "#6b7280"
    icon: arrow-down

# Calendars
calendars:
  Work:
    color: "#3b82f6"
    folder: "Work/Tasks"
  Personal:
    color: "#22c55e"
    folder: "Personal/Tasks"
```
