// Quick test to verify vectorStoreIds are being loaded and passed correctly

const { vectorSearchExecutor } = require('./src/tools/vector-search-tool.ts');

async function testVectorStoreIds() {
  console.log('Testing vectorFileSearch with explicit vectorStoreIds...');

  try {
    // Test with explicit vectorStoreIds
    const result1 = await vectorSearchExecutor({
      query: 'test query',
      vectorStoreIds: ['vs_6856abe00a4081918be9af94278a7f2c'],
      maxResults: 5
    });

    console.log('Test 1 (with explicit vectorStoreIds):', {
      success: result1.success,
      hasData: result1.data !== null,
      message: result1.message
    });

    // Test without vectorStoreIds (should load from config)
    const result2 = await vectorSearchExecutor({
      query: 'test query',
      maxResults: 5
    });

    console.log('Test 2 (without vectorStoreIds, should load from config):', {
      success: result2.success,
      hasData: result2.data !== null,
      message: result2.message
    });

  } catch (error) {
    console.error('Test failed:', error.message);
  }
}

testVectorStoreIds();
