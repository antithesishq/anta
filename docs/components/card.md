# Card

A surface container: a bordered, toned box that groups related content. The
`Card` JSX wrapper renders an `<a-card>`, which lays out an optional full-bleed
`media` region plus a `header` / body / `footer` stack. Pass `href` to turn the
whole card into a link.

A card stylizes only its own surface, never its content's typography. Pass
`header` and body (`children`) as strings and the wrapper wraps them in a
`<Title>` and a `<Text>` that follow the card's `tone` and `size`; pass your own
nodes to take over. It shares the `tone` / `priority` / `size` vocabulary with the
rest of Anta.

## Anatomy

A card is three stacked sections — `header`, body (`children`), `footer` — plus an
optional full-bleed `media` region. Each is optional and an empty one reserves no
space. Spacing comes from one `--card-padding`: the outer inset and the body→footer
gap are a full `--card-padding`, and the header sits a half-step closer to its body
(`--card-padding / 2`). A string `header` becomes a `<Title>` and a string body a
`<Text>`; pass your own node (`<Title>`, `<Text>`, a layout) to take over. An
optional `subtitle` renders under the title as smaller text (`<Text size="small">`). There's
no dedicated actions slot: lay out header controls (a button, a tag) inside the
`header` itself.

```tsx
<Card
  media={<img src="/hero.jpg" alt="" />}
  icon="book-open"        {/* a string shape → an <Icon> in a circular chip */}
  header="Card title"
  subtitle="A short supporting subtitle"
  footer={<><Button priority="secondary" label="Launch" /><Button priority="tertiary" label="Edit" /></>}
>
  The body sits under the header. Every section is optional.
</Card>

{/* mediaPosition moves the media to another edge */}
<Card
  media={<img src="/hero.jpg" alt="" />}
  mediaPosition="left"
  header="Card title"
  footer={<><Button priority="secondary" label="Launch" /><Button priority="tertiary" label="Edit" /></>}
>
  The same four zones, with the media bleeding to the left edge instead of the top.
</Card>
```

## Priority

