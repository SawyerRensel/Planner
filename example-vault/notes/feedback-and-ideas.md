
- [x] Improve Calendar view UI.  Conserve "real-estate".  Match the look, sizing and feel of Task Notes "Advanced Calendar" view.
- [x] Abbreviate Calendar view mode buttons to single letters.  Let's also shorten the "+ New" button to a single plus "+".  Secondly, let's add an option to to split Year view mode by month or have a continuous scroll like before.  (only shown as a toggle in Calendar view when Year view mode is selected)
- [x] "Color by" menu is missing
- [x] Clicking on day number should open the Daily Note for that date.
- [x] Calendar View's Bases' Configure View menu also has "Color by" dropdown, but this doesn't actually change the color of items.  Let's fix that and keep both "Color by" dropdown menus in sync with each other.  
- [x] Need to fix/update date frontmatter fields (Due? Started? Scheduled? etc.)

New

| Field                  | Type     | Description                             |
| ---------------------- | -------- | --------------------------------------- |
| `date_created`         | datetime | System timestamp.                       |
| `date_modified`        | datetime | System timestamp.                       |
| `date_start_scheduled` | datetime | When you intend to perform the action.  |
| `date_start_actual`    | datetime | When you actually started the action.   |
| `date_end_scheduled`   | datetime | When you intend to complete the action. |
| `date_end_actual`      | datetime | When you actually finished the action.  |
| `all_day`              | boolean  | Whether this is an all-day item.        |

Old

| Field            | Type     | Description                          |
| ---------------- | -------- | ------------------------------------ |
| `date_created`   | datetime | When created (auto-set)              |
| `date_modified`  | datetime | Last modified (auto-set)             |
| `date_start`     | datetime | When item starts / is scheduled      |
| `date_end`       | datetime | When item ends (for multi-day items) |
| `date_due`       | datetime | External deadline                    |
| `date_completed` | datetime | When marked complete (auto-set)      |
| `all_day`        | boolean  | Whether this is an all-day item      |

- [x] Let's add some features to Calendar View's Bases' Configure View menu.  First let's select a default "View Mode" menu that allows the user to set the default view mode (Year, Month, Day, etc.).  Next let's add two menus, "Date Start Field" and "Date End Field", which allow the user to select among  frontmatter field properties to define how items are displayed on the Calender view.  Lastly, let's also create a "Title Field" that allows the user to select what text is shown on items in Calendar view.  (See ***screenshots*** for reference)
- [x] Fix recurrence not working
- [x] Modal input popup
- [x] Model edit popup with option to open note and also to Delete event and also to Save Edits.
- [x] When clicking the calendar to add an event, don't automatically open the new event note.  Instead, let's open the modal edit popup
- [ ] The parsed NLP bar should update anytime a dropdown is changed
- [ ] Let's have a collapsible legend for all options with examples for the NLP bar.   
- [ ] Let's move the NLP bar and collapsible below the icon row
- [ ] The Details input in the Item Modal should pull and render any existing content in the Item Note.  I like the current height of the box.  Let's let the user scroll content.
- [ ] In the Item Modal, for the inputs for People, Parent, and Blocked by, I try typing in double-open brackets to prompt Obsidian to find a file to link, but no menu appears to select a file from like it does when I do in an Obsidian note.  Let's generally make Context, Parent, People, Blocked by, and Tags behave like they would if I were editing their frontmatter in the Item Note. 
- [ ] Let's add a resizable input box for the `summary` frontmatter field in the Input Modal
- [ ] Let's add some space between the "New Item" ("+") button in Calendar view and the view mode buttons.  Also, the current view mode button selection is not being/staying highlighted when clicked.
- [x] Quick capture needs to put quotations around context items in list like `"@home"` instead of `@home`
- [ ] Whenever I move an event, the event is offset down and to the right by a large margin from my actual mouse position while I'm clicking and dragging it.  It still does successfully reposition to where I place my mouse, but the visual difference is jarring.
- [ ] Map View integration in calendar item mobile popup.  
- [ ] Embed Map View in Calendar template
- [ ] Embed the Day's agenda base view in Daily note template.
- [ ] Embed Map View in daily note?  That way can easily draw/edit where I went that day?
- [ ] Option to add multiple filter folders and multiple filter tags in settings 
- [ ] Embed Calendar view base in each New Item. That way it's easier to see changes to metadata happen live without having to change tabs