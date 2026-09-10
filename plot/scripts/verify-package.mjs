import assert from 'node:assert/strict'
import { cp, mkdir, mkdtemp, readFile, writeFile, rm, readdir, chmod, realpath } from 'node:fs/promises'
import { basename, dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import ts from 'typescript'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const require = createRequire(import.meta.url)
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const metadata = JSON.parse(await readFile(resolve(root, '.build/metafile.json'), 'utf8'))

// Follow emitted imports, including lazy chunks, to verify each entry's actual runtime boundary.
function inputs(entry, visited = new Set()) {
    if (visited.has(entry)) return []
    visited.add(entry)
    const output = metadata.outputs[entry]
    assert.ok(output, `Missing output ${entry}`)
    const result = Object.keys(output.inputs)
    for (const imported of output.imports) {
        if (imported.external) {
            assert.match(imported.path, /^(?:react(?:-dom)?(?:\/|$)|@antadesign\/anta(?:\/|$))/, `Unexpected external: ${imported.path}`)
            result.push(imported.path)
        } else {
            result.push(...inputs(imported.path, visited))
        }
    }
    return result
}
for (const input of inputs('dist/index.js')) {
    assert.doesNotMatch(input, /(?:@antadesign|(?:^|\/)react(?:\/|$)|preact|notebook_demo|shell\/)/)
}
for (const input of Object.keys(metadata.inputs)) {
    assert.doesNotMatch(input, /(?:^|\/)lodash(?:\/|$)|notebook_demo|(?:^|\/)shell\/|(?:^|\/)deps\/preact/)
    assert.ok(/^src\/(entries|core|integrations|browser)\//.test(input) || input.includes('/node_modules/'),
        `Unexpected source outside the package: ${input}`)
}
inputs('dist/browser.js') // Browser dependencies may retain the declared React peer.


const sandbox = await mkdtemp(resolve(tmpdir(), 'plot-package-'))
try {
    const installed = resolve(sandbox, 'node_modules/@antadesign/plot')
    await mkdir(installed, { recursive: true })
    await cp(resolve(root, 'dist'), resolve(installed, 'dist'), { recursive: true })
    await writeFile(resolve(installed, 'package.json'), JSON.stringify(manifest))
    await writeFile(resolve(sandbox, 'package.json'), '{"type":"module"}')

    // Runtime imports deliberately have no source checkout, aliases, React, Anta or lodash to fall back to.
    const runtime = `
        import assert from 'node:assert/strict'
        import { readFile } from 'node:fs/promises'
        import * as plot from '@antadesign/plot'
        import { create_anta_host } from '@antadesign/plot'
        import { definePlotElement, definePlotSurfaceElement } from '@antadesign/plot/browser'
        import { plotElementReady } from '@antadesign/plot/auto'
        await plotElementReady
        await assert.rejects(definePlotElement(), /browser custom-element registry/)
        await assert.rejects(definePlotSurfaceElement(), /browser custom-element registry/)
        const rows = [{x:1,y:2},{x:2,y:4},{x:3,y:3}]
        for (const kind of ['scatter','bar','rect','line','rule','area','custom']) {
            const args = kind === 'bar' ? {data:[{x:'a',y:2},{x:'b',y:4}]} :
                kind === 'rule' ? {x:2} : kind === 'custom' ? {data:rows,renderer(){}} :
                kind === 'rect' ? {data:rows,size:8} : {data:rows}
            const controller = new plot.PlotController({series:[plot[kind](args)]})
            const composed = controller.compose({width:600,height:300,color_theme:'light',device_pixel_ratio:1})
            assert.ok(composed)
            const adapter = create_anta_host({controller,on_measure(){},on_context(){},on_viewport(){},
                on_viewport_report(){},on_hover(){},on_pointer_change(){}})
            assert.ok(adapter.capture_props(composed, controller.interactions.committed_viewport))
            adapter.disconnect()
        }
        assert.deepEqual(plot.resolve_canvas_size({}, {width:200.5,height:100.5}), {width:200,height:100})
        const controller = new plot.PlotController({series:[plot.scatter({data:rows})]})
        controller.compose({width:600,height:300,color_theme:'light',device_pixel_ratio:1})
        assert.equal(controller.interactions.handle_wheel({offsetX:200,offsetY:100,deltaY:-100,ctrlKey:true},controller.template.zoom_pan),true)
        assert.notEqual(controller.interactions.staged_viewport.x,null)
        for (const path of ['host', 'anta', 'core/controller']) {
            await assert.rejects(import('@antadesign/plot/' + path), {code:'ERR_PACKAGE_PATH_NOT_EXPORTED'})
        }
        const css = await readFile(new URL(import.meta.resolve('@antadesign/plot/plot.css')), 'utf8')
        for (const selector of ['a-plot-surface','a-capture']) assert.ok(css.includes(selector),selector)
    `
    await writeFile(resolve(sandbox, 'runtime.mjs'), runtime)
    execFileSync(process.execPath, ['runtime.mjs'], { cwd: sandbox, stdio: 'inherit', env: { ...process.env, NODE_PATH: '' } })

    // Copy only the declaration dependency closure; do not symlink the workspace node_modules tree.
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
    for (const name of ['@types/d3-scale', '@antadesign/anta', '@types/react']) await copy_dependency(name)
    const core_consumer = resolve(sandbox, 'core-consumer.ts')
    await writeFile(core_consumer, `
        import { scatter, PlotController, type PlotArgs } from '@antadesign/plot'
        import { prepare_canvas_context } from '@antadesign/plot'
        const args: PlotArgs<string> = {series:[scatter<string>({data:[{x:1,y:2}],tooltip:()=> 'text'})]}
        const controller = new PlotController(args)
    `)
    const core_program = ts.createProgram([core_consumer], {
        target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.NodeNext,
        moduleResolution: ts.ModuleResolutionKind.NodeNext, strict: true, noEmit: true,
        skipLibCheck: false, types: [],
        lib: ['lib.es2022.d.ts', 'lib.dom.d.ts', 'lib.dom.iterable.d.ts'],
    })
    const core_diagnostics = ts.getPreEmitDiagnostics(core_program)
    assert.equal(core_diagnostics.length, 0, ts.formatDiagnosticsWithColorAndContext(core_diagnostics, {
        getCanonicalFileName: name => name, getCurrentDirectory: () => sandbox, getNewLine: () => '\n',
    }))
    const consumer = `
        import { scatter, PlotController, type PlotArgs, type CustomRendererFn } from '@antadesign/plot'
        import { resolve_canvas_size, prepare_canvas_context, render_tooltip_body } from '@antadesign/plot'
        import { create_anta_host, type AntaHostAdapter } from '@antadesign/plot'
        import { definePlotElement, type APlotElement } from '@antadesign/plot/browser'
        import type { CaptureProps } from '@antadesign/anta'
        import { plotElementReady } from '@antadesign/plot/auto'
        const args: PlotArgs<string> = {series:[scatter<string>({data:[{x:1,y:2}],tooltip:()=> 'text'})]}
        const controller = new PlotController(args)
        const adapter: AntaHostAdapter<string> = create_anta_host({controller,on_measure(){},on_context(){},
            on_viewport(){},on_viewport_report(){},on_hover(){},on_pointer_change(){}})
        const composed = controller.compose({width:600,height:300,color_theme:'light',device_pixel_ratio:1})
        const capture: CaptureProps = adapter.capture_props(composed, controller.interactions.committed_viewport)
        adapter.disconnect()
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
    console.log('PASS: isolated ESM exports, seven factories, composition, interactions, SSR imports, CSS, private paths and Bundler/NodeNext consumer types')
} finally {
    await rm(sandbox, { recursive: true, force: true })
}
