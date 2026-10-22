import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Sidebar from './components/Sidebar'
import MessageBubble from './components/MessageBubble'
import SettingsModal from './components/SettingsModal'
import Scratchpad from './components/Scratchpad'
import type { ChatMessage, Conversation, Settings } from './lib/types'
import { PROVIDERS, modelLabel } from './lib/providers'
import { loadConversations, loadSettings, saveConversations, saveSettings, uid } from './lib/storage'
import { streamCompletion } from './lib/api'

const EXAMPLES = [
  { icon: '∫', title: 'Calculus', prompt: 'Evaluate the integral ∫ x·e^(2x) dx step by step using integration by parts.' },
  { icon: '√', title: 'Algebra', prompt: 'Solve 2x² − 7x − 3 = 0 using the quadratic formula and verify the roots.' },
  { icon: '¬', title: 'Logic', prompt: 'Determine whether (p → q) ↔ (¬q → ¬p) is a tautology. Show a full truth table.' },
  { icon: '🎲', title: 'Probability', prompt: 'Two fair dice are rolled. What is the probability the sum is 7 or greater? Show the counting argument.' },
]

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => loadSettings())
  const [conversations, setConversations] = useState<Conversation[]>(() => loadConversations())
  const [activeId, setActiveId] = useState<string | null>(null)
  const [input, setInput] = useState('')
  const [streaming, setStreaming] = useState(false)
  const [theme, setTheme] = useState<'light' | 'dark'>(() => {
    const saved = localStorage.getItem('mathmind.theme')
    if (saved === 'light' || saved === 'dark') return saved
    return window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [sidebarMobile, setSidebarMobile] = useState(false)
  const [scratchOpen, setScratchOpen] = useState(true)

  const abortRef = useRef<AbortController | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  const active = useMemo(() => conversations.find((c) => c.id === activeId) ?? null, [conversations, activeId])

  // ---- persistence -------------------------------------------------------
  useEffect(() => {
    saveConversations(conversations)
  }, [conversations])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    localStorage.setItem('mathmind.theme', theme)
  }, [theme])

  // autoscroll while streaming
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 160
    if (nearBottom) el.scrollTop = el.scrollHeight
  }, [active?.messages, streaming])

  // auto-grow textarea
  useEffect(() => {
    const ta = taRef.current
    if (!ta) return
    ta.style.height = 'auto'
    ta.style.height = Math.min(ta.scrollHeight, 200) + 'px'
  }, [input])

  // ---- conversation helpers ---------------------------------------------
  const ensureConversation = useCallback(
    (seedTitle: string): string => {
      if (activeId && conversations.some((c) => c.id === activeId)) return activeId
      const conv: Conversation = {
        id: uid(),
        title: seedTitle.slice(0, 48) + (seedTitle.length > 48 ? '…' : ''),
        messages: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }
      setConversations((prev) => [conv, ...prev])
      setActiveId(conv.id)
      return conv.id
    },
    [activeId, conversations],
  )

  const updateConversation = useCallback((id: string, fn: (c: Conversation) => Conversation) => {
    setConversations((prev) => prev.map((c) => (c.id === id ? fn(c) : c)))
  }, [])

  const stopStreaming = useCallback(() => {
    abortRef.current?.abort()
    abortRef.current = null
    setStreaming(false)
  }, [])

  const send = useCallback(
    async (rawText?: string) => {
      const text = (rawText ?? input).trim()
      if (!text || streaming) return

      const convId = ensureConversation(text)
      const userMsg: ChatMessage = { id: uid(), role: 'user', content: text }
      const assistantMsg: ChatMessage = { id: uid(), role: 'assistant', content: '' }

      let history: ChatMessage[] = []
      updateConversation(convId, (c) => {
        const prior = c.messages.filter((m) => !m.error)
        history = [...prior, userMsg]
        return {
          ...c,
          messages: [...c.messages, userMsg, assistantMsg],
          title: c.messages.length === 0 ? text.slice(0, 48) + (text.length > 48 ? '…' : '') : c.title,
          updatedAt: Date.now(),
        }
      })

      setInput('')
      setStreaming(true)
      const controller = new AbortController()
      abortRef.current = controller

      let acc = ''
      try {
        await streamCompletion({
          settings,
          messages: history,
          signal: controller.signal,
          onToken: (tok) => {
            acc += tok
            updateConversation(convId, (c) => ({
              ...c,
              messages: c.messages.map((m) => (m.id === assistantMsg.id ? { ...m, content: acc } : m)),
            }))
          },
        })
        if (!acc) throw new Error('The model returned an empty response.')
      } catch (e) {
        const aborted = controller.signal.aborted
        const msg = e instanceof Error ? e.message : String(e)
        updateConversation(convId, (c) => ({
          ...c,
          messages: c.messages.map((m) =>
            m.id === assistantMsg.id
              ? aborted
                ? { ...m, content: acc || '_Generation stopped._' }
                : { ...m, error: true, content: acc ? acc + `\n\n> ⚠️ ${msg}` : `⚠️ ${msg}` }
              : m,
          ),
          updatedAt: Date.now(),
        }))
      } finally {
        setStreaming(false)
        abortRef.current = null
        updateConversation(convId, (c) => ({ ...c, updatedAt: Date.now() }))
      }
    },
    [input, streaming, settings, ensureConversation, updateConversation],
  )

  const regenerate = useCallback(async () => {
    if (!active || streaming) return
    const lastUser = [...active.messages].reverse().find((m) => m.role === 'user' && !m.error)
    if (!lastUser) return
    updateConversation(active.id, (c) => {
      const msgs = [...c.messages]
      while (msgs.length && msgs[msgs.length - 1].role === 'assistant') msgs.pop()
      return { ...c, messages: msgs }
    })
    await send(lastUser.content)
  }, [active, streaming, send, updateConversation])

  const deleteConversation = useCallback(
    (id: string) => {
      setConversations((prev) => prev.filter((c) => c.id !== id))
      if (activeId === id) setActiveId(null)
    },
    [activeId],
  )

  const newChat = useCallback(() => {
    stopStreaming()
    setActiveId(null)
    setInput('')
    taRef.current?.focus()
  }, [stopStreaming])

  const askAIFromScratch = useCallback((q: string) => {
    setInput(q)
    taRef.current?.focus()
  }, [])

  const hasKey = !!settings.apiKey.trim()
  const providerName = PROVIDERS[settings.provider].name

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      void send()
    }
  }

  const showWelcome = !active || active.messages.length === 0

  return (
    <div className="app">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        onSelect={(id) => { stopStreaming(); setActiveId(id) }}
        onNew={newChat}
        onDelete={deleteConversation}
        onOpenSettings={() => setSettingsOpen(true)}
        mobileOpen={sidebarMobile}
        onCloseMobile={() => setSidebarMobile(false)}
      />

      <main className="main">
        <header className="topbar">
          <button className="icon-btn menu-btn" onClick={() => setSidebarMobile(true)} aria-label="Open sidebar">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M4 6h16M4 12h16M4 18h16" /></svg>
          </button>
          <div className="topbar-title">
            <span className="dot" data-ok={hasKey} title={hasKey ? `${providerName} key configured` : 'No API key'} />
            <strong className="topbar-name">{active?.title ?? 'New chat'}</strong>
            <span className="model-chip">{providerName} · {modelLabel(settings.provider, settings.model)}</span>
          </div>
          <div className="topbar-actions">
            <button
              className={`icon-btn ${scratchOpen ? 'toggled' : ''}`}
              onClick={() => setScratchOpen((v) => !v)}
              title="Toggle quick calculator"
              aria-pressed={scratchOpen}
            >
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><rect x="4" y="2" width="16" height="20" rx="2"/><path d="M8 6h8M8 11h.01M12 11h.01M16 11h.01M8 15h.01M12 15h.01M16 15h.01M8 19h.01M12 19h4"/></svg>
            </button>
            <button
              className="icon-btn"
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
              aria-label="Toggle color theme"
            >
              {theme === 'dark' ? (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M4.9 4.9l1.4 1.4m11.4 11.4l1.4 1.4M2 12h2m16 0h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
              ) : (
                <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
              )}
            </button>
            <button className="icon-btn" onClick={() => setSettingsOpen(true)} title="Settings" aria-label="Open settings">
              <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z"/></svg>
            </button>
          </div>
        </header>

        {!hasKey && (
          <div className="key-banner">
            <span>🔑 No API key configured — add one to start solving. It is stored only in your browser.</span>
            <button className="btn-primary btn-sm" onClick={() => setSettingsOpen(true)}>Add {providerName} key</button>
          </div>
        )}

        <div className="chat-scroll" ref={scrollRef}>
          {showWelcome ? (
            <div className="welcome">
              <div className="welcome-logo" aria-hidden="true">
                <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M4 5h7M4 12h7M4 19h5" />
                  <path d="M15 5l5 5m0-5l-5 5" />
                  <path d="M15 19h5M17.5 14v10" />
                </svg>
              </div>
              <h1>MathMind</h1>
              <p className="welcome-sub">
                A client-side AI solver for <strong>step-by-step mathematics &amp; logic</strong>. Your API key and every
                conversation stay in this browser — there is no backend. Nothing leaves your machine except the request
                to your chosen provider.
              </p>
              <div className="examples">
                {EXAMPLES.map((ex) => (
                  <button key={ex.title} className="example-card" onClick={() => void send(ex.prompt)} disabled={streaming}>
                    <span className="example-icon">{ex.icon}</span>
                    <span className="example-title">{ex.title}</span>
                    <span className="example-prompt">{ex.prompt}</span>
                  </button>
                ))}
              </div>
              {!hasKey && (
                <button className="btn-primary" onClick={() => setSettingsOpen(true)}>
                  Set up your API key →
                </button>
              )}
            </div>
          ) : (
            <div className="messages">
              {active!.messages.map((m, i) => (
                <MessageBubble
                  key={m.id}
                  message={m}
                  streaming={streaming && i === active!.messages.length - 1 && m.role === 'assistant'}
                />
              ))}
              {streaming && active!.messages[active!.messages.length - 1]?.content === '' && (
                <div className="thinking-note">Thinking…</div>
              )}
              {!streaming && active!.messages.length > 0 && (
                <div className="regen-row">
                  <button className="btn-ghost" onClick={() => void regenerate()}>↻ Regenerate answer</button>
                </div>
              )}
            </div>
          )}
        </div>

        <footer className="composer-wrap">
          <div className="composer">
            <textarea
              ref={taRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder={hasKey ? 'Ask a math or logic problem…  (Enter to send · Shift+Enter newline)' : 'Add an API key in Settings to start solving…'}
              rows={1}
              aria-label="Message input"
            />
            {streaming ? (
              <button className="send-btn stop" onClick={stopStreaming} title="Stop generating" aria-label="Stop generating">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
              </button>
            ) : (
              <button
                className="send-btn"
                onClick={() => void send()}
                disabled={!input.trim()}
                title="Send"
                aria-label="Send message"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              </button>
            )}
          </div>
          <p className="composer-disclaimer">MathMind can make mistakes — verify critical results. 100% client-side.</p>
        </footer>
      </main>

      {scratchOpen && (
        <div className="right-rail">
          <Scratchpad onAskAI={askAIFromScratch} />
        </div>
      )}

      <SettingsModal
        open={settingsOpen}
        settings={settings}
        onClose={() => setSettingsOpen(false)}
        onSave={(s) => {
          setSettings(s)
          saveSettings(s)
          setSettingsOpen(false)
        }}
      />
    </div>
  )
}
