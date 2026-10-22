import type { Conversation, Settings } from './types'
import { DEFAULT_SYSTEM_PROMPT } from './types'
import { defaultModel } from './providers'

const CONV_KEY = 'mathmind.conversations.v1'
const SETTINGS_KEY = 'mathmind.settings.v1'

export function defaultSettings(): Settings {
  return {
    provider: 'openrouter',
    apiKey: '',
    model: defaultModel('openrouter'),
    temperature: 0.2,
    systemPrompt: DEFAULT_SYSTEM_PROMPT,
  }
}

export function loadSettings(): Settings {
  try {
    const raw = localStorage.getItem(SETTINGS_KEY)
    if (!raw) return defaultSettings()
    return { ...defaultSettings(), ...JSON.parse(raw) }
  } catch {
    return defaultSettings()
  }
}

export function saveSettings(s: Settings): void {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s))
}

export function loadConversations(): Conversation[] {
  try {
    const raw = localStorage.getItem(CONV_KEY)
    if (!raw) return []
    const list = JSON.parse(raw) as Conversation[]
    return Array.isArray(list) ? list.sort((a, b) => b.updatedAt - a.updatedAt) : []
  } catch {
    return []
  }
}

export function saveConversations(list: Conversation[]): void {
  try {
    localStorage.setItem(CONV_KEY, JSON.stringify(list))
  } catch (e) {
    console.warn('Failed to persist conversations (storage full?)', e)
  }
}

export function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
}

export function maskKey(key: string): string {
  if (!key) return ''
  if (key.length <= 8) return '•'.repeat(key.length)
  return `${key.slice(0, 4)}…${key.slice(-4)}`
}
