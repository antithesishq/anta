# Icon

Inline-block icon rendered via CSS `mask-image`. Color follows
`currentColor`, default size is 16×16, and the only required prop is
`shape`. The set of valid shapes is the union of Anta's built-ins plus
any custom icons you generate yourself.

`shape="loader"` is the exception: it is Anta's animated loading alias for
string-only icon props. Use `Loader` when you need a progress value, speed, or
accessible loading status.

> In practice you'll rarely reach for `<Icon>` directly. Most Anta
> components that need an icon expose an `icon` prop that's typed
> against `IconShape` — autocomplete and type-checking work the same
> way without the wrapping element. Use `<Icon>` when you need a
> standalone icon outside of any other component.

## Built-in shapes

| Shape | Search synonyms |
| --- | --- |
| `arrow-left-to-line` | dock, snap, align |
| `arrow-left` | back, previous, prev |
| `arrow-narrow-down` | download, fall, down |
| `arrow-narrow-up-down` | sort, swap, transfer, reorder |
| `arrow-narrow-up` | upload, rise, up |
| `arrow-right` | forward, next |
| `arrow-top-right` | external, open, leave |
| `asterisk` | star, wildcard |
| `blank` | spacer, empty, placeholder, space, none |
| `book-open` | read, docs, documentation |
| `braces` | code, brackets, json |
| `bug` | defect, issue, error |
| `calendar-days` |  |
| `calendar` | date, schedule |
| `case-sensitive` | aA, capitalize, case |
| `chat` | message, comment, discuss |
| `check` | tick, ok, done, confirm, approve |
| `chevron-down` | arrow, expand, open, down |
| `chevron-left` | arrow, back, previous |
| `chevron-right` | arrow, forward, next |
| `chevron-up` | arrow, collapse, close, up |
| `chevrons-right` | skip, fast forward |
| `circle-check` | success, ok, done |
| `circle-dot` |  |
| `circle-large` | dot, marker |
| `circle-small-solid` |  |
| `circle-user` | avatar, person, account, contact, profile |
| `circle` | dot, point |
| `click` | tap, press, touch |
| `clock` | time |
| `cloud-upload` | save, sync, upload, send, export |
| `columns-3-cog` | columns, table, settings, configure, fields, visibility |
| `copy` | duplicate, clone |
| `corner-down-right` | branch, indent, return |
| `cube` | box, package |
| `dollar-sign` | currency, money, payment |
| `dots-vertical` | more, kebab, options |
| `download` | save, import |
| `edit` | pencil, modify, rename |
| `external-link` | open, link, share, outbound |
| `eye-closed` |  |
| `eye` |  |
| `file-down` | download, save |
| `file` | document, page |
| `filter-x` | clear filter, reset filter, remove filter |
| `filter` | sort, narrow |
| `folder-close` | directory |
| `folder-open` | directory, browse |
| `folder-tree` | hierarchy, structure, tree |
| `hat-glasses` | accessibility, vision, disguise, person |
| `heart-handshake` | credits, thanks, agreement, deal, partnership |
| `heart` | like, favorite, love, wishlist |
| `history-tree` | log, past |
| `history` | log, past |
| `home` |  |
| `hourglass` | progress, time, wait, loading, timer |
| `info` | information, about, i |
| `link` | url, href, anchor |
| `list-collapse` | list, collapse, expand, items |
| `maximize` | fullscreen, expand |
| `megaphone` | announcement, broadcast |
| `menu` | hamburger, list, more |
| `minimize` | collapse, shrink |
| `minus` | remove, subtract |
| `moon` |  |
| `more` | options, extra |
| `move-horizontal` | resize, swap, horizontal |
| `not-equal` | neq, different |
| `play` | start, run, execute |
| `plus` | add, new, create |
| `pointer` |  |
| `presentation` | slides, deck |
| `refresh-ccw-dot` |  |
| `refresh` | reload, sync, update |
| `regex` | pattern, match |
| `repeat` | loop, retry, rerun |
| `rotate-ccw` |  |
| `rss` | feed, subscribe |
| `runs-history` | log, past |
| `scroll-text` | log, output, console |
| `search-check` | found, validated |
| `search` | find, magnify, lookup |
| `send` | submit, share, deliver |
| `settings` |  |
| `share` |  |
| `sparkles` | ai, magic, generate |
| `square-check-big` |  |
| `square-menu` |  |
| `sun` |  |
| `swatch-book` | palette, color, swatch, paint, design |
| `table-2` | table, grid, data, spreadsheet, rows, columns |
| `tag` | label, badge, chip |
| `text-cursor-input` |  |
| `text-initial` | text, typography, letter, a |
| `timer` | stopwatch, countdown, time |
| `toggle-right` | toggle, switch, on, off, boolean |
| `trash` | delete, remove, bin |
| `view` | show, display, preview |
| `warning-diamond` | error, invalid, alert, danger |
| `warning-triangle` | alert, danger, caution |
| `webhook` | integration, hook |
| `workflow` | pipeline, process, flow |
| `x` | close, cancel, dismiss, remove, no |

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `shape` | IconShape | — | Which icon to render. The set of valid shapes comes from Anta's built-in icons plus any consumer-generated shapes (via the `IconShapes` interface module augmentation). |
| `label?` | string | — | Accessible name for the icon. When set, the wrapper exposes `role="img"` and `aria-label={label}` so screen readers announce the icon. When omitted (the default), the icon is treated as decorative — `aria-hidden="true"` is applied so it doesn't add noise alongside neighbouring text. |
| `size?` | number | 16 | Width and height in pixels. |

