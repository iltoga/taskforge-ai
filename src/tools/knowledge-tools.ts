import { ToolRegistry } from './tool-registry';
import { VectorSearchToolDefinition, vectorSearchExecutor } from './vector-search-tool';

export function registerKnowledgeTools(registry: ToolRegistry) {
  registry.registerTool(VectorSearchToolDefinition, vectorSearchExecutor);
}
