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
import { fileURLToPath } from 'node:url';

// React→preact/compat shim that adds the `useEffectEvent` hook (see
// lib/react-compat-shim.mjs). interface-kit imports useEffectEvent from
// "react", which preact/compat 10.29 doesn't export, so we route `react`
// through the shim — overriding the bare alias @astrojs/preact installs.
const reactCompatShim = fileURLToPath(new URL('./lib/react-compat-shim.mjs', import.meta.url));

export default defineConfig({
  site: 'https://anta.design',
  devToolbar: { enabled: false },
  // Stickers moved from the "Sticker" component page to the Packages section
  // (route /sticker/ → /stickers/). Keep the old URL resolving for external links.
  redirects: { '/sticker': '/stickers' },
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
    // compat:false — we install the react→preact/compat aliases ourselves in
    // `vite.resolve.alias` below (so the interface-kit useEffectEvent shim
    // wins). Leaving the preset's compat on would re-add a competing `react`
    // alias that bypasses the shim.
    preact({ compat: false }),
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
  vite: {
    // With the preset's compat off, replicate the dedupe/SSR-bundling it would
    // otherwise set up so the react-aliased modules resolve to a single preact
    // instance on both client and server.
    ssr: {
      noExternal: ['react', 'react-dom', 'react-dom/test-utils', 'react/jsx-runtime'],
    },
    resolve: {
      dedupe: ['preact', 'preact/compat'],
      // We own the full react→preact alias set here (and set `compat: false`
      // on @astrojs/preact) instead of letting the preset install it. The
      // preset's `react` → `preact/compat` alias would otherwise win over ours
      // and interface-kit's `useEffectEvent` import would resolve to raw compat
      // (which lacks it). Routing `react` through the shim closes that gap;
      // the rest mirror what the preset normally provides.
      alias: [
        { find: /^react$/, replacement: reactCompatShim },
        { find: /^react\/jsx-runtime$/, replacement: 'preact/jsx-runtime' },
        { find: /^react\/jsx-dev-runtime$/, replacement: 'preact/jsx-dev-runtime' },
        { find: /^react-dom\/client$/, replacement: 'preact/compat/client' },
        { find: /^react-dom\/test-utils$/, replacement: 'preact/test-utils' },
        { find: /^react-dom$/, replacement: 'preact/compat' },
      ],
    },
    // Vite pre-bundles deps with esbuild, where the `react` Vite alias above is
    // NOT applied — so a pre-bundled `react` chunk would be raw preact/compat
    // (no useEffectEvent) and interface-kit's import would fail at runtime.
    // Excluding these routes every `react`/`react-dom`/interface-kit import
    // through Vite's normal resolve pipeline, where the alias (and thus the
    // shim) takes effect.
    optimizeDeps: {
      exclude: ['interface-kit', 'react', 'react-dom', 'react-dom/client'],
    },
  },
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
