# Button

An action control. The `Button` JSX wrapper renders an `<a-button>` web
component (or `<a role="button">` when `href` is set). Tone, priority,
size, and state are all plain attributes, so the styling is identical
whether you use the wrapper or author the element by hand.

## Priority

A button's priority helps control how much attention it draws:

```tsx
<Button tone="brand" priority="primary"    label="Publish" />
<Button tone="brand" priority="secondary"  label="Move" />
<Button tone="brand" priority="tertiary"   label="Cancel" />
<Button tone="brand" priority="quaternary" label="Remind" />
```

- `primary` — Saturated fill. Main call to action.
- `secondary` — Lighter background. Default priority.
- `tertiary` — Background-less at rest, fills on hover.
- `quaternary` — Text only, no background.

## Tone

Six named tones — `neutral` (default), `brand`, `critical`, `info`,
`success`, `warning`. Omitting `tone` — or passing an empty string —
resolves to `neutral`. In addition, a custom `tone` is possible: pass any
literal CSS color and the button will adapt to it.

```tsx
<Button label="Save" />
<Button tone="brand" label="Publish" />
<Button tone="critical" label="Delete" />
<Button tone="info" label="Preview" />
<Button tone="success" label="Approve" />
<Button tone="warning" label="Archive" />
```

```tsx
<Button priority="primary"   tone="#ff1493"                  label="Pinkify" />
<Button priority="secondary" tone="oklch(0.655 0.261 356.9)" label="Pinkify" />
<Button priority="tertiary"  tone="hsl(328 100% 54%)"        label="Pinkify" />
<Button priority="primary"   tone="mediumaquamarine"         label="Mintify" />
<Button priority="secondary" tone="rgb(102 205 170)"         label="Mintify" />
<Button priority="tertiary"  tone="lch(75.7% 39.2 167.8)"    label="Mintify" />
```

For custom tones, **primary** keeps the source's hue and chroma but pins
its *lightness* near the Brand primary's, so any input — too light or too
dark — still lands at a Brand-like fill (hover / active step the lightness,
and the label keeps the standard primary text color). **Secondary**,
**tertiary**, and **quaternary** take only its *hue* — lightness, chroma,
and alpha come from the brand-tone curve (via `oklch()` relative color), so
pale or low-chroma inputs (`tone="#cccccc"`, `tone="white"`) still produce a
legible button. The full priority × state matrix — rest, hover, active,
secondary alpha overlay, tertiary fill — is derived automatically, and
re-tunes between light and dark.

If you need pixel-precise color, set `--button-fg` or `--button-bg`
yourself — inline via `style`, or from your own class or selector. The
resolver lives in `@layer anta`, so any un-layered rule of yours wins
regardless of specificity (and inline beats everything). The same override
also pins hover and active to that color — it overrides the per-state rules
too, so there's no state change; to keep distinct states, set the per-state
variables instead — `--button-bg-{priority}-hover`,
`--button-bg-{priority}-active`, and the `--button-fg-*` equivalents.

## Size

```tsx
<Button tone="brand" size="small"  label="Small" />
<Button tone="brand" size="medium" label="Medium" /> // default
<Button tone="brand" size="large"  label="Large" />
```

Three sizes (`medium` is default). The **type scale** (font / line-height) and
the **icon** track the size, matching Anta's text scale and the same-size
`Input`; the hit area grows or shrinks to match.

Height comes from the label's `line-height` plus a uniform 3.5px vertical padding
and a 1px `padding-bottom` that optically centers Anta's font (its glyphs sit a
touch low in the line-box) — netting `line-height + 8`, so it lands at
24 / 28 / 32px without any per-size padding tuning.

| size | height | font / line | icon | text-edge `padding-x` | icon-edge `padding-x` |
|---|---|---|---|---|---|
| `small` | 24px | 13 / 16 | 14px | 7px | 5px |
| `medium` (default) | 28px | 15 / 20 | 16px | 9px | 7px |
| `large` | 32px | 17 / 24 | 18px | 13px | 11px |

The **icon-edge** padding is the text-edge value minus 2px — an icon at
an edge needs less breathing room than a glyph — so only the side a
(leading or trailing) icon occupies is trimmed; the text side keeps the
full padding. The gap between an icon and the label is `0.5ch` at every
size.

Need a different font size? Style the `<a-button-label>` directly — set
its `font-size` and `line-height` (the label's `line-height` drives the
button's height, so the box follows your value), and (if the text then sits a
little high) drop the 1px `padding-bottom` that optically centers Anta's font.

