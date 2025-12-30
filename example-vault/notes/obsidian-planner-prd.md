# Obsidian Planner - Product Requirements Document

> **Version:** 1.0.3-deprecated
> **Last Updated:** 2025-12-29
> **Author:** Claude and Sawyer Rensel
> **Status:** Draft - Deprecated

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [User Personas](#2-user-personas)
3. [Core Concepts](#3-core-concepts)
4. [Data Model](#4-data-model)
5. [Views](#5-views)
6. [Features](#6-features)
7. [Settings](#7-settings)
8. [Default Views](#8-default-views)
9. [User Flow & Design](#9-user-flow--design)
10. [Technical Considerations](#10-technical-considerations)
11. [Assumptions, Constraints & Dependencies](#11-assumptions-constraints--dependencies)
12. [Success Metrics](#12-success-metrics)
13. [Roadmap](#13-roadmap)
14. [Open Questions](#14-open-questions)
15. [Appendices & Resources](#15-appendices--resources)
16. [Version History](#16-version-history)

---

## 1. Executive Summary

### 1.1 Vision

Obsidian Planner is a powerful, flexible planning and task management plugin for Obsidian that unifies calendar events, tasks, and projects into a single, metadata-driven system. It combines the simplicity of note-based task management with the power of professional project management tools like GitHub Projects, Asana, and Trello.

### 1.2 Goals

- **Unified Planning**: Manage events, tasks, and projects in one system using consistent frontmatter metadata
- **Flexible Visualization**: View your data as Calendar, Agenda, Kanban, List, or Gantt chart
- **Power Through Simplicity**: A simple frontmatter schema that enables complex workflows
- **User Configurability**: Highly customizable statuses, priorities, calendars, and views
- **Obsidian-Native**: Deep integration with Obsidian's ecosystem (Bases, Daily Notes, Map View, etc.)

### 1.3 Non-Goals

- Replacing Obsidian's core note-taking functionality
- Building a standalone application outside of Obsidian
- Backward compatibility with TaskNotes plugin data

### 1.4 Success Criteria

- Users can replace Google Calendar and basic project management tools
- All five user personas can accomplish their primary workflows
- Plugin performs smoothly with 1000+ items
- Mobile and desktop feature parity where technically feasible

---

## 2. User Personas

### 2.1 The Casual Planner (Novice)

> "I am a novice Obsidian user and want an easy but robust replacement to Google Calendar."

- **Technical Level**: Beginner
- **Primary Need**: Simple calendar and task tracking
- **Key Features**: Calendar view, quick capture, recurring events
- **Success Metric**: Can create and manage events without reading documentation

### 2.2 The Power Organizer (Advanced)

> "I am an advanced Obsidian user and want an elegant and powerful replacement to Google Calendar and other personal project management tools I've used in the past like Asana and Trello."

- **Technical Level**: Advanced
- **Primary Need**: Comprehensive task and project management
- **Key Features**: Kanban, dependencies, time tracking, calendar sync
- **Success Metric**: Can replicate their Asana/Trello workflows entirely in Obsidian

### 2.3 The Hobby Project Manager

> "I am a very organized person and have a ton of hobby projects I have notes for in Obsidian, but no way to visualize them in a time-based format. It would be nice to plan out my year in a Gantt chart and Calendar."

- **Technical Level**: Intermediate
- **Primary Need**: Long-term project visualization
- **Key Features**: Gantt view, parent/subtask hierarchy, date_scheduled → date_eta planning
- **Success Metric**: Can visualize a year-long project with milestones and dependencies

### 2.4 The Professional PM

> "I am a project manager in a software engineering team and need an alternative to GitHub Projects, Asana, Clickup, Microsoft-Planner, etc. for managing multiple software projects at once."

- **Technical Level**: Advanced
- **Primary Need**: Multi-project management with team visibility
- **Key Features**: Configurable Gantt, swimlanes, batch operations, HTTP API
- **Success Metric**: Can manage 3+ concurrent projects with dependencies across them

### 2.5 The Life Planner (Super-Planner)

> "I am a super organized person and want to track my habits, hobbies, vacation plans, holidays, weekend trips on a Calendar. I am a planning guru. I want to plan out everything: every event, every task. I want to see every news article that I read on a calendar. I love Calendars and Gantt charts because they give me a big picture of my life; past, present, and future."

- **Technical Level**: Advanced
- **Primary Need**: Comprehensive life tracking and visualization
- **Key Features**: Multiple calendars with colors, tag-based filtering, all views
- **Success Metric**: Can track and visualize all life events in a unified system

### 2.6 The Academic Researcher

> "I am a PhD student juggling multiple research projects, paper deadlines, conference submissions, and teaching responsibilities. I need to track my literature review progress, writing milestones, and collaboration meetings with advisors in one place."

- **Technical Level**: Intermediate
- **Primary Need**: Academic project tracking with deadline management
- **Key Features**: Gantt for paper timelines, calendar for conferences, dependencies for research phases
- **Success Metric**: Can plan and track a multi-year research project with clear milestones

### 2.7 The Content Creator

> "I am a YouTuber/blogger/podcaster managing a content calendar. I need to track video ideas, filming schedules, editing deadlines, and publication dates. I want to see my content pipeline at a glance."

- **Technical Level**: Intermediate
- **Primary Need**: Content pipeline visualization
- **Key Features**: Kanban for content stages (idea → scripting → filming → editing → published), calendar for publish dates
- **Success Metric**: Can manage a consistent content schedule with 4+ pieces in the pipeline

### 2.8 The Freelancer

> "I am a freelance consultant managing multiple client projects simultaneously. I need to track billable hours, project milestones, and client meetings while ensuring nothing falls through the cracks."

- **Technical Level**: Intermediate to Advanced
- **Primary Need**: Multi-client project tracking with time management
- **Key Features**: Time tracking, Gantt for project timelines, calendar separation by client
- **Success Metric**: Can manage 5+ concurrent client projects with accurate time tracking

### 2.9 The Event Planner

> "I am organizing a wedding/conference/retreat and need to coordinate dozens of vendors, tasks, and timelines. I need to see what's happening when and ensure all dependencies are met before the big day."

- **Technical Level**: Beginner to Intermediate
- **Primary Need**: Event countdown with vendor/task coordination
- **Key Features**: Dependencies, Gantt for planning timeline, calendar for vendor appointments
- **Success Metric**: Can plan a complex event 6+ months out with all tasks and milestones tracked

---

## 3. Core Concepts

### 3.1 Items

An **Item** is the fundamental unit in Obsidian Planner. Every item is a Markdown note with structured frontmatter metadata.

Items can be either:
- **Events**: Things that happen at a specific time (`task: false`)
- **Tasks**: Things that need to be done (`task: true`)

Both use the same note template and frontmatter schema. The `task` boolean field determines behavior differences.

### 3.2 Events vs Tasks

| Aspect | Events (`task: false`) | Tasks (`task: true`) |
|--------|------------------------|----------------------|
| Shows in Calendar | ✅ Yes | ✅ Yes |
| Shows in Task List | ❌ No | ✅ Yes |
| Has Status | ❌ No | ✅ Yes |
| Has Priority | ❌ No | ✅ Yes |
| Can be Completed | ❌ No | ✅ Yes |
| Can have Dependencies | ❌ No | ✅ Yes |
| Can have Subtasks | ❌ No | ✅ Yes |
| Can Recur | ✅ Yes | ✅ Yes |

### 3.3 Hierarchy

Items can be organized hierarchically using `parent_task` and `subtasks` fields:

```
Project (parent task)
├── Phase 1 (subtask / parent of sub-subtasks)
│   ├── Task A
│   └── Task B
└── Phase 2
    ├── Task C
    └── Task D
```

- Nesting depth is **unlimited**
- A "project" is simply a task with subtasks (no separate concept)
- Subtasks block parent completion (parent cannot be marked Done until all subtasks are Done)
- In Gantt view, subtasks appear indented under parents

### 3.4 Dependencies

Tasks can have blocking relationships independent of the parent/subtask hierarchy:

- `blocked_by`: List of tasks that must be completed before this task can start
- `blocking`: **Auto-computed** list of tasks that this task blocks

If Task A has `blocked_by: [[Task B]]`, then Task B automatically shows Task A in its `blocking` field.

### 3.5 Calendars

The `calendar` field (list type) allows categorizing items by calendar. Features:

- An item can belong to **multiple calendars**
- Calendars are defined ad-hoc (just type a name)
- Users can assign colors to calendar names in settings
- Undefined calendars use a default color
- A **default calendar** can be set for new items

### 3.6 Recurrence

Items can recur using modular iCal-compatible fields (see [Data Model](#4-data-model) for full specification). When a recurring item instance is completed:

- The completion date is added to `repeat_instances_done`
- The next instance is automatically calculated and shown

---

## 4. Data Model

### 4.1 Frontmatter Schema

All fields use `snake_case` naming convention. All date fields use Obsidian's `Date & Time` property type.

#### Core Fields

| Field | Type | Description |
|-------|------|-------------|
| `title` | text | Display title (defaults to filename if not set) |
| `summary` | text | Short description shown in compact views (cards, Gantt bars) |
| `calendar` | list | Calendar(s) this item belongs to |
| `location` | list | Location coordinates for Map View integration (lat/long) |
| `context` | list | Context tags (e.g., @home, @work, @errands) |
| `people` | list | People involved (can link to Person notes) |
| `related` | list | Arbitrary links to related notes |
| `tags` | list | Standard Obsidian tags |

#### Type & Status Fields

| Field | Type | Description |
|-------|------|-------------|
| `all_day` | bool | Whether this is an all-day item (hides time in UI) |
| `task` | bool | `true` = task, `false` = event |
| `status` | text | Task status (Ideas, To-Do, In-Progress, In-Review, Done, Cancelled) |
| `priority` | text | Task priority (Urgent, High, Medium, Low, None) |
| `progress` | int | Completion percentage (0-100), only for tasks. Shown as progress bar in Gantt view. |

#### Date Fields

| Field | Type | Description |
|-------|------|-------------|
| `date_created` | datetime | When the item was created (auto-set) |
| `date_modified` | datetime | When the item was last modified (auto-set) |
| `date_scheduled` | datetime | When you plan to work on it / when event occurs |
| `date_started` | datetime | When you actually began working |
| `date_due` | datetime | External deadline (when it MUST be done) |
| `date_eta` | datetime | Your estimate of when you'll actually finish |
| `date_finished` | datetime | When completed (auto-set when status → Done) |

#### Recurrence Fields

| Field | Type | Description |
|-------|------|-------------|
| `repeat_frequency` | text | `secondly`, `minutely`, `hourly`, `daily`, `weekly`, `monthly`, `yearly` |
| `repeat_interval` | int | How often frequency repeats (e.g., 2 = every 2 weeks) |
| `repeat_until` | datetime | Fixed end date for recurrence |
| `repeat_count` | int | Total occurrences before expiry (0 = not recurring) |
| `repeat_by_day` | list | Days of week: `Mo`, `Tu`, `We`, `Th`, `Fr`, `Sa`, `Su` |
| `repeat_by_month` | list (int) | Specific months (1-12) |
| `repeat_by_monthday` | list (int) | Specific days of month (1-31 or -1 to -31) |
| `repeat_by_setposition` | int | Select specific instance (e.g., -1 for last) |
| `repeat_instances_done` | list | Dates of completed instances |

#### Hierarchy & Dependencies

| Field | Type | Description |
|-------|------|-------------|
| `parent_task` | text | Link to parent task |
| `subtasks` | list | Links to subtask notes |
| `blocked_by` | list | Tasks that must complete before this one |
| `blocking` | list | **Auto-computed**: Tasks this one blocks |

#### Time Tracking

| Field | Type | Description |
|-------|------|-------------|
| `time_estimate` | int | Estimated time in minutes |
| `time_entries` | list | Array of {start, end} time tracking records |
| `time_tracked_total` | int | **Computed**: Total tracked time in minutes |

#### Other Fields

| Field | Type | Description |
|-------|------|-------------|
| `reminders` | list | List of reminder datetimes (e.g., `["2025-01-15T09:00:00"]`) |
| `cover` | text | Path to image file for Kanban card cover (e.g., `"attachments/project-banner.png"`) |

### 4.2 Example Item

```yaml
---
title: Redesign Homepage
summary: Update homepage with new branding
calendar:
  - Work
  - Web Development
location: []
context:
  - "@office"
people:
  - "[[John Smith]]"
  - "[[Jane Doe]]"
related:
  - "[[Brand Guidelines]]"
tags:
  - design
  - priority-project
all_day: false
task: true
status: In-Progress
priority: High
progress: 35
date_created: 2025-01-10T09:00:00
date_modified: 2025-01-15T14:30:00
date_scheduled: 2025-01-15T09:00:00
date_started: 2025-01-15T09:15:00
date_due: 2025-01-20T17:00:00
date_eta: 2025-01-19T17:00:00
date_finished:
repeat_frequency: 
repeat_interval: 
repeat_until: 
repeat_count: 0
repeat_by_day: 
repeat_by_month: 
repeat_by_monthday: 
repeat_by_setposition: 
repeat_instances_done: 
parent_task: "[[Website Redesign Project]]"
subtasks:
  - "[[Create wireframes]]"
  - "[[Design mockups]]"
  - "[[Implement HTML/CSS]]"
blocked_by:
  - "[[Finalize brand colors]]"
blocking: 
time_estimate: 480
time_entries: 
time_tracked_total: 
reminders:
  - 2025-01-19T09:00:00
---

## Description

Full redesign of the company homepage incorporating new brand identity...

## Notes

- Meeting with stakeholders on Jan 12 went well
- Using Figma for mockups
```

### 4.3 Computed/Formula Fields

These fields are calculated by the plugin or Obsidian Bases formulas:

| Field | Computation |
|-------|-------------|
| `blocking` | Auto-populated: all tasks that have this task in their `blocked_by` |
| `time_tracked_total` | Sum of all `time_entries` durations |
| `date_relevant` | Smart date: `date_due` if set, else `date_scheduled`, else `date_created` (for sorting) |

---

## 5. Views

All views are powered by Obsidian Bases integration and stored as `.base` files.

### 5.1 Calendar View

A full calendar display showing items on their scheduled/due dates.

**Features:**
- Year, month, week, day, and agenda layouts
- Color-coded by `calendar` field (configurable in settings)
- Click date number to open corresponding Daily Note
- Click empty date area to create new item on that date
- Drag to reschedule items
- Shows both events and tasks
- Recurring items show all instances
- All-day items displayed in all-day section

**Grouping by any field:** By calendar, by status, by priority, by people, by context, etc.

### 5.2 Agenda View

A chronological list of upcoming items.

**Features:**
- Grouped by day/week/month/year
- Shows items with any date field set
- Configurable date field for sorting (date_scheduled, date_due, etc.)
- Quick status toggling
- Expandable item details

### 5.3 Kanban View

A board view with columns representing statuses or other fields.

**Features:**
- Drag-and-drop between columns
- Configurable column field (status, priority, calendar, etc.)
- Card displays summary, dates, priority indicator
- Swimlanes for additional grouping
- WIP limits per column (optional)
- **Cover images**: Support for `cover` frontmatter property to display image at top of card
- **Configurable card properties**: User can toggle which properties are shown on cards (like Obsidian Bases Cards view)

### 5.4 Task List View

A traditional list/table view of tasks.

**Features:**
- Sortable columns
- Inline editing of fields
- Bulk selection and batch operations
- Configurable visible columns
- Nested display of subtasks (collapsible)

### 5.5 Gantt View

A timeline visualization for project planning. Built on Frappe Gantt library.

**Core Features:**
- **Configurable bar start/end**: User selects which date fields define bar span (e.g., `date_scheduled` → `date_due`, or `date_started` → `date_eta`)
- **Configurable bar colors**: Color bars by any field (calendar, priority, status, people, etc.) — same as Calendar view
- **Configurable swimlanes**: Group by any field (calendar, status, parent_task, etc.)
- **Configurable sort order**: Stack bars in any order
- **Milestones**: Tasks where start date = end date shown as diamonds
- **Critical path highlighting**: (v1.1+)
- **Subtask indentation**: Subtasks appear indented under parents
- **Zoom levels**: hour, half-day, day, week, month, quarter, year
- **Virtual scrolling**: Lazy loading for performance with large datasets
- **Today marker**: Prominent vertical line showing current date, auto-scrolls to today on load
- **Date range picker**: Quick jump to specific time periods
- **Keyboard navigation**: Arrow keys to move between bars, Enter to open popup
- **Export**: PNG/PDF export for sharing project timelines

**Progress Bars (Tasks only):**
- Uses `progress` field (0-100 integer)
- Toggle to show/hide progress within Gantt bars
- Drag the internal progress bar to update `progress` in increments of 10
- Progress indicator also shown in bar popup

**Bar Click Popup:**
When user clicks a Gantt bar, a popup appears instantly with smart positioning (stays within viewport):
- **Always shows**: Item title (clickable to open the note)
- **Progress indicator**: For tasks, shows completion percentage
- **Quick-edit buttons**: Adjust dates without opening full modal
- **Configurable properties**: User can toggle which properties appear (like Obsidian Bases Cards view)
- **Status cycling**: Click status to cycle through statuses
- Popup dismisses on click outside or Esc key

**Bar Interactions:**
- **Drag to reschedule**: Shows ghost preview of new position
- **Snap-to-grid**: Snaps to boundaries matching current zoom level (hour, day, week, etc.)
- **Auto-adjust dependencies**: When bar is dragged past its dependencies, dependent tasks auto-adjust

**Dependencies:**
- **Toggle visibility**: UI toggle to show/hide dependency arrows
- **Visual editing**: Clicking a dependency arrow shows nodules at start/end for re-anchoring
- **Create dependencies**: Hover shows dot at bottom center of bar; drag from dot to another bar to create dependency
- **Arrow style**: Frappe Gantt style arrows

**Swimlanes & Grouping:**
- When grouped by `parent_task`, the parent task's own bar serves as the group summary
- Empty groups (parent with no matching children) shown as normal bars

**Mobile:**
- Tap bar → opens popup
- Long-press bar → initiates drag
- Pinch-to-zoom → changes zoom level (zoom menu updates to reflect)

**Inspiration**: [GitHub Projects Roadmap View](https://docs.github.com/en/issues/planning-and-tracking-with-projects), [Frappe Gantt](https://frappe.io/gantt)

---

## 6. Features

### 6.1 Quick Capture with NLP

A keyboard-driven quick entry system for rapid item creation.

**Trigger:** Global hotkey opens floating input field

**Syntax:**
```
Buy groceries tomorrow at 2pm @errands +[[Home Project]] #shopping *high
```

**Parsing:**

| Token | Meaning |
|-------|---------|
| Plain text | Title |
| `tomorrow at 2pm` | Natural language date → `date_scheduled` |
| `@errands` | Context |
| `+[[Note]]` | Parent task link |
| `#shopping` | Tag |
| `*high` or `!high` | Priority |
| `>In-Progress` | Status |

**Behavior:**
- Creates item immediately without opening modal
- Shows confirmation toast with "Edit" link
- Uses default calendar if none specified

### 6.2 Recurring Items

Modular iCal-compatible recurrence system.

**Examples:**

Daily at 9am:
```yaml
repeat_frequency: daily
repeat_interval: 1
date_scheduled: 2025-01-01T09:00:00
```

Every 2 weeks on Tuesday and Thursday:
```yaml
repeat_frequency: weekly
repeat_interval: 2
repeat_by_day:
  - Tu
  - Th
```

Last Friday of every month:
```yaml
repeat_frequency: monthly
repeat_by_day:
  - Fr
repeat_by_setposition: -1
```

**Instance Completion:**
- Completing an instance adds the date to `repeat_instances_done`
- Next instance is calculated and shown
- Original item remains (not duplicated)

### 6.3 Parent/Subtask Hierarchy

Unlimited nesting of tasks.

**Behavior:**
- `subtasks` field lists child task links
- `parent_task` field links to parent
- Parent cannot be marked Done until all subtasks are Done
- In Gantt: subtasks indented under parent
- In List: collapsible tree structure

### 6.4 Dependencies

Block tasks based on other tasks' completion.

**Behavior:**
- Add tasks to `blocked_by` field
- `blocking` field auto-computed (reverse lookup)
- Blocked tasks show indicator badge in views
- Optional: prevent status change to In-Progress if blocked

### 6.5 Batch Operations

Perform actions on multiple selected items.

**Available Operations:**
- Reschedule to new date
- Change status
- Change priority
- Assign to calendar(s)
- Add/remove tags
- Set parent task
- Delete

**UI:** Multi-select in any list/table view, then action menu

### 6.6 Time Tracking & Pomodoro

Carried over from TaskNotes with renamed fields.

**Features:**
- Start/stop timer on any task
- Manual time entry logging
- Pomodoro timer with configurable intervals
- Time estimates vs actual tracking
- Statistics view for productivity analysis

### 6.7 Calendar Sync

Integration with external calendars.

**Supported:**
- Google Calendar (OAuth)
- Microsoft Outlook (OAuth)
- ICS feed subscriptions (read-only)
- ICS export

**Sync Behavior:**
- External events can create items in Obsidian Planner
- Planner items can sync back to external calendars
- Two-way sync with conflict resolution

### 6.8 HTTP API

REST API for external integrations (desktop only).

**Endpoints:**
- `GET /api/items` - List items with filtering
- `POST /api/items` - Create item
- `GET /api/items/:id` - Get item details
- `PUT /api/items/:id` - Update item
- `DELETE /api/items/:id` - Delete item
- Webhook support for automation

---

## 7. Settings

### 7.1 General Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Items Folder | path | `Planner/` | Where new items are created |
| Archive Folder | path | `Planner/Archive/` | Where archived items go |
| Default Calendar | text | (none) | Auto-assigned to new items |
| Date Format | select | `YYYY-MM-DD` | Display format for dates |
| Time Format | select | `24h` | 12-hour or 24-hour |
| Week Starts On | select | `Monday` | First day of week |

### 7.2 Identification Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Identification Method | select | `folder` | How to identify planner items: `folder`, `tag`, or `both` |
| Include Folders | list | `["Planner/"]` | Folders to scan for items |
| Include Tags | list | `["#planner"]` | Tags that identify items |

### 7.3 Status Configuration

Fully customizable status definitions.

| Status | Color | Completed | Description |
|--------|-------|-----------|-------------|
| Ideas | Purple | No | Inbox/someday-maybe |
| To-Do | Gray | No | Ready to work on |
| In-Progress | Blue | No | Currently working |
| In-Review | Orange | No | Awaiting feedback |
| Done | Green | Yes | Completed |
| Cancelled | Red | Yes | Won't do |

Users can add, remove, and reorder statuses.  Users assign colors via a color picker.

### 7.4 Priority Configuration

Customizable priority levels.

| Priority | Color | Weight |
|----------|-------|--------|
| Urgent | Red | 4 |
| High | Orange | 3 |
| Medium | Yellow | 2 |
| Low | Blue | 1 |
| None | Gray | 0 |

Users can add, remove, and reorder priorities.  Users assign colors via a color picker.

### 7.5 Calendar Configuration

Define calendars and their colors.

| Calendar  | Color  |
| --------- | ------ |
| Personal  | Blue   |
| Work      | Green  |
| Family    | Purple |
| (default) | Gray   |

New calendar names automatically created; users assign colors later via a color picker.

### 7.6 Quick Capture Settings

| Setting          | Type   | Default        | Description                       |
| ---------------- | ------ | -------------- | --------------------------------- |
| Hotkey           | hotkey | `Ctrl+Shift+N` | Global quick capture trigger      |
| Default as Task  | bool   | `true`         | New items default to `task: true` |
| Default Status   | select | `To-Do`        | Status for new tasks              |
| Default Priority | select | `None`         | Priority for new items            |
| NLP Language     | select | `English`      | Natural language parsing language |

### 7.7 Pomodoro Settings

| Setting | Type | Default | Description |
|---------|------|---------|-------------|
| Work Duration | int | 25 | Minutes per work session |
| Short Break | int | 5 | Minutes for short break |
| Long Break | int | 15 | Minutes for long break |
| Sessions Before Long Break | int | 4 | Work sessions before long break |
| Auto-start Breaks | bool | true | Automatically start break timer |

### 7.8 View Defaults

Default configuration for each view type (can be overridden per-view).

### 7.9 Color Picker Implementation

All color customization throughout the plugin uses Obsidian's native color picker (same as Settings > Appearance > Accent Color).

**Color picker is used for:**
- Status colors
- Priority colors
- Calendar colors
- Any future color customization

**Implementation:**
- Use Obsidian's built-in `ColorComponent` from the Settings API
- Colors stored as hex values (e.g., `#4A90D9`)
- Default colors provided for all built-in statuses, priorities, and the default calendar

---

## 8. Default Views

Obsidian Planner ships with pre-built `.base` view files showcasing the system's capabilities.

### 8.1 All Items (`items-all.base`)

**Type:** Task List

**Tabs:**
- All Items (no filter)
- Tasks Only (`task = true`)
- Events Only (`task = false`)
- Ideas (`status = Ideas`)
- Active (`status IN [To-Do, In-Progress, In-Review]`)
- Completed (`status IN [Done, Cancelled]`)

### 8.2 Today (`items-today.base`)

**Type:** Agenda

**Filter:** `date_scheduled = today OR date_due = today`

**Tabs:**
- Today's Schedule
- Overdue (`date_due < today AND status NOT IN [Done, Cancelled]`)
- Coming Up (next 7 days)

### 8.3 Kanban Board (`kanban-status.base`)

**Type:** Kanban

**Columns:** Status field

**Tabs:**
- By Status (default)
- By Priority
- By Calendar

### 8.4 Calendar (`calendar-default.base`)

**Type:** Calendar

**Color By:** Calendar field

**Tabs:**
- Year View (`Y`)
- Month View (`M`)
- Week View (`W`)
- 3-Day View (`3D`)
- Day View (`D`)
- Day List View (`L`)

### 8.5 Gantt (`gantt-default.base`)

**Type:** Gantt

**Bar Definition:** `date_scheduled` → `date_due`

**Tabs:**
- All Projects
- This Month
- This Quarter

### 8.6 Relationships (`relationships.base`)

**Type:** Task List

**Focus:** Dependency visualization

**Tabs:**
- Blocked Tasks (`blocked_by IS NOT EMPTY`)
- Blocking Tasks (`blocking IS NOT EMPTY`)

---

## 9. User Flow & Design

### 9.1 First-Run Experience

1. **Welcome Modal**: Brief introduction to Obsidian Planner
2. **Folder Setup**: Confirm or change default `Planner/` folder
3. **Quick Tutorial**: Optional walkthrough creating first item
4. **Default Views Created**: Base files added to `Planner/Views/`

### 9.2 Creating an Item

**Method 1: Quick Capture (Fastest)**
1. Press `Ctrl+Shift+N`
2. Type: `Team meeting tomorrow 2pm @work #recurring`
3. Press Enter
4. Item created, confirmation shown

**Method 2: Command Palette**
1. `Ctrl+P` → "Planner: New Item"
2. Modal opens with form
3. Fill in fields (with NLP support in text inputs)
4. Click Create

**Method 3: Calendar Click**
1. Open Calendar view
2. Click on a date
3. Modal opens with date pre-filled
4. Fill in details, Create

**Method 4: From Note**
1. In any note, use "Planner: Create Item from Note" command
2. Current note becomes an item (frontmatter added)

### 9.3 Item Card Design

```
┌─────────────────────────────────────────────┐
│ 🔵 [Status]  ⚡ [Priority]  📅 Jan 15      │
│                                             │
│ Item Title                                  │
│ Summary text shown here...                  │
│                                             │
│ 🏷️ #tag1 #tag2    📁 Calendar Name         │
│ 🔗 Blocked by: 2 tasks                      │
└─────────────────────────────────────────────┘
```

### 9.4 Wireframes & Mockups

#### 9.4.1 Quick Capture Floating Input

A minimal, focused input that appears centered on screen when triggered by hotkey.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ 🚀 Buy groceries tomorrow at 2pm @errands #shopping *high            │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │ 📅 Tomorrow, 2:00 PM   @errands   #shopping   ⚡ High               │    │
│  └─────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  [Enter] Create  •  [Tab] Expand to Modal  •  [Esc] Cancel                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

                          (dimmed background overlay)
```

**States:**
- Empty: Shows placeholder "Type to create... (use @ # * + for context, tags, priority, parent)"
- Typing: Real-time NLP parsing with preview chips below
- Parsed: Shows recognized entities as colored chips

---

#### 9.4.2 Item Creation/Edit Modal

Full modal for creating or editing items with all fields accessible.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ✕                        New Item                              [Create ▼] │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Title ─────────────────────────────────────────────────────────────────    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Redesign Homepage                                                     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  Summary ───────────────────────────────────────────────────────────────    │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ Update homepage with new branding guidelines                          │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  ┌─────────────────────────┐  ┌─────────────────────────┐                   │
│  │ ☐ Task                  │  │ ☐ All Day               │                   │
│  └─────────────────────────┘  └─────────────────────────┘                   │
│                                                                             │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐   │
│  │ Status      │ To-Do         ▼ │  │ Priority    │ High           ▼ │   │
│  └─────────────────────────────────┘  └─────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────┐  ┌─────────────────────────────────┐   │
│  │ Calendar    │ Work, Design   ▼ │  │ Parent      │ [[Website...]] ▼ │   │
│  └─────────────────────────────────┘  └─────────────────────────────────┘   │
│                                                                             │
│  ── Dates ──────────────────────────────────────────────────────────────    │
│                                                                             │
│  ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐       │
│  │ Scheduled          │ │ Due                │ │ ETA                │       │
│  │ 📅 Jan 15, 9:00 AM │ │ 📅 Jan 20, 5:00 PM │ │ 📅 Jan 19, 5:00 PM │       │
│  └────────────────────┘ └────────────────────┘ └────────────────────┘       │
│                                                                             │
│  ── Recurrence ─────────────────────────────────────────────────────────    │
│                                                                             │
│  ┌───────────────┐ ┌─────────────┐ ┌─────────────────────────────────────┐  │
│  │ Frequency     │ │ Interval    │ │ Days                                │  │
│  │ Weekly      ▼ │ │ 1           │ │ [Mo] [Tu] [We] [Th] [Fr] [ ] [ ]    │  │
│  └───────────────┘ └─────────────┘ └─────────────────────────────────────┘  │
│                                                                             │
│  ── Additional ─────────────────────────────────────────────────────────    │
│                                                                             │
│  Context    ┌──────────────────────────────────────────────────────────┐    │
│             │ @office, @computer                                       │    │
│             └──────────────────────────────────────────────────────────┘    │
│                                                                             │
│  People     ┌──────────────────────────────────────────────────────────┐    │
│             │ [[John Smith]], [[Jane Doe]]                             │    │
│             └──────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Tags       ┌──────────────────────────────────────────────────────────┐    │
│             │ #design #priority-project                                │    │
│             └──────────────────────────────────────────────────────────┘    │
│                                                                             │
│  Reminders  ┌──────────────────────────────────────────────────────────┐    │
│             │ 📅 Jan 19, 9:00 AM                              [+ Add]  │    │
│             └──────────────────────────────────────────────────────────┘    │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                              [Cancel]  [Create Item]        │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Sections (collapsible):**
- Core: Title, Summary, Task/All-Day toggles, Status, Priority
- Dates: Scheduled, Due, ETA (Started/Finished shown in edit mode)
- Recurrence: Frequency, Interval, Days, Until/Count
- Additional: Context, People, Tags, Reminders, Location, Related

---

#### 9.4.3 Calendar View

Monthly calendar with items displayed on their scheduled/due dates.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Calendar                                              [Month ▼] [+ New]    │
├─────────────────────────────────────────────────────────────────────────────┤
│  [All Tasks] [Today] [Overdue] [This Week]              🔍 Filter...        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│        ◀  January 2025  ▶                         [Y] [M] [W] [3D] [D] [L]  │
│                                                                             │
│  ┌────────┬────────┬────────┬────────┬────────┬────────┬────────┐           │
│  │  Mon   │  Tue   │  Wed   │  Thu   │  Fri   │  Sat   │  Sun   │           │
│  ├────────┼────────┼────────┼────────┼────────┼────────┼────────┤           │
│  │   30   │   31   │    1   │    2   │    3   │    4   │    5   │           │
│  │        │        │ 🎉 New │        │        │        │        │           │
│  │        │        │ Year   │        │        │        │        │           │
│  ├────────┼────────┼────────┼────────┼────────┼────────┼────────┤           │
│  │    6   │    7   │    8   │    9   │   10   │   11   │   12   │           │
│  │        │ 🟢Work │ 🟢Work │        │ 🟣Fam  │        │        │           │
│  │        │ Mtg    │ Review │        │ Dinner │        │        │           │
│  ├────────┼────────┼────────┼────────┼────────┼────────┼────────┤           │
│  │   13   │   14   │   15   │   16   │   17   │   18   │   19   │           │
│  │        │        │ 🟢Home │ 🟢Home │        │        │ 🔴DUE  │           │
│  │        │        │ page   │ page   │        │        │ Sprint │           │
│  │        │        │ 🔵Pers │        │        │        │        │           │
│  │        │        │ Dentist│        │        │        │        │           │
│  ├────────┼────────┼────────┼────────┼────────┼────────┼────────┤           │
│  │   20   │   21   │   22   │   23   │   24   │   25   │   26   │           │
│  │ 🟢Dep  │        │        │        │        │        │        │           │
│  │ Review │        │        │        │        │        │        │           │
│  ├────────┼────────┼────────┼────────┼────────┼────────┼────────┤           │
│  │   27   │   28   │   29   │   30   │   31   │    1   │    2   │           │
│  │        │        │        │        │        │        │        │           │
│  └────────┴────────┴────────┴────────┴────────┴────────┴────────┘           │
│                                                                             │
│  Legend: 🟢 Work  🔵 Personal  🟣 Family  🔴 Urgent                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Interactions:**
- Click date number → Open corresponding Daily Note for that date
- Click empty date area → Quick create modal for that date
- Click item → Open item in sidebar or modal
- Drag item → Reschedule to new date
- Color = Calendar field value (configurable)

---

#### 9.4.4 Kanban Board

Drag-and-drop board with columns for each status (or other grouping field).

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Kanban Board                                      [By Status ▼] [+ New]    │
├─────────────────────────────────────────────────────────────────────────────┤
│  [All Tasks] [My Tasks] [This Sprint]               🔍 Filter...            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│  │ 💡 Ideas    │ │ 📋 To-Do    │ │ 🔄 In-Prog  │ │ ✅ Done     │            │
│  │    (3)      │ │    (5)      │ │    (2)      │ │    (12)     │            │
│  ├─────────────┤ ├─────────────┤ ├─────────────┤ ├─────────────┤            │
│  │┌───────────┐│ │┌───────────┐│ │┌───────────┐│ │┌───────────┐│            │
│  ││ Mobile app││ ││⚡ Homepage ││ ││⚡ API docs ││ ││ User auth ││            │
│  ││ redesign  ││ ││ redesign  ││ ││           ││ ││           ││            │
│  ││           ││ ││───────────││ ││───────────││ ││───────────││            │
│  ││ 🏷️ design ││ ││📅 Jan 20  ││ ││📅 Jan 18  ││ ││✓ Jan 10   ││            │
│  ││           ││ ││🟢 Work    ││ ││🟢 Work    ││ ││🟢 Work    ││            │
│  │└───────────┘│ │└───────────┘│ │└───────────┘│ │└───────────┘│            │
│  │             │ │             │ │             │ │             │            │
│  │┌───────────┐│ │┌───────────┐│ │┌───────────┐│ │┌───────────┐│            │
│  ││ Dark mode ││ ││ Database  ││ ││ Sprint    ││ ││ Payment   ││            │
│  ││ support   ││ ││ migration ││ ││ planning  ││ ││ gateway   ││            │
│  ││           ││ ││───────────││ ││───────────││ ││───────────││            │
│  ││           ││ ││🔗 Blocked ││ ││📅 Jan 19  ││ ││✓ Jan 8    ││            │
│  │└───────────┘│ ││  by 1     ││ │└───────────┘│ │└───────────┘│            │
│  │             │ │└───────────┘│ │             │ │             │            │
│  │┌───────────┐│ │             │ │             │ │ ┌─ ─ ─ ─ ─┐ │            │
│  ││ Analytics ││ │┌───────────┐│ │             │ │ │ +11 more │ │            │
│  ││ dashboard ││ ││ Unit tests││ │             │ │ └─ ─ ─ ─ ─┘ │            │
│  │└───────────┘│ │└───────────┘│ │             │ │             │            │
│  │             │ │             │ │             │ │             │            │
│  │  [+ Add]    │ │  [+ Add]    │ │  [+ Add]    │ │             │            │
│  └─────────────┘ └─────────────┘ └─────────────┘ └─────────────┘            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Card Anatomy:**
```
┌─────────────────────┐
│ ⚡ Title            │  ← Priority indicator + Title
│ Summary preview...  │  ← Summary (if set)
│─────────────────────│
│ 📅 Jan 20           │  ← Due date (or scheduled)
│ 🟢 Work  🏷️ #tag    │  ← Calendar + Tags
│ 🔗 Blocked by 2     │  ← Dependency indicator (if blocked)
└─────────────────────┘
```

**Interactions:**
- Drag card → Move to new column (updates status/field)
- Click card → Open item detail
- Hover → Show full summary tooltip

---

#### 9.4.5 Gantt Chart

Timeline visualization with configurable bars and dependency arrows.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Gantt Chart                                          [Quarter ▼] [+ New]   │
├─────────────────────────────────────────────────────────────────────────────┤
│  Bar: [date_scheduled ▼] → [date_due ▼]    Swimlanes: [Parent Task ▼]       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│            │ Jan 6  │ Jan 13 │ Jan 20 │ Jan 27 │ Feb 3  │ Feb 10 │          │
│  ──────────┼────────┼────────┼────────┼────────┼────────┼────────┤          │
│            │        │        │        │        │        │        │          │
│  ▼ Website Redesign Project                                                 │
│  ──────────┼────────┼────────┼────────┼────────┼────────┼────────┤          │
│            │        │        │        │        │        │        │          │
│    Brand   │ ████████████████│        │        │        │        │          │
│    Guide   │ ■■■■■■■■■■■■■■■■│        │        │        │        │          │
│            │        │        │        │        │        │        │          │
│    Home-   │        │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│        │        │        │          │
│    page ──────────────────────┘       │        │        │        │          │
│            │        │   │    │        │        │        │        │          │
│    About   │        │   └────┼──▓▓▓▓▓▓▓▓▓▓▓▓▓▓│        │        │          │
│    Page    │        │        │        │        │        │        │          │
│            │        │        │        │        │        │        │          │
│    Launch  │        │        │        │        ◆        │        │          │
│    (mile)  │        │        │        │        │        │        │          │
│            │        │        │        │        │        │        │          │
│  ▼ Mobile App                                                               │
│  ──────────┼────────┼────────┼────────┼────────┼────────┼────────┤          │
│            │        │        │        │        │        │        │          │
│    UI      │        │        │ ░░░░░░░░░░░░░░░░░░░░░░░░░░▓▓▓▓▓▓▓│          │
│    Design  │        │        │        │        │        │        │          │
│            │        │        │        │        │        │        │          │
│    Backend │        │        │        │░░░░░░░░░░░░░░░░░░░░░░░░░░│          │
│    API     │        │        │        │        │        │        │          │
│            │        │        │        │        │        │        │          │
└─────────────────────────────────────────────────────────────────────────────┘

Legend:
  ████  Completed        ▓▓▓▓  In Progress      ░░░░  Scheduled
  ────► Dependency       ◆     Milestone        ▼     Collapsed group
```

**Bar Types:**
- `████` Solid = Completed (status = Done)
- `▓▓▓▓` Hatched = In Progress
- `░░░░` Light = Scheduled/To-Do
- `◆` Diamond = Milestone (start date = end date)

**Interactions:**
- Drag bar ends → Adjust start/end dates
- Drag whole bar → Move entire date range
- Click bar → Open item detail (with button to Open Note)
- Hover dependency arrow → Highlight connected items
- Click swimlane header → Collapse/expand group
- Scroll/pinch → Zoom timeline (day/week/month/quarter/year)

**Toolbar Options:**
- Bar start field selector
- Bar end field selector
- Swimlane grouping selector
- Zoom level control
- Today line toggle
- Show dependencies toggle
- Sort menu (Obsidian Bases)
- Filter menu (Obsidian Bases)
- Properties menu (Obsidian Bases)

---

#### 9.4.5.1 Gantt Bar Popup

When a user clicks on a Gantt bar, this popup appears instantly with smart positioning (stays within viewport).

```
                              ┌─────────────────────────────────────────┐
                              │  🔗 Homepage Redesign                   │
                              ├─────────────────────────────────────────┤
                              │                                         │
                              │  Progress ──────────────────────────    │
                              │  ┌────────────────────────────────────┐ │
                              │  │████████████████████░░░░░░░░░░░░░░░░│ │
                              │  └────────────────────────────────────┘ │
                              │                                  60%    │
                              │                                         │
                              ├─────────────────────────────────────────┤
                              │                                         │
                              │  Status        ┌──────────────────────┐ │
                              │                │ 🔄 In-Progress     ▼ │ │
                              │                └──────────────────────┘ │
                              │                                         │
                              ├─────────────────────────────────────────┤
                              │                                         │
                              │  ── Quick Edit Dates ───────────────    │
                              │                                         │
                              │  Scheduled      Due              ETA    │
                              │  ┌──────────┐   ┌──────────┐   ┌──────────┐
                              │  │ Jan 13   │   │ Jan 22   │   │ Jan 20   │
                              │  │ [◀] [▶]  │   │ [◀] [▶]  │   │ [◀] [▶]  │
                              │  └──────────┘   └──────────┘   └──────────┘
                              │                                         │
                              ├─────────────────────────────────────────┤
                              │                                         │
                              │  Priority      Calendar                 │
                              │  ⚡ High        🟢 Work                  │
                              │                                         │
                              │  Blocked by                             │
                              │  🔗 Brand Guidelines                    │
                              │                                         │
                              │  Tags                                   │
                              │  #design  #priority-project             │
                              │                                         │
                              ├─────────────────────────────────────────┤
                              │           [Open Note]  [Edit Item]      │
                              └─────────────────────────────────────────┘
```

**Popup Sections:**

1. **Header**: Item title as clickable link (opens the note directly)

2. **Progress Bar** (tasks only):
   - Visual progress indicator showing `progress` field (0-100%)
   - Drag the bar to adjust progress in increments of 10
   - Hidden for events (`task: false`)

3. **Status Selector**:
   - Dropdown to change status
   - Click to cycle through statuses in order
   - Color indicator matches status configuration

4. **Quick Edit Dates**:
   - Shows `date_scheduled`, `date_due`, and `date_eta`
   - Arrow buttons (`◀` `▶`) nudge date by one day/unit
   - Click date to open date picker
   - Fields appear based on what's set on the item

5. **Configurable Properties**:
   - User toggles which properties appear (like Obsidian Bases Cards view)
   - Common properties: Priority, Calendar, Blocked by, Tags, People
   - Dependencies shown as clickable links

6. **Action Buttons**:
   - "Open Note" → Opens the full markdown note
   - "Edit Item" → Opens the full item modal

**Compact Variant (fewer properties enabled):**

```
                              ┌─────────────────────────────────────────┐
                              │  🔗 Team Meeting                        │
                              ├─────────────────────────────────────────┤
                              │  Scheduled      Due                     │
                              │  ┌──────────┐   ┌──────────┐            │
                              │  │ Jan 15   │   │ Jan 15   │            │
                              │  │ 2:00 PM  │   │ 3:00 PM  │            │
                              │  │ [◀] [▶]  │   │ [◀] [▶]  │            │
                              │  └──────────┘   └──────────┘            │
                              │                                         │
                              │  Calendar       Location                │
                              │  🔵 Work        Conference Room B       │
                              │                                         │
                              ├─────────────────────────────────────────┤
                              │           [Open Note]  [Edit Item]      │
                              └─────────────────────────────────────────┘
```

**Interactions:**
- Popup appears instantly on bar click (no loading delay)
- Smart positioning: popup stays within viewport bounds
- Click title → Opens the markdown note
- Click outside popup or press `Esc` → Dismisses popup
- Click status → Cycles to next status
- Drag progress bar → Updates `progress` field (increments of 10)
- Click `◀`/`▶` → Nudges date by one unit (day at day-level zoom, week at week-level, etc.)
- Click property link (e.g., blocked-by item) → Navigates to that item

---

#### 9.4.6 Settings Page

Organized settings with tabs for different configuration areas.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ⚙️ Obsidian Planner Settings                                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  [General] [Statuses] [Priorities] [Calendars] [Quick Capture] [Pomodoro]   │
│                                                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ══ GENERAL SETTINGS ═══════════════════════════════════════════════════    │
│                                                                             │
│  Items Folder                                                               │
│  ┌─────────────────────────────────────────────────────────┐ [Browse]       │
│  │ Planner/                                                │                │
│  └─────────────────────────────────────────────────────────┘                │
│  Where new items are created.                                               │
│                                                                             │
│  Archive Folder                                                             │
│  ┌─────────────────────────────────────────────────────────┐ [Browse]       │
│  │ Planner/Archive/                                        │                │
│  └─────────────────────────────────────────────────────────┘                │
│  Where completed items are moved when archived.                             │
│                                                                             │
│  ── Item Identification ──────────────────────────────────────────────────  │
│                                                                             │
│  Identification Method                                                      │
│  ┌─────────────────────────────────────────────────────────┐                │
│  │ ◉ By Folder    ○ By Tag    ○ Both                       │                │
│  └─────────────────────────────────────────────────────────┘                │
│                                                                             │
│  Include Folders                                                            │
│  ┌─────────────────────────────────────────────────────────┐                │
│  │ Planner/                                          [+ Add]│                │
│  └─────────────────────────────────────────────────────────┘                │
│                                                                             │
│  ── Display ──────────────────────────────────────────────────────────────  │
│                                                                             │
│  Date Format                           Time Format                          │
│  ┌─────────────────────┐               ┌─────────────────────┐              │
│  │ YYYY-MM-DD        ▼ │               │ 24-hour           ▼ │              │
│  └─────────────────────┘               └─────────────────────┘              │
│                                                                             │
│  Week Starts On                        Default Calendar                     │
│  ┌─────────────────────┐               ┌─────────────────────┐              │
│  │ Monday            ▼ │               │ Personal          ▼ │              │
│  └─────────────────────┘               └─────────────────────┘              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Statuses Tab:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ══ STATUS CONFIGURATION ═══════════════════════════════════════════════    │
│                                                                             │
│  Drag to reorder. Statuses marked "Completed" will hide items from          │
│  active views and auto-set date_finished.                                   │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │ ≡  💜 Ideas        │ Inbox/someday-maybe              │ ☐ Completed  │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │ ≡  ⬜ To-Do        │ Ready to work on                 │ ☐ Completed  │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │ ≡  🔵 In-Progress  │ Currently working                │ ☐ Completed  │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │ ≡  🟠 In-Review    │ Awaiting feedback                │ ☐ Completed  │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │ ≡  🟢 Done         │ Completed                        │ ☑ Completed  │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │ ≡  🔴 Cancelled    │ Won't do                         │ ☑ Completed  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  [+ Add Status]                                                             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Calendars Tab:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ══ CALENDAR CONFIGURATION ═════════════════════════════════════════════    │
│                                                                             │
│  Define colors for your calendars. New calendar names are created           │
│  automatically when you use them.                                           │
│                                                                             │
│  Default Calendar                                                           │
│  ┌─────────────────────────────────────────────────────────┐                │
│  │ Personal                                              ▼ │                │
│  └─────────────────────────────────────────────────────────┘                │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  🔵  Personal                                                   [✕]  │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │  🟢  Work                                                       [✕]  │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │  🟣  Family                                                     [✕]  │  │
│  ├───────────────────────────────────────────────────────────────────────┤  │
│  │  🟡  Side Projects                                              [✕]  │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  [+ Add Calendar]                                                           │
│                                                                             │
│  ── External Calendar Sync ───────────────────────────────────────────────  │
│                                                                             │
│  Google Calendar     [Not Connected]                        [Connect]       │
│  Microsoft Outlook   [Connected: user@example.com]          [Disconnect]    │
│                                                                             │
│  ── ICS Subscriptions ────────────────────────────────────────────────────  │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐  │
│  │  📅 US Holidays                                                       │  │
│  │     https://calendar.google.com/...                     [🔄] [✕]     │  │
│  └───────────────────────────────────────────────────────────────────────┘  │
│                                                                             │
│  [+ Add ICS Subscription]                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

#### 9.4.7 Task List View

Table/list view with sortable columns and inline editing.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  Task List                                                       [+ New]    │
├─────────────────────────────────────────────────────────────────────────────┤
│  [All Items] [Active] [Completed] [Blocked]             🔍 Filter...        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ☐ │ Title              │ Status      │ Priority │ Due        │ Calendar   │
│  ──┼─────────────────────┼─────────────┼──────────┼────────────┼────────────│
│  ☐ │ ▼ Website Redesign │ In-Progress │ ⚡ High  │            │ 🟢 Work    │
│  ──┼─────────────────────┼─────────────┼──────────┼────────────┼────────────│
│  ☐ │   ├─ Brand Guide   │ ✅ Done     │ Medium   │ Jan 12     │ 🟢 Work    │
│  ──┼─────────────────────┼─────────────┼──────────┼────────────┼────────────│
│  ☐ │   ├─ Homepage      │ In-Progress │ ⚡ High  │ Jan 20     │ 🟢 Work    │
│  ──┼─────────────────────┼─────────────┼──────────┼────────────┼────────────│
│  ☐ │   └─ About Page    │ To-Do       │ Medium   │ Jan 25     │ 🟢 Work    │
│  ──┼─────────────────────┼─────────────┼──────────┼────────────┼────────────│
│  ☐ │ API Documentation  │ In-Progress │ ⚡ High  │ Jan 18     │ 🟢 Work    │
│  ──┼─────────────────────┼─────────────┼──────────┼────────────┼────────────│
│  ☐ │ 🔗 Database Migrate│ To-Do       │ ⚡ Urgent│ Jan 22     │ 🟢 Work    │
│  ──┼─────────────────────┼─────────────┼──────────┼────────────┼────────────│
│  ☐ │ Dentist Appt       │ —           │ —        │ Jan 15     │ 🔵 Personal│
│  ──┼─────────────────────┼─────────────┼──────────┼────────────┼────────────│
│  ☐ │ Family Dinner      │ —           │ —        │ Jan 10     │ 🟣 Family  │
│  ──┴─────────────────────┴─────────────┴──────────┴────────────┴────────────│
│                                                                             │
│  ☑ 2 selected                              [Set Status ▼] [Set Date] [...]  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Interactions:**
- Click column header → Sort by that column
- Click cell → Inline edit (dropdowns for Status/Priority)
- Checkbox → Multi-select for batch operations
- ▼ arrow → Expand/collapse subtasks
- 🔗 icon → Indicates item is blocked

---

See also: `media/gantt_view_mockup_example.png` for additional Gantt reference

---

## 10. Technical Considerations

### 10.1 Technology Stack

- **Language**: TypeScript
- **Framework**: Obsidian Plugin API
- **Views**: Obsidian Bases integration
- **Calendar**: FullCalendar library
- **Gantt**: Frappe Gantt
- **NLP**: chrono-node for date parsing
- **Recurrence**: rrule library (iCal compatible)
- **Styling**: CSS with `planner-` prefix

### 10.2 Plugin Architecture

```
src/
├── main.ts                 # Plugin entry point
├── types/                  # TypeScript interfaces
├── services/               # Core business logic
│   ├── ItemService.ts      # CRUD operations
│   ├── FilterService.ts    # Query and filtering
│   ├── RecurrenceService.ts
│   ├── DependencyService.ts
│   ├── CalendarSyncService.ts
│   └── ...
├── views/                  # View implementations
│   ├── CalendarView.ts
│   ├── GanttView.ts
│   └── ...
├── modals/                 # Modal dialogs
├── ui/                     # UI components
├── api/                    # HTTP API (desktop)
├── settings/               # Settings management
└── i18n/                   # Internationalization
```

### 10.3 Obsidian API Integration

- **MetadataCache**: For reading frontmatter (just-in-time, no internal caching)
- **Vault**: For file operations (create, update, delete)
- **Events**: Subscribe to file changes, metadata updates
- **Commands**: Register plugin commands with `planner:` prefix
- **Settings Tab**: Custom settings interface
- **Views**: Register view types with Obsidian

### 10.4 Obsidian Bases Integration

- Register as Bases data source
- Provide formula functions for computed fields
- Export views as `.base` YAML files
- Support Bases query syntax in filters

### 10.5 Mobile Considerations

| Feature              | Desktop       | Mobile                 |
| -------------------- | ------------- | ---------------------- |
| All views            | ✅             | ✅                      |
| Drag-to-reschedule   | ✅ Drag        | ✅ Long-press + gesture |
| Gantt scrolling      | ✅ Scroll/zoom | ✅ Touch scroll/pinch   |
| Quick capture hotkey | ✅             | ✅ (if mobile supports) |
| HTTP API             | ✅             | ❌                      |

### 10.6 Performance Targets

- Initial load: < 500ms for 1000 items
- View switch: < 200ms
- Item creation: < 100ms
- No jank when scrolling views with 500+ visible items

---

## 11. Assumptions, Constraints & Dependencies

### 11.1 Assumptions

- Users have Obsidian 1.10.1 or later installed
- Users understand basic Obsidian concepts (notes, frontmatter, plugins)
- Obsidian Bases plugin is available and stable
- Users are comfortable with YAML frontmatter

### 11.2 Constraints

- Must work within Obsidian's plugin sandbox
- Cannot modify Obsidian's core behavior
- Mobile platform limitations (no background processes, limited API)
- Frontmatter field types limited to Obsidian's supported types

### 11.3 Dependencies

| Dependency     | Purpose            | Risk                   |
| -------------- | ------------------ | ---------------------- |
| Obsidian API   | Core platform      | Low (stable)           |
| Obsidian Bases | View system        | Medium (newer feature) |
| FullCalendar   | Calendar rendering | Low (mature library)   |
| chrono-node    | NLP date parsing   | Low (stable)           |
| rrule          | Recurrence rules   | Low (stable)           |
| Frappe Gantt   | Gantt system       | Low (stable)           |

### 11.4 Plugin Integrations

| Plugin | Integration Type | Priority |
|--------|------------------|----------|
| Obsidian Bases | Required | High |
| Daily Notes | Optional | High |
| Map View | Optional | Medium |
| Templater | Optional | Low |

---

## 12. Success Metrics

### 12.1 Adoption Metrics

- Downloads from Obsidian Community Plugins
- GitHub stars and forks
- Active users (opt-in telemetry or community feedback)

### 12.2 Quality Metrics

- GitHub issues (bug reports vs feature requests)
- Time to resolve critical bugs
- User satisfaction (community feedback, reviews)

### 12.3 Performance Metrics

- Load time with various item counts (100, 500, 1000, 5000)
- Memory usage over time
- View switch responsiveness

### 12.4 User Success Metrics

- Users creating 10+ items (activation)
- Users using 3+ view types (engagement)
- Users configuring custom statuses/priorities (customization)
- Users setting up calendar sync (power usage)

---

## 13. Roadmap

### 13.1 Version 1.0 (MVP)

**Core System:**
- [ ] New frontmatter schema with all fields
- [ ] Item creation modal with all fields
- [ ] Field mapping and validation
- [ ] `snake_case` field naming throughout

**Views:**
- [ ] Calendar view (with colors by calendar field)
- [ ] Agenda view
- [ ] Kanban view
- [ ] Task List view
- [ ] Gantt view (basic)
- [ ] Gantt drag-to-reschedule

**Features:**
- [ ] Quick capture with NLP
- [ ] Recurring items (modular iCal fields)
- [ ] Parent/subtask hierarchy
- [ ] Dependencies (blocked_by/blocking)
- [ ] Batch operations

**Configuration:**
- [ ] New default Bases views
- [ ] Settings for statuses, priorities, calendars
- [ ] Global and per-view filtering (folder/tag)

**Retained from TaskNotes:**
- [ ] Time tracking & Pomodoro
- [ ] Google/Microsoft Calendar sync
- [ ] ICS subscriptions
- [ ] HTTP API

### 13.2 Version 1.1

- [ ] Dashboard widgets (embeddable mini-views)
- [ ] Focus mode (today's items quick filter)
- [ ] Critical path highlighting in Gantt
- [ ] Map View integration
- [ ] Timeline view

### 13.3 Version 1.2+

- [ ] Templater integration (custom item templates)
- [ ] Advanced Gantt features (resource allocation, etc.)
- [ ] Team collaboration features
- [ ] Additional calendar service integrations
- [ ] Offline sync improvements

---

## 14. Open Questions

### 14.1 Resolved Decisions

The following questions have been resolved and incorporated into the PRD:

| Category | Decision | Resolution |
|----------|----------|------------|
| **General** | Gantt Library | Frappe Gantt (adapt and build on it) |
| | Quick Capture UI | Floating window |
| | Default Calendars | Ship with just `Personal` |
| | Onboarding | Minimal — point users in right direction, add docs later |
| | Migration Tool | No — clean break from TaskNotes |
| | Color Picker | Use Obsidian's native `ColorComponent` |
| | Virtual Scrolling | Yes — for all views, especially for mobile |
| **Calendar** | Daily Note Feature | Click date number → opens Daily Note |
| **Kanban** | Cover Images | Yes — using `cover` frontmatter property |
| | Card Properties | Configurable — user toggles which properties show |
| **Gantt Popup** | Animation | Appear instantly (no animation) |
| | Positioning | Smart positioning (stays within viewport) |
| | Progress | Yes — show for tasks, uses new `progress` field (0-100) |
| | Time tracking | No — don't show in popup |
| | Quick-edit dates | Yes |
| | Pin option | No |
| **Gantt Bars** | Ghost preview | Yes — show when dragging |
| | Snap-to-grid | Yes — matches current zoom level |
| | Dependency conflict | Auto-adjust dependent tasks |
| | Bar colors | Configurable by any field |
| | Progress bar | Toggleable, drag to update in increments of 10 |
| | Status cycling | Yes — click to cycle through statuses |
| **Gantt Dependencies** | Visibility | UI toggle to show/hide |
| | Arrow interaction | Show nodules for re-anchoring (not select) |
| | Create in view | Yes — drag from dot at bottom center of bar |
| | Arrow style | Frappe Gantt style |
| **Gantt Swimlanes** | Summary bar | Parent task IS the summary bar |
| | Empty groups | Shown as normal bars |
| **Gantt Mobile** | Tap | Opens popup |
| | Long-press | Initiates drag |
| | Pinch-to-zoom | Changes zoom level, menu updates |
| **Gantt Additional** | Keyboard navigation | Yes — arrow keys + Enter |
| | Export | Yes — PNG/PDF |
| | Today marker | Yes — prominent line, auto-scroll on load |
| | Date range picker | Yes |
| | Undo/Redo | No |

### 14.2 Technical Clarifications

**Bases View Registration:**
Obsidian Bases allows plugins to register custom view types (like Calendar, Kanban, Gantt) that can be used within `.base` files. We need to investigate the exact API for registering our Gantt view as a Bases-compatible view type. This may require:
- Registering a view factory with Bases
- Implementing required interfaces for Bases data binding
- Ensuring our views can consume Bases filter/sort/group settings

**Virtual Scrolling:**
Only the visible portion of a large list/timeline is rendered, with items loaded on-demand as the user scrolls. This is critical for:
- Task List with 500+ items
- Gantt with many bars
- Calendar with many events per day
- Mobile performance

### 14.3 Remaining Open Questions

All major questions have been resolved. The following are items to address during implementation:

1. **Bases API Investigation**: Exact method for registering Gantt as a Bases view type
2. **Frappe Gantt Customization**: Extent of modifications needed to Frappe Gantt for our features
3. **Mobile Performance Testing**: Verify virtual scrolling performance on various devices  


---

## 15. Appendices & Resources

### 15.1 Inspiration Sources

- [TaskNotes Plugin](https://github.com/callumalpass/tasknotes) - Primary fork source
- [Full Calendar Plugin](https://github.com/obsidian-community/obsidian-full-calendar) - Calendar inspiration
- [Obsidian Projects](https://github.com/obsmd-projects/obsidian-projects) - Modularity inspiration
- [GitHub Projects](https://docs.github.com/en/issues/planning-and-tracking-with-projects) - Gantt & configurability inspiration

### 15.2 Technical Documentation

- [Obsidian Plugin API](https://docs.obsidian.md/Plugins/Getting+started/Build+a+plugin)
- [Obsidian Bases Documentation](https://obsidian.md/blog/introducing-bases/)
- [iCalendar RFC 5545](https://datatracker.ietf.org/doc/html/rfc5545) - Recurrence rules
- [Map View Plugin](https://github.com/esm7/obsidian-map-view) - Location integration

### 15.3 Design Assets

- `media/gantt_view_mockup_example.png` - Gantt view mockup reference
- `media/tasknotes-calendar-view-3day.png` - TaskNotes Calendar 3 Day view
- `media/tasknotes-calendar-view-day.png` - TaskNotes Calendar Day view
- `media/tasknotes-calendar-view-list.png` - TaskNotes Calendar List view
- `media/tasknotes-calendar-view-month.png` - TaskNotes Calendar Month view
- `media/tasknotes-calendar-view-week.png` - TaskNotes Calendar Week view
- `media/tasknotes-calendar-view-year.png` - TaskNotes Calendar Year view
- `obsidian-bases-cards-view-configuration.png` - Obsidian Bases Cards view configuration menu

### 15.4 Related Notes

- `notes/Notes.md` - Original brainstorming notes
- `notes/Claude-Conversation.md` - Q&A conversation log

---

## 16. Version History

| Version      | Date       | Author                 | Changes             |
| ------------ | ---------- | ---------------------- | ------------------- |
| 1.0.0-draft  | 2025-12-28 | Claude & Sawyer Rensel | Initial PRD draft   |
| 1.0.0-review | 2025-12-29 | Sawyer Rensel          | Reviewed and edited |
| 1.0.1-review | 2025-12-29 | Claude | Incorporated review feedback: added 4 new user personas, Daily Note click feature, Kanban cover images & configurable cards, Gantt bar colors & popup, color picker spec, resolved questions, added Gantt clarifying questions |
| 1.0.2-review | 2025-12-29 | Claude | Finalized Gantt view specification: added `progress` field, detailed bar interactions, dependency creation via drag, progress bar dragging, mobile gestures, export, keyboard nav. Consolidated all resolved decisions into organized table. |
| 1.0.3-review | 2025-12-29 | Claude | Added detailed Gantt bar popup wireframe (Section 9.4.5.1) with full and compact variants, showing progress bar, status selector, quick-edit dates, configurable properties, and interaction specifications. |

---

*This document is a living specification. Updates should be reflected in the Version History section.*
