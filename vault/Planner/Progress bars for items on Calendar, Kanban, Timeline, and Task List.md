---
title: Progress bars for items in all views
summary: Use `progress_current` and `progress_total` frontmatter fields to power display of progress bars on Kanban, Calendar, Timeline, and Task List via a per-view `Show progress` toggle in Bases configuration menus.
tags:
  - task
calendar: Feature
context:
people:
location:
related:
status: Done
priority: High
progress_current: 100
progress_total: 100
date_created: 2026-01-17T18:34:38.142Z
date_modified: 2026-02-15T23:42:54.162Z
date_start_scheduled: 2026-02-15T06:00:00-05:00
date_start_actual:
date_end_scheduled: 2026-02-15T17:09:35-05:00
date_end_actual:
all_day: false
repeat_frequency:
repeat_interval:
repeat_until:
repeat_count:
repeat_byday:
repeat_bymonth:
repeat_bymonthday:
repeat_bysetpos:
repeat_completed_dates:
parent:
children:
blocked_by:
cover:
color:
---

Uses `progress_current` (e.g. current page) and `progress_total` (e.g. total pages, default 100) to calculate a fraction/percentage. Each view (Task List, Kanban, Calendar, Timeline) has a `Show progress` toggle and a `Progress label` dropdown (fraction, percentage, both, or none) in its Bases configuration menu. Progress bars only render for items that have `progress_current` set — items without it are unaffected.