This is really helpful. TaskNotes has a clean approach with:

- **Icon-based action bar** - Calendar, clock, star, status icons that open context menus
- **Visual indicators** - Colored dots on icons when they have values
- **Progressive disclosure** - Expand/collapse for detailed options
- **Context menus** - Quick selection without full modals
- **Clean button row** - Open note, Archive, Cancel, Save

Based on this research and your answers, I have a few more questions:

 

**UI Layout:**

1. Do you like the TaskNotes approach of an **icon action bar** at the top (calendar, priority, status, recurrence icons) rather than full form fields for those common inputs?

> Yes, I like the icon action bar, and I especially like the `Custom Recurrence` secondary dialog for recurrence.  Perhaps we could merge the Quick Capture with this new popup we're creating like TaskNotes does?

2. For the **simple/advanced toggle** - should "simple mode" show just: Title, Date, Status, Priority (via icons), and Calendar? And "advanced mode" adds: Recurrence, Dependencies, Context, People, Location, etc.?
    
> Let's not use a simple/advanced mode.  Let's instead use icons like Task Notes and include as much relevant features as possible.  I like TaskNotes dropdown options for date start scheduled and date end scheduled as well as recurrence field inputs as well, by the way.  I've included screenshots showing some examples.
> 
> ![[Pasted image 20260101091842.png]] ![[Pasted image 20260101091932.png]]

**Field-Specific:** 

3. Should the **Calendar field** be a dropdown of configured calendars, or a text input with autocomplete (allowing new calendars to be created on the fly)?

> Configured dropdown.

4. For **recurrence** - should clicking the recurrence icon open a context menu with presets (Daily, Weekly, Monthly, Yearly, Custom...), or go straight to a full recurrence configuration dialog?

> Context menu with presets.  I really like TaskNotes implementation of this.

**Views Integration:** 

5. Should the popup be accessible from **all views** (Calendar, Gantt, Kanban, Task List) with the same behavior - click item → open edit popup?

> Yes.