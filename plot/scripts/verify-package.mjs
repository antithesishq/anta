import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, writeFile, rm, readdir, chmod, realpath } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'
import { build } from 'esbuild'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const metadata = JSON.parse(await readFile(resolve(root, '.build/metafile.json'), 'utf8'))
assert.equal(metadata.outputs['dist/elements.js'].cssBundle, undefined, 'element registration does not implicitly load the standalone stylesheet')

// Follow emitted imports, including lazy chunks, to verify each entry's actual runtime boundary.
function inputs(entry, visited = new Set()) {
    if (visited.has(entry)) return []
    visited.add(entry)
    const output = metadata.outputs[entry]
    assert.ok(output, `Missing output ${entry}`)
    const result = Object.keys(output.inputs)
    for (const imported of output.imports) {
        if (imported.external) {
            assert.match(imported.path, /^(?:react(?:\/|$)|@antadesign\/anta(?:\/|$))/, `Unexpected external: ${imported.path}`)
            result.push(imported.path)
        } else {
            result.push(...inputs(imported.path, visited))
        }
    }
    return result
}
for (const input of inputs('dist/index.js')) {
    assert.doesNotMatch(input, /(?:^react-dom(?:\/|$)|preact|notebook_demo|shell\/|src\/browser\/)/)
}
for (const input of Object.keys(metadata.inputs)) {
    assert.doesNotMatch(input, /(?:^|\/)lodash(?:\/|$)|notebook_demo|(?:^|\/)shell\/|(?:^|\/)deps\/preact/)
    assert.ok(/^src\/(entries|core|integrations|browser|components)\//.test(input) || input.includes('/node_modules/'),
        `Unexpected source outside the package: ${input}`)
}
inputs('dist/browser.js') // Browser dependencies may retain the declared React peer.
assert.equal(manifest.exports['./react'], undefined)
assert.equal(manifest.peerDependencies['react-dom'], undefined)
assert.equal(manifest.peerDependencies.react, '^19.0.0')
assert.equal(manifest.exports['./components'], undefined)
assert.equal(metadata.outputs['dist/components.js'], undefined)
for (const input of inputs('dist/elements/a-plot-surface.js')) {
    assert.doesNotMatch(input, /browser\/plot_element|browser\/tooltip|anta\/elements\/a-tooltip/)
}


