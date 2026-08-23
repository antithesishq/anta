/**
 * parse-examples.ts — extract JSDoc-headed JSX blocks from playground
 * source code.
 *
 * The authoring model: a single TSX source can mark any JSX component or
 * declared JSON-like object with a `/** @play props Title *​/` comment.
 * Legacy `# Title` JSDoc headings still mark JSX examples. Each pairing is an
 * accordion entry in the Props panel.
 *
 * This module does no rendering — it just maps source offsets to
 * labels / descriptions / JSX ranges. The bundler and the per-example
 * Props form consume those offsets.
 */
import { findOpenTagClose, skipBraced } from './locate-tag.ts'

export interface Example {
  /** Stable identifier — slug of the label. */
  id: string
  /** First `# heading` line in the JSDoc, sans the `#`. */
  label: string
  /** Remaining JSDoc body (lines after the `# heading`, joined). */
  description: string
  /** Character offsets into the source for the leading JSDoc block. */
  jsdocStart: number
  jsdocEnd: number
  /** Character offsets into the source for the JSX expression that
   *  follows the JSDoc. */
  jsxStart: number
  jsxEnd: number
  /** What kind of target follows the JSDoc.
   *  - `'jsx'`: a `<Tag …>` element — the Props form can bind to
   *    it and surface that element's literal props.
   *  - `'expression'`: a `{ … }` container (typically an IIFE
   *    returning JSX) — too dynamic to bind a form to. The
   *    accordion entry shows the heading + description only. */
  kind: 'jsx' | 'expression' | 'object'
  /** For `kind: 'jsx'`, the tag name (e.g. `'Progress'` or
   *  `'AnimatedProgress'`). Drives the form's source of prop
   *  schema: known components use api.json; unknown ones infer
   *  fields from the JSX's currently-set attributes. */
  tagName?: string
  /** For `kind: 'object'`, the declared object literal's range. */
  objectStart?: number
  objectEnd?: number
}

/**
 * Walk the source and return every annotated target in order of appearance.
 * `@play props` marks JSX or a declared object literal. A `# heading` keeps the
 * older JSX-only annotation working for existing demos.
 */
export function parseExamples(source: string): Example[] {
  const out: Example[] = []
  let i = 0
  const usedIds = new Set<string>()
  while (i < source.length) {
    const blockStart = source.indexOf('/**', i)
    if (blockStart === -1) break
    const blockEndDelim = source.indexOf('*/', blockStart + 3)
    if (blockEndDelim === -1) break
    const blockEnd = blockEndDelim + 2

    const body = source.slice(blockStart + 3, blockEndDelim)
    const marker = extractMarker(body)
    if (!marker) {
      i = blockEnd
      continue
    }

    // An example body is whatever JSX-ish expression follows the
    // JSDoc — either a plain `<Tag …>` element (Props panel binds
    // directly to it) or a `{ expression }` container (typically an
    // IIFE that returns a JSX node; the form scans the inside for
    // the bound component and surfaces whatever literal props it
    // finds). Anything else is ignored. The JSDoc is the trigger
    // for accordion-entry creation.
    const afterDoc = skipWhitespaceAndComments(source, blockEnd)
    if (afterDoc == null) {
      i = blockEnd
      continue
    }
    const first = source[afterDoc]
    let jsxEnd: number
    let kind: 'jsx' | 'expression' | 'object'
    let tagName: string | undefined
    let objectName: string | undefined
    let objectStart: number | undefined
    let objectEnd: number | undefined

    if (first === '<') {
      kind = 'jsx'
      let nameEnd = afterDoc + 1
      while (nameEnd < source.length && /[A-Za-z0-9_$.]/.test(source[nameEnd])) {
        nameEnd++
      }
      tagName = source.slice(afterDoc + 1, nameEnd)
      const opening = findOpenTagClose(source, nameEnd)
      if (!opening) {
        i = blockEnd
        continue
      }
      if (opening.selfClosing) {
        jsxEnd = opening.end
      } else {
        const closer = `</${tagName}>`
        const idx = source.indexOf(closer, opening.end)
        if (idx === -1) {
          i = blockEnd
          continue
        }
        jsxEnd = idx + closer.length
      }
    } else if (first === '{') {
      kind = 'expression'
      const end = skipBraced(source, afterDoc)
      if (end == null) {
        i = blockEnd
        continue
      }
      jsxEnd = end
    } else if (marker.annotation === 'playground') {
      const object = parseObjectDeclaration(source, afterDoc)
      if (!object) {
        i = blockEnd
        continue
      }
      kind = 'object'
      objectName = object.name
      objectStart = object.start
      objectEnd = object.end
      jsxEnd = object.end
    } else {
      i = blockEnd
      continue
    }

    const label = marker.label || tagName || objectName || 'Example'
    const id = uniqueId(label, usedIds)
    out.push({
      id,
      label,
      description: marker.description,
      jsdocStart: blockStart,
      jsdocEnd: blockEnd,
      jsxStart: afterDoc,
      jsxEnd,
      kind,
      tagName,
      objectStart,
      objectEnd,
    })
    usedIds.add(id)
    i = jsxEnd
  }
  return out
}

