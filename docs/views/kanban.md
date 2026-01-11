# Kanban View

Organize tasks with drag-and-drop columns and customizable cards.

## Features

- Drag and drop cards between columns
- Swimlanes for additional grouping
- Column and swimlane reordering
- Cover images on cards
- Configurable card display

## Configuration

### Columns By

Group cards into columns by any property:

- **Status** - Default, shows workflow stages
- **Priority** - Group by importance
- **Calendar** - Group by project/category
- **Folder** - Group by file location
- **Tags** - Group by tag
- **Any Property** - Custom categorical fields

### Swimlanes By

Add horizontal grouping:

- **None** - No swimlanes
- **Status** - If columns are by priority
- **Priority** - If columns are by status
- **Calendar** - By project
- **Any Property** - Custom grouping

### Color By

How cards are colored:

- **Calendar** - By calendar/project color
- **Status** - By status color
- **Priority** - By priority color
- **Custom** - Any categorical property

### Card Display

| Option | Description |
|--------|-------------|
| **Title By** | Which property shows as card title |
| **Cover Field** | Property containing image path |
| **Cover Display** | Banner, thumbnail, or background |
| **Cover Height** | Height in pixels |
| **Border Style** | Left accent, full border, or none |
| **Badge Placement** | Inline or properties section |
| **Column Width** | Width in pixels |
| **Hide Empty Columns** | Don't show columns with no cards |

### Headers

| Option | Description |
|--------|-------------|
| **Freeze Headers** | Keep headers visible on scroll |
| **Swimlane Orientation** | Horizontal or vertical labels |

## Interactions

### Moving Cards

- **Drag and Drop** - Move cards between columns
- **Touch Hold** - On mobile, hold 200ms then drag
- **Auto-scroll** - Drag to edges to scroll

### Reordering Columns

- Drag the column header to reorder
- New order persists in the view

### Reordering Swimlanes

- Drag the swimlane header to reorder
- Works on both desktop and mobile

### Adding Cards

- Click the "+" button in any column
- Opens the Item Modal with column value pre-filled

## Keyboard Navigation

Navigate the board without a mouse:

| Key | Action |
|-----|--------|
| ++arrow-up++ / ++k++ | Move focus up |
| ++arrow-down++ / ++j++ | Move focus down |
| ++arrow-left++ / ++h++ | Move focus left (to previous column) |
| ++arrow-right++ / ++l++ | Move focus right (to next column) |
| ++enter++ / ++space++ | Open focused card |
| ++escape++ | Clear focus |

!!! tip "Vim-Style Navigation"
    The `h`, `j`, `k`, `l` keys work alongside arrow keys for vim users.

## Mobile Support

- **Touch Drag** - Hold card for 200ms, then drag
- **Visual Feedback** - Card lifts and scales when ready to drag
- **Auto-scroll** - Drag to edges triggers scrolling
- **Swimlane Drag** - Same hold-and-drag for swimlane rows

## Virtual Scrolling

For performance with large datasets:

- Columns with 15+ cards use virtual scrolling
- Only visible cards are rendered
- Smooth scrolling maintained
