# Obsidian Planner - Clarifying Questions

Before overhauling the PRD for a fresh build, I need to understand your vision and constraints better.

---

## 1. Lessons from TaskNotes Failure

**1.1** What specifically went wrong when trying to modify TaskNotes architecture? Understanding this will help us avoid similar pitfalls:
- Was it the existing codebase complexity?

> Yes.  And I wanted to make to many changes to the underlying architecture that broke to many of the assumptions of the old way in practice.

- Data model incompatibilities?
- View system integration issues?
- Something else?

**1.2** Are there any components from TaskNotes worth salvaging/referencing, or is this truly a clean-slate build?

> I want to replicate much of the UI/UX.  I really like their calendar and kanban views.  I think they use FullCalendar library for the calendar view.

---

## 2. Obsidian Bases Dependency

The current PRD heavily emphasizes Obsidian Bases integration.

**2.1** Is Bases a **hard requirement**, or should the plugin work standalone with Bases as an optional enhancement?
- Hard requirement: Views are `.base` files, plugin registers as Bases data source
- Optional: Plugin has its own views, but can export/integrate with Bases

> Hard requirement.  We must integrate all views with bases and store views as `.base` files like TaskNotes.

**2.2** Have you used Bases enough to know its current capabilities and limitations? The PRD mentions "registering as a Bases data source" but Bases is relatively new - do we know this API exists?

> Yes.  See https://help.obsidian.md/bases/syntax

---

## 3. MVP Scope

The PRD lists extensive features. For a ground-up build:

**3.1** Which **3-5 features** are absolutely essential for your first working version?

> 1. Underlying modular metadata structure for items and Obsidian Bases for views.
> 2. Calendar views (Year, Month, Week, 3 Day, Day, List) and ability to configure multiple calendars and their color.  Ability to change colors of items in Calendar views based on a property (e.g. by Calendar, by Priority, by Context, etc.)
> 3. Gantt view powered by Obsidian Bases and Frappe-Gantt.   Shows task dependencies, supports grouping, supports customizable colors in the same way that Calendar view does.
> 4. Kanban View for project/task management
> 5. Support for iCal RRULE recurring items powered by recurrence frontmatter properties.

**3.2** Which **single view** should we build first? (My suggestion: Task List - simplest to implement, validates the data model)

> Sure.

**3.3** Which user persona is YOUR primary use case? (This helps prioritize)

> 2.5 The Life Planner (Super-Planner)
---

## 4. Frontmatter Schema

The schema in Section 4.1 has 30+ fields.

**4.1** Is this schema finalized, or are you open to simplifying it?

> Finalized.  Do not simplify.  The whole point of my new architecture is to make every field modular so a user has full control to edit their events/tasks in plain text.

**4.2** Some fields seem rarely used together. Would you consider a "core schema" (essential fields) vs "extended schema" (power user fields)?

> No.

**4.3** The `blocking` field is marked as "auto-computed" - do you want this stored in frontmatter (denormalized) or computed at runtime? Storing it means keeping two notes in sync.

> Computed at runtime.

---

## 5. Events vs Tasks Architecture

The current model uses a single `task: boolean` to differentiate Events from Tasks.

**5.1** Is this distinction important to you, or would you prefer:
- Everything is an "Item" with optional task-like behaviors

> I agree with this more.  Let's go with everything is an "Item" and the way to differentiate between a task and an event is by using the tags #task or #event.

- Separate note types entirely
- Keep current approach

**5.2** The current model says Events can't have Status/Priority - but what about a "Cancelled" event or a "High priority" event? Should events have these too?

> You're right.  Everything is an "Item", so let's allow the user to add a priority if they want to.

---

## 6. Technical Decisions

**6.1** Which libraries are you committed to vs. open to alternatives?
- FullCalendar for Calendar view

> Committed.

- Frappe Gantt for Gantt view

> Committed.

- chrono-node for NLP dates

> Open to alternatives.

- rrule for recurrence

> Committed.

**6.2** Do you want to build custom views from scratch, or leverage existing Obsidian plugin patterns? (e.g., use ItemView, WorkspaceLeaf, etc.)

> Whatever works as long as we integrate with Obsidian Bases as much as possible. 

**6.3** Testing strategy: Do you want unit tests, integration tests, or ship fast and iterate?

> Ship fast and iterate.

---

## 7. Calendar Sync & External Integrations

**7.1** Is calendar sync (Google/Microsoft/ICS) essential for v1.0, or can it wait for v1.1+?

> This can wait.

**7.2** Is the HTTP API essential, or a nice-to-have for later?

> This can wait.

---

## 8. Build Approach

**8.1** Do you prefer:
- **Scaffold first**: Set up full project structure, types, services, then implement
- **Incremental**: Build one feature end-to-end, then add the next
- **Vertical slice**: Build one view completely (data model + service + UI) as proof of concept

> Whatever you think is the smartest way.  You are an expert.

**8.2** Do you have a preference for project structure? The PRD shows one structure, but we could organize differently.

> Feel free to organize it differently.  Whatever is the best balance of code velocity, optimization, and performance. 

---

## 9. Non-Goals Clarification

**9.1** The PRD says "No backward compatibility with TaskNotes" - does this mean:
- No migration tool (users start fresh)
- No similar field names (avoid confusion)
- Something else?

> Don't worry about this.  This is irrelevant because we're not trying to adapt TaskNotes anymore.

**9.2** Should the plugin name be "Obsidian Planner" or something else? (Avoiding confusion with Microsoft Planner, etc.)

> Let's just call it "Planner"

---

## 10. Your Workflow

**10.1** Walk me through how YOU want to use this plugin day-to-day. What's your ideal morning workflow? What views do you open first?

> I check my calendar in the morning to see what's on the agenda for the next few days.  I can add calendar events for the whole year from my desktop, quickly add events on my phone when planning a coffee date with a friend, see my whole year in a Gantt roadmap and quickly adjust start and end dates, and do personal project/task management for personal art 3D art projects. 

**10.2** What's the ONE thing that would make you say "this plugin is a success"?

> This plugin is a success if I can quickly create calendar events via a quick input popup box or NLP which copies a template note and fills out all the relevant my frontmatter fields, and then I can visualize all items on a Calendar view, including yearly, monthly, weekly, 3 day, daily, and list; and to be able to filter what items are shown on the calendar using Obsidian Bases system.

---

## Summary: What I Need Most

Please prioritize answering:
1. **Question 1.1** (What failed with TaskNotes?)
2. **Question 3.1** (Essential features for MVP)
3. **Question 3.2** (Which view first?)
4. **Question 8.1** (Build approach preference)
5. **Question 10.2** (Success criteria)

These will most directly shape how we overhaul the PRD.

---

*Please answer inline or create a separate response document. I'll use your answers to rewrite the PRD with a clear, achievable scope.*
