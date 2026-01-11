# Planner

**Unified calendar, task, and project management for Obsidian.**

Planner is a powerful Obsidian plugin that brings together calendar visualization, Kanban boards, timeline views, and task lists—all powered by Obsidian's native Bases feature. Your data stays in plain Markdown files with YAML frontmatter, giving you complete ownership and flexibility.

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg)](https://www.gnu.org/licenses/gpl-3.0)
[![Obsidian](https://img.shields.io/badge/Obsidian-1.10.0+-purple)](https://obsidian.md)

## Features

- **Four Powerful Views** - Calendar, Kanban, Timeline, and Task List views, all integrated with Obsidian Bases
- **Full Recurrence Support** - Complex recurring events with iCal RRULE compatibility (daily, weekly, monthly, yearly, custom patterns)
- **Natural Language Input** - Create items with "Meeting tomorrow at 3pm @work #event"
- **Drag & Drop** - Reschedule events on the calendar, move tasks between Kanban columns
- **Item Hierarchy** - Parent/child relationships for projects and subtasks
- **Dependencies** - Block items based on other items with `blocked_by` relationships
- **Multiple Calendars** - Color-coded calendar categories for work, personal, projects
- **Mobile Optimized** - Touch-friendly with gesture support
- **Keyboard Navigation** - Full keyboard support including vim-style shortcuts (h/j/k/l)
- **Customizable** - Configure statuses, priorities, colors, icons, and more

## Who It's For

**The Life Planner** — You want to see *everything* in one place. Work deadlines, doctor appointments, social events, hobby projects—your calendar and timeline show the full picture of your life, past, present, and future. Planner gives you that bird's-eye view while keeping every detail accessible.

**The Casual Planner** — You just need a simple, beautiful calendar that lives in your vault. No complex setup, no external accounts. Create events with natural language, set up recurring reminders, and get on with your day.

**The Hobby Project Manager** — That novel you're writing, the woodworking project in the garage, the app you're building on weekends—they all deserve proper planning. Use the Timeline to visualize milestones and the hierarchy features to break big dreams into actionable steps.

**The Power Organizer** — You live in Kanban boards and thrive on dependencies. Block tasks until prerequisites are done, track progress percentages, and use every view to slice your work differently. Planner scales with your complexity.

## Views

### Calendar View

Full calendar display with six layouts powered by FullCalendar:

- **Year** - Overview of the entire year
- **Month** - Traditional month grid
- **Week** - 7-day view with time slots
- **3-Day** - Rolling 3-day view
- **Day** - Single day with time slots
- **List** - Chronological agenda view

Features include drag-to-reschedule, click-to-create, color coding by any field, and recurring event display.

### Kanban View

Drag-and-drop board for visual task management:

- Configurable columns by status, priority, calendar, or any property
- Swimlanes for 2D grouping
- Cover images and styled field badges
- Virtual scrolling for large boards
- WIP limits per column

### Timeline View

Beautiful chronological visualization powered by [Markwhen](https://markwhen.com/):

- Group events by calendar, status, people, or priority
- Drag events to reschedule
- Zoom and pan navigation
- Progress indicators on events
- Color coding by any field

### Task List View

Table view for managing items:

- Configurable columns via Bases properties
- Click any row to edit in the Item Modal
- Context menu with quick status changes
- Colored badges for status, priority, and calendar
- Virtual scrolling for large datasets (50+ items)

## Installation

### From Obsidian Community Plugins (Coming Soon)

1. Open **Settings** > **Community Plugins**
2. Click **Browse** and search for "Planner"
3. Click **Install**, then **Enable**

### Manual Installation

1. Download the latest release from the [Releases](https://github.com/sawyerrensel/planner/releases) page
2. Extract `main.js`, `main.css`, and `manifest.json` to your vault's `.obsidian/plugins/planner/` folder
3. Enable the plugin in **Settings** > **Community Plugins**

## Quick Start

### Create Your First Item

1. Press `Ctrl+P` and type "Planner: Quick capture" to open the Item Modal
2. Enter a title—try natural language: "Team meeting tomorrow at 2pm @work #meeting"
3. Click **Save**

### Open Views

Use the ribbon icons in the left sidebar or the command palette:

- `Planner: Open calendar` - Calendar view
- `Planner: Open Kanban` - Kanban board
- `Planner: Open Timeline` - Timeline visualization
- `Planner: Open task list` - Table view

### Basic Workflow

1. **Create Items** - Use the Item Modal with dates, status, priority, calendar, and tags
2. **Organize** - View items in Calendar, Kanban, Timeline, or Task List
3. **Update** - Click any item to edit, or drag to reschedule/change status

## Data Model

All items are stored as Markdown files with YAML frontmatter. Every field is optional.

```yaml
---
title: Website Redesign
summary: Complete overhaul of company website
status: In-Progress
priority: High
calendar:
  - Work
tags:
  - task
  - project
date_start_scheduled: 2025-01-15T09:00:00
date_end_scheduled: 2025-01-31T17:00:00
parent: "[[Q1 Initiatives]]"
children:
  - "[[Design mockups]]"
  - "[[Implement frontend]]"
blocked_by:
  - "[[Brand guidelines approval]]"
context:
  - "office"
people:
  - "[[John Smith]]"
progress: 35
---

## Description

Full redesign incorporating new brand identity...
```

### Recurrence Example

```yaml
---
title: Daily Standup
repeat_frequency: daily
repeat_interval: 1
date_start_scheduled: 2025-01-01T09:00:00
---
```

```yaml
---
title: Team Sync
repeat_frequency: weekly
repeat_interval: 2
repeat_byday:
  - TU
  - TH
---
```

## Configuration

Access settings via **Settings** > **Plugin Options** > **Planner**

### Statuses

Configure statuses with custom names, colors, and Lucide icons:

| Status | Color | Icon | Completed |
|--------|-------|------|-----------|
| To-Do | Purple | `circle-dot-dashed` | No |
| In-Progress | Blue | `circle-dot` | No |
| Done | Green | `circle-check-big` | Yes |
| Cancelled | Red | `ban` | Yes |

### Priorities

| Priority | Color | Icon |
|----------|-------|------|
| Urgent | Red | `alert-triangle` |
| High | Orange | `chevrons-up` |
| Medium | Yellow | `chevron-up` |
| Low | Blue | `chevron-down` |

### Calendars

Define calendar categories with custom colors. Items can belong to multiple calendars.

### Other Settings

- **Items Folder** - Default location for new items
- **Date/Time Format** - Display format preferences
- **Week Starts On** - Sunday or Monday
- **Open Behavior** - How items open (same tab, new tab, split)

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd+Enter` | Save item (in modal) |
| `Escape` | Close modal / Clear focus |
| `Arrow Keys` or `h/j/k/l` | Navigate (Kanban) |
| `Enter` | Open focused item |

## Technology Stack

| Component | Technology |
|-----------|------------|
| Language | TypeScript |
| Platform | Obsidian Plugin API |
| Views | Obsidian Bases |
| Calendar | [FullCalendar](https://fullcalendar.io/) |
| Timeline | [Markwhen](https://markwhen.com/) |
| Recurrence | [rrule](https://github.com/jakubroztocil/rrule) |
| NLP Dates | [chrono-node](https://github.com/wanasit/chrono) |

## Documentation

Full documentation is available at **[sawyerrensel.github.io/planner](https://sawyerrensel.github.io/planner/)**

- [Installation Guide](https://sawyerrensel.github.io/planner/guides/installation/)
- [Quick Start](https://sawyerrensel.github.io/planner/guides/quick-start/)
- [Configuration](https://sawyerrensel.github.io/planner/guides/configuration/)
- [Properties Reference](https://sawyerrensel.github.io/planner/reference/properties/)
- [Views Documentation](https://sawyerrensel.github.io/planner/views/)

## Development

```bash
# Clone the repository
git clone https://github.com/sawyerrensel/planner.git
cd planner

# Install dependencies
npm install

# Build for development (watches for changes)
npm run dev

# Build for production
npm run build
```

The build outputs to the project root and can be copied to your vault's plugin folder for testing.

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## Roadmap

### Current (v0.1.0)
- Calendar, Kanban, Timeline, and Task List views
- Item Modal with NLP parsing
- Full recurrence support
- Item hierarchy and dependencies
- Mobile optimization

## License

This project is licensed under the GNU General Public License v3.0 - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- [Obsidian](https://obsidian.md) - The incredible knowledge base application
- [FullCalendar](https://fullcalendar.io/) - Calendar component
- [Markwhen](https://markwhen.com/) - Timeline visualization
- [TaskNotes](https://github.com/scambier/obsidian-tasknotes) - UI/UX inspiration

---

**Author:** Sawyer Rensel ([@sawyerrensel](https://github.com/sawyerrensel))