By default a button packs its content to the start, so when buttons share
a width — a vertical menu, equal grid cells — their labels line up on a
common left edge, which usually reads best in a list.

To center the label inside a wider button instead, set
`justify-content: center` on it (the tones grid above does exactly this).

### Paddingless

```tsx
If you're familiar with the basics, click
<Button tone="critical" priority="quaternary" paddingless label="here" />
to skip ahead to the live demo.
```

Only valid on `priority="quaternary"`. Zeros the outer padding so the
button sits flush with surrounding prose — useful when you want a
button to read as an inline link inside a sentence.

## Round

`round` fully rounds the corners — a pill for text buttons, a perfect circle for
icon-only ones. The radius (`999px`) is clamped to half the button's height, so it
adapts to every `size` with no configuration. Pass a **number** (px) or a CSS length
string for a custom radius instead of a full pill.

```tsx
<Button round tone="brand" label="Pill" />
<Button round tone="brand" icon="heart" aria-label="Like" /> // circle
<Button round={10} tone="brand" label="Custom 10px" />       // custom radius
```

## Icons

```tsx
<Button tone="brand" priority="primary" icon="check" label="Confirm" />
<Button tone="brand" iconTrailing="external-link" label="Read the docs" />
<Button tone="brand" priority="tertiary" icon="filter" iconTrailing="chevron-down" label="Filter" />
```

The wrapper renders content in this order inside the button: `icon` →
`label` → `children` → `iconTrailing`. Icon shape names come from the
`IconShape` union — see the [Icon](./icon.md) page for the full
set. `children` (if any) lands between `label` and `iconTrailing`.

### Icon-only

```tsx
<Button tone="neutral"  icon="dots-vertical" size="small" />
<Button tone="critical" icon="trash" />
<Button tone="brand"    icon="check"          size="large" />
```

Pass `icon` alone — no `label`, no `iconTrailing`, no `children` — and
the button collapses to a square. A min-size is pinned to a square
matching the labeled-button height (24px / 28px / 32px for small /
medium / large) so icon-only and labeled buttons line up, and a tight
flex parent can't clip the icon.

Icon-only buttons get an accessible name automatically — the wrapper
sets `aria-label={icon}` so `<Button icon="trash" />` ships with the
name "trash". Pass your own `aria-label` to override.

### Children

```tsx
<Button tone="brand" label="Save" icon="check">
  <span style={{ opacity: 0.7 }}>⌘S</span>
</Button>
```

Children render after the label and before the trailing icon, so you
can mix custom inline content — keyboard hints, badges, counters —
with the prop-driven API.

Children also work without `label` — pass them as the only content.

