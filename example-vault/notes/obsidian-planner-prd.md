# Planner - Product Requirements Document

> **Version:** 2.0.0
> **Last Updated:** 2025-12-30
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
1. Quickly create items via NLP quick capture
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

| Tag        | Typical Behavior                                        |
| ---------- | ------------------------------------------------------- |
| `#event`   | Shows on calendar, no completion tracking               |
| `#task`    | Shows on calendar and task lists, has status/completion |
| `#project` | Parent item containing subtasks                         |
| (no tag)   | Treated as generic item, shows everywhere               |

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

- `rrule_frequency`: daily, weekly, monthly, yearly
- `rrule_interval`: repeat every N frequency units
- `rrule_until` / `rrule_count`: end conditions
- `rrule_byday`, `rrule_bymonth`, etc.: complex patterns

When a recurring instance is completed, the date is added to `rrule_completed_dates`.

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

| Field | Type | Description |
|-------|------|-------------|
| `date_created` | datetime | When created (auto-set) |
| `date_modified` | datetime | Last modified (auto-set) |
| `date_start` | datetime | When item starts / is scheduled |
| `date_end` | datetime | When item ends (for multi-day items) |
| `date_due` | datetime | External deadline |
| `date_completed` | datetime | When marked complete (auto-set) |
| `all_day` | boolean | Whether this is an all-day item |

#### Recurrence Fields (iCal RRULE)

| Field | Type | Description |
|-------|------|-------------|
| `rrule_frequency` | text | `daily`, `weekly`, `monthly`, `yearly` |
| `rrule_interval` | number | Every N frequency units (default: 1) |
| `rrule_until` | datetime | Recurrence end date |
| `rrule_count` | number | Total occurrences |
| `rrule_byday` | list | Days of week: `MO`, `TU`, `WE`, `TH`, `FR`, `SA`, `SU` |
| `rrule_bymonth` | list | Months (1-12) |
| `rrule_bymonthday` | list | Days of month (1-31, or -1 for last) |
| `rrule_bysetpos` | number | Position selector (e.g., -1 for last) |
| `rrule_completed_dates` | list | Dates of completed instances |

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
title: Website Redesign
summary: Complete overhaul of company website
tags:
  - task
  - project
calendar:
  - Work
context:
  - "@office"
people:
  - "[[John Smith]]"
status: In-Progress
priority: High
progress: 35
date_start: 2025-01-15T09:00:00
date_due: 2025-01-31T17:00:00
parent: "[[Q1 Initiatives]]"
children:
  - "[[Design mockups]]"
  - "[[Implement frontend]]"
  - "[[Backend API]]"
blocked_by:
  - "[[Brand guidelines approval]]"
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
- Click date to create new item
- Drag to reschedule
- Click item to open/edit
- Recurring items show all instances
- All-day items in dedicated section

**Bases Integration:**
- Filter: `WHERE calendar = "Work" AND status != "Done"`
- Sort: By `date_start`, `priority`, etc.
- Group: By calendar, by day, etc.

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

### 6.1 Quick Capture

Keyboard-driven quick entry with NLP parsing.

**Trigger:** Global hotkey (default: `Ctrl+Shift+N`)

**Syntax Example:**
```
Team meeting tomorrow at 2pm @work +[[Q1 Planning]] #event !high
```

**Parsing:**

| Token | Maps To |
|-------|---------|
| Plain text | `title` |
| `tomorrow at 2pm` | `date_start` (NLP parsed) |
| `@work` | `context` |
| `+[[Note]]` | `parent` |
| `#event` | `tags` |
| `!high` or `*high` | `priority` |
| `>In-Progress` | `status` |

**Behavior:**
1. Creates new note from template
2. Populates frontmatter from parsed input
3. Shows confirmation toast with "Edit" link
4. Optional: Open in editor after creation

### 6.2 Recurring Items

iCal RRULE-compatible recurrence.

**Examples:**

Daily standup:
```yaml
rrule_frequency: daily
rrule_interval: 1
date_start: 2025-01-01T09:00:00
```

Every 2 weeks on Tuesday and Thursday:
```yaml
rrule_frequency: weekly
rrule_interval: 2
rrule_byday:
  - TU
  - TH
```

Last Friday of every month:
```yaml
rrule_frequency: monthly
rrule_byday:
  - FR
rrule_bysetpos: -1
```

**Instance Completion:**
- Completing an instance adds date to `rrule_completed_dates`
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
| Item Template | path | (none) | Template for new items |
| Default Calendar | text | `Personal` | Auto-assigned to new items |
| Date Format | select | `YYYY-MM-DD` | Display format |
| Time Format | select | `24h` | 12h or 24h |
| Week Starts On | select | `Monday` | First day of week |

