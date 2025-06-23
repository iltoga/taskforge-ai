#!/usr/bin/env node

/**
 * Quick debug script to examine vector search response structure
 */

import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function debugVectorSearchStructure() {
  console.log('🔍 Testing vector search API structure...\n');

  const vectorStoreId = 'vs_6856abe00a4081918be9af94278a7f2c';
  const query = 'I am italian, can I apply for a tourist visa in indonesia?';

  try {
    const response = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        query: query,
        max_num_results: 2
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error:', response.status, errorText);
      return;
    }

    const searchResults = await response.json();

    console.log('=== First Result Structure ===');
    if (searchResults.data && searchResults.data.length > 0) {
      const firstResult = searchResults.data[0];
      console.log('File ID:', firstResult.file_id);
      console.log('Filename:', firstResult.filename);
      console.log('Score:', firstResult.score);
      console.log('Content type:', typeof firstResult.content);
      console.log('Content is array:', Array.isArray(firstResult.content));
      console.log('Content length:', firstResult.content?.length);

      if (Array.isArray(firstResult.content) && firstResult.content.length > 0) {
        console.log('\n=== First Content Item ===');
        const firstContentItem = firstResult.content[0];
        console.log('Content item type:', typeof firstContentItem);
        console.log('Content item keys:', Object.keys(firstContentItem || {}));
        console.log('Content item:', JSON.stringify(firstContentItem, null, 2));

        if (firstResult.content.length > 1) {
          console.log('\n=== Second Content Item ===');
          const secondContentItem = firstResult.content[1];
          console.log('Content item type:', typeof secondContentItem);
          console.log('Content item keys:', Object.keys(secondContentItem || {}));
          console.log('Content item:', JSON.stringify(secondContentItem, null, 2));
        }
      }
    }

  } catch (error) {
    console.error('❌ Error during test:', error.message);
  }
}

debugVectorSearchStructure().catch(console.error);
