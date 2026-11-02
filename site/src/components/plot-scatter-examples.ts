import { scatter, type PlotArgs } from '@antadesign/plot'

export function bubbles(): PlotArgs<Node> {
  const data = Array.from({ length: 24 }, (_, i) => ({
    x: 12 + (i * 17 % 83),
    y: 15 + (i * 31 % 72),
    volume: 20 + (i * 43 % 180),
  }))

  return {
    series: [scatter({
      data,
      size: row => (5 + Math.sqrt(Number(row.volume)) * 1.8) * 1.3,
      color: row => Number(row.volume) > 120
        ? { light: '#e76f51', dark: '#fda489' }
        : { light: '#0891b2', dark: '#67e8f9' },
      stroke: { color: { light: '#ffffff', dark: '#151b28' }, width: 2 },
      tooltip: ({ row }) => document.createTextNode('Volume: ' + row.volume),
    })],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 30 },
    axis: { x: { min: 0, max: 110, label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    border: false,
    zoom_pan: true,
  }
}

export function shapes(): PlotArgs<Node> {
  const data = Array.from({ length: 18 }, (_, i) => ({
    x: 10 + i * 4.5,
    y: 18 + i * 2.5 + Math.sin(i * 2.1) * 12,
  }))

  return {
    series: [
      scatter({
        data,
        mark: 'square',
        size: 11,
        color: { light: '#c4b5fd', dark: '#8b5cf6' },
        stroke: { color: { light: '#6d28d9', dark: '#ddd6fe' }, width: 2 },
        tooltip: ({ x, y }) => document.createTextNode('Squares: ' + x + ', ' + Math.round(Number(y))),
      }),
      scatter({
        data: data.map(point => ({ x: point.x + 5, y: 95 - point.y })),
        mark: 'diamond',
        size: 13,
        color: { light: '#99f6e4', dark: '#0d9488' },
        stroke: { color: { light: '#0f766e', dark: '#5eead4' }, width: 2 },
        tooltip: ({ x, y }) => document.createTextNode('Diamonds: ' + x + ', ' + Math.round(Number(y))),
      }),
    ],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 30 },
    axis: { x: { min: 0, max: 100, label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    border: false,
    zoom_pan: true,
  }
}

export function latency(): PlotArgs<Node> {
  const noise = (index: number) => {
    const value = Math.sin(index * 12.9898) * 43758.5453
    return value - Math.floor(value)
  }

  const requests = Array.from({ length: 800 }, (_, i) => {
    const seconds = i / 799 * 720
    const r1 = noise(i)
    const r2 = noise(i + 9999)
    const incident = Math.exp(-((seconds - 315) ** 2) / 128)
    const outlier = incident < 0.1 && r1 > 0.985 ? 400 + r2 * 300 : 0
    const failed = incident > 0.4 && r2 > 0.5
    const latency = 170 + r1 * 60 + incident * (900 + r2 * 700) + outlier + (failed ? 300 : 0)
    return { seconds, latency, status: failed ? 'Error' : 'OK' }
  })

  return {
    series: [
      scatter({
        data: requests.filter(request => request.status === 'OK'),
        x: 'seconds',
        y: 'latency',
        size: (_row, _index, viewport) => Math.min(12, 2.5 * Math.max(viewport.zoom_factor.x, viewport.zoom_factor.y) ** 0.35),
        color: {
          light: 'color-mix(in oklch, #1e6edc 45%, transparent)',
          dark: 'color-mix(in oklch, #60a5fa 45%, transparent)',
        },
        tooltip: ({ row }) => document.createTextNode(
          row.status + ' · ' + row.seconds.toFixed(1) + ' s · ' + Math.round(row.latency) + ' ms',
        ),
      }),
      scatter({
        data: requests.filter(request => request.status === 'Error'),
        x: 'seconds',
        y: 'latency',
        size: (_row, _index, viewport) => Math.min(12, 3 * Math.max(viewport.zoom_factor.x, viewport.zoom_factor.y) ** 0.35),
        color: { light: '#dc2828', dark: '#f87171' },
        tooltip: ({ row }) => document.createTextNode(
          row.status + ' · ' + row.seconds.toFixed(1) + ' s · ' + Math.round(row.latency) + ' ms',
        ),
      }),
    ],
    height: 260,
    margin: { top: 12, right: 12, bottom: 28, left: 46 },
    axis: {
      x: { min: 0, max: 720, label: '' },
      y: { min: 0, label: '' },
    },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: true,
    border: false,
    zoom_pan: true,
  }
}

export function dense(): PlotArgs<Node> {
  const sample = (index: number) => {
    const value = Math.sin(index * 127.1 + 311.7) * 43758.5453
    return value - Math.floor(value)
  }

  const data = Array.from({ length: 7200 }, (_, i) => {
    const x = 10 + sample(i * 3) * 80
    const spread = i < 6000 ? 45 : 18
    const noise = (sample(i * 3 + 1) + sample(i * 3 + 2) - 1) * spread
    return { x, y: 50 + (x - 50) * 0.28 + noise }
  })

  return {
    series: [scatter({
      data,
      size: (_row, _index, viewport) => Math.min(12, 4 * Math.max(viewport.zoom_factor.x, viewport.zoom_factor.y) ** 0.35),
      color: {
        light: 'color-mix(in oklch, #0e7490 22%, transparent)',
        dark: 'color-mix(in oklch, #67e8f9 22%, transparent)',
      },
      tooltip: ({ x, y }) => document.createTextNode(
        'x: ' + Number(x).toFixed(1) + ' · y: ' + Number(y).toFixed(1),
      ),
    })],
    height: 260,
    margin: { top: 12, right: 12, bottom: 28, left: 36 },
    axis: { x: { min: 10, max: 90, label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    border: false,
    zoom_pan: true,
  }
}

export const scatterExamples = { bubbles, shapes, latency, dense }
