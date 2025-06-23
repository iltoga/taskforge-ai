/**
 * @jest-environment node
 */
// This test is excluded from 'npm run test' by default. Run manually for functional validation.
import 'dotenv/config';
import { registerKnowledgeTools } from '../../tools/knowledge-tools';
import { DefaultToolRegistry } from '../../tools/tool-registry';

describe('Vector Search Tool (Functional)', () => {
  let registry: DefaultToolRegistry;

  beforeAll(() => {
    registry = new DefaultToolRegistry();
    registerKnowledgeTools(registry);
  });

  it('returns a factual answer from the vector store or fallback if not found', async () => {
    const params = { query: 'I am italian, can I apply for a tourist visa in indonesia?' };
    const result = await registry.executeTool('vectorFileSearch', params);
    // Debug output
    if (!result.success) {
      // eslint-disable-next-line no-console
      console.error('Vector search tool failed:', result.error, result.message, result);
    }
    // Log the answer for visibility
    // eslint-disable-next-line no-console
    console.log('Vector search tool answer:', result.data || result.message);
    expect(result.success).toBe(true);
    if (result.data) {
      expect(typeof result.data).toBe('string');
      expect(result.data).not.toMatch(/I couldn\'t find the answer in the uploaded knowledgebase/);
    } else {
      expect(result.message).toBe("I couldn't find the answer in the uploaded knowledgebase");
    }
  }, 20000);
});
