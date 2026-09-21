import { z } from 'zod'

export const COMPONENT_GROUPS = ['content', 'controls', 'inputs', 'feedback', 'layout']
export const NAV_GROUPS = ['overview', 'setup', 'design', ...COMPONENT_GROUPS, 'packages']

const entryId = z.string().regex(/^[a-z0-9]+(?:[/-][a-z0-9]+)*$/)
const route = z.string().regex(/^\/(?:[a-z0-9]+(?:-[a-z0-9]+)*\/)*$/)
const navigation = z.object({
  label: z.string().min(1).optional(),
  icon: z.string().min(1),
  group: z.enum(COMPONENT_GROUPS).optional(),
  order: z.number().int().nonnegative(),
}).strict()

export const pageSchema = z.object({
  title: z.string().min(1),
  description: z.string().optional(),
  nav: z.union([z.literal(false), navigation]),
  parent: entryId.optional(),
  path: route.optional(),
  export: z.boolean().default(true),
  tocMaxLevel: z.number().int().min(2).max(6).optional(),
  hideToc: z.boolean().optional(),
}).strict()

export const componentSchema = pageSchema.refine(
  data => data.nav === false || data.nav.group !== undefined,
  { message: 'Component navigation requires a group', path: ['nav', 'group'] },
)
export const packageSchema = pageSchema.refine(
  data => data.nav === false || data.nav.group === undefined,
  { message: 'Package navigation derives its group from the collection', path: ['nav', 'group'] },
)

export const standaloneSchema = z.object({
  id: entryId,
  path: route,
  source: z.string().min(1),
  title: z.string().min(1),
  breadcrumbLabel: z.string().min(1).optional(),
  nav: z.union([z.literal(false), navigation.extend({ group: z.enum(NAV_GROUPS) })]),
  export: z.boolean().default(true),
  exportOrder: z.number().int().nonnegative().optional(),
  exportPath: z.string().regex(/^[a-z0-9]+(?:[-/][a-z0-9]+)*\.md$/).optional(),
  exportContent: z.enum(['overview', 'changelog', 'mdx']).optional(),
}).strict()

export const COLLECTIONS = [
  { name: 'components', directory: 'src/content/components', kind: 'component' },
  { name: 'plotDocs', directory: 'src/content/packages/plot', kind: 'package', package: 'plot' },
  { name: 'tableDocs', directory: 'src/content/packages/table', kind: 'package', package: 'table' },
  { name: 'stickersDocs', directory: 'src/content/packages/stickers', kind: 'package', package: 'stickers' },
]

export function collectionEntryId(path) {
  return path.replaceAll('\\', '/').replace(/\.(?:md|mdx)$/, '').replace(/\/index$/, '')
}

export function schemaForCollection(collection) {
  return collection.kind === 'component' ? componentSchema : packageSchema
}
