import type { ChatMessage, Settings } from './types'

export interface StreamOptions {
  settings: Settings
  messages: ChatMessage[] // conversation history (user/assistant only)
  signal?: AbortSignal
  onToken: (token: string) => void
}

/** Streams a completion from the configured provider. Pure fetch — runs entirely client-side. */
export async function streamCompletion({ settings, messages, signal, onToken }: StreamOptions): Promise<void> {
  if (!settings.apiKey.trim()) {
    throw new Error('No API key set. Open ⚙️ Settings and add your ' + settings.provider + ' API key.')
  }
  return settings.provider === 'openrouter'
    ? streamOpenRouter(settings, messages, signal, onToken)
    : streamGemini(settings, messages, signal, onToken)
}

async function streamOpenRouter(
  settings: Settings,
  messages: ChatMessage[],
  signal: AbortSignal | undefined,
  onToken: (t: string) => void,
) {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    signal,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey.trim()}`,
      'HTTP-Referer': window.location.origin,
      'X-Title': 'MathMind — AI Math & Logic Solver',
    },
    body: JSON.stringify({
      model: settings.model,
      temperature: settings.temperature,
      stream: true,
      messages: [{ role: 'system', content: settings.systemPrompt }, ...messages.map((m) => ({ role: m.role, content: m.content }))],
    }),
  })
  if (!res.ok) throw await httpError(res, 'OpenRouter')

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const data = trimmed.slice(5).trim()
      if (data === '[DONE]') return
      try {
        const json = JSON.parse(data)
        const delta: string = json.choices?.[0]?.delta?.content ?? ''
        if (delta) onToken(delta)
      } catch {
        /* partial JSON — ignore */
      }
    }
  }
}

async function streamGemini(
  settings: Settings,
  messages: ChatMessage[],
  signal: AbortSignal | undefined,
  onToken: (t: string) => void,
) {
  const contents = messages.map((m) => ({
    role: m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }))
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    settings.model,
  )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(settings.apiKey.trim())}`

  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents,
      systemInstruction: { parts: [{ text: settings.systemPrompt }] },
      generationConfig: { temperature: settings.temperature },
    }),
  })
  if (!res.ok) throw await httpError(res, 'Gemini')

  const reader = res.body!.getReader()
  const decoder = new TextDecoder()
  let buffer = ''
  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      try {
        const json = JSON.parse(trimmed.slice(5).trim())
        const parts = json.candidates?.[0]?.content?.parts ?? []
        for (const p of parts) if (p.text) onToken(p.text)
      } catch {
        /* partial JSON — ignore */
      }
    }
  }
}

async function httpError(res: Response, provider: string): Promise<Error> {
  let detail = ''
  try {
    const body = await res.json()
    detail = body?.error?.message ?? JSON.stringify(body).slice(0, 200)
  } catch {
    detail = (await res.text().catch(() => '')).slice(0, 200)
  }
  const hints: Record<number, string> = {
    401: 'Invalid or missing API key.',
    402: 'Insufficient credits with this provider.',
    403: 'Access forbidden — check your key permissions.',
    429: 'Rate limited — wait a moment and retry.',
  }
  return new Error(`${provider} error ${res.status}: ${hints[res.status] ?? detail || res.statusText}`)
}
