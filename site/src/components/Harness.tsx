import { Component, Fragment, h, type ComponentChildren, type ComponentType, type JSX } from 'preact'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import * as Anta from '@antadesign/anta'
import { printTSX } from '../../../tests/print-tsx'
import type { AppScenario, ScenarioCorpus } from '../../../tests/scenario'
import styles from './Harness.module.css'

const { Button, Tabs } = Anta
const generatedCSS = ''
const userStyleId = 'anta-harness-user-css'
const loadingCorpus: ScenarioCorpus = {
  runId: 'loading',
  seed: 0,
  scenarios: [{
    index: 0,
    archetype: 'loading',
    root: { id: 'loading', type: 'Text', props: {}, text: 'Loading generated corpus…' },
  }],
}

type MonacoEditorLib = typeof import('@monaco-editor/react')
type CompiledApp = ComponentType<Record<string, never>>
type EditorTab = 'code' | 'css'

type InteractionCounts = {
  clicks: number
  copyRequests: number
  copyResults: number
  stateChanges: number
  clearInputs: number
  inputChanges: number
}

type EditCheck = {
  id: string | null
  inputType: string
  before: string
  inserted: string
  expected: string
  actual: string
  valid: boolean
}

type HarnessTelemetry = {
  corpusId: number
  interactions: number
  sequence: number
  counts: Record<string, InteractionCounts>
  editChecks: EditCheck[]
  editFailures: number
  lastDialogOpener: Record<string, string>
  lastClosedDialog: { name: string; opener: string | null } | null
  events: Array<{ sequence: number; type: string; id: string | null }>
}

type HarnessSnapshot = {
  runId: string
  seed: number
  corpusId: number
  archetype: string
  scenario: number
  total: number
  root: AppScenario['root']
  tsx: string
  css: string
  compileStatus: 'compiling' | 'error' | 'ready'
  error: string | null
  telemetry: HarnessTelemetry
}

declare global {
  interface Window {
    __antaHarness?: { current: HarnessSnapshot }
  }
}

const emptyCounts = (): InteractionCounts => ({
  clicks: 0,
  copyRequests: 0,
  copyResults: 0,
  stateChanges: 0,
  clearInputs: 0,
  inputChanges: 0,
})

const createTelemetry = (corpusId: number): HarnessTelemetry => ({
  corpusId,
  interactions: 0,
  sequence: 0,
  counts: {},
  editChecks: [],
  editFailures: 0,
  lastDialogOpener: {},
  lastClosedDialog: null,
  events: [],
})

function eventElement(event: Event, predicate: (element: Element) => boolean): Element | null {
  return (event.composedPath().find((entry) => entry instanceof Element && predicate(entry)) as Element | undefined) ?? null
}

function eventId(event: Event): string | null {
  return eventElement(event, (element) => element.hasAttribute('data-testid'))?.getAttribute('data-testid') ?? null
}

let esbuildInitialization: Promise<void> | null = null

async function getEsbuild(): Promise<typeof import('esbuild-wasm')> {
  const esbuild = await import('esbuild-wasm')
  if (!esbuildInitialization) {
    esbuildInitialization = esbuild.initialize({ wasmURL: '/esbuild.wasm', worker: true })
  }
  await esbuildInitialization
  return esbuild
}

