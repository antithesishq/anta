import { useEffect, useMemo, useState } from 'react'
import { Button, Checkbox, RadioGroup, Switch, Slider, Tabs, TabPanel, Input, Calendar, Select, Dialog, Expander, type CheckboxValue } from '@antadesign/anta'
import { Plot } from '../plot/Plot'
import './showcase.css'
import { installPointer } from './pointer'

const names = ['Button', 'Checkbox', 'RadioGroup', 'Switch', 'Slider', 'Tabs', 'Input', 'Calendar', 'Select', 'Dialog', 'Expander', 'Plot']
const cycle = 40000
export function configuration(time: number, index: number) {
  const local = time % cycle
  const start = 5000 + index * 2400
  const mounted = local < start || local >= start + 2200
  return {phase: Math.floor((time + index * 1300) / 6500) % 4, mounted,
    generation: Math.floor(time / cycle) * 2 + (local >= start + 2200 ? 1 : 0),
    remaining: Math.max(0, Math.ceil((start + 2200 - local) / 1000))}
}
function description(index: number, phase: number) {
  if (index === 0 && phase === 2) return 'loading'
  if (index === 0 && phase === 3) return 'tone: success'
  if (phase === 1 && ![9, 11].includes(index)) return 'disabled'
  if (index === 2) return `${phase >= 2 ? 4 : 3} options · ${phase >= 2 ? 'vertical' : 'horizontal'}`
  if (index === 5) return `${phase >= 2 ? 4 : 2} tabs · ${phase === 3 ? 'vertical' : 'horizontal'}`
  if (index === 6) return phase === 2 ? 'readOnly' : phase === 3 ? 'critical · clearable' : 'editable'
  if (index === 7) return phase >= 2 ? 'locale: en-GB' : 'locale: en-US'
  if (index === 8) return phase >= 2 ? '5 options · clearable' : '3 options'
  if (index === 9) return phase >= 2 ? 'closable: false' : 'closable: true'
  if (index === 11) return phase >= 2 ? 'new data · height: 190' : phase === 1 ? 'zoomPan: false' : 'height: 145 · zoomPan'
  if (index === 4) return phase >= 2 ? 'max: 200 · step: 10' : 'max: 100 · step: 5'
  if (index === 1 && phase === 2) return 'checked: indeterminate'
  if (index === 3 && phase === 2) return 'size: large'
  if (index === 10 && phase >= 2) return 'title: Advanced preferences'
  return 'enabled'
}
function Subject({index, phase, generation}: {index: number; phase: number; generation: number}) {
  const disabled = phase === 1
  const [checked, setChecked] = useState<CheckboxValue>(false)
  const [on, setOn] = useState(false)
  const [choice, setChoice] = useState('email')
  const [tab, setTab] = useState('overview')
  const [slider, setSlider] = useState(35)
  const [text, setText] = useState('hello@anta.design')
  const [date, setDate] = useState('2026-07-14')
  const [open, setOpen] = useState(false)
  const [clicks, setClicks] = useState(0)
  const id = `showcase-${index}-${generation}`
  const more = phase >= 2
  const points = useMemo(() => Array.from({length:more ? 18 : 10}, (_, x) => ({x, y: 30 + 20 * Math.sin(x * (more ? .7 : .4))})), [more])
  switch (index) {
    case 0: return <div className="center-stack"><Button priority="primary" tone={phase === 3 ? 'success' : 'brand'} size="large" disabled={disabled} loading={phase === 2} onClick={() => setClicks(n => n + 1)}>Save changes</Button><small>{clicks} saves</small></div>
    case 1: return <Checkbox label="Receive product updates" checked={phase === 2 ? 'indeterminate' : checked} disabled={disabled} onStateChange={(_, {next}) => setChecked(next)}/>
    case 2: return <RadioGroup label="Notify me by" orientation={more ? 'vertical' : 'horizontal'} disabled={disabled} value={choice} options={(more ? ['Email', 'SMS', 'Push', 'Slack'] : ['Email', 'SMS', 'Push']).map(label => ({value:label.toLowerCase(), label}))} onStateChange={(_, {next}) => setChoice(next ?? 'email')}/>
    case 3: return <Switch label="Enable notifications" checked={on} size={phase === 2 ? 'large' : 'medium'} disabled={disabled} onStateChange={(_, {next}) => setOn(next)}/>
    case 4: return <Slider label="Budget" value={slider} min={0} max={more ? 200 : 100} step={more ? 10 : 5} disabled={disabled} thumbSize={phase === 3 ? 25 : 16} thumbFill={phase === 3} trackClick="jump" onValueChange={(_, {value}) => setSlider(Number(value))}/>
    case 5: {
      const labels = more ? ['Overview', 'Activity', 'People', 'Settings'] : ['Overview', 'Activity']
      const active = labels.some(label => label.toLowerCase() === tab) ? tab : 'overview'
      return <Tabs label="Workspace" options={labels.map(label => ({value: label.toLowerCase(), label}))} value={active} disabled={disabled} orientation={phase === 3 ? 'vertical' : 'horizontal'} tone={phase === 3 ? 'brand' : undefined} onStateChange={(_, {next}) => setTab(next ?? 'overview')}>{labels.map(label => <TabPanel key={label} value={label.toLowerCase()}><p className="tab-copy">{label === 'Overview' ? 'Your workspace at a glance.' : label === 'Activity' ? 'Recent changes and updates.' : label === 'People' ? 'Everyone on your team.' : 'Make this workspace yours.'}</p></TabPanel>)}</Tabs>
    }
    case 6: return <Input label="Email address" value={text} disabled={disabled} readOnly={phase === 2} clearable={phase === 3} status={phase === 3 ? 'critical' : undefined} hint={phase === 3 ? 'Please check your email address.' : undefined} onValueChange={(_, {value}) => setText(value)}/>
    case 7: return <Calendar aria-label="Appointment date" value={date} locale={more ? 'en-GB' : 'en-US'} disabled={disabled} onStateChange={(_, {next}) => setDate(next ?? '2026-07-14')}/>
    case 8: return <Select label="Fruit" defaultValue="apple" disabled={disabled} clearable={more} options={(more ? ['Apple', 'Orange', 'Pear', 'Cherry', 'Peach'] : ['Apple', 'Orange', 'Pear']).map(label => ({value:label.toLowerCase(),label}))}/>
    case 9: return <><Button priority="secondary" onClick={() => setOpen(true)}>Open dialog</Button><Dialog header={more ? 'Review changes' : 'Confirm action'} open={open} closable={!more} onStateChange={(_, {next}) => setOpen(next)} footer={<Button priority="primary" onClick={() => setOpen(false)}>Done</Button>}><p>Your workspace changes are ready to save.</p></Dialog></>
    case 10: return <Expander title={more ? 'Advanced preferences' : 'More information'} disabled={disabled} open={open} onStateChange={(_, {next}) => setOpen(next)}><p>Choose how your workspace behaves.</p></Expander>
    default: return <Plot id={id} zoomPan={phase !== 1} height={more ? 190 : 145} points={points}/>
  }
}
declare global { interface Window { __showcase?: {time: number; cards: ReturnType<typeof configuration>[]}; __showcaseReset?: () => void } }
export default function Showcase() {
  useEffect(installPointer, [])
  const [time, setTime] = useState(0)
  const [running, setRunning] = useState(true)
  const [reset, setReset] = useState(0)
  useEffect(() => {
    if (!running) return
    const started = performance.now() - time
    const timer = setInterval(() => setTime(performance.now() - started), 100)
    return () => clearInterval(timer)
  }, [running, reset])
  const restart = () => {setTime(0); setReset(n => n + 1)}
  useEffect(() => {window.__showcase = {time, cards:names.map((_, index) => configuration(time, index))}; window.__showcaseReset = restart}, [time])
  return <main className="showcase">
    <header className="showcase-header"><div><div className="showcase-kicker">ANTA / COMPONENT PLAYGROUND</div><h1>Same components. Different conditions.</h1></div><div className="showcase-controls"><span className="live-dot"/>Live props<span className="elapsed">{Math.floor(time / 1000)}s</span><button onClick={() => setRunning(!running)}>{running ? 'Pause' : 'Play'}</button><button onClick={restart}>Replay</button></div></header>
    <div className="showcase-grid">{names.map((name, index) => {
      const config = configuration(time, index)
      const state = config.mounted ? description(index, config.phase) : 'unmounted'
      return <article key={`${reset}-${index}`} data-card={index} data-state={state} data-mounted={config.mounted ? 'true' : 'false'}>
        <header><h2><span>{String(index + 1).padStart(2, '0')}</span>{name}</h2><code data-badge>{state}</code></header>
        <div className="showcase-stage">{config.mounted ? <div className="showcase-subject" data-subject key={config.generation}><Subject index={index} phase={config.phase} generation={config.generation}/></div> : <div className="showcase-absent"><span>Component unmounted</span><small>Mounting again in {config.remaining}s</small></div>}</div>
      </article>
    })}</div>
    <footer className="showcase-footer"><span>Actual components · live prop updates · real mounts and unmounts</span><span>Scripted demonstration</span></footer>
  </main>
}
