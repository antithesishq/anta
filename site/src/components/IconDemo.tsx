import { useEffect, useState, useMemo } from 'preact/hooks'
import { Icon, ICON_SHAPES, ICON_SYNONYMS } from '@antadesign/anta'

export default function IconDemo() {
  useEffect(() => {
    import('@antadesign/anta/elements')
  }, [])

  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const matches = q
      ? ICON_SHAPES.filter((shape) => {
          if (shape.toLowerCase().includes(q)) return true
          const syns = ICON_SYNONYMS[shape] ?? []
          return syns.some((s) => s.toLowerCase().includes(q))
        })
      : ICON_SHAPES
    // Group: plain icons first, then -disk variants, then -logo variants.
    // Array.prototype.sort is stable, so alphabetical order within each
    // group is preserved from ICON_SHAPES.
    const groupOf = (s: string) =>
      s.endsWith('-logo') ? 2 : s.endsWith('-disk') ? 1 : 0
    return [...matches].sort((a, b) => groupOf(a) - groupOf(b))
  }, [query])

  return (
    <div>
      <input
        type="search"
        value={query}
        onInput={(e) => setQuery((e.target as HTMLInputElement).value)}
        placeholder={`Search ${ICON_SHAPES.length} icons by name or synonym…`}
        class="iconFilter"
      />
      {filtered.length === 0 ? (
        <p class="demoLabel" style={{ padding: '24px 0' }}>No icons match “{query}”.</p>
      ) : (
        <div class="demoGrid">
          {filtered.map((s) => (
            <div key={s} class="demoCell copyable">
              <Icon shape={s} size={20} />
              <span class="demoLabel">{s}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