async function compileTSX(source: string): Promise<CompiledApp> {
  const esbuild = await getEsbuild()
  const executableSource = source
    .replace(/^\s*import\s*\{[\s\S]*?\}\s*from\s*['"]@antadesign\/anta['"]\s*;?\s*/m, '')
    .replace(/export\s+default\s+function\s+App/, 'function App')

  if (/^\s*import\s/m.test(executableSource)) {
    throw new Error('The harness supports @antadesign/anta imports only.')
  }

  const result = await esbuild.transform(executableSource, {
    loader: 'tsx',
    sourcefile: 'generated-app.tsx',
    target: 'es2022',
    format: 'esm',
    jsx: 'transform',
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
  })

  const antaEntries = Object.entries(Anta).filter(([name]) =>
    name !== 'default' && name !== 'h' && name !== 'Fragment' && /^[A-Za-z_$][\w$]*$/.test(name),
  )
  const names = ['h', 'Fragment', ...antaEntries.map(([name]) => name)]
  const values = [h, Fragment, ...antaEntries.map(([, value]) => value)]
  const factory = new Function(...names, `"use strict";\n${result.code}\nreturn App`)
  const app = factory(...values)
  if (typeof app !== 'function') throw new Error('The source must export a function named App.')
  return app as CompiledApp
}

async function compileCSS(source: string): Promise<string> {
  const esbuild = await getEsbuild()
  const result = await esbuild.transform(`@scope (.${styles.preview}) {\n${source}\n}`, {
    loader: 'css',
    sourcefile: 'generated-app.css',
    target: 'es2022',
  })
  return result.code
}

function compileMessage(error: unknown): string {
  const details = (error as any)?.errors
  if (Array.isArray(details)) {
    return details.map((entry) => {
      const location = entry.location ? `${entry.location.line}:${entry.location.column}` : ''
      return location ? `${location} — ${entry.text}` : entry.text
    }).join('\n')
  }
  return error instanceof Error ? error.message : String(error)
}

class RenderBoundary extends Component<{ children: ComponentChildren }, { error: Error | null }> {
  state = { error: null }
  static getDerivedStateFromError(error: Error) { return { error } }
  render() { return this.state.error ? <pre className={styles.compileError}>{String(this.state.error)}</pre> : this.props.children }
}

function configureMonaco(monaco: typeof import('monaco-editor')) {
  const typescript = monaco.languages.typescript
  typescript.typescriptDefaults.setCompilerOptions({
    allowNonTsExtensions: true,
    jsx: typescript.JsxEmit.React,
    jsxFactory: 'h',
    jsxFragmentFactory: 'Fragment',
    module: typescript.ModuleKind.ESNext,
    moduleResolution: typescript.ModuleResolutionKind.NodeJs,
    target: typescript.ScriptTarget.ES2022,
    noEmit: true,
  })

  const exports = Object.keys(Anta)
    .filter((name) => name !== 'default' && /^[A-Za-z_$][\w$]*$/.test(name))
    .map((name) => `  export const ${name}: any`)
    .join('\n')
  typescript.typescriptDefaults.addExtraLib(`
    declare module '@antadesign/anta' {
      ${exports}
    }
    declare function h(...args: any[]): any
    declare const Fragment: any
    declare namespace JSX {
      interface IntrinsicElements { [name: string]: any }
    }
  `, 'file:///anta-harness.d.ts')

  monaco.languages.css.cssDefaults.setOptions({ validate: true })
  monaco.languages.css.cssDefaults.setModeConfiguration({
    completionItems: true,
    hovers: true,
    documentSymbols: true,
    definitions: true,
    references: true,
    documentHighlights: true,
    rename: true,
    colors: true,
    foldingRanges: true,
    diagnostics: true,
    selectionRanges: true,
    documentFormattingEdits: true,
    documentRangeFormattingEdits: true,
  })
}

export default function Harness() {
  const [corpus, setCorpus] = useState<ScenarioCorpus>(loadingCorpus)
  const [runId] = useState(() => new URLSearchParams(window.location.search).get('run-id'))
  const corpusURL = runId
    ? `/test-output/${encodeURIComponent(runId)}/apps.json`
    : '/test-output/latest/apps.json'
  const [corpusLoading, setCorpusLoading] = useState(true)
  const [corpusLoadError, setCorpusLoadError] = useState<string | null>(null)
  const scenarios = corpus.scenarios
  const [bombadilTesting] = useState(() =>
    new URLSearchParams(window.location.search).get('bombadil-testing') === 'true',
  )
  const compileDelay = bombadilTesting ? 0 : 180
  const [index, setIndex] = useState(() => {
    const rawId = new URLSearchParams(window.location.search).get('corpus-id')
    const requested = rawId === null ? Number.NaN : Number(rawId)
    const match = Number.isSafeInteger(requested)
      ? scenarios.findIndex((candidate) => candidate.index === requested)
      : -1
    return match >= 0 ? match : 0
  })
  const scenario = scenarios[index]
  const generatedSource = useMemo(() => printTSX(scenario.root), [scenario])
  const [source, setSource] = useState(generatedSource)
  const [sourceCorpusId, setSourceCorpusId] = useState(scenario.index)
  const [cssSource, setCSSSource] = useState(generatedCSS)
  const [compiledApp, setCompiledApp] = useState<CompiledApp | null>(null)
  const [compiledSource, setCompiledSource] = useState<string | null>(null)
  const [tsxError, setTSXError] = useState<string | null>(null)
  const [cssError, setCSSError] = useState<string | null>(null)
  const [tsxCompiling, setTSXCompiling] = useState(true)
  const [cssCompiling, setCSSCompiling] = useState(true)
  const [editorTab, setEditorTab] = useState<EditorTab>('code')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorWidth, setEditorWidth] = useState(380)
  const [isDark, setIsDark] = useState(false)
  const [resizing, setResizing] = useState(false)
  const [monacoLib, setMonacoLib] = useState<MonacoEditorLib | null>(null)
  const resizeStart = useRef<{ x: number; width: number } | null>(null)
  const stageRef = useRef<HTMLElement | null>(null)
  const telemetryRef = useRef<HarnessTelemetry>(createTelemetry(scenario.index))
  if (telemetryRef.current.corpusId !== scenario.index) {
    telemetryRef.current = createTelemetry(scenario.index)
  }

  useEffect(() => {
    let cancelled = false
    setCorpusLoading(true)
    fetch(corpusURL).then(async (response) => {
      if (!response.ok) throw new Error(`Corpus request failed with ${response.status}`)
      return response.json() as Promise<ScenarioCorpus>
    }).then((nextCorpus) => {
      if (cancelled) return
      if (!Array.isArray(nextCorpus.scenarios) || nextCorpus.scenarios.length === 0) throw new Error('Corpus has no scenarios')
      const rawId = new URLSearchParams(window.location.search).get('corpus-id')
      const requested = rawId === null ? Number.NaN : Number(rawId)
      const match = Number.isSafeInteger(requested)
        ? nextCorpus.scenarios.findIndex((candidate) => candidate.index === requested)
        : -1
      setCorpus(nextCorpus)
      setIndex(match >= 0 ? match : 0)
      setCorpusLoadError(null)
      setCorpusLoading(false)
    }).catch((error) => {
      if (cancelled) return
      setCorpusLoadError(error instanceof Error ? error.message : String(error))
      setCorpusLoading(false)
    })
    return () => { cancelled = true }
  }, [corpusURL])

  useEffect(() => {
    setSource(generatedSource)
    setSourceCorpusId(scenario.index)
    setCSSSource(generatedCSS)
  }, [generatedSource, scenario.index])

  useEffect(() => {
    const pendingEdits = new WeakMap<HTMLInputElement | HTMLTextAreaElement, {
      id: string | null
      before: string
      inputType: string
      inserted: string
      start: number | null
      end: number | null
    }>()
    let lastInteractionAt = Number.NEGATIVE_INFINITY
    const keysDown = new Set<string>()
    const inPreview = (event: Event) => {
      const stage = stageRef.current
      return !!stage && event.composedPath().includes(stage)
    }
    const record = (type: string, id: string | null) => {
      const telemetry = telemetryRef.current
      telemetry.sequence++
      telemetry.events.push({ sequence: telemetry.sequence, type, id })
      if (telemetry.events.length > 80) telemetry.events.shift()
      if (!id) return
      const counts = telemetry.counts[id] ??= emptyCounts()
      if (type === 'click') counts.clicks++
      else if (type === 'copyrequest') counts.copyRequests++
      else if (type === 'copydone') counts.copyResults++
      else if (type === 'statechange') counts.stateChanges++
      else if (type === 'clearinput') counts.clearInputs++
      else if (type === 'input') counts.inputChanges++
    }
    const countInteraction = (event: Event) => {
      if (event.timeStamp - lastInteractionAt < 30) return
      lastInteractionAt = event.timeStamp
      telemetryRef.current.interactions++
    }
    const onPointerDown = (event: PointerEvent) => {
      if (!inPreview(event)) return
      countInteraction(event)
      const trigger = eventElement(event, (element) => element.hasAttribute('data-dialog-open'))
      const name = trigger?.getAttribute('data-dialog-open')
      const id = eventId(event)
      if (name && id) telemetryRef.current.lastDialogOpener[name] = id
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || keysDown.has(event.code)) return
      keysDown.add(event.code)
      if (inPreview(event) || (bombadilTesting && event.key === 'Tab')) countInteraction(event)
    }
    const onKeyUp = (event: KeyboardEvent) => { keysDown.delete(event.code) }
    const onClick = (event: MouseEvent) => {
      if (inPreview(event)) record('click', eventId(event))
    }
    const onCopyRequest = (event: Event) => record('copyrequest', eventId(event))
    const onCopyDone = (event: Event) => record('copydone', eventId(event))
    const onStateChange = (event: Event) => {
      const id = eventId(event)
      record('statechange', id)
      const target = event.target
      if (!(target instanceof Element) || target.localName !== 'a-dialog') return
      const detail = (event as CustomEvent<{ next?: string }>).detail
      if (detail?.next !== 'closed') return
      const name = target.getAttribute('name') ?? ''
      telemetryRef.current.lastClosedDialog = {
        name,
        opener: name ? telemetryRef.current.lastDialogOpener[name] ?? null : null,
      }
    }
    const onClearInput = (event: Event) => record('clearinput', eventId(event))
    const onBeforeInput = (event: InputEvent) => {
      if (!inPreview(event)) return
      const control = eventElement(
        event,
        (element) => element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement,
      ) as HTMLInputElement | HTMLTextAreaElement | null
      if (!control) return
      pendingEdits.set(control, {
        id: eventId(event),
        before: control.value,
        inputType: event.inputType,
        inserted: event.data ?? '',
        start: control.selectionStart,
        end: control.selectionEnd,
      })
    }
    const onInput = (event: Event) => {
      if (!inPreview(event)) return
      record('input', eventId(event))
      const control = eventElement(
        event,
        (element) => element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement,
      ) as HTMLInputElement | HTMLTextAreaElement | null
      if (!control) return
      const pending = pendingEdits.get(control)
      pendingEdits.delete(control)
      if (!pending || !pending.inputType.startsWith('insert') || pending.start == null || pending.end == null) return
      const expected = `${pending.before.slice(0, pending.start)}${pending.inserted}${pending.before.slice(pending.end)}`
      const check: EditCheck = {
        id: pending.id,
        inputType: pending.inputType,
        before: pending.before,
        inserted: pending.inserted,
        expected,
        actual: control.value,
        valid: expected === control.value,
      }
      telemetryRef.current.editChecks.push(check)
      if (telemetryRef.current.editChecks.length > 40) telemetryRef.current.editChecks.shift()
      if (!check.valid) telemetryRef.current.editFailures++
      countInteraction(event)
    }

    document.addEventListener('pointerdown', onPointerDown, true)
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('keyup', onKeyUp, true)
    document.addEventListener('click', onClick, true)
    document.addEventListener('copyrequest', onCopyRequest, true)
    document.addEventListener('copydone', onCopyDone, true)
    document.addEventListener('statechange', onStateChange, true)
    document.addEventListener('clearinput', onClearInput, true)
    document.addEventListener('beforeinput', onBeforeInput, true)
    document.addEventListener('input', onInput, true)
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true)
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('keyup', onKeyUp, true)
      document.removeEventListener('click', onClick, true)
      document.removeEventListener('copyrequest', onCopyRequest, true)
      document.removeEventListener('copydone', onCopyDone, true)
      document.removeEventListener('statechange', onStateChange, true)
      document.removeEventListener('clearinput', onClearInput, true)
      document.removeEventListener('beforeinput', onBeforeInput, true)
      document.removeEventListener('input', onInput, true)
    }
  }, [bombadilTesting])

  useEffect(() => {
    let cancelled = false
    setTSXCompiling(true)
    const timer = window.setTimeout(() => {
      compileTSX(source).then((app) => {
        if (cancelled) return
        setCompiledApp(() => app)
        setCompiledSource(source)
        setTSXError(null)
        setTSXCompiling(false)
      }).catch((error) => {
        if (cancelled) return
        setCompiledApp(null)
        setCompiledSource(source)
        setTSXError(compileMessage(error))
        setTSXCompiling(false)
      })
    }, compileDelay)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [source, compileDelay])

  useEffect(() => {
    let cancelled = false
    setCSSCompiling(true)
    const timer = window.setTimeout(() => {
      compileCSS(cssSource).then((css) => {
        if (cancelled) return
        let style = document.querySelector<HTMLStyleElement>(`#${userStyleId}`)
        if (!style) {
          style = document.createElement('style')
          style.id = userStyleId
          document.head.append(style)
        }
        style.textContent = css
        setCSSError(null)
        setCSSCompiling(false)
      }).catch((error) => {
        if (cancelled) return
        setCSSError(compileMessage(error))
        setCSSCompiling(false)
      })
    }, compileDelay)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [cssSource, compileDelay])

  useEffect(() => () => document.querySelector(`#${userStyleId}`)?.remove(), [])

  useEffect(() => {
    const url = new URL(window.location.href)
    if (!url.searchParams.has('corpus-id')) return
    url.searchParams.set('corpus-id', String(scenario.index))
    history.replaceState(null, '', url)
  }, [scenario.index])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    return () => document.documentElement.classList.remove('dark')
  }, [isDark])

  useEffect(() => {
    if (!editorOpen || monacoLib) return
    let cancelled = false
    Promise.all([
      import('monaco-editor'),
      import('monaco-editor/esm/vs/editor/editor.worker?worker'),
      import('monaco-editor/esm/vs/language/typescript/ts.worker?worker'),
      import('monaco-editor/esm/vs/language/css/css.worker?worker'),
      import('@monaco-editor/react'),
    ]).then(([monaco, editorWorker, tsWorker, cssWorker, reactMod]) => {
      if (cancelled) return
      const EditorWorker = editorWorker.default
      const TsWorker = tsWorker.default
      const CSSWorker = cssWorker.default
      ;(globalThis as any).MonacoEnvironment = {
        getWorker(_id: string, label: string) {
          if (label === 'typescript' || label === 'javascript') return new TsWorker()
          if (label === 'css' || label === 'scss' || label === 'less') return new CSSWorker()
          return new EditorWorker()
        },
      }
      reactMod.loader.config({ monaco })
      setMonacoLib(reactMod)
    })
    return () => { cancelled = true }
  }, [editorOpen, monacoLib])

  const startResize = (event: JSX.TargetedPointerEvent<HTMLDivElement>) => {
    resizeStart.current = { x: event.clientX, width: editorWidth }
    setResizing(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const resize = (event: JSX.TargetedPointerEvent<HTMLDivElement>) => {
    if (!resizeStart.current) return
    const next = resizeStart.current.width + event.clientX - resizeStart.current.x
    setEditorWidth(Math.min(window.innerWidth * .6, Math.max(240, next)))
  }
  const stopResize = (event: JSX.TargetedPointerEvent<HTMLDivElement>) => {
    resizeStart.current = null
    setResizing(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
  }
  const advanceScenario = () => setIndex((value) => value === scenarios.length - 1 ? 0 : value + 1)

  const Compiled = compiledApp
  const compileError = corpusLoadError ?? tsxError ?? cssError
  const sourceIsCurrent = sourceCorpusId === scenario.index && compiledSource === source
  const compiling = corpusLoading || tsxCompiling || cssCompiling || !sourceIsCurrent
  const editorValue = editorTab === 'code' ? source : cssSource
  const compileStatus = compiling ? 'compiling' : compileError ? 'error' : 'ready'
  const snapshot: HarnessSnapshot = {
    runId: corpus.runId,
    seed: corpus.seed,
    corpusId: scenario.index,
    archetype: scenario.archetype,
    scenario: index + 1,
    total: scenarios.length,
    root: scenario.root,
    tsx: source,
    css: cssSource,
    compileStatus,
    error: compileError,
    telemetry: telemetryRef.current,
  }
  window.__antaHarness = { current: snapshot }

  return <main className={`${styles.harness} ${resizing ? styles.harnessResizing : ''}`}>
    <output hidden data-testid="harness-snapshot">{JSON.stringify(snapshot)}</output>
    {!editorOpen && <>
      <div className={styles.codeTrigger}>
        <Button
          icon="braces"
          size="large"
          priority="tertiary"
          className={styles.showEditorButton}
          title="Show editor"
          aria-label="Open generated source"
          tabIndex={bombadilTesting ? -1 : 0}
          onClick={() => setEditorOpen(true)}
        />
      </div>
      {bombadilTesting && <nav className={`${styles.navigation} ${styles.stageNavigation}`} aria-label="Generated app navigation">
        <Button data-testid="previous-scenario" label="Previous" tabIndex={-1} disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))} />
        <span>{index + 1} / {scenarios.length}</span>
        <Button data-testid="next-scenario" label="Next" tabIndex={-1} onClick={advanceScenario} />
      </nav>}
    </>}
    {editorOpen && <aside className={`${styles.editor} ${resizing ? styles.editorResizing : ''}`} style={{ width: editorWidth }} aria-label="Generated source">
      <div className={styles.editorHeader}>
        <Tabs
          className={styles.editorTabs}
          label="Source type"
          options={[
            { value: 'code', label: 'Code' },
            { value: 'css', label: 'CSS' },
          ]}
          value={editorTab}
          priority="tertiary"
          size="medium"
          onStateChange={(_event, detail) => {
            if (detail.next === 'code' || detail.next === 'css') setEditorTab(detail.next)
          }}
        />
        <div className={styles.editorActions}>
          <Button
            icon={isDark ? 'sun' : 'moon'}
            size="medium"
            priority="tertiary"
            aria-label={isDark ? 'Use light theme' : 'Use dark theme'}
            title={isDark ? 'Use light theme' : 'Use dark theme'}
            onClick={() => setIsDark((dark) => !dark)}
          />
          <Button
            icon="rotate-ccw"
            size="medium"
            priority="tertiary"
            aria-label="Reset generated source"
            title="Reset generated source"
            onClick={() => {
              setSource(generatedSource)
              setCSSSource(generatedCSS)
            }}
          />
        </div>
      </div>
      <div className={styles.closeButton}>
        <Button
          icon="x"
          size="medium"
          priority="tertiary"
          aria-label="Close generated source"
          onClick={() => { setEditorOpen(false); setResizing(false) }}
        />
      </div>
      <div className={styles.editorHost}>
        {monacoLib ? <monacoLib.Editor
          height="100%"
          beforeMount={configureMonaco}
          language={editorTab === 'code' ? 'typescript' : 'css'}
          path={editorTab === 'code' ? 'generated-app.tsx' : 'generated-app.css'}
          value={editorValue}
          theme={isDark ? 'vs-dark' : 'vs'}
          onChange={(value) => {
            if (editorTab === 'code') setSource(value ?? '')
            else setCSSSource(value ?? '')
          }}
          options={{
            readOnly: false,
            domReadOnly: false,
            automaticLayout: true,
            minimap: { enabled: false },
            scrollBeyondLastLine: false,
            fontSize: 13,
            lineHeight: 20,
            folding: true,
            formatOnPaste: true,
            formatOnType: true,
            quickSuggestions: { other: true, comments: false, strings: true },
            suggestOnTriggerCharacters: true,
            tabCompletion: 'on',
            renderLineHighlight: 'line',
            overviewRulerLanes: 0,
            padding: { top: 16, bottom: 16 },
            ariaLabel: editorTab === 'code' ? 'Generated TSX editor' : 'Generated CSS editor',
          }}
        /> : <div className={styles.editorLoading}>Loading editor…</div>}
      </div>
      {bombadilTesting && <nav className={styles.navigation} aria-label="Generated app navigation">
        <Button data-testid="previous-scenario" label="Previous" tabIndex={-1} disabled={index === 0} onClick={() => setIndex((value) => Math.max(0, value - 1))} />
        <span>{index + 1} / {scenarios.length}</span>
        <Button data-testid="next-scenario" label="Next" tabIndex={-1} onClick={advanceScenario} />
      </nav>}
      <div
        className={`${styles.resizeHandle} ${resizing ? styles.resizeHandleActive : ''}`}
        role="separator"
        aria-label="Resize generated source"
        aria-orientation="vertical"
        onPointerDown={startResize}
        onPointerMove={resize}
        onPointerUp={stopResize}
        onPointerCancel={stopResize}
      />
    </aside>}
    <section
      ref={stageRef}
      className={`${styles.stage} ${styles.preview}`}
      data-compile-status={compileStatus}
    >
      {compileError
        ? <pre className={styles.compileError}>{compileError}</pre>
        : Compiled
          ? <RenderBoundary key={source}><Compiled /></RenderBoundary>
          : <div className={styles.compileStatus}>Compiling…</div>}
    </section>
  </main>
}
