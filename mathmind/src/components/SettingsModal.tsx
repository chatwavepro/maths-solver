import { useEffect, useRef, useState } from 'react'
import type { Settings } from '../lib/types'
import { DEFAULT_SYSTEM_PROMPT } from '../lib/types'
import { PROVIDERS, defaultModel } from '../lib/providers'
import { maskKey } from '../lib/storage'

interface Props {
  open: boolean
  settings: Settings
  onClose: () => void
  onSave: (s: Settings) => void
}

export default function SettingsModal({ open, settings, onClose, onSave }: Props) {
  const [draft, setDraft] = useState<Settings>(settings)
  const [showKey, setShowKey] = useState(false)
  const backdropRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (open) {
      setDraft(settings)
      setShowKey(false)
    }
  }, [open, settings])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (open) window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  const provider = PROVIDERS[draft.provider]
  const models = provider.models.map((m) => m.id)
  const customModel = !models.includes(draft.model)

  const set = <K extends keyof Settings>(k: K, v: Settings[K]) => setDraft((d) => ({ ...d, [k]: v }))

  const changeProvider = (p: Settings['provider']) => {
    setDraft((d) => ({ ...d, provider: p, model: defaultModel(p) }))
  }

  return (
    <div
      className="modal-backdrop"
      ref={backdropRef}
      onMouseDown={(e) => {
        if (e.target === backdropRef.current) onClose()
      }}
    >
      <div className="modal" role="dialog" aria-modal="true" aria-label="Settings">
        <div className="modal-header">
          <h2>Settings</h2>
          <button className="icon-btn" onClick={onClose} aria-label="Close settings">✕</button>
        </div>

        <div className="modal-body">
          <section className="field">
            <label className="field-label">Provider</label>
            <div className="segmented" role="radiogroup" aria-label="API provider">
              {Object.values(PROVIDERS).map((p) => (
                <button
                  key={p.id}
                  role="radio"
                  aria-checked={draft.provider === p.id}
                  className={`seg-btn ${draft.provider === p.id ? 'active' : ''}`}
                  onClick={() => changeProvider(p.id)}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </section>

          <section className="field">
            <label className="field-label" htmlFor="api-key">
              API key <span className="hint">stored only in your browser (localStorage)</span>
            </label>
            <div className="key-row">
              <input
                id="api-key"
                type={showKey ? 'text' : 'password'}
                value={draft.apiKey}
                onChange={(e) => set('apiKey', e.target.value)}
                placeholder={draft.provider === 'openrouter' ? 'sk-or-v1-…' : 'AIza…'}
                autoComplete="off"
                spellCheck={false}
              />
              <button className="icon-btn" onClick={() => setShowKey((v) => !v)} title={showKey ? 'Hide' : 'Show'}>
                {showKey ? '🙈' : '👁'}
              </button>
            </div>
            {draft.apiKey && !showKey && <p className="field-note">Current: {maskKey(draft.apiKey)}</p>}
            <p className="field-note">
              Get a key:{' '}
              {draft.provider === 'openrouter' ? (
                <a href="https://openrouter.ai/keys" target="_blank" rel="noreferrer">openrouter.ai/keys</a>
              ) : (
                <a href="https://aistudio.google.com/apikey" target="_blank" rel="noreferrer">aistudio.google.com/apikey</a>
              )}
            </p>
          </section>

          <section className="field">
            <label className="field-label" htmlFor="model">Model</label>
            <select id="model" value={draft.model} onChange={(e) => set('model', e.target.value)}>
              {provider.models.map((m) => (
                <option key={m.id} value={m.id}>{m.label}</option>
              ))}
              {customModel && <option value={draft.model}>{draft.model} (custom)</option>}
            </select>
            <input
              className="model-custom"
              value={draft.model}
              onChange={(e) => set('model', e.target.value)}
              placeholder="Or type any model ID…"
              spellCheck={false}
            />
          </section>

          <section className="field">
            <label className="field-label" htmlFor="temp">
              Temperature <span className="badge">{draft.temperature.toFixed(1)}</span>
            </label>
            <input
              id="temp"
              type="range"
              min={0}
              max={1}
              step={0.1}
              value={draft.temperature}
              onChange={(e) => set('temperature', Number(e.target.value))}
            />
            <p className="field-note">Lower = more deterministic math. Recommended ≤ 0.3.</p>
          </section>

          <section className="field">
            <label className="field-label" htmlFor="sysprompt">System prompt</label>
            <textarea
              id="sysprompt"
              rows={7}
              value={draft.systemPrompt}
              onChange={(e) => set('systemPrompt', e.target.value)}
              spellCheck={false}
            />
            <button className="btn-link" onClick={() => set('systemPrompt', DEFAULT_SYSTEM_PROMPT)}>
              Reset to default prompt
            </button>
          </section>
        </div>

        <div className="modal-footer">
          <button className="btn-secondary" onClick={onClose}>Cancel</button>
          <button className="btn-primary" onClick={() => onSave(draft)}>Save settings</button>
        </div>
      </div>
    </div>
  )
}
