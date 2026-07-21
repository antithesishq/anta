import { useState } from 'preact/hooks'
import { ButtonCopy, Text } from '@antadesign/anta'

/**
 * Lazy-copy demo for the Button docs. `onCopyRequest` fires on pointerdown and
 * refreshes the reactive `copy` value; the click that follows copies the latest
 * string. The pointerdown→click gap lets the update land even when the handler
 * runs off the UI thread — only the serializable `copy` string crosses. Hydrated
 * as an island so the state is live.
 */
export default function ButtonCopyLazyDemo() {
  const [count, setCount] = useState(0)
  const [report, setReport] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
      <ButtonCopy
        copy={report}
        tone="brand"
        label="Copy report"
        onCopyRequest={() => {
          // Recomputed on pointerdown, just before the click reads it.
          const n = count + 1
          setCount(n)
          setReport(`Report #${n} — generated ${new Date().toLocaleTimeString()}`)
        }}
        onCopied={(ok) => setStatus(ok ? 'Copied — paste to see the payload' : 'Copy failed')}
      />
      {status && (
        <Text size="small" tone={status.startsWith('Copied') ? 'success' : 'critical'}>
          {status}
        </Text>
      )}
    </div>
  )
}
