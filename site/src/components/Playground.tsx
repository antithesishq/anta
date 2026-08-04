/**
 * Playground — single-component playground.
 *
 *   <Playground component="Progress" initialCode={`...`} client:load />
 *
 * Renders three regions:
 *   - A live preview, isolated inside an iframe so user CSS / DOM
 *     changes can't touch the docs page.
 *   - A props form auto-generated from `api.json` for the bound
 *     component. Every form edit performs a targeted string
 *     replacement on the source code (so siblings like a `<style>`
 *     block are preserved).
 *   - A Monaco editor showing the same source. Hand-edits feed back
 *     into the form (best-effort literal-attribute scan) and back
 *     into the iframe via the in-browser bundler (esbuild-wasm).
 *
 * See site/lib/sandbox/* for the moving parts.
 */
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { Input, Tooltip, Text, Checkbox, Select, Tabs } from '@antadesign/anta'
import { marked } from 'marked'
import s from './Playground.module.css'
// Monaco ships its structural CSS as ~110 separate `import './x.css'`
// side-effect imports inside its ESM build. Vite injects each one
// live in dev (so the editor looks right under `pnpm dev`) but emits
// none of them into the production bundle, since they're only reached
// through the lazily-imported `monaco-editor` chunk. Without these
// rules the editor's hidden <textarea> (`.inputarea`) falls back to
// the UA default (border + resize grip) and the layout breaks. Pull
// in Monaco's concatenated stylesheet statically so it's always part
// of this island's CSS in both dev and prod.
import 'monaco-editor/min/vs/editor/editor.main.css'

import { controlsFor, controlsForExample, CONDITIONAL_PROPS, type Control, type PropEntry } from '../../lib/sandbox/props-form.ts'
import { bundle, type BundleResult } from '../../lib/sandbox/bundler.ts'
import { moduleManifest } from '../../lib/sandbox/modules.ts'
import { IFRAME_ASSETS } from '../generated/iframe-assets'
import { replaceProp, readChildren } from '../../lib/sandbox/prop-patch.ts'
import { readProp } from '../../lib/sandbox/prop-read.ts'
import { parseExamples, type Example } from '../../lib/sandbox/parse-examples.ts'
import { throttle } from 'es-toolkit'

/** The prose column width (matches the 960px measure in base.css). The
 *  playground starts here and can't be resized narrower. */
const COLUMN_WIDTH = 960

// Lazily loaded inside an effect so the docs page paints without
// blocking on Monaco's ~1.5 MB bundle.
type MonacoEditorLib = typeof import('@monaco-editor/react')

interface Props {
  /** Anta component name to bind the props form to. Must match the
   *  TypeScript interface `{component}Props` in `api.json`. */
  component: string
  /** Initial code (TSX) shown in the editor and run in the iframe. */
  initialCode: string
  /** Optional initial CSS for the CSS tab. Useful for centering the
   *  preview, hiding scrollbars, etc. Empty by default. */
  initialCss?: string
  /** Visual arrangement.
   *  - `stacked` (default): preview on top, tabbed panel underneath.
   *  - `side`: preview on the left, tabbed panel on the right.
   *  Mobile (≤ 900 px) always collapses to `stacked`. */
  layout?: 'stacked' | 'side'
  /** Fixed height of the props/code panel, in pixels. Set so the
   *  playground doesn't grow with form content and so switching tabs
   *  doesn't reflow. Defaults to 400. */
  panelHeight?: number
  /** Whether the Code editor initially folds every foldable region.
   *  Defaults to false so source opens expanded. */
  codeInitiallyFolded?: boolean
}

type Tab = 'props' | 'code' | 'css'