const sandbox = await mkdtemp(resolve(tmpdir(), 'plot-package-'))
try {
    // Exercise real element dependencies during SSR, with CSS handled by the bundler.
    const serverBundle = resolve(sandbox, 'elements-ssr.cjs')
    await build({
        stdin: {
            contents: "import './dist/elements/a-plot-surface.js'; import './dist/elements/a-plot.js'; import './dist/elements.js'; import './dist/auto.js'",
            resolveDir: root,
        },
        bundle: true,
        platform: 'node',
        format: 'cjs',
        loader: { '.css': 'empty' },
        outfile: serverBundle,
    })
    execFileSync(process.execPath, [serverBundle], { stdio: 'inherit' })

    const installed = resolve(sandbox, 'node_modules/@antadesign/plot')
    await mkdir(installed, { recursive: true })
    await cp(resolve(root, 'dist'), resolve(installed, 'dist'), { recursive: true })
    await writeFile(resolve(installed, 'package.json'), JSON.stringify(manifest))
    await writeFile(resolve(sandbox, 'package.json'), '{"type":"module"}')

    // Exercise lifecycle behavior through an internal test bundle, never through package exports.
    await build({
        stdin: {
            contents: [
                "export { PlotController } from './src/core/controller'",
                "export { create_anta_host } from './src/integrations/anta_host'",
                "export { resolve_canvas_size } from './src/core/compose/layout'",
                "export { update_hover_canvas } from './src/core/render/highlight'",
            ].join(';'),
            resolveDir: root,
        },
        bundle: true, platform: 'node', format: 'esm',
        outfile: resolve(sandbox, 'internal.mjs'),
    })

    // Public runtime imports deliberately have no workspace packages to fall back to.
    const runtime = `
        import assert from 'node:assert/strict'
        import { readFile } from 'node:fs/promises'
        import * as plot from './public.mjs'
        import * as internal from './internal.mjs'
        import * as browser from '@antadesign/plot/browser'
        await browser.definePlotElement()
        assert.equal(browser.definePlotSurfaceElement, undefined)
        assert.deepEqual(Object.keys(plot).sort(), ['Plot','PlotSurface','area','bar','custom','line','rect','rule','scatter'])
        const rows = [{x:1,y:2},{x:2,y:4},{x:3,y:3}]
        // Both custom highlight paths remain supported by the internal renderer.
        const highlightContext = new Proxy({canvas:{width:600,height:300}}, {
            get(target, key) { return key in target ? target[key] : () => {} },
        })
        for (const explicit of [false, true]) {
            let painted
            const series = plot.custom({
                data: rows, hit_test: () => 1,
                renderer(series) { painted = {length:series.rows.length, row:series.rows[0]} },
                ...(explicit ? {highlight_renderer(series, index) {
                    painted = {length:series.rows.length, row:series.rows[index]}
                }} : {}),
            })
            const controller = new internal.PlotController({series:[series]})
            const composed = controller.compose({width:600,height:300,color_theme:'light',device_pixel_ratio:1})
            assert.ok(composed)
            internal.update_hover_canvas(highlightContext, composed, 1, [{series_index:0,point_index:1}])
            assert.deepEqual(painted, {length:explicit ? 3 : 1, row:rows[1]})
        }
        for (const kind of ['scatter','bar','rect','line','rule','area','custom']) {
            const args = kind === 'bar' ? {data:[{x:'a',y:2},{x:'b',y:4}]} :
                kind === 'rule' ? {x:2} : kind === 'custom' ? {data:rows,renderer(){}} :
                kind === 'rect' ? {data:rows,size:8} : {data:rows}
            const controller = new internal.PlotController({series:[plot[kind](args)]})
            const composed = controller.compose({width:600,height:300,color_theme:'light',device_pixel_ratio:1})
            assert.ok(composed)
            const adapter = internal.create_anta_host({controller,on_measure(){},on_context(){},on_viewport(){},
                on_viewport_report(){},on_hover(){},on_pointer_change(){}})
            assert.ok(adapter.capture_props(composed, controller.interactions.committed_viewport))
            adapter.disconnect()
        }
        assert.deepEqual(internal.resolve_canvas_size({}, {width:200.5,height:100.5}), {width:200,height:100})
        const controller = new internal.PlotController({series:[plot.scatter({data:rows})]})
        controller.compose({width:600,height:300,color_theme:'light',device_pixel_ratio:1})
        assert.equal(controller.interactions.handle_wheel({offsetX:200,offsetY:100,deltaY:-100,ctrlKey:true},controller.template.zoom_pan),true)
        assert.notEqual(controller.interactions.staged_viewport.x,null)
        for (const path of ['components', 'host', 'anta', 'core/controller']) {
            await assert.rejects(import('@antadesign/plot/' + path), {code:'ERR_PACKAGE_PATH_NOT_EXPORTED'})
        }
        const css = await readFile(new URL(import.meta.resolve('@antadesign/plot/plot.css')), 'utf8')
        assert.ok(css.includes(':where(a-plot)'), 'standalone host layout')
        assert.ok(!css.includes('a-plot-surface'), 'surface owns its layout')
    `
    await writeFile(resolve(sandbox, 'runtime.mjs'), runtime)

    // Copy the public runtime and declaration dependencies; do not symlink the workspace node_modules tree.
    async function writable_directories(directory) {
        await chmod(directory, 0o755)
        for (const item of await readdir(directory, { withFileTypes: true })) {
            if (item.isDirectory()) await writable_directories(resolve(directory, item.name))
        }
    }
    const copied = new Set()
    async function copy_dependency(name, resolver = require) {
        if (copied.has(name)) return
        copied.add(name)
        let package_path
        for (const directory of resolver.resolve.paths(name) ?? []) {
            const candidate = resolve(directory, name, 'package.json')
            if (ts.sys.fileExists(candidate)) { package_path = candidate; break }
        }
        assert.ok(package_path, `Install declaration dependency: ${name}`)
        // pnpm stores transitive dependencies beside the real package, not its workspace symlink.
        package_path = await realpath(package_path)
        const info = JSON.parse(await readFile(package_path, 'utf8'))
        const destination = resolve(sandbox, 'node_modules', name)
        if (name === '@antadesign/anta') {
            // The workspace link points at the repository root; copy only its built package.
            await mkdir(destination, { recursive: true })
            await cp(package_path, resolve(destination, 'package.json'))
            await cp(resolve(dirname(package_path), 'dist'), resolve(destination, 'dist'), {
                recursive: true, dereference: true,
            })
        } else {
            await cp(dirname(package_path), destination, {
                recursive: true, dereference: true,
                filter: path => !['node_modules', '.git'].includes(basename(path)),
            })
        }
        await writable_directories(destination)
        const child_resolver = createRequire(package_path)
        for (const dependency of Object.keys(info.dependencies ?? {})) {
            await copy_dependency(dependency, child_resolver)
        }
    }
    for (const name of ['@types/d3-scale', '@antadesign/anta', '@types/react', 'react']) await copy_dependency(name)
    // Components use Anta's bundler-facing entry, including for server rendering.
    await writeFile(resolve(sandbox, 'public-entry.mjs'), "export * from '@antadesign/plot'")
    await build({
        absWorkingDir: sandbox,
        entryPoints: { public: 'public-entry.mjs' },
        outdir: sandbox, bundle: true, splitting: true, platform: 'node', format: 'esm',
        outExtension: { '.js': '.mjs' }, loader: { '.css': 'empty' }, external: ['react'],
    })
    execFileSync(process.execPath, ['runtime.mjs'], { cwd: sandbox, stdio: 'inherit', env: { ...process.env, NODE_PATH: '' } })

    const core_consumer = resolve(sandbox, 'core-consumer.ts')
    await writeFile(core_consumer, `
        import { Plot, PlotSurface, scatter, type PlotArgs, type PlotProps, type PlotSurfaceProps, type PlotLifecycleError, type FontArg, type FontConfig, type FontCaps } from '@antadesign/plot'
        import type { ReactNode } from 'react'
        const props: PlotProps<ReactNode> = {plotArgs:{series:[]}}
        const surfaceProps: PlotSurfaceProps = {canvasOwner:'worker'}
        Plot(props)
        PlotSurface(surfaceProps)
        // @ts-expect-error Rendering lifecycle ownership is internal.
        import { PlotController } from '@antadesign/plot'
        // @ts-expect-error Canvas lifecycle helpers are internal.
        import { update_hover_canvas } from '@antadesign/plot'
        const args: PlotArgs<string> = {series:[scatter<string>({data:[{x:1,y:2}],tooltip:()=> 'text'})]}
        const caps: FontCaps = 'small-caps'
        const font: FontConfig = { size: 12, weight: 450, caps, letter_spacing: -0.5 }
        const family: FontArg = 'Example, sans-serif'
        const typography: PlotArgs = { series: [], font: family,
            title: { text: 'Title', font },
            axis: { x: { label: { text: 'X', font }, tick_label: { font: family } } } }
        // @ts-expect-error Title size is now nested under font.
        const oldTitle: PlotArgs = { series: [], title: { text: 'Title', size: 12 } }
        // @ts-expect-error Label color is now nested under font.
        const oldLabel: PlotArgs = { series: [], axis: { x: { label: { text: 'X', color: 'red' } } } }
        // @ts-expect-error Tick size is now nested under font.
        const oldTicks: PlotArgs = { series: [], axis: { y: { tick_label: { size: 10 } } } }
        const onError = (failure: PlotLifecycleError) => failure.phase
    `)
    const core_program = ts.createProgram([core_consumer], {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext,
        moduleResolution: ts.ModuleResolutionKind.Bundler, strict: true, noEmit: true,
        skipLibCheck: false, types: [], noUncheckedSideEffectImports: false,
        lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    })
    const core_diagnostics = ts.getPreEmitDiagnostics(core_program)
    assert.equal(core_diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(core_diagnostics, {
        getCanonicalFileName: name => name, getCurrentDirectory: () => sandbox, getNewLine: () => '\n',
    }))
    // Notebook uses legacy Node resolution with skipLibCheck and no package paths overrides.
    const legacy_program = ts.createProgram([core_consumer], {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS,
        moduleResolution: ts.ModuleResolutionKind.Node10, strict: true, noEmit: true,
        skipLibCheck: true, types: [], ignoreDeprecations: '6.0',
        lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    })
    const legacy_diagnostics = ts.getPreEmitDiagnostics(legacy_program)
    assert.equal(legacy_diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(legacy_diagnostics, {
        getCanonicalFileName: name => name, getCurrentDirectory: () => sandbox, getNewLine: () => '\n',
    }))
    const consumer = `
        import { scatter, custom, type PlotArgs, type CustomRendererFn, type CustomHighlightRendererFn } from '@antadesign/plot'
        import { definePlotElement, type APlotElement } from '@antadesign/plot/browser'
        import { PlotSurface, Plot, type PlotProps } from '@antadesign/plot'
        import { createElement } from 'react'
        const reactProps: PlotProps = {
            plotArgs: { series: [scatter({ data: [{x:1,y:2}], tooltip: () => createElement('strong', null, 'point') })] },
            onError(failure) { const phase: string = failure.phase },
        }
        createElement(Plot<React.ReactNode>, reactProps)
        const renderer: CustomRendererFn = (series, context) => { context.color_at(0) }
        const highlight_renderer: CustomHighlightRendererFn = (series, index, context) => { context.color_at(index) }
        custom({data:[{x:1,y:2}], renderer, highlight_renderer, hit_test:() => 0})
        import { Plot as AntaPlot, type PlotProps as AntaPlotProps } from '@antadesign/plot'
        const antaProps: AntaPlotProps = { plotArgs: { series: [scatter({data: [{x:1,y:2}], tooltip: true})] } }
        AntaPlot(antaProps)
        AntaPlot({ plotArgs: reactProps.plotArgs })
        import { plotElementReady as legacyReady } from '@antadesign/plot/auto'
        import '@antadesign/plot/elements/a-plot'
        import '@antadesign/plot/elements/a-plot-surface'
        import { plotElementReady } from '@antadesign/plot/elements'
        import { plotSurfaceElementReady } from '@antadesign/plot/elements'
        const args: PlotArgs<string> = {series:[scatter<string>({data:[{x:1,y:2}],tooltip:()=> 'text'})]}
        // @ts-expect-error Tooltip content must match the declared host content type.
        const invalid: PlotArgs<string> = {series:[scatter<number>({data:[],tooltip:()=> 1})]}
    `
    await writeFile(resolve(sandbox, 'consumer.ts'), consumer)
    for (const resolution of [ts.ModuleResolutionKind.Bundler, ts.ModuleResolutionKind.NodeNext]) {
        const program = ts.createProgram([resolve(sandbox, 'consumer.ts')], {
            target: ts.ScriptTarget.ES2022,
            module: resolution === ts.ModuleResolutionKind.NodeNext ? ts.ModuleKind.NodeNext : ts.ModuleKind.ESNext,
            moduleResolution: resolution,
            strict: true,
            noEmit: true,
            skipLibCheck: true,
            types: [],
            lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
        })
        const diagnostics = ts.getPreEmitDiagnostics(program)
        assert.equal(diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(diagnostics, {
            getCanonicalFileName: name => name, getCurrentDirectory: () => sandbox, getNewLine: () => '\n',
        }))
    }
    console.log('PASS: isolated ESM exports, seven factories, internal composition and interactions, SSR imports, CSS, private lifecycle API and legacy Node/Bundler/NodeNext consumer types')
} finally {
    await rm(sandbox, { recursive: true, force: true })
}
