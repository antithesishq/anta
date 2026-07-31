/**
 * Reproduces the measured figures on /comparison.
 *
 * It downloads the exact versions in comparison-data.ts into a temporary
 * directory, makes a deliberately non-tree-shaken full-library ESM bundle,
 * and sums the gzip-9 size of emitted JavaScript and CSS. React and React DOM
 * stay external because every React library lists them as peer dependencies.
 * It also records the current Polaris CDN snapshot and its font resources.
 * Source-copy and independently versioned systems use the explicit component
 * boundaries documented on their cards.
 */
import { build } from 'esbuild'
import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import { gzipSync } from 'node:zlib'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { promisify } from 'node:util'

const run = promisify(execFile)

const packages = [
  ['anta', '@antadesign/anta@0.3.16'],
  ['webawesome', '@awesome.me/webawesome@3.10.0'],
  ['mui', '@mui/material@9.2.0'],
  ['antd', 'antd@6.5.2'],
  ['mantine', '@mantine/core@9.4.2'],
  ['carbon', '@carbon/react@1.112.0'],
  ['blueprint', '@blueprintjs/core@6.17.2'],
  ['astryx', '@astryxdesign/core@0.1.8'],
  ['gravity', '@gravity-ui/uikit@7.47.1'],
  ['radix', 'radix-ui@1.6.7'],
  ['baseui', '@base-ui/react@1.6.0'],
  // Explicit peers that participate in the full imports below.
  ['emotion-react', '@emotion/react@11.14.0'],
  ['emotion-styled', '@emotion/styled@11.14.0'],
  ['mantine-hooks', '@mantine/hooks@9.4.2'],
  ['stylex', '@stylexjs/stylex@0.19.0'],
]

// The public Design System component packages, not Atlassian product packages.
// Tables, icons, editor/media/ADF, navigation shells, Smart Links, JQL, people
// pickers, analytics, and pragmatic drag-and-drop are intentionally omitted.
const atlaskitPackages = [
  '@atlaskit/avatar',
  '@atlaskit/avatar-group',
  '@atlaskit/badge',
  '@atlaskit/banner',
  '@atlaskit/blanket',
  '@atlaskit/breadcrumbs',
  '@atlaskit/button',
  '@atlaskit/calendar',
  '@atlaskit/checkbox',
  '@atlaskit/code',
  '@atlaskit/color-picker',
  '@atlaskit/comment',
  '@atlaskit/css-reset',
  '@atlaskit/date',
  '@atlaskit/date-label',
  '@atlaskit/datetime-picker',
  '@atlaskit/drawer',
  '@atlaskit/dropdown-menu',
  '@atlaskit/empty-state',
  '@atlaskit/flag',
  '@atlaskit/focus-ring',
  '@atlaskit/form',
  '@atlaskit/grid',
  '@atlaskit/heading',
  '@atlaskit/image',
  '@atlaskit/inline-dialog',
  '@atlaskit/inline-edit',
  '@atlaskit/inline-message',
  '@atlaskit/link',
  '@atlaskit/lozenge',
  '@atlaskit/menu',
  '@atlaskit/modal-dialog',
  '@atlaskit/motion',
  '@atlaskit/pagination',
  '@atlaskit/panel',
  '@atlaskit/popup',
  '@atlaskit/portal',
  '@atlaskit/primitives',
  '@atlaskit/progress-bar',
  '@atlaskit/progress-indicator',
  '@atlaskit/radio',
  '@atlaskit/range',
  '@atlaskit/rating',
  '@atlaskit/section-message',
  '@atlaskit/select',
  '@atlaskit/skeleton',
  '@atlaskit/spinner',
  '@atlaskit/status',
  '@atlaskit/tabs',
  '@atlaskit/tag',
  '@atlaskit/tag-group',
  '@atlaskit/textarea',
  '@atlaskit/textfield',
  '@atlaskit/toggle',
  '@atlaskit/tokens',
  '@atlaskit/tooltip',
  '@atlaskit/visually-hidden',
]

