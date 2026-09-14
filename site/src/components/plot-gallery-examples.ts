import { area, bar, custom, line, rect, rule, scatter, type BarArgs, type CustomArgs, type LineArgs, type PlotArgs, type RectArgs, type RuleArgs, type Series } from '@antadesign/plot'

function overviewExample(): PlotArgs<Node> {
  // Synthetic data, sampled every 15 minutes. No randomness: edits keep the same data.
  const forecast = Array.from({ length: 97 }, (_, i) => {
    const hour = i / 4
    const morning = 150 * Math.exp(-(((hour - 9) / 2.8) ** 2))
    const evening = 240 * Math.exp(-(((hour - 17) / 3.4) ** 2))
    const expected = 85 + morning + evening
    const spread = 22 + 12 * Math.sin(hour / 5) ** 2
    return { hour, expected, low: expected - spread, high: expected + spread }
  })

  const observations = forecast.map((point, i) => {
    const burst = i >= 61 && i <= 68 ? 65 * Math.sin((i - 60) / 9 * Math.PI) : 0
    const actual = Math.round(point.expected + 13 * Math.sin(i * 1.8) + 8 * Math.cos(i * 0.7) + burst)
    return { ...point, actual, outside: actual > point.high || actual < point.low }
  })

  const trend = observations.map((point, i) => {
    const window = observations.slice(Math.max(0, i - 3), Math.min(observations.length, i + 4))
    return { hour: point.hour, average: window.reduce((sum, row) => sum + row.actual, 0) / window.length }
  })

  const meanExpected = forecast.reduce((sum, point) => sum + point.expected, 0) / forecast.length

  const series: Series<Node>[] = [
    area<Node>({
      data: forecast,
      x: 'hour',
      y: 'high',
      y2: 'low',
      color: { light: '#ede9fe', dark: '#30274e' },
      hoverable: false,
    }),
    rule<Node>({
      y: meanExpected,
      color: { light: '#d97706', dark: '#fbbf24' },
      width: 2,
      dash: [8, 4],
      hoverable: false,
    }),
    line<Node>({
      data: forecast,
      x: 'hour',
      y: 'expected',
      color: { light: '#8b5cf6', dark: '#c4b5fd' },
      width: 2,
      dash: [5, 5],
      tooltip: ({ x, y }) => document.createTextNode('Forecast at ' + x + 'h: ' + Math.round(Number(y)) + ' requests/s'),
    }),
    line<Node>({
      data: trend,
      x: 'hour',
      y: 'average',
      color: { light: '#0891b2', dark: '#67e8f9' },
      width: 3,
      tooltip: ({ x, y }) => document.createTextNode('Trend at ' + x + 'h: ' + Math.round(Number(y)) + ' requests/s'),
    }),
    scatter<Node>({
      data: observations.filter(point => !point.outside),
      x: 'hour',
      y: 'actual',
      color: { light: '#0891b2', dark: '#67e8f9' },
      size: 4,
      tooltip: ({ x, y }) => document.createTextNode('Observed at ' + x + 'h: ' + y + ' requests/s'),
    }),
    scatter<Node>({
      data: observations.filter(point => point.outside),
      x: 'hour',
      y: 'actual',
      color: { light: '#e76f51', dark: '#fda489' },
      mark: 'diamond',
      size: 9,
      stroke: { color: { light: '#ffffff', dark: '#151b28' }, width: 1 },
      tooltip: ({ x, y }) => document.createTextNode('Outside forecast range: ' + x + 'h · ' + y + ' requests/s'),
    }),
  ]

  const options = {

    height: 400,
    border: false,
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    background: { light: '#ffffff', dark: '#151b28' },
    theme_invert: false,
  }

  const axis = {

    x: { min: 0, max: 24, label: 'Hour' },

    y: { min: 0, max: 440, label: 'Requests/s' },

  }


  const margin = 12

  const grid = false

  const zoom_pan = { x: true, y: true, modifier: false }

  // Replace the object to apply a change; Plot does not observe in-place mutation.
  const plotArgs: PlotArgs<Node> = { ...options, series, axis, margin, grid, zoom_pan }

  return plotArgs
}

