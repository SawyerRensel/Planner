# Item Properties

Complete reference for Planner item frontmatter properties.

## Core Properties

### Identity

| Property | Type | Description |
|----------|------|-------------|
| `title` | string | Display name |
| `summary` | string | Brief description |
| `tags` | string[] | Hashtags for categorization |

### Dates

| Property | Type | Description |
|----------|------|-------------|
| `date_created` | ISO datetime | When item was created (auto) |
| `date_modified` | ISO datetime | Last modification (auto) |
| `date_start_scheduled` | ISO datetime | Planned start date |
| `date_start_actual` | ISO datetime | Actual start date |
| `date_end_scheduled` | ISO datetime | Planned end date |
| `date_end_actual` | ISO datetime | Actual completion date |
| `all_day` | boolean | Is this an all-day event? |

### Status

| Property | Type | Description |
|----------|------|-------------|
| `status` | string | Current status name |
| `priority` | string | Priority level name |
| `progress` | number | Completion percentage (0-100) |

### Categorization

| Property | Type | Description |
|----------|------|-------------|
| `calendar` | string[] | Calendar/project names |
| `context` | string[] | Related contexts |
| `people` | string[] | Related people (wikilinks) |
| `location` | string | Location name |

### Relationships

| Property | Type | Description |
|----------|------|-------------|
| `parent` | string | Parent item path (wikilink) |
| `children` | string[] | Child item paths |
| `related` | string[] | Related item paths |
| `blocked_by` | string[] | Blocking dependencies |

### Display

| Property | Type | Description |
|----------|------|-------------|
| `cover` | string | Cover image path |
| `color` | string | Custom color (hex) |

## Recurrence Properties

| Property | Type | Description |
|----------|------|-------------|
| `repeat_frequency` | string | daily, weekly, monthly, yearly |
| `repeat_interval` | number | Repeat every N periods |
| `repeat_until` | ISO date | End date for recurrence |
| `repeat_count` | number | Number of occurrences |
| `repeat_byday` | string[] | Days: MO, TU, WE, TH, FR, SA, SU |
| `repeat_bymonth` | number[] | Months (1-12) |
| `repeat_bymonthday` | number[] | Days of month (1-31, -1 for last) |
| `repeat_bysetpos` | number | Position: 1 (first), -1 (last), etc. |
| `repeat_completed_dates` | string[] | ISO dates of completed occurrences |

## Example Item

```yaml
---
title: Weekly Team Meeting
summary: Discuss project progress and blockers
status: To Do
priority: Medium
calendar:
  - Work
tags:
  - meeting
  - team
date_start_scheduled: 2025-01-15T10:00:00
date_end_scheduled: 2025-01-15T11:00:00
repeat_frequency: weekly
repeat_interval: 1
repeat_byday:
  - WE
people:
  - "[[Team/Alice]]"
  - "[[Team/Bob]]"
location: Conference Room A
date_created: 2025-01-10T09:00:00
date_modified: 2025-01-10T09:00:00
---

## Agenda

- Review last week's action items
- Discuss current sprint progress
- Identify blockers
- Plan next steps
```

## Computed Properties

These are calculated at runtime:

| Property | Description |
|----------|-------------|
| `blocking` | Items this blocks (reverse of blocked_by) |
| `duration` | Time between start and end |
| `is_overdue` | True if past due and not completed |
| `next_occurrence` | Next date for recurring items |

## Special Values

### Ongoing Dates

Use `"ongoing"` for open-ended dates:

```yaml
date_end_scheduled: ongoing
```

### Wikilinks

Link properties accept wikilinks:

```yaml
parent: "[[Projects/My Project]]"
people:
  - "[[People/Alice]]"
  - "[[People/Bob]]"
```
