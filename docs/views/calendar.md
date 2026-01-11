# Calendar View

View your tasks and events on a beautiful, interactive calendar.

## Features

- Multiple view modes (Day, Week, Month, Year)
- Drag and drop rescheduling
- Recurring event support
- Color coding by calendar, status, or priority
- Daily notes integration

## View Modes

| Mode | Description |
|------|-------------|
| **Day** | Single day with time slots |
| **3-Day** | Three days side by side |
| **Week** | Full week with time grid |
| **Month** | Monthly overview |
| **Year (Split)** | 12 months in grid layout |
| **Year (Continuous)** | Scrollable year view |
| **List** | Agenda-style list |

## Configuration

Access view options from the Bases view settings:

### Color By

Choose how events are colored:

- **Calendar** - By calendar category
- **Status** - By item status
- **Priority** - By priority level
- **Custom Property** - Any categorical field

### Date Fields

- **Start Date Field** - Property for event start
- **End Date Field** - Property for event end

### Title Field

Choose which property displays as the event title.

## Interactions

### Creating Events

- Click on a date to create a new item
- Events default to the clicked date

### Editing Events

- Click an event to open the Item Modal
- Drag events to reschedule

### Recurring Events

Events with recurrence rules show all occurrences.

!!! note "Recurrence Display"
    Completed occurrences appear grayed out.

## Keyboard Navigation

| Shortcut | Action |
|----------|--------|
| ++t++ | Go to today |
| ++arrow-left++ | Previous period |
| ++arrow-right++ | Next period |

Or use commands:

- `Planner: Calendar: Go to today`
- `Planner: Calendar: Go to next period`
- `Planner: Calendar: Go to previous period`

## Mobile Support

- Touch-friendly interface
- Swipe to navigate between dates
- Tap to create and edit events
