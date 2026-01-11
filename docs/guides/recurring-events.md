# Recurring Events

Create repeating tasks and events with flexible recurrence rules.

## Quick Recurrence

In the Item Modal, select a preset:

| Option | Pattern |
|--------|---------|
| Daily | Every day |
| Weekly | Every week on same day |
| Monthly | Every month on same date |
| Yearly | Every year on same date |

## Custom Recurrence

Click **Custom** to configure advanced patterns.

### Frequency

| Frequency | Description |
|-----------|-------------|
| Daily | Repeats every N days |
| Weekly | Repeats every N weeks |
| Monthly | Repeats every N months |
| Yearly | Repeats every N years |

### Interval

Set how often within the frequency:

- Every 1 week = weekly
- Every 2 weeks = biweekly
- Every 3 months = quarterly

### By Day (Weekly)

Select which days of the week:

- [x] Monday
- [x] Wednesday
- [x] Friday

Creates: "Every Monday, Wednesday, and Friday"

### By Month Day (Monthly)

Select specific dates:

- 1st of the month
- 15th of the month
- Last day (-1)

### By Set Position (Monthly)

Select ordinal occurrences:

- First Monday
- Second Tuesday
- Last Friday

### End Condition

| Option | Description |
|--------|-------------|
| Forever | No end date |
| Until | Repeat until specific date |
| Count | Repeat N times |

## Examples

### Every Weekday

```
Frequency: Weekly
Days: Monday, Tuesday, Wednesday, Thursday, Friday
```

### First Monday of Each Month

```
Frequency: Monthly
By Day: Monday
By Set Position: First
```

### Quarterly Review

```
Frequency: Monthly
Interval: 3
By Month Day: 1
```

### Every Other Friday

```
Frequency: Weekly
Interval: 2
By Day: Friday
```

## In Frontmatter

Recurrence is stored as RRule-compatible properties:

```yaml
repeat_frequency: weekly
repeat_interval: 1
repeat_byday:
  - MO
  - WE
  - FR
repeat_until: 2025-12-31
```

## Completed Occurrences

When you complete a recurring item:

1. The occurrence date is added to `repeat_completed_dates`
2. Completed occurrences appear grayed out in Calendar
3. The item itself stays open for future occurrences

## Technical Details

Planner uses the [RRule library](https://github.com/jakubroztocil/rrule) for:

- Generating occurrence dates
- Parsing recurrence rules
- Handling timezone and DST