Text and number children are auto-wrapped in `<a-button-label>` (so the
truncation rule applies and they don't trip the icon-only detector);
element children — a `<span>`, a `<Tooltip>`, … — pass through
unwrapped. Children with no visible content render nothing: empty or
whitespace-only strings, `NaN`, `null` / `undefined`, and booleans are
dropped (a valid `0` still renders).

## Underline

```tsx
<Button tone="brand" priority="tertiary" underline="solid"  label="Solid" />
<Button tone="brand" priority="tertiary" underline="dashed" label="Dashed" />
<Button tone="brand" priority="tertiary" underline="dotted" label="Dotted" />
<Button tone="brand" priority="quaternary" underline="solid" underlineOnHover label="Hover only" />
```

When the button has a [link mode](#link-mode), or you simply want an
underline stylistically, it supports three styles — `solid`, `dashed`,
`dotted` (only valid on `priority="tertiary"` / `"quaternary"`). Set
`underlineOnHover` to keep that underline hidden until pointer hover.

## States

```tsx
<Button tone="brand" loading label="Submitting" />
<Button tone="brand" disabled label="Locked" />
<Button tone="brand" selected label="Toggled on" />
<Button tone="brand" loading disabled label="Critical" />
```

- **`loading`** — diagonal stripe overlay slides across the button.
  Stripe color follows `currentColor`, so it tracks the tone. Blocks
  clicks via `pointer-events: none`, and (like `disabled`) removes the
  button from the tab order so Enter/Space can't fire it mid-flight.
- **`disabled`** — locks the colors to the disabled palette, sets
  `pointer-events: none`, and removes the button from the tab order.
  Beats inline `--button-bg` overrides.
- **`selected`** — toggled-on / pressed visual; shares the active
  state's look. Useful for filter chips and icon toggles.

## ButtonCopy

`ButtonCopy` is a copy button — a `Button` preset for copy-to-clipboard. It
composes a plain `<Button>` with a slotted `<a-copy>` element that writes to the
clipboard when the button is activated. A button with a copy glyph changes the
glyph to a check and retones to `success` for ~2s (✕ / `critical` on failure).
Set `copy` for a literal string, or drop the `label` for an icon-only copy
button.

```tsx
<ButtonCopy copy="npm i @antadesign/anta" label="Copy install command" />
<ButtonCopy copy="https://anta.design" priority="tertiary" /> // icon-only

<ButtonCopy
  copy="npm i @antadesign/anta"
  label="Copy install command"
  iconPlacement="none"
  copiedLabel="Copied to clipboard"
/>
```

The write lives in the standalone `<a-copy>` element, so the button stays a plain
button. `ButtonCopy` slots it in for you; to build the same by hand, drop an
`<a-copy copy=…>` into a `<Button>` or `<a-button>`. `onCopied(ok)` fires after
each attempt. Override the resting glyph with `icon`; the check / ✕ swap in only
during the feedback window.

With `iconPlacement="none"`, the button stays unchanged. A successful pointer
copy shows `✓ Copied` beside the pointer. A keyboard copy shows it at the
button's inline start. Use `copiedLabel` to change the text.

### Icon placement

`iconPlacement` sets where the copy glyph sits: `leading` (the default) or
`trailing`. Pass `none` to omit the glyph. A successful copy then shows the
confirmation label without changing the button. Set `copiedLabel` to change the
label text.

```tsx
<ButtonCopy copy={value} label="Leading" />                              // default
<ButtonCopy copy={value} label="Trailing" iconPlacement="trailing" />
<ButtonCopy copy={value} label="No icon" iconPlacement="none" />
```

### Copy a DOM node

Pass `copyNode` to copy a rendered region as rich text (`text/html`) plus plain
text, instead of a string. Bare `copyNode` copies the nearest ancestor marked
`data-copy-source`; a string is a CSS selector for an ancestor region. The copy
button itself is stripped from what's copied.

```tsx
<div data-copy-source>
  <Text>The quick brown fox jumps over the lazy dog.</Text>
  <ButtonCopy copyNode label="Copy card" size="small" priority="tertiary" />
</div>
```

Copying rich text lets a paste target keep formatting (bold, links, list
structure) while a plain-text target still gets clean text. Paste the copied
card into a rich editor and a plain one to see both.

### Copy the page URL

`copyUrl` copies the current page URL (`location.href`) — no `copy` value needed.
`copyWithUrl` prefixes a `copy` string with `// URL: <href>`, so a copied snippet
carries a link back to where it came from.

```tsx
<ButtonCopy copyUrl label="Copy link" />
<ButtonCopy copy={snippet} copyWithUrl label="Copy snippet" />  {/* snippet + source URL */}
```

### Copy dynamic text

`copy` is a controlled string. Start it at `''`, then set the new text in
`onCopyRequest`. The next render updates `copy`, and activation writes that value.
`onCopyRequest` does not return text. It does not add a polling loop.

```tsx
const [report, setReport] = useState('')

<ButtonCopy
  copy={report}
  label="Copy report"
  onCopyRequest={() => setReport(generateReport())}
/>
```

`onCopyRequest` fires on pointerdown or Enter/Space keydown, before the click or
menu selection that writes to the clipboard.

#### Why `copy` is controlled

In a usual React or Preact app, an `onClick` handler can calculate a string and
call the Clipboard API itself. `ButtonCopy` also supports applications rendered
from a worker. The DOM copy control and Clipboard API are on the browser UI
thread, but the application's JSX code can be elsewhere. A function cannot cross
that boundary as a callable reference.

The request tells the application to calculate the text. Its state update makes
the renderer send the string as the `copy` attribute. The control then writes that
attribute during activation, when the browser permits clipboard access. A
`lazyCopy: () => string` prop could only hide this same state update inside the
wrapper. A generic return value would also need a defined clipboard format and
serialization; Anta supports text (`copy`), a DOM region (`copyNode`), and the
current URL (`copyUrl`).

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `copiedLabel?` | string | Copied | Text in the successful no-icon confirmation. |
| `copy?` | string | — | Text copied to the clipboard on activation. |
| `copyNode?` | boolean \| string | — | Copy a DOM node as rich text (`text/html`) + plain text. `true` copies
 the nearest ancestor marked `data-copy-source`; a string is a CSS
 selector for an ancestor region (`closest`). The copy control is stripped
 from the copied output. |
| `copyUrl?` | true | — | Copy the current page URL (`location.href`). |
| `copyWithUrl?` | boolean | — | Prefix the copied text with `// URL: <current page URL>`. |
| `disabled?` | boolean | — | Disable the button. |
| `download?` | string \| boolean | — | Anchor download attribute. Empty string / `true` triggers a download with the resource's default name; a string overrides the filename. |
| `form?` | string | — | Form id when the button isn't a descendant of its form. |
| `href?` | string | — | URL to link to. A definite string renders `<a role="button">`; omit it
 (or pass `undefined`) to render `<a-button>`, so `href={maybeUrl}`
 degrades to a plain button when the URL is absent. |
| `icon?` | IconShape | — | Leading icon shape. When set alone (no `label`, no `iconTrailing`, no
 `children`), the button renders as a square icon-only control and
 the wrapper auto-supplies `aria-label={icon}` (override by passing
 your own `aria-label`). |
| `iconPlacement?` | 'leading' \| 'trailing' \| 'none' | 'leading' | Where the copy glyph sits relative to the label — or `'none'` to omit it.
 Without a glyph, a successful copy shows a small confirmation label near
 the pointer and leaves the button unchanged. |
| `iconTrailing?` | IconShape | — | Trailing icon shape. Renders after `children`, last in the slot order. |
| `label?` | string | — | Label text. Renders between the leading icon and `children`. |
| `loading?` | boolean | — | Show a rotating loading indicator. Blocks clicks and keyboard
 activation, and removes the button from the tab order while active. |
| `onClick?` | (e) => void | — | Click handler. |
| `onCopied?` | (ok) => void | — | Fires after the copy attempt with whether it succeeded. |
| `onCopyRequest?` | () => void | — | Refresh a dynamic `copy` value before activation. Set the new string in
 application state so the next render updates `copy`. Return values are
 ignored. Fires on pointerdown and Enter/Space keydown. |
| `paddingless?` | boolean | — | Drops outer padding to zero. |
| `ping?` | string | — | Space-separated URLs the browser pings on navigation. |
| `priority?` | 'primary' \| 'secondary' \| 'tertiary' \| 'quaternary' | secondary | Visual emphasis. |
| `rel?` | string | — | Anchor rel. |
| `role?` | string | button | ARIA role override (e.g. `'gridcell'` when a button is a cell in a grid).
 Forwarded to the underlying element. |
| `round?` | boolean \| number \| string | — | Fully-round corners — a pill for text buttons, a circle for icon-only ones
 (`border-radius: 999px`, clamped to the element's height). Pass a `number`
 (px) or a CSS length string (`'1rem'`) for a custom radius instead. |
| `selected?` | boolean | — | Toggled-on / pressed state, e.g. for filter chips. |
| `size?` | 'small' \| 'medium' \| 'large' | medium | Size variant. small=24px, medium=28px, large=32px. Omit the
 attribute or pass `'medium'` for the default — both render
 identically and emit no DOM attribute. |
| `tabIndex?` | number | 0 | Tab order. The button is keyboard-focusable by default (`0`) and
 becomes `-1` automatically while `disabled` or `loading` — `<a-button>`
 and `<a role="button">` aren't focusable without an explicit tabindex,
 and a loading button must stay out of the tab order so Enter/Space can't
 fire it mid-flight. |
| `target?` | string | — | Anchor target. |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | neutral | Semantic tone, or any literal CSS color (`'#ff1493'`, `'rebeccapurple'`)
 for a one-off custom tone. Primary uses the color as-is; secondary,
 tertiary, and quaternary take its hue and pin lightness/chroma to the
 brand curve so any input stays legible. |
| `type?` | 'button' \| 'submit' \| 'reset' | — | Form submission type. |
| `underline?` | 'solid' \| 'dashed' \| 'dotted' | — | Underline style. |
| `underlineOnHover?` | boolean | — | Hide the underline at rest and reveal it on hover. |

## Link mode

```tsx
<Button tone="brand" href="/docs" target="_blank" label="Read the docs" />
```

Setting `href` switches the rendered tag from `<a-button>` to
`<a role="button" data-anta>`. Styling is identical — both selectors share
the same CSS rules. `<Button>` adds the `data-anta` marker for you.

**`href` is optional**, so a conditional URL needs no branching. Pass
`href={maybeUrl}` (a `string | undefined`): a definite string links out, an
absent / `undefined` href renders a plain `<a-button>`. Pair it with `disabled`
for a link that's live when the URL exists and inert otherwise — no two-render
split or conditional spread:

```tsx
// Links out when there's a URL; a plain, disabled button when there isn't.
<Button href={reportUrl} disabled={!reportUrl} iconTrailing="external-link" label="View report" />
```

### Routing libraries

Anta's CSS targets `a-button, a[role="button"][data-anta]` — an anchor (`<a>`)
with `role="button"`, the `data-anta` opt-in marker, and the right attributes
gets the styling. That means anta doesn't need an `as` / `asChild` /
`component` prop or per-framework integrations. Compose your own thin wrapper
around your library's `Link` component — which renders an `<a>`, so adding
`role="button"` and `data-anta` matches the selector.

The `data-anta` marker is required because `role="button"` is a *generic* ARIA
role that other widgets emit too — gating on the marker keeps anta from
restyling anchors it doesn't own (a third-party menu, an embedded editor's
toolbar, etc.).

```tsx
// LinkButton.tsx — anta-styled link for client-side routing
import { Link, type LinkProps } from 'react-router-dom'
import type { IconShape } from '@antadesign/anta'

type LinkButtonProps = LinkProps & {
  tone?: 'neutral' | 'brand' | 'critical' | 'info' | 'success' | 'warning'
  priority?: 'primary' | 'secondary' | 'tertiary' | 'quaternary'
  size?: 'small' | 'medium' | 'large'
  icon?: IconShape
  iconTrailing?: IconShape
  label?: string
}

export const LinkButton = ({
  tone, priority, size, icon, iconTrailing, label, children, ...rest
}: LinkButtonProps) => (
  <Link role="button" data-anta tone={tone} priority={priority} size={size} {...rest}>
    {icon && <a-icon shape={icon} aria-hidden="true" />}
    {label != null && <a-button-label>{label}</a-button-label>}
    {children}
    {iconTrailing && <a-icon shape={iconTrailing} aria-hidden="true" />}
  </Link>
)
```

Usage:

```tsx
<LinkButton to="/dashboard" tone="brand" label="Dashboard" />
<LinkButton to="/docs" priority="tertiary" iconTrailing="external-link" label="Docs" />
```

This approach would work for Next.js `<Link>`, TanStack Router, or any
other routing library.

## Special events

Beyond a plain click, a `Button` can drive a native form or emit your own
event:

### Form submission

For non-anchor buttons, `type="submit"` and `type="reset"` integrate
with native forms. `type="submit"` calls `form.requestSubmit()` and also
dispatches a `submitdetailed` event on the form with
`{ formData, submitter: { tag, attrs } }` in `detail` — handy for
analytics or multi-button forms.

```tsx
<form id="signup">
  <Button tone="brand" type="submit" label="Sign up" />
  <Button tone="brand" priority="tertiary" type="reset" label="Clear" />
</form>
{/* Associate with a form by id when the button is outside */}
<Button tone="neutral" type="submit" form="signup" label="Submit from outside" />
```

### Custom click events

`data-custom-event="<name>"` makes the button dispatch a bubbling
`CustomEvent("<name>")` on click. Use it to instrument analytics
without taking ownership of `onClick`.

```tsx
<Button tone="brand" label="Save" data-custom-event="save-clicked" />
```

## Component props

## Web Component

Use the web component directly when you are not using React or Preact and a native control does not fit.

Set `role="button"` and `tabindex="0"` when authoring `<a-button>` directly.

```html
<a-button role="button" tabindex="0" priority="primary">
  <a-icon shape="plus" aria-hidden="true"></a-icon>
  <a-button-label>Create project</a-button-label>
</a-button>
```

### Native HTML button

The styling attaches to three element shapes, so you can adopt the button look on
markup you already own instead of routing through `<Button>`. `data-anta` is the
opt-in marker — it stops Anta restyling a `role="button"` element it does not own
(a third-party menu, an embedded editor's toolbar):

| Element | For |
| --- | --- |
| `<a-button>` | the component's own tag, always styled — what `<Button>` renders |
| `<a role="button" data-anta>` | a link — what `<Button href>` renders (see [Link mode](#link-mode)) |
| `<button data-anta>` | a native form control — keeps native form submission, `disabled`, and Enter / Space activation |

`tone` / `priority` / `size` are plain attributes on the element (the `<Button>`
wrapper sets them for you). A native `<button>` also carries its own default
`type="submit"`, so inside a `<form>` it submits without extra wiring:

```html
<!-- A real <button>: submits forms and toggles `disabled` natively. -->
<button data-anta tone="brand" priority="primary">Save changes</button>
<button data-anta priority="secondary">Cancel</button>
<button data-anta tone="critical" priority="tertiary">Delete</button>
```

## Styling

Reach for the props first: **`tone`** sets the color (any CSS color for a custom
tone — it derives the whole tone × priority × state curve in oklch), **`priority`**
the emphasis, **`size`** the dimensions. The focus ring is the global
[`--focus-ring`](../colors.md#focus-ring).

```tsx
<Button tone="#e0457b" priority="primary" label="Custom" />
```

For anything beyond the props, `<a-button>` is light-DOM — restyle it with plain
CSS (an un-layered rule beats `@layer anta` without `!important`). Set
`background-color` / `color` **per state**, plus full type control (size,
line-height, letter-spacing, `font-feature-settings`), padding, radius, even a
frosted `backdrop-filter` — no need to touch a single token. **`light-dark()`** works
too (Anta sets `color-scheme` from its theme toggle), so colors adapt to dark mode
with no `.dark` selector. The classes below are just for the demos:

```css
/* First — inverted pill: a theme-flipping gradient (near-black in light,
   near-white in dark) via light-dark() in the gradient stops. Anta sets
   color-scheme from its .dark toggle, so it adapts with no .dark selector. */
a-button.checkout {
  background: linear-gradient(140deg, light-dark(#26262b, #fff), light-dark(#000, #dcdce0));
  color: light-dark(#fff, #0b0b0c);
  font-size: 20px;
  line-height: 1.2em;
  padding: 12px 26px;
  border-radius: 999px;
}
a-button.checkout:hover  { background: linear-gradient(140deg, light-dark(#3a3a42, #fff), light-dark(#161618, #cacace)); }
a-button.checkout:active { background: linear-gradient(140deg, light-dark(#000, #ececf0), light-dark(#1a1a1c, #fff)); }
a-button.checkout a-button-label {            /* customized label */
  text-transform: uppercase;
  letter-spacing: 0.14em;
  font-weight: 600;
}

/* Second — liquid glass: frost + translucent tint + a diagonal specular sheen,
   a top/bottom bevel, and a soft lift. Sits on a colorful backdrop so it reads. */
a-button.glass {
  color: #fff;
  background-color: rgba(255, 255, 255, 0.12);
  background-image: linear-gradient(135deg, rgba(255,255,255,0.55), rgba(255,255,255,0.06) 45%, transparent 65%);
  border: 1px solid rgba(255, 255, 255, 0.4);
  border-radius: 999px;
  backdrop-filter: blur(8px) saturate(1.8) brightness(1.06);
  box-shadow:
    inset 0 1px 1px rgba(255,255,255,0.65),    /* top bevel */
    inset 0 -2px 3px rgba(255,255,255,0.18),
    0 8px 24px rgba(0,0,0,0.22);               /* lift */
  font-size: 20px; line-height: 1.2em; padding: 12px 26px;
}
a-button.glass:hover  { background-color: rgba(255, 255, 255, 0.22); }
a-button.glass:active { background-color: rgba(255, 255, 255, 0.08); }
a-button.glass a-button-label {               /* beautified label — gradient text */
  font-weight: 600;
  background: linear-gradient(180deg, #fff, #cfe0ff);
  background-clip: text;
  color: transparent;
  filter: drop-shadow(0 1px 1px rgba(0,0,0,0.3));
}
```

```tsx
<Button className="custom" tone="brand" loading label="Saving changes" />

<style>{`
  /* Keep loading's blocked interaction; replace only its stripe overlay. */
  a-button.custom[loading]::before {
    inset: -200%;
    border-radius: 100%;
    background: conic-gradient(
      from 0deg,
      color-mix(in oklch, currentColor 0%, transparent),
      color-mix(in oklch, currentColor 10%, transparent)
    );
    opacity: 1;
    filter: none;
    animation: button-loader-field-spin 1s linear infinite;
    animation-delay: -9999s;
  }

  @keyframes button-loader-field-spin {
    to { transform: rotate(1turn); }
  }
`}</style>
```

**Loader field.** `loading` still blocks pointer and keyboard activation. This
only replaces its default stripe overlay with the Loader’s conic field, scaled
beyond the button so it can rotate behind the label without exposing an edge.

Don't reach for the resolved `--button-fg` / `--button-bg`: they're recomputed per
state, so setting one only catches a single state — restyle per state as above, or
use `tone` for a full custom-color curve.
