import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { test } from 'node:test'
import { isBaseProp } from '../site/lib/api-props.mjs'
import { parseMdx } from '../site/lib/llms/parse-mdx.mjs'
import { renderPropsTable } from '../site/lib/llms/props-from-api.mjs'

test('every PropsTable renders, including labels and reordered attributes', () => {
  const calls = []
  const source = `<PropsTable component="Capture" />
<PropsTable label='Field' component='CaptureWheelInput' />
<PropsTable
  component="CapturePan" label="Option"
/>
\`<PropsTable component="InlineExample" />\`
\`\`\`astro
<PropsTable component="CodeExample" />
\`\`\``
  const result = parseMdx(source, {
    renderPropsTable(component, label = 'Prop') {
      calls.push([component, label])
      return `| ${label} |\n| --- |\n| \`<a-capture>\` |`
    },
  })
  assert.deepEqual(calls, [['Capture', 'Prop'], ['CaptureWheelInput', 'Field'], ['CapturePan', 'Option']])
  assert.equal(result.match(/\| `<a-capture>` \|/g)?.length, 3)
  assert.ok(result.includes('`<PropsTable component="InlineExample" />`'))
  assert.ok(result.includes('```astro\n<PropsTable component="CodeExample" />\n```'))
})

test('Capture and Box secondary references have tables in Markdown', async () => {
  for (const [page, count] of [['capture', 8], ['box', 5]]) {
    const source = await readFile(new URL(`../site/src/pages/${page}.mdx`, import.meta.url), 'utf8')
    const markdown = parseMdx(source, { renderPropsTable })
    assert.equal(markdown.match(/^\| (?:Prop|Field|Option) \| Type \| Default \| Description \|$/gm)?.length, count)
    for (const match of source.matchAll(/<Disclosure title="((?:Capture|Box)[^"]+)"/g)) {
      const section = markdown.split(`### ${match[1]}\n`)[1]?.split('\n##')[0]
      assert.ok(section?.includes('|------|'), `${match[1]} has a table`)
      assert.ok(section?.includes('| `'), `${match[1]} has fields`)
    }
  }
})

test('payload geometry stays visible while DOM-forwarding props stay inherited', () => {
  for (const type of ['CaptureWheelInput', 'CapturePointerInput', 'CapturePanInput']) {
    const table = renderPropsTable(type, 'Field')
    for (const field of ['localX', 'localY', 'boxWidth', 'boxHeight', 'inside', 'focusWithin']) {
      assert.ok(table.includes(`| \`${field}\` |`), `${type}.${field} is visible`)
    }
  }
  for (const type of ['Capture', 'Avatar', 'Dialog', 'Input']) {
    const table = renderPropsTable(type)
    assert.ok(table.includes('| `'), `${type} has its own props`)
    assert.doesNotMatch(table, /\| `(?:className|onClick|style)\?` \|/)
  }
  assert.equal(isBaseProp({ inheritedFrom: { name: 'CaptureInputGeometry.localX' } }), false)
  assert.equal(isBaseProp({ inheritedFrom: { name: 'Omit.className', qualifiedName: 'BaseProps.className' } }), true)
  assert.equal(isBaseProp({ inheritedFrom: { name: 'DOMEventHandlers.onClick' } }), true)
  assert.equal(isBaseProp({}, true), true)
})

test('multiline comments produce complete single-line Markdown table rows', () => {
  const table = renderPropsTable('Capture')
  assert.ok(table.split('\n').every(line => line.startsWith('|') && line.endsWith('|')))
  assert.match(table, /Capture-relative geometry, focus state/)
})
