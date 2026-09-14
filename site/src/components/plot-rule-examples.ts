import { rule, line, type PlotArgs } from '@antadesign/plot'

export function thresholds(): PlotArgs<Node> {
  const data = Array.from({ length: 97 }, (_, i) => ({
    x: i / 4,
    y: 44 + 15 * Math.sin(i / 9) + 5 * Math.cos(i * 0.8)
      + 38 * Math.exp(-(((i - 62) / 10) ** 2)),
  }))

  return {
    series: [
      line<Node>({
        data,
        color: { light: '#0891b2', dark: '#67e8f9' },
        width: 2,
      }),
      rule<Node>({
        y: 60,
        color: { light: '#7c3aed', dark: '#c4b5fd' },
        width: 1,
        dash: [7, 4],
        tooltip: () => document.createTextNode('Target: 60 ms'),
      }),
      rule<Node>({
        y: 90,
        color: { light: '#c2410c', dark: '#fdba74' },
        width: 4,
        tooltip: () => document.createTextNode('Upper limit: 90 ms'),
      }),
    ],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 30 },
    axis: { x: { min: 0, max: 24, label: '' }, y: { min: 0, max: 110, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    border: false,
    zoom_pan: false,
  }
}

export function events(): PlotArgs<Node> {
  const data = Array.from({ length: 97 }, (_, i) => ({
    x: i / 4,
    y: 35 + 12 * Math.sin(i / 11) + 4 * Math.cos(i * 0.7)
      + (i >= 28 && i < 64 ? 30 : 0),
  }))
  const events = [
    { hour: 7, name: 'Deploy', recovery: false },
    { hour: 16, name: 'Rollback', recovery: true },
    { hour: 21, name: 'Verified', recovery: true },
  ]

  return {
    series: [
      line<Node>({
        data,
        color: { light: '#6366f1', dark: '#a5b4fc' },
        width: 2,
      }),
      rule<Node>({
        data: events.filter(event => !event.recovery),
        x: 'hour',
        color: { light: '#c2410c', dark: '#fdba74' },
        width: 3,
        tooltip: ({ row }) => document.createTextNode(row?.name + ' at hour ' + row?.hour),
      }),
      rule<Node>({
        data: events.filter(event => event.recovery),
        x: 'hour',
        color: { light: '#0d9488', dark: '#5eead4' },
        width: 2,
        dash: [5, 4],
        tooltip: ({ row }) => document.createTextNode(row?.name + ' at hour ' + row?.hour),
      }),
    ],
    height: 260,
    margin: { top: 5, right: 8, bottom: 20, left: 30 },
    axis: { x: { min: 0, max: 24, label: '' }, y: { min: 0, max: 110, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    border: false,
    zoom_pan: false,
  }
}

export const ruleExamples = { thresholds, events }
