import { useLayoutEffect, useRef, useState } from 'preact/hooks'
import { Button, Tag } from '@antadesign/anta'

export default function TagRemoveDemo() {
  const [visible, setVisible] = useState(true)
  const controls = useRef<HTMLDivElement>(null)
  const previousVisible = useRef(visible)

  useLayoutEffect(() => {
    if (previousVisible.current !== visible) {
      controls.current?.querySelector<HTMLElement>('a-button')?.focus()
      previousVisible.current = visible
    }
  }, [visible])

  return (
    <div ref={controls} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {visible && (
        <Tag tone="info" label="Frontend">
          <Button
            priority="tertiary"
            tone="info"
            size="small"
            icon="x"
            aria-label="Remove Frontend"
            onClick={() => setVisible(false)}
          />
        </Tag>
      )}
      {!visible && (
        <Button size="small" label="Reset example" onClick={() => setVisible(true)} />
      )}
    </div>
  )
}
