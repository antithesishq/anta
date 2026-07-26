import { useState, useEffect } from 'preact/hooks'
import { Toaster, Button, RadioGroup } from '@antadesign/anta'
import type { ToastPlacement } from '@antadesign/anta'
import { svg as clapSvg } from '@antadesign/stickers/clap'

const PLACEMENTS: ToastPlacement[] = [
  'top-left', 'top-center', 'top-right',
  'bottom-left', 'bottom-center', 'bottom-right',
]

/**
 * Interactive demo for the Toaster docs page. A mounted `<Toaster>` region plus
 * buttons that build a DOM node and hand it to `Toaster.manager.add(...)` — the
 * imperative path the Playground can't express. Content is constructed as real
 * elements (a raw `<a-banner>`, `<a-card>`, an `<a-sticker>`, a bespoke `<div>`),
 * dogfooding "toast anything".
 */
export default function ToasterDemo() {
  const [placement, setPlacement] = useState<ToastPlacement>('bottom-right')

  // Register the elements client-side (idempotent; the layout also does anta's).
  useEffect(() => {
    import('@antadesign/anta/elements')
  }, [])

  const toastBanner = () => {
    const el = document.createElement('a-banner')
    el.setAttribute('tone', 'success')
    el.setAttribute('round', '')
    const msg = document.createElement('a-banner-message')
    msg.setAttribute('slot', 'message')
    msg.textContent = 'Your changes were saved.'
    el.append(msg)
    Toaster.manager.add(el, { placement, closable: true })
  }

  const toastCard = () => {
    const card = document.createElement('a-card')
    card.setAttribute('tone', 'info')
    card.setAttribute('size', 'small')
    const title = document.createElement('a-title')
    title.setAttribute('slot', 'header')
    title.setAttribute('level', '5')
    title.textContent = 'Deployment ready'
    const body = document.createElement('a-text')
    body.textContent = 'Your build passed all checks and is ready to ship.'
    card.append(title, body)
    Toaster.manager.add(card, { placement, closable: true, duration: 8000 })
  }

  const toastSticker = async () => {
    // Registering the sticker element pulls in its runtime; do it lazily, only
    // when a sticker is actually toasted.
    await import('@antadesign/stickers/elements')
    const sticker = document.createElement('a-sticker')
    sticker.setAttribute('svg', clapSvg)
    sticker.setAttribute('role', 'img')
    sticker.setAttribute('aria-label', 'Nice work')
    sticker.style.setProperty('--sticker-size', '96px')
    Toaster.manager.add(sticker, { placement, closable: true })
  }

  const toastCustom = () => {
    const box = document.createElement('div')
    box.textContent = '🎉 Anything can be a toast'
    box.style.cssText =
      'padding:14px 18px;border-radius:14px;color:#fff;font:500 14px/1.3 system-ui,sans-serif;' +
      'background:linear-gradient(135deg,#7c3aed,#db2777);'
    Toaster.manager.add(box, { placement, closable: true })
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {/* The region — kept mounted for the manager to render into. */}
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
        <Button priority="secondary" label="Toast anything" onClick={toastCustom} />
        <Button priority="quaternary" tone="critical" label="Clear all" onClick={() => Toaster.manager.clear()} />
      </div>
    </div>
  )
}
