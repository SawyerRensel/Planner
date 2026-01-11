	
## Calendar View

- [x] Improve Calendar view UI.  Conserve "real-estate".  Match the look, sizing and feel of Task Notes "Advanced Calendar" view.
- [x] Abbreviate Calendar view mode buttons to single letters.  Let's also shorten the "+ New" button to a single plus "+".  Secondly, let's add an option to to split Year view mode by month or have a continuous scroll like before.  (only shown as a toggle in Calendar view when Year view mode is selected)
- [x] "Color by" menu is missing
- [x] Clicking on day number should open the Daily Note for that date.
- [x] Calendar View's Bases' Configure View menu also has "Color by" dropdown, but this doesn't actually change the color of items.  Let's fix that and keep both "Color by" dropdown menus in sync with each other.  
- [x] Need to fix/update date frontmatter fields (Due? Started? Scheduled? etc.)
- [x] Let's add some features to Calendar View's Bases' Configure View menu.  First let's select a default "View Mode" menu that allows the user to set the default view mode (Year, Month, Day, etc.).  Next let's add two menus, "Date Start Field" and "Date End Field", which allow the user to select among  frontmatter field properties to define how items are displayed on the Calender view.  Lastly, let's also create a "Title Field" that allows the user to select what text is shown on items in Calendar view.  (See ***screenshots*** for reference)
- [x] Fix recurrence not working
- [x] Modal input popup
- [x] Model edit popup with option to open note and also to Delete event and also to Save Edits.
- [x] When clicking the calendar to add an event, don't automatically open the new event note.  Instead, let's open the modal edit popup
- [x] The parsed NLP bar should update anytime a dropdown is changed
- [x] Let's have a collapsible legend for all options with examples for the NLP bar.   
- [x] Let's move the icon row above the NLP/title input
- [x] Let's add a "Show Detailed Options" icon (down carrot) to the icon row to hide Summary, Details (Note content), Context, Parent, People, Blocked by, and Tags inputs behind.
- [x] Let's have the Details input (showing Note Content) render the Markdown like it does in an Obsidian Note.  Refer to TaskNotes' implementation of this if it's helpful. (/home/sawyer/tasknotes)
- [x] Let's move the `Open Note` button to the top right of the Item Modal  popup.
- [x] The Details input in the Item Modal should pull and render any existing content in the Item Note.  I like the current height of the box.  Let's let the user scroll content.
- [x] In the Item Modal, for the inputs for People, Parent, and Blocked by, I try typing in double-open brackets to prompt Obsidian to find a file to link, but no menu appears to select a file from like it does when I do in an Obsidian note.  Let's generally make Context, Parent, People, Blocked by, and Tags behave like they would if I were editing their frontmatter in the Item Note. 
- [x] Let's add a resizable input box for the `summary` frontmatter field in the Input Modal
- [x] Let's make sure the Open Note button is respecting the "Open behavior" setting in Planner settings.
- [x] Let's move the icon row to the bottom
- [x] Right now there's a placeholder blank margin for the interpreted results of the NLP/title input.  Let's remove this extra space until the NLP detects and recognizes tokens to render
- [x] Rename "Details (Note Content)" to "Note Content" and make it no longer collapsible
- [x] In the Context input box, right now it's showing "@" symbol as suggest inputs.  Let's remove the "@" symbol and make sure 
- [x] Convert Wikilinks to Markdown links if User has "Use [[Wikilinks]]" setting turned off in "Files and Links" Settings.
- [x] In Planner settings, let's allow the user to also pick a lucide icon for each status.  Let's use that icon in the Item Modal dropown menu for Status selection


- [x] Quick capture needs to put quotations around context items in list like `"@home"` instead of `@home`
- [x] Whenever I move an event, the event is offset down and to the right by a large margin from my actual mouse position while I'm clicking and dragging it.  It still does successfully reposition to where I place my mouse, but the visual difference is jarring.

