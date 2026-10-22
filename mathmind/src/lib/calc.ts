import { compile } from 'mathjs'

export interface CalcResult {
  ok: boolean
  text: string
  expr?: string
}

/** Safe local evaluation via mathjs (no JS eval, no window access). */
export function quickCalculate(expr: string): CalcResult {
  try {
    const node = compile(expr)
    // Provide no scope; mathjs blocks dangerous constructs by design.
    const result = node.evaluate({})
    if (result === undefined) return { ok: false, text: 'No result.' }
    const formatted = formatResult(result)
    return { ok: true, text: `${expr.trim()} = ${formatted}` }
  } catch (e) {
    return { ok: false, text: e instanceof Error ? e.message : String(e) }
  }
}

function formatResult(value: unknown): string {
  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return String(value)
    if (Number.isInteger(value) && Math.abs(value) < 1e15) return value.toLocaleString('en-US')
    return parseFloat(value.toPrecision(12)).toString()
  }
  try {
    // Handles matrices, complex numbers, fractions, units…
    return (value as { toString: () => string }).toString()
  } catch {
    return JSON.stringify(value)
  }
}
