## Additional Clarifying Questions

### 7. Double-Click Behavior

**When a user double-clicks an event in the Timeline:**

- **A)** Open the note file directly in Obsidian (like Gantt's double-click)
- **B)** Same as single-click (ItemModal)
- **C)** No double-click behavior

> B)
### 8. Vue Embedding Strategy

The Markwhen Timeline is a Vue 3 component. The existing Obsidian plugin embeds it in an **iframe**. Options:

|Option|Pros|Cons|
|---|---|---|
|**A) iframe** (like Markwhen plugin)|Clean isolation, uses built-in controls, easier updates|Cross-origin communication via LPC, slightly more latency|
|**B) Direct Vue integration**|More control, no iframe overhead|Adds Vue to bundle (~50KB), more complex integration|

My recommendation: **Option A (iframe)** - matches the proven Markwhen plugin architecture and lets us use their built-in controls as you requested.

> A)

### 9. New Event Creation via Timeline

When Markwhen emits a `newEvent` message (user clicks empty space to create), should we:

- **A)** Open ItemModal with the date range pre-filled (consistent with your answer to Q3)
- **B)** Something else?

> A)

### 10. Today Marker & Navigation

Should the Timeline View have:

- **A)** A "Today" button in the toolbar (like Calendar/Gantt)
- **B)** Rely on Markwhen's built-in navigation only
- **C)** Both

> B)  (Markwhen already has this.)

### 11. Milestones

Your frontmatter supports milestones (events where start = end). Should these:

- **A)** Display as Markwhen milestones (if supported)
- **B)** Display as regular events
- **C)** Not show in Timeline View

> B) Display as regular events

### 12. Dependencies Visual Indicator

Markwhen doesn't support dependency arrows. For items with `blocked_by`:

- **A)** Show a small 🔗 icon or indicator on the event bar
- **B)** Show in tooltip/hover only
- **C)** No visual indication (users can see in ItemModal)

> C)

---

Once you answer these, I'll draft the complete Timeline View section for the PRD including:

- Feature description
- Architecture (Frontmatter ↔ Adapter ↔ LPC ↔ Timeline)
- Bases integration details
- View configuration options
- Data flow diagram
- Implementation phases