- [x] Set a Default Calendar in Planner Settings by using a dropdown that gets the lists of current calendars instead of manually typing one in.
- [x] Planner settings make slider to make the font smaller in Calendar View.  Right now the font is a comfortable size, but could be considered too big.  Let's make the default Calendar View font size just a bit smaller.
- [x] On Mobile, the Item Modal width extends beyond screen width.  Let's make sure it fits within screen width. 
- [x] Optimize the area above the Calendar container.  Let's remove the dropdown menu for "Color:" in Calendar View action bar but keep the identical dropdown in the Calendar View Bases Configuration menu.  Let's move the Calendar View modes (Y, M, D, etc.) over the left and move the forward and back arrows to the right side.   Let's also reduce the size of the view mode buttons a little and have no top or bottom margin for the action row.  Let's convert the "today" button into the lucide icon `square-split-horizontal`.   Ideally on non-mobile views, the view mode buttons are on the left, the calendar title (e.g. "January 2026") is in the center, and the forward/back buttons and today icons are on the right.  On mobile, all Calendar view action buttons are together on a row above the calendar title (right now there are three rows, which smushes the calendar container quite a bit and takes up a lot of real estate.)
- [x] Move TaskNotes, Obsidian Maps and other repo references into a ref folder in Planner’s repo to give easier access to [Claude](../../Topics/LLMs/Claude.md) for contextual studying.
- [x] If user disabled "Use WikiLinks" in Obsidian "Files and Links" settings, wait to create Markdown links from Item Modal (display as wikilinks) until user clicks create or save, then convert to relative path Markdown links in quotation marks.
- [x] Pull existing field values and add to Item Modal when editing an item. 
- [x] Default tag for new Items - right now it's event.  Prepopulate the tag in the Item Modal.
- [ ] ~~Would be nice to have a Day Planner-style sidebar for Planner, especially on mobile.  Just a quick swipe right to see the day’s agenda.~~
- [x] Recurrence is behaving/displaying in odd ways.  Trying to create a recurring event for an event on Tuesdays at 9am-10:30am repeating every week incorrectly displays on the Calendar View in the 4am-5:30am slot.  The metadata is correct.  The rendered display in Calendar View is incorrect.  Calendar View does show the recurrence of the Item (`RecurringExample` is the name).   Gantt View and Timeline View display the first occurrence of the Item in the correct time slot, but do not display the recurrence of the Item in their views. 
- [x] `date_created` and `date_modified` are also wildly incorrect.  We should be pulling these times from the operating system's clock, which is presumed to be the correct time zone for the user. 
- [ ] ~~In Settings, add an option to add link(s) to the given days' daily notes in the `related` field.  Don't create the daily notes, just add placeholder links of where they would be stored relative to the Item Note (according to the Daily Note folder specified in the Daily Note core plugin) (also remember to respect Link behavior (absolute, relative, shortest)).  Happens both when you create and or edit an Item from the Item Modal.~~  
	- *Not really a priority nor important.*
- [x] Planner.  There's no way to say "Recurs on the second Sunday of every month"
- [x] Ability to add folders to each Calendar in Settings.  If a folder is specified, this overrides the global Planner folder for that Calendar.  Fallback to global Planner folder when none is specified.
- [ ] ~~Planner.  Tags, and colors for tags.  Similar to folders.  Any note that has a tag in Included Tags and has date_start_scheduled and date_end_scheduled gets rendered on the Calendar.~~
	- *This can be accomplished through Bases.  I should actually remove the identify configuration options in Settings because they don't do anything anyway. *
- [x] Whenever a user creates a new calendar in Planner Settings, let's add the next Solarized Accent Color for it as the default color (the user should still be able to customize their calendar colors).  There are 8 accent colors.  Use the index number of the created Calendar to determine which accent color to apply.  

## ~~Gantt View~~

