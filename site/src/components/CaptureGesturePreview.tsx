import { useState } from 'preact/hooks'
import { Button, Capture, Checkbox, Tag, Text } from '@antadesign/anta'
import type { CapturePanInput, CapturePointerInput } from '@antadesign/anta'
import { useElements } from './useElements'

type Selection = { x: number; y: number; width: number; height: number }

export function CapturePointerPreview() {
  useElements()
  const [selection, setSelection] = useState<Selection | null>(null)
  const [phase, setPhase] = useState('idle')

  function select(detail: CapturePointerInput) {
    setPhase(detail.phase)
    if (detail.phase === 'cancel') return
    const x = Math.max(0, Math.min(detail.boxWidth, detail.localX))
    const y = Math.max(0, Math.min(detail.boxHeight, detail.localY))
    setSelection({
      x: Math.min(detail.start.localX, x), y: Math.min(detail.start.localY, y),
      width: Math.abs(x - detail.start.localX), height: Math.abs(y - detail.start.localY),
    })
  }

  return (
    <div className="pointer-probe">
      <div className="pointer-probe-controls">
        <Button size="small" label="Select sample area" onClick={() => {
          setSelection({ x: 24, y: 24, width: 100, height: 64 })
          setPhase('sample')
        }} />
        <Button size="small" priority="tertiary" label="Clear selection" onClick={() => { setSelection(null); setPhase('idle') }} />
      </div>
      <Capture
        className="pointer-probe-surface"
        aria-label="Pointer selection surface"
        pointerCapture={{ pointerTypes: ['mouse', 'pen'], threshold: 3 }}
        onPointerInput={(_, detail) => select(detail)}
      >
        <Text size="small" priority="tertiary">Drag to select an area.</Text>
        {selection && <div className="pointer-probe-selection" style={{ left: selection.x, top: selection.y, width: selection.width, height: selection.height }} />}
      </Capture>
      <div className="pointer-probe-controls">
        <Tag size="small" label="Phase" value={phase} />
        <Tag size="small" label="Selection" value={selection ? `${Math.round(selection.width)} × ${Math.round(selection.height)}` : 'none'} />
      </div>
    </div>
  )
}

const ROW_HEIGHT = 32
const ROW_COUNT = 18
const MAX_OFFSET = ROW_COUNT * ROW_HEIGHT - 160

export function CapturePanPreview() {
  useElements()
  const [mouse, setMouse] = useState(false)
  const [inertia, setInertia] = useState(true)
  const [offset, setOffset] = useState(0)
  const [phase, setPhase] = useState('idle')
  const move = (delta: number) => setOffset(value => Math.max(0, Math.min(MAX_OFFSET, value + delta)))

  function pan(detail: CapturePanInput) {
    move(detail.deltaY)
    setPhase(detail.phase)
  }

  return (
    <div className="pan-probe">
      <div className="pan-probe-controls">
        <Checkbox size="small" label="Pan with mouse" checked={mouse} onStateChange={(_, { next }) => setMouse(next === true)} />
        <Checkbox size="small" label="Inertia" checked={inertia} onStateChange={(_, { next }) => setInertia(next === true)} />
      </div>
      <div onKeyDown={event => {
        if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return
        event.preventDefault()
        move(event.key === 'ArrowDown' ? ROW_HEIGHT : -ROW_HEIGHT)
      }}>
        <Capture
          className="pan-probe-surface"
          tabIndex={0}
          aria-label="Pan capture surface"
          pan={{ axis: 'y', pointerTypes: mouse ? ['touch', 'mouse'] : ['touch'], directions: { up: offset > 0, down: offset < MAX_OFFSET }, inertia }}
          onPanInput={(_, detail) => pan(detail)}
        >
          <div style={{ transform: `translateY(${-offset}px)` }}>
            {Array.from({ length: ROW_COUNT }, (_, index) => <div className="pan-probe-row" key={index}>Sample {index + 1}</div>)}
          </div>
        </Capture>
      </div>
      <Text size="small" priority="tertiary">Drag with touch, or enable mouse panning. Focus the rows and use arrow keys to scroll.</Text>
      <div className="pan-probe-controls">
        <Tag size="small" label="Offset" value={`${Math.round(offset)} / ${MAX_OFFSET}px`} />
        <Tag size="small" label="Phase" value={phase} />
      </div>
    </div>
  )
}
