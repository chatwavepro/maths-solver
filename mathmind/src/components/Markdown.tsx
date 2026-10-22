import { useMemo } from 'react'
import { marked } from 'marked'
import DOMPurify from 'dompurify'
import katex from 'katex'

const BLOCK_MATH = /([^\S\n]*)\$\$([\s\S]+?)\$\$(?=\s|$)/g
const INLINE_MATH = /\$(?!\s)((?:\\.|[^$\\\n])+?)\$/g
const CODE_FENCE = /(```[\s\S]*?```|~~~[\s\S]*?~~~)/g
const INLINE_CODE = /(`[^`\n]+`)/g

/** Protect code regions with placeholders so KaTeX never touches them. */
function protectCode(src: string, store: string[]): string {
  let out = src.replace(CODE_FENCE, (m) => {
    store.push(m)
    return `\u0000${store.length - 1}\u0000`
  })
  out = out.replace(INLINE_CODE, (m) => {
    store.push(m)
    return `\u0000${store.length - 1}\u0000`
  })
  return out
}

function renderMath(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex.trim(), {
      displayMode: display,
      throwOnError: false,
      strict: false,
      output: 'htmlAndMathml',
    })
  } catch {
    const esc = tex.replace(/&/g, '&amp;').replace(/</g, '&lt;')
    return `<code class="math-error">${display ? '$$' : '$'}${esc}${display ? '$$' : '$'}</code>`
  }
}

export function markdownToHtml(source: string): string {
  const store: string[] = []
  let text = protectCode(source, store)

  // Display math → inline math (placeholders keep KaTeX HTML out of the markdown parser)
  text = text.replace(BLOCK_MATH, (_m, _indent, tex) => {
    store.push(renderMath(tex, true))
    return `\u0000${store.length - 1}\u0000`
  })
  text = text.replace(INLINE_MATH, (_m, tex) => {
    store.push(renderMath(tex, false))
    return `\u0000${store.length - 1}\u0000`
  })

  const html = marked.parse(text, { async: false, gfm: true, breaks: false }) as string

  const clean = DOMPurify.sanitize(html, {
    ADD_TAGS: ['use'],
    ADD_ATTR: ['aria-hidden', 'focusable', 'viewBox', 'xmlns'],
  })

  return clean.replace(/\u0000(\d+)\u0000/g, (_m, i: string) => store[Number(i)] ?? '')
}

interface Props {
  content: string
  className?: string
}

export default function Markdown({ content, className }: Props) {
  const html = useMemo(() => markdownToHtml(content), [content])
  return <div className={'markdown ' + (className ?? '')} dangerouslySetInnerHTML={{ __html: html }} />
}
