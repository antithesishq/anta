import { useLayoutEffect, useState } from 'react'
import { Plot as AntaPlot, scatter, type ViewportChange } from '@antadesign/plot'

type PlotRecord = { id: string; viewport: ViewportChange | null; zoomPan: boolean; height: number; points: { x: number; y: number }[] }
declare global {
  interface Window {
    __antaPlot?: PlotRecord
    __antaPlotLateCallback?: { id: string; activeId: string | null }
  }
}

export function Plot({ id, zoomPan = true, height = 240, points = [{ x: 1, y: 2 }, { x: 2, y: 5 }, { x: 3, y: 3 }] }: {
  id: string; zoomPan?: boolean; height?: number; points?: { x: number; y: number }[]
}) {
  const [record] = useState<PlotRecord>(() => ({ id, viewport: null, zoomPan, height, points }))
  useLayoutEffect(() => {
    window.__antaPlot = record
    return () => { delete window.__antaPlot }
  }, [id])
  useLayoutEffect(() => { Object.assign(record, { zoomPan, height, points }) }, [zoomPan, height, points])

  return <section id={id}>
    <AntaPlot plotArgs={{ height, series: [scatter({ data: points })],
      zoom_pan: zoomPan,
      on_viewport_change: viewport => {
        record.viewport = viewport
        const activeId = window.__antaPlot?.id ?? null
        if (activeId !== id) window.__antaPlotLateCallback ??= { id, activeId }
      } }} />
  </section>
}