const untitledSupportPackages = [
  'tailwindcss@4.3.3',
  '@tailwindcss/cli@4.3.3',
]
const shadcnSupportPackages = [
  'class-variance-authority@0.7.1',
  'cmdk@1.1.1',
  'embla-carousel-react@8.5.2',
  'input-otp@1.4.2',
  'react-day-picker@9.7.0',
  'date-fns@4.1.0',
  'react-resizable-panels@4',
  'recharts@3.8.0',
  'sonner@2.0.0',
  'next-themes@0.4.6',
  'tailwind-merge@3.6.0',
  'tw-animate-css@1.4.0',
  'shadcn@4.16.0',
]
const atlaskitSupportPackages = [
  // Peer dependencies of Color picker and the still-published Panel package.
  'react-intl@7.1.11',
  'styled-components@6.1.15',
]
const untitledRepo = 'https://github.com/untitleduico/react.git'
const untitledRevision = 'eaee6a5b9798fa6867b4d896c6cfecf6ce706a73'
const shadcnRepo = 'https://github.com/shadcn-ui/ui.git'
const shadcnRevision = '705ce5961080264830471ddd885c01b907706068'

const externalReact = ['react', 'react/*', 'react-dom', 'react-dom/*']
const polarisUrl = 'https://cdn.shopify.com/shopifycloud/polaris.js'
const interCssUrl = 'https://cdn.shopify.com/static/fonts/inter/v4/styles.css'

async function filesBelow(dir) {
  const entries = await readdir(dir, { withFileTypes: true })
  const paths = await Promise.all(entries.map(async (entry) => {
    const path = join(dir, entry.name)
    return entry.isDirectory() ? filesBelow(path) : [path]
  }))
  return paths.flat()
}

function entryFor(id) {
  switch (id) {
    case 'anta':
      return `
        import * as api from '@antadesign/anta';
        import * as elements from '@antadesign/anta/elements';
        import '@antadesign/anta/tokens.css';
        import '@antadesign/anta/reset.css';
        globalThis.__comparison = { api, elements };
      `
    case 'mui':
      return `import * as api from '@mui/material'; globalThis.__comparison = api;`
    case 'antd':
      return `import * as api from 'antd'; globalThis.__comparison = api;`
    case 'mantine':
      return `
        import * as api from '@mantine/core';
        import '@mantine/core/styles.css';
        globalThis.__comparison = api;
      `
    case 'carbon':
      return `
        import * as api from '@carbon/react';
        import '@carbon/styles/css/styles.css';
        globalThis.__comparison = api;
      `
    case 'blueprint':
      return `
        import * as api from '@blueprintjs/core';
        import '@blueprintjs/core/lib/css/blueprint.css';
        globalThis.__comparison = api;
      `
    case 'astryx':
      return `
        import * as api from '@astryxdesign/core';
        import '@astryxdesign/core/astryx.css';
        globalThis.__comparison = api;
      `
    case 'gravity':
      return `
        import * as api from '@gravity-ui/uikit';
        import '@gravity-ui/uikit/styles/styles.css';
        globalThis.__comparison = api;
      `
    case 'radix':
      return `import * as api from 'radix-ui'; globalThis.__comparison = api;`
    case 'baseui':
      return `import * as api from '@base-ui/react'; globalThis.__comparison = api;`
    default:
      throw new Error(`Unknown comparison package: ${id}`)
  }
}

function atlaskitEntry() {
  const imports = atlaskitPackages
    .filter((name) => name !== '@atlaskit/css-reset')
    .map((name, index) => `import * as package${index} from ${JSON.stringify(name)};`)
    .join('\n')
  const namespaces = atlaskitPackages
    .filter((name) => name !== '@atlaskit/css-reset')
    .map((_, index) => `package${index}`)
    .join(', ')

  return `
    import '@atlaskit/css-reset';
    ${imports}
    globalThis.__comparison = [${namespaces}];
  `
}

async function webAwesomeEntry(installDir) {
  const packageDir = join(installDir, 'node_modules/@awesome.me/webawesome')
  const componentDir = join(packageDir, 'dist/components')
  const modules = (await filesBelow(componentDir))
    .filter((path) => path.endsWith('.js') && !path.endsWith('.styles.js'))
    .map((path) => `import ${JSON.stringify(path)};`)
    .join('\n')

  return `${modules}\nimport '@awesome.me/webawesome/dist/styles/webawesome.css';`
}

async function packageVersion(spec, installDir) {
  const name = spec.slice(0, spec.lastIndexOf('@'))
  const manifest = JSON.parse(await readFile(join(installDir, 'node_modules', name, 'package.json'), 'utf8'))
  return manifest.version
}

