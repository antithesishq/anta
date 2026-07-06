/**
 * bundler.ts — esbuild-wasm wrapper that turns a user code string into a
 * runnable ESM bundle. The bundler runs in the parent window (not in the
 * iframe) and resolves imports against `moduleManifest`. Each known
 * module becomes a virtual file whose body is a tiny shim that reads the
 * named exports from `window.__demo_modules__` on the iframe's window.
 *
 * The iframe ends up executing something like:
 *
 *   // bundled by esbuild from user code
 *   import { Progress } from "@antadesign/anta"       // ← resolved here
 *   // → expanded to:
 *   //   const m = window.__demo_modules__["@antadesign/anta"]
 *   //   const Progress = m.Progress
 *   import { render } from "preact"
 *   render(<Progress … />, document.getElementById("root"))
 *
 * esbuild handles the JSX/TS transform and concatenates modules in one
 * step. We only configure the plugin so user-facing imports can resolve.
 */
import { moduleManifest } from './modules.ts'

let initialized: Promise<void> | null = null

async function ensureInit(): Promise<typeof import('esbuild-wasm')> {
  const esbuild = await import('esbuild-wasm')
  if (!initialized) {
    initialized = esbuild.initialize({ wasmURL: '/esbuild.wasm', worker: true })
  }
  await initialized
  return esbuild
}

export interface BundleSuccess {
  ok: true
  /** Compiled JS, ready to run as `<script type="module">` in the iframe. */
  code: string
}
export interface BundleFailure {
  ok: false
  /** Human-readable error message — suitable for showing in the UI. */
  message: string
}
export type BundleResult = BundleSuccess | BundleFailure

/** Compile a user code string. Imports are resolved against
 *  `moduleManifest`; anything else becomes a friendly compile error.
 *  If `userStyles` is provided (non-empty), the bundle prepends a
 *  small preamble that injects the styles as a `<style id="user-
 *  styles">` element in the iframe head — replacing any previous one. */
export async function bundle(
  userCode: string,
  userStyles?: string,
): Promise<BundleResult> {
  let esbuild: typeof import('esbuild-wasm')
  try {
    esbuild = await ensureInit()
  } catch (err: any) {
    return { ok: false, message: `esbuild failed to initialize: ${err?.message ?? err}` }
  }

  const moduleNamespace = 'demo-modules'

  const wrapped = wrapWithRender(userCode)
  if (wrapped == null) {
    return { ok: false, message: 'No JSX expression found in code. End the file with a JSX element to render (e.g. `<Progress value={50} />`).' }
  }

  try {
    const result = await esbuild.build({
      stdin: {
        contents: wrapped,
        loader: 'tsx',
        sourcefile: 'user.tsx',
      },
      bundle: true,
      format: 'esm',
      write: false,
      jsx: 'automatic',
      jsxImportSource: 'preact',
      logLevel: 'silent',
      plugins: [
        {
          name: 'demo-modules',
          setup(build) {
            const knownPaths = new Set(Object.keys(moduleManifest))
            // Special-case preact/jsx-runtime (and -dev) — emitted by
            // esbuild when `jsxImportSource: 'preact'` is set. Map to
            // a virtual shim that re-exports preact's createElement.
            const jsxRuntimePaths = new Set([
              'preact/jsx-runtime',
              'preact/jsx-dev-runtime',
            ])
            build.onResolve({ filter: /.*/ }, (args) => {
              if (knownPaths.has(args.path)) {
                return { path: args.path, namespace: moduleNamespace }
              }
              if (jsxRuntimePaths.has(args.path)) {
                return { path: args.path, namespace: moduleNamespace }
              }
              return {
                errors: [
                  {
                    text: `Module "${args.path}" is not available in the demo sandbox. Available: ${[...knownPaths].join(', ')}.`,
                  },
                ],
              }
            })
            build.onLoad({ filter: /.*/, namespace: moduleNamespace }, (args) => {
              if (
                args.path === 'preact/jsx-runtime' ||
                args.path === 'preact/jsx-dev-runtime'
              ) {
                return {
                  contents: `
                    const m = window.__demo_modules__['preact']
                    export const jsx = m.h
                    export const jsxs = m.h
                    export const jsxDEV = m.h
                    export const Fragment = m.Fragment
                  `,
                  loader: 'js',
                }
              }
              const exports = moduleManifest[args.path] ?? []
              const exportsBody = exports
                .map((n) => `export const ${n} = m[${JSON.stringify(n)}]`)
                .join('\n')
              return {
                contents: `const m = window.__demo_modules__[${JSON.stringify(args.path)}] || {}\n${exportsBody}\n`,
                loader: 'js',
              }
            })
          },
        },
      ],
    })

    if (result.errors.length > 0) {
      return { ok: false, message: formatErrors(result.errors) }
    }
    const out = result.outputFiles?.[0]
    if (!out) return { ok: false, message: 'esbuild produced no output' }
    const finalCode = (userStyles && userStyles.trim())
      ? `${stylesPreamble(userStyles)}\n${out.text}`
      : out.text
    return { ok: true, code: finalCode }
  } catch (err: any) {
    if (err?.errors && Array.isArray(err.errors)) {
      return { ok: false, message: formatErrors(err.errors) }
    }
    return { ok: false, message: err?.message ?? String(err) }
  }
}

