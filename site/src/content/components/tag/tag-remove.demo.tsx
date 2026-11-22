import { useRef, useState } from 'preact/hooks'
import { Button, Tag } from '@antadesign/anta'

export default function TagRemoveDemo() {
  const [visible, setVisible] = useState(true)
  const controls = useRef<HTMLDivElement>(null)

  return (
    <div ref={controls} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {visible && (
        <Tag className="removable-tag" tone="info" label="Frontend">
          <Button
            priority="quaternary"
            size="small"
            icon="x"
            aria-label="Remove Frontend"
            onClick={() => {
              setVisible(false)
              controls.current?.querySelector<HTMLElement>('.reset-tag')?.focus()
            }}
          />
        </Tag>
      )}
      <Button className="reset-tag" label="Reset example" onClick={() => setVisible(true)} />
    </div>
  )
}
