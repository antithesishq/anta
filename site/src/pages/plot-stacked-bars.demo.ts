export default `
import { useState } from 'preact/hooks'
import { bar, type BarArgs } from '@antadesign/plot'
import { Plot } from '@antadesign/plot/react'
import '@antadesign/plot/plot.css'

const data = [
  { service: 'Search', network: 18, compute: 54, storage: 28 },
  { service: 'Checkout', network: 24, compute: 38, storage: 46 },
  { service: 'Feed', network: 12, compute: 72, storage: 18 },
  { service: 'Upload', network: 48, compute: 22, storage: 62 },
  { service: 'Profile', network: 16, compute: 26, storage: 34 },
  { service: 'Export', network: 32, compute: 86, storage: 54 },
]

/** @play props Stacked bars options */
const options = {
  x: 'service',
  y: ['network', 'compute', 'storage'],
  color: [{ light: '#0d9488', dark: '#5eead4' }, { light: '#6366f1', dark: '#a5b4fc' }, { light: '#d97706', dark: '#fcd34d' }],
  border_radius: 3,
  inset: 10,
  min_size: 2,
  hover_span_x: true,
  hover_span_y: false,
  tooltip: ({ y, label }) => String(label) + ': ' + y + ' ms',
  hoverable: true,
  highlight: true,
} satisfies Omit<BarArgs<string>, 'data' | 'on_select'>

function Demo() {
  const [selection, setSelection] = useState('Select a point to inspect its data.')

  const plotArgs = {
    series: [
      bar({
        data,
        ...options,
        on_select: (point) => setSelection(options.tooltip(point)),
      }),
    ],
    height: 320,
    title: { text: 'Where the time goes', size: 16 },
    margin: { top: 28, right: 24, bottom: 54, left: 72 },
    border: false,
    axis: { x: { label: '', padding: 12 }, y: { label: 'Time (ms)', min: 0 } },
    background: { light: '#ffffff', dark: '#141820' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: false, y: true },
    zoom_pan: { x: true, y: true, modifier: true },
  }

  return (
    <div className="series-demo">
      <Plot plotArgs={plotArgs} />
      <output aria-live="polite">{selection}</output>
    </div>
  )
}
`
