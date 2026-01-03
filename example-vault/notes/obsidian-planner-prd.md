# Planner - Product Requirements Document

> **Version:** 2.2.0
> **Last Updated:** 2026-01-03
> **Author:** Claude and Sawyer Rensel
> **Status:** Active

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [User Personas](#2-user-personas)
3. [Core Concepts](#3-core-concepts)
4. [Data Model](#4-data-model)
5. [Views](#5-views)
6. [Features](#6-features)
7. [Settings](#7-settings)
8. [User Interface](#8-user-interface)
9. [Technical Architecture](#9-technical-architecture)
10. [Implementation Roadmap](#10-implementation-roadmap)
11. [Appendices](#11-appendices)

---

## 1. Executive Summary

### 1.1 Vision

**Planner** is an Obsidian plugin for unified calendar, task, and project management. Built from the ground up with a modular frontmatter architecture, it gives users complete control over their data while providing powerful visualization through Obsidian Bases integration.

### 1.2 Design Principles

1. **Modular Metadata**: Every field is independent and optional. Users have full control to edit items in plain text.
2. **Bases-First**: All views are `.base` files. The plugin extends Bases with custom view types (Calendar, Gantt, Kanban).
3. **Items, Not Types**: Everything is an "Item". Tags (`#task`, `#event`) differentiate behavior, not separate data models.
4. **Progressive Complexity**: Simple for basic calendar use, powerful for project management.

### 1.3 Success Criteria

The plugin is successful when a user can:
1. Quickly create and edit items via unified Item Modal with icon-based inputs
2. Have frontmatter auto-populated from a template
3. View all items on Calendar (year/month/week/3-day/day/list layouts)
4. Filter items using Obsidian Bases query system
5. Visualize projects on Gantt and Kanban views

### 1.4 Non-Goals (v1.0)

- External calendar sync (Google, Microsoft, ICS) - *deferred to v1.1*
- HTTP API for external integrations - *deferred to v1.1*
- Time tracking and Pomodoro - *deferred to v1.1*
- Mobile-specific optimizations beyond basic functionality

---

## 2. User Personas

### 2.1 Primary Persona: The Life Planner

> "I want to plan out everything: every event, every task. I want to see every aspect of my life on a Calendar and Gantt chart because they give me a big picture of my life—past, present, and future."

**Needs:**
- Quick event creation from desktop and mobile
- Year-at-a-glance Gantt roadmap
- Multiple calendars with distinct colors
- All calendar layouts (year, month, week, 3-day, day, list)
- Project/task management for hobby projects

**Success Metric:** Can manage entire life (work, personal, hobbies, social) in one system.

### 2.2 Secondary Personas

| Persona | Primary Need | Key Features |
|---------|--------------|--------------|
| **Casual Planner** | Simple calendar replacement | Calendar views, quick capture, recurring events |
| **Hobby Project Manager** | Long-term project visualization | Gantt view, parent/subtask hierarchy |
| **Power Organizer** | Comprehensive task management | Kanban, dependencies, all views |

---

## 3. Core Concepts

### 3.1 Items

An **Item** is the fundamental unit in Planner. Every item is a Markdown note with structured frontmatter metadata.

- Items are stored as regular `.md` files
- Items are identified by folder location and/or tags (configurable)
- All frontmatter fields are optional
- Items can be differentiated using tags: `#task`, `#event`, or custom tags

### 3.2 Tags for Behavior

Instead of a boolean `task` field, items use standard Obsidian tags:

| Tag      | Typical Behavior                                        |
| -------- | ------------------------------------------------------- |
| `#event` | Shows on calendar, no completion tracking               |
| `#task`  | Shows on calendar and task lists, has status/completion |
| (no tag) | Treated as generic item, shows everywhere               |

A "project" is simply a task with subtasks—no separate tag needed.

Views can filter by tags using Bases queries. This is convention, not enforcement—users have full flexibility.

### 3.3 Hierarchy

Items can be organized hierarchically:

```
Project (parent)
├── Phase 1 (subtask / parent of sub-subtasks)
│   ├── Task A
│   └── Task B
└── Phase 2
    └── Task C
```

- `parent` field links to parent item
- `children` field lists child item links
- Nesting depth is unlimited
- In Gantt: children appear indented under parents
- In List: collapsible tree structure

### 3.4 Dependencies

Items can have blocking relationships independent of hierarchy:

- `blocked_by`: List of items that must complete before this one can start
- `blocking`: **Computed at runtime** - items this one blocks (reverse lookup of `blocked_by`)

### 3.5 Calendars

The `calendar` field categorizes items:

- An item can belong to multiple calendars (list type)
- Calendar names are user-defined (just type a name)
- Colors are assigned in plugin settings
- A default calendar can be set for new items

### 3.6 Recurrence

Items can recur using iCal RRULE-compatible fields (powered by `rrule` library):

- `repeat_frequency`: daily, weekly, monthly, yearly
- `repeat_interval`: repeat every N frequency units
- `repeat_until` / `repeat_count`: end conditions
- `repeat_byday`, `repeat_bymonth`, etc.: complex patterns

When a recurring instance is completed, the date is added to `repeat_completed_dates`.

---

## 4. Data Model

### 4.1 Frontmatter Schema

All fields use `snake_case`. All date fields use ISO 8601 format (`YYYY-MM-DDTHH:mm:ss`).

#### Identity Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | text | Display title (defaults to filename) |
| `summary` | text | Short description for compact views |
| `tags` | list | Standard Obsidian tags (e.g., `#task`, `#event`) |

#### Categorization Fields

| Field | Type | Description |
|-------|------|-------------|
| `calendar` | list | Calendar(s) this item belongs to |
| `context` | list | Context tags (e.g., `@home`, `@work`, `@errands`) |
| `people` | list | People involved (can link to Person notes) |
| `location` | text | Location name or coordinates |
| `related` | list | Links to related notes |

#### Status Fields

| Field | Type | Description |
|-------|------|-------------|
| `status` | text | Current status (user-configurable options) |
| `priority` | text | Priority level (user-configurable options) |
| `progress` | number | Completion percentage (0-100) |

#### Date Fields

##### Old Date Fields

| Field            | Type     | Description                          |
| ---------------- | -------- | ------------------------------------ |
| `date_created`   | datetime | When created (auto-set)              |
| `date_modified`  | datetime | Last modified (auto-set)             |
| `date_start`     | datetime | When item starts / is scheduled      |
| `date_end`       | datetime | When item ends (for multi-day items) |
| `date_due`       | datetime | External deadline                    |
| `date_completed` | datetime | When marked complete (auto-set)      |
| `all_day`        | boolean  | Whether this is an all-day item      |

##### New Date Fields

| New Field              | Type     | Description                             |
| ---------------------- | -------- | --------------------------------------- |
| `date_created`         | datetime | System timestamp.                       |
| `date_modified`        | datetime | System timestamp.                       |
| `date_start_scheduled` | datetime | When you intend to perform the action.  |
| `date_start_actual`    | datetime | When you actually started the action.   |
| `date_end_scheduled`   | datetime | When you intend to complete the action. |
| `date_end_actual`      | datetime | When you actually finished the action.  |
| `all_day`              | boolean  | Whether this is an all-day item.        |

#### Recurrence Fields (iCal RRULE)

| Field                   | Type     | Description                                            |
| ----------------------- | -------- | ------------------------------------------------------ |
| `repeat_frequency`       | text     | `daily`, `weekly`, `monthly`, `yearly`                 |
| `repeat_interval`        | number   | Every N frequency units (default: 1)                   |
| `repeat_until`           | datetime | Recurrence end date                                    |
| `repeat_count`           | number   | Total occurrences                                      |
| `repeat_byday`           | list     | Days of week: `MO`, `TU`, `WE`, `TH`, `FR`, `SA`, `SU` |
| `repeat_bymonth`         | list     | Months (1-12)                                          |
| `repeat_bymonthday`      | list     | Days of month (1-31, or -1 for last)                   |
| `repeat_bysetpos`        | number   | Position selector (e.g., -1 for last)                  |
| `repeat_completed_dates` | list     | Dates of completed instances                           |

#### Hierarchy & Dependencies

| Field | Type | Description |
|-------|------|-------------|
| `parent` | text | Link to parent item |
| `children` | list | Links to child items |
| `blocked_by` | list | Items that must complete first |
| `blocking` | list | **Computed**: Items this blocks (not stored) |

#### Display Fields

| Field | Type | Description |
|-------|------|-------------|
| `cover` | text | Image path for Kanban card cover |
| `color` | text | Override color (hex, e.g., `#4A90D9`) |

### 4.2 Example Item

```yaml
---
# Identity
title: Website Redesign
summary: Complete overhaul of company website
tags:
  - task

# Categorization
calendar:
  - Work
context:
  - "@office"
people:
  - "[[John Smith]]"
location:
related:
  - "[[Brand Guidelines]]"

# Status
status: In-Progress
priority: High
progress: 35

# Dates
date_created: 2025-01-10T09:00:00
date_modified: 2025-01-15T14:30:00
date_start: 2025-01-15T09:00:00
date_end:
date_due: 2025-01-31T17:00:00
date_completed:
all_day: false

# Recurrence (iCal RRULE)
repeat_frequency:
repeat_interval:
repeat_until:
repeat_count:
repeat_byday:
repeat_bymonth:
repeat_bymonthday:
repeat_bysetpos:
repeat_completed_dates:

# Hierarchy & Dependencies
parent: "[[Q1 Initiatives]]"
children:
  - "[[Design mockups]]"
  - "[[Implement frontend]]"
  - "[[Backend API]]"
blocked_by:
  - "[[Brand guidelines approval]]"

# Display
cover:
color:
---

## Description

Full redesign incorporating new brand identity...
```

### 4.3 Computed Fields

These are calculated at runtime, not stored in frontmatter:

| Field | Computation |
|-------|-------------|
| `blocking` | All items that have this item in their `blocked_by` |
| `duration` | `date_end - date_start` |
| `is_overdue` | `date_due < now AND status NOT IN completed_statuses` |
| `next_occurrence` | Next date from RRULE after today |

---

## 5. Views

All views are powered by Obsidian Bases and stored as `.base` files.

### 5.1 Calendar View

Full calendar display using FullCalendar library.

**Layouts:**
- **Year (Y)**: Overview of entire year
- **Month (M)**: Traditional month grid
- **Week (W)**: 7-day view with time slots
- **3-Day (3D)**: Rolling 3-day view
- **Day (D)**: Single day with time slots
- **List (L)**: Chronological list/agenda

**Features:**
- Color items by any field (calendar, priority, status, context, etc.)
- Click date number to open/create Daily Note (respects Open Behavior setting)
- Click empty date area to create new item via Item Modal
- Drag to reschedule (smooth drag-and-drop with proper cursor positioning)
- Click item to open Item Modal for editing
- Recurring items show all instances (respects Week Starts On setting)
- All-day items in dedicated section
- Configurable font size for calendar items
- Mobile-optimized toolbar (condensed layout, reduced real estate usage)

**Bases Integration:**
- Filter: `WHERE calendar = "Work" AND status != "Done"`
- Sort: By `date_start`, `priority`, etc.
- Group: By calendar, by day, etc.

**Bases Configuration Menu Options:**
- **Default View Mode**: Set initial layout (Year, Month, Week, 3-Day, Day, List)
- **Date Start Field**: Select which frontmatter field defines item start (e.g., `date_start`, `date_due`)
- **Date End Field**: Select which frontmatter field defines item end
- **Title Field**: Select which field displays as item text on calendar
- **Color By**: Select field to color items by (calendar, priority, status, etc.)

### 5.2 Gantt View

Timeline visualization using Frappe Gantt.

**Features:**
- Configurable bar start/end fields (e.g., `date_start` → `date_due`)
- Color bars by any field (same as Calendar)
- Swimlanes: Group by any field (calendar, parent, status)
- Dependency arrows between items
- Progress bars (drag to update)
- Milestones (items where start = end)
- Zoom levels: day, week, month, quarter, year
- Today marker with auto-scroll

**Bar Interactions:**
- Drag ends to adjust dates
- Drag whole bar to reschedule
- Click for popup with quick-edit
- Create dependencies by dragging between bars

**Mobile:**
- Tap: Open popup
- Long-press: Initiate drag
- Pinch: Zoom

### 5.3 Kanban View

Drag-and-drop board with configurable columns.

**Features:**
- Columns by any field (status, priority, calendar, etc.)
- Drag cards between columns (updates field value)
- Card shows: title, summary, dates, tags
- Cover images via `cover` field
- Configurable card properties
- WIP limits per column (optional)
- Swimlanes for additional grouping

### 5.4 Task List View

Table/list view with sortable columns.

**Features:**
- Sortable columns
- Inline field editing
- Bulk selection and batch operations
- Configurable visible columns
- Nested subtasks (collapsible tree)
- Quick status toggle

---

## 6. Features

### 6.1 Item Modal (Create & Edit)

Unified modal for creating and editing items, combining quick capture with full editing capabilities.

**Triggers:**
- Global hotkey (default: `Ctrl+Shift+N`) — opens blank modal for new item
- Click on empty date in Calendar View — opens modal with date pre-populated
- Click on existing item in any view — opens modal with item data loaded
- `+ New` button in any view

**Input Modes:**

1. **NLP Mode** (optional, toggle in settings): Type natural language in title field
   ```
   Team meeting tomorrow at 2pm @work #event !high
   ```
   Parsed tokens auto-populate the corresponding fields.

2. **Form Mode**: Use icon action bar and form fields directly

**NLP Parsing Tokens:**

| Token | Maps To |
|-------|---------|
| Plain text | `title` |
| `tomorrow at 2pm` | `date_start` (NLP parsed) |
| `@work` | `context` |
| `+[[Note]]` | `parent` |
| `#event` | `tags` |
| `!high` or `*high` | `priority` |
| `>In-Progress` | `status` |

**Icon Action Bar:**

| Icon | Field | Interaction |
|------|-------|-------------|
| 📅 Calendar | `date_start` | Context menu: relative dates, quick picks, custom picker |
| 🏁 Calendar-check | `date_end` | Same as date_start |
| ⭐ Star | `priority` | Context menu: Urgent, High, Medium, Low, None |
| ○ Circle | `status` | Context menu: configured statuses |
| 🔄 Refresh | Recurrence | Context menu: presets + Custom recurrence... |
| 🗂️ Folder | `calendar` | Dropdown of configured calendars |

**Visual Feedback:**
- Icons show colored dot indicator when field has a value
- Tooltips display current value on hover

**Context Menus — Date Picker:**
- **Relative**: +1 day, -1 day, +1 week, -1 week
- **Quick picks**: Today, Tomorrow, This weekend, Next week, Next month
- **Submenu**: Weekdays
- **Custom**: Pick date & time...
- **Clear**: Clear date

**Context Menus — Recurrence:**
- **Standard**: Daily, Weekly on [day], Every 2 weeks on [day], Monthly on [date], Yearly on [date], Weekdays only
- **After completion**: Daily, Every 3 days, Weekly, Monthly (after completion)
- **Custom**: Opens Custom Recurrence dialog

**Custom Recurrence Dialog:**
Secondary modal for complex RRULE patterns:
- Frequency (daily/weekly/monthly/yearly)
- Interval (every N units)
- Days of week (for weekly)
- Day of month / position (for monthly)
- End condition (never, after N occurrences, on date)

**Additional Fields (above action bar):**
- Title (text input, required)
- Summary (resizable textarea for `summary` field)
- Note Content (textarea for note body content, renders Markdown preview, scrollable)
- Context (text with autocomplete from existing context values)
- People (text with autocomplete, supports `[[wikilinks]]` via file link suggest)
- Parent (note link picker with autocomplete)
- Tags (text with autocomplete from existing tags)
- Blocked by (task selector with autocomplete)

**Action Buttons:**
- **Open Note**: Close modal, open markdown file in editor (edit mode only)
- **Delete**: Confirmation dialog, then delete from vault (edit mode only)
- **Cancel**: Discard changes, close modal
- **Save**: Save changes, close modal (keyboard: `Ctrl/Cmd+Enter`)

**Context-Aware Pre-population:**
- Clicking a date in Calendar → `date_start` set to that date
- Clicking a time slot → `date_start` set to that datetime, `all_day` = false
- Clicking "+ Add" in Kanban column → `status` set to that column's value
- New items get default calendar from settings
- Editing existing items pulls all field values from frontmatter

**Link Format Support:**
- Respects Obsidian's "Use [[Wikilinks]]" setting from Files and Links preferences
- When wikilinks are disabled, creates relative path markdown links
- Frontmatter links are temporarily converted to wikilinks for editing, then saved in the user's preferred format

### 6.2 Recurring Items

iCal RRULE-compatible recurrence.

**Examples:**

Daily standup:
```yaml
repeat_frequency: daily
repeat_interval: 1
date_start: 2025-01-01T09:00:00
```

Every 2 weeks on Tuesday and Thursday:
```yaml
repeat_frequency: weekly
repeat_interval: 2
repeat_byday:
  - TU
  - TH
```

Last Friday of every month:
```yaml
repeat_frequency: monthly
repeat_byday:
  - FR
repeat_bysetpos: -1
```

**Instance Completion:**
- Completing an instance adds date to `repeat_completed_dates`
- Next instance auto-calculated and displayed
- Original item remains (no duplication)

### 6.3 Item Hierarchy

Parent/child relationships for project organization.

**Behavior:**
- `parent` links to parent item
- `children` lists child items
- Parent shows aggregate progress of children (optional)
- In Gantt: children indented under parent
- In List: collapsible tree
- Completion rules configurable (e.g., parent can't complete until children done)

### 6.4 Dependencies

Block items based on other items.

**Behavior:**
- Add items to `blocked_by` field
- `blocking` computed at runtime (reverse lookup)
- Blocked items show indicator in views
- Optional: Prevent status change if blocked
- Gantt shows dependency arrows

### 6.5 Batch Operations

Multi-select actions in list views.

**Available Operations:**
- Reschedule (set new date)
- Change status
- Change priority
- Assign to calendar(s)
- Add/remove tags
- Set parent
- Delete

---

## 7. Settings

### 7.1 General

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Items Folder | path | `Planner/` | Where new items are created |
| Bases Folder | path | `Planner/` | Where `.base` files are stored |
| Item Template | path | (none) | Template for new items |
| Default Calendar | text | `Personal` | Auto-assigned to new items |
| Date Format | select | `YYYY-MM-DD` | Display format |
| Time Format | select | `24h` | 12h or 24h |
| Week Starts On | select | `Monday` | First day of week (also affects recurrence) |
| Open Behavior | select | `new-tab` | How to open items and daily notes: `new-tab`, `same-tab`, `split-right`, `split-down` |

### 7.2 Item Identification

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Identification Method | select | `folder` | `folder`, `tag`, or `both` |
| Include Folders | list | `["Planner/"]` | Folders containing items |
| Include Tags | list | `[]` | Tags identifying items |

### 7.3 Status Configuration

Drag to reorder. Mark statuses as "completed" to auto-set `date_completed`. Each status can have a Lucide icon.

| Status | Color | Icon | Completed |
|--------|-------|------|-----------|
| Idea | Yellow | `circle-dashed` | No |
| To-Do | Purple | `circle-dot-dashed` | No |
| In-Progress | Blue | `circle-dot` | No |
| In-Review | Orange | `eye` | No |
| Done | Green | `circle-check-big` | Yes |
| Cancelled | Red | `ban` | Yes |

### 7.4 Priority Configuration

Each priority can have a Lucide icon displayed in the Item Modal context menu.

| Priority | Color | Icon | Sort Weight |
|----------|-------|------|-------------|
| Urgent | Red | `alert-triangle` | 4 |
| High | Orange | `chevrons-up` | 3 |
| Medium | Yellow | `chevron-up` | 2 |
| Low | Blue | `chevron-down` | 1 |
| None | Gray | `minus` | 0 |

### 7.5 Calendar Configuration

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Calendar Colors | map | `Personal: Blue, Work: Green` | Color for each calendar name |
| Font Size | slider | `10px` | Calendar item text size (6-18px range) |
| Default Calendar | dropdown | `Personal` | Dropdown populated from existing calendars |

### 7.6 Item Modal

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Hotkey | hotkey | `Ctrl+Shift+N` | Open Item Modal for new item |
| Enable NLP Parsing | bool | `true` | Parse natural language in title field |
| Default Tags | list | `[]` | Auto-added to new items |
| Default Status | select | `To-Do` | For items with `#task` |
| Default Calendar | select | `Personal` | Pre-selected calendar for new items |
| Open Note After Save | bool | `false` | Open markdown file after saving |
| Details Expanded | bool | `false` | Start with Details section expanded |

---

## 8. User Interface

### 8.1 Item Modal

Unified modal for creating and editing items with icon-based action bar.

**Create Mode:**
```
┌─────────────────────────────────────────────────────────────┐
│  New Item                                              [×]  │
│                                                             │
│  Title  [ Team meeting tomorrow 2pm @work #event       ]    │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 📅 Tomorrow, 2:00 PM   @work   #event               │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Summary  [                                            ]    │
│                                                             │
│  Note Content                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ (Markdown preview, scrollable)                      │    │
│  │                                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Context    [ @work                                    ]    │
│  People     [                                          ]    │
│  Parent     [                                          ]    │
│  Tags       [ #event                                   ]    │
│                                                             │
│  ╭─────────────────────────────────────────────────────╮    │
│  │ 📅  🏁  ⭐  ○  🔄  🗂️ Personal ▼                    │    │
│  ╰─────────────────────────────────────────────────────╯    │
│                                                             │
│                                     [Cancel]     [Save]     │
└─────────────────────────────────────────────────────────────┘
```

**Edit Mode:**
```
┌─────────────────────────────────────────────────────────────┐
│  Edit Item                           [Open Note]       [×]  │
│                                                             │
│  Title  [ Website Redesign                             ]    │
│                                                             │
│  Summary  [ Complete overhaul of company website       ]    │
│                                                             │
│  Note Content                                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ Full redesign incorporating new brand identity...   │    │
│  │ (Markdown preview, scrollable)                      │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  Context    [ @office                                  ]    │
│  People     [ [[John Smith]]                           ]    │
│  Parent     [ [[Q1 Initiatives]]                       ]    │
│  Tags       [ #task                                    ]    │
│  Blocked by [ [[Brand guidelines approval]]            ]    │
│                                                             │
│  ╭─────────────────────────────────────────────────────╮    │
│  │ 📅• 🏁• ⭐• ○• 🔄  🗂️ Work ▼                        │    │
│  ╰─────────────────────────────────────────────────────╯    │
│  Jan 15, 2pm    Jan 31    High   In-Progress                │
│                                                             │
│  [Delete]                            [Cancel]    [Save]     │
└─────────────────────────────────────────────────────────────┘

• = dot indicator showing field has value
```

### 8.2 Item Modal Context Menus

**Date Context Menu (on 📅 or 🏁 click):**
```
┌──────────────────────────┐
│  + 1 day                 │
│  − 1 day                 │
│  + 1 week                │
│  − 1 week                │
├──────────────────────────┤
│  ✓ Today                 │
│    Tomorrow              │
│    This weekend          │
│    Next week             │
│    Next month            │
├──────────────────────────┤
│    Weekdays            ▶ │
├──────────────────────────┤
│  📅 Pick date & time...  │
│  ✕  Clear date           │
└──────────────────────────┘
```

**Recurrence Context Menu (on 🔄 click):**
```
┌────────────────────────────────┐
│    Daily                       │
│    Weekly on Thursday          │
│    Every 2 weeks on Thursday   │
│    Monthly on the 15th         │
│    Every 3 months on the 15th  │
│    Yearly on January 15th      │
│    Weekdays only               │
├────────────────────────────────┤
│    Daily (after completion)    │
│    Every 3 days (after compl.) │
│    Weekly (after completion)   │
│    Monthly (after completion)  │
├────────────────────────────────┤
│  ⚙️ Custom recurrence...       │
└────────────────────────────────┘
```

**Priority Context Menu (on ⭐ click):**
```
┌──────────────────┐
│  🔴 Urgent       │
│  🟠 High         │
│  🟡 Medium       │
│  🔵 Low          │
│  ⚪ None         │
└──────────────────┘
```

**Status Context Menu (on ○ click):**
```
┌──────────────────┐
│  💡 Idea         │
│  📋 To-Do        │
│  🔄 In-Progress  │
│  👀 In-Review    │
│  ✅ Done         │
│  ❌ Cancelled    │
└──────────────────┘
```

### 8.3 Calendar View

**Desktop Layout:**
```
┌─────────────────────────────────────────────────────────────┐
│  [Y][M][W][3D][D][L]    January 2026    [◀][▶][⊞]  [+]      │
├─────────────────────────────────────────────────────────────┤
│  ┌──────┬──────┬──────┬──────┬──────┬──────┬──────┐         │
│  │ Mon  │ Tue  │ Wed  │ Thu  │ Fri  │ Sat  │ Sun  │         │
│  ├──────┼──────┼──────┼──────┼──────┼──────┼──────┤         │
│  │  6   │  7   │  8   │  9   │  10  │  11  │  12  │         │
│  │      │ 🟢   │      │      │ 🟣   │      │      │         │
│  │      │ Mtg  │      │      │ Dinner│     │      │         │
│  ├──────┼──────┼──────┼──────┼──────┼──────┼──────┤         │
│  │  13  │  14  │  15  │  16  │  17  │  18  │  19  │         │
│  │      │      │ 🟢   │      │      │      │ 🔴   │         │
│  │      │      │ Launch│     │      │      │ DUE  │         │
│  └──────┴──────┴──────┴──────┴──────┴──────┴──────┘         │
└─────────────────────────────────────────────────────────────┘

[⊞] = Today button (jumps to current date)
```

**Mobile Layout (condensed):**
```
┌─────────────────────────────────┐
│ [Y][M][W][3D][D][L][◀][▶][⊞][+] │
│         January 2026            │
├─────────────────────────────────┤
│ (Calendar grid)                 │
└─────────────────────────────────┘
```

### 8.4 Gantt View

```
┌─────────────────────────────────────────────────────────────┐
│  Gantt                                 [Month ▼]  [+ New]   │
├─────────────────────────────────────────────────────────────┤
│  Start: [date_start ▼]  End: [date_due ▼]  Group: [None ▼]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│            │ Jan 6 │ Jan 13│ Jan 20│ Jan 27│ Feb 3 │        │
│  ──────────┼───────┼───────┼───────┼───────┼───────┤        │
│            │       │       │       │       │       │        │
│  Website   │ ██████████████│       │       │       │        │
│  Redesign  │               │       │       │       │        │
│            │       │       │       │       │       │        │
│    Design  │  ─────┼──▓▓▓▓▓│       │       │       │        │
│            │       │       │       │       │       │        │
│    Frontend│       │ └─────┼▓▓▓▓▓▓▓│       │       │        │
│            │       │       │       │       │       │        │
│  Mobile App│       │       │ ░░░░░░░░░░░░░░│       │        │
│            │       │       │       │       │       │        │
│  Launch ◆  │       │       │       │   ◆   │       │        │
│            │       │       │       │       │       │        │
└─────────────────────────────────────────────────────────────┘

Legend: ██ Done  ▓▓ In-Progress  ░░ To-Do  ◆ Milestone  ─► Dependency
```

### 8.5 Kanban View

```
┌─────────────────────────────────────────────────────────────┐
│  Kanban                              [By Status ▼] [+ New]  │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐    │
│  │ 💡 Ideas  │ │ 📋 To-Do  │ │ 🔄 Active │ │ ✅ Done   │    │
│  │    (3)    │ │    (5)    │ │    (2)    │ │    (8)    │    │
│  ├───────────┤ ├───────────┤ ├───────────┤ ├───────────┤    │
│  │┌─────────┐│ │┌─────────┐│ │┌─────────┐│ │┌─────────┐│    │
│  ││ Mobile  ││ ││ Homepage││ ││ API docs││ ││ Auth    ││    │
│  ││ redesign││ ││ ────────││ ││ ────────││ ││ ────────││    │
│  ││         ││ ││ 📅 Jan20││ ││ 📅 Jan18││ ││ ✓ Jan10 ││    │
│  │└─────────┘│ │└─────────┘│ │└─────────┘│ │└─────────┘│    │
│  │           │ │           │ │           │ │           │    │
│  │  [+ Add]  │ │  [+ Add]  │ │  [+ Add]  │ │           │    │
│  └───────────┘ └───────────┘ └───────────┘ └───────────┘    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 9. Technical Architecture

### 9.1 Technology Stack

| Component | Technology | Purpose |
|-----------|------------|---------|
| Language | TypeScript | Type safety, Obsidian compatibility |
| Platform | Obsidian Plugin API | Core integration |
| Views | Obsidian Bases | View system, filtering, queries |
| Calendar | FullCalendar | Calendar rendering |
| Gantt | Frappe Gantt | Timeline visualization |
| Recurrence | rrule | iCal RRULE parsing |
| NLP Dates | TBD (chrono-node or alternative) | Natural language parsing |

### 9.2 Project Structure

```
src/
├── main.ts                    # Plugin entry point
├── types/
│   ├── item.ts               # Item interface and schema
│   ├── settings.ts           # Settings interface
│   └── index.ts              # Type exports
├── services/
│   ├── ItemService.ts        # CRUD operations for items
│   ├── QueryService.ts       # Bases query integration
│   ├── RecurrenceService.ts  # RRULE handling
│   └── DependencyService.ts  # Dependency graph computation
├── views/
│   ├── CalendarView.ts       # FullCalendar integration
│   ├── GanttView.ts          # Frappe Gantt integration
│   ├── KanbanView.ts         # Kanban board
│   └── TaskListView.ts       # Table/list view
├── components/
│   ├── QuickCapture.ts       # Quick capture modal
│   ├── ItemModal.ts          # Full item edit modal
│   ├── ItemCard.ts           # Card component for views
│   └── DatePicker.ts         # Date/time picker
├── settings/
│   └── SettingsTab.ts        # Settings UI
└── utils/
    ├── dates.ts              # Date utilities
    ├── nlp.ts                # NLP parsing
    └── frontmatter.ts        # Frontmatter read/write
```

### 9.3 Bases Integration

The plugin registers custom view types with Obsidian Bases:

```typescript
// Conceptual - actual API TBD
bases.registerViewType('planner-calendar', CalendarView);
bases.registerViewType('planner-gantt', GanttView);
bases.registerViewType('planner-kanban', KanbanView);
```

Views consume Bases:
- **Source**: Folder path or tag filter
- **Filter**: WHERE clause (e.g., `status != "Done"`)
- **Sort**: ORDER BY clause
- **Group**: GROUP BY clause (for swimlanes)

### 9.4 Data Flow

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│  Markdown   │────▶│   Bases     │────▶│   Plugin    │
│   Files     │     │   Query     │     │   Views     │
│ (frontmatter)│    │   Engine    │     │             │
└─────────────┘     └─────────────┘     └─────────────┘
       ▲                                       │
       │                                       │
       └───────────────────────────────────────┘
                    User edits
```

1. Items are Markdown files with frontmatter
2. Bases queries the vault for items matching criteria
3. Plugin views render the query results
4. User edits update frontmatter, triggering re-render

### 9.5 Performance Considerations

- **Lazy rendering**: Only render visible items in large lists
- **Virtual scrolling**: For lists with 500+ items
- **Debounced updates**: Batch rapid frontmatter changes
- **Cached computations**: Cache `blocking` and other computed fields

**Targets:**
- Initial load: < 500ms for 1000 items
- View switch: < 200ms
- Item creation: < 100ms

---

## 10. Implementation Roadmap

### Phase 1: Foundation ✅

**Goal:** Minimal working plugin with Task List view

- [x] Project setup (TypeScript, esbuild, Obsidian plugin template)
- [x] Define Item type and frontmatter schema
- [x] ItemService: Create, read, update, delete items
- [x] Settings tab with basic configuration
- [x] Task List view (table with sortable columns)
- [x] Bases integration for Task List

**Deliverable:** Can create items and view them in a list, filtered by Bases.

### Phase 2: Calendar View ✅

**Goal:** Full calendar visualization

- [x] FullCalendar integration
- [x] All 6 layouts (year, month, week, 3-day, day, list)
- [x] Color by field (calendar, priority, status, etc.)
- [x] Click to create, drag to reschedule
- [x] Recurring item display (using rrule)
- [x] Bases filtering for calendar
- [x] Configurable date start/end fields in Bases menu
- [x] Click date number to open Daily Note
- [x] Mobile-optimized toolbar

**Deliverable:** Fully functional calendar that can replace Google Calendar for basic use.

### Phase 3: Item Modal ✅

**Goal:** Unified modal for creating and editing items

- [x] Item Modal component with icon action bar
- [x] Date context menus (relative dates, quick picks, custom picker)
- [x] Status and Priority context menus (with Lucide icons)
- [x] Recurrence context menu with presets
- [x] Custom Recurrence dialog for complex RRULE patterns
- [x] NLP parsing in title field (optional)
- [x] Token parsing (@context, #tags, !priority, etc.)
- [x] Summary and Note Content fields
- [x] Action buttons (Open Note, Delete, Cancel, Save)
- [x] Context-aware pre-population from views
- [x] Field autocomplete (Context, People, Parent, Tags, Blocked by)
- [x] Link format support (Wikilinks vs Markdown links)
- [x] Pull existing field values when editing
- [x] Hotkey configuration

**Deliverable:** Can create and edit items via unified modal with icon-based quick inputs.

### Phase 4: Recurrence ✅

**Goal:** Full iCal RRULE support

- [x] RecurrenceService with rrule library
- [x] Recurrence UI in item modal
- [x] Instance completion tracking
- [x] Calendar view shows all instances
- [x] Common presets (daily, weekly, monthly, yearly)
- [x] Respects Week Starts On setting

**Deliverable:** Can create and manage recurring items.

### Phase 5: Gantt View

**Goal:** Project timeline visualization

- [ ] Frappe Gantt integration
- [ ] Configurable bar start/end fields
- [ ] Swimlanes by field
- [ ] Dependency arrows
- [ ] Progress bars
- [ ] Drag to reschedule
- [ ] Zoom levels

**Deliverable:** Can visualize projects on a timeline with dependencies.

### Phase 6: Kanban View

**Goal:** Board-based task management

- [ ] Kanban component
- [ ] Drag-and-drop between columns
- [ ] Configurable column field
- [ ] Card customization (properties shown)
- [ ] Cover images
- [ ] Swimlanes

**Deliverable:** Can manage tasks in a Kanban board.

### Phase 7: Polish & Optimization

**Goal:** Production-ready quality

- [x] Mobile optimization (Calendar toolbar, Item Modal responsive width)
- [ ] Virtual scrolling for large datasets
- [ ] Keyboard navigation
- [ ] Error handling and edge cases
- [ ] Documentation
- [ ] Performance profiling and optimization

**Deliverable:** Plugin ready for public release.

### Future (v1.1+)

- External calendar sync (Google, Microsoft, ICS)
- HTTP API for automation
- Time tracking and Pomodoro
- Dashboard widgets
- Map View integration

---

## 11. Appendices

### 11.1 Bases Syntax Reference

See: https://help.obsidian.md/bases/syntax

Common queries for Planner:
```
# All tasks due this week
WHERE tags CONTAINS "#task" AND date_due >= today() AND date_due < today() + 7

# Work calendar items
WHERE calendar CONTAINS "Work"

# Blocked items
WHERE blocked_by IS NOT EMPTY

# In-progress items by priority
WHERE status = "In-Progress"
ORDER BY priority DESC
```

### 11.2 iCal RRULE Reference

See: RFC 5545 (https://datatracker.ietf.org/doc/html/rfc5545)

Common patterns:
- Daily: `FREQ=DAILY;INTERVAL=1`
- Weekdays: `FREQ=WEEKLY;BYDAY=MO,TU,WE,TH,FR`
- Monthly on 15th: `FREQ=MONTHLY;BYMONTHDAY=15`
- Last Friday: `FREQ=MONTHLY;BYDAY=FR;BYSETPOS=-1`

### 11.3 Design References

- TaskNotes Plugin: UI/UX inspiration for Calendar and Kanban
- FullCalendar: https://fullcalendar.io/
- Frappe Gantt: https://frappe.io/gantt
- GitHub Projects: Gantt and configurability inspiration

### 11.4 Related Files

- [questions.md](questions.md) - Q&A that shaped this PRD

---

## Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 1.0.x | 2025-12-28/29 | Claude & Sawyer | Original PRD (deprecated) |
| 2.0.0 | 2025-12-30 | Claude & Sawyer | Complete rewrite for ground-up build. Removed task boolean (use tags). Simplified architecture. Clear phased roadmap. Deferred calendar sync, HTTP API, time tracking to v1.1+. |
| 2.1.0 | 2026-01-01 | Claude & Sawyer | Unified Item Modal feature: merged Quick Capture with Item Edit Modal. Added icon-based action bar, context menus for dates/recurrence/priority/status, collapsible Details section, and action buttons (Open Note, Delete, Cancel, Save). Inspired by TaskNotes UI patterns. |
| 2.2.0 | 2026-01-03 | Claude & Sawyer | Item Modal enhancements: field autocomplete (Context, People, Parent, Tags, Blocked by), link format support (respects Wikilinks setting), pull existing values when editing, Summary field, Note Content field with markdown preview. Calendar View improvements: fixed drag-and-drop, mobile-optimized toolbar, configurable Bases options (Date Start/End fields, Title field, Default View Mode). Settings additions: Status and Priority icons (Lucide), calendar font size slider, Open Behavior setting. Phases 1-4 completed. |

---

*This is a living document. Update as implementation progresses.*
