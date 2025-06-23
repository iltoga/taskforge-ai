import fs from 'fs';
import path from 'path';
import { z } from 'zod';
import { ToolDefinition, ToolExecutor } from './tool-registry';

// Load config for vector store IDs
const configPath = path.resolve(process.cwd(), 'settings/vector-search.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
const { vectorStoreIds } = config;

// Tool parameter schema
export const VectorSearchParamsSchema = z.object({
  query: z.string().describe('The user query to search the knowledge base'),
  vectorStoreIds: z.array(z.string()).optional().describe('Vector store IDs to search (defaults to config)'),
  maxResults: z.number().optional().describe('Maximum number of results to return (default: 5)')
});

export const VectorSearchToolDefinition: ToolDefinition = {
  name: 'vectorFileSearch',
  description: 'Searches the knowledge base in one or more OpenAI vector stores using a factual-only approach. Returns only information found in the stores, never guesses or fabricates.',
  parameters: VectorSearchParamsSchema,
  category: 'Knowledge'
};

export const vectorSearchExecutor: ToolExecutor = async (parameters) => {
  const { query, vectorStoreIds: paramVectorStoreIds, maxResults = 10 } = VectorSearchParamsSchema.parse(parameters);

  // Use parameter vectorStoreIds if provided, otherwise fall back to config
  const actualVectorStoreIds = paramVectorStoreIds || vectorStoreIds;

  console.log('🔍 Vector search executing with store IDs:', actualVectorStoreIds);
  console.log('🔍 Query:', query);

  if (!actualVectorStoreIds || actualVectorStoreIds.length === 0) {
    return {
      success: false,
      error: 'No vector store IDs provided',
      message: 'Vector search failed - no vector stores configured.'
    };
  }

  try {
    // Use the first vector store ID (OpenAI vector search API only supports one at a time)
    const vectorStoreId = actualVectorStoreIds[0];

    // Use direct Vector Store Search API endpoint
    const response = await fetch(`https://api.openai.com/v1/vector_stores/${vectorStoreId}/search`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'OpenAI-Beta': 'assistants=v2'
      },
      body: JSON.stringify({
        query: query,
        max_num_results: maxResults
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Vector search API error:', response.status, errorText);
      return {
        success: false,
        error: `Vector search API error: ${response.status} - ${errorText}`,
        message: 'Vector search failed.'
      };
    }

    const searchResults = await response.json();
    console.log('✅ Vector search API response:', searchResults);

    // Check if we have results
    if (!searchResults.data || searchResults.data.length === 0) {
      return {
        success: true,
        data: null,
        message: "I couldn't find the answer in the uploaded knowledgebase"
      };
    }

    // Extract content from search results
    const relevantContent = searchResults.data
      .map((result: { content?: unknown; text?: string; chunk?: { content?: string } }) => {
        // Extract content from the search result
        if (result.content && Array.isArray(result.content)) {
          // Extract text from content objects
          return result.content
            .map((item: unknown) => {
              if (typeof item === 'object' && item !== null) {
                const obj = item as Record<string, unknown>;
                if (obj.type === 'text' && obj.text) {
                  return obj.text as string;
                }
              }
              return '';
            })
            .filter(text => text.trim().length > 0)
            .join(' ');
        } else if (result.text) {
          return result.text;
        } else if (result.chunk && result.chunk.content) {
          return result.chunk.content;
        }
        return '';
      })
      .filter((content: string) => content && typeof content === 'string' && content.trim().length > 0)
      .slice(0, 3) // Limit to top 3 results to avoid too much content
      .join('\n\n---\n\n');

    if (!relevantContent || relevantContent.trim().length === 0) {
      return {
        success: true,
        data: null,
        message: "I couldn't find the answer in the uploaded knowledgebase"
      };
    }

    return {
      success: true,
      data: relevantContent,
      message: 'Results found in the knowledge base.'
    };
  } catch (error) {
    console.error('❌ Vector search error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      message: 'Vector search failed.'
    };
  }
};
