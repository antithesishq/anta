import { useEffect, useState } from 'preact/hooks'
import { Avatar, Button, ButtonCopy, Checkbox, Input, RadioGroup, Slider, Tooltip } from '@antadesign/anta'
import type { AvatarGenConfig, DimMode } from '@antadesign/anta'
import '@antadesign/anta/elements'
import ColorPicker from './ColorPicker'
import styles from './AvatarLab.module.css'

/**
 * Avatar lab — the interactive playground for the generative userpic. Each of
 * the ten dimensions is included or excluded and shaped (OFF / ANY / RANGE /
 * LIST) in the panel; the seed string extracts one avatar from the configured
 * space. It renders the shipped `<Avatar>` and exports the `generator` config as
 * copyable code, so a configuration explored here drops straight into an app.
 *
 * State survives client-side navigation via sessionStorage, restored in a mount
 * effect (never the useState initializer — Preact skips attribute patching
 * during hydration, so an initializer-restored value desyncs from the SSR DOM).
 */

type Mode = DimMode
const MODES: { value: Mode; label: string }[] = [
  { value: 'off', label: 'Off' },
  { value: 'any', label: 'Any' },
  { value: 'range', label: 'Range' },
  { value: 'list', label: 'List' },
]

interface ScalarMeta { key: ScalarKey; label: string; min: number; max: number; step: number }
type ScalarKey = 'figureScale' | 'figureAngle' | 'headAngle' | 'bodyAngle' | 'headBorderRadius' | 'bodyBorderRadius'
const SCALARS: ScalarMeta[] = [
  { key: 'figureScale', label: 'Figure scale', min: 0.6, max: 1.6, step: 0.01 },
  { key: 'figureAngle', label: 'Figure angle', min: -30, max: 30, step: 1 },
  { key: 'headAngle', label: 'Head angle', min: -30, max: 30, step: 1 },
  { key: 'bodyAngle', label: 'Body angle', min: -25, max: 25, step: 1 },
  { key: 'headBorderRadius', label: 'Head corner radius', min: 0, max: 0.5, step: 0.01 },
  { key: 'bodyBorderRadius', label: 'Body corner radius', min: 0, max: 0.5, step: 0.01 },
]

type ColorKey = 'bgColor' | 'headColor' | 'bodyColor'
const COLORS: { key: ColorKey; label: string }[] = [
  { key: 'bgColor', label: 'Background color' },
  { key: 'headColor', label: 'Head color' },
  { key: 'bodyColor', label: 'Body color' },
]

// The lab holds a "fat" model: every dimension keeps all of its parameters so a
// mode switch never loses the values you typed. `emit()` narrows it to a clean
// AvatarGenConfig — the extra fields are harmless to the generator, but the
// exported code shows only what each mode uses.
interface FatScalar { mode: Mode; min: number; max: number; values: number[] }
interface FatColor { mode: Mode; l: [number, number]; c: [number, number]; h: [number, number]; values: string[] }
interface FatVec2 { mode: Mode; x: [number, number]; y: [number, number] }
interface Fat {
  bgColor: FatColor; headColor: FatColor; bodyColor: FatColor
  figureScale: FatScalar; figureAngle: FatScalar; headAngle: FatScalar; bodyAngle: FatScalar
  headBorderRadius: FatScalar; bodyBorderRadius: FatScalar
  figureTranslate: FatVec2
  harmony: boolean
}

const scalar = (mode: Mode, min: number, max: number, values: number[] = []): FatScalar => ({ mode, min, max, values })
const color = (mode: Mode, l: [number, number], c: [number, number], values: string[] = []): FatColor => ({ mode, l, c, h: [0, 360], values })

