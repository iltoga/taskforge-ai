'use client';

import { ModelType } from '../config/models';

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
  const models: { value: ModelType; label: string; description: string }[] = [
    {
      value: 'gpt-4o-mini',
      label: 'GPT-4o Mini',
      description: 'Fast and efficient for reasoning tasks'
    },
    {
      value: 'gpt-4o',
      label: 'GPT-4o',
      description: 'More capable, better for complex reasoning'
    },
    {
      value: 'o3',
      label: 'O3',
      description: 'Advanced reasoning model'
    },
    {
      value: 'o3-mini',
      label: 'O3 Mini',
      description: 'Lighter reasoning model'
    },
    {
      value: 'deepseek/deepseek-r1-0528:free',
      label: 'DeepSeek R1 (Free)',
      description: 'Alternative reasoning model via OpenRouter'
    },
  ];

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
        {models.map((model) => (
          <option key={model.value} value={model.value}>
            {model.label}
          </option>
        ))}
      </select>
      <div className="text-xs text-base-content/50">
        {models.find(m => m.value === selectedModel)?.description}
      </div>
    </div>
  );
}