- [x] ~~Section 5.5 | Bar Click Popup: Use the same Item Modal used for Calendar view for a unified Item creation and editing experience.~~ 
- [x] ~~Ability to expand or collapse the Gantt table.  (especially for mobile, as the table takes up a lot of space)~~
- [x] ~~Font size control for Gantt View (similar to Calendar View).  Add to Gantt View Configuration menu.~~
- [x] ~~Gantt View Day mode should show two hours per column at a time.  Right now it shows 4 hour increments.  Make the increments even (right now they're odd).~~
- [x] ~~In Gantt View, the Quarter and Year Mode subdivisions are incorrect.  Year mode is only showing three months.  I don't know what Quarter mode is showing.~~
- [ ] ~~Gantt View needs forward and back arrows just like in Calendar View.  DHTMLX seems to put strict boundaries on whether we can track forward and backward beyond the currently Month, Quarter or, Year.  I think this should be a toggle.  I like having the bounds, but sometimes I'd like to scroll 2, 3, 5, 10 or more years ahead or behind.~~
- [ ] ~~Gantt Zoom Feature:  Need to have dynamic zoom Plus/Minus buttons in the toolbar to expand or condense Gantt timeline in window.  For instance, clicking the Minus button would zoom out.  I would want to be able to see a 100+ year timeline if that is possible.~~ 
- [ ] ~~Enable in-line editing for properties show in the Gantt Table~~
- [ ] ~~Currently not possible to adjust Gantt Bars (start, end, position, progress, dependency arrows.  We need to make this functionality happen.~~

## Timeline View

- [x] Colors aren't working in Timeline View.
- [x] Remove Group by and Color by menus from the action row in Timeline View.  Let's move/keep these menus in the Timeline View Configuration menu. 
- [x] Add another Timeline View configuration menu  for "Sections by" with options including `calendar`, `status`, `priority`, `folder`, etc.
- [x] Item frontmatter isn't getting pulled into the Item Modal when clicking on a bar to edit the Item.  
- [ ] ~~Item Modal - add a menu for Task or Event?  That way don't have to manually add tags for either~~
- [x] Planner folder auto complete in settings
- [x] Could the enabled Bases properties in Calendar, Task List, and Timeline Views drive what options appear on the `Color by`, `Group by`, and `Section by` menus as well as the date start and date end?  I'm thinking for example, if I want to map out history and use an "era" frontmatter field to `Section by` certain eras.  Properties should drive all config menu options, including start and end dates.  Use Field type (date, int, text, etc) to filter which properties are shown in which Bases view configuration menus for each View for Planner according to the type of menu.
- [x] How to account for events/items that have started but are still current/happening **now** and are not certain when they will end?  How to handle now in metadata.  Perhaps a "" in `date_end_scheduled`?  I'm thinking about People notes and displaying people who are still alive, or for tasks or events that are ongoing and you're not sure when they'll end (e.g. War in Ukraine)
- [x] Planner config menu to change background color of Timeline View
- [x] Planner remove redundant/deprecated settings menus
- [x] Planner group settings into tabs
- [x] Planner need to show all properties for date and date and time as options in the date config menus, not just fields that have “date” token in them
- [x] Fix Item Modal on mobile.  Make it appear centered.  Resize the modal container according to keyboard height when keyboard is activated
- [x] Planner when **editing** an existing note (e.g. a book note that has different frontmatter fields) in Item Modal, don’t delete/replace any pre-existing fields in that note.  Merge duplicates, but otherwise append *only append the fields modified in the Edit Item Modal to the frontmatter of that note*.  For example, if I open a book note in the Item Modal to edit, then modify the status, then save, it should only append the status field and value to the book note’s frontmatter.  If I haven’t modified the other fields, don’t add those fields to the frontmatter of that note.
- [ ] ~~Planner Timeline add config menu for default zoom and center for Timeline View.~~
	- tried and failed.  Not worth the effort right now.
- [ ] Planner Improve performance for Timeline view.  Should be snappy fast and buttery smooth like Meridiem.


## Kanban View

- [x] Check the PRD to brush up on what you wanted
- [x] "Columns by" menu to allow picking how to configure Kanban columns.  
- [x] clear borders for cards (support colors?)
- [x] (Do this after feature parity with TaskNotes' kanban) For frontmatter fields with customized colors in Planner Settings (calendar, status, priority), style those fields like how they are styled in Task List View and the NLP quick capture parser preview.  That is, if the fields are toggled on in the Bases' properties to begin with.  Ask my clarifying questions.
- [x] Support for cover images!
- [x] Bases properties are not driving/controlling the content displayed on the Kanban cards.  If I toggle on tags, I should see tags appear on the Kanban cards, etc.
	- [x] There's no recurrence badge even when repeat_frequency is toggled on.  (use repeat_frequency field for the special badge)
- [x] Swimlanes aren't working
- [ ] Cover image not displaying image.   
- [x] Let's add another config menu slider to control cover image height when Cover image is set to `banner (top)`
- [x] Don't squeeze cards into view.  Allow cards to appear at their normal height.  Allow scrolling down the board. 
- [x] Badge icons on cards are too big and extend beyond the size of their respective badges


| Working          | Not working     | Partially Working  | Comment                                                                                             |
| ---------------- | --------------- | ------------------ | --------------------------------------------------------------------------------------------------- |
| Group by         |                 |                    |                                                                                                     |
| Color by         |                 |                    |                                                                                                     |
| Border style     |                 |                    |                                                                                                     |
|                  |                 | Cover field        | Selecting a value changes card layout, but no image is shown.                                       |
|                  |                 | Cover display      | Selecting a value changes card layout, but no image is shown.                                       |
| Date start field |                 |                    |                                                                                                     |
| Date end field   |                 |                    |                                                                                                     |
|                  | Badge placement |                    | Has no effect                                                                                       |
|                  |                 | Hide empty columns | Works when you set it to `Yes`, but when you set it back to `No`, the empty columns don't reappear. |
- [x] Don't show null values for properties on cards.  If null, don't display
- [x] `summary` field is always displaying.  This needs to be driven by whether the summary field is toggled on in Bases properties.  Additionally, let's add a `Summary by` config menu for selecting which text-type field displays as a summary in Kanban cards
- [x] Swimlanes are partially working.  We need to make sure the columns containers extend fully even when they are empty.  Additionally, the column styling is being affected by adding swimlanes.  For instance, when Group by is set to status without swimlanes, it shows the colored icons for statuses in the columns.  When swimlanes are toggled on, those icons disappear. 
- [ ] Cover display is failing

```Obsidian Developer Console
plugin:planner:450 Loading Planner plugin
plugin:planner:450 Planner: Registered Bases views
plugin:planner:450 Planner plugin loaded
plugin:tasknotes:1850 TaskNotes: Starting early migration check...
plugin:tasknotes:86 [TaskNotes][Bases] Successfully registered view via public API: tasknotesTaskList
plugin:tasknotes:86 [TaskNotes][Bases] Successfully registered view via public API: tasknotesKanban
plugin:tasknotes:86 [TaskNotes][Bases] Successfully registered view via public API: tasknotesCalendar
plugin:tasknotes:86 [TaskNotes][Bases] Successfully registered view via public API: tasknotesMiniCalendar
plugin:tasknotes:519 DependencyCache: isFileUsedAsProject called before indexes built, building now...
isFileUsedAsProject @ plugin:tasknotes:519
45plugin:obsidian-full-calendar:64623 fileUpdated() called for file notes/feedback-and-ideas.md
2plugin:obsidian-full-calendar:64623 fileUpdated() called for file Personal/FirstMonday.md
49plugin:obsidian-full-calendar:64623 fileUpdated() called for file notes/feedback-and-ideas.md
null:1  Failed to load resource: net::ERR_FILE_NOT_FOUND
Screenshot_20260101-185045.png]]:1  Failed to load resource: net::ERR_FILE_NOT_FOUND
```

- [ ] Cover height config menu should be a slider, not a dropdown menu.  Additionally, it should only appear when the Cover field menu is not empty/none.
- [x] Let's add an config slider to control Kanban Column width
- [x] Let's add grab icon to Kanban columns and enable the ability to manually rearrange their order.
- [x] On mobile, tap holding a card and moving to very edge of screen should scroll sideways.  Right now I can drag a card to an adjacent column already in view, but I can't go beyond that.

- [x] Columns areas/containers are still not extending the full height of the tallest relative column (due to having the most cards) when swimlanes are enabled.
- [x] When swimlanes are enabled, dragging a card into another column and swimlane only places the card in a the target column, but not also in the swimlane. 
- [x] When swimlanes are enabled, we lose the ability to rearrange columns (icon disappears), and the count total number also disappears.  We should also add the ability to manually rearrange swimlanes in the same way that we do with columns.  Basically, swimlanes should appear and work very similar to their Column-only counterpart.
- [x] On mobile, tap holding a column and moving to the very edge of the screen should scroll sideways.  Right now I can drag a column to an adjacent column already in view, but I can't go beyond that.
- [ ] Cover images are failing.  See console log below:

```
Obsidian Developer Console
plugin:planner:475 Loading Planner plugin
plugin:planner:475 Planner: Registered Bases views
plugin:planner:475 Planner plugin loaded
plugin:tasknotes:1850 TaskNotes: Starting early migration check...
plugin:tasknotes:86 [TaskNotes][Bases] Successfully registered view via public API: tasknotesTaskList
plugin:tasknotes:86 [TaskNotes][Bases] Successfully registered view via public API: tasknotesKanban
plugin:tasknotes:86 [TaskNotes][Bases] Successfully registered view via public API: tasknotesCalendar
plugin:tasknotes:86 [TaskNotes][Bases] Successfully registered view via public API: tasknotesMiniCalendar
plugin:tasknotes:519 DependencyCache: getBlockingTaskPaths called before indexes built, building now...
getBlockingTaskPaths @ plugin:tasknotes:519
null:1  Failed to load resource: net::ERR_FILE_NOT_FOUND
Screenshot_20260101-185045.png]]:1  Failed to load resource: net::ERR_FILE_NOT_FOUND
```

- [x] On mobile, when I tap to scroll and I happen to be over a card, it triggers the card drag, which is jarring.  Let's make sure the card drag trigger only happens with a tap-hold delay on the card.
- [x] On mobile, tap holding a swimlane and dragging to the very edge of the screen should scroll vertically.  Right now I can drag a swimlane to an adjacent swimlane already in view, but I can't go beyond that.

- [x] Title config menu
- [x] Bases sort should sort cards
- [x] When `Group by` or `Swimlanes by` menus are set to `folder` or `tags`, for example, and I try to drag a card into another folder or tag column or swimlane, it doesn't work.  We need to support updating all property fields when a card is moved to another column or swimlane, including or moving Item Notes to the respective folder when applicable.  Any questions.
- [x] Should  "Add new" plus buttons in the bottom of the column (and column + swimlane) areas to add a new Item that auto-populates the New Item Modal according to the column and/or swimlane.  There should also be a new dropdown menu in the Kanban View Bases config menu called "Show add new buttons"  that allows the user to toggle whether they want these buttons to appear on the board.  For example, let's say `Group by` is set to "status" and `Swimlanes by` is set to "calendar".  If I click the plus button in the "To-Do" column and "Personal" swimlane, it should open the New Item Modal with status already set to "To-Do" and calendar set to "Personal".  Any questions?
- [x] Still doesn't move notes when dragging into a different folder area
- [x] Cover images still aren't working.  Need to support all kinds of frontmatter link types (driven by Obsidian's "Files and Links" >  "New Link Format" settings (relative, absolute, shortest)).  I suspect this might be the issue.  See the console log for details.
- [x] Scrolling with a touchpad is constrained to one axis at a time.  It would be nice to diagonally scroll / scroll both left-right and up-down at the smae time.
- [x] Let's have an option in the Kanban View Bases config menu for "freezing" the Column and Swimlane titles when scrolling (like how you can "freeze panes" in Excel)
- [x] Kanban View is causing an issue with Cards View and Table View where I can't scroll in either of the latter views when I have both views in the same base file (see `Calendar.base` in example-vault as an example.) I think it's because we were too aggressive with our styling and didn't remove old styling for the Kanban view and affected higher-level container styling that we didn't need that is now affecting Cards and Table Views.

## Release

- [x] Regenerate Bases should include all views.  Currently it only includes (or says that it includes) Calendar.base and Task List.base. 
- [ ] Sensible defaults for enabled properties and filters for every view.  (Show Claude these defaults).  Installation of Planner and clicking the generate Bases button in settings should create these Bases file using these defaults.  
- [ ] When Planner is installed and enabled, Planner should automatically generate new bases files in the default ("Planner") folder.  
- [ ] When Planner is installed and enabled, and its Bases files are generated automatically, each generated base view should include a filter for "All Views" where `file` `in folder` `Planner`.   After this initial installation/generation, If the user changes the default Planner folder in settings and/or adds new calendars with custom folders per calendar in settings, and then the user clicks "Generate Bases" button in settings, the "All Views" filter for each View should update to include the additional/changed values for the folder(s).  The goal here is to create sensible defaults and to prevent the views from lagging or appearing instantly cluttered on load for users with large vaults (many notes) that may have some of the frontmatter that we use in our schema (such as "status").  
- [ ] Item Template path in settings is not working

- [ ] Planner update PRD with our changes. 
- [ ] Planner publish 0.1.0
	- [ ] Docs (Zensical) site (clone repo to ref folder)
	- [ ] Issue Templates
	- [ ] Project board
	- [ ] Generate a lot of examples in `examples` vault per user persona in PRD
		- [ ] Add “History Scholar” and “Book Enthusiast” personas
	- [ ] Readme.md
	- [ ] License - GPL? or MIT?

Other

- [ ] (v0.0.2) What if the Edit Item Modal's expand details dynamically pulls frontmatter content from whatever note is selected?  Right now it's still very tailored to Planner/Calendar users
- [ ] Map View integration in calendar item mobile popup.  
- [ ] Embed Map View in Calendar template
	- [ ] Then you could pick a location on the map and copy to frontmatter
- [ ] Embed the Day's agenda base view in Daily note template.
- [ ] Embed Map View in daily note?  That way can easily draw/edit where I went that day?
- [ ] Option to add multiple filter folders and multiple filter tags in settings 
- [ ] Embed Calendar view base in each New Item. That way it's easier to see changes to metadata happen live without having to change tabs