### 7.2 Item Identification

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Identification Method | select | `folder` | `folder`, `tag`, or `both` |
| Include Folders | list | `["Planner/"]` | Folders containing items |
| Include Tags | list | `[]` | Tags identifying items |

### 7.3 Status Configuration

Drag to reorder. Mark statuses as "completed" to auto-set `date_completed`.

| Status | Color | Completed |
|--------|-------|-----------|
| Idea | Purple | No |
| To-Do | Gray | No |
| In-Progress | Blue | No |
| In-Review | Orange | No |
| Done | Green | Yes |
| Cancelled | Red | Yes |

### 7.4 Priority Configuration

| Priority | Color | Sort Weight |
|----------|-------|-------------|
| Urgent | Red | 4 |
| High | Orange | 3 |
| Medium | Yellow | 2 |
| Low | Blue | 1 |
| None | Gray | 0 |

### 7.5 Calendar Colors

| Calendar | Color |
|----------|-------|
| Personal | Blue |
| Work | Green |
| (new calendars) | Gray (until configured) |

### 7.6 Quick Capture

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Hotkey | hotkey | `Ctrl+Shift+N` | Trigger quick capture |
| Default Tags | list | `[]` | Auto-added to new items |
| Default Status | select | `To-Do` | For items with `#task` |
| Open After Create | bool | `false` | Open note in editor |

---

## 8. User Interface

### 8.1 Quick Capture Modal

Floating input with real-time NLP preview.

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ Team meeting tomorrow 2pm @work #event               │  │
│  └───────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ 📅 Tomorrow, 2:00 PM   @work   #event               │    │
│  └─────────────────────────────────────────────────────┘    │
│                                                             │
│  [Enter] Create  •  [Tab] Open Modal  •  [Esc] Cancel       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### 8.2 Item Edit Modal

Full form for creating/editing items with all fields accessible.

Sections (collapsible):
- **Core**: Title, Summary, Tags, Status, Priority
- **Dates**: Start, End, Due, All-day toggle
- **Recurrence**: Frequency, Interval, Days, Until/Count
- **Organization**: Calendar, Context, People, Parent
- **Advanced**: Location, Related, Cover image

### 8.3 Calendar View

```
┌─────────────────────────────────────────────────────────────┐
│  Calendar                              [Month ▼]  [+ New]   │
├─────────────────────────────────────────────────────────────┤
│  [Filter...]  [Color by: Calendar ▼]                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│       ◀  January 2025  ▶               [Y][M][W][3D][D][L]  │
│                                                             │
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
│                                                             │
│  Legend: 🟢 Work  🔵 Personal  🟣 Family                    │
└─────────────────────────────────────────────────────────────┘
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

### Phase 1: Foundation

**Goal:** Minimal working plugin with Task List view

- [ ] Project setup (TypeScript, esbuild, Obsidian plugin template)
- [ ] Define Item type and frontmatter schema
- [ ] ItemService: Create, read, update, delete items
- [ ] Settings tab with basic configuration
- [ ] Task List view (table with sortable columns)
- [ ] Bases integration for Task List

**Deliverable:** Can create items and view them in a list, filtered by Bases.

### Phase 2: Calendar View

**Goal:** Full calendar visualization

- [ ] FullCalendar integration
- [ ] All 6 layouts (year, month, week, 3-day, day, list)
- [ ] Color by field (calendar, priority, status, etc.)
- [ ] Click to create, drag to reschedule
- [ ] Recurring item display (using rrule)
- [ ] Bases filtering for calendar

**Deliverable:** Fully functional calendar that can replace Google Calendar for basic use.

### Phase 3: Quick Capture

**Goal:** Rapid item creation with NLP

- [ ] Quick capture modal (floating input)
- [ ] NLP date parsing
- [ ] Token parsing (@context, #tags, !priority, etc.)
- [ ] Template-based item creation
- [ ] Hotkey configuration

**Deliverable:** Can create items in <5 seconds via keyboard.

### Phase 4: Recurrence

**Goal:** Full iCal RRULE support

- [ ] RecurrenceService with rrule library
- [ ] Recurrence UI in item modal
- [ ] Instance completion tracking
- [ ] Calendar view shows all instances
- [ ] Common presets (daily, weekly, monthly, yearly)

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

- [ ] Mobile optimization
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

---

*This is a living document. Update as implementation progresses.*
