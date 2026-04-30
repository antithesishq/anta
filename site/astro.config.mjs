import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import mdx from '@astrojs/mdx';
import astroExpressiveCode from 'astro-expressive-code';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkDirective from 'remark-directive';
import remarkDefinitionList from 'remark-definition-list';
import remarkAttributes from 'remark-attributes';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeMathjax from 'rehype-mathjax';

export default defineConfig({
  site: 'https://antithesishq.github.io',
  base: '/anta',
  integrations: [
    preact({ compat: true }),
    astroExpressiveCode({
      themes: ['tokyo-night'],
    }),
    mdx(),
  ],
  trailingSlash: 'always',
  markdown: {
    remarkPlugins: [
      remarkGfm,
      [remarkMath, { singleDollarTextMath: false }],
      remarkDirective,
      remarkDefinitionList,
      remarkAttributes,
    ],
    rehypePlugins: [
      rehypeSlug,
      [
        rehypeAutolinkHeadings,
        {
          behavior: 'wrap',
          properties: {
            className: ['header-anchor', 'muted'],
          },
        },
      ],
      rehypeMathjax,
    ],
  },
});
