import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import astroExpressiveCode from 'astro-expressive-code';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';
import remarkDirective from 'remark-directive';
import remarkDefinitionList from 'remark-definition-list';
import remarkAttributes from 'remark-attributes';
import rehypeSlug from 'rehype-slug';
import rehypeAutolinkHeadings from 'rehype-autolink-headings';
import rehypeMathjax from 'rehype-mathjax';
import rehypeTableWrap from './lib/rehype-table-wrap.mjs';
import remarkUnwrapJsxParagraph from './lib/remark-unwrap-jsx-paragraph.mjs';
import remarkUnwrapImages from './lib/remark-unwrap-images.mjs';
import expressiveCodeConfig from './lib/expressive-code-config.mjs';

export default defineConfig({
  site: 'https://anta.design',
  devToolbar: { enabled: false },
  vite: {
    server: {
      proxy: {
        '/api/search-answer': {
          target: `http://127.0.0.1:${process.env.ANTA_SEARCH_DEV_PORT || '8788'}`,
          configure(proxy) {
            proxy.on('proxyReq', (proxyRequest, request) => {
              // Wrangler changes the request host to its own port. Validate the
              // browser origin here before omitting it from the local hop.
              if (request.headers.origin === `http://${request.headers.host}`) {
                proxyRequest.removeHeader('Origin')
              }
            })
          },
        },
      },
    },
  },
  // ClientRouter enables this implicitly. Keep the policy explicit: hovering
  // or focusing an internal link downloads its document before activation.
  // The short browser cache policy in public/_headers lets that response be
  // reused for the click, including in browsers that prefetch with fetch().
  prefetch: { prefetchAll: true, defaultStrategy: 'hover' },
  // Stickers moved from the "Sticker" component page to the Packages section
  // (route /sticker/ → /stickers/). Keep the old URL resolving for external links.
  // The per-tone colors pages collapsed into the single /colors/ page (tone is
  // client state, mirrored as ?tone=); keep the old sub-page URLs resolving.
  redirects: {
    '/sticker': '/stickers',
    '/colors/brand': '/colors/?tone=brand',
    '/colors/info': '/colors/?tone=info',
    '/colors/success': '/colors/?tone=success',
    '/colors/critical': '/colors/?tone=critical',
    '/colors/warning': '/colors/?tone=warning',
  },
  // Never inline component styles into the page `<head>`. Astro's default
  // (`'auto'`) inlines small scoped style sets — but for a component used
  // inside MDX that wraps a hydrated island (e.g. <Disclosure> around the
  // <Playground>), that inline <style> can land present-but-inert in the
  // production build (the rule is in `<head>` but the browser never parses it
  // into CSSOM), so the styles silently don't apply on the deployed site while
  // dev looks fine. Forcing every component's CSS into the linked, always-
  // parsed bundle makes dev and prod render identically.
  build: { inlineStylesheets: 'never' },
  integrations: [
    // compat:true aliases react / react-dom → preact/compat so Anta's JSX
    // wrappers (typed against React) run under Preact without calling configure().
    preact({ compat: true }),
    astroExpressiveCode(expressiveCodeConfig),
    mdx(),
    sitemap(),
  ],
  trailingSlash: 'always',
  markdown: {
    remarkPlugins: [
      remarkGfm,
      [remarkMath, { singleDollarTextMath: false }],
      remarkDirective,
      remarkDefinitionList,
      remarkAttributes,
      remarkUnwrapImages,
      remarkUnwrapJsxParagraph,
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
      rehypeTableWrap,
    ],
  },
});
