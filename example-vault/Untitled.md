To make an event ongoing in FullCalendar (lasting until the current moment), set its `end` date to `moment()` or `new Date()` (or your current time) and its `start` date to some point in the past, or use dynamic event functions to fetch events that overlap the current time using `clientEvents` with a filter. For a simple, always-on event, set `start: '2020-01-01'` (or earlier) and `end: '2030-01-01'` (or a future date), or use the `events` function to filter data dynamically based on `info.start` and `info.end` passed by FullCalendar. 

Method 1: Using Static Event Data with Dynamic End Date

Set an event's `end` to the current time. This works well for events that started in the past and run _until now_.

javascript

```
events: [
  {
    title: 'Ongoing Project',
    start: '2024-01-01T09:00:00', // Starts in the past
    end: moment().toISOString() // Ends now (or use new Date().toISOString())
  }
]
```

- **Explanation:** The `end` property uses `moment().toISOString()` (or `new Date().toISOString()`) to capture the exact moment the calendar loads, making the event appear to run up to the present. 

Method 2: Using the `events` Function (Recommended for Real Data)

Fetch events and filter them within the function to only show those active at the current view's date range. 

javascript

```
events: function(info, successCallback, failureCallback) {
  // Assume you fetch events from a server
  // Here we simulate fetching and filtering
  const allEvents = [
    { title: 'Past Event', start: '2024-01-01', end: '2024-01-10' },
    { title: 'Future Event', start: '2025-01-01', end: '2025-01-10' },
    { title: 'Ongoing Today', start: '2025-01-08T10:00:00', end: '2025-01-09T18:00:00' } // Example ongoing event
  ];

  // Filter events that overlap the current view or are currently active
  const currentEvents = allEvents.filter(event => {
    const eventStart = moment(event.start);
    const eventEnd = moment(event.end);
    return eventStart < info.end && eventEnd > info.start; // Overlaps current view
  });

  successCallback(currentEvents);
}
```

- **Explanation:** `info.start` and `info.end` give the visible range. Filter `allEvents` to return only those that intersect with the current view, ensuring ongoing events show up. 

Method 3: Finding "Current" Events Dynamically (Client-Side)

Use `clientEvents` to get events active _right now_ within the calendar's current view.

javascript

```
let calendar = new Calendar(calendarEl, {
  // ... your calendar config ...
  events: [
    // ... your events array ...
  ]
});

// To find events active at the current moment:
const now = moment();
const currentEvents = calendar.getEvents().filter(event => {
  return moment(event.start).isBefore(now) && moment(event.end).isAfter(now);
});

// Now 'currentEvents' contains events that are ongoing
console.log(currentEvents);
```

- **Explanation:** This iterates through all events and uses `moment()` to check if the current time falls within their `start` and `end` times.