# @antadesign/stickers

Part of the **Anta** design system, this sticker pack is the companion to [`@antadesign/anta`](https://www.npmjs.com/package/@antadesign/anta).

Square illustrated stickers, two flavors per name: a lightweight static SVG (`Sticker{Name}`) and a Lottie-driven animated version (`Sticker{Name}Animated`). Each one is its own named export, so your bundler ships only the stickers you actually use.

Kept as a separate package so that core anta carries **no `lottie-web`** — apps
that don't use stickers never install the animation runtime. Stickers uses the
compatible `@antadesign/anta` already installed by your app and pulls
`lottie-web` transitively.

📖 **Full documentation, the complete sticker gallery, and live demos: [Stickers documentation](https://anta.design/stickers/)**

## Installation

```sh
npm install @antadesign/anta @antadesign/stickers
```

`@antadesign/anta` and `react` are peer dependencies (or alias `react` →
`preact/compat`). Stickers accepts Anta `>=0.3.31`, so it uses the compatible
version already selected by your app. As with Anta, **pin exact installed
versions** rather than floating tags.

## Usage

```tsx
import '@antadesign/stickers/elements'   // register <a-sticker> / <a-sticker-animated> (client-side)
import { StickerCoding, StickerCodingAnimated } from '@antadesign/stickers'

<StickerCoding size={128} label="Writing code" />
<StickerCodingAnimated size={128} />
```

The element registration must run on the UI thread of a real browser (it needs `HTMLElement`). In SSR contexts (Astro, Next.js) import `@antadesign/stickers/elements` client-side only — same rule as `@antadesign/anta/elements`.

## Styling and strict CSP

The elements retain shadow DOM for SVG isolation and load their styles from
external CSS through their element entries. Both expose `container` (the square
artwork box) and `artwork` (the root SVG) parts. Apply whole-sticker transforms
to `::part(container)`; Lottie owns the animated SVG dimensions and transform.
Resizing the host alone keeps the artwork at its configured size, centered
inside the host.

Preserve the element CSS imports in your bundler and load their stylesheet
before displaying stickers. Without it, static artwork uses intrinsic SVG
dimensions.

With `style-src 'self'; style-src-attr 'none'`, omit `size` and set
`--sticker-size` on the host in a same-origin stylesheet:

```tsx
<StickerCoding className="coding-sticker" label="Writing code" />
```

```css
.coding-sticker { --sticker-size: 128px; }
```

The `size` prop remains supported and emits an inline `--sticker-size` style.
Browsers block that style in server-rendered HTML under this policy. Client
renderers may apply it through CSSOM, but hydration does not make blocked server
styles reliable. Use external CSS for consistent server and client sizing.
Setting the variable only on an ancestor does not override the host's default.

The bundled static SVGs contain no style attributes or stylesheets. Lottie
5.13.0's SVG renderer writes styles through CSSOM and updates SVG presentation
attributes. These writes work under the tested policy, including playback,
pause, and seek. Worker initialization applies parts and playback settings once
the player is ready. If you enable Lottie's web worker, allow its blob worker
through `worker-src blob:`; style directives can stay strict. Numeric `paused={0}`
seeks to the first frame. Generated SVGs still contain `style` attributes from
those CSSOM writes. Custom SVGs, Lottie assets, fonts, images, and expressions
need their own CSP review. This does not certify arbitrary animation data.

For granular registration, import `@antadesign/stickers/elements/a-sticker` and,
when needed, `@antadesign/stickers/elements/a-sticker-animated`. The static entry
excludes Lottie. You can also import their `.css` subpaths directly when your
application links styles separately.

## See also

- [`@antadesign/anta`](https://www.npmjs.com/package/@antadesign/anta) — the core design system.
- [Stickers documentation](https://anta.design/stickers/) — props, sizing, animation control, and bringing your own stickers.
