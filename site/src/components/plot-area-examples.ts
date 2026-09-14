import { area, type PlotArgs } from '@antadesign/plot'

export function baseline(): PlotArgs<Node> {
  const data = Array.from({ length: 97 }, (_, i) => ({
    x: i / 4,
    y: 28 + 42 * Math.exp(-(((i - 55) / 24) ** 2))
      + 9 * Math.sin(i / 5) + 4 * Math.cos(i * 1.3),
  }))

  return {
    series: [
      area<Node>({
        data,
        y2: 0,
        color: { light: '#99f6e4', dark: '#134e4a' },
        stroke: { color: { light: '#0d9488', dark: '#5eead4' }, width: 2 },
        tooltip: ({ y }) => document.createTextNode('Load: ' + Math.round(Number(y))),
      }),
    ],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 30 },
    axis: { x: { min: 0, max: 24, label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: false, y: true },
    border: false,
    zoom_pan: false,
  }
}

export function range(): PlotArgs<Node> {
  const data = Array.from({ length: 81 }, (_, i) => {
    const center = 48 + 16 * Math.sin(i / 12) + 5 * Math.cos(i / 3)
    const spread = 8 + 10 * Math.sin(i / 17) ** 2
    return { x: i * 0.3, low: center - spread, high: center + spread }
  })

  return {
    series: [
      area<Node>({
        data,
        y: 'high',
        y2: 'low',
        color: { light: '#ddd6fe', dark: '#4c1d95' },
        stroke: { color: { light: '#7c3aed', dark: '#c4b5fd' }, width: 2 },
        dash: [5, 3],
        tooltip: ({ row }) => document.createTextNode(Math.round(Number(row.low)) + '–' + Math.round(Number(row.high))),
      }),
    ],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 30 },
    axis: { x: { min: 0, max: 24, label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: false, y: true },
    border: false,
    zoom_pan: false,
  }
}

export function layers(): PlotArgs<Node> {
  const data = Array.from({ length: 97 }, (_, i) => {
    const first = 18 + 7 * Math.sin(i / 13) + 3 * Math.cos(i / 4)
    const second = first + 22 + 9 * Math.sin(i / 18 + 1)
    const total = second + 16 + 6 * Math.cos(i / 9)
    return { x: i / 4, first, second, total }
  })

  return {
    series: [
      area<Node>({
        data,
        y: 'first',
        y2: 0,
        color: { light: '#2dd4bf', dark: '#0d9488' },
        tooltip: ({ row }) => document.createTextNode('Network: ' + Math.round(Number(row.first))),
      }),
      area<Node>({
        data,
        y: 'second',
        y2: 'first',
        color: { light: '#a5b4fc', dark: '#6366f1' },
        tooltip: ({ row }) => document.createTextNode('Compute: ' + Math.round(Number(row.second) - Number(row.first))),
      }),
      area<Node>({
        data,
        y: 'total',
        y2: 'second',
        color: { light: '#fcd34d', dark: '#b45309' },
        tooltip: ({ row }) => document.createTextNode('Storage: ' + Math.round(Number(row.total) - Number(row.second))),
      }),
    ],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 30 },
    axis: { x: { min: 0, max: 24, label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: false, y: true },
    border: false,
    zoom_pan: false,
  }
}

export function horizontal(): PlotArgs<Node> {
  const data = Array.from({ length: 81 }, (_, i) => {
    const center = 46 + 18 * Math.sin(i / 16) + 4 * Math.cos(i / 4)
    const spread = 9 + 6 * Math.cos(i / 11) ** 2
    return { y: i * 0.3, low: center - spread, high: center + spread }
  })

  return {
    series: [
      area<Node>({
        data,
        x: 'low',
        x2: 'high',
        color: { light: '#fed7aa', dark: '#7c2d12' },
        stroke: { color: { light: '#ea580c', dark: '#fdba74' }, width: 2 },
        tooltip: ({ row }) => document.createTextNode(Math.round(Number(row.low)) + '–' + Math.round(Number(row.high))),
      }),
    ],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 30 },
    axis: { x: { min: 0, max: 100, label: '' }, y: { min: 0, max: 24, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: true, y: false },
    border: false,
    zoom_pan: false,
  }
}

export const areaExamples = { baseline, range, layers, horizontal }
