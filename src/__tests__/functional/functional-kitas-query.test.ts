/**
 * @jest-environment node
 */
// This test is excluded from 'npm run test' by default. Run manually for validation.
import 'dotenv/config';
import { ToolOrchestrator } from '../../services/tool-orchestrator';
import { registerKnowledgeTools } from '../../tools/knowledge-tools';
import { DefaultToolRegistry } from '../../tools/tool-registry';

describe('KITAS Query Functional Test', () => {
  let orchestrator: ToolOrchestrator;
  let registry: DefaultToolRegistry;

  beforeAll(() => {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not found in .env file');
    }

    orchestrator = new ToolOrchestrator(process.env.OPENAI_API_KEY);
    registry = new DefaultToolRegistry();
    registerKnowledgeTools(registry);
  });

  it('should use vectorFileSearch for KITAS modification question', async () => {
    const query = "My company director has a KITAS but was told by immigration he cannot perform his role as a DJ, even though it's for his own company's events. Can his permit be modified?";

    const result = await orchestrator.orchestrate(
      query,
      [], // Empty chat history
      registry,
      'gpt-4.1-mini-2025-04-14',
      {
        maxSteps: 3,
        maxToolCalls: 2,
        developmentMode: true
      }
    );

    // Debug output
    console.log('Orchestration Steps:');
    result.steps?.forEach(step => {
      console.log(`[${step.type.toUpperCase()}] ${step.content.substring(0, 150)}...`);
    });

    console.log('\nTool Calls:');
    result.toolCalls?.forEach(call => {
      console.log(`- ${call.tool}: ${call.result.success ? '✅' : '❌'} ${call.result.data || call.result.error}`);
    });

    // Assert vectorFileSearch was used
    const usedVectorSearch = result.toolCalls?.some(call =>
      call.tool === 'vectorFileSearch' && call.result.success
    );

    if (!usedVectorSearch) {
      console.error('\nFAILURE ANALYSIS:');
      console.error('Expected vectorFileSearch tool to be used successfully');
      console.error('Verify that:');
      console.error('1. Vector store IDs in config/vector-search.json are correct');
      console.error('2. The knowledge base contains relevant KITAS information');
      console.error('3. OpenAI API key has access to the specified model');
    }

    expect(usedVectorSearch).toBe(true);
  }, 30000); // 30s timeout
});