`priority` sets the surface. `primary` (the default) is a clean sheet — `bg-1`
in light mode, `bg-4` in dark (and a toned card's cleanest tint: `bg-2-{tone}`
light, `bg-4-{tone}` dark); `secondary` is a subtle fill (`bg-2`, or the deeper
tint for a toned card); `tertiary` is a frosted panel: the `primary` surface
made semi-transparent with a backdrop blur, so it reads over busy, colored, or
image backgrounds (the blur shows where there's detail behind). All three carry
a hairline ring — `border-4` for a neutral card, or the tone's `border-4-{tone}`
when toned (stepping to `border-3` on hover).

```tsx
<Card header="Primary (default)">…</Card>              {/* primary is the default */}
<Card priority="secondary" header="Secondary">…</Card>
<Card priority="tertiary" header="Tertiary">…</Card>
```

## Tones

A semantic `tone` tints the surface, border, and text. The set matches the rest of
Anta: `neutral` (the default) plus `brand`, `info`, `success`, `warning`, and
`critical`. Color comes from the theme tokens, so every tone tracks light and dark
mode. A toned card is how you build a **banner** or **callout** — a filled card
with an icon and a message (add a `footer` for an action):

```tsx
{/* A string `icon` gets the circular chip; pass a bare <Icon> node for a plain
    tinted glyph, as these banners do. */}
<Card tone="info" priority="primary" icon={<Icon shape="info" />} header="Heads up">…</Card>
<Card tone="success" priority="primary" icon={<Icon shape="circle-check" />} header="All checks passed">…</Card>
<Card tone="warning" priority="primary" icon={<Icon shape="warning-triangle" />} header="Approaching quota">…</Card>
<Card tone="critical" priority="primary" icon={<Icon shape="warning-diamond" />} header="Deployment failed">…</Card>
```

`tone` also accepts **any literal CSS color** for a one-off tint — the hue is kept
while lightness and chroma are pinned to the named-tone curve (and re-tuned for
dark mode), the same mechanism as `Button` / `Expander` / `Tag`. The surface,
border, and the `<Title>` / `<Text>` the wrapper adds all derive from the color —
`Title` and `Text` take a custom tone too, so a string `header` / body tints to
match:

```tsx
<Card tone="#ff1493" priority="primary" header="Magenta">…</Card>
<Card tone="rebeccapurple" priority="primary" header="Purple">…</Card>
<Card tone="#0d9488" priority="primary" header="Teal">…</Card>
```

## Size

`size` scales the padding, the auto-wrapped body text, and the icon chip —
`small`, `medium` (the default), `large`.

```tsx
<Card size="small" header="Small">…</Card>
<Card header="Medium (default)">…</Card>      {/* medium is the default */}
<Card size="large" header="Large">…</Card>
```

## Round

`round` softens the corners. A `number` (px) or CSS length sets a custom radius —
the usual choice for a card (`round="0"` squares them); bare `round` goes fully
round (`999px`, clamped to the box). Omit it for the default (`--card-radius`, 8px).

```tsx
<Card round={16} header="Custom radius">…</Card>
<Card round="0" header="Square">…</Card>
```

## Header controls

There is no dedicated actions slot. To place a control in the top-right of the
header, pass a layout node as `header`. For example, use a flex row containing
the title and a "more" button. That layout determines where both items appear.

```tsx
<Card
  header={
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
      <Title level={4}>Production database</Title>
      <Button size="small" priority="tertiary" icon="more" aria-label="More" />
    </div>
  }
>
  Region us-east-1 · 4 vCPU · 16 GB
</Card>
```

## Footer

`footer` is a **left-aligned** row (it wraps under pressure) — the opposite of
`Dialog`'s right-aligned footer, since a card reads as left-aligned content rather
than a decision surface. Pass several buttons as a fragment.

```tsx
<Card
  header="Invite teammates"
  footer={<><Button priority="primary" size="small" label="Send invites" /><Button size="small" label="Copy link" /></>}
>
  <Text>They'll get access to this project and its test runs.</Text>
</Card>
```

## Media

Pass `media` for a full-bleed image or illustration — it escapes the card padding
and clips to the corners. `mediaPosition` places it on the `top` (the default),
`bottom`, `left`, or `right` edge.

**Top** (default)

**Left**

```tsx
<Card media={<img src="/hero.jpg" alt="" />} header="Top media">…</Card>          {/* top is the default */}
<Card media={<img src="/hero.jpg" alt="" />} mediaPosition="left" header="Left media">…</Card>
{/* mediaPosition also takes "bottom" and "right" */}
```

## Link card

Give a card an `href` and the whole thing becomes a link — a single focusable
anchor, keyboard-activatable, with the `hover` lift and inset focus ring. The
accessible name comes from the header (falling back to the body, then the URL), so
a screen reader announces one concise link instead of the whole card's text. A
link card is display content: keep interactive controls (buttons, nested links)
out of it — its text is non-selectable and the whole surface navigates.

```tsx
<Card
  href="/docs/ci"
  header={<><Icon shape="book-open" /> CI integration guide</>}
>
  Wire Antithesis into your pipeline in a few minutes.
</Card>
```

Set `target` / `rel` for a new-tab link (`target="_blank" rel="noopener"`), or
`aria-label` to override the derived link name.

## Selected

`selected` draws an inset ring in the tone color — for choice cards, plan pickers,
and selected list items.

```tsx
<Card selected tone="brand" priority="primary" header="Team plan">…</Card>
<Card header="Free plan">…</Card>
```

## Loading

`loading` dims the card with a skeleton pulse and sets `aria-busy`. On a link card
it also blocks navigation until the load resolves.

```tsx
<Card loading header="Loading…">
  <Text>Content is being fetched.</Text>
</Card>
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `children?` | ReactNode | — | The card body. A string is wrapped in a `<Text>` at secondary priority,
 following the card's `tone` and `size`; pass your own nodes to take over. |
| `footer?` | ReactNode | — | Footer content, usually action buttons. Rendered as a **left-aligned** row
 (wraps under pressure) — the opposite of `Dialog`'s right-aligned footer. |
| `header?` | ReactNode | — | Header content, in the top zone. A string is wrapped in a `<Title>` — a real
 heading in the document outline, tinted to match `tone`, at a level that
 tracks `size` (small → 5, medium → 4, large → 3). Pass your own node
 (`<Title level={2}>`, an `<h2>`) for a different level or styling. Omit for
 no header. |
| `href?` | string | — | Turn the whole card into a link. The card renders a focusable anchor and its
 accessible name comes from `header` → body → this URL (override with
 `aria-label`). A link card is display content — don't nest interactive
 controls inside it. |
| `icon?` | (string & {}) \| string \| number \| bigint \| boolean \| ReactElement \| Iterable \| ReactPortal \| Promise \| null | — | Leading visual for the header, laid out to the left of the `header` /
 `subtitle` as one aligned row (so it doesn't sit inline in the title, where it
 mis-aligns). A **string** is an icon shape, rendered as an `<Icon>` inside a
 circular chip (sized per the card via `--card-icon-size`); pass an `<img>`,
 initials (`<Text>`), or any node to use it as-is. Omit for none. |
| `loading?` | boolean | — | Loading state — dims the card with a skeleton pulse, sets `aria-busy`, and (in
 link mode) blocks navigation. |
| `media?` | ReactNode | — | Media (image, illustration) rendered full-bleed to the card edge, clipped to
 its corners. Position it with `mediaPosition`. |
| `mediaPosition?` | 'top' \| 'bottom' \| 'left' \| 'right' | 'top' | Which edge the `media` bleeds to. |
| `ping?` | string | — | Space-separated URLs the browser pings on navigation (only with `href`). |
| `priority?` | 'primary' \| 'secondary' \| 'tertiary' | 'primary' | Surface emphasis. `primary` (the default) is a clean sheet; `secondary` is a
 subtle fill; `tertiary` is a frosted, semi-transparent panel with a backdrop
 blur. |
| `rel?` | string | — | Anchor rel (only with `href`). |
| `round?` | boolean \| number \| string | — | Fully-round corners (`border-radius: 999px`, clamped to the box). Pass a
 `number` (px) or a CSS length string (`'1rem'`) for a custom radius. Omit for
 the default `--card-radius`. |
| `selected?` | boolean | — | Selected / chosen state — draws an inset ring in the tone color, for
 choice-card / plan-picker patterns. |
| `size?` | 'small' \| 'medium' \| 'large' | 'medium' | Size variant — scales the padding. |
| `subtitle?` | ReactNode | — | A secondary line under the header title, rendered as smaller text
 (`<Text size="small">`) in the heading section. Tinted to match `tone`, like
 the title. Omit for no subtitle. |
| `target?` | string | — | Anchor target (only with `href`). |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | 'neutral' | Semantic tone, or any literal CSS color (`'#ff1493'`, `'rebeccapurple'`) for
 a one-off custom tone. Named tones re-point the surface + text; a custom
 color keeps its hue while lightness/chroma are pinned. `'neutral'` (the
 default) is the same as omitting it. |

Use this when you are not using the React or Preact wrapper and a native HTML control does not fit: construct the equivalent Anta web component from the elements below.

Slots hold media, header, and footer content. Unslotted content is the card body.

```html
<a-card>
  <a-title slot="header" level="5" role="heading" aria-level="5">Release notes</a-title>
  <a-text>Everything without a slot attribute becomes the body.</a-text>
  <a-button slot="footer" role="button" tabindex="0" size="small">
    <a-button-label>Read more</a-button-label>
  </a-button>
</a-card>
```

Reach for the props first: **`tone`** sets the color (any CSS color for a custom
tone — it derives the surface in oklch), **`priority`** the fill, **`size`** the
padding. The one custom-color knob worth keeping is **`--card-tone-source`** (the
color a custom `tone` derives from — set it to drive the palette from your own
variable). The corner radius is **`--card-radius`**.

```tsx
<Card tone="#e0457b" header="Custom" />
```

**Header heading level.** A string `header` becomes a `<Title>` whose level tracks
`size` — small → 5, medium → 4, large → 3 — a real heading in the document outline.
For a different level or your own styling, pass a `<Title level={n}>` (or an
`<h2>`–`<h6>`) as the header; the card zeroes its top margin so it spaces the same
either way:

```tsx
<Card header={<Title level={2}>Heading semantics</Title>}>
  The header is a level-2 heading node, in the page outline.
</Card>
```

For everything else, `<a-card>` exposes shadow **parts** —
`::part(container)` (the box / anchor), `::part(media)`, `::part(content)`,
`::part(header)` (the icon + text zone), `::part(icon)`, `::part(title)` (the
title / subtitle text column), `::part(body)`, `::part(footer)` — which you style
directly. Each section carries its own `--card-padding`, so a divider on
`::part(header)` reads as a true section rule.

Each example keeps its CSS in a `<style>` **inside** its own preview, targeting a
demo class on that preview's card — so the rule you read is literally in the
preview's DOM, next to the element it styles. In your app, swap the demo class for
your own selector.

**Scroll a capped body.** The card never scrolls, and the body doesn't by default.
When you cap the card's height and want the body to scroll instead of the card
growing, that's one line on `::part(body)`:

```css
/* cap the card's height, then let the body scroll */
a-card.scrollable { height: 160px; }
a-card.scrollable::part(body) { overflow: auto; }
```

**Separate the header** with a divider by styling `::part(header)`:

```css
a-card.divided::part(header) {
  padding-bottom: 8px;
  border-bottom: 1px solid var(--border-5);
}
```
