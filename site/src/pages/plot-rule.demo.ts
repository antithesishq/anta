export default `
import { useState } from 'preact/hooks'
import { rule, line, area, type RuleArgs } from '@antadesign/plot'
import { Plot } from '@antadesign/plot/react'
import '@antadesign/plot/plot.css'

const data = [
  { threshold: 75, level: 'Warning' },
  { threshold: 110, level: 'Critical' },
]
const samples = Array.from({ length: 181 }, (_, i) => {
  const minute = i / 3
  const latency = Math.round(42 + 8 * Math.sin(i / 9) + 5 * Math.cos(i * 0.9)
    + 65 * Math.exp(-(((minute - 23) / 5) ** 2))
    + 82 * Math.exp(-(((minute - 42) / 4) ** 2)))
  return { minute, latency, low: latency - 8, high: latency + 10 }
})
const events = [
  { minute: 16, event: 'Deploy started' },
  { minute: 35, event: 'Traffic shifted' },
  { minute: 48, event: 'Rollback completed' },
]

/** @play props Rule options */
const options = {
  y: 'threshold',
  color: (row) => Number(row.threshold) >= 110 ? { light: '#e11d48', dark: '#fb7185' } : { light: '#d97706', dark: '#fcd34d' },
  width: 2,
  dash: [6, 4],
  tooltip: ({ y, row }) => String(row?.level) + ': ' + y + ' ms',
  hoverable: true,
  highlight: true,
} satisfies Omit<RuleArgs<string>, 'data' | 'on_select'>

function Demo() {
  const [selection, setSelection] = useState('Select a point to inspect its data.')

  const plotArgs = {
    series: [
      area<string>({
        data: samples, x: 'minute', y: 'high', y2: 'low',
        color: { light: '#e0e7ff', dark: '#312e81' }, hoverable: false,
      }),
      rule<string>({
        data: events, x: 'minute',
        color: { light: '#64748b', dark: '#94a3b8' }, width: 1.5, dash: [3, 5],
        tooltip: ({ row }) => String(row?.event),
        on_select: ({ row }) => setSelection(String(row?.event)),
      }),
      line<string>({ data: samples, x: 'minute', y: 'latency', color: { light: '#6366f1', dark: '#a5b4fc' }, width: 3 }),
      rule({
        data,
        ...options,
        on_select: (point) => setSelection(options.tooltip(point)),
      }),
    ],
    height: 320,
    title: { text: 'Response time budget', size: 16 },
    margin: { top: 28, right: 24, bottom: 54, left: 72 },
    border: false,
    axis: { x: { label: 'Minute', min: 0, max: 60 }, y: { label: 'Latency (ms)', min: 0, max: 160 } },
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
