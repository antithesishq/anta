import { useState } from 'preact/hooks'
import { ButtonCopy, Text } from '@antadesign/anta'

/**
 * Dynamic-copy demo for the Button docs. `onCopyRequest` sets the controlled
 * `copy` value before activation. Hydrated as an island so the state is live.
 */
export default function ButtonCopyLazyDemo() {
  const [count, setCount] = useState(0)
  const [report, setReport] = useState('')
  const [status, setStatus] = useState<string | null>(null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', alignItems: 'center' }}>
      <ButtonCopy
        copy={report}
        tone="brand"
        label="Copy report"
        onCopyRequest={() => {
          // This state value becomes the next rendered `copy` attribute.
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
