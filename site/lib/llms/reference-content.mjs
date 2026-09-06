import * as comparison from '../../src/components/comparison-data.ts'
import { KINDS, TITLES, INTROS, TEXT_LINES, BACKGROUND_GUIDANCE, LINK_GUIDANCE, BORDER_GUIDANCE } from '../../src/components/color-reference.ts'
import { SYSTEM_COLORS } from '../../src/components/system-colors.ts'
import { SPECS, TONES, SEED, defaults, groupsOf } from '../../src/components/theming-lab-formulas.ts'
import { ICON_SHAPES, ICON_SYNONYMS } from '../../../src/elements/a-icon.shapes.ts'

const code = (value) => `\`${value}\``
const link = (label, href) => href ? `[${label}](${href})` : label
const cell = (value) => String(value ?? '').replaceAll('|', '\\|').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replace(/\s*\n\s*/g, ' ')
const table = (headers, rows) => [headers, headers.map(() => '---'), ...rows]
  .map(row => `| ${row.map(cell).join(' | ')} |`).join('\n')
const bullets = (items) => items.map(item => `- ${item}`).join('\n')
const systemLink = (system) => system.nameParts
  ? system.nameParts.map(part => link(part.label, part.href)).join(' + ')
  : link(system.name, system.docs)
const MARKS = { yes: 'Included', partial: 'Basic or community-only', paid: 'Paid tier', no: 'Not shipped' }
const { COVERAGE_SYSTEMS, CATEGORIES, COVERAGE, COVERAGE_URLS, ANTA_SLUG } = comparison

function comparisonMatrix() {
  return table(['System', 'Version', 'Frameworks', 'Styling', 'License', 'Browser baseline', 'Browser policy'], COVERAGE_SYSTEMS.map(s => [
    systemLink(s), s.version, [s.frameworks, s.frameworksNote].filter(Boolean).join('; '), s.styling, s.license,
    s.browserSupport ?? s.browserBaselineYear ?? (s.browserApproximateYear ? `~${s.browserApproximateYear}` : 'No fixed floor'), s.browsers,
  ]))
}

