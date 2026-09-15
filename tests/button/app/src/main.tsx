import React, { useEffect, useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import * as monaco from 'monaco-editor'
import { Button } from '@antadesign/anta'
import '@antadesign/anta/elements/a-button'
import '@antadesign/anta/elements/a-icon.shapes'
import '@antadesign/anta/tokens.css'
import '@antadesign/anta/theme-anta.css'
import type { ButtonScenario, Content, HarnessSnapshot } from '../../scenario'
import './style.css'

type Events = HarnessSnapshot['events']

const emptyEvents = (): Events => ({ click: 0, submit: 0, submitDetailed: 0, reset: 0, navigationPrevented: 0 })

function propsFor(content: Content): Record<string, unknown> {
  switch (content.kind) {
    case 'label': return { label: content.label }
    case 'children-text': return { children: content.children }
    case 'children-number': return { children: content.children }
    case 'empty-children': return { children: content.children }
    case 'icon-only': return { icon: content.icon }
    case 'icon-label': return { icon: content.icon, label: content.label }
    case 'label-trailing-icon': return { label: content.label, iconTrailing: content.iconTrailing }
  }
}

function jsxPreview(s: ButtonScenario): string {
  const content = propsFor(s.content)
  const props = [
    `tone=${JSON.stringify(s.tone)}`,
    `priority=${JSON.stringify(s.priority)}`,
    s.size ? `size=${JSON.stringify(s.size)}` : '',
    s.disabled ? 'disabled' : '',
    s.loading ? 'loading' : '',
    s.selected ? 'selected' : '',
    s.round ? `round={${JSON.stringify(s.round)}}` : '',
    s.behavior.mode === 'href' ? `href=${JSON.stringify(s.behavior.href)}` : '',
    s.behavior.mode === 'form' ? `type=${JSON.stringify(s.behavior.type)}` : '',
    s.behavior.mode === 'form' && s.behavior.outsideForm ? 'form="harness-form"' : '',
    'label' in content ? `label=${JSON.stringify(content.label)}` : '',
    'icon' in content ? `icon=${JSON.stringify(content.icon)}` : '',
    'iconTrailing' in content ? `iconTrailing=${JSON.stringify(content.iconTrailing)}` : '',
  ].filter(Boolean)
  const children = 'children' in content ? String(content.children ?? '') : ''
  return children ? `<Button ${props.join(' ')}>${children}</Button>` : `<Button ${props.join(' ')} />`
}

function Inspector({ value, dark }: { value: string; dark: boolean }) {
  const host = useRef<HTMLDivElement>(null)
  const editor = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  useEffect(() => {
    if (!host.current) return
    editor.current = monaco.editor.create(host.current, {
      value,
      // This is diagnostic output, not an editing surface. Plain text avoids
      // Monaco's TypeScript language worker, which needs explicit Vite worker
      // wiring and otherwise creates application-level promise rejections.
      language: 'plaintext',
      theme: dark ? 'vs-dark' : 'vs',
      readOnly: true,
      minimap: { enabled: false },
      lineNumbers: 'on',
      scrollBeyondLastLine: false,
      wordWrap: 'on',
      automaticLayout: true,
      padding: { top: 12, bottom: 12 },
    })
    return () => editor.current?.dispose()
  }, [])

  useEffect(() => {
    editor.current?.setValue(value)
    monaco.editor.setTheme(dark ? 'vs-dark' : 'vs')
  }, [dark, value])

  return <div className="inspector-editor" ref={host} />
}

function App() {
  const [ids, setIds] = useState<string[]>([])
  const [scenario, setScenario] = useState<ButtonScenario | null>(null)
  const [events, setEvents] = useState<Events>(emptyEvents)
  const [formValue, setFormValue] = useState('changed')
  const [dark, setDark] = useState(false)

  const load = async (id: string) => {
    const next = await fetch(`/scenarios/${id}.json`).then((response) => response.json() as Promise<ButtonScenario>)
    setScenario(next)
    setEvents(emptyEvents())
    setFormValue('changed')
    history.replaceState(null, '', `?id=${next.id}`)
  }

  useEffect(() => {
    fetch('/scenarios/index.json').then((response) => response.json()).then(async (nextIds: string[]) => {
      setIds(nextIds)
      const id = new URLSearchParams(location.search).get('id') ?? nextIds[0]
      await load(id)
    })
  }, [])

  useEffect(() => {
    const onSubmitDetailed = (event: Event) => {
      if ((event.target as Element | null)?.id === 'harness-form')
        setEvents((current) => ({ ...current, submitDetailed: current.submitDetailed + 1 }))
    }
    document.addEventListener('submitdetailed', onSubmitDetailed)
    return () => document.removeEventListener('submitdetailed', onSubmitDetailed)
  }, [])

  useEffect(() => {
    if (!scenario) return
    const snapshot = (): HarnessSnapshot => {
      const stage = document.querySelector('[data-bombadil-target]') as HTMLElement | null
      const roots = Array.from(stage?.querySelectorAll('a-button, a[role="button"]') ?? []) as HTMLElement[]
      const root = roots[0]
      const style = root ? getComputedStyle(root) : null
      const rect = root?.getBoundingClientRect()
      // Read the scenario contract from attributes rendered in the same React
      // commit as the Button. Reading hook state here can tear during a scenario
      // transition: new DOM with a previous effect's closed-over scenario.
      const priority = (stage?.dataset.priority ?? scenario.priority) as ButtonScenario['priority']
      const foregroundToken = priority === 'primary'
        ? '--button-fg-primary-rest'
        : `--button-fg-${priority}-rest`
      return {
        scenarioId: stage?.dataset.scenarioId ?? scenario.id,
        behavior: (stage?.dataset.behavior ?? scenario.behavior.mode) as ButtonScenario['behavior']['mode'],
        priority,
        contentKind: (stage?.dataset.contentKind ?? scenario.content.kind) as Content['kind'],
        formType: stage?.dataset.formType as Extract<ButtonScenario['behavior'], { mode: 'form' }>['type'] | null,
        complete: stage?.dataset.complete === 'true',
        disabled: stage?.dataset.disabled === 'true',
        loading: stage?.dataset.loading === 'true',
        root: {
          count: roots.length,
          tag: root?.tagName ?? null,
          href: root?.getAttribute('href') ?? null,
          role: root?.getAttribute('role') ?? null,
          dataAnta: root?.hasAttribute('data-anta') ?? false,
          tabIndex: root ? root.tabIndex : null,
          ariaDisabled: root?.getAttribute('aria-disabled') ?? null,
          ariaLabel: root?.getAttribute('aria-label') ?? null,
          text: root?.textContent ?? null,
          visual: {
            width: rect?.width ?? null,
            height: rect?.height ?? null,
            display: style?.display ?? null,
            visibility: style?.visibility ?? null,
            backgroundColor: style?.backgroundColor ?? null,
            color: style?.color ?? null,
            primaryBackgroundToken: style?.getPropertyValue('--button-bg-primary-rest').trim() || null,
            foregroundToken: style?.getPropertyValue(foregroundToken).trim() || null,
          },
        },
        events,
        formValue: scenario.behavior.mode === 'form' ? formValue : null,
      }
    }
    window.__antaButtonHarness = {
      snapshot,
      nextScenario: () => {
        const index = ids.indexOf(scenario.id)
        if (index < ids.length - 1) void load(ids[index + 1])
      },
      previousScenario: () => {
        const index = ids.indexOf(scenario.id)
        void load(ids[(index - 1 + ids.length) % ids.length])
      },
    }
  }, [events, formValue, ids, scenario])

  if (!scenario) return <p className="loading">Loading scenarios…</p>

  const content = propsFor(scenario.content)
  const buttonProps: any = {
    ...content,
    tone: scenario.tone,
    priority: scenario.priority,
    size: scenario.size,
    disabled: scenario.disabled,
    loading: scenario.loading,
    selected: scenario.selected,
    round: scenario.round,
    ...scenario.inherited,
    onClick: (event: React.MouseEvent) => {
      setEvents((current) => ({ ...current, click: current.click + 1 }))
      if (scenario.behavior.mode === 'href') {
        event.preventDefault()
        setEvents((current) => ({ ...current, navigationPrevented: current.navigationPrevented + 1 }))
      }
    },
  }
  if (scenario.behavior.mode === 'href') buttonProps.href = scenario.behavior.href
  if (scenario.behavior.mode === 'form') {
    buttonProps.type = scenario.behavior.type
    if (scenario.behavior.outsideForm) buttonProps.form = 'harness-form'
  }

  const button = <Button {...buttonProps} />
  const snapshot = window.__antaButtonHarness?.snapshot?.()
  const inspectorValue = `${jsxPreview(scenario)}\n\n// Scenario\n${JSON.stringify(scenario, null, 2)}\n\n// Live snapshot\n${JSON.stringify(snapshot, null, 2)}`

  return <div className={`harness${dark ? ' dark' : ''}`}>
    <header>
      <span>Anta Button property harness</span>
      <a-tag tone="brand">Scenario {scenario.id} / {ids.length}</a-tag>
      <a-tag>{scenario.behavior.mode}</a-tag>
      <button className="theme-toggle" onClick={() => setDark((current) => !current)}>{dark ? 'Light mode' : 'Dark mode'}</button>
    </header>
    <section className="stage" data-bombadil-scope="target">
      <div
        className="stage-card"
        data-bombadil-target
        data-scenario-id={scenario.id}
        data-behavior={scenario.behavior.mode}
        data-priority={scenario.priority}
        data-content-kind={scenario.content.kind}
        data-form-type={scenario.behavior.mode === 'form' ? scenario.behavior.type : undefined}
        data-complete={scenario.id === ids.at(-1)}
        data-disabled={scenario.disabled}
        data-loading={scenario.loading}
      >
        <p>Rendered component</p>
        {scenario.behavior.mode === 'form' && !scenario.behavior.outsideForm ? (
          <form id="harness-form" onSubmit={(event) => { event.preventDefault(); setEvents((current) => ({ ...current, submit: current.submit + 1 })) }} onReset={() => { setFormValue('default'); setEvents((current) => ({ ...current, reset: current.reset + 1 })) }}>
            <input value={formValue} onChange={(event) => setFormValue(event.currentTarget.value)} />
            {button}
          </form>
        ) : <>{scenario.behavior.mode === 'form' && <form id="harness-form" onSubmit={(event) => { event.preventDefault(); setEvents((current) => ({ ...current, submit: current.submit + 1 })) }} onReset={() => { setFormValue('default'); setEvents((current) => ({ ...current, reset: current.reset + 1 })) }}><input value={formValue} onChange={(event) => setFormValue(event.currentTarget.value)} /></form>}{button}</>}
      </div>
    </section>
    <aside aria-label="Scenario inspector">
      <Inspector value={inspectorValue} dark={dark} />
    </aside>
    <footer>
      <button className="scenario-control" onClick={() => window.__antaButtonHarness?.previousScenario()}>Previous scenario</button>
      <button className="scenario-control" data-harness-next disabled={scenario.id === ids.at(-1)} onClick={() => window.__antaButtonHarness?.nextScenario()}>Next scenario</button>
    </footer>
  </div>
}

declare global {
  interface Window {
    __antaButtonHarness?: {
      snapshot: () => HarnessSnapshot
      nextScenario: () => void
      previousScenario: () => void
    }
  }
}

createRoot(document.getElementById('root')!).render(<App />)
