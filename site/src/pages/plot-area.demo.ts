export default `
import { useState } from 'preact/hooks'
import { area, type AreaArgs } from '@antadesign/plot'
import { Plot } from '@antadesign/plot/react'
import '@antadesign/plot/plot.css'

const data = Array.from({ length: 181 }, (_, i) => {
  const minute = i / 3
  const baseline = 45 + 15 * Math.sin(i / 22)
    + 35 * Math.exp(-(((i - 115) / 23) ** 2)) + 4 * Math.sin(i * 0.8)
  const spread = 17 + 7 * Math.sin(i / 13) ** 2
  return {
    minute,
    low: Math.round(baseline - spread),
    high: Math.round(baseline + spread),
    innerLow: Math.round(baseline - spread * 0.4),
    innerHigh: Math.round(baseline + spread * 0.4),
  }
})

/** @play props Area options */
const options = {
  x: 'minute',
  y: 'high',
  y2: 'low',
  color: { light: '#c7d2fe', dark: '#37306b' },
  stroke: { color: { light: '#818cf8', dark: '#a5b4fc' }, width: 2 },
  dash: [],
  tooltip: ({ x, row }) => x + ' min · ' + row.low + '–' + row.high + ' ms',
  hoverable: true,
  highlight: true,
} satisfies Omit<AreaArgs<string>, 'data' | 'on_select'>

function Demo() {
  const [selection, setSelection] = useState('Select a point to inspect its data.')

  const plotArgs = {
    series: [
      area({
        data,
        ...options,
        on_select: (point) => setSelection(options.tooltip(point)),
      }),
      area({
        data,
        x: 'minute',
        y: 'innerHigh',
        y2: 'innerLow',
        color: { light: '#818cf8', dark: '#6366f1' },
        stroke: { color: { light: '#4f46e5', dark: '#c7d2fe' }, width: 1.5 },
        tooltip: ({ x, row }) => x + ' min · typical range: ' + row.innerLow + '–' + row.innerHigh + ' ms',
        on_select: ({ row }) => setSelection('Typical range: ' + row.innerLow + '–' + row.innerHigh + ' ms'),
      }),
    ],
    height: 320,
    title: { text: 'Latency envelope', size: 16 },
    margin: { top: 28, right: 24, bottom: 54, left: 72 },
    border: false,
    axis: { x: { label: 'Minute', min: 0, max: 60 }, y: { label: 'Latency (ms)', min: 0 } },
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
