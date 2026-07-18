import { useState } from 'preact/hooks'
import { ButtonCopy, Text } from '@antadesign/anta'

/**
 * Lazy-copy demo for the Button docs. The payload isn't in the DOM until the
 * button is clicked: `copyLazy` makes the click fire `onCopyRequest(provide)`,
 * which computes the content and calls `provide(text)` — the element then writes
 * it inside the click's activation window. No `copy` prop, no reset. Hydrated as
 * an island so the state is live.
 */
export default function ButtonCopyLazyDemo() {
  const [count, setCount] = useState(0)
  const [status, setStatus] = useState<string | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
      <ButtonCopy
        copyLazy
        tone="brand"
        label="Copy report"
        onCopyRequest={(provide) => {
          // Computed only now, on click — it was never rendered into the DOM.
          const n = count + 1
          setCount(n)
          provide(`Report #${n} — generated ${new Date().toLocaleTimeString()}`)
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
