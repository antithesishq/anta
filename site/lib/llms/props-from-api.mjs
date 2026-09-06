import api from '../../src/api.json' with { type: 'json' }
import { isBaseProp } from '../api-props.mjs'

const byId = new Map()
;(function index(node) {
  if (typeof node?.id === 'number') byId.set(node.id, node)
  ;(node?.children ?? []).forEach(index)
})(api)

function renderType(type) {
  if (!type) return '—'
  switch (type.type) {
    case 'intrinsic':
      return type.name
    case 'literal':
      return typeof type.value === 'string' ? `'${type.value}'` : String(type.value)
    case 'union':
      return type.types
        .map(renderType)
        .filter((value) => value !== '—')
        .join(' | ')
    case 'intersection': {
      const members = type.types
      const isOpenString =
        members.length === 2 &&
        members.some((member) => member.type === 'intrinsic' && member.name === 'string') &&
        members.some((member) => member.type === 'reflection')
      if (isOpenString) return '(string & {})'
      const parts = members.map(renderType).filter((value) => value !== '—')
      return parts.join(' & ') || '—'
    }
    case 'reference':
      return type.name || '—'
    case 'array':
      return `${renderType(type.elementType)}[]`
    case 'reflection': {
      const signature = type.declaration?.signatures?.[0]
      if (signature) {
        const parameters = (signature.parameters ?? []).map((parameter) => parameter.name).join(', ')
        return `(${parameters}) => ${renderType(signature.type)}`
      }
      return '—'
    }
    case 'typeOperator':
      if (type.operator === 'keyof' && type.target?.name === 'IconShapes') return 'IconShape'
      return `${type.operator} ${renderType(type.target)}`
    case 'unknown':
      if (typeof type.name === 'string' && /IconShapes?\b/.test(type.name)) return 'IconShape'
      return type.name || '—'
    default:
      return type.name || '—'
  }
}

function readDefault(comment) {
  const tags = comment?.blockTags
  if (!Array.isArray(tags)) return ''
  for (const tag of tags) {
    if (tag.tag !== '@defaultValue' && tag.tag !== '@default') continue
    const raw = (tag.content ?? []).map((part) => part.text ?? '').join('').trim()
    if (!raw) continue
    return raw
      .replace(/^```[a-zA-Z]*\s*\n?/, '')
      .replace(/\n?```$/, '')
      .replace(/^`|`$/g, '')
      .trim()
  }
  return ''
}

function renderDescription(comment) {
  return comment?.summary?.map((part) => part.text).join('') ?? ''
}

const EXCLUDED = new Set(['key', 'ref'])

function isNever(type) {
  return type?.type === 'intrinsic' && type.name === 'never'
}

function hasDoc(comment) {
  return Boolean(comment?.summary?.length || comment?.blockTags?.length)
}

function mergeTypes(first, second) {
  const parts = [...first.split(' | '), ...second.split(' | ')]
    .map((value) => value.trim())
    .filter(Boolean)
  return [...new Set(parts)].join(' | ')
}

function collect(declaration) {
  const props = new Map()
  const seen = new Set()

  function addProp(candidate, fromBase, fromUnion) {
    if (!candidate?.name || EXCLUDED.has(candidate.name)) return
    if (candidate.kind !== 1024 || isNever(candidate.type)) return

    const base = isBaseProp(candidate, fromBase)
    const optional = Boolean(candidate.flags?.isOptional) || fromUnion
    const type = renderType(candidate.type)
    const existing = props.get(candidate.name)
    if (!existing) {
      props.set(candidate.name, { name: candidate.name, type, optional, comment: candidate.comment, fromBase: base })
      return
    }

    existing.type = mergeTypes(existing.type, type)
    existing.optional ||= optional
    if (!hasDoc(existing.comment) && hasDoc(candidate.comment)) existing.comment = candidate.comment
    existing.fromBase &&= base
  }

  function visitDeclaration(node, fromBase, fromUnion) {
    if (!node || seen.has(node)) return
    seen.add(node)
    node.children?.forEach((child) => addProp(child, fromBase, fromUnion))
    if (node.type) visitType(node.type, fromBase, fromUnion)
  }

  function visitType(type, fromBase, fromUnion) {
    if (!type) return
    if (type.type === 'intersection') {
      type.types.forEach((member) => visitType(member, fromBase, fromUnion))
      return
    }
    if (type.type === 'union') {
      type.types.forEach((member) => visitType(member, fromBase, true))
      return
    }
    if (type.type === 'reference') {
      const target = typeof type.target === 'number' ? byId.get(type.target) : null
      visitDeclaration(target, fromBase || type.name === 'BaseProps', fromUnion)
      return
    }
    if (type.type === 'reflection') {
      type.declaration?.children?.forEach((child) => addProp(child, fromBase, fromUnion))
    }
  }

  visitDeclaration(declaration, false, false)
  return [...props.values()]
}

function escapeMarkdown(value) {
  return value.replace(/\|/g, '\\|').replace(/\s*\n\s*/g, ' ')
}

export function renderPropsTable(componentName, label = 'Prop') {
  const root = api.children?.find((child) => child.name === `${componentName}Props`)
    ?? api.children?.find((child) => child.name === componentName)
  if (!root) return ''

  const props = collect(root)
    .filter((prop) => !prop.fromBase)
    .sort((first, second) => {
      const optional = Number(first.optional) - Number(second.optional)
      return optional || first.name.localeCompare(second.name)
    })
  if (!props.length) return ''

  const rows = props.map((prop) => {
    const name = prop.optional ? `${prop.name}?` : prop.name
    const type = escapeMarkdown(prop.type === '—' ? '—' : prop.type)
    const defaultValue = escapeMarkdown(readDefault(prop.comment) || '—')
    const description = escapeMarkdown(renderDescription(prop.comment))
    return `| \`${name}\` | ${type} | ${defaultValue} | ${description} |`
  })

  return [`| ${escapeMarkdown(label)} | Type | Default | Description |`, '|------|------|---------|-------------|', ...rows].join('\n')
}
