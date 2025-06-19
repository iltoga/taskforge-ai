'use client';

import { MODEL_CONFIGS, ModelType } from '../config/models';

interface OrchestratorModelSelectorProps {
  selectedModel: ModelType;
  onModelChange: (model: ModelType) => void;
  disabled?: boolean;
}

export function OrchestratorModelSelector({
  selectedModel,
  onModelChange,
  disabled = false
}: OrchestratorModelSelectorProps) {
  // Use the same model configurations as the main ModelSelector
  const models = MODEL_CONFIGS.map(config => ({
    value: config.id,
    label: config.name,
    description: config.description,
    provider: config.provider,
    badge: config.badge
  }));

  // Separate models by provider for better organization
  const openaiModels = models.filter(m => m.provider === 'openai');
  const openrouterModels = models.filter(m => m.provider === 'openrouter');

  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-base-content/70 font-medium">
        Orchestrator AI:
      </label>
      <select
        value={selectedModel}
        onChange={(e) => onModelChange(e.target.value as ModelType)}
        className="select select-bordered select-sm w-full max-w-xs"
        disabled={disabled}
      >
        {/* OpenAI Models */}
        <optgroup label="OpenAI Models">
          {openaiModels.map((model) => (
            <option key={model.value} value={model.value}>
              {model.label}
              {model.badge ? ` (${model.badge})` : ''}
            </option>
          ))}
        </optgroup>

        {/* OpenRouter Models */}
        {openrouterModels.length > 0 && (
          <optgroup label="OpenRouter Models">
            {openrouterModels.map((model) => (
              <option key={model.value} value={model.value}>
                {model.label}
                {model.badge ? ` (${model.badge})` : ''}
              </option>
            ))}
          </optgroup>
        )}
      </select>
      <div className="text-xs text-base-content/50">
        {models.find(m => m.value === selectedModel)?.description}
      </div>
    </div>
  );
}
