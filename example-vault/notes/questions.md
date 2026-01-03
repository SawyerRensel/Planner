Let's begin Phase 5: Gantt View. Ask me any clarifying questions you may have before we implement. I have answered some of your existing questions in questions.md . Let's update the PRD to reflect these changes as well.

I'd be happy to help with these Calendar View improvements! Let me ask a few clarifying questions to make sure I understand the requirements correctly:


**1. Font Size Slider:**

- What range would you like for the font size slider? For example, should it go from something like 10px to 18px, or a percentage-based scale like 80% to 120%?

> Let's go from 6px to 18px. 

- When you say "a bit smaller" for the new default, do you have a specific reduction in mind (e.g., reduce by 2px, or ~10-15% smaller)?

> 20% smaller. 

**2. Mobile Layout Clarification:**

- For mobile, you want to go from 3 rows to 2 rows - so all action buttons (view modes, today icon, forward/back arrows) on row 1, and the calendar title (e.g., "January 2026") on row 2. Is that correct?

> Correct.

- Should all the action buttons be centered on mobile, or aligned in a specific way?

> Centered.

**3. Default Calendar Dropdown:**

- Where are the calendars currently defined in your settings? I want to make sure I pull from the correct source to populate the dropdown.

> It's the setting that says "Calendar Colors".  Let's also rename that heading to "Calendar Configuration and move it near the top of Planner Settings.

**4. View Mode Button Sizing:**

- When you say "reduce the size a little," do you have a target size in mind, or should I just make them proportionally smaller (e.g., ~80% of current size)?

> 80% of current size.

**5. Item Modal on Mobile:**

- Is the Item Modal the same as the "Quick Capture Item Modal" I see in the recent commits, or is this a different modal that appears when clicking on calendar items?

> Same one.