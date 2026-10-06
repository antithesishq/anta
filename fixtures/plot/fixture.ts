const plotFixture = `import { Button } from '@antadesign/anta'
import { Plot, scatter } from '@antadesign/plot'
import { useState } from 'react'

const colors = ['#4f46e5', '#0d9488', '#dc2626', '#ca8a04', '#9333ea']

function createRandom(seed) {
  let state = Math.imul(seed + 1, 0x9e3779b1) >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function createDataset(revision) {
  const random = createRandom(revision * 2)
  const count = 3 + Math.floor(random() * 8)
  return {
    color: colors[Math.floor(random() * colors.length)],
    revision,
    rows: [
      { id: 'center-' + revision, x: 5, y: 5 },
      ...Array.from({ length: count - 1 }, (_, index) => ({
        id: 'point-' + revision + '-' + index,
        x: Number((random() * 10).toFixed(2)),
        y: Number((random() * 10).toFixed(2)),
      })),
    ],
  }
}

function createWindow(random) {
  const start = random() * 4.75
  const end = 5.25 + random() * 4.75
  return [Number(start.toFixed(2)), Number(end.toFixed(2))]
}

function createViewport(key) {
  const random = createRandom(key * 2 + 1)
  return {
    x: random() < 0.15 ? null : createWindow(random),
    y: random() < 0.15 ? null : createWindow(random),
    key,
  }
}

export default function App() {
  const [dataset, setDataset] = useState(() => createDataset(0))
  const [height, setHeight] = useState(240)
  const [viewport, setViewport] = useState({ x: null, y: null, key: 0 })
  const [mounted, setMounted] = useState(true)
  const [selected, setSelected] = useState('None')
  const [viewportReport, setViewportReport] = useState('No gesture report')
  const [errors, setErrors] = useState([])

  const formatWindow = (range) => range ? range.map((value) => value.toFixed(2)).join('–') : 'full'

  const plotArgs = {
    series: [scatter({
      data: dataset.rows,
      size: 18,
      color: dataset.color,
      tooltip: ({ row }) => <span data-plot-tooltip>{row.id}</span>,
      on_select: ({ row }) => setSelected(row.id),
    })],
    height,
    margin: { top: 24, right: 24, bottom: 48, left: 48 },
    axis: {
      x: { min: 0, max: 10, label: 'Horizontal' },
      y: { min: 0, max: 10, label: 'Vertical' },
    },
    grid: true,
    border: true,
    zoom_pan: { x: true, y: true, modifier: true },
    viewport: {
      x: viewport.x,
      y: viewport.y,
      key: viewport.key,
    },
    on_viewport_change: ({ x, y, zoom_factor }) => {
      const format = (axis) => axis ? axis.window.map((value) => value.toFixed(2)).join('–') : 'categorical'
      setViewportReport('x ' + format(x) + ', y ' + format(y) + ', zoom ' + zoom_factor.x.toFixed(2) + '×' + zoom_factor.y.toFixed(2))
    },
  }

  return (
    <main
      data-fixture="plot"
      style={{ display: 'grid', width: 'min(100%, 680px)', gap: '20px' }}
    >
      <div style={{ minHeight: height + 'px' }}>
        {mounted ? (
          <Plot
            data-plot-target
            plotArgs={plotArgs}
            onError={({ phase, error }) => setErrors((current) => [...current, phase + ': ' + String(error)])}
          />
        ) : (
          <p data-fixture-empty>The plot is unmounted.</p>
        )}
      </div>

      <output aria-live="polite" data-fixture-state style={{ display: 'grid', gap: '4px', color: 'var(--text-2)', fontSize: '14px' }}>
        <span>Dataset {dataset.revision}: {dataset.rows.length} points, {height}px</span>
        <span>Selected: {selected}</span>
        <span>Requested viewport: x {formatWindow(viewport.x)}, y {formatWindow(viewport.y)}</span>
        <span>Last gesture report: {viewportReport}</span>
        <span>Errors: {errors.length}</span>
      </output>

      {errors.length > 0 && <pre data-plot-errors>{errors.join('\\n')}</pre>}

      <div aria-label="Fixture controls" data-fixture-controls style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <Button priority="secondary" onClick={() => {
          setDataset((current) => createDataset(current.revision + 1))
          setSelected('None')
        }}>
          Update data
        </Button>

        <Button priority="secondary" onClick={() => setHeight((current) => current === 240 ? 320 : 240)}>
          Resize
        </Button>

        <Button priority="secondary" onClick={() => setViewport((current) => createViewport(current.key + 1))}>
          Update viewport
        </Button>
      </div>

      <button data-plot-mount-toggle hidden type="button" onClick={() => setMounted((current) => !current)}>
        Toggle mount
      </button>
    </main>
  )
}
`

export default plotFixture
