# Creating Items

Learn how to create and manage items in Planner.

## Item Modal

The Item Modal is your primary interface for creating and editing items.

### Opening the Modal

- **Command Palette** - `Planner: Create new item`
- **Ribbon Icon** - Click then use "+ Add" in any view
- **Kanban** - Click the "+" button in a column
- **Calendar** - Click on a date

### Fields

#### Basic Information

| Field | Description |
|-------|-------------|
| **Title** | Item name (required) |
| **Summary** | Brief description |
| **Details** | Markdown body content |

#### Dates

| Field | Description |
|-------|-------------|
| **Start Date** | When to begin |
| **End Date** | When to finish |
| **All Day** | Toggle for all-day events |

#### Categorization

| Field | Description |
|-------|-------------|
| **Status** | Current state |
| **Priority** | Importance level |
| **Calendar** | Project/category |
| **Tags** | Hashtags for organization |

#### Relationships

| Field | Description |
|-------|-------------|
| **Context** | Related contexts/areas |
| **People** | Linked people notes |
| **Parent** | Parent task/project |
| **Blocked By** | Dependencies |

## Natural Language Input

The title field supports natural language date parsing:

```
Meeting tomorrow at 3pm
Project deadline next Friday
Call with John on March 15
Weekly review every Monday
```

The parser extracts:

- **Dates** - Converts to specific dates
- **Times** - Sets start time
- **Recurrence** - Creates repeat patterns

## File Storage

Items are stored as markdown files:

```markdown
---
title: My Task
status: To Do
priority: Medium
date_start_scheduled: 2025-01-15T09:00:00
calendar:
  - Work
---

Task details go here...
```

### Default Location

New items are created in the folder configured in settings:

1. If a calendar folder is set, use that
2. Otherwise, use the global items folder
3. Default: `Planner/`

## Editing Items

### From Any View

Click an item to open the Item Modal with all fields editable.

### From the File

Edit the markdown file directly - Planner reads frontmatter properties.

### Quick Updates

In Kanban, drag a card to change its status without opening the modal.

## Deleting Items

1. Open the item in the Item Modal
2. Click the **Delete** button
3. Confirm the deletion

!!! warning "Permanent Deletion"
    Deleted items are removed from the vault. Use Obsidian's file recovery if needed.
