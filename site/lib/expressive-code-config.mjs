import { createInlineSvgUrl } from '@expressive-code/core'
import ecFoldable from './ec-foldable.mjs'

/** Shared rendering options for authored documentation and AI answers. */
export default {
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
}