const INITIAL: Fat = {
  bgColor: color('any', [0.55, 0.78], [0.03, 0.09]),
  headColor: color('any', [0.8, 0.93], [0.02, 0.06]),
  bodyColor: color('any', [0.78, 0.92], [0.02, 0.06]),
  figureScale: scalar('any', 0.82, 1.2),
  figureTranslate: { mode: 'off', x: [-12, 12], y: [-12, 12] },
  figureAngle: scalar('off', -12, 12),
  headAngle: scalar('any', -14, 14),
  bodyAngle: scalar('any', -10, 10),
  headBorderRadius: scalar('any', 0.16, 0.5),
  bodyBorderRadius: scalar('any', 0.22, 0.5),
  harmony: true,
}

/** Narrow the fat model to a clean generator config (only the fields each mode uses). */
function emit(f: Fat): AvatarGenConfig {
  const s = (d: FatScalar) =>
    d.mode === 'range' ? { mode: d.mode, min: d.min, max: d.max } : d.mode === 'list' ? { mode: d.mode, values: d.values } : { mode: d.mode }
  const c = (d: FatColor) =>
    d.mode === 'range' ? { mode: d.mode, l: d.l, c: d.c, h: d.h } : d.mode === 'list' ? { mode: d.mode, values: d.values } : { mode: d.mode }
  const v = (d: FatVec2) => (d.mode === 'range' ? { mode: d.mode, x: d.x, y: d.y } : { mode: d.mode })
  return {
    bgColor: c(f.bgColor), headColor: c(f.headColor), bodyColor: c(f.bodyColor),
    figureScale: s(f.figureScale), figureTranslate: v(f.figureTranslate), figureAngle: s(f.figureAngle),
    headAngle: s(f.headAngle), bodyAngle: s(f.bodyAngle),
    headBorderRadius: s(f.headBorderRadius), bodyBorderRadius: s(f.bodyBorderRadius),
    harmony: f.harmony,
  }
}

const LAB_KEY = 'anta-avatar-lab'
const randomSeed = () => Math.random().toString(36).slice(2, 8)

type Snapshot = { seed?: string; name?: string; fat?: Fat }
const readSnapshot = (): Snapshot => {
  try {
    if (typeof sessionStorage === 'undefined') return {}
    return JSON.parse(sessionStorage.getItem(LAB_KEY) ?? '{}')
  } catch {
    return {}
  }
}

