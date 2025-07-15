const { PrismaClient } = require('@prisma/client');

async function testSession() {
  const prisma = new PrismaClient();

  try {
    console.log('Testing session model...');
    const sessions = await prisma.session.findMany({take: 1});
    console.log('✅ Session model accessible, found', sessions.length, 'records');

    // Test creating a session
    console.log('Testing session creation...');
    const user = await prisma.user.create({
      data: {
        email: 'test@example.com',
        name: 'Test User'
      }
    });

    const session = await prisma.session.create({
      data: {
        sessionToken: 'test-token-' + Date.now(),
        userId: user.id,
        expires: new Date(Date.now() + 24 * 60 * 60 * 1000),
        chatHistory: [{ id: '1', type: 'user', content: 'test', timestamp: Date.now() }],
        processedFiles: [{ name: 'test.txt', size: 100, type: 'text/plain' }],
        fileSearchSignature: 'test-signature'
      }
    });

    console.log('✅ Session created with ID:', session.id);

  } catch (error) {
    console.error('❌ Error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

testSession();
