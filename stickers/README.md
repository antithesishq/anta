# @antadesign/stickers

Part of the **Anta** design system, this sticker pack is the companion to [`@antadesign/anta`](https://www.npmjs.com/package/@antadesign/anta).

Square illustrated stickers, two flavors per name: a lightweight static SVG (`Sticker{Name}`) and a Lottie-driven animated version (`Sticker{Name}Animated`). Each one is its own named export, so your bundler ships only the stickers you actually use.

Kept as a separate package so that core anta carries **no `lottie-web`** — apps that don't use stickers never install the animation runtime. Installing this package pulls `@antadesign/anta` (for the JSX runtime and shared helpers) and `lottie-web` transitively.

📖 **Full documentation, the complete sticker gallery, and live demos: [anta.design/components/sticker](https://anta.design/components/sticker/)**

## Installation

```sh
npm install @antadesign/stickers   # pulls @antadesign/anta + lottie-web
```

`react` is a peer dependency (or alias `react` → `preact/compat`). As with anta, **pin an exact version** rather than a floating tag.

## Usage

```tsx
import '@antadesign/stickers/elements'   // register <a-sticker> / <a-sticker-animated> (client-side)
import { StickerCoding, StickerCodingAnimated } from '@antadesign/stickers'

<StickerCoding size={128} label="Writing code" />
<StickerCodingAnimated size={128} />
```

The element registration must run on the UI thread of a real browser (it needs `HTMLElement`). In SSR contexts (Astro, Next.js) import `@antadesign/stickers/elements` client-side only — same rule as `@antadesign/anta/elements`.

## See also

- [`@antadesign/anta`](https://www.npmjs.com/package/@antadesign/anta) — the core design system.
- [anta.design/components/sticker](https://anta.design/components/sticker/) — props, sizing, animation control, and bringing your own stickers.
