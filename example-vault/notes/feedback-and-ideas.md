
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

## Gantt View

- [x] Section 5.5 | Bar Click Popup: Use the same Item Modal used for Calendar view for a unified Item creation and editing experience. 
- [ ] Gantt Need forward and back arrows just like in Calendar View.  Let's also get rid of the Plus button.  
- [ ] Gantt Zoom.  Need to have dynamic zoom Plus/Minus buttons to expand or condense Gantt timeline in window.  For instance, clicking the Minus button would zoom out.  I would want to be able to see a 100+ year timeline if that is possible. 
- [x] Ability to expand or collapse the Gantt table.  (especially for mobile, as the table takes up a lot of space)
- [ ] Font size control for Gantt View (similar to Calendar View).  Add to Gantt View Configuration menu.
- [ ] Gantt View Day mode should show two hours per column at a time.  Right now it shows 4 hour increments.  Make the increments even (right now they're odd).

## Other

- [ ] Map View integration in calendar item mobile popup.  
- [ ] Embed Map View in Calendar template
- [ ] Embed the Day's agenda base view in Daily note template.
- [ ] Embed Map View in daily note?  That way can easily draw/edit where I went that day?
- [ ] Option to add multiple filter folders and multiple filter tags in settings 
- [ ] Embed Calendar view base in each New Item. That way it's easier to see changes to metadata happen live without having to change tabs