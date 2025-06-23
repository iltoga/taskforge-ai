// Test to understand why "summarize last week calendar activities" might not work in agentic mode

const testMessage = "summarize last week calendar activities";

// Test isCalendarQuery logic
function isCalendarQuery(userMessage) {
  const calendarKeywords = [
    // Reading/searching calendar
    'events', 'meetings', 'calendar', 'schedule', 'appointment',
    'show me', 'list', 'find', 'search', 'when', 'what meetings',
    'holistic vision', 'summary', 'overview',
    // Creating/modifying calendar events
    'add', 'create', 'schedule', 'book', 'set up', 'make', 'plan',
    'update', 'change', 'modify', 'edit', 'reschedule', 'move',
    'delete', 'remove', 'cancel', 'clear',
    // Project/work references (calendar context)
    'italmagneti', 'nespola', 'project', 'work', 'daily report',
    'meeting', 'call', 'appointment', 'reminder'
  ];

  const messageLower = userMessage.toLowerCase();
  return calendarKeywords.some(keyword => messageLower.includes(keyword));
}

console.log('Test message:', testMessage);
console.log('Is calendar query:', isCalendarQuery(testMessage));
console.log('Message contains "summary":', testMessage.toLowerCase().includes('summary'));
console.log('Message contains "calendar":', testMessage.toLowerCase().includes('calendar'));
console.log('Message contains "activities":', testMessage.toLowerCase().includes('activities'));

// Check which keywords match
const calendarKeywords = [
  'events', 'meetings', 'calendar', 'schedule', 'appointment',
  'show me', 'list', 'find', 'search', 'when', 'what meetings',
  'holistic vision', 'summary', 'overview',
  'add', 'create', 'schedule', 'book', 'set up', 'make', 'plan',
  'update', 'change', 'modify', 'edit', 'reschedule', 'move',
  'delete', 'remove', 'cancel', 'clear',
  'italmagneti', 'nespola', 'project', 'work', 'daily report',
  'meeting', 'call', 'appointment', 'reminder'
];

const messageLower = testMessage.toLowerCase();
const matchingKeywords = calendarKeywords.filter(keyword => messageLower.includes(keyword));
console.log('Matching keywords:', matchingKeywords);

// The issue might be in the tool decision - let's simulate what the AI should decide
console.log('\n--- Tool Decision Simulation ---');
console.log('This should trigger calendar tools like getEvents or searchEvents');
console.log('with time range for "last week"');

// Test different variations of the message
const variations = [
  "summarize last week calendar activities",
  "show me last week events",
  "list my calendar events from last week",
  "what meetings did I have last week",
  "calendar summary for past week"
];

console.log('\n--- Testing message variations ---');
variations.forEach(msg => {
  console.log(`"${msg}" -> isCalendarQuery: ${isCalendarQuery(msg)}`);
});
