import { useEffect, useRef, useState } from 'preact/hooks'
import chroma from 'chroma-js'
import {
  Tabs,
  Title,
  Text,
  Button,
  ButtonCopy,
  Tag,
  Checkbox,
  RadioGroup,
  Expander,
  Icon,
  Input,
  InputDate,
  MenuItem,
  Progress,
  Tooltip,
} from '@antadesign/anta'
import ColorPicker from './ColorPicker'
import styles from './ThemingLab.module.css'
import {
  SPECS,
  TONES,
  TONE_LABEL,
  SEED,
  EL_SELECTOR,
  groupsOf,
  defaults,
  type ComponentSpec,
  type Tone,
  type Vals,
  type VarDef,
} from './theming-lab-formulas'

/**
 * Theming lab. Anta's default palette is itself seed-derived — tokens.css and
 * every component compute their colours from six tone seeds via
 * `oklch(from var(--anta-seed-*) …)`. This page shows, for each toned component,
 * the shipped **Default** next to a **Custom** preview driven by the seed picker
 * (and the formula's constants, exposed as live inputs grouped by priority),
 * plus the resolved CSS.
 *
 * At the default seed the two columns are identical — Custom reproduces the
 * Default. Change the seed (or a constant) and only Custom moves, so you can see
 * exactly what overriding `--anta-seed-{tone}` (or a formula knob) does to the
 * whole tone. The Default column reads the LIVE shipped tokens/components, so it
 * always reflects what ships.
 *
 * One page, six tone panels (Neutral first), all mounted — the tone tabs only
 * toggle visibility, so each panel keeps its own per-theme edits. The seed picker
 * sits with the tabs in the sticky header, so both stay pinned while scrolling.
 * The Custom preview is driven by an un-layered `<style>` (beating `@layer anta`)
 * scoped to `.tl-gen-{tone}-{id}`; at the default seed it reproduces Anta's own
 * output, so only an edit makes it diverge. Follows the page theme (`.dark` on
 * the document element) — toggle light/dark to compare the other mode.
 */

const usesStatus = (id: string) => id === 'input'

/** Four rows for the menu-item preview; the second is the selected one. */
const MENU_ITEMS: { icon: 'book-open' | 'chat' | 'file' | 'edit'; label: string; kbd?: string; sel?: boolean; hint?: string }[] = [
  { icon: 'book-open', label: 'Overview', hint: 'Project summary' },
  { icon: 'chat', label: 'Comments', sel: true, hint: '3 unread' },
  { icon: 'file', label: 'Files', kbd: '⌘S' },
  { icon: 'edit', label: 'Rename' },
]

const PRIORITIES = ['primary', 'secondary', 'tertiary', 'quaternary'] as const

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

/* Lab edits survive navigation via sessionStorage (the island unmounts on any
 * client-side nav; transition:persist can't help since no other page renders
 * it). Each atom restores from the snapshot in a mount effect and writes back
 * on change. Restore in an effect, never the useState initializer: Preact
 * skips attribute patching during hydration, so initializer state desyncs
 * from the SSR DOM. Declare the restore effect before the persist effects so
 * it reads the snapshot before their first run writes defaults into it.
 * Stored values merge over computed defaults, so an old snapshot still yields
 * complete state. */
const LAB_KEY = 'anta-theming-lab'

type LabPanelVals = { vLight: Record<string, Vals>; vDark: Record<string, Vals> }
type LabSnapshot = {
  active?: Tone
  seeds?: Partial<Record<Tone, string>>
  openMap?: Record<string, boolean>
  surfaceBg?: number
  surfaceBorder?: number
  panels?: Partial<Record<Tone, LabPanelVals>>
}

const labSnapshot: LabSnapshot = (() => {
  try {
    if (typeof sessionStorage === 'undefined') return {}
    return JSON.parse(sessionStorage.getItem(LAB_KEY) ?? '{}')
  } catch {
    return {}
  }
})()

function persistLab<K extends keyof LabSnapshot>(key: K, value: LabSnapshot[K]) {
  labSnapshot[key] = value
  try {
    sessionStorage.setItem(LAB_KEY, JSON.stringify(labSnapshot))
  } catch {}
}

const persistPanel = (tone: Tone, vals: LabPanelVals) =>
  persistLab('panels', { ...labSnapshot.panels, [tone]: vals })

