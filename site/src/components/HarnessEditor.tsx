import { type JSX } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'
import * as Anta from '@antadesign/anta'
import styles from './Harness.module.css'

const { Button } = Anta
const defaultWidth = 420
const minimumWidth = 280
const previewMinimumWidth = 240
type MonacoEditorLib = typeof import('@monaco-editor/react')
let monacoConfigured = false

type HarnessEditorProps = {
  source: string
  isDark: boolean
  onChange: (source: string) => void
  onThemeChange: () => void
  onClose: () => void
}

function configureMonaco(monaco: typeof import('monaco-editor')) {
  if (monacoConfigured) return
  const typescript = monaco.typescript
  typescript.typescriptDefaults.setCompilerOptions({
    allowNonTsExtensions: true,
    jsx: typescript.JsxEmit.React,
    jsxFactory: 'h',
    jsxFragmentFactory: 'Fragment',
    module: typescript.ModuleKind.ESNext,
    target: typescript.ScriptTarget.ESNext,
    noEmit: true,
  })
  const exports = Object.keys(Anta)
    .filter((name) => name !== 'default' && /^[A-Za-z_$][\w$]*$/.test(name))
    .map((name) => `export const ${name}: any`)
    .join('\n')
  typescript.typescriptDefaults.addExtraLib(
    `declare module '@antadesign/anta' { ${exports} } declare function h(...args: any[]): any; declare const Fragment: any;`,
    'file:///anta-harness.d.ts',
  )
  monacoConfigured = true
}

export default function HarnessEditor({ source, isDark, onChange, onThemeChange, onClose }: HarnessEditorProps) {
  const [width, setWidth] = useState(defaultWidth)
  const [resizing, setResizing] = useState(false)
  const [monacoLib, setMonacoLib] = useState<MonacoEditorLib | null>(null)
  const resizeStartRef = useRef<{ pointerX: number; width: number } | null>(null)
  const maximumWidth = Math.max(minimumWidth, window.innerWidth - previewMinimumWidth)
  const updateWidth = (nextWidth: number) => {
    setWidth(Math.min(maximumWidth, Math.max(minimumWidth, nextWidth)))
  }

  useEffect(() => {
    if (monacoLib) return
    let cancelled = false
    Promise.all([
      import('monaco-editor'),
      import('monaco-editor/editor/editor.worker?worker'),
      import('monaco-editor/languages/features/typescript/ts.worker?worker'),
      import('@monaco-editor/react'),
    ]).then(([monaco, editorWorker, tsWorker, reactMod]) => {
      if (cancelled) return
      const EditorWorker = editorWorker.default
      const TsWorker = tsWorker.default
      ;(globalThis as any).MonacoEnvironment = {
        getWorker(_id: string, label: string) {
          return label === 'typescript' || label === 'javascript' ? new TsWorker() : new EditorWorker()
        },
      }
      reactMod.loader.config({ monaco })
      setMonacoLib(reactMod)
    })
    return () => {
      cancelled = true
    }
  }, [monacoLib])

  const startResize = (event: JSX.TargetedPointerEvent<HTMLDivElement>) => {
    resizeStartRef.current = { pointerX: event.clientX, width }
    setResizing(true)
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const resize = (event: JSX.TargetedPointerEvent<HTMLDivElement>) => {
    if (!resizeStartRef.current) return
    updateWidth(resizeStartRef.current.width + event.clientX - resizeStartRef.current.pointerX)
  }
  const resizeWithKeyboard = (event: JSX.TargetedKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return
    event.preventDefault()
    updateWidth(width + (event.key === 'ArrowLeft' ? -20 : 20))
  }
  const stopResize = (event: JSX.TargetedPointerEvent<HTMLDivElement>) => {
    resizeStartRef.current = null
    setResizing(false)
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
  }

  return <aside
    className={`${styles.editor} ${resizing ? styles.editorResizing : ''}`}
    style={{ '--editor-width': `${width}px` } as JSX.CSSProperties}
    aria-label="Generated source editor"
  >
    <div className={styles.editorHeader}>
      <strong>TSX editor</strong>
      <div className={styles.editorActions}>
        <Button
          icon={isDark ? 'sun' : 'moon'}
          priority="tertiary"
          aria-label={isDark ? 'Use light theme' : 'Use dark theme'}
          onClick={onThemeChange}
        />
        <Button icon="x" priority="tertiary" aria-label="Close editor" onClick={onClose} />
      </div>
    </div>
    <div className={styles.editorHost}>
      {monacoLib
        ? <monacoLib.Editor
            height="100%"
            beforeMount={configureMonaco}
            language="typescript"
            path="generated-app.tsx"
            value={source}
            theme={isDark ? 'vs-dark' : 'vs'}
            onChange={(value) => onChange(value ?? '')}
            options={{
              readOnly: false,
              domReadOnly: false,
              automaticLayout: true,
              minimap: { enabled: false },
              overviewRulerLanes: 0,
              glyphMargin: false,
              folding: false,
              lineNumbersMinChars: 2,
              renderLineHighlight: 'none',
              scrollBeyondLastLine: false,
              scrollbar: { horizontal: 'hidden', horizontalScrollbarSize: 0, verticalScrollbarSize: 8 },
              wordWrap: 'on',
              wrappingIndent: 'indent',
              fontSize: 13,
              lineHeight: 20,
              padding: { top: 16, bottom: 16 },
              ariaLabel: 'Generated component TSX editor',
            }}
          />
        : <div className={styles.editorLoading}>Loading editor…</div>}
    </div>
    <div
      className={styles.resizeHandle}
      role="separator"
      tabIndex={0}
      title="Drag to resize the editor"
      aria-label="Resize generated source editor"
      aria-orientation="vertical"
      aria-valuemin={minimumWidth}
      aria-valuemax={maximumWidth}
      aria-valuenow={width}
      onDoubleClick={() => updateWidth(defaultWidth)}
      onKeyDown={resizeWithKeyboard}
      onPointerDown={startResize}
      onPointerMove={resize}
      onPointerUp={stopResize}
      onPointerCancel={stopResize}
    />
  </aside>
}
