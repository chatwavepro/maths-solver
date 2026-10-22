export type Role = 'user' | 'assistant'

export interface ChatMessage {
  id: string
  role: Role
  content: string
  error?: boolean
}

export interface Conversation {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

export type ProviderId = 'openrouter' | 'gemini'

export interface ProviderModel {
  id: string
  label: string
}

export interface ProviderConfig {
  id: ProviderId
  name: string
  models: ProviderModel[]
}

export interface Settings {
  provider: ProviderId
  apiKey: string
  model: string
  temperature: number
  systemPrompt: string
}

export const DEFAULT_SYSTEM_PROMPT = `You are MathMind, an expert mathematical and logical reasoning assistant.

Rules:
1. ALWAYS show your work as clear, numbered steps ("### Step 1", "### Step 2", ...). Never just give the answer.
2. Use LaTeX for all mathematics: inline math as $...$ and display equations as $$...$$. The client renders KaTeX.
3. Be precise. Double-check every arithmetic operation before writing it down.
4. After the final result, include a separate section titled "### Verification" that checks the answer by substitution or an alternative method.
5. State any assumptions, domains, constraints, or edge cases when relevant.
6. For logic problems, consider using truth tables or formal notation where helpful.
7. Keep explanations concise but complete; use markdown formatting (bold key results, lists) for readability.`
