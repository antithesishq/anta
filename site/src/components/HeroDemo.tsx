/**
 * HeroDemo — the homepage's self-playing customization demo.
 *
 * A scripted cursor walks through three real Anta components (Button, Slider,
 * Input), changing their props from a control dock that is itself built from
 * Anta components. Every control is live: any trusted pointer or key event
 * hands control to the visitor, and the script resumes after a quiet period.
 *
 * The script never dispatches DOM events. It moves a decorative cursor to the
 * target control, then writes the same state the control would write, so the
 * page stays declarative and the visitor's input never races synthetic input.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { JSX } from 'preact'
import { Button, Icon, Input, Slider, Switch, Tabs } from '@antadesign/anta'
import s from './HeroDemo.module.css'

type Tone = 'neutral' | 'brand' | 'info' | 'success' | 'warning' | 'critical' | (string & {})
type Size = 'small' | 'medium' | 'large'
type Priority = 'primary' | 'secondary' | 'tertiary'
type Scene = 'button' | 'slider' | 'input'

const CUSTOM_TONE = '#e5489d'
const TONES: { value: Tone; name: string }[] = [
  { value: 'neutral', name: 'Neutral' },
  { value: 'brand', name: 'Brand' },
  { value: 'info', name: 'Info' },
  { value: 'success', name: 'Success' },
  { value: 'warning', name: 'Warning' },
  { value: 'critical', name: 'Critical' },
  { value: CUSTOM_TONE, name: 'Any CSS color' },
]
const toneSwatch = (tone: Tone) => (tone.startsWith('#') ? tone : `var(--anta-seed-${tone})`)

// ── State ────────────────────────────────────────────────────────────────

interface ButtonState {
  tone: Tone; priority: Priority; size: Size; icon: string; label: string; round: number; loading: boolean
}
interface SliderState {
  value: number; tone: Tone; trackSize: number; thumbSize: number; valueDisplay: 'end' | 'thumb'
  unit: string; thumbFill: boolean
}
interface InputState {
  value: string; status: 'neutral' | 'success' | 'critical'; icon: string; priority: Priority
  size: Size; round: number; clearable: boolean
}

const INITIAL = {
  button: { tone: 'brand', priority: 'primary', size: 'medium', icon: 'none', label: 'Get started', round: 6, loading: false } as ButtonState,
  slider: { value: 36, tone: 'brand', trackSize: 4, thumbSize: 16, valueDisplay: 'end', unit: '%', thumbFill: false } as SliderState,
  input: { value: '', status: 'neutral', icon: 'none', priority: 'secondary', size: 'medium', round: 6, clearable: false } as InputState,
}

const SIZES = [{ value: 'small', label: 'S' }, { value: 'medium', label: 'M' }, { value: 'large', label: 'L' }]
const ROUND_MAX = 16
const roundProp = (px: number) => (px >= ROUND_MAX ? true : px)

// ── Small helpers ────────────────────────────────────────────────────────

class Stop extends Error {}
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** The rect of a cursor target: elements tagged `data-hd`, or Anta tab options
 *  whose `className` carries `hd-<id>`. Slider thumbs live in open shadow DOM. */
function findTarget(root: HTMLElement, id: string): HTMLElement | null {
  const [base, part] = id.split('::')
  const host = root.querySelector<HTMLElement>(`[data-hd="${base}"], .hd-${base}`)
  if (!host || !part) return host
  const slider = host.matches('a-slider') ? host : host.querySelector('a-slider')
  return (slider?.shadowRoot?.querySelector<HTMLElement>(`.${part}`) ?? host)
}

// ── Component ────────────────────────────────────────────────────────────

