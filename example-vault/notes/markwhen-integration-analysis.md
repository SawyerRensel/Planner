## Markwhen Integration Analysis

### Current Architecture (DHTMLX)

Your current Gantt uses:

- **DHTMLX Gantt** library (commercial-grade, feature-rich)
- **Data flow**: Obsidian Bases → `entryToTask()` → DHTMLX Task objects
- **1,117 lines** in [BasesGanttView.ts](vscode-webview://0i8a3kscq6u4re8su5rvrl3c6ikisvbi4ae0n5lp4k04sfrmibdv/src/views/BasesGanttView.ts)
- **Frontmatter schema** with `date_start_scheduled`, `date_end_scheduled`, `blocked_by`, `progress`, etc.

### Markwhen Ecosystem

|Component|Purpose|Technology|
|---|---|---|
|**Parser**|Converts Markwhen syntax → JSON|TypeScript|
|**Timeline**|Renders the visual timeline|Vue 3 + Tailwind|
|**View-Client**|LPC communication layer|TypeScript|
|**Obsidian Plugin**|Renders `.mw` codeblocks|TypeScript|

### Key Challenge: Data Format Mismatch

Markwhen expects its **own text syntax**:

```
title: My Project

group Development
2026-01-15: Design mockups #design
2026-01-20/2026-02-01: Build frontend #dev
endGroup
```

Your data lives in **YAML frontmatter**:

```yaml
---
title: Build frontend
date_start_scheduled: 2026-01-20T09:00:00
date_end_scheduled: 2026-02-01T17:00:00
tags: [task]
calendar: [Development]
blocked_by: ["[[Design mockups]]"]
---
```

### Integration Approaches

#### Option A: Frontmatter → Markwhen Syntax Converter

Create a converter that transforms your frontmatter data into Markwhen syntax strings, then feed them through the parser.

 

**Pros**: Uses official parser, stays compatible with upstream **Cons**: Extra conversion layer, potential data loss, two-way sync is complex

#### Option B: JSON Adapter (Bypass Parser)

Create a transformer that outputs the **same JSON structure** the parser produces, feeding it directly to the Timeline view.

 

**Pros**: Direct control, maps your schema perfectly, no syntax conversion **Cons**: Need to match parser output exactly, may break on upstream changes

#### Option C: Custom Timeline Fork

Fork the Timeline view and modify it to accept your data format directly.

 

**Pros**: Full control, optimized for your use case **Cons**: Maintenance burden, diverges from upstream, Vue dependency

### Technical Considerations

1. **Vue in Obsidian**: Markwhen Timeline is Vue 3. You'd need to embed Vue within your Obsidian view. This is doable but adds ~50KB to bundle and complexity.
    
2. **View-Client LPC**: The Timeline uses `useLpc()` for bidirectional state. You'd need to implement the host side:
    
    ```typescript
    const { postRequest } = useLpc({
      markwhenState(ms) { /* receive parsed data */ },
      appState(state) { /* handle UI state */ }
    });
    ```
    
3. **Feature Parity**: Your current DHTMLX implementation has:
    
    - ✅ Drag-and-drop task movement
    - ✅ Progress bars
    - ✅ Dependency arrows (blocked_by)
    - ✅ Hierarchical tasks (parent/children)
    - ✅ Dynamic zoom levels
    - ✅ Editable grid columns
    
    Markwhen Timeline has:
    
    - ✅ Beautiful, clean visualization
    - ✅ Groups/sections
    - ✅ Tags with colors
    - ❓ Drag-and-drop editing (limited)
    - ❌ Progress bars
    - ❌ Dependency arrows
    - ❌ Hierarchical tasks

### My Recommendation

**Short answer**: Yes, it's technically feasible, but it would be a significant **feature downgrade** from your current DHTMLX implementation.

 

**The Markwhen Timeline is designed for visualization, not project management.** It excels at displaying chronological events beautifully but lacks:

- Progress tracking
- Dependency visualization
- Drag-to-reschedule
- Task hierarchies

If you want to proceed, I'd recommend **Option B (JSON Adapter)** with these steps:

1. Study the parser output structure from `@markwhen/parser`
2. Create a `FrontmatterToMarkwhenAdapter` class
3. Embed Vue 3 in an Obsidian view
4. Implement the LPC host for bidirectional communication
5. Handle edit events to update frontmatter

**Estimated scope**: ~2,000+ lines, Vue integration, significant testing

### Alternative Suggestion

Consider a **hybrid approach**:

- Keep DHTMLX for the full-featured Gantt view
- Add a **secondary "Timeline" view** using Markwhen for read-only visualization
- Use Markwhen for historical/narrative timelines where editing isn't needed

Would you like me to:

1. **Prototype the JSON adapter** to see how well your data maps?
2. **Create a proof-of-concept** embedding the Markwhen Timeline in Obsidian?
3. **Explore other timeline libraries** that might be a better fit (like vis-timeline)?