async function fetchAsset(url) {
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Could not fetch ${url}: ${response.status}`)
  return {
    bytes: Buffer.from(await response.arrayBuffer()),
    lastModified: response.headers.get('last-modified'),
  }
}

async function untitledSnapshot(installDir) {
  const sourceDir = join(installDir, 'untitled-ui-react')
  await mkdir(sourceDir, { recursive: true })
  await run('git', ['-C', sourceDir, 'init'])
  await run('git', ['-C', sourceDir, 'fetch', '--depth', '1', untitledRepo, untitledRevision])
  await run('git', ['-C', sourceDir, 'checkout', '--detach', 'FETCH_HEAD'])
  await run('npm', [
    'install', '--omit=dev', '--ignore-scripts', '--legacy-peer-deps', '--loglevel=error',
  ], { cwd: sourceDir })

  const componentPaths = (await Promise.all([
    filesBelow(join(sourceDir, 'components/base')),
    filesBelow(join(sourceDir, 'components/application')),
  ])).flat().filter((path) => (
    /\.(?:ts|tsx)$/.test(path)
    && !/\.(?:demo|story|test)\.[jt]sx?$/.test(path)
  ))
  const entry = componentPaths
    .map((path, index) => `import * as component${index} from ${JSON.stringify(path)};`)
    .join('\n') + `\nglobalThis.__comparison = [${componentPaths.map((_, index) => `component${index}`).join(', ')}];`
  const output = await build({
    stdin: { contents: entry, resolveDir: sourceDir, sourcefile: 'untitled-ui-app-components.tsx' },
    bundle: true,
    external: [
      ...externalReact,
      '@untitledui/icons', '@untitledui/icons/*',
      '@untitledui/file-icons', '@untitledui/file-icons/*',
      'next', 'next/*',
    ],
    format: 'esm',
    logLevel: 'silent',
    minify: true,
    outdir: 'out',
    platform: 'browser',
    target: 'es2022',
    tsconfig: join(sourceDir, 'tsconfig.json'),
    write: false,
  })

  const styleDir = join(sourceDir, 'styles')
  const globals = (await readFile(join(styleDir, 'globals.css'), 'utf8'))
    .replace('@import "tailwindcss";', '@import "tailwindcss" source(none);')
  const cssInput = join(styleDir, 'comparison.css')
  await writeFile(cssInput, `${globals}
@source "../components/base";
@source "../components/application";
@source "../components/foundations";
@source "../components/internal";
@source "../hooks";
@source "../utils";
`)
  const cssPath = join(styleDir, 'untitled-ui-app-components.css')
  await run(process.execPath, [
    join(installDir, 'node_modules/@tailwindcss/cli/dist/index.mjs'),
    '-i', cssInput, '-o', cssPath, '--minify',
  ], { cwd: sourceDir })

  const jsGzip = output.outputFiles.reduce((total, file) => total + gzipSync(file.contents, { level: 9 }).length, 0)
  const cssGzip = gzipSync(await readFile(cssPath), { level: 9 }).length
  return {
    revision: untitledRevision.slice(0, 7),
    componentSourceFiles: componentPaths.length,
    jsGzipKiB: (jsGzip / 1024).toFixed(1),
    cssGzipKiB: (cssGzip / 1024).toFixed(1),
    gzipKiB: Math.round((jsGzip + cssGzip) / 1024),
  }
}

async function shadcnBaseSnapshot(installDir) {
  const repoDir = join(installDir, 'shadcn-ui')
  await mkdir(repoDir, { recursive: true })
  await run('git', ['-C', repoDir, 'init'])
  await run('git', ['-C', repoDir, 'fetch', '--depth', '1', shadcnRepo, shadcnRevision])
  await run('git', ['-C', repoDir, 'checkout', '--detach', 'FETCH_HEAD'])

  const appDir = join(repoDir, 'apps/v4')
  const uiDir = join(appDir, 'registry/bases/base/ui')
  const componentPaths = (await filesBelow(uiDir))
    .filter((path) => path.endsWith('.tsx') && !path.endsWith('_registry.ts'))
  const entry = componentPaths
    .map((path, index) => `import * as component${index} from ${JSON.stringify(path)};`)
    .join('\n') + `\nglobalThis.__comparison = [${componentPaths.map((_, index) => `component${index}`).join(', ')}];`
  // Registry source refers to the documentation app's icon placeholder. The
  // shipped CLI substitutes it with the selected icon library, which is out
  // of scope for this no-icons comparison. Keep the placeholder lightweight
  // rather than pulling in the app's Next.js-only implementation.
  const iconPlaceholder = join(installDir, 'shadcn-icon-placeholder.tsx')
  await writeFile(iconPlaceholder, 'export function IconPlaceholder() { return null }\n')
  const messageScroller = join(repoDir, 'packages/react/src/message-scroller/index.ts')
  const output = await build({
    stdin: { contents: entry, resolveDir: appDir, sourcefile: 'shadcn-base-ui.tsx' },
    bundle: true,
    external: [...externalReact, 'lucide-react', 'lucide-react/*'],
    format: 'esm',
    logLevel: 'silent',
    minify: true,
    outdir: 'out',
    platform: 'browser',
    target: 'es2022',
    tsconfig: join(appDir, 'tsconfig.json'),
    plugins: [{
      name: 'comparison-shadcn-registry-aliases',
      setup(build) {
        build.onResolve({ filter: /^@\/app\/\(create\)\/components\/icon-placeholder$/ }, () => ({ path: iconPlaceholder }))
        build.onResolve({ filter: /^@shadcn\/react\/message-scroller$/ }, () => ({ path: messageScroller }))
      },
    }],
    write: false,
  })

  const cssInput = join(appDir, 'shadcn-base-ui.css')
  const cssPath = join(appDir, 'shadcn-base-ui.compiled.css')
  await writeFile(cssInput, `@import "tailwindcss" source(none);
@import "tw-animate-css";
@import "shadcn/tailwind.css";
@theme inline {
  --font-sans: var(--font-sans);
  --font-heading: var(--font-heading);
  --font-mono: var(--font-mono);
  --radius-sm: calc(var(--radius) * 0.6);
  --radius-md: calc(var(--radius) * 0.8);
  --radius-lg: var(--radius);
  --radius-xl: calc(var(--radius) * 1.4);
  --radius-2xl: calc(var(--radius) * 1.8);
  --radius-3xl: calc(var(--radius) * 2.2);
  --radius-4xl: calc(var(--radius) * 2.6);
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-popover: var(--popover);
  --color-popover-foreground: var(--popover-foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-destructive: var(--destructive);
  --color-destructive-foreground: var(--destructive-foreground);
  --color-border: var(--border);
  --color-input: var(--input);
  --color-ring: var(--ring);
  --color-chart-1: var(--chart-1);
  --color-chart-2: var(--chart-2);
  --color-chart-3: var(--chart-3);
  --color-chart-4: var(--chart-4);
  --color-chart-5: var(--chart-5);
  --color-sidebar: var(--sidebar);
  --color-sidebar-foreground: var(--sidebar-foreground);
  --color-sidebar-primary: var(--sidebar-primary);
  --color-sidebar-primary-foreground: var(--sidebar-primary-foreground);
  --color-sidebar-accent: var(--sidebar-accent);
  --color-sidebar-accent-foreground: var(--sidebar-accent-foreground);
  --color-sidebar-border: var(--sidebar-border);
  --color-sidebar-ring: var(--sidebar-ring);
  --color-surface: var(--surface);
  --color-surface-foreground: var(--surface-foreground);
  --color-code: var(--code);
  --color-code-foreground: var(--code-foreground);
  --color-code-highlight: var(--code-highlight);
  --color-code-number: var(--code-number);
  --color-selection: var(--selection);
  --color-selection-foreground: var(--selection-foreground);
}
@source "./registry/bases/base/ui";
@layer base {
  * { @apply border-border outline-ring/50; }
  body { @apply bg-background text-foreground; }
}
`)
  await run(process.execPath, [
    join(installDir, 'node_modules/@tailwindcss/cli/dist/index.mjs'),
    '-i', cssInput, '-o', cssPath, '--minify',
  ], { cwd: appDir })

  const jsGzip = output.outputFiles.reduce((total, file) => total + gzipSync(file.contents, { level: 9 }).length, 0)
  const cssGzip = gzipSync(await readFile(cssPath), { level: 9 }).length
  return {
    revision: shadcnRevision.slice(0, 7),
    components: componentPaths.length,
    jsGzipKiB: (jsGzip / 1024).toFixed(1),
    cssGzipKiB: (cssGzip / 1024).toFixed(1),
    gzipKiB: Math.round((jsGzip + cssGzip) / 1024),
  }
}

async function polarisSnapshot() {
  const script = await fetchAsset(polarisUrl)
  const stylesheet = await fetchAsset(interCssUrl)
  const css = stylesheet.bytes.toString('utf8')
  const match = css.match(/url\('([^']*InterVariable-latin-[^']*\.woff2)'\)/)
  if (!match) throw new Error('Could not find the Inter Latin subset URL')
  const font = await fetchAsset(new URL(match[1], interCssUrl))

  return {
    captured: new Date().toISOString(),
    fontKiB: (font.bytes.length / 1024).toFixed(1),
    scriptLastModified: script.lastModified,
    scriptGzipKiB: Math.round(gzipSync(script.bytes, { level: 9 }).length / 1024),
    stylesheetGzipKiB: (gzipSync(stylesheet.bytes, { level: 9 }).length / 1024).toFixed(2),
  }
}

const installDir = await mkdtemp(join(tmpdir(), 'anta-comparison-'))

try {
  await writeFile(installDir + '/package.json', JSON.stringify({ private: true }))
  console.log('Installing benchmark packages…')
  await run('npm', [
    'install', '--no-save', '--ignore-scripts', '--legacy-peer-deps', '--loglevel=error',
    ...packages.map(([, spec]) => spec),
    ...atlaskitPackages, ...atlaskitSupportPackages,
    ...untitledSupportPackages, ...shadcnSupportPackages,
  ], { cwd: installDir })

  const results = []
  for (const [id, spec] of packages.filter(([id]) => !id.includes('-') && id !== 'stylex')) {
    const contents = id === 'webawesome'
      ? await webAwesomeEntry(installDir)
      : entryFor(id)
    const output = await build({
      stdin: { contents, resolveDir: installDir, sourcefile: `${id}.ts` },
      bundle: true,
      external: externalReact,
      format: 'esm',
      logLevel: 'silent',
      minify: true,
      outdir: 'out',
      platform: 'browser',
      target: 'es2022',
      write: false,
    })
    const gzip = output.outputFiles.reduce((total, file) => total + gzipSync(file.contents, { level: 9 }).length, 0)
    results.push({
      system: id,
      version: await packageVersion(spec, installDir),
      gzip_kib: Math.round(gzip / 1024),
    })
  }

  console.log('Full-package ESM imports; React and React DOM external; gzip level 9.')
  console.table(results)

  const atlaskitOutput = await build({
    stdin: { contents: atlaskitEntry(), resolveDir: installDir, sourcefile: 'atlaskit.ts' },
    bundle: true,
    external: [...externalReact, '@atlaskit/icon', '@atlaskit/icon/*', '@atlaskit/icon-file-type'],
    format: 'esm',
    logLevel: 'silent',
    minify: true,
    outdir: 'out',
    platform: 'browser',
    target: 'es2022',
    write: false,
  })
  const atlaskitGzip = atlaskitOutput.outputFiles.reduce((total, file) => total + gzipSync(file.contents, { level: 9 }).length, 0)
  console.log('Atlaskit public Design System components; tables, icons, product-specific, and other heavyweight package families excluded.')
  console.table([{
    packages: atlaskitPackages.length,
    gzip_kib: Math.round(atlaskitGzip / 1024),
  }])

  const shadcn = await shadcnBaseSnapshot(installDir)
  console.log('shadcn/ui Base UI registry: all registry:ui components with Base UI and component dependencies; React and Lucide external, compiled Tailwind CSS included.')
  console.table([shadcn])

  const untitled = await untitledSnapshot(installDir)
  console.log('Untitled UI React app components: every source module in components/base and components/application; React, Next, and icon packages external, React Aria and compiled Tailwind CSS included.')
  console.table([untitled])

  const polaris = await polarisSnapshot()
  console.log('Polaris CDN snapshot; component styles ship in polaris.js, while Inter and icons load at runtime.')
  console.table([polaris])
} finally {
  await rm(installDir, { force: true, recursive: true })
}
