export default `import { Tag } from '@antadesign/anta'

export default function Demo() {
  return <Tag tone="info" icon="hourglass" label="Running" value="20m 16s" />
}
`

export const removableTagDemoCode = `import { useRef, useState } from 'preact/hooks'
import { Button, Tag } from '@antadesign/anta'

export default function Demo() {
  const [visible, setVisible] = useState(true)
  const controls = useRef<HTMLDivElement>(null)

  return (
    <div ref={controls} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      {visible && (
        <Tag className="removable-tag" tone="info">
          <span>Frontend</span>
          <Button priority="quaternary" size="small" icon="x" aria-label="Remove Frontend"
            onClick={() => {
              setVisible(false)
              controls.current?.querySelector<HTMLElement>('.reset-tag')?.focus()
            }} />
        </Tag>
      )}
      <Button className="reset-tag" label="Reset example" onClick={() => setVisible(true)} />
      <style>{\`
        a-tag.removable-tag { padding-block: 0; }
        a-tag.removable-tag > a-button { align-self: stretch; }
        a-tag.removable-tag > a-button:focus-visible { outline-offset: -2px; }
      \`}</style>
    </div>
  )
}
`