export default function HeroDemo() {
  const rootRef = useRef<HTMLDivElement>(null)
  const [scene, setScene] = useState<Scene>('button')
  const [btn, setBtn] = useState(INITIAL.button)
  const [sld, setSld] = useState(INITIAL.slider)
  const [inp, setInp] = useState(INITIAL.input)
  const [changed, setChanged] = useState<{ key: string; n: number }>({ key: '', n: 0 })
  const [mode, setMode] = useState<'auto' | 'user'>('auto')
  const [cursor, setCursor] = useState({ x: 0, y: 0, visible: false, down: false, glide: true })
  const [ripple, setRipple] = useState<{ x: number; y: number; n: number } | null>(null)

  const touch = useCallback((key: string) => setChanged((c) => ({ key, n: c.n + 1 })), [])
  const upd = {
    button: <K extends keyof ButtonState>(k: K, v: ButtonState[K]) => { setBtn((p) => ({ ...p, [k]: v })); touch(k) },
    slider: <K extends keyof SliderState>(k: K, v: SliderState[K]) => { setSld((p) => ({ ...p, [k]: v })); touch(k) },
    input: <K extends keyof InputState>(k: K, v: InputState[K]) => { setInp((p) => ({ ...p, [k]: v })); touch(k) },
  }

  // ── Visibility gate: the script only advances while the demo is on screen.
  const visibleRef = useRef(false)
  const gateWaiters = useRef<(() => void)[]>([])
  useEffect(() => {
    const el = rootRef.current
    if (!el) return
    const update = (inView: boolean) => {
      visibleRef.current = inView && document.visibilityState === 'visible'
      if (visibleRef.current) { gateWaiters.current.splice(0).forEach((fn) => fn()) }
    }
    let inView = false
    const io = new IntersectionObserver(([e]) => { inView = e.isIntersecting; update(inView) }, { threshold: 0.35 })
    io.observe(el)
    const onVis = () => update(inView)
    document.addEventListener('visibilitychange', onVis)
    return () => { io.disconnect(); document.removeEventListener('visibilitychange', onVis) }
  }, [])

  // ── Autoplay script ────────────────────────────────────────────────────
  const runRef = useRef(0)

  const play = useCallback((startScene: Scene) => {
    const run = ++runRef.current
    const root = rootRef.current!
    const alive = () => { if (runRef.current !== run) throw new Stop() }
    const gate = () => visibleRef.current ? Promise.resolve() : new Promise<void>((r) => gateWaiters.current.push(r))
    const sleep = async (ms: number) => {
      alive(); await gate(); alive()
      await new Promise((r) => setTimeout(r, ms))
      alive()
    }
    const frame = () => new Promise((r) => requestAnimationFrame(r))

    const pointAt = (id: string, dx = 0.5, dy = 0.55) => {
      const el = findTarget(root, id)
      if (!el) return null
      const r = el.getBoundingClientRect()
      const o = root.getBoundingClientRect()
      return { x: r.left - o.left + r.width * dx, y: r.top - o.top + r.height * dy }
    }
    const move = async (id: string, dx?: number, dy?: number) => {
      await sleep(0)
      const p = pointAt(id, dx, dy)
      if (!p) return
      setCursor((c) => ({ ...c, ...p, visible: true, glide: true }))
      await sleep(620)
    }
    const press = async () => {
      setCursor((c) => { setRipple((r) => ({ x: c.x, y: c.y, n: (r?.n ?? 0) + 1 })); return { ...c, down: true } })
      await sleep(110)
      setCursor((c) => ({ ...c, down: false }))
    }
    const click = async (id: string, apply: () => void, after = 520) => {
      await move(id)
      await press()
      apply()
      await sleep(after)
    }
    const type = async (id: string, from: string, to: string, write: (v: string) => void) => {
      await move(id, 0.35)
      await press()
      await sleep(180)
      for (let i = from.length - 1; i >= 0; i--) { write(from.slice(0, i)); await sleep(28) }
      for (let i = 1; i <= to.length; i++) { write(to.slice(0, i)); await sleep(55 + Math.random() * 55) }
      await sleep(480)
    }
    /** Drag a slider thumb: the cursor rides the thumb each frame. */
    const drag = async (id: string, from: number, to: number, write: (v: number) => void, ms = 1100) => {
      await move(`${id}::thumb`)
      setCursor((c) => ({ ...c, down: true }))
      await sleep(90)
      const t0 = performance.now()
      setCursor((c) => ({ ...c, glide: false }))
      for (;;) {
        alive()
        const t = Math.min(1, (performance.now() - t0) / ms)
        write(Math.round(from + (to - from) * ease(t)))
        await frame()
        const p = pointAt(`${id}::thumb`)
        if (p) setCursor((c) => ({ ...c, ...p }))
        if (t >= 1) break
      }
      setCursor((c) => ({ ...c, down: false, glide: true }))
      await sleep(420)
    }
    const goTo = async (next: Scene) => {
      await click(`tab-${next}`, () => {
        setScene(next)
        setBtn(INITIAL.button); setSld(INITIAL.slider); setInp(INITIAL.input)
        setChanged((c) => ({ key: '', n: c.n + 1 }))
      }, 900)
    }

    const scenes: Record<Scene, () => Promise<void>> = {
      async button() {
        await goTo('button')
        await click('tone-success', () => upd.button('tone', 'success'))
        await click(`tone-${CUSTOM_TONE.slice(1)}`, () => upd.button('tone', CUSTOM_TONE), 380)
        await click('btn-icon-sparkles', () => upd.button('icon', 'sparkles'))
        await type('btn-label', INITIAL.button.label, 'Ship it', (v) => upd.button('label', v))
        await click('btn-size-large', () => upd.button('size', 'large'))
        await drag('btn-round', 6, ROUND_MAX, (v) => upd.button('round', v))
        await click('btn-priority-secondary', () => upd.button('priority', 'secondary'), 700)
        await click('btn-priority-primary', () => upd.button('priority', 'primary'), 300)
        await click('btn-loading', () => upd.button('loading', true), 1300)
        await click('btn-loading', () => upd.button('loading', false), 700)
      },
      async slider() {
        await goTo('slider')
        await drag('stage-slider', 36, 78, (v) => upd.slider('value', v), 1000)
        await click('tone-info', () => upd.slider('tone', 'info'), 380)
        await click('tone-warning', () => upd.slider('tone', 'warning'))
        await drag('sld-track', 4, 12, (v) => upd.slider('trackSize', v), 800)
        await drag('sld-thumb', 16, 28, (v) => upd.slider('thumbSize', v), 800)
        await click('sld-fill', () => upd.slider('thumbFill', true))
        await click('sld-display-thumb', () => upd.slider('valueDisplay', 'thumb'))
        await click('sld-unit-°C', () => upd.slider('unit', '°C'))
        await drag('stage-slider', 78, 22, (v) => upd.slider('value', v), 1300)
        await sleep(500)
      },
      async input() {
        await goTo('input')
        await click('inp-icon-send', () => upd.input('icon', 'send'))
        await type('stage-input', '', 'hello@anta.design', (v) => upd.input('value', v))
        await click('inp-status-success', () => upd.input('status', 'success'), 750)
        await click('inp-priority-primary', () => upd.input('priority', 'primary'))
        await drag('inp-round', 6, ROUND_MAX, (v) => upd.input('round', v), 800)
        await click('inp-status-critical', () => upd.input('status', 'critical'), 750)
        await click('inp-size-large', () => upd.input('size', 'large'))
        await click('inp-clearable', () => upd.input('clearable', true), 900)
      },
    }

    const order: Scene[] = ['button', 'slider', 'input']
    ;(async () => {
      try {
        let i = order.indexOf(startScene)
        for (;;) { await scenes[order[i]](); i = (i + 1) % order.length }
      } catch (e) {
        if (!(e instanceof Stop)) throw e
      }
    })()
  }, [])

  const stop = useCallback(() => {
    runRef.current++
    setCursor((c) => ({ ...c, visible: false, down: false }))
  }, [])

  // Start (or not, for reduced motion) once the elements are registered.
  useEffect(() => {
    let cancelled = false
    import('@antadesign/anta/elements').then(() => customElements.whenDefined('a-slider')).then(() => {
      if (cancelled) return
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setMode('user'); return }
      // Park the cursor near the tabs so the first glide has somewhere to come from.
      setCursor({ x: 120, y: 140, visible: true, down: false, glide: false })
      play('button')
    })
    return () => { cancelled = true; stop() }
  }, [play, stop])

  // ── Visitor takeover and idle resume ───────────────────────────────────
  const sceneRef = useRef(scene)
  sceneRef.current = scene
  const idle = useRef<ReturnType<typeof setTimeout>>()
  const takeOver = useCallback((e: Event) => {
    if (!e.isTrusted || (e.target as HTMLElement).closest?.('[data-hd-resume]')) return
    if (mode === 'auto') { stop(); setMode('user') }
    clearTimeout(idle.current)
    if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      idle.current = setTimeout(() => { setMode('auto'); play(sceneRef.current) }, 14000)
    }
  }, [mode, play, stop])
  useEffect(() => () => clearTimeout(idle.current), [])

  const resume = () => {
    clearTimeout(idle.current)
    setMode('auto')
    const order: Scene[] = ['button', 'slider', 'input']
    play(order[(order.indexOf(scene) + 1) % order.length])
  }

  // ── Render ─────────────────────────────────────────────────────────────
  const activeTone = scene === 'button' ? btn.tone : scene === 'slider' ? sld.tone : inp.status === 'neutral' ? 'brand' : inp.status
  const setTone = (t: Tone) => (scene === 'button' ? upd.button('tone', t) : upd.slider('tone', t))

  return (
    <div
      ref={rootRef}
      className={s.root}
      data-mode={mode}
      style={{ '--hd-glow': toneSwatch(activeTone) } as JSX.CSSProperties}
      onPointerDownCapture={takeOver}
      onKeyDownCapture={takeOver}
      onWheelCapture={takeOver}
    >
      <header className={s.top}>
        <Tabs
          label="Component"
          value={scene}
          onValueChange={(_, { value }) => {
            if (!value) return
            setScene(value as Scene)
          }}
          options={[
            { value: 'button', label: 'Button', icon: 'click', className: 'hd-tab-button' },
            { value: 'slider', label: 'Slider', icon: 'move-horizontal', className: 'hd-tab-slider' },
            { value: 'input', label: 'Input', icon: 'text-cursor-input', className: 'hd-tab-input' },
          ]}
        />
        <div className={s.status} aria-live="polite">
          {mode === 'auto' ? (
            <span className={s.live}><i />Live demo · grab any control</span>
          ) : (
            <span data-hd-resume>
              <Button size="small" priority="tertiary" icon="play" label="Replay demo" onClick={resume} />
            </span>
          )}
        </div>
      </header>

      <div className={s.stage}>
        <div className={s.glow} aria-hidden="true" />
        <div className={s.specimen} data-scene={scene} key={scene}>
          {scene === 'button' && (
            <Button
              tone={btn.tone}
              priority={btn.priority as 'primary'}
              size={btn.size}
              round={roundProp(btn.round)}
              loading={btn.loading}
              icon={btn.icon === 'none' ? undefined : (btn.icon as 'sparkles')}
              label={btn.label || ' '}
            />
          )}
          {scene === 'slider' && (
            <div className={s.sliderWrap} data-hd="stage-slider">
              <Slider
                label="Temperature"
                min={0}
                max={100}
                value={sld.value}
                tone={sld.tone}
                trackSize={sld.trackSize}
                thumbSize={sld.thumbSize}
                thumbFill={sld.thumbFill}
                thumbTone={sld.thumbFill ? sld.tone : undefined}
                valueDisplay={sld.valueDisplay}
                valueSuffix={sld.unit}
                round
                onValueChange={(_, { value }) => upd.slider('value', value as number)}
              />
            </div>
          )}
          {scene === 'input' && (
            <div className={s.inputWrap} data-hd="stage-input">
              <Input
                label="Work email"
                type="email"
                placeholder="you@company.com"
                autoComplete="off"
                value={inp.value}
                status={inp.status}
                priority={inp.priority}
                size={inp.size}
                round={roundProp(inp.round)}
                clearable={inp.clearable}
                leading={inp.icon === 'none' ? undefined : <Icon shape={inp.icon as 'send'} />}
                hint={inp.status === 'success' ? 'Looks good — we’ll send a link.' : inp.status === 'critical' ? 'That domain isn’t on the allowlist.' : 'We never share it.'}
                onValueChange={(_, { value }) => upd.input('value', value)}
              />
            </div>
          )}
        </div>
        <Code scene={scene} btn={btn} sld={sld} inp={inp} changed={changed} />
      </div>

      <div className={s.dock}>
        {scene !== 'input' && (
          <Group label="Tone" span={2} mobileWide>
            <div className={s.swatches} role="group" aria-label="Tone">
              {TONES.map((t) => {
                const on = (scene === 'button' ? btn.tone : sld.tone) === t.value
                return (
                  <span key={t.value} data-hd={`tone-${t.value.replace('#', '')}`} className={s.swatchCell}>
                    <Button
                      size="small"
                      priority="tertiary"
                      round
                      selected={on}
                      aria-label={t.name}
                      aria-pressed={on}
                      className={s.swatch}
                      onClick={() => setTone(t.value)}
                    >
                      <span
                        className={s.dot}
                        data-custom={t.value === CUSTOM_TONE || undefined}
                        style={{ '--sw': toneSwatch(t.value) } as JSX.CSSProperties}
                      />
                    </Button>
                  </span>
                )
              })}
            </div>
          </Group>
        )}

        {scene === 'button' && (
          <>
            <Group label="Label" span={2}>
              <div data-hd="btn-label">
                <Input size="small" aria-label="Button label" value={btn.label} onValueChange={(_, { value }) => upd.button('label', value)} />
              </div>
            </Group>
            <Group label="Icon" span={2}>
              <IconPicker id="btn-icon" value={btn.icon} options={['none', 'sparkles', 'send', 'heart', 'download']} onPick={(v) => upd.button('icon', v)} />
            </Group>
            <Group label="Priority" span={2} mobileWide>
              <Segmented id="btn-priority" value={btn.priority} options={['primary', 'secondary', 'tertiary']} onPick={(v) => upd.button('priority', v as Priority)} />
            </Group>
            <Group label="Size">
              <Segmented id="btn-size" value={btn.size} options={SIZES} onPick={(v) => upd.button('size', v as Size)} />
            </Group>
            <Group label="Loading">
              <Toggle id="btn-loading" checked={btn.loading} onChange={(v) => upd.button('loading', v)} />
            </Group>
            <Group label="Round" span={2} mobileWide value={btn.round >= ROUND_MAX ? 'pill' : `${btn.round}px`}>
              <Knob id="btn-round" value={btn.round} min={0} max={ROUND_MAX} onChange={(v) => upd.button('round', v)} />
            </Group>
          </>
        )}

        {scene === 'slider' && (
          <>
            <Group label="Track" span={2} value={`${sld.trackSize}px`}>
              <Knob id="sld-track" value={sld.trackSize} min={2} max={14} onChange={(v) => upd.slider('trackSize', v)} />
            </Group>
            <Group label="Thumb" span={2} value={`${sld.thumbSize}px`}>
              <Knob id="sld-thumb" value={sld.thumbSize} min={12} max={32} onChange={(v) => upd.slider('thumbSize', v)} />
            </Group>
            <Group label="Value" span={2}>
              <Segmented id="sld-display" value={sld.valueDisplay} options={['end', 'thumb']} onPick={(v) => upd.slider('valueDisplay', v as 'end')} />
            </Group>
            <Group label="Unit" span={2}>
              <Segmented id="sld-unit" value={sld.unit} options={['%', '°C', 'dB']} onPick={(v) => upd.slider('unit', v)} />
            </Group>
            <Group label="Filled thumb" span={2} mobileWide>
              <Toggle id="sld-fill" checked={sld.thumbFill} onChange={(v) => upd.slider('thumbFill', v)} />
            </Group>
          </>
        )}

        {scene === 'input' && (
          <>
            <Group label="Status" span={2} mobileWide>
              <Segmented id="inp-status" value={inp.status} options={['neutral', 'success', 'critical']} onPick={(v) => upd.input('status', v as 'neutral')} />
            </Group>
            <Group label="Leading icon" span={2}>
              <IconPicker id="inp-icon" value={inp.icon} options={['none', 'search', 'send', 'sparkles', 'link']} onPick={(v) => upd.input('icon', v)} />
            </Group>
            <Group label="Priority" span={2} mobileWide>
              <Segmented id="inp-priority" value={inp.priority} options={['primary', 'secondary', 'tertiary']} onPick={(v) => upd.input('priority', v as Priority)} />
            </Group>
            <Group label="Size">
              <Segmented id="inp-size" value={inp.size} options={SIZES} onPick={(v) => upd.input('size', v as Size)} />
            </Group>
            <Group label="Round" span={3} value={inp.round >= ROUND_MAX ? 'pill' : `${inp.round}px`}>
              <Knob id="inp-round" value={inp.round} min={0} max={ROUND_MAX} onChange={(v) => upd.input('round', v)} />
            </Group>
            <Group label="Clearable" span={2}>
              <Toggle id="inp-clearable" checked={inp.clearable} onChange={(v) => upd.input('clearable', v)} />
            </Group>
          </>
        )}
      </div>

      <div
        className={s.cursor}
        aria-hidden="true"
        data-visible={cursor.visible && mode === 'auto'}
        data-down={cursor.down}
        data-glide={cursor.glide}
        style={{ transform: `translate(${cursor.x}px, ${cursor.y}px)` }}
      >
        <svg width="22" height="26" viewBox="0 0 22 26">
          <path d="M3 2.5v18.2l4.6-4.3 3 6.8 3.2-1.4-3-6.7h6.4L3 2.5z" />
        </svg>
      </div>
      {ripple && mode === 'auto' && (
        <span key={ripple.n} className={s.ripple} aria-hidden="true" style={{ left: ripple.x, top: ripple.y }} />
      )}
    </div>
  )
}

