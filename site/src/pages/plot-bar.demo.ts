export default `
import { useState } from 'preact/hooks'
import { bar, type BarArgs } from '@antadesign/plot'
import { Plot } from '@antadesign/plot/react'
import '@antadesign/plot/plot.css'

const data = [
  { region: 'US East', requests: 1240 },
  { region: 'EU West', requests: 1080 },
  { region: 'US West', requests: 960 },
  { region: 'Asia', requests: 820 },
  { region: 'EU North', requests: 690 },
  { region: 'Oceania', requests: 540 },
  { region: 'S. America', requests: 420 },
  { region: 'Africa', requests: 310 },
]

/** @play props Bar options */
const options = {
  x: 'region',
  y: 'requests',
  color: (_, index) => ({
    light: ['#6366f1', '#7274ef', '#8183ed', '#9092eb'][index % 4],
    dark: ['#818cf8', '#a5b4fc', '#c7d2fe', '#a5b4fc'][index % 4],
  }),
  border_radius: 5,
  inset: 8,
  min_size: 2,
  hover_span_x: true,
  hover_span_y: false,
  tooltip: ({ x, y }) => x + ': ' + y + ' requests/s',
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
    title: { text: 'Throughput by region', size: 16 },
    margin: { top: 28, right: 24, bottom: 54, left: 72 },
    border: false,
    axis: { x: { label: '', padding: 12 }, y: { label: 'Requests / second', min: 0 } },
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
