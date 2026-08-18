import type { TreeNode } from './scenario'

const json = (value: unknown) => JSON.stringify(value)

function printProp([key, value]: [string, unknown]): string {
  if (typeof value === 'boolean') return value ? ` ${key}` : ` ${key}={false}`
  if (typeof value === 'string') return ` ${key}={${json(value)}}`
  return ` ${key}={${json(value)}}`
}

export function printTSX(root: TreeNode): string {
  const components = new Set<string>()
  const collect = (node: TreeNode) => {
    components.add(node.type)
    node.children?.forEach(collect)
    Object.values(node.propNodes ?? {}).flat().forEach(collect)
  }
  collect(root)

  const print = (node: TreeNode, level: number): string => {
    const indent = '  '.repeat(level)
    const attributes = [` data-testid=${json(node.id)}`, ...Object.entries(node.props).map(printProp)].join('')
    const children = node.children ?? []
    const propNodes = Object.entries(node.propNodes ?? {})
    const hasContent = node.text !== undefined || children.length > 0

    if (!propNodes.length && !hasContent) return `${indent}<${node.type}${attributes} />`

    const opening = propNodes.length
      ? [
          `${indent}<${node.type}${attributes}`,
          ...propNodes.flatMap(([name, nodes]) => [
            `${indent}  ${name}={<>`,
            ...nodes.map((child) => print(child, level + 2)),
            `${indent}  </>}`,
          ]),
          hasContent ? `${indent}>` : `${indent}/>`
        ]
      : [`${indent}<${node.type}${attributes}>`]

    if (!hasContent) return opening.join('\n')

    return [
      ...opening,
      ...(node.text === undefined ? [] : [`${indent}  {${json(node.text)}}`]),
      ...children.map((child) => print(child, level + 1)),
      `${indent}</${node.type}>`,
    ].join('\n')
  }

  return [
    `import { ${[...components].sort().join(', ')} } from '@antadesign/anta'`,
    '',
    'export default function App() {',
    '  return (',
    print(root, 2),
    '  )',
    '}',
  ].join('\n')
}