export default function AvatarLab() {
  const [seed, setSeed] = useState('user-42')
  const [name, setName] = useState('Vlad Korobov')
  const [fat, setFat] = useState<Fat>(INITIAL)

  // Restore once, after mount (ClientRouter rule).
  useEffect(() => {
    const snap = readSnapshot()
    if (snap.seed != null) setSeed(snap.seed)
    if (snap.name != null) setName(snap.name)
    if (snap.fat) setFat({ ...INITIAL, ...snap.fat })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    try {
      sessionStorage.setItem(LAB_KEY, JSON.stringify({ seed, name, fat }))
    } catch {}
  }, [seed, name, fat])

  const config = emit(fat)
  const patch = (p: Partial<Fat>) => setFat((f) => ({ ...f, ...p }))
  const setScalar = (key: ScalarKey, p: Partial<FatScalar>) => setFat((f) => ({ ...f, [key]: { ...f[key], ...p } }))
  const setColor = (key: ColorKey, p: Partial<FatColor>) => setFat((f) => ({ ...f, [key]: { ...f[key], ...p } }))

  const sampleSeeds = Array.from({ length: 10 }, (_, i) => `${seed}·${i}`)
  const exported = `const brandAvatars: AvatarGenConfig = ${JSON.stringify(config, null, 2)}\n\n<Avatar seed=${JSON.stringify(seed)} name=${JSON.stringify(name)} generator={brandAvatars} />`

  return (
    <div className={styles.lab}>
      <div className={styles.preview}>
        <Avatar seed={seed} name={name} generator={config} size={128} />
        <div className={styles.field}>
          <Input size="small" label="Seed" value={seed} onValueChange={(_e: any, a: any) => setSeed(a.value)} />
          <Button size="small" priority="secondary" onClick={() => setSeed(randomSeed())}>Randomize</Button>
        </div>
        <Input size="small" label="Name (initials · accessible name)" value={name} onValueChange={(_e: any, a: any) => setName(a.value)} />

        <div className={styles.samplesLabel}>Same config, different seeds</div>
        <div className={styles.samples}>
          {sampleSeeds.map((s) => (
            <button key={s} type="button" className={styles.sample} title={s} onClick={() => setSeed(s)}>
              <Avatar seed={s} name={name} generator={config} size={44} />
            </button>
          ))}
        </div>

        <Checkbox
          checked={fat.harmony}
          onStateChange={(_e: any, d: any) => patch({ harmony: d?.next === true || d?.next === 'checked' })}
          label="Harmony"
          hint="Derive head and body hue from the background"
        />

        <div className={styles.exportHead}>
          <span>Generator config</span>
          <ButtonCopy size="small" copy={exported} />
        </div>
        <pre className={styles.export}>{exported}</pre>
      </div>

      <div className={styles.controls}>
        {COLORS.map((meta) => (
          <ColorDimControl key={meta.key} meta={meta} dim={fat[meta.key]} onMode={(mode) => setColor(meta.key, { mode })} onChange={(p) => setColor(meta.key, p)} />
        ))}

        <Vec2Control dim={fat.figureTranslate} onChange={(p) => patch({ figureTranslate: { ...fat.figureTranslate, ...p } })} />

        {SCALARS.map((meta) => (
          <ScalarDimControl key={meta.key} meta={meta} dim={fat[meta.key]} onChange={(p) => setScalar(meta.key, p)} />
        ))}
      </div>
    </div>
  )
}

/** The OFF / ANY / RANGE / LIST selector shared by every dimension. */
function ModeRow({ label, mode, modes, onMode, hint }: { label: string; mode: Mode; modes?: { value: Mode; label: string }[]; onMode: (m: Mode) => void; hint?: string }) {
  return (
    <div className={styles.modeRow}>
      <div className={styles.dimLabel}>
        {label}
        {hint ? <Tooltip>{hint}</Tooltip> : null}
      </div>
      {/* Controlled RadioGroup pairs `value` with `onStateChange` — in controlled
          mode the element does not self-apply, so `onValueChange` (native change)
          never fires. `detail.next` carries the picked value. */}
      <RadioGroup
        orientation="horizontal"
        size="small"
        value={mode}
        options={modes ?? MODES}
        onStateChange={(_e: any, d: any) => {
          if (d?.next) onMode(d.next as Mode)
        }}
      />
    </div>
  )
}

function num(v: string, fallback: number) {
  const n = parseFloat(v)
  return Number.isFinite(n) ? n : fallback
}

function RangeSlider({ label, value, min, max, step, onChange }: { label: string; value: number; min: number; max: number; step: number; onChange: (n: number) => void }) {
  return <Slider size="small" label={label} value={value} min={min} max={max} step={step} onValueChange={(_e: any, a: any) => onChange(a.value)} />
}

function ScalarDimControl({ meta, dim, onChange }: { meta: ScalarMeta; dim: FatScalar; onChange: (p: Partial<FatScalar>) => void }) {
  return (
    <section className={styles.card}>
      <ModeRow label={meta.label} mode={dim.mode} onMode={(mode) => onChange({ mode })} />
      {dim.mode === 'range' && (
        <div className={styles.pair}>
          <RangeSlider label="Min" value={dim.min} min={meta.min} max={meta.max} step={meta.step} onChange={(n) => onChange({ min: n })} />
          <RangeSlider label="Max" value={dim.max} min={meta.min} max={meta.max} step={meta.step} onChange={(n) => onChange({ max: n })} />
        </div>
      )}
      {dim.mode === 'list' && (
        <Input
          size="small"
          label="Values (comma separated)"
          value={dim.values.join(', ')}
          onValueChange={(_e: any, a: any) => onChange({ values: String(a.value).split(',').map((s) => parseFloat(s.trim())).filter((n) => Number.isFinite(n)) })}
        />
      )}
    </section>
  )
}