type Marker = {
  annotation: 'legacy' | 'playground'
  label: string
  description: string
}

/** Read the explicit `@play props` annotation before falling back to the
 * established heading-style marker used by existing component examples. */
function extractMarker(body: string): Marker | null {
  const lines = body.split('\n').map((l) => l.replace(/^\s*\*?\s?/, ''))
  const annotationIndex = lines.findIndex((line) => /^@play\s+props(?:\s+|$)/.test(line))
  if (annotationIndex !== -1) {
    const label = lines[annotationIndex].replace(/^@play\s+props\s*/, '').trim()
    const rest = lines.slice(annotationIndex + 1)
    while (rest.length && rest[0].trim() === '') rest.shift()
    while (rest.length && rest[rest.length - 1].trim() === '') rest.pop()
    return { annotation: 'playground', label, description: rest.join('\n').trim() }
  }
  // The first implementation used `@playground`. Keep it working for demos
  // written before the shorter, scoped annotation was introduced.
  const legacyPlaygroundIndex = lines.findIndex((line) => /^@playground(?:\s+|$)/.test(line))
  if (legacyPlaygroundIndex !== -1) {
    const label = lines[legacyPlaygroundIndex].replace(/^@playground\s*/, '').trim()
    const rest = lines.slice(legacyPlaygroundIndex + 1)
    while (rest.length && rest[0].trim() === '') rest.shift()
    while (rest.length && rest[rest.length - 1].trim() === '') rest.pop()
    return { annotation: 'playground', label, description: rest.join('\n').trim() }
  }
  const heading = extractHeading(body)
  return heading ? { annotation: 'legacy', ...heading } : null
}

/** Find a `# Heading` line in the JSDoc body and split it into label
 *  + description. Returns null if there's no heading at all. The
 *  heading may sit on the opening `/​**` line (so Monaco's fold range
 *  keeps the heading visible when the comment is collapsed) or on a
 *  subsequent ` * ` line — both shapes are recognised. */
function extractHeading(body: string): { label: string; description: string } | null {
  // Strip the standard ` * ` JSDoc prefix; on the first line (no
  // leading `*`) just strip leading whitespace so headings authored
  // inline with `/​**` are still recognised.
  const lines = body.split('\n').map((l) => l.replace(/^\s*\*?\s?/, ''))
  let headingIdx = -1
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(/^#\s+(.+?)\s*$/)
    if (m) {
      headingIdx = i
      break
    }
  }
  if (headingIdx === -1) return null
  const label = lines[headingIdx].replace(/^#\s+/, '').trim()
  // Description: every line after the heading, trimmed of leading /
  // trailing blank lines and joined as a single string.
  const rest = lines.slice(headingIdx + 1)
  while (rest.length && rest[0].trim() === '') rest.shift()
  while (rest.length && rest[rest.length - 1].trim() === '') rest.pop()
  return { label, description: rest.join('\n').trim() }
}

/** Advance past whitespace and `//` / `/* … *​/` comments. Returns the
 *  first index of a non-whitespace, non-comment character, or null
 *  if the source ends. */
function skipWhitespaceAndComments(source: string, from: number): number | null {
  let i = from
  while (i < source.length) {
    const c = source[i]
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++
      continue
    }
    if (c === '/' && source[i + 1] === '/') {
      const nl = source.indexOf('\n', i + 2)
      if (nl === -1) return null
      i = nl + 1
      continue
    }
    if (c === '/' && source[i + 1] === '*') {
      const end = source.indexOf('*/', i + 2)
      if (end === -1) return null
      i = end + 2
      continue
    }
    return i
  }
  return null
}

/** Parse `const name = { … }` (also `let` / `var`) following an explicit
 * annotation. Type annotations between the name and `=` are fine; the object
 * initializer itself must be a literal so the Props form has stable fields. */
function parseObjectDeclaration(
  source: string,
  start: number,
): { name: string; start: number; end: number } | null {
  const declaration = /^(?:const|let|var)\s+([A-Za-z_$][\w$]*)/.exec(source.slice(start))
  if (!declaration) return null
  const name = declaration[1]
  const equals = source.indexOf('=', start + declaration[0].length)
  if (equals === -1) return null
  let objectStart = equals + 1
  while (objectStart < source.length && /\s/.test(source[objectStart])) objectStart++
  if (source[objectStart] !== '{') return null
  const objectEnd = skipBraced(source, objectStart)
  return objectEnd == null ? null : { name, start: objectStart, end: objectEnd }
}

/** Slug-ify a label, suffixing `-2`, `-3`, … when the same slug
 *  already exists in `used`. */
function uniqueId(label: string, used: Set<string>): string {
  const base = label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'example'
  if (!used.has(base)) return base
  let n = 2
  while (used.has(`${base}-${n}`)) n++
  return `${base}-${n}`
}
