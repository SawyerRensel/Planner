
## Inspiration 

- https://github.com/callumalpass/tasknotes
	- Main source of inspiration. It uses modern Obsidian Bases to power it's views.  The UI and UX is excellent.  I basically want to remake this plugin from the ground up with better metadata, more features geared towards calendar event users (not strictly tasks), and adding a Gantt view powered by Obsidian Bases and frappe-gantt.
- https://github.com/obsidian-community/obsidian-full-calendar
	- I like some features of this old plugin like adding calendars and picking a color for a calendar.  I'm not a huge fan of 
- https://github.com/obsmd-projects/obsidian-projects
	- I like the modularity of this system.  It's deprecated now that we have Obsidian Bases, but it was a pioneer in true project management in Obsidian.
- https://docs.github.com/en/issues/planning-and-tracking-with-projects
	- GitHub Projects is a huge inspiration for how you can set up metadata fields - date fields in particular - and create a functioning Gantt chart in no time as a result.  It's abstraction and hands off nature make it all the more powerful.  You define the metadata, and then you can create your own custom views based on that metadata: Gantt, Table, and Kanban.

## Desired Improvements (to TaskNotes)

- Would be nice to adjust/or replace Full Calendar so the recurring feature is set according to metadata, not in the title
- Also calendar type specified by metadata, not folder location.  One folder for all calendar events. 
- Wish I could have a Gantt functionality with it too.  
- Settings: Set color by metadata field (e.g. for different “calendars”).  Default is to have calendar by color instead of priority on the calendar view.
	- Ability to mark events as tasks or simply events upon task creation
- Fix frontmatter fields.  Use `Date & Time` instead of the silly duration minutes like TaskNotes does. Set `date_scheduled` to 00:00 and `date_due`to 24:00 if task is all day
- Frontmatter fields (Every task or event gets all of these.)
	- title (text)
	- summary (text)
	- calendar (text)
	- location (text)
	- context (list)
	- people (list)
	- related (list)
	- all_day (bool)
	- task (bool)
	- date_created (date & time)
	- date_modified (date & time)
	- date_scheduled (date & time)
	- date_started (date & time)
	- date_due (date & time)
	- date_eta (date & time) (estimated finish date)
	- date_finished (date & time)
	- repeat_frequency (text) (options include `secondly`, `minutely`, `hourly`, `daily`, `weekly`, `monthly`, or `yearly`.)
	- repeat_interval (int) (A positive integer representing how often the frequency repeats (e.g., `repeat_interval`=`2` with `repeat_frequency`=`weekly` means every two weeks).)
	- repeat_until (date & time) (Sets a fixed end date for the recurrence.)
	- repeat_count (int) (The total number of occurrences before the rule expires. If 0, not a recurring task.)
	- repeat_by_day (list) (Specifies the days of the week (e.g., `Mo`, `Tu`, `We`, `Th`, `Fr`, `Sa`, `Su`).)
	- repeat_by_month ((list) of integers) (Limits the recurrence to specific months.) (Options include Integers 1 through 12)
	- repeat_by_monthday ((list) of integers) (Limits the recurrence to specific days of the month.) (options include 1 to 31 or -1 to -31 (negative values count from month end))
	- repeat_by_setposition (int) (Selects a specific instance from a list of occurrences (e.g., the last occurrence)) (	Positive or negative integers (e.g., -1 for the last instance))
	- repeat_instances_done (list) (list of dates completed)
	- priority (text)
	- status (text (e.g. in-progress, done…))
	- parent_task (text)
	- subtasks (list)
	- blocked_by (list)
	- blocking (list)
	- reminders (list) (list of date-times)
	- tags (list)
- Views: 
	- All the views TaskNotes currently supports: Calendar, Agenda, Kanban, Notes
	- Add new view:  Gantt
		- e.g. like this:
		- ![[gantt_view_mockup_example.png]]
- Option to include by tag or include by folder.  Any note with the right tag or in the right folder with the right metadata should display.  (I'm thinking displaying book notes or hunting notes etc. then I can add a filter to the base for viewing books vs. tasks vs. habits vs. calendar events)

## User Stories

- I am a novice Obsidian user and want an easy but robust replacement to Google Calendar
- I am an advanced Obsidian user and want to have an elegant and powerful replacement to Google Calendar and other personal project management tools I've used in the past like Asana and Trello.
- I am a very organized person and have a ton of hobby projects I have notes for in Obsidian, but no way to visualize them in a time-based format.  It would be nice to plan out my year in a Gantt chart and Calendar.  
- I am a project manager in a software engineering team and need an alternative to GitHub Projects, Asana, Clickup, Microsoft-Planner, etc. for managing multiple software projects at once.
- I am a super organized person and want to track my habits, hobbies, vacation plans, holidays, weekend trips on a Calendar.  I am a planning guru.  I want to plan out everything: every event, every task.  I want to see every news article that I read on a calendar.  I love Calendars and Gantt charts because the give me a big picture of my life; past, present, and future.  