// ── Dock controls ─────────────────────────────────────────────────────────

function Group({ label, value, span = 1, mobileWide, children }: {
  label: string; value?: string; span?: 1 | 2 | 3; mobileWide?: boolean; children: preact.ComponentChildren
}) {
  return (
    <div className={s.group} data-span={span} data-mobile-wide={mobileWide || undefined}>
      <div className={s.groupHead}>
        <span>{label}</span>
        {value && <output>{value}</output>}
      </div>
      {children}
    </div>
  )
}

type Opt = string | { value: string; label: string }
const optValue = (o: Opt) => (typeof o === 'string' ? o : o.value)
const optLabel = (o: Opt) => (typeof o === 'string' ? o : o.label)

function Segmented({ id, value, options, onPick }: { id: string; value: string; options: Opt[]; onPick: (v: string) => void }) {
  return (
    <Tabs
      className={s.segmented}
      size="small"
      priority="secondary"
      label={id}
      value={value}
      onValueChange={(_, { value: v }) => v && onPick(v)}
      options={options.map((o) => ({ value: optValue(o), label: optLabel(o), className: `hd-${id}-${optValue(o)}` }))}
    />
  )
}

function IconPicker({ id, value, options, onPick }: { id: string; value: string; options: string[]; onPick: (v: string) => void }) {
  return (
    <div className={s.icons} role="radiogroup" aria-label={id}>
      {options.map((o) => (
        <span key={o} data-hd={`${id}-${o}`}>
          <Button
            size="small"
            priority="tertiary"
            selected={value === o}
            icon={o === 'none' ? 'blank' : (o as 'send')}
            aria-label={o === 'none' ? 'No icon' : o}
            className={o === 'none' ? s.noIcon : undefined}
            onClick={() => onPick(o)}
          />
        </span>
      ))}
    </div>
  )
}