/** Format a CSS color string as `oklch(l c h)` (with ` / a` when translucent,
 *  `transparent` when fully clear) via chroma-js; '' on parse failure. Shared by
 *  the surface swatch, type samples, and button/tag resting readouts. */
function toOklch(color: string): string {
  try {
    const px = chroma(color)
    const a = px.alpha()
    if (a === 0) return 'transparent'
    const [l, c, h] = px.oklch()
    const triple = `${l.toFixed(3)} ${c.toFixed(3)} ${(Number.isNaN(h) ? 0 : h).toFixed(1)}`
    return a < 1 ? `oklch(${triple} / ${a.toFixed(2)})` : `oklch(${triple})`
  } catch {
    return ''
  }
}

/** Re-read trigger for the live "Default" readouts. `ThemeSwitcher` dispatches
 *  `anta-palette-change` when the opt-in theme-anta palette toggles, repainting the
 *  components without touching `tone` / `isDark`. Bump a counter on the event and
 *  fold it into each readout effect's deps so the oklch labels re-read the new
 *  tokens (mirrors `SwatchGrid`, which listens for the same event). */
function usePaletteRev() {
  const [rev, setRev] = useState(0)
  useEffect(() => {
    const bump = () => setRev((r) => r + 1)
    window.addEventListener('anta-palette-change', bump)
    return () => window.removeEventListener('anta-palette-change', bump)
  }, [])
  return rev
}

/** One hand-tuned Title/Text priority sample, labelled with its priority and the
 *  resolved oklch of its colour. The colour is Anta's real `--text-*` token (not
 *  the formula), so it's read from the live host's computed `color` — via a
 *  `display:contents` wrapper (the wrappers don't forward a DOM ref), re-read
 *  when tone or theme changes. */
function TypeSample({
  kind,
  priority,
  tone,
  isDark,
}: {
  kind: 'title' | 'text'
  priority: 'primary' | 'secondary' | 'tertiary' | 'quaternary'
  tone: Tone | undefined
  isDark: boolean
}) {
  const hostRef = useRef<HTMLSpanElement>(null)
  const [okl, setOkl] = useState('')
  const rev = usePaletteRev()
  useEffect(() => {
    const host = hostRef.current?.firstElementChild as HTMLElement | null
    if (host) setOkl(toOklch(getComputedStyle(host).color))
  }, [tone, isDark, priority, rev])

  const content = (
    <>
      {cap(priority)}
      {okl ? <span className={styles.oklch}>{okl}</span> : null}
    </>
  )
  return (
    <span ref={hostRef} style={{ display: 'contents' }}>
      {kind === 'title' ? (
        <Title level={4} priority={priority} tone={tone}>
          {content}
        </Title>
      ) : (
        <Text priority={priority} tone={tone}>
          {content}
        </Text>
      )}
    </span>
  )
}

/** Hand-tuned Button/Tag samples plus a per-priority readout of the resolved
 *  resting background + text colour in oklch. Both elements are light-DOM hosts
 *  that paint `background`/`color` directly (`--button-*` / `--tag-*` tokens), so
 *  the colours are read from each host's computed style, re-read on tone/theme
 *  change. */
