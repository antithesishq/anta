# Tag

A compact pill for status, labels, and metadata. The `Tag` JSX wrapper
renders an `<a-tag>` styled tag — there's no JavaScript, so tone, size,
and case are all plain attributes and the styling is identical whether
you use the wrapper or author the element by hand. Content is composed
from `icon`, `label`, `value`, and `iconTrailing` props, the same way
`Button` works.

## Priority

`priority` sets the emphasis. `secondary` (the default) is the subtle
alpha-tint fill; `primary` is a solid fill with white text; `tertiary` is
a transparent outline. It composes with every tone — named or custom —
and tracks dark mode.

```tsx
<Tag allcaps priority="primary" tone="brand" label="Primary" />
<Tag allcaps tone="brand" label="Secondary" />
<Tag allcaps priority="tertiary" tone="brand" label="Tertiary" />
```

## Tone

Omit `tone` for the neutral gray tag, or pick a semantic tone. Color
comes from the theme tokens, so every tone tracks light and dark mode
automatically.

```tsx
<Tag allcaps label="Neutral" />
<Tag allcaps tone="brand" label="Brand" />
<Tag allcaps tone="info" label="Info" />
<Tag allcaps tone="success" label="Success" />
<Tag allcaps tone="warning" label="Warning" />
<Tag allcaps tone="critical" label="Critical" />
```

`tone` also accepts any literal CSS color for a one-off tag. The hue is
kept while lightness and chroma are pinned to the named-tone curve.

```tsx
<Tag allcaps tone="#ff1493" label="Magenta" />
<Tag allcaps tone="rebeccapurple" label="Purple" />
<Tag allcaps tone="#0d9488" label="Teal" />
```

Every tone — named or custom — paints its fill and border as
semi-transparent alpha tints rather than solid colors, so a tag picks up
whatever surface sits behind it. Here the same tags sit on a `--bg-4`
panel instead of the page canvas.

## Size

Three sizes — `small` (16px), `medium` (20px, the default — emits no
attribute), and `large` (24px) — matching `Button`. Height is intrinsic
(line-height + padding rather than a fixed value), so the text is never
clipped.

```tsx
<Tag allcaps tone="info" size="small" label="Small" />
<Tag allcaps tone="info" label="Medium" />
<Tag allcaps tone="info" size="large" label="Large" />
```

## Icon, label, and value

Set `icon` / `iconTrailing` for a leading or trailing glyph (scaled to
the pill), and pair `label` with `value` for a two-part tag. `value` is
the primary text (default color and weight); the `label` sits before it
as a bold "key" (weight 600, same color) with no divider — the weight
contrast does the separating. Tabular figures are always on, so counts,
versions, and timers don't reflow.

```tsx
<Tag allcaps tone="success" icon="circle-check" label="Build" value="passed" />
<Tag allcaps tone="info" icon="hourglass" label="Running" value="20m 16s" />
<Tag allcaps icon="history" label="Commit" value="4f90d13" />
<Tag allcaps tone="warning" label="Retries" value="3" iconTrailing="refresh" />
```

## Segments

For an arbitrary multi-part tag, pass several **children** instead of
`label` / `value` — each segment after the first gets a hairline divider
(a leading `icon` stays flush). The divider-less `label` + `value`
pairing is the exception; everything else segments like this.

```tsx
<Tag allcaps>
  <span>v2.1.0</span>
  <span>stable</span>
  <span>x64</span>
</Tag>
<Tag allcaps tone="info">
  <span>GET</span>
  <span>200</span>
  <span>142 ms</span>
</Tag>
<Tag allcaps tone="critical" icon="warning-triangle">
  <span>Exit 137</span>
  <span>OOM</span>
</Tag>
```

## Case

Tags are normal (mixed) case by default, so the text is read as written —
proper names, identifiers, and case-sensitive IDs keep their shape (`GitHub`,
not `GITHUB`). Pass `allcaps` for the uppercase treatment: at this small size
all-caps reads as a label at a glance and keeps a uniform, scannable shape,
which suits short status words where the exact case carries no meaning.
Uppercase also tracks wider (0.08ch vs the default 0.02ch) and steps each size
down 1px, since caps read larger than mixed case at the same size.

```tsx
<Tag icon="external-link" label="GitHub" value="v1.6.9" />
<Tag allcaps label="Running" />
```

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `allcaps?` | boolean | — | Render in all-caps instead of the default normal (mixed) case
 (uppercase tracks wider than the default body-text letter-spacing). |
| `icon?` | IconShape | — | Leading icon shape. Sits flush before the label, scaled to the pill. |
| `iconTrailing?` | IconShape | — | Trailing icon shape. Renders last, after the value. |
| `label?` | string | — | A short "key" shown before the value. When paired with `value` it
 renders bold (weight 600), same color. On its own (no `value`) it's
 treated as the tag's primary text and keeps the default styling. |
| `priority?` | 'primary' \| 'secondary' \| 'tertiary' | secondary | Emphasis level. `secondary` (the default) is the subtle alpha-tint
 fill; `primary` is a solid fill with white text; `tertiary` is a
 transparent outline. Omitting it (or passing `'secondary'`) renders
 the default and emits no DOM attribute. |
| `size?` | 'small' \| 'medium' \| 'large' | medium | Size variant. `small` = 16px tall, `medium` = 20px, `large` = 24px
 (matching `Button`). Omit the attribute or pass `'medium'` for the
 default — both render identically and emit no DOM attribute. |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | neutral | Semantic tone, or any literal CSS color (`'#ff1493'`, `'rebeccapurple'`)
 for a one-off custom tone. Each tone renders the secondary tag style:
 `--text-3-{tone}` text over an alpha tint of the tone's hue (fill + a
 slightly stronger hairline border). A custom color is tinted the same
 way, with the text deepened to a readable foreground. `'neutral'` (the
 default) is the gray tag — the same as omitting `tone`. |
| `value?` | string | — | The tag's primary text — a status, count, version, duration, etc.
 Rendered in the default color and weight, with no divider from the
 label; the color + weight contrast does the separating. |

Use the web component directly when you are not using React or Preact and a native control does not fit.

Use `a-tag-label` for the key and `a-tag-value` for its value.

```html
<a-tag tone="success">
  <a-icon shape="check" aria-hidden="true"></a-icon>
  <a-tag-label>Build</a-tag-label>
  <a-tag-value>Passed</a-tag-value>
</a-tag>
```

Reach for the props first: **`tone`** sets the color (any CSS color for a custom
tone — it derives the fill / border / text in oklch), **`priority`** the fill style,
**`size`** the dimensions.

```tsx
<Tag allcaps tone="#e0457b" priority="secondary" label="Custom" />
```

`<a-tag>` is light-DOM, so for anything a tone can't give you it's plain CSS (an
un-layered rule beats `@layer anta` without `!important`). The `.badge` class below
takes a **gradient** background (impossible from `tone`, which is a solid color),
**1px** corners, and taller vertical padding so it reads completely differently:

```css
a-tag.badge {
  background: linear-gradient(135deg, #1f6e5f, #845ec2);   /* a tone can't do gradients */
  color: #fff;
  border-radius: 1px;                                       /* sharp corners */
  padding-block: 5px;                                       /* tighter vertical padding */
  padding-inline: 14px;
}
a-tag.badge a-tag-label { font-weight: 600; letter-spacing: 0.15ch; }
```

For a *solid* recolor, prefer `tone` / `priority` — don't reach for the resolved
`--tag-bg` / `--tag-border` / `--tag-text` (they're recomputed per priority and tone).
