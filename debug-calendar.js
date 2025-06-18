/**
 * Debug script to test Google Calendar API directly
 *
 * This script helps debug calendar issues by:
 * 1. Testing direct Google Calendar API calls
 * 2. Checking what events are actually being returned
 * 3. Verifying date filtering and search queries
 *
 * To use this script:
 * 1. Get your access token from the real app (check browser dev tools for the token)
 * 2. Run: node debug-calendar.js YOUR_ACCESS_TOKEN
 */

const https = require('https');

if (process.argv.length < 3) {
  console.log('Usage: node debug-calendar.js YOUR_ACCESS_TOKEN');
  console.log('');
  console.log('To get your access token:');
  console.log('1. Open the calendar app in your browser');
  console.log('2. Open Developer Tools (F12)');
  console.log('3. Go to Network tab');
  console.log('4. Make a calendar request in the app');
  console.log('5. Look for the Authorization header in the request');
  console.log('6. Copy the token after "Bearer "');
  process.exit(1);
}

const accessToken = process.argv[2];

function makeCalendarRequest(params, description) {
  return new Promise((resolve, reject) => {
    const queryString = new URLSearchParams(params).toString();
    const url = `/calendar/v3/calendars/primary/events?${queryString}`;

    console.log(`\n🔍 ${description}`);
    console.log(`📞 GET https://www.googleapis.com${url}`);

    const options = {
      hostname: 'www.googleapis.com',
      port: 443,
      path: url,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Accept': 'application/json'
      }
    };

    const req = https.request(options, (res) => {
      let data = '';

      res.on('data', (chunk) => {
        data += chunk;
      });

      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          resolve({ status: res.statusCode, data: parsed });
        } catch (e) {
          reject(new Error(`Failed to parse JSON: ${e.message}`));
        }
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.end();
  });
}

async function debugCalendar() {
  console.log('🚀 Starting Calendar API Debug Session');
  console.log('=====================================');

  try {
    // Test 1: Basic events without date range
    const test1 = await makeCalendarRequest({
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime'
    }, 'Test 1: Basic recent events (no date filter)');

    console.log(`📊 Status: ${test1.status}`);
    if (test1.status === 200) {
      console.log(`📅 Found ${test1.data.items?.length || 0} events`);
      if (test1.data.items?.length > 0) {
        console.log('📝 First few events:');
        test1.data.items.slice(0, 3).forEach((event, i) => {
          console.log(`  ${i + 1}. ${event.summary} - ${event.start?.dateTime || event.start?.date}`);
          console.log(`     Description: ${event.description || 'No description'}`);
        });
      }
    } else {
      console.log(`❌ Error: ${JSON.stringify(test1.data, null, 2)}`);
    }

    // Test 2: Events with date range for 2025
    const test2 = await makeCalendarRequest({
      timeMin: '2025-03-01T00:00:00Z',
      timeMax: '2025-06-30T23:59:59Z',
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime'
    }, 'Test 2: Events in March-June 2025');

    console.log(`📊 Status: ${test2.status}`);
    if (test2.status === 200) {
      console.log(`📅 Found ${test2.data.items?.length || 0} events in March-June 2025`);
      if (test2.data.items?.length > 0) {
        console.log('📝 Events in 2025:');
        test2.data.items.forEach((event, i) => {
          console.log(`  ${i + 1}. ${event.summary} - ${event.start?.dateTime || event.start?.date}`);
          console.log(`     Description: ${event.description || 'No description'}`);
        });
      }
    } else {
      console.log(`❌ Error: ${JSON.stringify(test2.data, null, 2)}`);
    }

    // Test 3: Search for "nespola" events
    const test3 = await makeCalendarRequest({
      q: 'nespola',
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime'
    }, 'Test 3: Search for "nespola" events (any date)');

    console.log(`📊 Status: ${test3.status}`);
    if (test3.status === 200) {
      console.log(`📅 Found ${test3.data.items?.length || 0} events matching "nespola"`);
      if (test3.data.items?.length > 0) {
        console.log('📝 Nespola events:');
        test3.data.items.forEach((event, i) => {
          console.log(`  ${i + 1}. ${event.summary} - ${event.start?.dateTime || event.start?.date}`);
          console.log(`     Description: ${event.description || 'No description'}`);
          console.log(`     Location: ${event.location || 'No location'}`);
        });
      } else {
        console.log('🤔 No events found with "nespola" query');
        console.log('💡 Try different search terms or check if events contain "nespola" in title/description');
      }
    } else {
      console.log(`❌ Error: ${JSON.stringify(test3.data, null, 2)}`);
    }

    // Test 4: Search for "nespola" with date range
    const test4 = await makeCalendarRequest({
      q: 'nespola',
      timeMin: '2025-03-01T00:00:00Z',
      timeMax: '2025-06-30T23:59:59Z',
      maxResults: 50,
      singleEvents: true,
      orderBy: 'startTime'
    }, 'Test 4: Search for "nespola" events in March-June 2025');

    console.log(`📊 Status: ${test4.status}`);
    if (test4.status === 200) {
      console.log(`📅 Found ${test4.data.items?.length || 0} events matching "nespola" in March-June 2025`);
      if (test4.data.items?.length > 0) {
        console.log('📝 Nespola events in 2025:');
        test4.data.items.forEach((event, i) => {
          console.log(`  ${i + 1}. ${event.summary} - ${event.start?.dateTime || event.start?.date}`);
          console.log(`     Description: ${event.description || 'No description'}`);
          console.log(`     Location: ${event.location || 'No location'}`);
        });
      } else {
        console.log('🤔 No events found with "nespola" query in March-June 2025');
      }
    } else {
      console.log(`❌ Error: ${JSON.stringify(test4.data, null, 2)}`);
    }

    console.log('\n🎯 SUMMARY');
    console.log('==========');
    console.log('1. Check if your calendar has events in March-June 2025');
    console.log('2. Check if any events contain "nespola" in the title, description, or location');
    console.log('3. Verify the access token has the correct calendar permissions');
    console.log('4. Try different search terms if "nespola" doesn\'t match anything');

  } catch (error) {
    console.error('💥 Debug session failed:', error.message);

    if (error.message.includes('401')) {
      console.log('\n💡 TIPS FOR 401 UNAUTHORIZED:');
      console.log('- Make sure your access token is valid and not expired');
      console.log('- Ensure the token has calendar read permissions');
      console.log('- Try getting a fresh token from the app');
    }
  }
}

debugCalendar();
