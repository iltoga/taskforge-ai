// Quick debug script to test the event structure and mapping fix
import { CalendarTools } from './src/tools/calendar-tools.js';

async function testEventStructure() {
  try {
    console.log('🔧 Testing event structure and mapping...');

    const calendarTools = new CalendarTools();

    // Get events for last week (mimicking the user's request)
    const now = new Date();
    const startOfLastWeek = new Date(now);
    startOfLastWeek.setDate(now.getDate() - now.getDay() - 7);
    startOfLastWeek.setHours(0, 0, 0, 0);

    const endOfLastWeek = new Date(startOfLastWeek);
    endOfLastWeek.setDate(startOfLastWeek.getDate() + 6);
    endOfLastWeek.setHours(23, 59, 59, 999);

    console.log('📅 Fetching events from', startOfLastWeek.toISOString(), 'to', endOfLastWeek.toISOString());

    const events = await calendarTools.getEvents(
      startOfLastWeek.toISOString(),
      endOfLastWeek.toISOString()
    );

    console.log(`📊 Found ${events.length} events`);

    if (events.length > 0) {
      console.log('🔍 First event structure:');
      console.log(JSON.stringify(events[0], null, 2));

      // Test the field mapping logic
      const event = events[0];
      const eventWithTitle = event;
      const title = eventWithTitle.title || event.summary || 'Untitled Event';
      const startDate = eventWithTitle.startDate || event.start?.dateTime || event.start?.date;
      const endDate = eventWithTitle.endDate || event.end?.dateTime || event.end?.date;

      console.log('🧪 Field mapping test:');
      console.log('  Title:', title);
      console.log('  Start Date:', startDate);
      console.log('  End Date:', endDate);

      if (startDate && startDate !== 'Unknown date') {
        const date = new Date(startDate);
        console.log('  Formatted date:', date.toLocaleDateString());
        console.log('  Is valid date:', !isNaN(date.getTime()));
      } else {
        console.log('  ❌ No valid start date found');
      }
    }

  } catch (error) {
    console.error('❌ Error testing event structure:', error);
  }
}

testEventStructure();
