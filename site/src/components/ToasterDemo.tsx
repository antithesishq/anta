import { useState } from 'preact/hooks'
import { Toaster, Button, Input, Banner, Card } from '@antadesign/anta'
import { StickerClap } from '@antadesign/stickers'
import styles from './ToasterDemo.module.css'

export default function ToasterDemo() {
  const [duration, setDuration] = useState('4000')

  // Empty / zero / non-numeric → the 5000ms default (0 is not sticky; sticky is Infinity).
  const opts = () => ({ placement: 'bottom-right' as const, duration: Number(duration) || 5000 })

  return (
    <div className={styles.demo}>
      {/* The region — kept mounted for the store to render into. */}
      <Toaster />

      <div className={styles.controls}>
        <Input
          leading="Duration"
          trailing="ms"
          type="number"
          defaultValue="4000"
          onValueChange={(_e, a) => setDuration(a.value)}
        />
      </div>

      <div className={styles.buttons}>
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
            const ms = Number(duration) || 5000
            Toaster.manager.add(
              (id) => (
                <div className={styles.countdownToast}>
                  <Banner
                    tone="info"
                    round
                    message="Auto-dismissing — hover to pause"
                    onDismiss={() => Toaster.manager.dismiss(id)}
                  />
                  {/* Reads the toast's own --toast-remaining — no duration passed. */}
                  <span className={styles.countdownBar} />
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
