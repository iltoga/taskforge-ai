// Simulate the processMessageWithTools logic for debugging

const message = "summarize last week calendar activities";
const messageLower = message.toLowerCase();

console.log('=== DEBUGGING processMessageWithTools ===');
console.log('Input message:', message);
console.log('Lowercase:', messageLower);

// Test the condition
const shouldTriggerEventQuery = messageLower.includes('summarize') ||
  messageLower.includes('events') ||
  messageLower.includes('list') ||
  messageLower.includes('show') ||
  messageLower.includes('past') ||
  messageLower.includes('report');

console.log('Should trigger event query:', shouldTriggerEventQuery);

if (shouldTriggerEventQuery) {
  // Check sub-conditions
  const hasNespola = messageLower.includes('nespola');
  const hasSearchKeyword = messageLower.includes('search') && (messageLower.includes('keyword') || messageLower.includes('term'));

  console.log('Has Nespola:', hasNespola);
  console.log('Has search keyword pattern:', hasSearchKeyword);

  if (hasNespola) {
    console.log('-> Would call searchEvents for Nespola');
  } else if (hasSearchKeyword) {
    console.log('-> Would call searchEvents with extracted keyword');
  } else {
    console.log('-> Would call getEvents for general listing/summarization');
    console.log('-> This is the expected path for our message');
  }
} else {
  console.log('Would not trigger event query - checking other conditions...');

  const shouldTriggerEventCreation = messageLower.includes('create') ||
    messageLower.includes('schedule') ||
    messageLower.includes('add') ||
    messageLower.includes('book') ||
    messageLower.includes('plan');

  console.log('Should trigger event creation:', shouldTriggerEventCreation);

  if (!shouldTriggerEventCreation) {
    console.log('-> Would return generic response: "I understand your request, but I\'m not sure how to help with that specific calendar operation yet."');
  }
}

// Test time range extraction
function extractTimeRange(message) {
  const messageLower = message.toLowerCase();
  const now = new Date();

  if (messageLower.includes('past week') || messageLower.includes('last week') || messageLower.includes('previous week')) {
    const startOfLastWeek = new Date(now);
    startOfLastWeek.setDate(now.getDate() - now.getDay() - 7);
    startOfLastWeek.setHours(0, 0, 0, 0);

    const endOfLastWeek = new Date(startOfLastWeek);
    endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
    endOfLastWeek.setHours(23, 59, 59, 999);

    return {
      start: startOfLastWeek.toISOString(),
      end: endOfLastWeek.toISOString()
    };
  }

  return { start: 'default', end: 'default' };
}

const timeRange = extractTimeRange(message);
console.log('\n=== TIME RANGE EXTRACTION ===');
console.log('Extracted time range:', timeRange);

if (timeRange.start !== 'default') {
  console.log('Start date:', new Date(timeRange.start).toLocaleDateString());
  console.log('End date:', new Date(timeRange.end).toLocaleDateString());
}