function Vec2Control({ dim, onChange }: { dim: FatVec2; onChange: (p: Partial<FatVec2>) => void }) {
  return (
    <section className={styles.card}>
      <ModeRow label="Figure translate" mode={dim.mode} modes={MODES.slice(0, 3)} onMode={(mode) => onChange({ mode })} hint="X/Y shift from the centered position" />
      {dim.mode === 'range' && (
        <div className={styles.pair}>
          <RangeSlider label="X min" value={dim.x[0]} min={-30} max={30} step={1} onChange={(n) => onChange({ x: [n, dim.x[1]] })} />
          <RangeSlider label="X max" value={dim.x[1]} min={-30} max={30} step={1} onChange={(n) => onChange({ x: [dim.x[0], n] })} />
          <RangeSlider label="Y min" value={dim.y[0]} min={-30} max={30} step={1} onChange={(n) => onChange({ y: [n, dim.y[1]] })} />
          <RangeSlider label="Y max" value={dim.y[1]} min={-30} max={30} step={1} onChange={(n) => onChange({ y: [dim.y[0], n] })} />
        </div>
      )}
    </section>
  )
}

function ColorDimControl({ meta, dim, onMode, onChange }: { meta: { key: ColorKey; label: string }; dim: FatColor; onMode: (m: Mode) => void; onChange: (p: Partial<FatColor>) => void }) {
  const addColor = () => onChange({ values: [...dim.values, '#6c5ce7'] })
  const setColorAt = (i: number, hex: string) => onChange({ values: dim.values.map((v, j) => (j === i ? hex : v)) })
  const removeAt = (i: number) => onChange({ values: dim.values.filter((_, j) => j !== i) })
  return (
    <section className={styles.card}>
      <ModeRow label={meta.label} mode={dim.mode} onMode={onMode} />
      {dim.mode === 'range' && (
        <div className={styles.channels}>
          <div className={styles.pair}>
            <RangeSlider label="L min" value={dim.l[0]} min={0} max={1} step={0.01} onChange={(n) => onChange({ l: [n, dim.l[1]] })} />
            <RangeSlider label="L max" value={dim.l[1]} min={0} max={1} step={0.01} onChange={(n) => onChange({ l: [dim.l[0], n] })} />
          </div>
          <div className={styles.pair}>
            <RangeSlider label="C min" value={dim.c[0]} min={0} max={0.4} step={0.005} onChange={(n) => onChange({ c: [n, dim.c[1]] })} />
            <RangeSlider label="C max" value={dim.c[1]} min={0} max={0.4} step={0.005} onChange={(n) => onChange({ c: [dim.c[0], n] })} />
          </div>
          <div className={styles.pair}>
            <RangeSlider label="H min" value={dim.h[0]} min={0} max={360} step={1} onChange={(n) => onChange({ h: [n, dim.h[1]] })} />
            <RangeSlider label="H max" value={dim.h[1]} min={0} max={360} step={1} onChange={(n) => onChange({ h: [dim.h[0], n] })} />
          </div>
        </div>
      )}
      {dim.mode === 'list' && (
        <div className={styles.palette}>
          {dim.values.map((hex, i) => (
            <div key={i} className={styles.swatch}>
              <ColorPicker value={hex} label={`#${i + 1}`} onChange={(h: string) => setColorAt(i, h)} />
              <Button size="small" priority="tertiary" icon="x" aria-label="Remove color" onClick={() => removeAt(i)} />
            </div>
          ))}
          <Button size="small" priority="secondary" icon="plus" onClick={addColor}>Add color</Button>
        </div>
      )}
    </section>
  )
}
