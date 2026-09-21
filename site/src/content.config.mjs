import { defineCollection } from 'astro:content'
import { glob } from 'astro/loaders'
import { COLLECTIONS, collectionEntryId, componentSchema, packageSchema } from '../lib/content/schema.mjs'

function loader(name) {
  const collection = COLLECTIONS.find(collection => collection.name === name)
  return glob({
    base: `./${collection.directory}`,
    pattern: '**/*.{md,mdx}',
    generateId: ({ entry }) => collectionEntryId(entry),
  })
}

export const collections = {
  components: defineCollection({ loader: loader('components'), schema: componentSchema }),
  plotDocs: defineCollection({ loader: loader('plotDocs'), schema: packageSchema }),
  tableDocs: defineCollection({ loader: loader('tableDocs'), schema: packageSchema }),
  stickersDocs: defineCollection({ loader: loader('stickersDocs'), schema: packageSchema }),
}