function systemCards() {
  return COVERAGE_SYSTEMS.map(s => `### ${s.name}

${systemLink(s)}. ${s.tagline}

${table(['Field', 'Value'], [
    ['Version', s.version], ['Delivery', s.kind], ['Gzipped size', s.bundleSize],
    ...(s.bundleVersion ? [['Measured version', s.bundleVersion]] : []),
    ['Measurement scope', s.bundleIncludes], ['Browser support', s.browsers],
  ])}

#### Strengths

${bullets(s.pros)}

#### Trade-offs

${bullets(s.cons)}${s.sources?.length ? `\n\n#### Sources\n\n${bullets(s.sources.map(source => link(source.label, source.href)))}` : ''}`).join('\n\n')
}

function coverageMatrix() {
  return table(['Component category', ...COVERAGE_SYSTEMS.map(systemLink)], CATEGORIES.map(category => [
    `${category.label}: ${category.members}`,
    ...COVERAGE_SYSTEMS.map(system => {
      const mark = COVERAGE[system.id]?.[category.id] ?? 'no'
      const example = category.examples?.[system.id]
      const label = `${MARKS[mark]}${example ? ` (${example})` : ''}`
      const href = system.anta ? ANTA_SLUG[category.id] && `/${ANTA_SLUG[category.id]}/` : COVERAGE_URLS[system.id]?.[category.id]
      return link(label, mark === 'no' ? undefined : href)
    }),
  ]))
}

function declarations(css, selector) {
  const blocks = css.replace(/\/\*[\s\S]*?\*\//g, '').matchAll(/([^{};]+)\{([^{}]*)\}/g)
  const block = [...blocks].find(([, selectors]) => selectors.split(',').some(value => value.trim() === selector))
  if (!block) throw new Error(`Missing color reference selector: ${selector}`)
  return new Map([...block[2].matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(([, name, value]) => [name, value.trim()]))
}

function swatches({ tokens, theme }) {
  const modes = [declarations(tokens, ':root'), declarations(tokens, '.dark'), declarations(theme, ':root:root'), declarations(theme, '.dark.dark')]
  const tokenTable = (names) => table(['Token', 'Default light', 'Default dark', 'Reference light', 'Reference dark'], names.map(name => [
    code(name), ...modes.map(mode => mode.has(name) ? code(mode.get(name)) : 'Uses default'),
  ]))
  const guidance = {
    bg: BACKGROUND_GUIDANCE,
    text: table(['Token', 'Use'], TEXT_LINES.map(line => [code(`--${line.token}`), line.copy])) + '\n\n' + LINK_GUIDANCE,
    border: BORDER_GUIDANCE,
  }
  return `Values are CSS declarations from the shipped default palette and optional \`theme-anta.css\` reference palette. Resolve them in the application's theme to obtain displayed colors. Toned backgrounds share the neutral \`--bg-1\`; there is no \`--bg-1-{tone}\`.

${KINDS.map(kind => `## ${TITLES[kind]}\n\n${INTROS[kind]}\n\n${guidance[kind]}\n\n${tokenTable([...modes[0].keys()].filter(name => name.startsWith(`--${kind}-`)))}`).join('\n\n')}

### Link and focus values

${tokenTable(['--link-color', '--link-color-hover', '--focus-ring'])}`
}

function iconCatalog() {
  return table(['Shape', 'Search synonyms'], ICON_SHAPES.map(shape => [code(shape), (ICON_SYNONYMS[shape] ?? []).join(', ')]))
}

function stickerCatalog({ stickers }) {
  const exports = [...stickers.matchAll(/^export \{ (Sticker\w+) \} from '\.\/([^']+)'/gm)]
  if (!exports.length) throw new Error('Missing generated sticker exports')
  const names = new Map(exports.map(([, name, path]) => [name, path]))
  return '## Available stickers\n\n' + table(['Name', 'Static export', 'Animated export', 'Asset imports'], exports
    .filter(([, name]) => !name.endsWith('Animated'))
    .map(([, name, path]) => [
      name.slice('Sticker'.length), code(name), names.has(`${name}Animated`) ? code(`${name}Animated`) : 'Unavailable',
      [path, names.get(`${name}Animated`)].filter(Boolean).map(path => code(`@antadesign/stickers/${path}`)).join(', '),
    ]))
}

function themingLab() {
  return `## Theming lab reference

The lab varies a tone seed and formula inputs in light and dark mode. These inputs describe the lab's calculations. For application styling, use tone props, global role tokens, CSS, and the parts documented on each component page.

${table(['Tone', 'Seed property', 'Initial lab seed'], TONES.map(tone => [tone, code(`--anta-seed-${tone}`), code(SEED[tone])]))}

${SPECS.map(spec => {
    const values = [defaults(spec, false), defaults(spec, true), defaults(spec, false, 'neutral'), defaults(spec, true, 'neutral')]
    return `### ${spec.title.replaceAll(' & ', ' and ')}

${spec.blurb}

${groupsOf(spec).map(group => `#### ${group.label}\n\n${group.note ? `${group.note}\n\n` : ''}${table(
      ['Input', 'Toned light', 'Toned dark', 'Neutral light', 'Neutral dark', 'Range', 'Step', 'Meaning'],
      group.vars.map(variable => [variable.label, ...values.map(value => value[variable.key]), `${variable.min}–${variable.max}`, variable.step, variable.tip ?? '']),
    )}`).join('\n\n')}`
  }).join('\n\n')}`
}

function htmlSpecimen({ specimen }) {
  const source = specimen.replace(/^---\n[\s\S]*?\n---\n/, '').replace(/<style>[\s\S]*?<\/style>/g, '').trim()
  return `This specimen shows the native tags styled by \`reset.css\`:\n\n\`\`\`html\n${source}\n\`\`\``
}

const renderers = {
  ComparisonMatrix: comparisonMatrix,
  SystemCards: systemCards,
  CoverageMatrix: coverageMatrix,
  Swatches: swatches,
  SystemColorTable: () => table(['System colors', 'Use'], SYSTEM_COLORS.map(row => [row.colors.map(code).join(', '), row.use])),
  IconDemo: iconCatalog,
  StickerDemo: stickerCatalog,
  ThemingLab: themingLab,
  HtmlSpecimen: htmlSpecimen,
  AccessibilityMatrix: () => `The interactive matrix compares all five text levels with all five background levels for each tone in light and dark mode. It resolves the active CSS palette in the browser, composites transparent text over its background, and reports WCAG 2 contrast and APCA Lc.

Choose the application's palette, tone, font size, and font weight before evaluating a pair. Recheck after changing a theme or seed. The [Colors reference](/colors/) lists the source declarations for both shipped palettes.

Vision simulations change the displayed sample; contrast results continue to use normal-vision colors. Use simulations alongside text labels and other non-color signals.

Computed contrast cells depend on the selected palette and settings. Evaluate the actual application colors with the [interactive accessibility matrix](https://anta.design/accessibility/).`,
}

export const referenceExpressions = Object.fromEntries(Object.entries(comparison)
  .filter(([, value]) => typeof value === 'string' || typeof value === 'number'))
export function renderReference(name, sources) {
  return Object.hasOwn(renderers, name) ? renderers[name](sources) : undefined
}
