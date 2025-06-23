'use client';

import { Bot, Brain, ChevronDown, Cpu, Globe, Sparkles, Zap } from 'lucide-react';
import { useState } from 'react';
import { MODEL_CONFIGS, ModelType } from '../appconfig/models';

interface ModelInfo {
  id: ModelType;
  name: string;
  description: string;
  icon: React.ReactNode;
  pricing: string;
  contextWindow: string;
  provider: 'openai' | 'openrouter';
  badge?: string;
}

// Helper function to get icon based on model type
const getModelIcon = (modelId: ModelType, provider: 'openai' | 'openrouter'): React.ReactNode => {
  if (provider === 'openrouter') return <Globe className="w-4 h-4" />;
  if (modelId.includes('o3') || modelId.includes('reasoning')) return <Brain className="w-4 h-4" />;
  if (modelId.includes('o4') || modelId.includes('fast')) return <Zap className="w-4 h-4" />;
  if (modelId.includes('4o')) return <Sparkles className="w-4 h-4" />;
  if (modelId.includes('coding')) return <Cpu className="w-4 h-4" />;
  return <Bot className="w-4 h-4" />;
};

// Create models array with icons from the config
const models: ModelInfo[] = MODEL_CONFIGS.map(config => ({
  ...config,
  icon: getModelIcon(config.id, config.provider)
}));

// Export function to get model info (for testing)
export const getModelInfo = (modelId: ModelType): ModelInfo | undefined => {
  return models.find(m => m.id === modelId);
};

interface ModelSelectorProps {
  selectedModel: ModelType;
  onModelChange: (model: ModelType) => void;
}

export function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentModel = models.find(m => m.id === selectedModel) || models[0];
  const openaiModels = models.filter(m => m.provider === 'openai');
  const openrouterModels = models.filter(m => m.provider === 'openrouter');

  return (
    <div className="dropdown dropdown-end">
      <div
        tabIndex={0}
        role="button"
        className="btn btn-ghost btn-sm gap-2 normal-case"
        onClick={() => setIsOpen(!isOpen)}
      >
        <Bot className="w-4 h-4" />
        <span className="hidden sm:inline font-medium">{currentModel.name}</span>
        {currentModel.badge && (
          <div className="badge badge-primary badge-xs hidden lg:inline-flex">
            {currentModel.badge}
          </div>
        )}
        <ChevronDown className="w-3 h-3" />
      </div>

      <ul
        tabIndex={0}
        className="dropdown-content menu bg-base-100 rounded-box z-[1] w-80 p-2 shadow-xl border border-base-300"
      >
        <li className="menu-title">
          <span className="flex items-center gap-2">
            <Bot className="w-4 h-4" />
            Choose AI Model
          </span>
        </li>

        {/* OpenAI Models */}
        <li className="menu-title">
          <span className="flex items-center gap-2 text-primary">
            <Sparkles className="w-3 h-3" />
            OpenAI Models
          </span>
        </li>
        {openaiModels.map((model) => (
          <li key={model.id}>
            <a
              className={`p-3 ${selectedModel === model.id ? 'active' : ''}`}
              onClick={() => {
                onModelChange(model.id);
                setIsOpen(false);
              }}
            >
              <div className="flex items-start gap-3 w-full">
                <div className="text-primary mt-1">
                  {model.icon}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="font-semibold text-sm">{model.name}</span>
                    {model.badge && (
                      <div className={`badge badge-xs ${
                        model.badge === 'Default' ? 'badge-primary' :
                        model.badge === 'Reasoning' ? 'badge-secondary' :
                        model.badge === 'Premium' ? 'badge-accent' :
                        model.badge === 'Premium-Reasoning' ? 'badge-success' :
                        model.badge === 'Fast' ? 'badge-info' :
                        model.badge === 'Latest' ? 'badge-warning' : 'badge-neutral'
                      }`}>
                        {model.badge}
                      </div>
                    )}
                    {selectedModel === model.id && (
                      <div className="badge badge-success badge-xs">Active</div>
                    )}
                  </div>

                  <p className="text-xs text-base-content/70 mb-2">
                    {model.description}
                  </p>

                  <div className="flex items-center gap-4 text-xs text-base-content/60">
                    <span>💰 {model.pricing}</span>
                    <span>📝 {model.contextWindow}</span>
                  </div>
                </div>
              </div>
            </a>
          </li>
        ))}

        {/* OpenRouter Models */}
        {openrouterModels.length > 0 && (
          <>
            <li className="menu-title mt-2">
              <span className="flex items-center gap-2 text-secondary">
                <Globe className="w-3 h-3" />
                OpenRouter Models
              </span>
            </li>
            {openrouterModels.map((model) => (
              <li key={model.id}>
                <a
                  className={`p-3 ${selectedModel === model.id ? 'active' : ''}`}
                  onClick={() => {
                    onModelChange(model.id);
                    setIsOpen(false);
                  }}
                >
                  <div className="flex items-start gap-3 w-full">
                    <div className="text-secondary mt-1">
                      {model.icon}
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold text-sm">{model.name}</span>
                        {model.badge && (
                          <div className={`badge badge-xs ${
                            model.badge === 'Default' ? 'badge-primary' :
                            model.badge === 'Reasoning' ? 'badge-secondary' :
                            model.badge === 'Premium' ? 'badge-accent' :
                            model.badge === 'Premium-Reasoning' ? 'badge-success' :
                            model.badge === 'Fast' ? 'badge-info' :
                            model.badge === 'Latest' ? 'badge-warning' :
                            model.badge === 'OpenRouter' ? 'badge-info' :
                            model.badge === 'Free' ? 'badge-success' : 'badge-neutral'
                          }`}>
                            {model.badge}
                          </div>
                        )}
                        {selectedModel === model.id && (
                          <div className="badge badge-success badge-xs">Active</div>
                        )}
                      </div>

                      <p className="text-xs text-base-content/70 mb-2">
                        {model.description}
                      </p>

                      <div className="flex items-center gap-4 text-xs text-base-content/60">
                        <span>💰 {model.pricing}</span>
                        <span>📝 {model.contextWindow}</span>
                      </div>
                    </div>
                  </div>
                </a>
              </li>
            ))}
          </>
        )}

        <li className="menu-title mt-2">
          <span className="text-xs text-base-content/50">
            💡 o3 models have advanced reasoning • o4 models are fast & cost-effective • OpenRouter provides access to multiple AI providers
          </span>
        </li>
      </ul>
    </div>
  );
}
