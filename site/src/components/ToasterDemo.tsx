import { useState, useEffect } from 'preact/hooks'
import { Toaster, Button, Input, Checkbox, Banner, Card } from '@antadesign/anta'
import { StickerClap } from '@antadesign/stickers'

/**
 * Interactive demo for the Toaster docs page. A Duration input (label in the
 * leading slot, like the site's Theme dropdown) and a Closable checkbox sit in a
 * row above three buttons that toast a Banner, a Card, and a Sticker with the
 * chosen options.
 */
export default function ToasterDemo() {
  const [duration, setDuration] = useState('4000')
  const [closable, setClosable] = useState(true)

  // Register the elements client-side (idempotent; the layout also does anta's).
  useEffect(() => {
    import('@antadesign/anta/elements')
    import('@antadesign/stickers/elements')
  }, [])

  const opts = () => ({ placement: 'bottom-right' as const, duration: Number(duration) || 0, closable })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* The region — kept mounted for the store to render into. */}
      <Toaster />

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <Input
          leading="Duration"
          trailing={<span style={{ paddingInlineEnd: 6 }}>ms</span>}
          type="number"
          defaultValue="4000"
          onValueChange={(_e, a) => setDuration(a.value)}
        />
        <Checkbox label="Closable" defaultChecked onValueChange={(_e, a) => setClosable(a.checked)} />
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Button
          priority="secondary"
          tone="success"
          label="Toast a Banner"
          onClick={() =>
            Toaster.manager.add(
              () => <Banner tone="success" round message="Your changes were saved." closable={false} />,
              opts(),
            )
          }
        />
        <Button
          priority="secondary"
          tone="info"
          label="Toast a Card"
          onClick={() =>
            Toaster.manager.add(
              () => (
                <Card tone="info" size="small" header="Deployment ready">
                  Your build passed all checks.
                </Card>
              ),
              opts(),
            )
          }
        />
        <Button
          priority="secondary"
          tone="brand"
          label="Toast a Sticker"
          onClick={() => Toaster.manager.add(() => <StickerClap size={96} label="Nice work" />, opts())}
        />
      </div>
    </div>
  )
}
