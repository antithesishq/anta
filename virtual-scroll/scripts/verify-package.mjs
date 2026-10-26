// Checks the built package: every export resolves, entries keep their runtime
// boundaries, and only Anta and React stay external.
import assert from 'node:assert/strict'
import { access, readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const manifest = JSON.parse(await readFile(resolve(root, 'package.json'), 'utf8'))
const metadata = JSON.parse(await readFile(resolve(root, '.build/metafile.json'), 'utf8'))

for (const [subpath, target] of Object.entries(manifest.exports)) {
    for (const file of typeof target === 'string' ? [target] : Object.values(target)) {
        await access(resolve(root, file)).catch(() => assert.fail(`Export ${subpath} points at missing ${file}`))
    }
}

// Follow emitted imports, including shared chunks, to the sources each entry loads.
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

for (const input of Object.keys(metadata.inputs)) {
    assert.match(input, /^src\/(entries|core|elements|components)\//, `Unexpected source outside the package: ${input}`)
}

// The source entry serves worker-side renderers: no renderer, no element, no Anta runtime.
for (const input of inputs('dist/source.js')) {
    assert.match(input, /^src\/(entries|core)\//, `dist/source.js must stay renderer-free, but loads ${input}`)
}

// The root entry renders through Anta's JSX runtime and never registers the element.
for (const input of inputs('dist/index.js')) {
    assert.doesNotMatch(input, /^src\/elements\/a-virtual-scroll\.ts$|^@antadesign\/anta\/elements/, `dist/index.js must not register elements, but loads ${input}`)
}

// Element entries register the element and bring its stylesheet.
for (const [entry, stylesheet] of [['dist/elements.js', './virtual-scroll.css'], ['dist/elements/a-virtual-scroll.js', '../virtual-scroll.css']]) {
    assert.ok(inputs(entry).includes('src/elements/a-virtual-scroll.ts'), `${entry} must register the element`)
    assert.ok((await readFile(resolve(root, entry), 'utf8')).startsWith(`import ${JSON.stringify(stylesheet)};`), `${entry} must import ${stylesheet}`)
}
assert.match(await readFile(resolve(root, 'dist/virtual-scroll.css'), 'utf8'), /a-virtual-scroll/)

console.log('Verified @antadesign/virtual-scroll package exports and entry boundaries')