function Knob({ id, value, min, max, onChange }: { id: string; value: number; min: number; max: number; onChange: (v: number) => void }) {
  return (
    <div data-hd={id} className={s.knob}>
      <Slider
        aria-label={id}
        size="small"
        min={min}
        max={max}
        value={value}
        valueDisplay="none"
        tone="brand"
        trackSize={4}
        thumbSize={14}
        round
        trackClick="jump"
        onValueChange={(_, { value: v }) => onChange(v as number)}
      />
    </div>
  )
}

function Toggle({ id, checked, onChange }: { id: string; checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <span data-hd={id} className={s.toggle}>
      <Switch aria-label={id} tone="brand" checked={checked} onValueChange={(_, a) => onChange(a.checked)} />
    </span>
  )
}

// ── Live code line ────────────────────────────────────────────────────────

function Code({ scene, btn, sld, inp, changed }: {
  scene: Scene; btn: ButtonState; sld: SliderState; inp: InputState; changed: { key: string; n: number }
}) {
  const attrs = useMemo(() => {
    const str = (v: string) => `"${v}"`
    const out: [string, string, string][] = [] // [key, attr, value]
    if (scene === 'button') {
      out.push(['tone', 'tone', str(btn.tone)])
      if (btn.priority !== 'primary') out.push(['priority', 'priority', str(btn.priority)])
      if (btn.size !== 'medium') out.push(['size', 'size', str(btn.size)])
      if (btn.icon !== 'none') out.push(['icon', 'icon', str(btn.icon)])
      out.push(['label', 'label', str(btn.label)])
      out.push(['round', 'round', btn.round >= ROUND_MAX ? '' : `{${btn.round}}`])
      if (btn.loading) out.push(['loading', 'loading', ''])
    } else if (scene === 'slider') {
      out.push(['value', 'value', `{${sld.value}}`])
      out.push(['tone', 'tone', str(sld.tone)])
      out.push(['trackSize', 'trackSize', `{${sld.trackSize}}`])
      out.push(['thumbSize', 'thumbSize', `{${sld.thumbSize}}`])
      if (sld.thumbFill) out.push(['thumbFill', 'thumbFill', ''], ['thumbTone', 'thumbTone', str(sld.tone)])
      if (sld.valueDisplay !== 'end') out.push(['valueDisplay', 'valueDisplay', str(sld.valueDisplay)])
      out.push(['unit', 'valueSuffix', str(sld.unit)])
    } else {
      out.push(['value', 'value', str(inp.value)])
      if (inp.status !== 'neutral') out.push(['status', 'status', str(inp.status)])
      if (inp.icon !== 'none') out.push(['icon', 'leading', `{<Icon shape="${inp.icon}" />}`])
      if (inp.priority !== 'secondary') out.push(['priority', 'priority', str(inp.priority)])
      if (inp.size !== 'medium') out.push(['size', 'size', str(inp.size)])
      out.push(['round', 'round', inp.round >= ROUND_MAX ? '' : `{${inp.round}}`])
      if (inp.clearable) out.push(['clearable', 'clearable', ''])
    }
    return out
  }, [scene, btn, sld, inp])

  const tag = scene === 'button' ? 'Button' : scene === 'slider' ? 'Slider' : 'Input'
  return (
    <pre className={s.code} aria-label="Generated JSX">
      <code>
        <span className={s.punct}>&lt;</span><span className={s.tag}>{tag}</span>
        {attrs.map(([key, attr, value]) => (
          <span key={key} className={s.attr} data-hot={changed.key === key || undefined}>
            {' '}
            <span key={changed.key === key ? changed.n : 0} className={s.attrInner}>
              <span className={s.name}>{attr}</span>
              {value && (<><span className={s.punct}>=</span><span className={s.value}>{value}</span></>)}
            </span>
          </span>
        ))}
        <span className={s.punct}> /&gt;</span>
      </code>
    </pre>
  )
}
