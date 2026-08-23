import { defineConfig } from 'astro/config';
import preact from '@astrojs/preact';
import mdx from '@astrojs/mdx';
import sitemap from '@astrojs/sitemap';
import astroExpressiveCode, { createInlineSvgUrl } from 'astro-expressive-code';
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
import ecFoldable from './lib/ec-foldable.mjs';

export default defineConfig({
  site: 'https://anta.design',
  devToolbar: { enabled: false },
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
  // `marked` already ships as browser-ready ESM. Keeping it out of Vite's
  // optimized-dependency cache prevents a hydrated Playground from requesting
  // a stale hashed `marked.js` module after the docs watcher rebuilds.
  vite: {
    optimizeDeps: { exclude: ['marked'] },
  },
  integrations: [
    // compat:true aliases react / react-dom → preact/compat so Anta's JSX
    // wrappers (typed against React) run under Preact without calling configure().
    preact({ compat: true }),
    astroExpressiveCode({
      plugins: [ecFoldable()],
      themes: ['github-light', 'tokyo-night'],
      // Switch themes by the docs site's `.dark` class on <html>,
      // not by `prefers-color-scheme`. The theme toggle in the
      // sidebar lives in user-space — the OS preference is only the
      // fallback when the user has never toggled — so binding code-
      // block themes to the media query made them lag behind the
      // explicit choice. github-light (first in the array) stays as
      // the unscoped default; tokyo-night applies under `.dark`.
      useDarkModeMediaQuery: false,
      themeCssSelector: (theme) => theme.type === 'dark' ? '.dark' : '',
      styleOverrides: {
        borderWidth: '1px',
        borderColor: 'var(--border-5)',
        codeFontFamily: 'var(--monospace)',
        uiFontFamily: 'var(--sans-serif)',
        codeFontSize: '13px',
        codeFontWeight: '440',
        codeLineHeight: '20px',
        codeBackground: 'var(--bg-canvas)',
        // EC renders this as `padding: <value> 0` on `pre > code`, so the
        // 3-value form gives asymmetric block padding (10px top / 6px bottom,
        // 0 inline) — there's no separate block-start/-end setting.
        codePaddingBlock: '10px 0 6px',
        codePaddingInline: '1rem',
        frames: {
          frameBoxShadowCssValue: 'none',
          editorBackground: 'var(--bg-canvas)',
          editorTabBarBackground: 'var(--bg-pane)',
          editorActiveTabBackground: 'var(--bg-canvas)',
          terminalBackground: 'var(--bg-canvas)',
          terminalTitlebarBackground: 'var(--bg-pane)',
          terminalTitlebarBorderBottomColor: 'var(--border-5)',
          // NOTE: the copy glyph's stroke is controlled in base.css (the EC
          // `copyIcon` pipeline mangles/strips the SVG stroke-width). This SVG
          // still provides the shape; base.css overrides the mask for sizing.
          copyIcon: createInlineSvgUrl([
            `<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='black' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'>`,
            `<rect width='14' height='14' x='8' y='8' rx='2' ry='2'/>`,
            `<path d='M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2'/>`,
            `</svg>`,
          ]),
          // Style the copy button like an Anta neutral *tertiary* icon
          // button: borderless, transparent at rest, with the same icon
          // color and purple-tinted fill (and opacities) Anta uses for the
          // tertiary rest/hover/active states. Values are per-theme so the
          // dark scope (`.dark`) gets Anta's dark-mode tertiary palette.
          // (One unavoidable gap: EC only animates the background fill, so
          // the icon color can't darken on hover the way Anta's does.)
          inlineButtonForeground: ({ theme }) => (theme.type === 'dark' ? '#afa9b1' : '#635b65'),
          inlineButtonBorderOpacity: '0',
          inlineButtonBackground: ({ theme }) => (theme.type === 'dark' ? '#e4d1ef' : '#44374b'),
          inlineButtonBackgroundIdleOpacity: '0',
          inlineButtonBackgroundHoverOrFocusOpacity: ({ theme }) => (theme.type === 'dark' ? '0.1' : '0.05'),
          inlineButtonBackgroundActiveOpacity: ({ theme }) => (theme.type === 'dark' ? '0.15' : '0.1'),
        },
      },
    }),
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
