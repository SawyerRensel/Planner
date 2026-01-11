# Commands Reference

All Planner commands accessible via the Command Palette.

## View Commands

| Command ID | Name | Description |
|------------|------|-------------|
| `planner:open-task-list` | Open task list | Open Task List view |
| `planner:open-calendar` | Open calendar | Open Calendar view |
| `planner:open-timeline` | Open Timeline | Open Timeline view |
| `planner:open-kanban` | Open Kanban | Open Kanban view |

## Item Commands

| Command ID | Name | Description |
|------------|------|-------------|
| `planner:create-item` | Create new item | Open Item Modal for new item |
| `planner:quick-capture` | Quick capture | Same as Create new item |

## Calendar Commands

| Command ID | Name | Description |
|------------|------|-------------|
| `planner:calendar-today` | Calendar: Go to today | Navigate to current date |
| `planner:calendar-next` | Calendar: Go to next period | Navigate forward |
| `planner:calendar-prev` | Calendar: Go to previous period | Navigate backward |

## Debug Commands

| Command ID | Name | Description |
|------------|------|-------------|
| `planner:list-items` | List all items (debug) | Log all items to console |

## Assigning Hotkeys

1. Open **Settings** > **Hotkeys**
2. Search for "Planner"
3. Click the plus icon next to any command
4. Press your desired key combination

### Recommended Hotkeys

| Command | Suggested Hotkey |
|---------|------------------|
| Create new item | ++cmd+shift+n++ |
| Open Kanban | ++cmd+shift+k++ |
| Open Calendar | ++cmd+shift+c++ |
| Open task list | ++cmd+shift+t++ |
| Open Timeline | ++cmd+shift+l++ |

## Programmatic Access

For plugin developers, commands can be triggered programmatically:

```typescript
// Execute a command
app.commands.executeCommandById('planner:create-item');

// Check if command exists
const hasCommand = app.commands.findCommand('planner:open-kanban');
```

## Mobile Commands

All commands work on mobile via:

1. Swipe down to open Command Palette
2. Type command name
3. Tap to execute
