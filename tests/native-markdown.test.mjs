import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { test } from 'node:test'
import { pathToFileURL } from 'node:url'
import { headingLinks, unwrapImages, unwrapJsxParagraphs, wrapTables } from '../site/lib/satteri-plugins.mjs'

const siteRequire = createRequire(new URL('../site/package.json', import.meta.url))
const { satteri, satteriHeadingIdsPlugin } = await import(pathToFileURL(siteRequire.resolve('@astrojs/markdown-satteri')))
const { parseFragment } = await import(pathToFileURL(siteRequire.resolve('parse5')))
const processor = satteri({
  mdastPlugins: [unwrapImages, unwrapJsxParagraphs],
  hastPlugins: [satteriHeadingIdsPlugin, headingLinks, wrapTables],
})
const markdown = await processor.createRenderer({ syntaxHighlight: false })
const mdx = await processor.createMdxRenderer(
  { syntaxHighlight: false },
  { optimize: false, srcDir: new URL('../site/src/', import.meta.url) },
)

// Record the compiled MDX component tree. Production browser tests cover Astro's
// HTML serialization and static optimization; these fixtures isolate transforms.
const runtimeUrl = `data:text/javascript,${encodeURIComponent(`
  export const Fragment = 'fragment';
  export function jsx(type, props) {
    return typeof type === 'function' ? type(props) : { type, ...props };
  }
  export const jsxs = jsx;
`)}`

async function renderMdx(source) {
  const { code } = await mdx.process(source, '/fixtures/content.mdx', {})
  const moduleSource = code.replace('"astro/jsx-runtime"', JSON.stringify(runtimeUrl)) + '\nexport { MDXContent };'
  const { MDXContent } = await import(`data:text/javascript,${encodeURIComponent(moduleSource)}`)
  return MDXContent({ components: { Preview: props => ({ type: 'preview', ...props }) } })
}

function elements(node, tagName) {
  return [
    ...(node.tagName === tagName ? [node] : []),
    ...(node.childNodes ?? []).flatMap(child => elements(child, tagName)),
  ]
}

const attribute = (node, name) => node.attrs.find(attr => attr.name === name)?.value

test('heading links preserve duplicate anchors and reset counts between documents', async () => {
  const source = '# Hello `world`\n\n## Hello world\n\n## Hello world'
  for (let document = 0; document < 2; document++) {
    const { code, metadata } = await markdown.render(source)
    const root = parseFragment(code)
    const anchors = elements(root, 'a')
    assert.deepEqual(metadata.headings.map(heading => heading.slug), ['hello-world', 'hello-world-1', 'hello-world-2'])
    assert.deepEqual(anchors.map(anchor => attribute(anchor, 'href')), ['#hello-world', '#hello-world-1', '#hello-world-2'])
    for (const anchor of anchors) assert.equal(attribute(anchor, 'class'), 'header-anchor muted')
    assert.equal(elements(anchors[0], 'code')[0].childNodes[0].value, 'world')
  }
})

test('Markdown tables retain one scrolling wrapper and CSS alignment on every cell', async () => {
  const { code } = await markdown.render('| Left | Center | Right |\n| :--- | :---: | ---: |\n| A | B | C |')
  const root = parseFragment(code)
  const wrappers = elements(root, 'div')
  assert.equal(wrappers.length, 1)
  assert.equal(attribute(wrappers[0], 'class'), 'table-wrap')
  assert.equal(elements(wrappers[0], 'table').length, 1)
  for (const tag of ['th', 'td']) {
    const cells = elements(root, tag)
    assert.deepEqual(cells.map(cell => attribute(cell, 'style')), ['text-align: left', 'text-align: center', 'text-align: right'])
    assert.ok(cells.every(cell => attribute(cell, 'align') === undefined))
  }
})

test('authored JSX tables retain their own wrapper without a Markdown wrapper', async () => {
  const tree = await renderMdx('<div class="table-wrap"><table><tbody><tr><td>Authored</td></tr></tbody></table></div>')
  assert.equal(tree.type, 'div')
  assert.equal(tree.class, 'table-wrap')
  assert.equal(tree.children.type, 'table')
  assert.equal(tree.children.children.type, 'tbody')
  assert.equal(tree.children.children.children.children.children, 'Authored')
})

test('explicit JSX string expressions preserve CSS tokens with smart punctuation enabled', async () => {
  const tree = await renderMdx('<table><tbody><tr><td>{\'--text-1\'}</td><td>{\'--border-color\'}</td></tr></tbody></table>')
  assert.equal(tree.type, 'table')
  assert.deepEqual(tree.children.children.children, [
    { type: 'td', children: '--text-1' },
    { type: 'td', children: '--border-color' },
  ])
})

test('contrast ratios remain visible prose in Markdown and MDX', async () => {
  const source = 'Normal text needs 4.5:1 contrast; large text needs 3:1.'
  const { code } = await markdown.render(source)
  const paragraphs = elements(parseFragment(code), 'p')
  assert.equal(paragraphs.length, 1)
  assert.deepEqual(paragraphs[0].childNodes.map(node => node.value), [source])
  assert.deepEqual(await renderMdx(source), { type: 'p', children: source })
})

test('standalone images leave paragraph layout while inline images keep surrounding prose', async () => {
  const { code } = await markdown.render('![Example](/image.png)\n\nText ![inline](/icon.png).')
  const root = parseFragment(code)
  const images = elements(root, 'img')
  assert.equal(images.length, 2)
  assert.equal(images[0].parentNode, root)
  assert.equal(attribute(images[0], 'alt'), 'Example')
  assert.equal(images[1].parentNode.tagName, 'p')
  assert.equal(images[1].parentNode.childNodes[0].value, 'Text ')
  assert.equal(images[1].parentNode.childNodes[2].value, '.')
})

test('JSX children drop a single synthetic paragraph but retain multiple prose paragraphs', async () => {
  assert.deepEqual(await renderMdx('<Preview>\n  <span>First</span>\n  <span>Second</span>\n</Preview>'), {
    type: 'preview',
    children: [{ type: 'span', children: 'First' }, { type: 'span', children: 'Second' }],
  })
  assert.deepEqual(await renderMdx('<Preview>\n\nFirst paragraph.\n\nSecond paragraph.\n\n</Preview>'), {
    type: 'preview',
    children: [{ type: 'p', children: 'First paragraph.' }, { type: 'p', children: 'Second paragraph.' }],
  })
})

test('preview CSS stays literal and nested inline elements preserve word spacing', async () => {
  const css = '\n.demo::part(content) { color: var(--text-2); }\n'
  const tree = await renderMdx(`<Preview>\n<div class="demo">Before <code>token</code> after.</div>\n<style is:inline>{\`${css}\`}</style>\n</Preview>`)
  assert.equal(tree.type, 'preview')
  assert.deepEqual(tree.children[0], {
    type: 'div', class: 'demo', children: ['Before ', { type: 'code', children: 'token' }, ' after.'],
  })
  assert.deepEqual(tree.children[1], { type: 'style', 'is:inline': true, 'set:html': css })
})
