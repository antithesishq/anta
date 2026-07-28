import { useState, useEffect } from 'preact/hooks'
import { Toaster, Button, Input, Banner, Card } from '@antadesign/anta'
import { StickerClap } from '@antadesign/stickers'

/**
 * Interactive demo for the Toaster docs page. A Duration input (label in the
 * leading slot, like the site's Theme dropdown) sits above buttons that toast a
 * range of content — showing how each kind dismisses:
 *   • a bare string, auto-wrapped in a dismissible Banner;
 *   • a Banner, whose ✕ dismisses the toast through `onDismiss`;
 *   • a Card carrying a `data-toast-dismiss` action;
 *   • a Sticker, which just rides the auto-dismiss timer.
 */
export default function ToasterDemo() {
  const [duration, setDuration] = useState('4000')

  // Register the elements client-side (idempotent; the layout also does anta's).
  useEffect(() => {
    import('@antadesign/anta/elements')
    import('@antadesign/stickers/elements')
  }, [])

  const opts = () => ({ placement: 'bottom-right' as const, duration: Number(duration) || 0 })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
      {/* Countdown bar CSS. The whole thing is one line: scale the bar by the
          toast's own `--toast-remaining` (1 → 0). No timer, no keyframes, no
          duration — the toast owns the timing and pauses the var on hover/focus. */}
      <style>{`
        .countdown-toast { position: relative; }
        .countdown-toast .countdown-bar {
          position: absolute; left: 10px; right: 10px; bottom: 5px; height: 3px;
          border-radius: 999px; transform-origin: left;
          background: color-mix(in oklch, currentColor 35%, transparent);
          transform: scaleX(var(--toast-remaining));
        }
      `}</style>

      {/* The region — kept mounted for the store to render into. */}
      <Toaster />

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <Input
          leading="Duration"
          trailing="ms"
          type="number"
          defaultValue="4000"
          onValueChange={(_e, a) => setDuration(a.value)}
        />
      </div>

      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
        <Button
          priority="secondary"
          label="Toast text"
          onClick={() => Toaster.manager.add(() => 'Your changes were saved.', opts())}
        />
        <Button
          priority="secondary"
          tone="success"
          label="Toast a Banner"
          onClick={() =>
            Toaster.manager.add(
              (id) => (
                <Banner
                  tone="success"
                  round
                  message="Your changes were saved."
                  onDismiss={() => Toaster.manager.dismiss(id)}
                />
              ),
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
                  Your build passed all checks.{' '}
                  <Button size="small" priority="tertiary" label="Dismiss" data-toast-dismiss />
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
        <Button
          priority="secondary"
          label="Toast with countdown"
          onClick={() => {
            // A countdown needs a positive duration — fall back if the input is sticky.
            const ms = Number(duration) || 6000
            Toaster.manager.add(
              (id) => (
                <div className="countdown-toast">
                  <Banner
                    tone="info"
                    round
                    message="Auto-dismissing — hover to pause"
                    onDismiss={() => Toaster.manager.dismiss(id)}
                  />
                  {/* Reads the toast's own --toast-remaining — no duration passed. */}
                  <span className="countdown-bar" />
                </div>
              ),
              { placement: 'bottom-right', duration: ms },
            )
          }}
        />
      </div>
    </div>
  )
}
