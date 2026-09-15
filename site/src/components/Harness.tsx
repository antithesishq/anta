import { Component, Fragment, h, type ComponentChildren, type ComponentType } from 'preact'
import { useEffect, useState } from 'preact/hooks'
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

class RenderBoundary extends Component<{ children: ComponentChildren }, { error: Error | null }> {
  state = { error: null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    return this.state.error
      ? <pre className={styles.compileError}>{String(this.state.error)}</pre>
      : this.props.children
  }
}

export default function Harness() {
  const [source, setSource] = useState(initialSource)
  const [isDark, setIsDark] = useState(false)
  const [compiled, setCompiled] = useState<CompiledApp | null>(null)
  const [compiledSource, setCompiledSource] = useState('')
  const [compileError, setCompileError] = useState<string | null>(null)
  const [compiling, setCompiling] = useState(true)
  const [editorOpen, setEditorOpen] = useState(() => window.matchMedia('(min-width: 721px)').matches)

  useEffect(() => {
    let cancelled = false
    setCompiling(true)
    setCompileError(null)
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

  const compileStatus = compiling || compiledSource !== source
    ? compileError ? 'error' : 'compiling'
    : 'ready'
  const App = compiled

  return <main className={styles.harness}>
    <section
      className={`${styles.stage} ${styles.preview}`}
      aria-busy={compileStatus === 'compiling'}
      data-compile-status={compileStatus}
    >
      {compileError
        ? <pre className={styles.compileError}>{compileError}</pre>
        : App
          ? <RenderBoundary key={compiledSource}><App /></RenderBoundary>
          : <div className={styles.compileStatus}>Compiling…</div>}
    </section>
    {editorOpen && <HarnessEditor
      source={source}
      isDark={isDark}
      onChange={setSource}
      onThemeChange={() => setIsDark((value) => !value)}
      onClose={() => setEditorOpen(false)}
    />}
    {!editorOpen && <Button
      className={styles.showEditorButton}
      icon="braces"
      priority="tertiary"
      aria-label="Open component editor"
      onClick={() => setEditorOpen(true)}
    />}
  </main>
}
