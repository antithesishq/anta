const plotFixture = `import { Button } from '@antadesign/anta'
import { Plot, scatter } from '@antadesign/plot'
import { useState } from 'react'

const datasetA = [
  { id: 'a-left', x: 2, y: 3 },
  { id: 'a-center', x: 5, y: 5 },
  { id: 'a-right', x: 8, y: 7 },
]

const datasetB = [
  { id: 'b-left', x: 1, y: 8 },
  { id: 'b-center', x: 5, y: 5 },
  { id: 'b-right', x: 9, y: 2 },
]

export default function App() {
  const [dataset, setDataset] = useState('A')
  const [height, setHeight] = useState(240)
  const [interactions, setInteractions] = useState(true)
  const [viewport, setViewport] = useState({ focused: false, key: 0 })
  const [mounted, setMounted] = useState(true)
  const [selected, setSelected] = useState('None')
  const [viewportReport, setViewportReport] = useState('No gesture report')
  const [errors, setErrors] = useState([])
  const data = dataset === 'A' ? datasetA : datasetB

  const plotArgs = {
    series: [scatter({
      data,
      size: 18,
      color: dataset === 'A' ? '#4f46e5' : '#0d9488',
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
    zoom_pan: interactions ? { x: true, y: true, modifier: true } : false,
    viewport: {
      x: viewport.focused ? [2, 8] : null,
      y: viewport.focused ? [2, 8] : null,
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
        <span>Dataset {dataset}, {height}px, interactions {interactions ? 'enabled' : 'disabled'}</span>
        <span>Selected: {selected}</span>
        <span>Requested viewport: {viewport.focused ? '2–8 on both axes' : 'full extent'}</span>
        <span>Last gesture report: {viewportReport}</span>
        <span>Errors: {errors.length}</span>
      </output>

      {errors.length > 0 && <pre data-plot-errors>{errors.join('\\n')}</pre>}

      <div aria-label="Fixture controls" data-fixture-controls style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
        <Button priority="secondary" onClick={() => {
          setDataset((current) => current === 'A' ? 'B' : 'A')
          setSelected('None')
        }}>
          Update data
        </Button>

        <Button priority="secondary" onClick={() => setHeight((current) => current === 240 ? 320 : 240)}>
          Resize
        </Button>

        <Button priority="secondary" onClick={() => setInteractions((current) => !current)}>
          {interactions ? 'Disable interactions' : 'Enable interactions'}
        </Button>

        <Button priority="secondary" onClick={() => setViewport((current) => ({
          focused: !current.focused,
          key: current.key + 1,
        }))}>
          {viewport.focused ? 'Clear viewport' : 'Apply viewport'}
        </Button>

        <Button priority="secondary" onClick={() => setMounted((current) => !current)}>
          {mounted ? 'Unmount' : 'Mount'}
        </Button>
      </div>
    </main>
  )
}
`

export default plotFixture
