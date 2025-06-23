const testMessage = "summarize last week calendar activities";
const messageLower = testMessage.toLowerCase();

console.log('Testing message:', testMessage);
console.log('Lowercase:', messageLower);
console.log('Contains summarize:', messageLower.includes('summarize'));
console.log('Contains events:', messageLower.includes('events'));
console.log('Contains list:', messageLower.includes('list'));
console.log('Contains show:', messageLower.includes('show'));
console.log('Contains past:', messageLower.includes('past'));
console.log('Contains report:', messageLower.includes('report'));

// Should match the main condition
const shouldMatch = messageLower.includes('summarize') || messageLower.includes('events') || messageLower.includes('list') || messageLower.includes('show') || messageLower.includes('past') || messageLower.includes('report');
console.log('Should match condition:', shouldMatch);

// Test time range extraction
function extractTimeRange(message) {
  const messageLower = message.toLowerCase();
  const now = new Date();

  // Look for relative time expressions
  if (messageLower.includes('past week') || messageLower.includes('last week') || messageLower.includes('previous week')) {
    const startOfLastWeek = new Date(now);
    startOfLastWeek.setDate(now.getDate() - now.getDay() - 7); // Start of last week (Sunday)
    startOfLastWeek.setHours(0, 0, 0, 0);

    const endOfLastWeek = new Date(startOfLastWeek);
    endOfLastWeek.setDate(startOfLastWeek.getDate() + 6); // End of last week (Saturday)
    endOfLastWeek.setHours(23, 59, 59, 999);

    return {
      start: startOfLastWeek.toISOString(),
      end: endOfLastWeek.toISOString()
    };
  }

  return { start: 'default', end: 'default' };
}

const timeRange = extractTimeRange(testMessage);
console.log('Time range:', timeRange);
