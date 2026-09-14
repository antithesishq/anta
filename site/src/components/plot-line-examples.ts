import { line, type PlotArgs } from '@antadesign/plot'

export function comparison(): PlotArgs<Node> {
  const data = Array.from({ length: 97 }, (_, i) => ({
    x: i / 4,
    expected: 45 + 22 * Math.sin(i / 18) + 12 * Math.cos(i / 7),
    measured: 45 + 22 * Math.sin(i / 18) + 12 * Math.cos(i / 7)
      + 7 * Math.sin(i * 1.1) + 4 * Math.cos(i * 2.3),
  }))

  return {
    series: [
      line<Node>({
        data,
        y: 'expected',
        color: { light: '#c2410c', dark: '#fdba74' },
        width: 2,
        dash: [7, 5],
        tooltip: ({ y }) => document.createTextNode('Expected: ' + Math.round(Number(y))),
      }),
      line<Node>({
        data,
        y: 'measured',
        color: { light: '#0891b2', dark: '#67e8f9' },
        width: 2,
        tooltip: ({ y }) => document.createTextNode('Measured: ' + Math.round(Number(y))),
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

export function markers(): PlotArgs<Node> {
  const data = Array.from({ length: 13 }, (_, i) => ({
    x: i,
    y: 35 + i * 2 + 18 * Math.sin(i * 0.8) + 8 * Math.cos(i * 1.7),
  }))

  return {
    series: [line<Node>({
      data,
      color: { light: '#7c3aed', dark: '#c4b5fd' },
      width: 3,
      mark: 'diamond',
      mark_size: 10,
      mark_stroke: { color: { light: '#ffffff', dark: '#151b28' }, width: 2 },
      tooltip: ({ x, y }) => document.createTextNode('Sample ' + x + ': ' + Math.round(Number(y))),
    })],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 30 },
    axis: { x: { min: -0.5, max: 12.5, label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: false, y: true },
    border: false,
    zoom_pan: false,
  }
}

export const lineExamples = { comparison, markers }
