import type { ProviderConfig, ProviderId } from './types'

export const PROVIDERS: Record<ProviderId, ProviderConfig> = {
  openrouter: {
    id: 'openrouter',
    name: 'OpenRouter',
    models: [
      { id: 'anthropic/claude-sonnet-4.5', label: 'Claude Sonnet 4.5' },
      { id: 'openai/gpt-5', label: 'GPT-5' },
      { id: 'openai/o4-mini', label: 'o4-mini (reasoning)' },
      { id: 'google/gemini-3-pro-preview', label: 'Gemini 3 Pro' },
      { id: 'deepseek/deepseek-r1', label: 'DeepSeek R1 (reasoning)' },
      { id: 'meta-llama/llama-4-scout', label: 'Llama 4 Scout' },
    ],
  },
  gemini: {
    id: 'gemini',
    name: 'Google Gemini',
    models: [
      { id: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro' },
      { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
      { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
    ],
  },
}

export function defaultModel(provider: ProviderId): string {
  return PROVIDERS[provider].models[0].id
}

export function modelLabel(provider: ProviderId, model: string): string {
  const found = PROVIDERS[provider].models.find((m) => m.id === model)
  return found ? found.label : model
}
