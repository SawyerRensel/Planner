# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.1] - 2026-01-11

### Added

#### Documentation
- Added screenshots throughout README and documentation
- Added example vault with three persona demonstrations:
  - **Casual Planner** - Simple calendar and task management
  - **Hobby Project Manager** - Project tracking with parent/child tasks
  - **Professional PM** - Full workflow with priorities and dependencies

### Removed

- Removed unnecessary debug logging

## [0.1.0] - 2026-01-11

### Added

#### Core Views
- **Calendar View** with six layout options: Year, Month, Week, 3-Day, Day, and List
- **Kanban View** with configurable columns, 2D swimlanes, and drag-and-drop card management
- **Timeline View** for chronological visualization with grouping and progress indicators
- **Task List View** with configurable columns, sorting, and grouping support

#### Item Management
- Full CRUD operations for planning items stored as Markdown with YAML frontmatter
- 30+ supported item properties including title, status, priority, dates, recurrence, and more
- Parent/child hierarchies for projects and subtasks
- Blocking relationships between items via `blocked_by` field
- Computed fields: `blocking`, `duration`, `is_overdue`, `next_occurrence`
- Progress tracking (0-100%) with visual indicators

#### Natural Language Processing
- Natural language date input powered by chrono-node ("tomorrow at 2pm", "next Friday")
- NLP syntax for context (`@work`), tags (`#task`), priority (`!high`), status (`>In-Progress`), parent (`+[[Note]]`), and calendar (`~Work`)
- Live NLP preview with visual feedback
- Interactive syntax help legend

#### Recurrence System
- Full iCal RRULE compatibility for recurring items
- Supported frequencies: Daily, Weekly, Monthly, Yearly
- Advanced options: custom intervals, days of week, month-specific rules, position-based rules ("nth weekday")
- Custom Recurrence Modal for building complex patterns

#### Obsidian Integration
- Bases API integration for custom views
- Auto-generation of four .base files (Task List, Calendar, Timeline, Kanban)
- Ribbon icons for quick access to all views
- Template file support for new items

#### User Interface
- Drag-and-drop event rescheduling across Calendar, Kanban, and Timeline views
- Virtual scrolling for large datasets (Kanban: 15+ cards, Task List: 50+ items)
- Keyboard navigation with vim-style shortcuts (h/j/k/l) in Kanban
- Calendar keyboard commands: go to today, next/previous period
- Context menus for quick status, priority, calendar, and date changes
- Cover images and styled field badges on Kanban cards

#### Mobile Support
- Touch-friendly interfaces across all views
- Long-press gestures for context menus
- Touch drag for Kanban and Timeline operations
- Responsive layouts and mobile-optimized modals

#### Settings & Customization
- Tabbed settings interface (General, Calendar, Statuses & Priorities, Calendars, Quick Capture)
- Customizable status options with colors and Lucide icons
- Customizable priority levels with weights
- Multiple color-coded calendars with Solarized accent palette
- Configurable items folder, bases folder, date/time formats, and week start day
- Quick capture with configurable defaults

#### Commands
- `Planner: Open task list view`
- `Planner: Open calendar view`
- `Planner: Open timeline view`
- `Planner: Open kanban view`
- `Planner: Create new item`
- `Planner: Quick capture`
- `Planner: Calendar: Go to today`
- `Planner: Calendar: Go to next period`
- `Planner: Calendar: Go to previous period`

[Unreleased]: https://github.com/SawyerRensel/Planner/compare/v0.1.0...HEAD
[0.1.0]: https://github.com/SawyerRensel/Planner/releases/tag/v0.1.0
