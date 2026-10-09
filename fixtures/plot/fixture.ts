const plotFixture = `import { Button } from '@antadesign/anta'
import { Plot, scatter } from '@antadesign/plot'
import { useState } from 'react'

const PLOT_COUNT = 5
const colors = ['#4f46e5', '#0d9488', '#dc2626', '#ca8a04', '#9333ea']

function createRandom(seed) {
  let state = Math.imul(seed + 1, 0x9e3779b1) >>> 0
  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0
    return state / 4294967296
  }
}

function createDataset(revision, plotIndex) {
  const random = createRandom(revision * PLOT_COUNT + plotIndex)
  const count = 3 + Math.floor(random() * 8)
  return {
    color: colors[Math.floor(random() * colors.length)],
    revision,
    rows: Array.from({ length: count }, (_, pointIndex) => ({
      id: 'plot-' + plotIndex + '-point-' + revision + '-' + pointIndex,
      x: Number((random() * 10).toFixed(2)),
      y: Number((random() * 10).toFixed(2)),
    })),
  }
}

function createWindow(random) {
  const start = random() * 4.75
  const end = 5.25 + random() * 4.75
  return [Number(start.toFixed(2)), Number(end.toFixed(2))]
}

function createViewport(key, plotIndex) {
  const random = createRandom(key * PLOT_COUNT + plotIndex)
  return {
    x: random() < 0.15 ? null : createWindow(random),
    y: random() < 0.15 ? null : createWindow(random),
    key,
  }
}

function PlotFixture({ plotIndex }) {
  const [dataset, setDataset] = useState(() => createDataset(0, plotIndex))
  const [height, setHeight] = useState(240)
  const [viewport, setViewport] = useState({ x: null, y: null, key: 0 })
  const [selected, setSelected] = useState('None')
  const [viewportReport, setViewportReport] = useState('No gesture report')
  const [errors, setErrors] = useState([])

  const formatWindow = (range) => range ? range.map((value) => value.toFixed(2)).join('–') : 'full'

  return (
    <section
      data-plot-instance={plotIndex}
      style={{ display: 'grid', alignContent: 'start', gap: '8px', minWidth: 0 }}
    >
      <strong>Plot {plotIndex + 1}</strong>
      <div style={{ minHeight: height + 'px' }}>
        <Plot
          data-plot-target
          data-plot-index={plotIndex}
          plotArgs={{
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
            series: [scatter({
              data: dataset.rows,
              size: 18,
              color: dataset.color,
              tooltip: ({ row }) => <span data-plot-tooltip>{row.id}</span>,
              on_select: ({ row }) => setSelected(row.id),
            })],
            on_viewport_change: ({ x, y, zoom_factor }) => {
              const format = (axis) => axis ? axis.window.map((value) => value.toFixed(2)).join('–') : 'categorical'
              setViewportReport('x ' + format(x) + ', y ' + format(y) + ', zoom ' + zoom_factor.x.toFixed(2) + '×' + zoom_factor.y.toFixed(2))
            },
          }}
          onError={({ phase, error }) => setErrors((current) => [
            ...current,
            phase + ': ' + String(error),
          ])}
        />
      </div>

      <output aria-live="polite" style={{ display: 'grid', gap: '2px', color: 'var(--text-2)', fontSize: '12px' }}>
        <span>Dataset {dataset.revision}: {dataset.rows.length} points, {height}px</span>
        <span>Selected: {selected}</span>
        <span>Viewport: x {formatWindow(viewport.x)}, y {formatWindow(viewport.y)}</span>
        <span>Gesture: {viewportReport}</span>
        <span>Errors: {errors.length}</span>
      </output>

      {errors.length > 0 && <pre data-plot-errors>{errors.join('\\n')}</pre>}

      <div aria-label={'Plot ' + (plotIndex + 1) + ' controls'} style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
        <Button priority="secondary" onClick={() => {
          setDataset((current) => createDataset(current.revision + 1, plotIndex))
          setSelected('None')
        }}>
          Update data
        </Button>

        <Button priority="secondary" onClick={() => setHeight((current) => current === 240 ? 320 : 240)}>
          Resize
        </Button>

        <Button priority="secondary" onClick={() => setViewport((current) => createViewport(current.key + 1, plotIndex))}>
          Update viewport
        </Button>
      </div>
    </section>
  )
}

export default function App() {
  const [mounted, setMounted] = useState(true)

  return (
    <main
      data-fixture="plot"
      style={{ display: 'grid', width: 'min(100%, 1200px)', gap: '20px' }}
    >
      {mounted ? (
        <div data-plot-grid style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '16px' }}>
          {Array.from({ length: PLOT_COUNT }, (_, plotIndex) => (
            <PlotFixture key={plotIndex} plotIndex={plotIndex} />
          ))}
        </div>
      ) : (
        <p>The plots are unmounted.</p>
      )}

      <button data-plot-mount-toggle hidden type="button" onClick={() => setMounted((current) => !current)}>
        Toggle mount
      </button>
    </main>
  )
}
`

export default plotFixture
