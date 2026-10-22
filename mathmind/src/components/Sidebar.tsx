import { useCallback, useMemo, useState } from 'react'
import type { Conversation } from '../lib/types'

interface Props {
  conversations: Conversation[]
  activeId: string | null
  onSelect: (id: string) => void
  onNew: () => void
  onDelete: (id: string) => void
  onOpenSettings: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}

function relTime(ts: number): string {
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(ts).toLocaleDateString()
}

export default function Sidebar({
  conversations,
  activeId,
  onSelect,
  onNew,
  onDelete,
  onOpenSettings,
  mobileOpen,
  onCloseMobile,
}: Props) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return conversations
    return conversations.filter(
      (c) => c.title.toLowerCase().includes(q) || c.messages.some((m) => m.content.toLowerCase().includes(q)),
    )
  }, [conversations, query])

  const groups = useMemo(() => {
    const startOfDay = (t: number) => {
      const d = new Date(t)
      d.setHours(0, 0, 0, 0)
      return d.getTime()
    }
    const today = startOfDay(Date.now())
    const buckets: Record<string, Conversation[]> = { Today: [], Yesterday: [], 'Previous 7 days': [], Older: [] }
    for (const c of filtered) {
      const day = startOfDay(c.updatedAt)
      if (day >= today) buckets.Today.push(c)
      else if (day >= today - 86400000) buckets.Yesterday.push(c)
      else if (day >= today - 6 * 86400000) buckets['Previous 7 days'].push(c)
      else buckets.Older.push(c)
    }
    return buckets
  }, [filtered])

  const exportJson = useCallback(() => {
    const blob = new Blob([JSON.stringify(conversations, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `mathmind-export-${new Date().toISOString().slice(0, 10)}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [conversations])

  return (
    <>
      {mobileOpen && <div className="sidebar-backdrop" onClick={onCloseMobile} />}
      <aside className={`sidebar ${mobileOpen ? 'open' : ''}`}>
        <div className="sidebar-brand">
          <div className="brand-icon" aria-hidden="true">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
              <path d="M4 5h7M4 12h7M4 19h5" />
              <path d="M15 5l5 5m0-5l-5 5" />
              <path d="M15 19h5M17.5 14v10" />
            </svg>
          </div>
          <div>
            <div className="brand-name">MathMind</div>
            <div className="brand-sub">AI Math &amp; Logic Solver</div>
          </div>
        </div>

        <button className="btn-new" onClick={() => { onNew(); onCloseMobile() }}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          New chat
        </button>

        <div className="sidebar-search">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="11" cy="11" r="7" />
            <path d="M21 21l-4.3-4.3" />
          </svg>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search chats…"
            aria-label="Search conversations"
          />
        </div>

        <nav className="conv-list" aria-label="Conversations">
          {conversations.length === 0 && (
            <p className="conv-empty">No conversations yet.<br />Ask your first math question ✨</p>
          )}
          {conversations.length > 0 && filtered.length === 0 && (
            <p className="conv-empty">No chats match “{query}”.</p>
          )}
          {Object.entries(groups).map(([label, items]) =>
            items.length === 0 ? null : (
              <div key={label} className="conv-group">
                <div className="conv-group-label">{label}</div>
                {items.map((c) => (
                  <div
                    key={c.id}
                    className={`conv-item ${c.id === activeId ? 'active' : ''}`}
                    role="button"
                    tabIndex={0}
                    onClick={() => { onSelect(c.id); onCloseMobile() }}
                    onKeyDown={(e) => { if (e.key === 'Enter') { onSelect(c.id); onCloseMobile() } }}
                  >
                    <div className="conv-item-main">
                      <span className="conv-title">{c.title}</span>
                      <span className="conv-time">{relTime(c.updatedAt)}</span>
                    </div>
                    <button
                      className="conv-delete"
                      title="Delete conversation"
                      aria-label={`Delete ${c.title}`}
                      onClick={(e) => {
                        e.stopPropagation()
                        if (window.confirm(`Delete “${c.title}”?`)) onDelete(c.id)
                      }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                        <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            ),
          )}
        </nav>

        <div className="sidebar-footer">
          <button className="btn-ghost" onClick={exportJson} disabled={conversations.length === 0} title="Export all chats as JSON">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 3v12m0 0l-4-4m4 4l4-4M4 21h16" />
            </svg>
            Export
          </button>
          <button className="btn-ghost" onClick={onOpenSettings}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.7 1.7 0 0 0 .34 1.87l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.7 1.7 0 0 0-1.87-.34 1.7 1.7 0 0 0-1 1.55V21a2 2 0 1 1-4 0v-.09a1.7 1.7 0 0 0-1-1.55 1.7 1.7 0 0 0-1.87.34l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.7 1.7 0 0 0 .34-1.87 1.7 1.7 0 0 0-1.55-1H3a2 2 0 1 1 0-4h.09a1.7 1.7 0 0 0 1.55-1 1.7 1.7 0 0 0-.34-1.87l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.7 1.7 0 0 0 1.87.34h.09a1.7 1.7 0 0 0 1-1.55V3a2 2 0 1 1 4 0v.09a1.7 1.7 0 0 0 1 1.55 1.7 1.7 0 0 0 1.87-.34l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.7 1.7 0 0 0-.34 1.87v.09a1.7 1.7 0 0 0 1.55 1H21a2 2 0 1 1 0 4h-.09a1.7 1.7 0 0 0-1.55 1z" />
            </svg>
            Settings
          </button>
        </div>
      </aside>
    </>
  )
}
