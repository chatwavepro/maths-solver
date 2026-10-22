import { useEffect, useRef, useState } from 'react'
import type { CalcResult } from '../lib/calc'
import { quickCalculate } from '../lib/calc'

interface Props {
  onAskAI: (question: string) => void
}

/** Distraction-free local scratchpad — evaluates instantly with mathjs, no API needed. */
export default function Scratchpad({ onAskAI }: Props) {
  const [expr, setExpr] = useState('')
  const [results, setResults] = useState<CalcResult[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '/') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const run = () => {
    const trimmed = expr.trim()
    if (!trimmed) return
    setResults((r) => [{ ...quickCalculate(trimmed), expr: trimmed }, ...r].slice(0, 12))
    setExpr('')
  }

  return (
    <aside className="scratchpad">
      <div className="scratch-header">
        <h3>⚡ Quick calculator</h3>
        <span className="kbd-hint">Ctrl / ⌘ + /</span>
      </div>
      <p className="scratch-sub">Runs locally in your browser — no API used.</p>
      <div className="scratch-input-row">
        <input
          ref={inputRef}
          value={expr}
          onChange={(e) => setExpr(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') run()
          }}
          placeholder="e.g. 2^64 - 1, sqrt(2)/2, derivative('x^3','x')"
          spellCheck={false}
          aria-label="Expression"
        />
        <button className="btn-primary btn-sm" onClick={run}>Eval</button>
      </div>
      <div className="scratch-results">
        {results.length === 0 ? (
          <p className="scratch-empty">Results appear here. Supports arithmetic, functions, matrices, units and symbolic calculus.</p>
        ) : (
          results.map((r, i) => (
            <div key={i} className={`scratch-line ${r.ok ? 'ok' : 'fail'}`}>
              <code>{r.text}</code>
              {!r.ok && (
                <button className="btn-link" onClick={() => onAskAI(`Explain why this expression fails and fix it: ${r.expr ?? r.text}`)}>
                  Ask AI
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </aside>
  )
}