function energyExample(): PlotArgs<Node> {
  const data = [
    { x: 'A', solar: 28, wind: 35, demand: 72 },
    { x: 'B', solar: 48, wind: 18, demand: 54 },
    { x: 'C', solar: 19, wind: 25, demand: 62 },
    { x: 'D', solar: 36, wind: 42, demand: 69 },
    { x: 'E', solar: 52, wind: 12, demand: 78 },
    { x: 'F', solar: 24, wind: 30, demand: 46 },
    { x: 'G', solar: 41, wind: 28, demand: 58 },
    { x: 'H', solar: 16, wind: 22, demand: 51 },
  ]
  return {
    series: [
      bar<Node>({ data, y: ['solar', 'wind'],
        color: [{ light: '#fbbf24', dark: '#d97706' }, { light: '#2dd4bf', dark: '#0d9488' }],
        inset: 5, border_radius: 3 }),
      scatter<Node>({ data, y: 'demand', mark: 'diamond', size: 7,
        color: { light: '#7c3aed', dark: '#c4b5fd' },
        stroke: { color: { light: '#ffffff', dark: '#151b28' }, width: 1.5 } }),
    ],
    axis: { x: { label: 'Site' }, y: { min: 0, max: 90, label: 'Power (kW)' } },
    background: { light: '#ffffff', dark: '#151b28' },
    border: false,
    grid: false,
    zoom_pan: false,
  }
}

function latencyExample(): PlotArgs<Node> {
  const density = (x: number) => 48 * Math.exp(-(((x - 65) / 24) ** 2))
    + 19 * Math.exp(-(((x - 135) / 38) ** 2))
  const bins = Array.from({ length: 24 }, (_, i) => {
    const x = i * 10
    return { x: x + 1, x2: x + 9, y: density(x + 5) * (0.8 + 0.3 * Math.sin(i * 2.3) ** 2), y2: 0 }
  })
  const curve = Array.from({ length: 121 }, (_, i) => ({ x: i * 2, y: density(i * 2) }))
  return {
    series: [
      area<Node>({ data: curve, y2: 0, color: { light: '#fce7f3', dark: '#452039' } }),
      rect<Node>({ data: bins, color: { light: '#f472b6', dark: '#be185d' } }),
      line<Node>({ data: curve, color: { light: '#9d174d', dark: '#fbcfe8' }, width: 2.5 }),

    ],
    axis: { x: { min: 0, max: 240, label: 'Latency (ms)' }, y: { min: 0, max: 60, label: 'Requests' } },
    background: { light: '#ffffff', dark: '#151b28' },
    border: false,
    grid: false,
    zoom_pan: false,
  }
}

