import { Component, Fragment, h, type ComponentChildren, type ComponentType } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import * as Anta from '@antadesign/anta'
import HarnessEditor from './HarnessEditor'
import styles from './Harness.module.css'

const { Button } = Anta
const initialSource = `import { Button } from '@antadesign/anta'

export default function App() {
  return <Button label="Hello, Anta" />
}
`
type CompiledApp = ComponentType<Record<string, never>>
type HarnessCompileResult = { status: 'ready' | 'error', error?: string }
type HarnessState = HarnessCompileResult | { status: 'compiling' }
type HarnessController = {
  setSource(source: string): Promise<HarnessCompileResult>
}

declare global {
  interface Window {
    antaHarness?: HarnessController
  }
}

let esbuildPromise: Promise<typeof import('esbuild-wasm')> | null = null

async function getEsbuild() {
  if (!esbuildPromise) {
    esbuildPromise = (async () => {
      const esbuild = await import('esbuild-wasm')
      await esbuild.initialize({ wasmURL: '/esbuild.wasm', worker: true }).catch((error) => {
        // Vite HMR can recreate this module while esbuild-wasm remains initialized.
        if (!/initialized|initialize.*once|once.*initialize/i.test(String(error))) throw error
      })
      return esbuild
    })()
  }
  try {
    return await esbuildPromise
  } catch (error) {
    esbuildPromise = null
    throw error
  }
}

async function compileTSX(source: string): Promise<CompiledApp> {
  const esbuild = await getEsbuild()
  const executable = source
    .replace(/import\s*\{[^}]*\}\s*from\s*['"]@antadesign\/anta['"]\s*;?/g, '')
    .replace(/import\s*\{[^}]*\}\s*from\s*['"]react['"]\s*;?/g, '')
    .replace(/export\s+default\s+function\s+App/, 'function App')
  if (/^\s*import\s/m.test(executable)) throw new Error('Only @antadesign/anta and react imports are supported.')
  const result = await esbuild.transform(executable, {
    loader: 'tsx',
    sourcefile: 'generated.tsx',
    target: 'es2022',
    format: 'esm',
    jsx: 'transform',
    jsxFactory: 'h',
    jsxFragment: 'Fragment',
  })
  const entries = Object.entries(Anta).filter(([name]) => name !== 'default' && /^[A-Za-z_$][\w$]*$/.test(name))
  const names = ['h', 'Fragment', 'useEffect', 'useState', ...entries.map(([name]) => name)]
  const values = [h, Fragment, useEffect, useState, ...entries.map(([, value]) => value)]
  const App = new Function(...names, `"use strict";${result.code}\nreturn App`)(...values)
  if (typeof App !== 'function') throw new Error('Generated source must export default function App().')
  return App as CompiledApp
}

class RenderBoundary extends Component<{ children: ComponentChildren, onError(error: Error): void }, { error: Error | null }> {
  state = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  componentDidCatch(error: Error) {
    this.props.onError(error)
  }

  componentDidUpdate(_previousProps: Readonly<{ children: ComponentChildren, onError(error: Error): void }>, previousState: Readonly<{ error: Error | null }>) {
    if (this.state.error && this.state.error !== previousState.error) this.props.onError(this.state.error)
  }

  render() {
    return this.state.error
      ? <pre className={styles.compileError}>{String(this.state.error)}</pre>
      : this.props.children
  }
}

export default function Harness() {
  const testing = new URLSearchParams(window.location.search).get('testing') === 'true'
  const [source, setSource] = useState(initialSource)
  const [isDark, setIsDark] = useState(false)
  const [compiled, setCompiled] = useState<CompiledApp | null>(null)
  const [compiledSource, setCompiledSource] = useState('')
  const [compileError, setCompileError] = useState<string | null>(null)
  const [renderError, setRenderError] = useState<string | null>(null)
  const [compiling, setCompiling] = useState(true)
  const [editorOpen, setEditorOpen] = useState(() => !testing && window.matchMedia('(min-width: 721px)').matches)
  const pendingSources = useRef(new Map<number, {
    source: string
    resolve: (result: HarnessCompileResult) => void
  }>())
  const nextRequestId = useRef(0)
  const latestState = useRef<HarnessState>({ status: 'compiling' })

  useEffect(() => {
    let cancelled = false
    setCompiling(true)
    setCompileError(null)
    setRenderError(null)
    const timer = window.setTimeout(() => compileTSX(source).then((App) => {
      if (cancelled) return
      setCompiled(() => App)
      setCompiledSource(source)
      setCompileError(null)
      setCompiling(false)
    }).catch((error) => {
      if (cancelled) return
      setCompileError(error instanceof Error ? error.message : String(error))
      setCompiling(false)
    }), 160)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [source])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', isDark)
    return () => document.documentElement.classList.remove('dark')
  }, [isDark])

  const harnessState: HarnessState = compileError || renderError
    ? { status: 'error', error: compileError ?? renderError ?? undefined }
    : compiling || compiledSource !== source
      ? { status: 'compiling' }
      : { status: 'ready' }
  latestState.current = harnessState
  const compileStatus = harnessState.status
  const App = compiled

  useEffect(() => {
    const bridge = {
      setSource(nextSource: string) {
        return new Promise<HarnessCompileResult>((resolve) => {
          const id = nextRequestId.current++
          pendingSources.current.set(id, { source: nextSource, resolve })
          setSource(nextSource)
        })
      },
    }
    window.antaHarness = bridge
    return () => {
      if (window.antaHarness === bridge) delete window.antaHarness
      for (const { resolve } of pendingSources.current.values()) resolve({ status: 'error', error: 'Harness unmounted.' })
      pendingSources.current.clear()
    }
  }, [])

  useEffect(() => {
    if (compileStatus === 'compiling') return
    for (const [id, pending] of pendingSources.current) {
      if (pending.source !== source) continue
      pendingSources.current.delete(id)
      const settle = () => {
        const current = latestState.current
        if (current.status === 'compiling') {
          requestAnimationFrame(settle)
          return
        }
        pending.resolve(current)
      }
      requestAnimationFrame(() => requestAnimationFrame(settle))
    }
  }, [compileStatus, source])

  return <main className={styles.harness}>
    <section
      className={`${styles.stage} ${styles.preview}`}
      aria-busy={compileStatus === 'compiling'}
      data-compile-status={compileStatus}
    >
      {compileError
        ? <pre className={styles.compileError}>{compileError}</pre>
        : App
          ? <RenderBoundary key={compiledSource} onError={(error) => setRenderError(String(error))}><App /></RenderBoundary>
          : <div className={styles.compileStatus}>Compiling…</div>}
    </section>
    {!testing && editorOpen && <HarnessEditor
      source={source}
      isDark={isDark}
      onChange={setSource}
      onThemeChange={() => setIsDark((value) => !value)}
      onClose={() => setEditorOpen(false)}
    />}
    {!testing && !editorOpen && <Button
      className={styles.showEditorButton}
      icon="braces"
      priority="tertiary"
      aria-label="Open component editor"
      onClick={() => setEditorOpen(true)}
    />}
  </main>
}
