import { build } from 'esbuild'
import ts from 'typescript'
import { readFile, writeFile, readdir, mkdir, rm, copyFile } from 'node:fs/promises'
import { dirname, resolve, relative, extname } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const output = resolve(root, 'dist')
const config_path = resolve(root, 'tsconfig.build.json')
const config = ts.readConfigFile(config_path, ts.sys.readFile)
const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, root)
const program = ts.createProgram(parsed.fileNames, parsed.options)
const diagnostics = [...(config.error ? [config.error] : []), ...parsed.errors, ...ts.getPreEmitDiagnostics(program)]
if (diagnostics.length > 0) {
    throw new Error(ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: name => name,
        getCurrentDirectory: () => root,
        getNewLine: () => '\n',
    }))
}

// Only generated files below this package's dist directory are replaced.
await rm(output, { recursive: true, force: true })
await mkdir(output, { recursive: true })
const emitted = program.emit()
if (emitted.emitSkipped || emitted.diagnostics.length > 0) {
    throw new Error('Plot declaration emission failed')
}

// Declarations retain their module layout, with explicit ESM paths for NodeNext consumers.
async function declarations(directory) {
    for (const item of await readdir(directory, { withFileTypes: true })) {
        const path = resolve(directory, item.name)
        if (item.isDirectory()) {
            await declarations(path)
        } else if (path.endsWith('.d.ts')) {
            // CSS is a separate public asset, not a declaration dependency.
            const source = (await readFile(path, 'utf8')).replace(/^import ['"][^'"]+\.css['"];?\n/gm, '')
            const updated = source.replace(/(['"])(\.\.?\/[^'"]+)\1/g, (match, quote, specifier) => {
                if (extname(specifier)) return match
                const target = resolve(directory, specifier)
                const suffix = ts.sys.fileExists(`${target}.d.ts`) ? '.js' : '/index.js'
                if (!ts.sys.fileExists(suffix === '.js' ? `${target}.d.ts` : `${target}/index.d.ts`)) {
                    throw new Error(`Unresolved declaration import: ${path}: ${specifier}`)
                }
                return `${quote}${specifier}${suffix}${quote}`
            })
            await writeFile(path, updated)
        }
    }
}
await declarations(resolve(output, 'types'))

const result = await build({
    absWorkingDir: root,
    entryPoints: Object.fromEntries(['index', 'browser', 'auto', 'elements'].map(name => [name, `src/entries/${name}.ts`])),
    outdir: output,
    bundle: true,
    splitting: true,
    format: 'esm',
    platform: 'browser',
    target: 'es2022',
    minifyWhitespace: true,
    legalComments: 'external',
    tsconfig: config_path,
    external: ['@antadesign/anta', '@antadesign/anta/*', 'react', 'react/*', 'react-dom', 'react-dom/*'],
    chunkNames: 'chunks/[name]-[hash]',
    metafile: true,
    logLevel: 'warning',
})

// Browser entries share the plot layout stylesheet; ship one public stylesheet.
const browser_css = result.metafile.outputs['dist/browser.js'].cssBundle
const auto_css = result.metafile.outputs['dist/auto.js'].cssBundle
if (!browser_css || !auto_css) throw new Error('Missing browser styles')
const css = await readFile(resolve(root, browser_css), 'utf8')
if (css !== await readFile(resolve(root, auto_css), 'utf8')) {
    throw new Error('Browser and auto entry styles differ; choose an explicit shared stylesheet')
}
await copyFile(resolve(root, browser_css), resolve(output, 'plot.css'))
await mkdir(resolve(root, '.build'), { recursive: true })
await writeFile(resolve(root, '.build/metafile.json'), JSON.stringify(result.metafile, null, 2) + '\n')
console.log(`Built ${relative(process.cwd(), output)} (ESM, declarations, and plot.css)`)
