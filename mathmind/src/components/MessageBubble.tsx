import { useEffect, useRef, useState } from 'react'
import Markdown from './Markdown'
import type { ChatMessage } from '../lib/types'

interface Props {
  message: ChatMessage
  streaming: boolean
}

export default function MessageBubble({ message, streaming }: Props) {
  const isUser = message.role === 'user'
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<number | undefined>(undefined)

  useEffect(() => () => window.clearTimeout(copyTimer.current), [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(message.content)
      setCopied(true)
      copyTimer.current = window.setTimeout(() => setCopied(false), 1500)
    } catch {
      /* clipboard unavailable */
    }
  }

  return (
    <div className={`msg ${isUser ? 'msg-user' : 'msg-assistant'}${message.error ? ' msg-error' : ''}`}>
      {!isUser && (
        <div className="msg-avatar" aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4z" />
            <path d="M17 14v6M14 17h6" />
          </svg>
        </div>
      )}
      <div className="msg-body">
        <div className="msg-meta">
          <span className="msg-role">{isUser ? 'You' : 'MathMind'}</span>
          {!isUser && !streaming && message.content && (
            <button className="copy-btn" onClick={copy} title="Copy raw markdown">
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          )}
        </div>
        {isUser ? (
          <div className="msg-text user-text">{message.content}</div>
        ) : (
          <>
            <Markdown content={message.content} />
            {streaming && (
              <span className="typing-cursor" aria-label="Generating">
                <i /><i /><i />
              </span>
            )}
          </>
        )}
      </div>
    </div>
  )
}
