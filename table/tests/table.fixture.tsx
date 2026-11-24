// Mounts tables for the browser tests and the manual demo: `window.mountTable(options)`.
import '@antadesign/anta/tokens.css'
import '@antadesign/anta/bundle.css'
import '@antadesign/anta/bundle'
import '@antadesign/virtual-scroll/bundle'
import '../src/entries/elements/a-table'
import { createRoot, type Root } from 'react-dom/client'
import { useEffect, useState } from 'react'
import { VirtualScroll } from '@antadesign/virtual-scroll'
import { Table, type TableColumn, type TableProps } from '../src/entries/index'

type Row = { id: string, group: string, score: number, ok: boolean, note: string, owner: string }

const GROUPS = ['alpha', 'beta', 'gamma', 'delta']
export function makeRows(count: number): Row[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `row-${String(i).padStart(5, '0')}`,
    group: GROUPS[i % 4],
    score: (i * 37) % 1000,
    ok: i % 5 !== 0,
    note: i % 7 === 0 ? 'A longer note that wraps over a few lines when the column is narrow enough to need it.' : `note ${i % 97}`,
    owner: `owner-${i % 13}`,
  }))
}

type Options = {
  mode: 'virtual' | 'plain'
  count: number
  pins?: boolean
  wide?: boolean
  selectable?: boolean
  /** Append a row every 50ms. */
  stream?: boolean
  props?: Partial<TableProps<Row>>
  container?: Record<string, string>
}

let root: Root | undefined

function Selectable(props: TableProps<Row>) {
  const [selected, setSelected] = useState<number[]>([])
  ;(window as unknown as { selected: () => number[] }).selected = () => selected
  return <Table {...props} selected={selected} onRowSelect={next => setSelected(next)} />
}

function Growing(props: TableProps<Row>) {
  const [count, setCount] = useState(props.data.length)
  useEffect(() => {
    const id = setInterval(() => setCount(n => n + 1), 50)
    return () => clearInterval(id)
  }, [])
  return <Table {...props} data={makeRows(count)} />
}

function mountTable(options: Options) {
  const mount = document.getElementById('mount')!
  root?.unmount()
  mount.replaceChildren()
  const host = document.createElement('div')
  Object.assign(host.style, options.container ?? {})
  mount.append(host)
  root = createRoot(host)
  const columns: Record<string, TableColumn<Row>> | undefined = options.pins || options.wide ? {
    id: { pin: options.pins ? 'left' : undefined, width: 130 },
    group: { width: 110 },
    score: { width: 110 },
    note: { minWidth: options.wide ? 900 : 200 },
    owner: { width: 140 },
    ok: { pin: options.pins ? 'right' : undefined, width: 90 },
  } : undefined
  const props: TableProps<Row> = {
    data: makeRows(options.count),
    columns,
    virtualizer: options.mode === 'virtual' ? VirtualScroll : undefined,
    ...options.props,
  }
  root.render(options.selectable ? <Selectable {...props} /> : options.stream ? <Growing {...props} /> : <Table {...props} />)
}

Object.assign(window, { mountTable, makeRows })