function RestingSamples({
  kind,
  tone,
  isDark,
}: {
  kind: 'button' | 'tag'
  tone: Tone | undefined
  isDark: boolean
}) {
  const priorities = kind === 'button' ? (['primary', 'secondary', 'tertiary', 'quaternary'] as const) : (['primary', 'secondary', 'tertiary'] as const)
  const rowRef = useRef<HTMLDivElement>(null)
  const [rows, setRows] = useState<{ p: string; bg: string; fg: string }[]>([])
  const rev = usePaletteRev()
  useEffect(() => {
    const el = rowRef.current
    if (!el) return
    const nodes = Array.from(el.querySelectorAll(kind === 'button' ? 'a-button' : 'a-tag')) as HTMLElement[]
    setRows(
      nodes.map((n, i) => {
        const cs = getComputedStyle(n)
        return { p: priorities[i], bg: toOklch(cs.backgroundColor), fg: toOklch(cs.color) }
      }),
    )
  }, [tone, isDark, rev])

  return (
    <div className={styles.col}>
      <div ref={rowRef} className={styles.row}>
        {priorities.map((p) =>
          kind === 'button' ? (
            <Button key={p} priority={p as any} tone={tone} label={p} />
          ) : (
            <Tag key={p} priority={p as any} tone={tone}>
              Tag · {p}
            </Tag>
          ),
        )}
      </div>
      <div className={styles.restingList}>
        {rows.map((r) => (
          <div key={r.p} className={styles.restingRow}>
            <code>{cap(r.p)}</code>
            {r.bg ? <span className={styles.oklch}>bg {r.bg}</span> : null}
            {r.fg ? <span className={styles.oklch}>text {r.fg}</span> : null}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Input + InputDate samples, with the resolved border colour read from the host's
 *  `--input-border` and shown in oklch. Hand-tuned statuses set a literal (resolves
 *  cleanly); the generative side sets a relative `oklch(from …)` that chroma can't
 *  parse, so the readout naturally appears only under the hand-tuned reference. */
function InputSamples({ status, isDark }: { status: string | undefined; isDark: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const [border, setBorder] = useState('')
  const rev = usePaletteRev()
  useEffect(() => {
    const host = ref.current?.querySelector('a-input') as HTMLElement | null
    setBorder(host ? toOklch(getComputedStyle(host).getPropertyValue('--input-border')) : '')
  }, [status, isDark, rev])
  return (
    <div className={styles.col}>
      <div ref={ref} className={styles.col}>
        <Input label="Text input" placeholder="Type…" status={status as any} hint="Helper text under the field" />
        <InputDate label="Date" defaultValue="2026-06-15" status={status as any} hint="Pick a date" />
      </div>
      {border ? (
        <div className={styles.restingRow}>
          <code>border</code>
          <span className={styles.oklch}>{border}</span>
        </div>
      ) : null}
    </div>
  )
}

/** The hand-tuned reference's tone attribute, as a code label. */
function refLabel(id: string, tone: Tone) {
  if (tone === 'neutral') return <code>default</code>
  return (
    <code>
      {usesStatus(id) ? 'status' : 'tone'}="{tone}"
    </code>
  )
}

/** The samples for one component, in either the hand-tuned (`ref`) or generative
 *  (`gen`) mode. `gen` gets the seed; `ref` the named tone (or the neutral default).
 *  The generative container class is applied by `Block`. */
function preview(spec: ComponentSpec, mode: 'ref' | 'gen', tone: Tone, seed: string, isDark: boolean) {
  const ref = mode === 'ref'
  const named = tone === 'neutral' ? undefined : tone
  const toneVal = ref ? named : seed
  const selVal = ref ? named : seed
  // Both sides carry the status so the generative input shows the same 1px status
  // treatment as the hand-tuned reference — only the border colour differs (the
  // injected generative `--input-border` vs the hand-tuned status literal). Without
  // this the generative input was a plain 0.5px field and read far fainter.
  const statusVal = named

  switch (spec.id) {
    // Title + Text share the `--text-1..5` role scale, so one section previews
    // both. The generative samples render UNTONED so they read the seed-derived
    // tokens injected on the container; the hand-tuned samples are toned and read
    // Anta's real `--text-*-{tone}` (with the resolved oklch label).
    case 'text':
      return (
        <div className={styles.col}>
          {PRIORITIES.map((p) =>
            ref ? (
              <TypeSample key={`ti-${p}`} kind="title" priority={p} tone={named} isDark={isDark} />
            ) : (
              <Title key={`ti-${p}`} level={4} priority={p}>
                Title · {p}
              </Title>
            ),
          )}
          {PRIORITIES.map((p) =>
            ref ? (
              <TypeSample key={`tx-${p}`} kind="text" priority={p} tone={named} isDark={isDark} />
            ) : (
              <Text key={`tx-${p}`} priority={p}>
                The quick brown fox — {p}
              </Text>
            ),
          )}
        </div>
      )

    // Hand-tuned lists each priority's resolved resting background + text oklch;
    // the generative preview stays the plain sample row (seed-driven).
    case 'button':
      return ref ? (
        <RestingSamples kind="button" tone={named} isDark={isDark} />
      ) : (
        <div className={styles.row}>
          {(['primary', 'secondary', 'tertiary', 'quaternary'] as const).map((p) => (
            // priority is a discriminated union on Button; the value is dynamic here.
            <Button key={p} priority={p as any} tone={toneVal} label={p} />
          ))}
        </div>
      )

    case 'tag':
      return ref ? (
        <RestingSamples kind="tag" tone={named} isDark={isDark} />
      ) : (
        <div className={styles.row}>
          {(['primary', 'secondary', 'tertiary'] as const).map((p) => (
            <Tag key={p} priority={p} tone={toneVal}>
              Tag · {p}
            </Tag>
          ))}
        </div>
      )

    case 'tabs':
      return (
        <div className={styles.col}>
          {(['primary', 'secondary', 'tertiary'] as const).map((p) => (
            <Tabs
              key={p}
              priority={p}
              tone={toneVal}
              label={`${p} tabs`}
              defaultValue="b"
              options={[
                { value: 'a', label: 'Overview' },
                { value: 'b', label: 'Activity' },
                { value: 'c', label: 'Settings' },
              ]}
            />
          ))}
        </div>
      )

    case 'checkbox':
      return (
        <div className={styles.col}>
          <Checkbox defaultChecked toneSelected={selVal} label="On · toneSelected" />
          <Checkbox tone={toneVal} label="Off · tone" />
        </div>
      )

    case 'radio':
      return (
        <RadioGroup
          name={`tl-radio-${tone}-${mode}`}
          toneSelected={selVal}
          defaultValue="b"
          options={[
            { value: 'a', label: 'One' },
            { value: 'b', label: 'Two' },
            { value: 'c', label: 'Three' },
          ]}
        />
      )

    case 'expander':
      return (
        <div className={styles.col}>
          {(['primary', 'secondary', 'tertiary'] as const).map((p) => (
            <Expander key={p} priority={p} tone={toneVal} title={`${p} expander`}>
              <Text priority="tertiary" size="small">
                Body of the {p} expander.
              </Text>
            </Expander>
          ))}
        </div>
      )

    case 'input':
      return <InputSamples status={statusVal} isDark={isDark} />


    case 'menuitem':
      return (
        <div className={styles.menuSurface} role="menu" aria-label={`${mode} menu`}>
          {MENU_ITEMS.map((it, i) => (
            <MenuItem key={i} icon={it.icon} label={it.label} hint={it.hint} kbd={it.kbd} selected={it.sel} tone={toneVal} />
          ))}
        </div>
      )

    case 'progress':
      return (
        <div className={styles.col}>
          <Progress value={72} tone={toneVal} label="Uploading files" hint="5 of 7" />
          <Progress value={40} tone={toneVal} round label="Syncing" hint="40%" />
        </div>
      )

    default:
      return null
  }
}

function VarInput({ spec, d, v, onVar }: { spec: ComponentSpec; d: VarDef; v: Vals; onVar: BlockProps['onVar'] }) {
  // The committed value is a number, but the field holds a raw string draft so a
  // fractional oklch value types cleanly — "0.", "0.5", "0.50" all survive (a
  // type="number" input, or rendering String(number) back, would eat them). onVar
  // writes parseFloat(draft) back on every keystroke, so `stored` changes as you
  // type; reseed only when it diverges in VALUE (reset, paste, tone switch), never
  // mid-edit — else backspacing "0.5" to "0." would snap the draft to "0".
  const stored = String(v[d.key])
  const [draft, setDraft] = useState(stored)
  const [seen, setSeen] = useState(stored)
  if (seen !== stored) {
    setSeen(stored)
    if (parseFloat(draft) !== parseFloat(stored)) setDraft(stored)
  }
  return (
    <div className={styles.var}>
      <Input
        type="text"
        inputMode="decimal"
        size="small"
        label={d.label}
        value={draft}
        onValueChange={(_e: any, a: any) => {
          setDraft(a.value)
          onVar(spec.id, d.key, a.value)
        }}
      />
      {d.tip ? <Tooltip>{d.tip}</Tooltip> : null}
    </div>
  )
}

/** Copy / paste the current values of one variable group as JSON, so a set of
 *  tunings can be shared (e.g. with a designer) and applied in one click. Copy
 *  serializes just this group's keys at the current theme; paste reads the
 *  clipboard, and `onVar` ignores any key that isn't a finite number. */
function GroupActions({
  specId,
  vars,
  v,
  onVar,
}: {
  specId: string
  vars: VarDef[]
  v: Vals
  onVar: BlockProps['onVar']
}) {
  const json = JSON.stringify(Object.fromEntries(vars.map((d) => [d.key, v[d.key]])), null, 2)

  const onPaste = async () => {
    try {
      const obj = JSON.parse(await navigator.clipboard.readText())
      if (obj && typeof obj === 'object')
        for (const d of vars) if (d.key in obj) onVar(specId, d.key, String(obj[d.key]))
    } catch {
      // Invalid JSON, denied clipboard permission, or an empty clipboard — no-op.
    }
  }

  return (
    <span className={styles.groupActions}>
      <ButtonCopy copy={json} size="small" priority="tertiary" aria-label="Copy values as JSON" />
      <Button
        size="small"
        priority="tertiary"
        onClick={onPaste}
        aria-label="Paste values from JSON"
      >
        <Icon shape="clipboard-paste" />
      </Button>
    </span>
  )
}

/** Specs whose colours are role tokens (text, bg, border scales), not bespoke
 *  per-component values. Their generative preview gets the Text + Surface scales
 *  injected on its container, so `var(--text-1)` etc. resolve to the tuned scale
 *  and follow the Text / Background & Borders panels live. */
const ROLE_TOKEN_SPECS = new Set(['tabs', 'tag', 'menuitem', 'expander', 'progress'])
const TEXT_SPEC = SPECS.find((s) => s.id === 'text')!
const SURFACE_SPEC = SPECS.find((s) => s.id === 'surface')!

interface BlockProps {
  spec: ComponentSpec
  tone: Tone
  seed: string
  isDark: boolean
  vLight: Vals
  vDark: Vals
  /** Every spec's current values, keyed by id — a role-token component injects the
   *  Text + Surface scales (`allV*.text` / `allV*.surface`) on its own container. */
  allVLight: Record<string, Vals>
  allVDark: Record<string, Vals>
  onVar: (id: string, key: string, value: string) => void
  /** Shared open state for this section's expanders, keyed `${spec.id}:${label}`,
   *  so the same expander tracks across every tone panel. */
  openMap: Record<string, boolean>
  onExpanderToggle: (key: string, next: boolean) => void
}

function Block({ spec, tone, seed, isDark, vLight, vDark, allVLight, allVDark, onVar, openMap, onExpanderToggle }: BlockProps) {
  const v = isDark ? vDark : vLight
  const el = EL_SELECTOR[spec.id]
  const genClass = `tl-gen-${tone}-${spec.id}`
  // A role-token spec (e.g. Text → `--text-*`) emits tokens the sample components
  // inherit: inject on the container and display at `:root`. Others style the
  // element directly, so scope the selector to the element inside the container.
  const injectSel = spec.tokens ? `.${genClass}` : `.${genClass} ${el}`
  const display = spec.css(spec.tokens ? ':root' : el, seed, v)
  // A role-token component resolves --text-*/--bg-*/--border-* from the Text +
  // Surface scales, injected on the ELEMENT (not the container) so only the
  // component's own fills/text tint per tone — the preview backdrop keeps the
  // page's real (neutral) tokens. Tuning the Text/Surface panels updates it live.
  const rolePreamble = ROLE_TOKEN_SPECS.has(spec.id)
    ? SURFACE_SPEC.css(injectSel, seed, allVLight.surface) +
      '\n' + TEXT_SPEC.css(injectSel, seed, allVLight.text) +
      '\n' + SURFACE_SPEC.css(`.dark ${injectSel}`, seed, allVDark.surface) +
      '\n' + TEXT_SPEC.css(`.dark ${injectSel}`, seed, allVDark.text) + '\n'
    : ''
  const inject =
    rolePreamble +
    spec.css(injectSel, seed, vLight) +
    '\n' +
    spec.css(`.dark ${injectSel}`, seed, vDark)

  return (
    <section className={styles.block}>
      {/* LEFT — previews */}
      <div className={styles.previews}>
        <div className={styles.preview}>
          <p className={styles.previewLabel}>Default · {refLabel(spec.id, tone)}</p>
          {preview(spec, 'ref', tone, seed, isDark)}
        </div>
        <div className={`${styles.preview} ${genClass}`}>
          <p className={styles.previewLabel}>
            Custom · <code>{seed}</code>
          </p>
          {preview(spec, 'gen', tone, seed, isDark)}
          <style dangerouslySetInnerHTML={{ __html: inject }} />
        </div>
      </div>

      {/* RIGHT — header, formula variables (per group), CSS output */}
      <div className={styles.controls}>
        <Title level={2}>{spec.title}</Title>
        <p className={styles.blurb}>{spec.blurb}</p>

        {groupsOf(spec).map((g) => {
          const key = `${spec.id}:${g.label}`
          return (
            <Expander
              key={g.label}
              title={`${g.label} variables`}
              priority="tertiary"
              outdent
              open={!!openMap[key]}
              onStateChange={(_e, { next }) => onExpanderToggle(key, next)}
              actions={<GroupActions specId={spec.id} vars={g.vars} v={v} onVar={onVar} />}
            >
              {g.note ? <p className={styles.groupNote}>{g.note}</p> : null}
              <div className={styles.varGrid}>
                {g.vars.map((d) => (
                  <VarInput key={d.key} spec={spec} d={d} v={v} onVar={onVar} />
                ))}
              </div>
            </Expander>
          )
        })}

        <Expander
          title="CSS output"
          priority="tertiary"
          outdent
          open={!!openMap[`${spec.id}:css`]}
          onStateChange={(_e, { next }) => onExpanderToggle(`${spec.id}:css`, next)}
        >
          <pre className={styles.pre}>{display}</pre>
        </Expander>
      </div>
    </section>
  )
}

/** The "Background & Borders" block. Same left/right layout as `Block`, but the
 *  preview is a single empty swatch driven by Background / Border tabs above both
 *  previews: the top swatch reads Anta's real role tokens (with the current tone),
 *  the bottom reads the seed-derived tokens injected onto it. One pair of tab
 *  selections drives both, so the two read the same bg×border combination. */
interface SurfaceBlockProps extends BlockProps {
  /** bg-N / border-N selection, lifted so it persists across tone switches. */
  bg: number
  border: number
  onBg: (n: number) => void
  onBorder: (n: number) => void
}

function SurfaceBlock({ spec, tone, seed, isDark, vLight, vDark, onVar, openMap, onExpanderToggle, bg, border, onBg, onBorder }: SurfaceBlockProps) {
  const v = isDark ? vDark : vLight
  const genClass = `tl-gen-${tone}-surface`

  // Inject the seed-derived --bg-*/--border-* onto the GEN swatch only (not the
  // card — the card keeps its own --bg-2 chrome). Both themes, un-layered.
  const swatchSel = `.${genClass} .${styles.surfaceSwatch}`
  const inject = spec.css(swatchSel, seed, vLight) + '\n' + spec.css(`.dark ${swatchSel}`, seed, vDark)
  const display = spec.css(':root', seed, v)

  // Anta side: named tones use the -{tone} token variant; neutral has none.
  // bg-1 is neutral-only (no toned variant), so it never takes the suffix.
  const suffix = tone === 'neutral' ? '' : `-${tone}`
  const refBg = `var(--bg-${bg}${bg === 1 ? '' : suffix})`
  const refBorder = `var(--border-${border}${suffix})`

  const opts = (base: string) => [1, 2, 3, 4, 5].map((n) => ({ value: `${base}-${n}`, label: `${base}-${n}` }))
  const pick = (set: (n: number) => void) => (_e: any, { next }: { next: string | null }) => {
    if (next) set(Number(next.split('-').pop()))
  }

  // Resolve the hand-tuned swatch's actual background / border colour (the token
  // computed for the current theme) and show it as oklch via chroma-js. Read from
  // the live element so it reflects whatever `--bg-*` / `--border-*` resolves to.
  const swatchRef = useRef<HTMLDivElement>(null)
  const [okl, setOkl] = useState({ bg: '', border: '' })
  const rev = usePaletteRev()
  useEffect(() => {
    const el = swatchRef.current
    if (!el) return
    const cs = getComputedStyle(el)
    setOkl({ bg: toOklch(cs.backgroundColor), border: toOklch(cs.borderTopColor) })
  }, [refBg, refBorder, isDark, rev])

  return (
    <section className={styles.block}>
      {/* LEFT — tabs, then the two swatch previews */}
      <div className={styles.previews}>
        <div className={styles.preview}>
          <div className={styles.surfaceTabs}>
            <Tabs value={`bg-${bg}`} label="Background" size="small" options={opts('bg')} onStateChange={pick(onBg)} />
            <Tabs value={`border-${border}`} label="Border" size="small" options={opts('border')} onStateChange={pick(onBorder)} />
          </div>
          <p className={styles.previewLabel}>
            Default
            <br />
            <code>--bg-{bg}{bg === 1 ? '' : suffix}</code>
            {okl.bg ? <span className={styles.oklch}>{okl.bg}</span> : null}
            <br />
            <code>--border-{border}{suffix}</code>
            {okl.border ? <span className={styles.oklch}>{okl.border}</span> : null}
          </p>
          <div ref={swatchRef} className={styles.surfaceSwatch} style={{ background: refBg, borderColor: refBorder }} />
        </div>
        <div className={`${styles.preview} ${genClass}`}>
          <p className={styles.previewLabel}>
            Custom · <code>{seed}</code>
          </p>
          <div className={styles.surfaceSwatch} style={{ background: `var(--bg-${bg})`, borderColor: `var(--border-${border})` }} />
          <style dangerouslySetInnerHTML={{ __html: inject }} />
        </div>
      </div>

      {/* RIGHT — header, formula variables (per group), CSS output */}
      <div className={styles.controls}>
        <Title level={2}>{spec.title}</Title>
        <p className={styles.blurb}>{spec.blurb}</p>

        {groupsOf(spec).map((g) => {
          const key = `${spec.id}:${g.label}`
          return (
            <Expander
              key={g.label}
              title={`${g.label} variables`}
              priority="tertiary"
              outdent
              open={!!openMap[key]}
              onStateChange={(_e, { next }) => onExpanderToggle(key, next)}
              actions={<GroupActions specId={spec.id} vars={g.vars} v={v} onVar={onVar} />}
            >
              {g.note ? <p className={styles.groupNote}>{g.note}</p> : null}
              {(() => {
                // Two aligned rows: L channels on top, C beneath. Each input's
                // grid column is its N index (bg-2/border-2 → col 2), so a C sits
                // directly under its L; the row is 1 for L, 2 for C.
                const cols = Math.max(...g.vars.map((d) => Number(d.key.match(/\d+/)?.[0] ?? 1)))
                return (
                  <div className={styles.varRows} style={{ gridTemplateColumns: `repeat(${cols}, 88px)` }}>
                    {g.vars.map((d) => {
                      const col = Number(d.key.match(/\d+/)?.[0] ?? 1)
                      const row = d.key.endsWith('C') ? 2 : 1
                      return (
                        <div key={d.key} style={{ gridColumn: col, gridRow: row }}>
                          <VarInput spec={spec} d={d} v={v} onVar={onVar} />
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
            </Expander>
          )
        })}

        <Expander
          title="CSS output"
          priority="tertiary"
          outdent
          open={!!openMap[`${spec.id}:css`]}
          onStateChange={(_e, { next }) => onExpanderToggle(`${spec.id}:css`, next)}
        >
          <pre className={styles.pre}>{display}</pre>
        </Expander>
      </div>
    </section>
  )
}

function TonePanel({
  tone,
  seed,
  isDark,
  openMap,
  onExpanderToggle,
  surfaceBg,
  surfaceBorder,
  onSurfaceBg,
  onSurfaceBorder,
}: {
  tone: Tone
  seed: string
  isDark: boolean
  openMap: Record<string, boolean>
  onExpanderToggle: (key: string, next: boolean) => void
  surfaceBg: number
  surfaceBorder: number
  onSurfaceBg: (n: number) => void
  onSurfaceBorder: (n: number) => void
}) {
  const [vLight, setVLight] = useState<Record<string, Vals>>(() =>
    Object.fromEntries(SPECS.map((s) => [s.id, defaults(s, false, tone)])),
  )
  const [vDark, setVDark] = useState<Record<string, Vals>>(() =>
    Object.fromEntries(SPECS.map((s) => [s.id, defaults(s, true, tone)])),
  )
  // Restore before the persist effect below (see the labSnapshot comment).
  useEffect(() => {
    const stored = labSnapshot.panels?.[tone]
    if (!stored) return
    const merge = (prev: Record<string, Vals>, saved?: Record<string, Vals>) =>
      Object.fromEntries(SPECS.map((s) => [s.id, { ...prev[s.id], ...saved?.[s.id] }]))
    if (stored.vLight) setVLight((prev) => merge(prev, stored.vLight))
    if (stored.vDark) setVDark((prev) => merge(prev, stored.vDark))
  }, [tone])
  useEffect(() => {
    persistPanel(tone, { vLight, vDark })
  }, [tone, vLight, vDark])

  const setVar = (id: string, key: string, value: string) => {
    const n = parseFloat(value)
    if (!Number.isFinite(n)) return
    const setter = isDark ? setVDark : setVLight
    setter((prev) => ({ ...prev, [id]: { ...prev[id], [key]: n } }))
  }

  return (
    <>
      {SPECS.map((spec) => {
        const common = {
          spec,
          tone,
          seed,
          isDark,
          vLight: vLight[spec.id],
          vDark: vDark[spec.id],
          allVLight: vLight,
          allVDark: vDark,
          onVar: setVar,
          openMap,
          onExpanderToggle,
        }
        return spec.id === 'surface' ? (
          <SurfaceBlock
            key={spec.id}
            {...common}
            bg={surfaceBg}
            border={surfaceBorder}
            onBg={onSurfaceBg}
            onBorder={onSurfaceBorder}
          />
        ) : (
          <Block key={spec.id} {...common} />
        )
      })}
    </>
  )
}

export default function ThemingLab() {
  const [isDark, setIsDark] = useState(false)
  const [active, setActive] = useState<Tone>('neutral')
  const [seeds, setSeeds] = useState<Record<Tone, string>>(() => ({ ...SEED }))
  // Expander open state, shared across every tone panel: keyed by section +
  // expander so opening "CSS output" (or a variable group) in one tone opens
  // the same expander in all of them.
  const [openMap, setOpenMap] = useState<Record<string, boolean>>({})
  const onExpanderToggle = (key: string, next: boolean) =>
    setOpenMap((m) => ({ ...m, [key]: next }))
  // Surface preview's bg/border tab selection, shared across every tone panel so
  // switching tone keeps the same bg-N/border-N chosen (like `openMap`).
  const [surfaceBg, setSurfaceBg] = useState(2)
  const [surfaceBorder, setSurfaceBorder] = useState(4)

  // Restore before the persist effects below (see the labSnapshot comment).
  // `restoreRev` keys the seed ColorPicker: it reads `value` only at mount, so
  // a restored seed for an unchanged tone needs one remount to show up.
  const [restoreRev, setRestoreRev] = useState(0)
  useEffect(() => {
    if (TONES.includes(labSnapshot.active as Tone)) setActive(labSnapshot.active as Tone)
    if (labSnapshot.seeds) setSeeds((s) => ({ ...s, ...labSnapshot.seeds }))
    if (labSnapshot.openMap) setOpenMap({ ...labSnapshot.openMap })
    if (typeof labSnapshot.surfaceBg === 'number') setSurfaceBg(labSnapshot.surfaceBg)
    if (typeof labSnapshot.surfaceBorder === 'number') setSurfaceBorder(labSnapshot.surfaceBorder)
    setRestoreRev(1)
  }, [])

  useEffect(() => persistLab('active', active), [active])
  useEffect(() => persistLab('seeds', seeds), [seeds])
  useEffect(() => persistLab('openMap', openMap), [openMap])
  useEffect(() => persistLab('surfaceBg', surfaceBg), [surfaceBg])
  useEffect(() => persistLab('surfaceBorder', surfaceBorder), [surfaceBorder])

  useEffect(() => {
    const el = document.documentElement
    const read = () => setIsDark(el.classList.contains('dark'))
    read()
    const obs = new MutationObserver(read)
    obs.observe(el, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  return (
    <div className={`${styles.lab} full-bleed`}>
      <div className={styles.header}>
        <Tabs
          value={active}
          label="Tone"
          options={TONES.map((t) => ({ value: t, label: TONE_LABEL[t] }))}
          onStateChange={(_e: any, { next }: { next: string | null }) => {
            if (next) setActive(next as Tone)
          }}
        />
        <div className={styles.seedRow}>
          {/* Remount per tone (and once after the sessionStorage restore) so
              the picker re-seeds from that tone's colour. */}
          <ColorPicker key={`${active}:${restoreRev}`} value={seeds[active]} label="Seed" onChange={(hex: string) => setSeeds((s) => ({ ...s, [active]: hex }))} />
        </div>
      </div>

      {TONES.map((t) => (
        <div key={t} hidden={t !== active}>
          <TonePanel
            tone={t}
            seed={seeds[t]}
            isDark={isDark}
            openMap={openMap}
            onExpanderToggle={onExpanderToggle}
            surfaceBg={surfaceBg}
            surfaceBorder={surfaceBorder}
            onSurfaceBg={setSurfaceBg}
            onSurfaceBorder={setSurfaceBorder}
          />
        </div>
      ))}
    </div>
  )
}