/** Emit the runtime snippet that swaps the iframe's `<style id="user-
 *  styles">` element with the latest CSS. We inline the CSS as a JSON-
 *  stringified literal so any quotes / newlines round-trip safely. */
function stylesPreamble(css: string): string {
  return `;(() => {
  const prev = document.getElementById('user-styles')
  if (prev) prev.remove()
  const el = document.createElement('style')
  el.id = 'user-styles'
  el.textContent = ${JSON.stringify(css)}
  document.head.appendChild(el)
})()`
}

function formatErrors(errors: any[]): string {
  return errors
    .map((e) => {
      const loc = e.location ? `${e.location.line}:${e.location.column}` : ''
      return loc ? `${loc} — ${e.text}` : e.text
    })
    .join('\n')
}

/**
 * Pre-process user code so the bundled output auto-renders the
 * trailing JSX block. Find the FIRST line that *starts* with `<`
 * (after leading whitespace) and treat everything from there to the
 * end as one JSX block. Wrap the block in a `<>…</>` fragment so the
 * user can have multiple sibling roots (e.g. a `<style>` sibling to
 * the component) without needing to add their own wrapper. Returns
 * `null` if no JSX block is found.
 */
function wrapWithRender(code: string): string | null {
  const lines = code.split('\n')
  let jsxStart = -1
  for (let i = 0; i < lines.length; i++) {
    if (lines[i].trimStart().startsWith('<')) {
      jsxStart = i
      break
    }
  }
  if (jsxStart === -1) return null
  const before = lines.slice(0, jsxStart).join('\n').trimEnd()
  let jsxBlock = lines.slice(jsxStart).join('\n').trim().replace(/;?\s*$/, '')

  // Strip every `/** … */` block comment from the JSX region. JSX
  // treats anything between two sibling JSX nodes that isn't `{…}`
  // as text — so a JSDoc that lives inside the Fragment would render
  // as visible text in the preview, not as a JS comment. The
  // playground uses these JSDocs as metadata for the Props panel and
  // for source-code readers; they have no role at runtime, so drop
  // them before the Fragment wrap. (JSDocs in the *preamble* — above
  // the first `<` line — are left alone; they're regular JS comments
  // documenting helper functions and never end up inside JSX.)
  jsxBlock = jsxBlock.replace(/\/\*\*[\s\S]*?\*\//g, '')

  // Strip `<script>` tags from the user's JSX block — Preact (like
  // React) renders them as inert DOM nodes the browser refuses to
  // execute. We emit explicit `document.createElement('script')`
  // calls into <head> instead, which is the only spec-correct way
  // to trigger fetch + execution programmatically.
  const { cleaned, scripts } = extractScripts(jsxBlock)
  jsxBlock = cleaned || '<></>'

  // Auto-import every anta export the user hasn't already referenced, so a
  // demo can drop *any* component into the JSX (e.g. a `<Button>` inside a
  // `<Tag>`'s children) without hand-adding the import — otherwise the bare
  // identifier compiles to an undeclared reference and throws at runtime
  // ("Button is not defined"). We skip names that already appear in the
  // preamble (the user's own imports / declarations) to avoid duplicate
  // bindings, and esbuild tree-shakes whatever the JSX doesn't use, so the
  // blanket import costs nothing at runtime.
  const autoImport = buildAntaAutoImport(before, jsxBlock)

  return `${autoImport}${before}
${scriptInjections(scripts)}
import { render as __demo_render__ } from 'preact'
const __demo_content__ = (<>${jsxBlock}</>)
__demo_render__(__demo_content__, document.getElementById('root'))
`
}

/** Names the anta barrel exposes to demo code — the same list the bundler's
 *  resolve plugin can satisfy from `window.__demo_modules__`. */
const ANTA_EXPORTS = moduleManifest['@antadesign/anta'] ?? []

/**
 * Build an `import { … } from '@antadesign/anta'` line covering every anta
 * export the trailing JSX references but the preamble doesn't already bind.
 * This lets a demo nest any component (`<Button>` inside a `<Tag>`) without
 * the author adding the import by hand. We only inject names that (a) appear
 * in the JSX block and (b) aren't mentioned in the preamble — skipping (b)
 * avoids clashing with the user's own `import`/`const` and the duplicate-
 * binding error esbuild would raise. Returns `''` when nothing needs adding.
 */
function buildAntaAutoImport(before: string, jsxBlock: string): string {
  const names = ANTA_EXPORTS.filter(
    (name) =>
      new RegExp(`\\b${name}\\b`).test(jsxBlock) &&
      !new RegExp(`\\b${name}\\b`).test(before),
  )
  return names.length
    ? `import { ${names.join(', ')} } from '@antadesign/anta'\n`
    : ''
}

interface ExtractedScript {
  /** External script URL. */
  src?: string
  /** Inline JS body (no src). */
  body?: string
}

/** Pull `<script>` tags out of the user's JSX block. Matches both
 *  src-bearing (`<script src="…"></script>` / `<script src="…" />`)
 *  and inline (`<script>{`…js…`}</script>`) forms. Anything we
 *  don't recognise is left in place. */
function extractScripts(jsxBlock: string): { cleaned: string; scripts: ExtractedScript[] } {
  const scripts: ExtractedScript[] = []
  // 1) Self-closing or empty-body src form: <script src="…" /> or <script src="…"></script>
  let cleaned = jsxBlock.replace(
    /<script\b([^>]*?)\s*(?:\/>|>\s*<\/script>)/g,
    (m, attrs) => {
      const srcMatch = attrs.match(/\bsrc\s*=\s*["']([^"']+)["']/)
      if (srcMatch) {
        scripts.push({ src: srcMatch[1] })
        return ''
      }
      return m
    },
  )
  // 2) Inline `<script>{`…`}</script>` form — extract the template
  //    literal between the braces.
  cleaned = cleaned.replace(
    /<script\b[^>]*>\s*\{\s*`([\s\S]*?)`\s*\}\s*<\/script>/g,
    (_m, body) => {
      scripts.push({ body })
      return ''
    },
  )
  return { cleaned, scripts }
}

function scriptInjections(scripts: ExtractedScript[]): string {
  if (scripts.length === 0) return ''
  const lines: string[] = ['// Demo: inject user-supplied <script> tags into <head> so the']
  lines.push('// browser actually fetches / executes them. Dedup by src across')
  lines.push('// recompiles so a re-render doesn\'t re-load.')
  for (const s of scripts) {
    if (s.src) {
      const sel = `script[src=${JSON.stringify(s.src)}]`
      lines.push(
        `if (!document.head.querySelector(${JSON.stringify(sel)})) {`,
        `  const __s = document.createElement('script')`,
        `  __s.src = ${JSON.stringify(s.src)}`,
        `  document.head.appendChild(__s)`,
        `}`,
      )
    } else if (s.body) {
      // Inline scripts aren't deduped — every recompile would re-run
      // them otherwise, which is probably what the user wants for a
      // body of side-effect code. Tag with a `data-demo` so a future
      // bundle can clear stale ones if we ever need to.
      lines.push(
        `{`,
        `  for (const old of document.querySelectorAll('script[data-demo-inline]')) old.remove()`,
        `  const __s = document.createElement('script')`,
        `  __s.dataset.demoInline = 'true'`,
        `  __s.textContent = ${JSON.stringify(s.body)}`,
        `  document.head.appendChild(__s)`,
        `}`,
      )
    }
  }
  return lines.join('\n')
}
