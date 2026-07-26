import { useState, useEffect } from 'preact/hooks'
import { Toaster, Button, Banner, Card, Text, RadioGroup } from '@antadesign/anta'
import type { ToastPlacement } from '@antadesign/anta'
import { StickerClap } from '@antadesign/stickers'

const PLACEMENTS: ToastPlacement[] = [
  'top-left', 'top-center', 'top-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]

/**
 * Interactive demo for the Toaster docs page. A mounted `<Toaster>` region plus
 * buttons that hand `Toaster.manager.add(...)` a render function. The returns
 * cover the range: a `<Banner>` / `<Card>` (JSX), a `<StickerClap>` (JSX), a
 * plain string, and a bespoke DOM node — all through the one `add`.
 */
export default function ToasterDemo() {
  const [placement, setPlacement] = useState<ToastPlacement>('bottom-right')

  // Register the elements client-side (idempotent; the layout also does anta's).
  useEffect(() => {
    import('@antadesign/anta/elements')
    import('@antadesign/stickers/elements')
  }, [])

  const toastBanner = () =>
    Toaster.manager.add(
      () => <Banner tone="success" round message="Your changes were saved." closable={false} />,
      { placement, closable: true },
    )

  const toastCard = () =>
    Toaster.manager.add(
      () => (
        <Card tone="info" size="small" header="Deployment ready">
          Your build passed all checks and is ready to ship.
        </Card>
      ),
      { placement, closable: true, duration: 8000 },
    )

  const toastSticker = () =>
    Toaster.manager.add(() => <StickerClap size={96} label="Nice work" />, {
      placement,
      closable: true,
    })

  const toastString = () =>
    Toaster.manager.add(() => <Text>Just a plain string, toasted.</Text>, { placement, closable: true })

  const toastCustom = () => {
    // A bespoke DOM node — created once so the render function returns a stable ref.
    const box = document.createElement('div')
    box.textContent = '🎉 Anything can be a toast'
    box.style.cssText =
      'padding:14px 18px;border-radius:14px;color:#fff;font:500 14px/1.3 system-ui,sans-serif;' +
      'background:linear-gradient(135deg,#7c3aed,#db2777);'
    Toaster.manager.add(() => box, { placement, closable: true })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* The region — kept mounted for the store to render into. */}
      <Toaster />

      <RadioGroup
        orientation="horizontal"
        options={PLACEMENTS.map((p) => ({ value: p, label: p }))}
        defaultValue="bottom-right"
        onValueChange={(_e, attrs) => setPlacement((attrs.value as ToastPlacement) ?? 'bottom-right')}
      />

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <Button priority="secondary" tone="success" label="Toast a Banner" onClick={toastBanner} />
        <Button priority="secondary" tone="info" label="Toast a Card" onClick={toastCard} />
        <Button priority="secondary" tone="brand" label="Toast a Sticker" onClick={toastSticker} />
        <Button priority="secondary" label="Toast a string" onClick={toastString} />
        <Button priority="secondary" label="Toast a DOM node" onClick={toastCustom} />
        <Button priority="quaternary" tone="critical" label="Clear all" onClick={() => Toaster.manager.clear()} />
      </div>
    </div>
  )
}
