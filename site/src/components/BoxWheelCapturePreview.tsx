import { useEffect, useId, useState } from 'preact/hooks'
import { Box, Button, Checkbox, Select, Slider, Tag, Text } from '@antadesign/anta'
import type { BoxWheelActivation, BoxWheelInput, SelectOption } from '@antadesign/anta'
import styles from './BoxWheelCapturePreview.module.css'

const ROW_HEIGHT = 32
const VIEW_HEIGHT = ROW_HEIGHT * 6
const ROW_COUNT = 28
const MAX_OFFSET = ROW_HEIGHT * ROW_COUNT - VIEW_HEIGHT
const ACTIVATIONS: SelectOption<BoxWheelActivation>[] = [
  { value: 'settled', label: 'After settling' },
  { value: 'hover', label: 'Immediately on hover' },
  { value: 'focus', label: 'While focused' },
  { value: 'settled-or-focus', label: 'Settled or focused' },
]

/** Focused wheel controls live outside the surface that claims input. */
export function BoxWheelCapturePreview() {
  useEffect(() => { import('@antadesign/anta/elements') }, [])
  const hintId = useId()
  const [enabled, setEnabled] = useState(false)
  const [activation, setActivation] = useState<BoxWheelActivation>('settled')
  const [delay, setDelay] = useState(150)
  const [resetOnMove, setResetOnMove] = useState(false)
  const [offset, setOffset] = useState(0)
  const [last, setLast] = useState<BoxWheelInput | null>(null)
  const needsSettle = activation === 'settled' || activation === 'settled-or-focus'

  function move(delta: number) {
    setOffset(value => Math.max(0, Math.min(MAX_OFFSET, value + delta)))
  }

  return (
    <div className={styles.preview} data-wheel-capture-preview>
      <div className={styles.toolbar}>
        <Checkbox
          label="Capture wheel"
          checked={enabled}
          onStateChange={(_, { next }) => setEnabled(next === true)}
        />
        <Button size="small" priority="tertiary" label="Reset position" onClick={() => { setOffset(0); setLast(null) }} />
      </div>

      <div className={styles.controls}>
        <Select<BoxWheelActivation>
          label="Activation"
          size="small"
          options={ACTIVATIONS}
          value={activation}
          onValueChange={setActivation}
        />
        <Slider
          label="Settle delay"
          size="small"
          value={delay}
          min={0}
          max={800}
          step={50}
          valueSuffix="ms"
          disabled={!needsSettle}
          onValueChange={(_, { value }) => setDelay(value)}
        />
      </div>

      <Checkbox
        label="Settle again after moving"
        size="small"
        checked={resetOnMove}
        disabled={!needsSettle}
        onStateChange={(_, { next }) => setResetOnMove(next === true)}
      />

      <div onKeyDown={event => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        event.preventDefault()
        move(event.key === 'ArrowDown' ? ROW_HEIGHT : -ROW_HEIGHT)
      }}>
        <Box
          className={styles.surface}
          round={8}
          tabIndex={0}
          aria-label="Wheel capture surface"
          aria-describedby={hintId}
          wheelCapture={enabled && { up: offset > 0, down: offset < MAX_OFFSET }}
          wheelActivation={activation}
          wheelSettle={{ delay, tolerance: 5, resetOnMove }}
          onWheelInput={(_, detail) => {
            const { wheelEvent, boxHeight } = detail
            const unit = wheelEvent.deltaMode === 1 ? ROW_HEIGHT : wheelEvent.deltaMode === 2 ? boxHeight : 1
            move(wheelEvent.deltaY * unit)
            setLast(detail)
          }}
        >
          <div style={{ transform: `translateY(${-offset}px)` }}>
            {Array.from({ length: ROW_COUNT }, (_, index) => (
              <div className={styles.row} key={index}>
                <span className={styles.index}>{String(index + 1).padStart(2, '0')}</span>
                <span>{`Sample ${index + 1}`}</span>
                <span className={styles.value}>{`${(index + 1) * 12} ms`}</span>
              </div>
            ))}
          </div>
        </Box>
      </div>

      <Text id={hintId} size="small" priority="tertiary">
        Enable capture, then use the wheel over the rows. At either end, wheel
        input returns to the page. Tab into the surface to try focus activation;
        arrow keys move a row.
      </Text>

      <div className={styles.readout}>
        <Tag size="small" label="Offset" value={`${Math.round(offset)} / ${MAX_OFFSET}px`} />
        <Tag size="small" label={enabled ? 'Capture enabled' : 'Wheel passes through'} tone={enabled ? 'brand' : undefined} />
        {last && <Tag size="small" label="Last activation" value={last.activationReason} />}
      </div>
    </div>
  )
}