function mixedExample(): PlotArgs<Node> {
  const points = [
    { x: 12, y: 74 }, { x: 25, y: 57 }, { x: 39, y: 85 }, { x: 48, y: 18 },
    { x: 62, y: 70 }, { x: 73, y: 37 }, { x: 86.5, y: 86 }, { x: 92, y: 22 },
    { x: 15, y: 27 }, { x: 36, y: 64 }, { x: 57, y: 88 },
  ]
  const paths = [
    [
      { x: 25, y: 0 }, { x: 36, y: 19 }, { x: 41, y: 15 }, { x: 56, y: 37 },
      { x: 65, y: 23 }, { x: 72, y: 48 }, { x: 76, y: 44 }, { x: 93, y: 63 }, { x: 100, y: 68 },
    ],
    [
      { x: 0, y: 73 }, { x: 9, y: 87 }, { x: 13, y: 84 }, { x: 20, y: 92 },
      { x: 29, y: 79 }, { x: 39, y: 96 }, { x: 42, y: 93 }, { x: 48, y: 100 },
    ],
  ]
  // Sample cosine transitions to round each turn without changing its height.
  const smoothPaths = paths.map(path => path.flatMap((point, i) => {
    const next = path[i + 1]
    if (!next) return [point]
    return Array.from({ length: 16 }, (_, j) => {
      const t = j / 16
      const blend = (1 - Math.cos(Math.PI * t)) / 2
      return { x: point.x + (next.x - point.x) * t, y: point.y + (next.y - point.y) * blend }
    })
  }))
  const colors = [
    { light: '#7c3aed', dark: '#c4b5fd' },
    { light: '#e11d48', dark: '#fda4af' },
    { light: '#0284c7', dark: '#7dd3fc' },
    { light: '#d97706', dark: '#fcd34d' },
  ]
  return {
    series: [
      area<Node>({ data: Array.from({ length: 81 }, (_, i) => {
        const x = i * 1.25
        const center = 50 + 7 * Math.sin(i / 9) + 3 * Math.cos(i / 4)
        const spread = 3 + 1.5 * Math.sin(i / 11) ** 2
        return { x, y: center + spread, y2: center - spread }
      }), color: { light: '#99f6e4', dark: '#115e59' },
        stroke: { color: { light: '#14b8a6', dark: '#5eead4' }, width: 1 } }),
      ...points.map((point, i) => scatter<Node>({ data: [point], size: [7, 12, 21, 10, 15, 9, 26, 13, 11, 8, 14][i],
        mark: 'circle', color: colors[i % colors.length],
        stroke: { color: { light: '#ffffff', dark: '#151b28' }, width: 1.5 } })),
      rect<Node>({ data: [{ x: 32, x2: 44, y: 31, y2: 47 }],
        color: { light: '#ddd6fe', dark: '#5b21b6' },
        stroke: { color: { light: '#8b5cf6', dark: '#c4b5fd' }, width: 1.5 } }),
      rect<Node>({ data: [{ x: 76, x2: 97, y: 76, y2: 96 }],
        color: { light: 'rgba(254, 215, 170, 0.55)', dark: 'rgba(154, 52, 18, 0.55)' },
        stroke: { color: { light: '#f97316', dark: '#fdba74' }, width: 1.5 } }),
      ...smoothPaths.map((data, i) => line<Node>({ data, width: 2.5, dash: i === 1 ? [7, 5] : [],
        color: i % 2 === 0 ? { light: '#0d9488', dark: '#5eead4' }
          : { light: '#f97316', dark: '#fdba74' },
      })),

      rule<Node>({ y: 10, color: { light: '#0284c7', dark: '#7dd3fc' }, width: 1.5, dash: [6, 4] }),
    ],
    axis: { x: { min: 0, max: 100, label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    border: false,
    grid: false,
    zoom_pan: false,
  }
}

function scatterExample(): PlotArgs<Node> {
  // Independent seeded samples keep the cloud irregular but stable on reload.
  let seed = 20260914
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0
    return (seed + 0.5) / 4294967296
  }
  const data = Array.from({ length: 240 }, () => {
    const x = 5 + random() * 90
    const noise = Math.sqrt(-2 * Math.log(random())) * Math.cos(2 * Math.PI * random())
    return { x, y: 15 + x * 0.68 + noise * 14 }
  })

  return {
    series: [scatter<Node>({
      data,
      size: 3,
      color: { light: 'rgba(13, 148, 136, 0.65)', dark: 'rgba(94, 234, 212, 0.65)' },
      hoverable: false,
    })],
    height: 160,
    margin: 8,
    axis: { x: { hidden: true, min: 0, max: 100 }, y: { hidden: true, min: 0, max: 100 } },
    background: { light: '#ffffff', dark: '#141820' },
    grid: false,
    border: false,
    zoom_pan: false,
  }
}

function lineExample(): PlotArgs<Node> {
  const data = Array.from({ length: 193 }, (_, i) => ({
    hour: i / 8,
    requests: Math.round(180 + 420 * Math.exp(-(((i - 116) / 40) ** 2))
      + 55 * Math.sin(i * 0.55) + 28 * Math.cos(i * 1.7) + 16 * Math.sin(i * 2.9)),
  }))

  const options = {
    x: 'hour',
    y: 'requests',
    color: { light: '#6366f1', dark: '#a5b4fc' },
    width: 3,
    dash: [],
    tooltip: ({ x, y }) => document.createTextNode(x + ':00 · ' + y + ' requests/s'),
    hoverable: true,
    highlight: true,
  } satisfies Omit<LineArgs<Node>, 'data' | 'on_select'>



  const plotArgs: PlotArgs<Node> = {
    series: [
      line({
        data,
        ...options,
      }),
    ],
    height: 320,

    margin: 12,
    border: false,
    axis: { x: { hidden: true, min: 0, max: 24 }, y: { hidden: true, min: 0 } },
    background: { light: '#ffffff', dark: '#141820' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    zoom_pan: { x: true, y: true, modifier: true },
  }

  return plotArgs
}

function barExample(): PlotArgs<Node> {
  const data = [
    { region: 'Asia', requests: 820 },
    { region: 'US West', requests: 960 },
    { region: 'EU West', requests: 1080 },
    { region: 'US East', requests: 1240 },
  ]

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
    tooltip: ({ x, y }) => document.createTextNode(x + ': ' + y + ' requests/s'),
    hoverable: true,
    highlight: true,
  } satisfies Omit<BarArgs<Node>, 'data' | 'on_select'>



  const plotArgs: PlotArgs<Node> = {
    series: [
      bar({
        data,
        ...options,
      }),
    ],
    height: 320,

    margin: 12,
    border: false,
    axis: { x: { hidden: true, padding: 12 }, y: { hidden: true, min: 0 } },
    background: { light: '#ffffff', dark: '#141820' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    zoom_pan: { x: true, y: true, modifier: true },
  }

  return plotArgs
}

function stackedExample(): PlotArgs<Node> {
  const data = [
    { service: 'Search', network: 18, compute: 54, storage: 28 },
    { service: 'Feed', network: 12, compute: 72, storage: 18 },
    { service: 'Upload', network: 48, compute: 22, storage: 62 },
    { service: 'Export', network: 32, compute: 86, storage: 54 },
  ]

  const options = {
    x: 'service',
    y: ['network', 'compute', 'storage'],
    color: [{ light: '#0d9488', dark: '#5eead4' }, { light: '#6366f1', dark: '#a5b4fc' }, { light: '#d97706', dark: '#fcd34d' }],
    border_radius: 3,
    inset: 6,
    min_size: 2,
    hover_span_x: true,
    hover_span_y: false,
    tooltip: ({ y, label }) => document.createTextNode(String(label) + ': ' + y + ' ms'),
    hoverable: true,
    highlight: true,
  } satisfies Omit<BarArgs<Node>, 'data' | 'on_select'>



  const plotArgs: PlotArgs<Node> = {
    series: [
      bar({
        data,
        ...options,
      }),
    ],
    height: 320,

    margin: 12,
    border: false,
    axis: { x: { hidden: true, padding: 12 }, y: { hidden: true, min: 0 } },
    background: { light: '#ffffff', dark: '#141820' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    zoom_pan: { x: true, y: true, modifier: true },
  }

  return plotArgs
}

function areaExample(): PlotArgs<Node> {
  const data = Array.from({ length: 97 }, (_, i) => {
    const first = 18 + 7 * Math.sin(i / 24) + 2.5 * Math.sin(i / 5)
    const second = first + 22 + 9 * Math.sin(i / 30 + 1) + 3 * Math.cos(i / 7)
    const total = second + 16 + 6 * Math.cos(i / 26) + 2 * Math.sin(i / 4 + 1)
    return { x: i / 4, first, second, total }
  })

  return {
    series: [
      area<Node>({ data, y: 'first', y2: 0, color: { light: '#2dd4bf', dark: '#0d9488' } }),
      area<Node>({ data, y: 'second', y2: 'first', color: { light: '#a5b4fc', dark: '#6366f1' } }),
      area<Node>({ data, y: 'total', y2: 'second', color: { light: '#fcd34d', dark: '#b45309' } }),
    ],
    height: 160,
    margin: 8,
    border: false,
    axis: { x: { hidden: true, min: 0, max: 24 }, y: { hidden: true, min: 0, max: 100 } },
    background: { light: '#ffffff', dark: '#141820' },
    grid: false,
    zoom_pan: false,
  }
}

function rectExample(): PlotArgs<Node> {
  const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']
  const data = days.flatMap((day, d) => Array.from({ length: 18 }, (_, h) => {
    const activity = Math.round(100 * Math.max(0.08, Math.sin((h + 1) / 19 * Math.PI)) * (d < 5 ? 1 : 0.45)
      * (0.65 + 0.35 * Math.sin(h * 2.3 + d) ** 2))
    return { day, hour: String(h + 6).padStart(2, '0') + ':00', activity }
  }))

  const options = {
    x: 'hour',
    y: 'day',
    inset: 0.5,
    min_size: 2,
    offset: { x: 0, y: 0 },
    color: (row) => ({
      light: 'hsl(174, 65%, ' + (94 - Number(row.activity) * 0.6) + '%)',
      dark: 'hsl(174, 55%, ' + (16 + Number(row.activity) * 0.4) + '%)',
    }),

    tooltip: ({ x, y, row }) => document.createTextNode(x + ' · ' + y + ' · activity ' + row.activity + '%'),
    hoverable: true,
    highlight: true,
  } satisfies Omit<RectArgs<Node>, 'data' | 'on_select'>



  const plotArgs: PlotArgs<Node> = {
    series: [
      rect({
        data,
        ...options,
      }),
    ],
    height: 320,

    margin: 12,
    border: false,
    axis: {
      x: {
        hidden: true,
        categories: Array.from({ length: 18 }, (_, h) => String(h + 6).padStart(2, '0') + ':00'),
      },
      y: { hidden: true, categories: days },
    },
    background: { light: '#ffffff', dark: '#141820' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    zoom_pan: { x: true, y: true, modifier: true },
  }

  return plotArgs
}

function ruleExample(): PlotArgs<Node> {
  const data = [
    { threshold: 75, level: 'Warning' },
    { threshold: 110, level: 'Critical' },
  ]
  const samples = Array.from({ length: 181 }, (_, i) => {
    const minute = i / 3
    const latency = Math.round(42 + 8 * Math.sin(i / 9) + 5 * Math.cos(i * 0.9)
      + 65 * Math.exp(-(((minute - 23) / 5) ** 2))
      + 82 * Math.exp(-(((minute - 42) / 4) ** 2)))
    return { minute, latency }
  })
  const events = [
    { minute: 16, event: 'Deploy started' },
    { minute: 35, event: 'Traffic shifted' },
    { minute: 48, event: 'Rollback completed' },
  ]

  const options = {
    y: 'threshold',
    color: (row) => Number(row.threshold) >= 110 ? { light: '#e11d48', dark: '#fb7185' } : { light: '#d97706', dark: '#fcd34d' },
    width: 2,
    dash: [6, 4],
    tooltip: ({ y, row }) => document.createTextNode(String(row?.level) + ': ' + y + ' ms'),
    hoverable: true,
    highlight: true,
  } satisfies Omit<RuleArgs<Node>, 'data' | 'on_select'>



  const plotArgs: PlotArgs<Node> = {
    series: [
      rule<Node>({
        data: events, x: 'minute',
        color: { light: '#64748b', dark: '#94a3b8' }, width: 1.5, dash: [3, 5],
        tooltip: ({ row }) => document.createTextNode(String(row?.event)),
      }),
      line<Node>({ data: samples, x: 'minute', y: 'latency', color: { light: '#cbd5e1', dark: '#475569' }, width: 1 }),
      rule({
        data,
        ...options,
      }),
    ],
    height: 320,

    margin: 12,
    border: false,
    axis: { x: { hidden: true, min: 0, max: 60 }, y: { hidden: true, min: 0, max: 160 } },
    background: { light: '#ffffff', dark: '#141820' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    zoom_pan: { x: true, y: true, modifier: true },
  }

  return plotArgs
}

function customExample(): PlotArgs<Node> {
  const data = Array.from({ length: 7 }, (_, y) =>
    Array.from({ length: 11 }, (_, x) => ({
      x, y,
      angle: Math.atan2(y - 3, x - 5) + Math.PI / 2,
      speed: 7 + 10 * Math.exp(-((x - 5) ** 2 + (y - 3) ** 2) / 18),
    })),
  ).flat()

  const options = {
    x: 'x',
    y: 'y',
    color: (row) => ({
      light: 'hsl(' + (180 + Number(row.speed) * 5) + ', 65%, 45%)',
      dark: 'hsl(' + (180 + Number(row.speed) * 5) + ', 75%, 70%)',
    }),
    renderer: (series, { ctx, resolve_x, resolve_y, color_at }) => {
      ctx.save()
      ctx.lineWidth = 2
      for (let i = 0; i < series.x.length; i++) {
        const x = resolve_x(i)
        const y = resolve_y(i)
        if (x === undefined || y === undefined) continue
        const row = series.rows?.[i]
        const angle = Number(row?.angle ?? 0)
        const length = Number(row?.speed ?? 8)
        ctx.save()
        ctx.translate(x, y)
        ctx.rotate(angle)
        ctx.strokeStyle = color_at(i)
        ctx.fillStyle = color_at(i)
        ctx.lineCap = 'round'
        ctx.beginPath()
        ctx.moveTo(-length / 2, 0)
        ctx.lineTo(length / 2, 0)
        ctx.stroke()
        ctx.beginPath()
        ctx.moveTo(length / 2 + 3, 0)
        ctx.lineTo(length / 2 - 3, -4)
        ctx.lineTo(length / 2 - 3, 4)
        ctx.closePath()
        ctx.fill()
        ctx.restore()
      }
      ctx.restore()
    },
    hit_test: (series, { cursor, resolve_x, resolve_y }) => {
      let nearest: number | null = null
      let distance = 13
      for (let i = 0; i < series.x.length; i++) {
        const x = resolve_x(i)
        const y = resolve_y(i)
        if (x === undefined || y === undefined) continue
        const candidate = Math.hypot(cursor.x - x, cursor.y - y)
        if (candidate <= distance) {
          nearest = i
          distance = candidate
        }
      }
      return nearest
    },
    tooltip: ({ x, y, row }) => document.createTextNode('Position (' + x + ', ' + y + ') · speed ' + Number(row?.speed).toFixed(1)),
    hoverable: true,
  } satisfies Omit<CustomArgs<Node>, 'data' | 'on_select'>



  const plotArgs: PlotArgs<Node> = {
    series: [
      custom<Node>({
        data,
        ...options,
      }),
    ],
    height: 320,

    margin: 12,
    border: false,
    axis: { x: { hidden: true, min: -0.7, max: 10.7 }, y: { hidden: true, min: -0.7, max: 6.7 } },
    background: { light: '#ffffff', dark: '#141820' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    zoom_pan: { x: true, y: true, modifier: true },
  }

  return plotArgs
}

export const galleryExamples = { overview: overviewExample,
  energy: energyExample, latency: latencyExample, mixed: mixedExample, scatter: scatterExample, line: lineExample, bar: barExample, stacked: stackedExample, area: areaExample, rect: rectExample, rule: ruleExample, custom: customExample }


export function galleryLabel(text: string): Series<Node> {
  return custom<Node>({
    data: [{ part: 'background' }, { part: 'text' }],
    color: (_, i) => i === 0
      ? { light: '#ffffff', dark: '#151b28' }
      : { light: '#25324b', dark: '#e2e8f0' },
    hoverable: false,
    renderer: (_, { ctx, inner, color_at }) => {
      ctx.save()
      ctx.font = '600 14px sans-serif'
      ctx.textAlign = 'left'
      ctx.textBaseline = 'top'
      const x = inner.left + 4
      const y = inner.top + 4
      ctx.globalAlpha = 0.9
      ctx.fillStyle = color_at(0)
      ctx.fillRect(x, y, ctx.measureText(text).width + 16, 26)
      ctx.globalAlpha = 1
      ctx.fillStyle = color_at(1)
      ctx.fillText(text, x + 8, y + 6)
      ctx.restore()
    },
  })
}
