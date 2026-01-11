# Task List View

A powerful table view for managing all your tasks.

## Features

- Sortable columns
- Grouping support
- Status and priority badges
- Progress bars
- Overdue highlighting

## Table Columns

Default columns shown:

| Column | Description |
|--------|-------------|
| Title | Item title (clickable) |
| Status | Current status badge |
| Priority | Priority badge |
| Start Date | Scheduled start |
| Due Date | Scheduled end (highlights if overdue) |
| Calendar | Calendar/project badge |

## Configuration

### Column Order

Reorder columns through the Bases view configuration:

1. Click the view settings
2. Drag columns to reorder
3. Toggle visibility for each column

### Grouping

Group rows by any property using Bases grouping options.

## Interactions

### Editing Items

- Click any row to open the Item Modal
- Right-click for context menu

### Context Menu

- **Open** - Open in current tab
- **Open in New Tab** - Open in new tab

## Visual Indicators

### Status Badges

Colored badges show the current status with icons.

### Priority Badges

Color-coded priority indicators.

### Overdue Items

Due dates in the past appear highlighted in red.

### Progress Bars

Items with a `progress` field show a visual progress bar.

## Virtual Scrolling

For tables with 50+ rows:

- Virtual scrolling automatically activates
- Only visible rows are rendered
- Smooth scrolling maintained

## Mobile Support

- Touch-friendly row selection
- Horizontal scroll for wide tables
- Responsive badge sizing
