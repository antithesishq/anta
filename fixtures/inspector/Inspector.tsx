import { useLayoutEffect, useState } from 'react'
import { Inspector as AntaInspector } from '@antadesign/anta'
import { inspectorKinds } from './kinds'

declare global {
  interface Window {
    __antaInspector?: { id: string; expandDepth: number; layout: 'block' | 'inline' }
  }
}

// Test output in miniature: nested results, a Map, a long array that shows in ranges, a
// multiline string, a cycle, and the docs walkthrough's Sets, symbols, built-ins, and classes.
function sample() {
  const value: Record<string, unknown> = {
    name: 'run',
    results: [{ id: 't1', ok: true, error: null }, { id: 't2', ok: false, error: { message: 'mismatch', retries: 3 } }],
    byKey: new Map<string, unknown>([['api-1', ['ready', 'leader elected']], ['db', []]]),
    coverage: Array.from({ length: 12 }, (_, i) => i / 10),
    log: 'first line\nsecond line',
    kinds: {
      ...inspectorKinds.collections.values(),
      ...inspectorKinds.symbols.values(),
      ...inspectorKinds.builtins.values(),
      ...inspectorKinds.classes.values(),
    },
  }
  value.self = value
  return value
}

export function Inspector({ id, expandDepth, layout }: { id: string; expandDepth: number; layout: 'block' | 'inline' }) {
  const [value] = useState(sample)

  useLayoutEffect(() => {
    window.__antaInspector = { id, expandDepth, layout }
    return () => { delete window.__antaInspector }
  }, [id, expandDepth, layout])

  return <AntaInspector id={id} value={value} expandDepth={expandDepth} layout={layout} chunkSize={5} aria-label="Fixture value" />
}
