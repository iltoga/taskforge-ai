/**
 * Simple verification test for provider selection refactoring
 */
import { getModelInfo } from '../components/ModelSelector';

describe('Provider Selection', () => {
  it('should correctly identify OpenAI models', () => {
    const gpt4Info = getModelInfo('gpt-4o-mini');
    expect(gpt4Info?.provider).toBe('openai');

    const o3Info = getModelInfo('o3-mini');
    expect(o3Info?.provider).toBe('openai');
  });

  it('should correctly identify OpenRouter models', () => {
    const geminiInfo = getModelInfo('google/gemini-2.0-flash-001');
    expect(geminiInfo?.provider).toBe('openrouter');
  });

  it('should return undefined for unknown models', () => {
    // Test with a cast to bypass TypeScript checking for this specific test
    const unknownInfo = getModelInfo('unknown-model' as 'gpt-4o-mini');
    expect(unknownInfo).toBeUndefined();
  });
});
