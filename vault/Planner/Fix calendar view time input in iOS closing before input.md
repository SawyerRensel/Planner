---
title: Fix Calendar View time input in iOS closing before input
summary:
tags:
  - task
calendar: Bugfix
context:
people:
location:
related:
status: Done
priority: High
progress:
date_created: "2026-01-17T05:57:31.264Z"
date_modified: "2026-01-17T18:30:34.133Z"
date_start_scheduled: "2026-01-17T10:57:24.123Z"
date_start_actual:
date_end_scheduled: "2026-01-17T12:36:00.000Z"
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

---
title: Fix Calendar View time input in iOS closing before input
summary:
tags:
  - event
calendar: Bugfix
context:
people:
location:
related:
status: Done
priority: High
progress:
date_created: 2026-01-17T05:57:31.264Z
date_modified: 2026-01-17T12:37:11.066Z
date_start_scheduled: 2026-01-17T10:57:24.123Z
date_start_actual:
date_end_scheduled: 2026-01-17T12:36:00.000Z
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

## Summary of Changes

### Root Cause

The iOS time picker was disappearing because:

1. **Raw DOM modal** - The previous implementation created a modal using raw DOM elements instead of Obsidian's `Modal` class
2. **Auto-focus stealing** - `dateInput.focus()` was called immediately after the modal opened, which interferes with iOS's native picker behavior
3. **Missing touch-action CSS** - iOS delays touch events for 300ms for double-tap zoom detection

### Fixes Applied

1. **Created [DateTimePickerModal.ts]()** - A new modal class extending Obsidian's `Modal`:
    
    - Uses Obsidian's `Setting` API for input creation (like TaskNotes does)
    - Auto-focus is **disabled on mobile** (`Platform.isMobile` check at line 101)
    - Proper event handling for iOS compatibility
2. **Updated [DateContextMenu.ts]()** - Now uses the new modal instead of raw DOM elements
    
3. **Added CSS in [styles.css]()** - Added iOS touch handling:
    
    - `touch-action: manipulation` - Prevents 300ms touch delay
    - `-webkit-appearance: none; appearance: none` - Consistent styling
    - `min-height: 44px` - Proper touch target size for mobile

The key insight from the TaskNotes reference was that they use Obsidian's native `Modal` class with the `Setting` API, which has built-in iOS handling. The auto-focus is only applied on desktop platforms, preventing it from interfering with iOS native pickers.

 

Please test on your iOS device to confirm the fix works.