export default function Playground({ component, initialCode, initialCss = '', layout = 'stacked', panelHeight = 400, codeInitiallyFolded = false }: Props) {
  const [code, setCode] = useState(initialCode)
  // CSS state is independent of the code — the user owns it. The CSS
  // tab is unconditionally available; no auto-seed from any className
  // in the JSX. If a user wants to style a class, they write the rule
  // by hand and add `className="…"` themselves.
  const [styles, setStyles] = useState<string>(initialCss)
  const [bundleState, setBundleState] = useState<BundleResult | { ok: false; message: string; pending: true } | null>({
    ok: false,
    message: 'Compiling…',
    pending: true,
  } as any)
  const [runtimeError, setRuntimeError] = useState<string | null>(null)
  const [monacoLib, setMonacoLib] = useState<MonacoEditorLib | null>(null)
  const [tab, setTab] = useState<Tab>('props')
  const [previewHeight, setPreviewHeight] = useState(96)
  const [panelWidth, setPanelWidth] = useState(400)
  const draggingRef = useRef(false)
  const bodyRef = useRef<HTMLDivElement | null>(null)
  // Whole-widget size, driven by the bottom-right corner grip (side
  // layout). Width is the *preferred* width: `null` means "full track"
  // and sticks there; a number is held until the track squeezes it
  // (see `width: min(--pg-w, 100%)`). Centered, so only the preview
  // (the 1fr grid column) grows — the panel keeps its width.
  const [widgetWidth, setWidgetWidth] = useState<number | null>(COLUMN_WIDTH)
  const [widgetHeight, setWidgetHeight] = useState(panelHeight)
  const rootRef = useRef<HTMLElement | null>(null)
  const cornerDraggingRef = useRef(false)
  const [isDark, setIsDark] = useState<boolean>(() =>
    typeof document !== 'undefined' && document.documentElement.classList.contains('dark'),
  )
  const [monoFontFamily, setMonoFontFamily] = useState<string>('')
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const iframeReadyRef = useRef(false)
  // True once a render has thrown (runtime error). A thrown render can leave
  // Preact's bookkeeping on `#root` half-committed, so the *next* successful
  // bundle re-mounts into a fresh root (see `pushBundleToIframe`'s `resetRoot`)
  // — that's how a fixed edit fully recovers instead of diffing broken state.
  const renderErroredRef = useRef(false)
  const monacoRef = useRef<any>(null)
  const editorRef = useRef<any>(null)
  const cssEditorRef = useRef<any>(null)
  // True while a `setCode` originated from the user typing in the TSX
  // editor (so the editor already holds that text). The `code`-sync
  // effect uses this to skip echoing the value back into Monaco —
  // pushing it back races with fast typing and scrambles the input.
  const editorChangePendingRef = useRef(false)
  // True while the sync effect is applying an external edit to the
  // model, so the resulting `onDidChangeModelContent` → onChange echo
  // is ignored (mirrors @monaco-editor/react's own guard).
  const applyingExternalRef = useRef(false)
  const tsxHostRef = useRef<HTMLDivElement | null>(null)
  const cssHostRef = useRef<HTMLDivElement | null>(null)
  // Fires playground_code_edited once per playground instance so repeated
  // keystrokes don't flood PostHog with events.
  const hasTrackedEditRef = useRef(false)

  // Parse JSDoc-headed JSX blocks out of the user's source. Each
  // headed block becomes one entry in the Props accordion; the
  // bundler also receives this list so it can strip JSDocs before
  // wrapping the JSX in a Fragment.
  const examples = useMemo(() => parseExamples(code), [code])

  // Track the parent's dark-mode state — drives both Monaco's theme
  // and the resolved value of --bg-canvas.
  useEffect(() => {
    const apply = () => setIsDark(document.documentElement.classList.contains('dark'))
    apply()
    const obs = new MutationObserver(apply)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
    return () => obs.disconnect()
  }, [])

  // Lazy-load Shiki + its Monaco adapter and create a TextMate-backed
  // highlighter with the two themes the docs site already uses for
  // expressive-code blocks. Once ready, Monaco's tokenizer for the
  // `typescript` and `css` languages is replaced via shikiToMonaco
  // (`installShikiBridge` in beforeMount); the playground inherits
  // VS Code's exact syntax coloring.
  const [shikiBundle, setShikiBundle] = useState<{
    highlighter: any
    shikiToMonaco: (highlighter: any, monaco: any) => void
    textmateThemeToMonacoTheme: (t: any) => any
  } | null>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([import('shiki'), import('@shikijs/monaco')]).then(([shiki, sm]) =>
      shiki.createHighlighter({
        themes: ['github-light', 'tokyo-night'],
        langs: ['tsx', 'css'],
      }).then((highlighter) => {
        if (cancelled) {
          highlighter.dispose?.()
          return
        }
        setShikiBundle({
          highlighter,
          shikiToMonaco: sm.shikiToMonaco,
          textmateThemeToMonacoTheme: sm.textmateThemeToMonacoTheme,
        })
      }),
    )
    return () => {
      cancelled = true
    }
  }, [])

  // Mirror docs-site dark-mode into Monaco by switching between the
  // two Shiki themes. We also overlay our `--bg-canvas` token onto
  // the active theme's `editor.background` so the editor pane blends
  // with the surrounding card instead of using Shiki's default
  // off-white / dark-navy. `--bg-canvas` is mode-dependent, so we
  // resolve it here (after the dark class has already flipped) and
  // re-define the theme each time.
  useEffect(() => {
    const monaco = monacoRef.current
    if (!monaco || !shikiBundle) return
    overlayBgOnShikiThemes(monaco, shikiBundle)
    monaco.editor.setTheme(isDark ? 'tokyo-night' : 'github-light')
  }, [isDark, shikiBundle])

  // Observe each editor's host and tell its editor to relayout.
  // Monaco's `automaticLayout` polls at ~100ms and frequently misses
  // the first settle of a tab-swapped flex container; a
  // ResizeObserver on the host is reliable. Both editors (TSX and
  // CSS) share this hook.
  useEffect(() => {
    const tsxHost = tsxHostRef.current
    const cssHost = cssHostRef.current
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const ed = entry.target === tsxHost ? editorRef.current : cssEditorRef.current
        if (!ed) continue
        const r = (entry.target as HTMLElement).getBoundingClientRect()
        ed.layout({ width: r.width, height: r.height })
      }
    })
    if (tsxHost) ro.observe(tsxHost)
    if (cssHost) ro.observe(cssHost)
    return () => ro.disconnect()
  }, [monacoLib])


  // Resolve Anta's --monospace token for Monaco's fontFamily option —
  // Monaco doesn't read CSS variables itself.
  useEffect(() => {
    const v = getComputedStyle(document.documentElement)
      .getPropertyValue('--monospace')
      .trim()
    if (v) setMonoFontFamily(v)
  }, [])

  const controls = useMemo(() => controlsFor(component), [component])

  // Lazy-load Monaco from npm (not jsdelivr CDN) and wire up the
  // three workers we use — the docs site is now self-contained, no
  // third-party JS fetch. `MonacoEnvironment.getWorker` returns the
  // matching Web Worker for each Monaco language; everything else
  // falls back to the generic editor worker. `loader.config({ monaco })`
  // is what tells @monaco-editor/react to skip its CDN bootstrap and
  // use the bundled namespace.
  useEffect(() => {
    let cancelled = false
    Promise.all([
      import('monaco-editor'),
      import('monaco-editor/esm/vs/editor/editor.worker?worker'),
      import('monaco-editor/esm/vs/language/typescript/ts.worker?worker'),
      import('monaco-editor/esm/vs/language/css/css.worker?worker'),
      import('@monaco-editor/react'),
    ]).then(([monacoNs, editorWorker, tsWorker, cssWorker, reactMod]) => {
      if (cancelled) return
      const EditorWorker = editorWorker.default
      const TsWorker = tsWorker.default
      const CssWorker = cssWorker.default
      ;(globalThis as any).MonacoEnvironment = {
        getWorker(_id: string, label: string) {
          if (label === 'typescript' || label === 'javascript') return new TsWorker()
          if (label === 'css' || label === 'scss' || label === 'less') return new CssWorker()
          return new EditorWorker()
        },
      }
      reactMod.loader.config({ monaco: monacoNs })
      setMonacoLib(reactMod)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Compile pipeline: debounce + bundle + push to iframe.
  useEffect(() => {
    let cancelled = false
    const timer = setTimeout(async () => {
      const result = await bundle(code, styles)
      if (cancelled) return
      setBundleState(result)
      if (result.ok && iframeRef.current && iframeReadyRef.current) {
        // If the previous render threw, re-mount into a fresh root so a fixed
        // edit recovers cleanly rather than diffing against half-committed state.
        const resetRoot = renderErroredRef.current
        renderErroredRef.current = false
        pushBundleToIframe(iframeRef.current, result.code, resetRoot)
        setRuntimeError(null)
      }
    }, 200)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [code, styles])

  // Listen for runtime errors + content-height updates from the iframe.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      if (!e.data || typeof e.data !== 'object') return
      if (e.data.__demo === 'runtime-error') {
        setRuntimeError(String(e.data.message ?? 'Unknown runtime error'))
        // Flag so the next successful bundle re-mounts into a fresh root.
        renderErroredRef.current = true
      } else if (e.data.__demo === 'runtime-clear') {
        setRuntimeError(null)
      } else if (e.data.__demo === 'content-height') {
        // Clamp to a sensible range so a runaway render can't grow the
        // demo to fill the viewport.
        const h = Math.max(64, Math.min(800, Number(e.data.height) || 96))
        setPreviewHeight(h)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  // Initialise the iframe (clone stylesheets, seed __demo_modules__,
  // register custom elements, set up dark-mode mirror). srcdoc iframes
  // can `load` before the Preact reconciler attaches `onLoad`, so we
  // poll readyState here and fall back to a `load` listener.
  useEffect(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    let cancelled = false
    function init() {
      if (cancelled) return
      const doc = iframe.contentDocument
      if (!doc || !iframe.contentWindow) return
      setupIframe(iframe)
      iframeReadyRef.current = true
      // If a bundle is already compiled, push it now.
      if (bundleState && (bundleState as any).ok) {
        pushBundleToIframe(iframe, (bundleState as BundleResult & { code: string }).code)
      }
    }
    // Set srcdoc client-side (window exists here) so the import-map / asset URLs
    // resolve against the real origin — SSR has no window and would bake a wrong
    // host (ERR_CONNECTION_REFUSED). Listener first, then assign, so the fresh
    // srcdoc's `load` is always caught → init() → setupIframe.
    iframe.addEventListener('load', init)
    iframe.srcdoc = buildSrcdoc()
    return () => {
      cancelled = true
      iframe.removeEventListener('load', init)
    }
    // The iframe is mounted exactly once per component instance.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Form edits don't rewrite `code` on every event — doing so re-synced
  // Monaco's model and re-parsed every field on each slider tick, which
  // is what made the inputs feel sticky. Instead each change lands
  // instantly in the control's local state (see FormField) and is queued
  // here, keyed by prop (+example). A throttled flush rewrites the source
  // at most ~7×/s — leading+trailing edges keep the preview live during a
  // drag rather than only updating on release. Keying by prop means
  // adjusting two props in quick succession can't drop one: the map keeps
  // the latest value per key and the flush applies them all.
  const pendingEditsRef = useRef(
    new Map<
      string,
      { prop: PropEntry; value: string | number | boolean | null; exampleId?: string }
    >(),
  )

  const flushFormEdits = useMemo(
    () =>
      throttle(() => {
        const edits = Array.from(pendingEditsRef.current.values())
        pendingEditsRef.current.clear()
        if (edits.length === 0) return
        // Apply every queued edit in one functional update so we read
        // the LATEST source (a Monaco edit or Reset may have raced) and
        // commit a single new `code`. Per-example edits re-parse the
        // boundaries inside the updater — they shift as the file grows.
        setCode((prev) => {
          let next = prev
          for (const { prop, value, exampleId } of edits) {
            if (!exampleId) {
              next = replaceProp(next, component, prop.prop, value)
              continue
            }
            const latest = parseExamples(next).find((e) => e.id === exampleId)
            if (!latest || !latest.tagName) continue
            next = replaceProp(next, latest.tagName, prop.prop, value, {
              start: latest.jsxStart,
              end: latest.jsxEnd,
            })
          }
          return next
        })
      }, 150),
    [component],
  )

  // Drop any trailing flush if the playground unmounts.
  useEffect(() => () => flushFormEdits.cancel(), [flushFormEdits])

  function handleFormChange(
    prop: PropEntry,
    value: string | number | boolean | null,
    exampleId?: string,
  ) {
    pendingEditsRef.current.set(`${exampleId ?? 'root'}::${prop.prop.name}`, {
      prop,
      value,
      exampleId,
    })
    flushFormEdits()
  }

  // ────────────────────────────────────────────────────────────────
  // Resize handle (side layout only). Pointer-capture lets the
  // pointermove keep firing on the handle element even when the
  // cursor outruns the slim hit area during a fast drag.

  function startResize(e: any) {
    if (layout !== 'side') return
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    draggingRef.current = true
  }
  function onResizeMove(e: any) {
    if (!draggingRef.current || !bodyRef.current) return
    const r = bodyRef.current.getBoundingClientRect()
    // The panel is on the right; its width is the distance from the
    // cursor to the body's right edge, clamped so neither side
    // collapses below a usable minimum.
    const next = Math.max(240, Math.min(r.width - 240, r.right - e.clientX))
    setPanelWidth(next)
  }
  function endResize(e: any) {
    draggingRef.current = false
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
  }

  // Bottom-right corner grip — resizes the whole widget. Width grows
  // symmetrically about the widget's centre (it's centered in the lane),
  // so the grip tracks the right edge while the widget stays aligned;
  // capped at the available track and snapped to "full" (sticks) at the
  // edge. Height grows downward, capped at 90vh.
  function startCornerResize(e: any) {
    if (layout !== 'side') return
    e.preventDefault()
    try { e.currentTarget.setPointerCapture(e.pointerId) } catch {}
    cornerDraggingRef.current = true
  }
  function onCornerMove(e: any) {
    if (!cornerDraggingRef.current || !rootRef.current || !bodyRef.current) return
    // The section's flow container is the disclosure body; the
    // astro-island wrapper in between is display:contents (zero box),
    // so walk past any such wrappers to a real layout box.
    let container = rootRef.current.parentElement
    while (container && getComputedStyle(container).display === 'contents') {
      container = container.parentElement
    }
    if (!container) return
    const cr = container.getBoundingClientRect()
    const maxW = cr.width // the full-bleed track (already inside the lane padding)
    const centerX = cr.left + cr.width / 2
    const w = 2 * (e.clientX - centerX)
    if (w >= maxW - 8) {
      setWidgetWidth(null) // snap to full track + stick there
    } else {
      // Floor at the prose column width (960) so the widget never gets
      // narrower than a normal text block; cap at the track.
      setWidgetWidth(Math.min(maxW, Math.max(COLUMN_WIDTH, w)))
    }
    const b = bodyRef.current.getBoundingClientRect()
    // Floor at the originally-prescribed height; cap at 90vh.
    setWidgetHeight(Math.max(panelHeight, Math.min(window.innerHeight * 0.9, e.clientY - b.top)))
  }
  function endCornerResize(e: any) {
    cornerDraggingRef.current = false
    try { e.currentTarget.releasePointerCapture(e.pointerId) } catch {}
  }

  function handleEditorChange(next: string | undefined) {
    if (next == null) return
    // Ignore the echo from our own external-sync edit (see effect below).
    if (applyingExternalRef.current) return
    // This change came from the user typing in the editor, so the
    // editor's model is already the source of truth — mark it so the
    // `code`-sync effect below does NOT push the (now-stale, one render
    // behind) string back into Monaco. Pushing it back is what raced
    // with in-flight keystrokes and scrambled the text / reset the
    // caret when typing inside a tag (e.g. adding `style={{…}}`); see
    // the sync effect for the full story.
    setCode((prev) => {
      if (prev === next) return prev
      // Flag set inside the updater so it only trips when `code` will
      // actually change (and thus the sync effect will actually run to
      // clear it) — avoids a stale flag swallowing a later external edit.
      editorChangePendingRef.current = true
      return next
    })
    if (!hasTrackedEditRef.current) {
      hasTrackedEditRef.current = true
      ;(window as any).posthog?.capture('playground_code_edited', { component })
    }
  }

  // Sync EXTERNAL `code` changes (form-control edits, the Reset button)
  // into the TSX editor's model. Typing in the editor is excluded via
  // `editorChangePendingRef` — that path's text is already in the model,
  // and re-pushing it is exactly what scrambled fast typing back when the
  // editor was controlled by `value={code}`. For a genuine external edit
  // we replace only the changed run (common-prefix/suffix diff) so the
  // caret and selection stay put, then `pushUndoStop` so it's one undo.
  useEffect(() => {
    if (editorChangePendingRef.current) {
      editorChangePendingRef.current = false
      return
    }
    const editor = editorRef.current
    const model = editor?.getModel?.()
    if (!model) return
    const current = model.getValue()
    if (current === code) return
    // Narrow the edit to the differing middle so unchanged regions (and
    // the caret outside them) aren't disturbed.
    let p = 0
    const minLen = Math.min(current.length, code.length)
    while (p < minLen && current[p] === code[p]) p++
    let sCur = current.length
    let sNew = code.length
    while (sCur > p && sNew > p && current[sCur - 1] === code[sNew - 1]) {
      sCur--
      sNew--
    }
    const start = model.getPositionAt(p)
    const end = model.getPositionAt(sCur)
    const range = {
      startLineNumber: start.lineNumber,
      startColumn: start.column,
      endLineNumber: end.lineNumber,
      endColumn: end.column,
    }
    applyingExternalRef.current = true
    editor.executeEdits('external-sync', [
      { range, text: code.slice(p, sNew), forceMoveMarkers: true },
    ])
    editor.pushUndoStop()
    applyingExternalRef.current = false
  }, [code])

  // ────────────────────────────────────────────────────────────────
  // Render

  const compileError = bundleState && !(bundleState as any).ok && !(bundleState as any).pending
    ? (bundleState as { ok: false; message: string }).message
    : null

  const bodyClass = layout === 'side' ? `${s.body} ${s.bodySide}` : s.body

  return (
    <section
      ref={rootRef}
      class={s.root}
      style={
        layout === 'side'
          ? ({
              '--pg-w': widgetWidth == null ? '100%' : `${widgetWidth}px`,
              width: 'min(var(--pg-w), 100%)',
              maxWidth: 'none', // let the corner grip widen past 960
              marginInline: 'auto',
            } as any)
          : undefined
      }
    >
      <div
        class={bodyClass}
        ref={bodyRef}
        style={layout === 'side' ? ({ '--demo-panel-w': `${panelWidth}px` } as any) : undefined}
      >
        <div class={s.preview}>
          <div class={s.previewHeader}>Preview</div>
          <iframe
            ref={iframeRef}
            class={s.previewFrame}
            // srcdoc is set imperatively in the mount effect — it must be built
            // client-side (asset URLs need the real origin; SSR has no window).
            title={`${component} interactive demo preview`}
            // In `side` layout the preview fills the grid row (its
            // sibling panel drives the height); we let the iframe
            // body scroll on overflow. In `stacked` layout the
            // iframe's content-height observer drives the height so
            // the demo sits as tall as its rendered preview.
            style={layout === 'side' ? undefined : { height: `${previewHeight}px` }}
          />
        </div>

        {layout === 'side' && (
          <div
            class={s.resizeHandle}
            role="separator"
            aria-orientation="vertical"
            aria-label="Resize playground panel"
            onPointerDown={startResize}
            onPointerMove={onResizeMove}
            onPointerUp={endResize}
            onPointerCancel={endResize}
          />
        )}

        <div class={s.panel} style={{ '--demo-panel-h': `${widgetHeight}px` } as any}>
          <div class={s.tabs}>
            {/* Dogfood Anta's <Tabs> as a bare selectable strip (no
                <TabPanel>s) — the playground keeps its own panel
                management below (the `.tabStack` grid: Props/Code share
                a cell sized to the taller, CSS stays mounted so Monaco
                never inits mid-typing). Controlled via `tab`. */}
            <Tabs
              priority="tertiary"
              label="Playground panel"
              value={tab}
              onStateChange={(_e, { next }) => next && setTab(next as Tab)}
              options={[
                { value: 'props', label: 'Props' },
                { value: 'code', label: 'Code' },
                { value: 'css', label: 'CSS' },
              ]}
            />
            {/* Reset edits to props / code. CSS is intentionally
                preserved — the user owns it independently. */}
            <a-button
              priority="quaternary"
              class={s.resetBtn}
              aria-label="Reset props and code"
              title="Reset props and code"
              onClick={() => {
                // Drop any queued form edits so a trailing flush can't
                // re-apply them on top of the freshly reset source.
                flushFormEdits.cancel()
                pendingEditsRef.current.clear()
                // Reset props + code to their initial values AND reload the
                // preview from a clean slate: re-mount into a FRESH root rather
                // than diffing in place, so any half-committed or errored render
                // is fully cleared (the same recovery path a thrown render uses).
                // `renderErroredRef` makes the next bundle push reset the root; if
                // the code is already at its initial value the compile effect won't
                // re-fire, so push the current bundle straight into a fresh root.
                renderErroredRef.current = true
                if (code === initialCode) {
                  const bs = bundleState as (typeof bundleState & { code: string }) | null
                  if (bs && (bs as any).ok && iframeRef.current && iframeReadyRef.current) {
                    pushBundleToIframe(iframeRef.current, bs.code, true)
                    renderErroredRef.current = false
                    setRuntimeError(null)
                  }
                } else {
                  setCode(initialCode)
                }
              }}
            >
              <a-icon shape="rotate-ccw" size="14" />
            </a-button>
          </div>
          {/* Both panels are stacked in the same grid cell so the
              panel sizes to the taller of the two — switching tabs
              never shrinks the box. The inactive one is hidden via
              visibility (still contributes to layout) + inert so it
              doesn't catch keyboard focus or pointer events. */}
          <div class={s.tabStack}>
            <div
              class={tab === 'props' ? s.tabPanel : `${s.tabPanel} ${s.tabPanelHidden}`}
              aria-hidden={tab !== 'props'}
              {...(tab !== 'props' ? { inert: '' } : {})}
            >
              {examples.length === 0 ? (
                /* No JSDoc-headed examples in source — render a single
                   anonymous form bound to the whole code. Backwards-
                   compatible with the previous single-example flow. */
                <div class={s.form}>
                  {controls.length === 0 && (
                    <div class={s.fieldHint}>No props detected for {component}. Check api.json.</div>
                  )}
                  {visibleControls(controls, component, code).map((entry) => (
                    <FormField
                      key={entry.control.name}
                      entry={entry}
                      code={code}
                      componentName={component}
                      onChange={(v) => handleFormChange(entry, v)}
                    />
                  ))}
                </div>
              ) : (
                <div class={s.examplesList}>
                  {examples.map((ex, i) => (
                    <ExampleAccordion
                      key={ex.id}
                      example={ex}
                      defaultOpen={i === 0}
                      code={code}
                      onChange={handleFormChange}
                    />
                  ))}
                </div>
              )}
            </div>
            <div
              class={tab === 'code' ? s.tabPanel : `${s.tabPanel} ${s.tabPanelHidden}`}
              aria-hidden={tab !== 'code'}
              {...(tab !== 'code' ? { inert: '' } : {})}
            >
              <div class={s.editorHost} ref={tsxHostRef}>
                {monacoLib && shikiBundle ? (
                <monacoLib.Editor
                  height="100%"
                  defaultLanguage="typescript"
                  path="user.tsx"
                  // Uncontrolled: seed the initial text, then let the
                  // editor own its model. We deliberately do NOT pass
                  // `value={code}` — @monaco-editor/react reacts to a
                  // changing `value` by replacing the whole model range
                  // with that string, which (one render behind during
                  // fast typing) clobbered in-flight keystrokes and
                  // reset the caret. External edits (form controls,
                  // Reset) are pushed into the model imperatively by the
                  // sync effect instead.
                  defaultValue={initialCode}
                  theme={isDark ? 'tokyo-night' : 'github-light'}
                  onChange={handleEditorChange}
                  beforeMount={(monaco) => {
                    monacoRef.current = monaco
                    installShikiBridge(monaco, shikiBundle)
                  }}
                  onMount={(editor, monaco) => {
                    editorRef.current = editor
                    onMonacoMount(editor, monaco)
                    installJsxAwareCommentToggle(editor, monaco)
                    editor.layout()
                    if (codeInitiallyFolded) {
                      // Deferred so Monaco's language service has time to
                      // compute fold ranges before we collapse them.
                      setTimeout(() => {
                        editor.getAction('editor.foldAll')?.run()
                      }, 400)
                    }
                  }}
                  options={editorOptions(monoFontFamily)}
                />
                ) : (
                  <div class={s.editorLoading}>Loading editor…</div>
                )}
              </div>
            </div>
            {/* CSS panel is always mounted so its Monaco editor never
                initialises during user typing (Monaco init blocks the
                main thread and was eating keystrokes the first time
                the className field changed). The tab button stays
                conditional — the panel just hides + inert when not
                in use. */}
            <div
              class={tab === 'css' ? s.tabPanel : `${s.tabPanel} ${s.tabPanelHidden}`}
              aria-hidden={tab !== 'css'}
              {...(tab !== 'css' ? { inert: '' } : {})}
            >
              <div class={s.editorHost} ref={cssHostRef}>
                {monacoLib && shikiBundle ? (
                  <monacoLib.Editor
                    height="100%"
                    defaultLanguage="css"
                    path="user.css"
                    value={styles}
                    theme={isDark ? 'tokyo-night' : 'github-light'}
                    onChange={(v) => setStyles(v ?? '')}
                    beforeMount={(monaco) => {
                      monacoRef.current = monaco
                      installShikiBridge(monaco, shikiBundle)
                    }}
                    onMount={(editor) => {
                      cssEditorRef.current = editor
                      editor.layout()
                    }}
                    options={editorOptions(monoFontFamily)}
                  />
                ) : (
                  <div class={s.editorLoading}>Loading editor…</div>
                )}
              </div>
            </div>
          </div>
        </div>

        {layout === 'side' && (
          <div
            class={s.cornerResize}
            role="separator"
            aria-label="Resize playground"
            title="Drag to resize"
            onPointerDown={startCornerResize}
            onPointerMove={onCornerMove}
            onPointerUp={endCornerResize}
            onPointerCancel={endCornerResize}
          />
        )}
      </div>

      {compileError && (
        <div class={s.error}>
          <span class={s.errorKind}>Compile error</span>
          {compileError}
        </div>
      )}
      {!compileError && runtimeError && (
        <div class={s.error}>
          <span class={s.errorKind}>Runtime error</span>
          {runtimeError}
        </div>
      )}
    </section>
  )
}

// ──────────────────────────────────────────────────────────────────
// Form field

/** Filter out controls whose discriminated-union condition isn't met by the
 *  current values (e.g. Button's `underline` only shows on tertiary /
 *  quaternary priority). Reads each dependency's live value from the code. */
function visibleControls(
  controls: PropEntry[],
  componentName: string,
  code: string,
  range?: { start: number; end: number },
): PropEntry[] {
  const conds = CONDITIONAL_PROPS[componentName]
  if (!conds) return controls
  const values: Record<string, unknown> = {}
  for (const e of controls) {
    if (e.prop.kind === 'children' || e.prop.kind === 'style-css') continue
    const r = readProp(code, componentName, e.prop, range)
    if (r?.kind === 'literal') values[e.control.name] = r.value
  }
  return controls.filter((e) => {
    const pred = conds[e.control.name]
    return !pred || pred(values)
  })
}

/** Inline-markdown → HTML, cached by source string. Prop descriptions come from
 *  build-time api.json (constant for the page's life) and FieldName renders on every
 *  editor keystroke (FormField isn't memoized, `code` is a dep), so without this every
 *  visible control re-parses its static description through `marked` on each keypress. */
const mdInlineCache = new Map<string, string>()
function parseInlineCached(md: string): string {
  let html = mdInlineCache.get(md)
  if (html === undefined) {
    html = marked.parseInline(md) as string
    mdInlineCache.set(md, html)
  }
  return html
}

/** A prop-control label: the prop name plus, when it has TSDoc, a hover
 *  `<Tooltip>` rendering the description (inline markdown — our own build-time
 *  api.json, so the HTML is trusted). Shared by every control kind so the
 *  description surfaces identically whether the control is a text input, a
 *  segmented/tone picker, a slider, or a boolean — rather than only the
 *  text/number inputs getting the rich bubble and the rest a native `title`. */
function FieldName({ name, description, suffix }: {
  name: string
  description?: string
  suffix?: React.ReactNode
}) {
  return (
    <span class={s.fieldName} style={description ? { cursor: 'help' } : undefined}>
      {name}
      {description ? (
        <Tooltip>
          <Text size="small">
            <span dangerouslySetInnerHTML={{ __html: parseInlineCached(description) }} />
          </Text>
        </Tooltip>
      ) : null}
      {suffix}
    </span>
  )
}

function FormField({
  entry,
  code,
  componentName,
  range,
  onChange,
}: {
  entry: PropEntry
  code: string
  componentName: string
  range?: { start: number; end: number }
  onChange: (v: string | number | boolean | null) => void
}) {
  const c = entry.control
  // `children` doesn't live in the attribute list — read the JSX element's body
  // content instead. Everything else (including `style`, whose JSX object literal
  // `readProp` parses back into a CSS-declarations string) reads from the tag.
  let read: ReturnType<typeof readProp>
  if (entry.prop.kind === 'children') {
    const body = readChildren(code, componentName, range)
    read = body !== undefined ? { kind: 'literal', value: body } : undefined
  } else {
    read = readProp(code, componentName, entry.prop, range)
  }
  const fromExpression = read?.kind === 'expression'
  // Only the literal in code populates the input; the default is
  // shown as a placeholder instead so the user can tell what Anta
  // would do if they leave the field blank.
  const current = read?.kind === 'literal' ? read.value : undefined

  // Optimistic local value: the control reflects the user's input
  // immediately while the throttled rewrite of `code` catches up
  // (see `flushFormEdits`). Re-sync from the parsed source whenever it
  // changes externally — a Monaco edit, a Reset, or the throttled flush
  // landing the value we just set (a same-value set, so Preact skips
  // the re-render and there's no feedback loop).
  //
  // …except while the field is focused: the `style` control's CSS-string ↔
  // object-literal round-trip re-formats (so the flushed value differs from the
  // keystrokes, and a partial declaration parses to nothing), which would clobber
  // in-flight typing. `focusedRef` (set by the text field's focusin/focusout, below)
  // suppresses the sync while typing; on blur the next parse re-syncs the canonical
  // value. Other controls round-trip identically, so the guard is a no-op there.
  const [value, setValue] = useState<string | number | boolean | undefined>(current)
  const focusedRef = useRef(false)
  useEffect(() => { if (!focusedRef.current) setValue(current) }, [current])
  const handle = (v: string | number | boolean | null) => {
    setValue(v == null ? undefined : v)
    onChange(v)
  }

  if (c.kind === 'boolean') {
    // Keep booleans in the same label/control grid as the other props. The
    // checkbox takes its accessible name explicitly because its visual label is
    // rendered in the shared left-hand column.
    return (
      <div class={s.field}>
        <div class={s.fieldLabel}>
          <span><FieldName name={c.name} description={c.description} /></span>
          {fromExpression ? <span class={s.fieldExpressionBadge}>set by code</span> : null}
        </div>
        <Checkbox
          size="small"
          checked={value === true}
          disabled={fromExpression}
          aria-label={c.name}
          onStateChange={(_e, { next }) => handle(next === true)}
        />
      </div>
    )
  }

  // Text/number controls are Anta <Input>s, which carry their own label — so we
  // drop the external label row and pass the name (+ description as an Anta
  // <Tooltip>, + the "set by code" badge) into the Input's `label` prop.
  if (c.kind === 'text' || c.kind === 'number') {
    const inputLabel = (
      <FieldName
        name={c.name}
        description={c.description}
        suffix={fromExpression ? <span class={s.fieldExpressionBadge}> · set by code</span> : null}
      />
    )
    // `children` and ReactNode (`expression`) props hold JSX/markup, not a short
    // value — give them an auto-growing, monospace, code-style field.
    const code = entry.prop.kind === 'children' || entry.prop.kind === 'expression'
    // focusin/focusout bubble from the inner <input>, so we can track focus on the
    // wrapper without threading handlers through <Input>. See `focusedRef` above.
    return (
      <div
        class={s.field}
        onfocusin={() => { focusedRef.current = true }}
        onfocusout={() => { focusedRef.current = false }}
      >
        <FieldControl
          control={c}
          value={value}
          disabled={fromExpression}
          onChange={handle}
          label={inputLabel}
          code={code}
        />
      </div>
    )
  }

  return (
    <div class={s.field}>
      <div class={s.fieldLabel}>
        <span>
          <FieldName name={c.name} description={c.description} />
        </span>
        {fromExpression
          ? <span class={s.fieldExpressionBadge}>set by code</span>
          : c.kind === 'slider' && typeof value === 'number'
            ? <span class={s.fieldValueLabel}>{value}</span>
            : null}
      </div>
      <FieldControl
        control={c}
        value={value}
        disabled={fromExpression}
        onChange={handle}
      />
    </div>
  )
}

function FieldControl({
  control,
  value,
  disabled,
  onChange,
  label,
  code,
}: {
  control: Control
  value: string | number | boolean | undefined
  disabled: boolean
  onChange: (v: string | number | boolean | null) => void
  /** Rendered as the Anta <Input>'s own label (text/number controls only). */
  label?: React.ReactNode
  /** `children` / ReactNode fields: auto-grow (unbounded) + monospace. */
  code?: boolean
}) {
  const cls = disabled ? s.disabled : ''
  switch (control.kind) {
    case 'slider':
      return (
        <input
          type="range"
          class={`${s.slider} ${cls}`}
          min={control.min}
          max={control.max}
          step={control.step}
          value={typeof value === 'number' ? value : control.defaultValue ?? control.min}
          onInput={(e) => onChange(Number((e.currentTarget as HTMLInputElement).value))}
          disabled={disabled}
        />
      )
    // Dogfood Anta's <Input> for the text & number controls (small size); it's a
    // text field that also handles type="number". Slider/color/etc. stay native.
    case 'number':
      return (
        <Input
          label={label}
          type="number"
          size="small"
          value={typeof value === 'number' ? String(value) : ''}
          placeholder={control.defaultValue != null ? String(control.defaultValue) : ''}
          onInput={(e: any) => {
            const v = e.target.value as string
            onChange(v === '' ? null : Number(v))
          }}
          disabled={disabled}
        />
      )
    case 'text':
      return (
        <Input
          label={label}
          type="text"
          size="small"
          multiline={code || undefined}
          className={code ? s.codeField : undefined}
          value={typeof value === 'string' ? value : ''}
          placeholder={control.defaultValue ?? ''}
          onInput={(e: any) => onChange(e.target.value as string)}
          disabled={disabled}
        />
      )
    case 'boolean':
      // Dogfood Anta <Checkbox> (small); the prop name is shown by the row, so
      // the box takes an aria-label rather than a visible label.
      return (
        <Checkbox
          size="small"
          aria-label={label}
          checked={value === true}
          onStateChange={(_e, { next }) => onChange(next === true)}
          disabled={disabled}
        />
      )
    case 'segmented': {
      // A short enum is clearest as Anta <Tabs>; longer lists become an Anta
      // <Select> so labels do not crowd or overflow the fixed-size panel. When no
      // literal is set in code, fall back to the control's default so the implicit
      // choice still reads as selected. `clearable` adds a leading "none" option
      // that omits the attribute.
      const selected = value !== undefined ? value : control.defaultValue
      const active = selected === undefined ? '__none' : String(selected)
      const options = [
        ...(control.clearable ? [{ value: '__none', label: 'none', tooltip: 'none' }] : []),
        ...control.options.map((opt) => ({ value: opt, label: opt, tooltip: opt })),
      ]
      if (options.length > 4) {
        return (
          <Select
            className={s.selectControl}
            size="small"
            aria-label={control.name}
            value={active}
            disabled={disabled}
            onValueChange={(next) => onChange(next === '__none' ? null : next)}
            options={options}
          />
        )
      }
      return (
        <Tabs
          className={s.segTabs}
          priority="primary"
          size="small"
          label={control.name}
          value={active}
          disabled={disabled}
          onStateChange={(_e, { next }) => onChange(next === '__none' ? null : next)}
          options={options}
        />
      )
    }
    case 'tone': {
      // Named tones are a seven-item choice, so use Anta <Select> rather than tabs.
      // A value outside `options` (a colour literal) means custom → reveal the colour
      // picker. The picker only reflects valid hex; a hand-typed `oklch(…)` stays in
      // the code and shows beside the picker without being overwritten.
      const v = typeof value === 'string' ? value : undefined
      const selected = v ?? control.defaultValue
      const isCustom = v !== undefined && !control.options.includes(v)
      const hex = /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v ?? '') ? (v as string) : '#ff1493'
      const active = isCustom ? 'custom' : String(selected)
      return (
        <div class={`${s.toneControl} ${cls}`}>
          <Select
            className={s.selectControl}
            size="small"
            aria-label={control.name}
            value={active}
            disabled={disabled}
            onValueChange={(next) =>
              onChange(next === 'custom' ? (isCustom ? (v as string) : '#ff1493') : next)
            }
            options={[
              ...control.options.map((opt) => ({ value: opt, label: opt, tooltip: opt })),
              { value: 'custom', label: 'custom', tooltip: 'custom' },
            ]}
          />
          {isCustom && (
            <div class={s.toneCustomRow}>
              <input
                type="color"
                class={s.toneColor}
                value={hex}
                onInput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
                disabled={disabled}
              />
              <code>{v}</code>
            </div>
          )}
        </div>
      )
    }
    case 'documentation':
      // Read-only documentation row — no input. A `note` renders as a plain
      // prose line (e.g. a compound component's `children`, edited in the Code
      // tab); otherwise the type string, so the panel doubles as a prop reference.
      return control.note ? (
        <div class={s.docNote}>{control.note}</div>
      ) : (
        <div class={s.docType}>
          <code>{control.type}</code>
        </div>
      )
  }
}

// One accordion entry in the Props panel — collapsible section
// per JSDoc-headed example. Sections are independent (multiple can
// be open at once). Each section's form is range-bound so its edits
// only touch that example's JSX. We capture `example.id` in the
// onChange closure and look up the latest range at edit time
// (see `handleFormChange` for the re-parse-on-update flow).
function ExampleAccordion({
  example,
  defaultOpen,
  code,
  onChange,
}: {
  example: Example
  defaultOpen: boolean
  code: string
  onChange: (entry: PropEntry, value: string | number | boolean | null, exampleId: string) => void
}) {
  const [open, setOpen] = useState(defaultOpen)
  // Per-example control schema. JSX examples introspect their tag:
  // known components (api.json) get their full prop set; unknown
  // tags fall back to attribute inference from the JSX itself.
  // Expression examples don't drive a form.
  const controls = useMemo(() => {
    if (example.kind !== 'jsx' || !example.tagName) return []
    return controlsForExample(example.tagName, code, {
      start: example.jsxStart,
      end: example.jsxEnd,
    })
  }, [example.tagName, example.kind, example.jsxStart, example.jsxEnd, code])

  return (
    <div class={s.example}>
      <button
        type="button"
        class={open ? `${s.exampleHeader} ${s.exampleHeaderOpen}` : s.exampleHeader}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <a-icon
          shape={open ? 'chevron-down' : 'chevron-right'}
          class={s.exampleChevron}
          style={{ '--icon-size': '14px' } as any}
        />
        <span class={s.exampleLabel}>{example.label}</span>
      </button>
      {open && (
        <div class={s.exampleBody}>
          {example.description && (
            <div class={s.exampleDescription}>{example.description}</div>
          )}
          {/* The Props form binds only when the example body is a
              plain `<Tag …>` element — `{}` expression bodies
              (IIFEs, inline components) are too dynamic to bind to.
              The accordion entry still shows heading + description
              for documented examples; the user edits the JSX in the
              Code tab if they want to change anything. */}
          {example.kind === 'jsx' && controls.length > 0 && (
            <div class={s.form}>
              {visibleControls(controls, example.tagName!, code, { start: example.jsxStart, end: example.jsxEnd }).map((entry) => (
                <FormField
                  key={entry.control.name}
                  entry={entry}
                  code={code}
                  componentName={example.tagName!}
                  range={{ start: example.jsxStart, end: example.jsxEnd }}
                  onChange={(v) => onChange(entry, v, example.id)}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────────
// Iframe lifecycle helpers

// Transparent iframe body so the playground's surrounding panel
// background shows through. The cloned-stylesheet pipeline applies anta
// tokens for typography and colors; removing the body background just lets
// the host card paint behind.
//
// The inline <script> below seeds the theme synchronously *during parse*,
// before first paint: it reads the parent docs theme (srcdoc iframes are
// same-origin, so parent.document is reachable) and sets the iframe's own
// `.dark` class + `color-scheme`. Setting color-scheme ON THE EMBEDDED
// DOCUMENT is what makes its blank UA canvas paint the right shade — an iframe
// element's color-scheme does NOT propagate into the document (its canvas
// defaults to light), which is why a white flash appeared on expand in dark
// mode. The setupIframe mirror keeps the `.dark` class in sync on later toggles.
/** Absolute URL for a prebuilt, content-hashed iframe asset. srcdoc lives at
 *  `about:srcdoc` and can't resolve relative paths, so we anchor to the parent
 *  origin. The hash in the filename is the cache-buster. */
function iframeAssetUrl(file: string): string {
  const base = typeof window !== 'undefined' ? window.location.href : 'http://localhost/'
  return new URL(`/iframe/${file}`, base).href
}

/** The preview iframe as a self-contained Anta app: it loads one prebuilt,
 *  content-hashed bundle (`iframe-app.js` — Preact + the whole Anta + element
 *  registration) plus its matching stylesheet. That bundle seeds
 *  `window.__demo_modules__` from its own instances, which the sandbox-compiled
 *  demo reads — so the demo runs against the iframe's Anta + Preact (one Preact
 *  instance, Anta CSS present with matching class names). */
function buildSrcdoc(): string {
  const A = IFRAME_ASSETS
  return `<!DOCTYPE html><html><head><meta charset="utf-8"><script>
  try {
    var d = parent.document.documentElement.classList.contains('dark');
    document.documentElement.classList.toggle('dark', d);
    document.documentElement.style.colorScheme = d ? 'dark' : 'light';
  } catch (e) {}
</script><link rel="stylesheet" href="${iframeAssetUrl(A.css)}"><script type="module" src="${iframeAssetUrl(A.js)}"></script><style>
  /* Pin the sans variable font's slnt / ital axes to 0.
     Safari leaves variable-font axes at the font file's internal
     defaults unless they're explicitly set — and our font ships
     with non-zero defaults — so without this the preview iframe
     renders italic on Safari only. \`font-style: normal\` is the
     belt to the variation-settings braces. */
  html, body { margin: 0; background: transparent; font-family: var(--sans-serif, sans-serif); font-style: normal; font-variation-settings: "wdth" 100, "slnt" 0, "ital" 0; }
  body { padding: 24px; overflow: auto; box-sizing: border-box; min-height: 100%; }
  /* Preview default layout: a column-flex with 16px gap so multiple
     examples stack vertically with consistent breathing room. The
     rule lives under a .preview class so users can re-declare it
     from their own CSS to change the layout. Single-example renders
     are unaffected — one column-flex child looks identical to a
     block child. Scoped to #root inside the iframe; never touches
     the docs-site DOM. */
  .preview {
    display: flex;
    flex-direction: column;
    gap: 16px;
    width: 100%;
  }
</style></head><body><div id="root" class="preview"></div></body></html>`
}

function setupIframe(iframe: HTMLIFrameElement) {
  const doc = iframe.contentDocument
  const win = iframe.contentWindow as Window & { __demo_modules__?: Record<string, unknown> }
  if (!doc || !win) return

  // `window.__demo_modules__` (the Anta + Preact instances the demo shim reads)
  // and the custom-element registration are both handled by the preview-app
  // bundle loaded from the srcdoc (see buildSrcdoc) — it runs before this
  // iframe's `load`, so the modules are seeded by the time we push a demo.

  // Clone Anta-related <link rel="stylesheet"> + <style> tags from
  //    the parent into the iframe so the rendered preview gets the
  //    same look as the docs site. Anta CSS stays unlayered — its
  //    component defaults beat anything in a cascade layer
  //    (including Tailwind's `@layer utilities`), and consumers can
  //    override via higher-specificity unlayered class selectors
  //    written in their own CSS (which always tie-break in their
  //    favour at unlayered tier). Tailwind utility classes WILL NOT
  //    override Anta declarations — that's an accepted tradeoff for
  //    keeping the library's defaults sticky.
  for (const link of Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))) {
    const clone = doc.createElement('link')
    clone.rel = 'stylesheet'
    clone.href = link.href
    doc.head.appendChild(clone)
  }
  // Also clone any inline <style> from the head that's likely tokens.
  // (Astro inlines a small reset; this picks it up if present.)
  for (const style of Array.from(document.head.querySelectorAll('style'))) {
    if (style.textContent && style.textContent.includes('--bg-base')) {
      const clone = doc.createElement('style')
      clone.textContent = style.textContent
      doc.head.appendChild(clone)
    }
  }


  // 4) Mirror the parent's .dark class (and color-scheme, so a light docs
  //    theme flips the iframe canvas back to light — the srcdoc defaults to
  //    dark to avoid the white expand-flash in dark mode).
  const apply = () => {
    const dark = document.documentElement.classList.contains('dark')
    doc.documentElement.classList.toggle('dark', dark)
    doc.documentElement.style.colorScheme = dark ? 'dark' : 'light'
  }
  apply()
  const obs = new MutationObserver(apply)
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  // Detach when the iframe unloads.
  iframe.addEventListener('unload', () => obs.disconnect(), { once: true })

  // 5) Capture iframe runtime errors → bubble to parent via postMessage.
  win.addEventListener('error', (e: any) => {
    window.postMessage({ __demo: 'runtime-error', message: e?.message ?? String(e) }, '*')
  })
  win.addEventListener('unhandledrejection', (e: any) => {
    window.postMessage({ __demo: 'runtime-error', message: String(e?.reason ?? e) }, '*')
  })

  // 6) Auto-resize: observe the iframe body's height and tell the parent
  //    to size the iframe element accordingly. Avoids a fixed-height
  //    iframe with the demo content lost in empty space.
  const observed = doc.body
  const report = () => {
    // scrollHeight + a little breathing room for padding.
    const h = observed.scrollHeight + 24
    window.postMessage({ __demo: 'content-height', height: h }, '*')
  }
  const ResizeObserverCtor = (win as any).ResizeObserver
  if (ResizeObserverCtor) {
    const ro = new ResizeObserverCtor(report)
    ro.observe(observed)
    iframe.addEventListener('unload', () => ro.disconnect(), { once: true })
  }
  // Initial report after a microtask so the first render lands first.
  setTimeout(report, 0)
}

function pushBundleToIframe(iframe: HTMLIFrameElement, code: string, resetRoot = false) {
  const doc = iframe.contentDocument
  if (!doc) return
  // Remove previous user bundle.
  const prev = doc.getElementById('user-bundle')
  if (prev) prev.remove()
  // Normally we do NOT clear `#root`. Preact tracks its previous render via a
  // `_children` property on the parent DOM node; clearing innerHTML removes the
  // visible nodes but leaves preact's bookkeeping pointing at stale references,
  // so the next `render()` call silently does nothing. Letting preact diff in
  // place is also the right behaviour — typical "re-render with new props"
  // patches the existing tree (and preserves focus / DOM state across edits).
  //
  // The exception is recovering from a thrown render (`resetRoot`): a render
  // that errored can leave `_children` half-committed, so diffing against it
  // may throw again or no-op. Swapping `#root` for a fresh, identical-but-empty
  // node (no `_children`) makes the next `render()` a clean initial mount — so
  // a corrected edit fully restores instead of staying broken.
  if (resetRoot) {
    const oldRoot = doc.getElementById('root')
    if (oldRoot) {
      const fresh = doc.createElement('div')
      fresh.id = 'root'
      fresh.className = oldRoot.className
      oldRoot.replaceWith(fresh)
    }
  }
  // Clear last runtime error.
  window.postMessage({ __demo: 'runtime-clear' }, '*')
  // Append new script as a module so user-code imports resolve.
  const script = doc.createElement('script')
  script.type = 'module'
  script.id = 'user-bundle'
  script.textContent = code
  doc.body.appendChild(script)
  // ResizeObserver will pick up the new content size; a one-shot
  // post here covers the gap before the observer fires.
  setTimeout(() => {
    window.postMessage(
      { __demo: 'content-height', height: doc.body.scrollHeight + 24 },
      '*',
    )
  }, 50)
}


// ──────────────────────────────────────────────────────────────────
// Shiki ↔ Monaco bridge. shikiToMonaco installs themes + token
// providers, but it only registers a token provider for a language
// when Monaco already has that language ID. Shiki's TSX grammar is
// named `tsx`, and Monaco's TS language services are bound to
// `typescript` — so we briefly proxy `setTokensProvider` to mirror
// the `tsx` registration onto `typescript`, keeping intellisense and
// errors attached to `typescript` while the tokenizer is Shiki's
// VS Code-grade TSX grammar. Idempotent across multiple editor mounts.
let shikiInstalled = false
function installShikiBridge(
  monaco: any,
  bundle: { highlighter: any; shikiToMonaco: (h: any, m: any) => void },
) {
  if (shikiInstalled) return
  shikiInstalled = true
  if (!monaco.languages.getLanguages().some((l: any) => l.id === 'tsx')) {
    monaco.languages.register({ id: 'tsx' })
  }
  const origSet = monaco.languages.setTokensProvider.bind(monaco.languages)
  monaco.languages.setTokensProvider = (id: string, p: any) => {
    if (id === 'tsx') origSet('typescript', p)
    return origSet(id, p)
  }
  bundle.shikiToMonaco(bundle.highlighter, monaco)
  monaco.languages.setTokensProvider = origSet
}

// Re-define both Shiki themes in Monaco with our `--bg-canvas`
// painted over `editor.background` / `editorGutter.background`. The
// resolved color depends on the current `.dark` class; call this on
// every dark-mode flip so the theme that becomes active picks up the
// matching background. The token-color rules from Shiki survive
// because we spread the converted spec verbatim and only override
// the two color slots.
function overlayBgOnShikiThemes(
  monaco: any,
  bundle: {
    highlighter: any
    textmateThemeToMonacoTheme: (t: any) => any
  },
) {
  const bg = resolveCssColorToHex('--bg-canvas')
  if (!bg) return
  for (const themeId of bundle.highlighter.getLoadedThemes()) {
    const tmTheme = bundle.highlighter.getTheme(themeId)
    const monacoTheme = bundle.textmateThemeToMonacoTheme(tmTheme)
    monaco.editor.defineTheme(themeId, {
      ...monacoTheme,
      colors: {
        ...monacoTheme.colors,
        'editor.background': bg,
        'editorGutter.background': bg,
      },
    })
  }
}

function resolveCssColorToHex(varName: string): string | null {
  const v = getComputedStyle(document.documentElement).getPropertyValue(varName).trim()
  if (!v) return null
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = 1
  const ctx = canvas.getContext('2d')
  if (!ctx) return null
  ctx.fillStyle = v
  ctx.fillRect(0, 0, 1, 1)
  const d = ctx.getImageData(0, 0, 1, 1).data
  return '#' + [d[0], d[1], d[2]].map((c) => c.toString(16).padStart(2, '0')).join('')
}

// ──────────────────────────────────────────────────────────────────
// Shared editor options — TSX and CSS instances use the same look.

function editorOptions(fontFamily: string): any {
  return {
    minimap: { enabled: false },
    fontSize: 12,
    fontFamily: fontFamily || undefined,
    scrollBeyondLastLine: false,
    automaticLayout: true,
    tabSize: 2,
    wordWrap: 'on',
    lineNumbers: 'off',
    lineNumbersMinChars: 0,
    lineDecorationsWidth: 8,
    glyphMargin: false,
    folding: true,
    padding: { top: 12, bottom: 12 },
    fixedOverflowWidgets: true,
  }
}

// ──────────────────────────────────────────────────────────────────
// JSX-aware comment toggle. Cmd+/ (Ctrl+/ on non-mac) usually maps
// to `editor.action.commentLine`, which prepends `// ` — fine for
// plain JS / TS lines, broken for JSX where `//` shows up as a
// literal text node. We swap in `{/* … */}` when the cursor is on a
// JSX token and otherwise defer to Monaco's default.

function installJsxAwareCommentToggle(editor: any, monaco: any) {
  editor.addAction({
    id: 'anta-jsx-comment-toggle',
    label: 'Toggle JSX-aware comment',
    keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Slash],
    run: (ed: any) => {
      if (isInsideJsx(ed, monaco)) {
        wrapJsxComment(ed)
      } else {
        ed.getAction('editor.action.commentLine')?.run()
      }
    },
  })
}

/** Decide whether the cursor is parked inside JSX markup vs.
 *  regular TS code. We tokenize the current line via the public
 *  `monaco.editor.tokenize` API (the per-model `getLineTokens` is
 *  not exposed) and pick the latest token that starts at or before
 *  the cursor column. Monaco's TS tokenizer tags JSX with token
 *  types like `tag`, `delimiter.angle`, `meta.tag`, `jsx`. */
function isInsideJsx(editor: any, monaco: any): boolean {
  const model = editor.getModel()
  const pos = editor.getPosition()
  if (!model || !pos) return false
  const line = model.getLineContent(pos.lineNumber)
  // Cheap pre-check: a line whose first non-whitespace char is `<`
  // is JSX with overwhelming probability.
  if (line.trimStart().startsWith('<')) return true
  // Already-commented JSX (`{/* … */}`): treat as JSX so toggle-off
  // routes through the JSX wrapper and unwraps cleanly.
  const t = line.trim()
  if (t.startsWith('{/*') && t.endsWith('*/}')) return true
  const tokens = monaco.editor.tokenize(line, model.getLanguageId())[0]
  if (!tokens?.length) return false
  const col = pos.column - 1
  for (let i = tokens.length - 1; i >= 0; i--) {
    if (tokens[i].offset <= col) {
      const t: string = tokens[i].type || ''
      return /(?:^|\.)(?:tag|jsx|meta\.tag|delimiter\.angle)/.test(t)
    }
  }
  return false
}

function wrapJsxComment(editor: any) {
  const model = editor.getModel()
  if (!model) return
  const sel = editor.getSelection()
  if (!sel) return
  const open = '{/* '
  const close = ' */}'

  // Build the range to operate on:
  // - non-empty selection: that selection
  // - caret only: the trimmed contents of the current line (matches
  //   the default "toggle line comment" intent — comment-out the
  //   line, don't sprinkle an empty comment at the caret).
  let range = sel
  if (sel.isEmpty()) {
    const line = sel.startLineNumber
    const text = model.getLineContent(line)
    const leading = text.length - text.trimStart().length + 1
    const trailing = text.trimEnd().length + 1
    range = { startLineNumber: line, startColumn: leading, endLineNumber: line, endColumn: trailing }
  }
  const text = model.getValueInRange(range)
  const trimmed = text.trim()
  if (trimmed.startsWith('{/*') && trimmed.endsWith('*/}')) {
    // Toggle off — strip the wrapper and its inner padding.
    const unwrapped = trimmed.slice(3, -3).trim()
    editor.executeEdits('jsx-comment', [{ range, text: unwrapped, forceMoveMarkers: true }])
  } else {
    editor.executeEdits('jsx-comment', [{ range, text: open + text + close, forceMoveMarkers: true }])
  }
}

// ──────────────────────────────────────────────────────────────────
// Monaco mount: load Anta's .d.ts files into Monaco's TS service so
// the editor knows about Progress / Text / Icon types.

// Vite glob: pull every .d.ts file from anta's dist + preact at build
// time. The package.json files come along too so Monaco's TS service
// can do NodeJS-style module resolution (exports / types / main).
const antaTypeDefs = import.meta.glob(
  '/node_modules/@antadesign/anta/dist/**/*.d.ts',
  { eager: true, query: '?raw', import: 'default' }
) as Record<string, string>

const preactTypeDefs = import.meta.glob(
  '/node_modules/preact/**/*.d.ts',
  { eager: true, query: '?raw', import: 'default' }
) as Record<string, string>

const packageJsons = import.meta.glob(
  [
    '/node_modules/@antadesign/anta/package.json',
    '/node_modules/preact/package.json',
    '/node_modules/preact/*/package.json',
  ],
  { eager: true, query: '?raw', import: 'default' }
) as Record<string, string>

let monacoTypesInstalled = false

function onMonacoMount(_editor: unknown, monaco: any) {
  if (monacoTypesInstalled) return
  monacoTypesInstalled = true
  const ts = monaco.languages.typescript
  ts.typescriptDefaults.setCompilerOptions({
    target: ts.ScriptTarget.ES2020,
    module: ts.ModuleKind.ESNext,
    moduleResolution: ts.ModuleResolutionKind.NodeJs,
    jsx: ts.JsxEmit.Preserve,
    jsxImportSource: 'preact',
    esModuleInterop: true,
    allowSyntheticDefaultImports: true,
    strict: false,
    isolatedModules: true,
  })
  ts.typescriptDefaults.setDiagnosticsOptions({
    noSemanticValidation: false,
    noSyntaxValidation: false,
    // 2657 — "JSX expressions must have one parent element". The
    // playground wraps the user's trailing JSX in a Fragment at
    // bundle time, so the user is free to write sibling roots (e.g.
    // a `<style>` next to the component). Silence the squiggle to
    // match that contract.
    diagnosticCodesToIgnore: [2657],
  })
  for (const [absPath, contents] of Object.entries(antaTypeDefs)) {
    ts.typescriptDefaults.addExtraLib(contents, 'file://' + absPath)
  }
  // The bundler auto-imports every anta export into the compiled output
  // (see bundler.ts `buildAntaAutoImport`), so demo code can drop any
  // component into the JSX without an explicit import. Mirror that in the
  // editor: declare each anta export as an ambient global so Monaco's TS
  // service resolves a bare `<Button>` (with full hover/autocomplete types)
  // instead of squiggling "Cannot find name". Kept in lockstep with the
  // runtime list via the same `moduleManifest` the bundler resolves against.
  const antaGlobals = (moduleManifest['@antadesign/anta'] ?? [])
    .map((n) => `  const ${n}: typeof import('@antadesign/anta').${n}`)
    .join('\n')
  ts.typescriptDefaults.addExtraLib(
    `export {}\ndeclare global {\n${antaGlobals}\n}\n`,
    'file:///anta-auto-imports.d.ts',
  )
  for (const [absPath, contents] of Object.entries(preactTypeDefs)) {
    ts.typescriptDefaults.addExtraLib(contents, 'file://' + absPath)
  }
  for (const [absPath, contents] of Object.entries(packageJsons)) {
    ts.typescriptDefaults.addExtraLib(contents, 'file://' + absPath)
  }
}
