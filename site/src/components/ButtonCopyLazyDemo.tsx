import { useState } from 'preact/hooks'
import { ButtonCopy, Text } from '@antadesign/anta'

/**
 * Lazy-copy demo for the Button docs. The payload isn't in the DOM until the
 * button is clicked: `copyLazy` makes the click fire `onCopyRequest`, which
 * computes the content and sets `copy` — the element then completes the write
 * inside the click's activation window. Resetting `copy` on `onCopied` keeps
 * every click a fresh request. Hydrated as an island so the state is live.
 */
export default function ButtonCopyLazyDemo() {
  const [payload, setPayload] = useState('')
  const [count, setCount] = useState(0)
  const [status, setStatus] = useState<string | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'flex-start' }}>
      <ButtonCopy
        copy={payload}
        copyLazy
        tone="brand"
        label="Copy report"
        onCopyRequest={() => {
          // Computed only now, on click — it was never rendered into the DOM.
          const n = count + 1
          setCount(n)
          setPayload(`Report #${n} — generated ${new Date().toLocaleTimeString()}`)
        }}
        onCopied={(ok) => {
          setStatus(ok ? 'Copied — paste to see the payload' : 'Copy failed')
          setPayload('') // reset so the next click requests fresh content
        }}
      />
      {status && (
        <Text size="small" tone={status.startsWith('Copied') ? 'success' : 'critical'}>
          {status}
        </Text>
      )}
    </div>
  )
}
