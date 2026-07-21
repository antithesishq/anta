import { useEffect, useState } from 'preact/hooks'
import {
  Tabs,
  Title,
  Text,
  Button,
  Tag,
  Checkbox,
  RadioGroup,
  Expander,
  Input,
  InputDate,
  MenuItem,
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
 * Theming lab — a comparison tool. For every toned Anta component it puts the
 * shipped hand-tuned tone next to the generative oklch derivation from a seed
 * colour, exposes the formula's constants as live inputs (grouped by priority),
 * and shows the resolved CSS. Where the generic formula matches the hand-tuned
 * literals the two previews read alike; where it diverges you can see and re-tune it.
 *
 * One page, six tone panels (Neutral first), all mounted — the tone tabs only
 * toggle visibility, so each panel keeps its own per-theme edits. The seed picker
 * sits with the tabs in the sticky header, so both stay pinned while scrolling.
 * The generative preview is driven by an un-layered `<style>` (beating `@layer
 * anta`) scoped to `.tl-gen-{tone}-{id}`; at the default values it reproduces
 * Anta's own output, so only an edit makes it diverge. Follows the page theme
 * (`.dark` on the document element) — toggle light/dark to compare the other mode.
 */

const usesStatus = (id: string) => id === 'input'

/** Four rows for the menu-item preview; the second is the selected one. */
const MENU_ITEMS: { icon: 'book-open' | 'chat' | 'file' | 'edit'; label: string; kbd?: string; sel?: boolean }[] = [
  { icon: 'book-open', label: 'Overview' },
  { icon: 'chat', label: 'Comments', sel: true },
  { icon: 'file', label: 'Files', kbd: '⌘S' },
  { icon: 'edit', label: 'Rename' },
]

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
function preview(spec: ComponentSpec, mode: 'ref' | 'gen', tone: Tone, seed: string) {
  const ref = mode === 'ref'
  const named = tone === 'neutral' ? undefined : tone
  const toneVal = ref ? named : seed
  const selVal = ref ? named : seed
  const statusVal = ref ? named : undefined

  switch (spec.id) {
    case 'title':
      return (
        <div className={styles.col}>
          {(['primary', 'secondary', 'tertiary', 'quaternary', 'quinary'] as const).map((p) => (
            <Title key={p} level={4} priority={p} tone={toneVal}>
              Title · {p}
            </Title>
          ))}
        </div>
      )

    case 'text':
      return (
        <div className={styles.col}>
          {(['primary', 'secondary', 'tertiary', 'quaternary', 'quinary'] as const).map((p) => (
            <Text key={p} priority={p} tone={toneVal}>
              The quick brown fox — {p}
            </Text>
          ))}
        </div>
      )

    case 'button':
      return (
        <div className={styles.row}>
          {(['primary', 'secondary', 'tertiary', 'quaternary'] as const).map((p) => (
            // priority is a discriminated union on Button; the value is dynamic here.
            <Button key={p} priority={p as any} tone={toneVal} label={p} />
          ))}
        </div>
      )

    case 'tag':
      return (
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
      return (
        <div className={styles.col}>
          <Input label="Text input" placeholder="Type…" status={statusVal} />
          <InputDate label="Date" defaultValue="2026-06-15" status={statusVal} />
        </div>
      )

    case 'menuitem':
      return (
        <div className={styles.menuSurface} role="menu" aria-label={`${mode} menu`}>
          {MENU_ITEMS.map((it, i) => (
            <MenuItem key={i} icon={it.icon} label={it.label} kbd={it.kbd} selected={it.sel} tone={toneVal} />
          ))}
        </div>
      )

    default:
      return null
  }
}

function VarInput({ spec, d, v, onVar }: { spec: ComponentSpec; d: VarDef; v: Vals; onVar: BlockProps['onVar'] }) {
  return (
    <div className={styles.var}>
      <Input
        type="number"
        size="small"
        label={d.label}
        value={String(v[d.key])}
        min={d.min}
        max={d.max}
        step={d.step}
        onValueChange={(_e: any, a: any) => onVar(spec.id, d.key, a.value)}
      />
      {d.tip ? <Tooltip>{d.tip}</Tooltip> : null}
    </div>
  )
}

interface BlockProps {
  spec: ComponentSpec
  tone: Tone
  seed: string
  isDark: boolean
  vLight: Vals
  vDark: Vals
  onVar: (id: string, key: string, value: string) => void
}

function Block({ spec, tone, seed, isDark, vLight, vDark, onVar }: BlockProps) {
  const v = isDark ? vDark : vLight
  const el = EL_SELECTOR[spec.id]
  const genClass = `tl-gen-${tone}-${spec.id}`
  const display = spec.css(el, seed, v)
  const inject =
    spec.css(`.${genClass} ${el}`, seed, vLight) +
    '\n' +
    spec.css(`.dark .${genClass} ${el}`, seed, vDark)

  return (
    <section className={styles.block}>
      {/* LEFT — previews */}
      <div className={styles.previews}>
        <div className={styles.preview}>
          <p className={styles.previewLabel}>Anta hand-tuned · {refLabel(spec.id, tone)}</p>
          {preview(spec, 'ref', tone, seed)}
        </div>
        <div className={`${styles.preview} ${genClass}`}>
          <p className={styles.previewLabel}>
            Generative · <code>tone={`{${seed}}`}</code>
          </p>
          {preview(spec, 'gen', tone, seed)}
          <style dangerouslySetInnerHTML={{ __html: inject }} />
        </div>
      </div>

      {/* RIGHT — header, formula variables (per group), CSS output */}
      <div className={styles.controls}>
        <Title level={2}>{spec.title}</Title>
        <p className={styles.blurb}>{spec.blurb}</p>

        {groupsOf(spec).map((g) => (
          <Expander key={g.label} title={`${g.label} variables`} priority="tertiary" outdent>
            {g.note ? <p className={styles.groupNote}>{g.note}</p> : null}
            <div className={styles.varGrid}>
              {g.vars.map((d) => (
                <VarInput key={d.key} spec={spec} d={d} v={v} onVar={onVar} />
              ))}
            </div>
          </Expander>
        ))}

        <Expander title="CSS output" priority="tertiary" outdent>
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
function SurfaceBlock({ spec, tone, seed, isDark, vLight, vDark, onVar }: BlockProps) {
  const v = isDark ? vDark : vLight
  const [bg, setBg] = useState(2)
  const [border, setBorder] = useState(4)
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

  return (
    <section className={styles.block}>
      {/* LEFT — tabs, then the two swatch previews */}
      <div className={styles.previews}>
        <div className={styles.preview}>
          <div className={styles.surfaceTabs}>
            <Tabs value={`bg-${bg}`} label="Background" size="small" options={opts('bg')} onStateChange={pick(setBg)} />
            <Tabs value={`border-${border}`} label="Border" size="small" options={opts('border')} onStateChange={pick(setBorder)} />
          </div>
          <p className={styles.previewLabel}>
            Anta hand-tuned · <code>--bg-{bg}{bg === 1 ? '' : suffix}</code> · <code>--border-{border}{suffix}</code>
          </p>
          <div className={styles.surfaceSwatch} style={{ background: refBg, borderColor: refBorder }} />
        </div>
        <div className={`${styles.preview} ${genClass}`}>
          <p className={styles.previewLabel}>
            Generative · <code>tone={`{${seed}}`}</code>
          </p>
          <div className={styles.surfaceSwatch} style={{ background: `var(--bg-${bg})`, borderColor: `var(--border-${border})` }} />
          <style dangerouslySetInnerHTML={{ __html: inject }} />
        </div>
      </div>

      {/* RIGHT — header, formula variables (per group), CSS output */}
      <div className={styles.controls}>
        <Title level={2}>{spec.title}</Title>
        <p className={styles.blurb}>{spec.blurb}</p>

        {groupsOf(spec).map((g) => (
          <Expander key={g.label} title={`${g.label} variables`} priority="tertiary" outdent>
            {g.note ? <p className={styles.groupNote}>{g.note}</p> : null}
            <div className={styles.varGrid}>
              {g.vars.map((d) => (
                <VarInput key={d.key} spec={spec} d={d} v={v} onVar={onVar} />
              ))}
            </div>
          </Expander>
        ))}

        <Expander title="CSS output" priority="tertiary" outdent>
          <pre className={styles.pre}>{display}</pre>
        </Expander>
      </div>
    </section>
  )
}

function TonePanel({ tone, seed, isDark }: { tone: Tone; seed: string; isDark: boolean }) {
  const [vLight, setVLight] = useState<Record<string, Vals>>(() =>
    Object.fromEntries(SPECS.map((s) => [s.id, defaults(s, false, tone)])),
  )
  const [vDark, setVDark] = useState<Record<string, Vals>>(() =>
    Object.fromEntries(SPECS.map((s) => [s.id, defaults(s, true, tone)])),
  )

  const setVar = (id: string, key: string, value: string) => {
    const n = parseFloat(value)
    if (!Number.isFinite(n)) return
    const setter = isDark ? setVDark : setVLight
    setter((prev) => ({ ...prev, [id]: { ...prev[id], [key]: n } }))
  }

  return (
    <>
      {SPECS.map((spec) => {
        const Comp = spec.id === 'surface' ? SurfaceBlock : Block
        return (
          <Comp
            key={spec.id}
            spec={spec}
            tone={tone}
            seed={seed}
            isDark={isDark}
            vLight={vLight[spec.id]}
            vDark={vDark[spec.id]}
            onVar={setVar}
          />
        )
      })}
    </>
  )
}

export default function ThemingLab() {
  const [isDark, setIsDark] = useState(false)
  const [active, setActive] = useState<Tone>('neutral')
  const [seeds, setSeeds] = useState<Record<Tone, string>>(() => ({ ...SEED }))

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
          {/* Remount per tone so the picker re-seeds from that tone's colour. */}
          <ColorPicker key={active} value={seeds[active]} label="Seed" onChange={(hex: string) => setSeeds((s) => ({ ...s, [active]: hex }))} />
        </div>
      </div>

      {TONES.map((t) => (
        <div key={t} hidden={t !== active}>
          <TonePanel tone={t} seed={seeds[t]} isDark={isDark} />
        </div>
      ))}
    </div>
  )
}
