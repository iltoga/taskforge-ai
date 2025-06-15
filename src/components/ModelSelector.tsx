'use client';

import { Bot, Brain, ChevronDown, Cpu, Sparkles, Zap } from 'lucide-react';
import { useState } from 'react';

export type ModelType = 'gpt-4o' | 'gpt-4o-mini' | 'gpt-4.1' | 'gpt-4.1-mini' | 'o3' | 'o3-mini';

interface ModelInfo {
  id: ModelType;
  name: string;
  description: string;
  icon: React.ReactNode;
  pricing: string;
  contextWindow: string;
  badge?: string;
}

const models: ModelInfo[] = [
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o Mini',
    description: 'Fast & cost-effective for most tasks',
    icon: <Zap className="w-4 h-4" />,
    pricing: '$0.15/1M tokens',
    contextWindow: '128K',
    badge: 'Default'
  },
  {
    id: 'gpt-4o',
    name: 'GPT-4o',
    description: 'Multimodal, great for complex tasks',
    icon: <Sparkles className="w-4 h-4" />,
    pricing: '$5/1M tokens',
    contextWindow: '128K'
  },
  {
    id: 'gpt-4.1-mini',
    name: 'GPT-4.1 Mini',
    description: 'Next-gen small model, very low latency',
    icon: <Cpu className="w-4 h-4" />,
    pricing: '$0.83/1M tokens',
    contextWindow: '1M',
    badge: 'Fast'
  },
  {
    id: 'gpt-4.1',
    name: 'GPT-4.1',
    description: 'State-of-the-art, huge context',
    icon: <Brain className="w-4 h-4" />,
    pricing: '$2.5/1M tokens',
    contextWindow: '1M',
    badge: 'Premium'
  },
  {
    id: 'o3-mini',
    name: 'o3-mini',
    description: 'Latest reasoning model, cost-effective',
    icon: <Zap className="w-4 h-4" />,
    pricing: '$1/1M tokens',
    contextWindow: '128K',
    badge: 'Reasoning'
  },
  {
    id: 'o3',
    name: 'o3',
    description: 'Advanced reasoning capabilities',
    icon: <Brain className="w-4 h-4" />,
    pricing: '$15/1M tokens',
    contextWindow: '128K',
    badge: 'Latest'
  }
];

interface ModelSelectorProps {
  selectedModel: ModelType;
  onModelChange: (model: ModelType) => void;
}

export function ModelSelector({ selectedModel, onModelChange }: ModelSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);

  const currentModel = models.find(m => m.id === selectedModel) || models[0];

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

        {models.map((model) => (
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

        <li className="menu-title mt-2">
          <span className="text-xs text-base-content/50">
            💡 GPT-4.1 models feature 1M context • o3 models have advanced reasoning
          </span>
        </li>
      </ul>
    </div>
  );
}
