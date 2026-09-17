import { scatter, type PlotArgs } from '@antadesign/plot'

export function bubbles(): PlotArgs<Node> {
  const data = Array.from({ length: 24 }, (_, i) => ({
    x: 12 + (i * 17 % 83),
    y: 15 + (i * 31 % 72),
    volume: 20 + (i * 43 % 180),
  }))

  return {
    series: [scatter<Node>({
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
    zoom_pan: false,
  }
}

export function shapes(): PlotArgs<Node> {
  const data = Array.from({ length: 18 }, (_, i) => ({
    x: 10 + i * 4.5,
    y: 18 + i * 2.5 + Math.sin(i * 2.1) * 12,
  }))

  return {
    series: [
      scatter<Node>({
        data,
        mark: 'square',
        size: 11,
        color: { light: '#c4b5fd', dark: '#8b5cf6' },
        stroke: { color: { light: '#6d28d9', dark: '#ddd6fe' }, width: 2 },
        tooltip: ({ x, y }) => document.createTextNode('Squares: ' + x + ', ' + Math.round(Number(y))),
      }),
      scatter<Node>({
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
    zoom_pan: false,
  }
}

export const scatterExamples = { bubbles, shapes }
