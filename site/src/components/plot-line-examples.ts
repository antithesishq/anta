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
      line({
        data,
        y: 'expected',
        color: { light: '#c2410c', dark: '#fdba74' },
        width: 2,
        dash: [7, 5],
        tooltip: ({ y }) => document.createTextNode('Expected: ' + Math.round(Number(y))),
      }),
      line({
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
    series: [line({
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

export function services(): PlotArgs<Node> {
  const data = Array.from({ length: 1201 }, (_, i) => {
    const minute = i / 10
    const surge = Math.exp(-(((minute - 45) / 12) ** 2))
    const backlog = minute < 45 ? 0 : (1 - Math.exp(-(minute - 45) / 8)) * Math.exp(-(minute - 45) / 30)
    return {
      minute,
      search: 65 + surge * 90 + 5 * Math.sin(minute * 1.3),
      checkout: 95 + surge * 170 + backlog * 220 + 7 * Math.sin(minute * 0.9),
      catalog: 40 + surge * 35 + 3 * Math.sin(minute * 1.7),
    }
  })

  return {
    series: [
      line({
        data, x: 'minute', y: 'search',
        color: { light: '#0891b2', dark: '#67e8f9' },
        width: 2,
        tooltip: ({ y }) => document.createTextNode('Search: ' + Math.round(Number(y)) + ' ms'),
      }),
      line({
        data, x: 'minute', y: 'checkout',
        color: { light: '#c2410c', dark: '#fdba74' },
        width: 2, dash: [7, 4],
        tooltip: ({ y }) => document.createTextNode('Checkout: ' + Math.round(Number(y)) + ' ms'),
      }),
      line({
        data, x: 'minute', y: 'catalog',
        color: { light: '#7c3aed', dark: '#c4b5fd' },
        width: 2, dash: [2, 4],
        tooltip: ({ y }) => document.createTextNode('Catalog: ' + Math.round(Number(y)) + ' ms'),
      }),
    ],
    height: 260,
    margin: { top: 12, right: 12, bottom: 40, left: 44 },
    axis: { x: { min: 0, max: 120, label: 'Minutes' }, y: { min: 0, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: { x: false, y: true },
    border: false,
    zoom_pan: true,
  }
}

export function contours(): PlotArgs<Node> {
  const resolution = 64
  const terrain = Array.from({ length: (resolution + 1) ** 2 }, (_, index) => {
    const x = index % (resolution + 1) / resolution * 100
    const y = Math.floor(index / (resolution + 1)) / resolution * 100
    const ridgeX = x - 40 + 7 * Math.sin(y / 17)
    const height = 180 + 3 * x + 2 * y
      + 1250 * Math.exp(-(ridgeX ** 2 / 750 + (y - 48) ** 2 / 1500))
      + 550 * Math.exp(-((x - 83) ** 2 / 150 + (y - 22) ** 2 / 220))
      + 450 * Math.exp(-((x - 78) ** 2 / 200 + (y - 84) ** 2 / 140))
    return { x, y, height }
  })
  const contours = []
  for (let elevation = 300; elevation <= 1700; elevation += 100) {
    const edges = new Map<string, { point: { x: number, y: number, elevation: number }, neighbors: string[] }>()
    const connect = (triangle: number[]) => {
      const crossings = []
      for (let side = 0; side < 3; side++) {
        const a = triangle[side]
        const b = triangle[(side + 1) % 3]
        const start = terrain[a]
        const end = terrain[b]
        if ((start.height < elevation) === (end.height < elevation)) continue
        const key = Math.min(a, b) + ':' + Math.max(a, b)
        if (!edges.has(key)) {
          const t = (elevation - start.height) / (end.height - start.height)
          edges.set(key, {
            point: { x: start.x + t * (end.x - start.x), y: start.y + t * (end.y - start.y), elevation },
            neighbors: [],
          })
        }
        crossings.push(key)
      }
      if (crossings.length === 2) {
        edges.get(crossings[0])!.neighbors.push(crossings[1])
        edges.get(crossings[1])!.neighbors.push(crossings[0])
      }
    }
    for (let y = 0; y < resolution; y++) {
      for (let x = 0; x < resolution; x++) {
        const a = y * (resolution + 1) + x
        const b = a + 1
        const c = a + resolution + 1
        const d = c + 1
        connect([a, b, d])
        connect([a, d, c])
      }
    }
    const visited = new Set<string>()
    const starts = [...edges.keys()].sort((a, b) => edges.get(a)!.neighbors.length - edges.get(b)!.neighbors.length)
    for (const start of starts) {
      if (visited.has(start)) continue
      const data = []
      let current = start
      while (!visited.has(current)) {
        visited.add(current)
        const edge = edges.get(current)!
        data.push(edge.point)
        const next = edge.neighbors.find(key => !visited.has(key))
        if (next === undefined) {
          if (edge.neighbors.includes(start)) data.push(edges.get(start)!.point)
          break
        }
        current = next
      }
      const hue = 260 - (elevation - 300) / 1400 * 260
      contours.push({
        data,
        color: { light: 'hsl(' + hue + ' 85% 40%)', dark: 'hsl(' + hue + ' 90% 68%)' },
      })
    }
  }

  return {
    series: contours.map(({ data, color }) => line({
      data,
      color,
      width: 1.5,
      tooltip: ({ row }) => document.createTextNode('Elevation: ' + row.elevation + ' m'),
    })),
    height: 260,
    margin: { top: 12, right: 12, bottom: 28, left: 32 },
    axis: { x: { min: 0, max: 100, label: '' }, y: { min: 0, max: 100, label: '' } },
    background: { light: '#ffffff', dark: '#151b28' },
    chrome_color: { light: '#e2e8f0', dark: '#334155' },
    grid: false,
    border: false,
    zoom_pan: true,
  }
}

export const lineExamples = { comparison, markers, services, contours }
