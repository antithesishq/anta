const plotFixture = `import { Button } from '@antadesign/anta'
import { Plot, scatter } from '@antadesign/plot'
import { useState } from 'react'

const PLOT_COUNT = 10
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
    rows: [
      { id: 'plot-' + plotIndex + '-center-' + revision, x: 5, y: 5 },
      ...Array.from({ length: count - 1 }, (_, pointIndex) => ({
        id: 'plot-' + plotIndex + '-point-' + revision + '-' + pointIndex,
        x: Number((random() * 10).toFixed(2)),
        y: Number((random() * 10).toFixed(2)),
      })),
    ],
  }
}

function createDatasetSet(revision) {
  return {
    plots: Array.from({ length: PLOT_COUNT }, (_, plotIndex) => createDataset(revision, plotIndex)),
    revision,
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
  const [dataset, setDataset] = useState(() => createDatasetSet(0))
  const [height, setHeight] = useState(240)
  const [viewport, setViewport] = useState({ x: null, y: null, key: 0 })
  const [mounted, setMounted] = useState(true)
  const [selected, setSelected] = useState('None')
  const [viewportReport, setViewportReport] = useState('No gesture report')
  const [errors, setErrors] = useState([])

  const formatWindow = (range) => range ? range.map((value) => value.toFixed(2)).join('–') : 'full'
  const pointCount = dataset.plots.reduce((total, plot) => total + plot.rows.length, 0)
  const sharedPlotArgs = {
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
  }

  return (
    <main
      data-fixture="plot"
      style={{ display: 'grid', width: 'min(100%, 1200px)', gap: '20px' }}
    >
      {mounted ? (
        <div data-plot-grid style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: '16px' }}>
          {dataset.plots.map((plot, plotIndex) => (
            <div data-plot-instance={plotIndex} key={plotIndex} style={{ minHeight: height + 'px' }}>
              <Plot
                data-plot-target
                data-plot-index={plotIndex}
                plotArgs={{
                  ...sharedPlotArgs,
                  series: [scatter({
                    data: plot.rows,
                    size: 18,
                    color: plot.color,
                    tooltip: ({ row }) => <span data-plot-tooltip>{row.id}</span>,
                    on_select: ({ row }) => setSelected('Plot ' + (plotIndex + 1) + ': ' + row.id),
                  })],
                  on_viewport_change: ({ x, y, zoom_factor }) => {
                    const format = (axis) => axis ? axis.window.map((value) => value.toFixed(2)).join('–') : 'categorical'
                    setViewportReport('Plot ' + (plotIndex + 1) + ': x ' + format(x) + ', y ' + format(y) + ', zoom ' + zoom_factor.x.toFixed(2) + '×' + zoom_factor.y.toFixed(2))
                  },
                }}
                onError={({ phase, error }) => setErrors((current) => [
                  ...current,
                  'Plot ' + (plotIndex + 1) + ' ' + phase + ': ' + String(error),
                ])}
              />
            </div>
          ))}
        </div>
      ) : (
        <p data-fixture-empty>The plots are unmounted.</p>
      )}

      <output aria-live="polite" data-fixture-state style={{ display: 'grid', gap: '4px', color: 'var(--text-2)', fontSize: '14px' }}>
        <span>Dataset {dataset.revision}: {pointCount} points across {PLOT_COUNT} plots, {height}px each</span>
        <span>Selected: {selected}</span>
        <span>Requested viewport: x {formatWindow(viewport.x)}, y {formatWindow(viewport.y)}</span>
        <span>Last gesture report: {viewportReport}</span>
        <span>Errors: {errors.length}</span>
      </output>

      {errors.length > 0 && <pre data-plot-errors>{errors.join('\\n')}</pre>}

      <div aria-label="Fixture controls" data-fixture-controls style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <Button priority="secondary" onClick={() => {
          setDataset((current) => createDatasetSet(current.revision + 1))
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