## Web Component

Use the web component directly when you are not using React or Preact and a native control does not fit.

Set the accessible name on the raw element. Use `--icon-size` for a portable custom
size.

```html
<a-icon
  shape="warning-triangle"
  role="img"
  aria-label="Warning"
  style="--icon-size: 24px"
></a-icon>
```

## Sizing and color

Pass `size` (a number, in pixels) to control width and height
together. Default is `16`. Color always follows `currentColor`.

```tsx
<Icon shape="chevron-down" />                                  {/* 16×16, current color */}
<Icon shape="check" size={24} />                               {/* 24×24 */}
<Text tone="critical"><Icon shape="warning-triangle" /></Text> {/* tinted */}
```

Internally, `size` is applied as the `--icon-size` CSS custom property
on the rendered `<a-icon>`. The base CSS rule reads it as
`width: var(--icon-size, 16px); height: var(--icon-size, 16px)`. That
means consumer CSS (or a parent's variable cascade) can drive icon
size too — useful for sizing whole regions of UI at once:

```css
.toolbar { --icon-size: 18px; }
```

> The `<Icon size>` wrapper sets `--icon-size` inline, so it works
> everywhere. Hand-authoring the raw element's `size` *attribute*
> (`<a-icon size="18">`) instead relies on typed `attr()` (Chrome 133+);
> on browsers without it (iOS Safari, Firefox) the attribute is ignored
> and the icon falls back to the 16px default. Prefer `<Icon size>` for
> exact custom sizes.

## The `blank` spacer

`shape="blank"` renders nothing but still occupies a full icon box at the
current `size`. Use it to reserve a leading-icon column so labels line up when
only some rows carry an icon — a menu or list where a few items have a leading
glyph and the rest shouldn't shift.

```tsx
<Icon shape="blank" />                    {/* invisible 16×16 spacer */}
<MenuItem icon="blank" label="No icon, but aligned" />
```

Note this differs from omitting the icon: leaving `shape` (or `MenuItem`'s
`icon`) unset renders **no element**, while `blank` renders an invisible sized
box. A bare `<Icon>` with no shape is *not* a spacer — with no mask it paints a
solid square.

## Adding your own icons

Anta ships a generator script at `dist/generate-icons.mjs`. Drop your
SVGs in a folder, point the script at it, and it emits a CSS file plus
a TypeScript declaration that augments Anta's `IconShapes` interface —
your shapes become valid `<Icon shape="…" />` values automatically,
with autocomplete.

```sh
node ./node_modules/@antadesign/anta/dist/generate-icons.mjs \
  --input ./svgs \
  --output ./src/icons \
  --name my-icons
```

`--input` and `--output` are arbitrary paths in your project — pick
whatever fits your layout. The example above writes
`./src/icons/my-icons.css` and `./src/icons/my-icons.d.ts`. Import
the CSS once at runtime; the `.d.ts` only needs to be in your
TypeScript include path (the same `tsconfig.json` `include` that
already covers your other source files), nothing else.

```ts
import './icons/my-icons.css'   // runtime: registers shape rules on <a-icon>
```

You can now use `<Icon shape="my-shape" />` with full type safety.

### SVG conventions

The generator strips `width=` and `height=` from the root `<svg>` so
size is fully under the host element's CSS. For best results:

- Use `viewBox="0 0 16 16"` (or any square viewBox).
- Use `stroke="currentColor"` (or `fill="currentColor"`) — the icon is
  recolored via CSS `background-color: currentColor` masked through the
  SVG's alpha. Black/colored fills work too, but only the alpha
  matters; the shape is always rendered in the current text color.
- Single-color icons only. Multi-color SVGs collapse to one color
  because the entire shape is masked through `currentColor`.

### Conflicting shape names

If a generated shape has the same name as one of Anta's built-ins
(e.g. `chevron-down`), the generator prints a warning. At runtime, the
CSS file imported **last** wins — so importing your generated CSS
after `@antadesign/anta/elements` overrides the matching built-ins.
TypeScript silently merges the duplicate keys; both names remain valid
at the type level.

### Programmatic use

```ts
import { generate } from '@antadesign/anta/generate-icons.mjs'

await generate({
  input:  './svgs',
  output: './src/icons',
  name:   'my-icons',
})
```

Useful for wiring icon generation into a build script.
