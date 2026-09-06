export const initialsOnly = { headRadiusTop: { mode: 'off' }, headRadiusBottom: { mode: 'off' }, bodyBorderRadius: { mode: 'off' } }

export const brandRange = { bgColor: { mode: 'range', l: [0.5, 0.62], c: [0.09, 0.15], h: [255, 285] }, harmony: true }

export const palette = { bgColor: { mode: 'list', values: ['#6c5ce7', '#00b894', '#e17055', '#0984e3', '#fdcb6e'] }, headRadiusTop: { mode: 'off' }, headRadiusBottom: { mode: 'off' }, bodyBorderRadius: { mode: 'off' } }

# Avatar

A userpic container. `Avatar` shows one of three things, in priority order: a
supplied image, a seed-generated placeholder figure, or initials. The generated
figure imitates a framed portrait — a head and shoulders over a colored
background — with no face or gender indicators, so an app can fill an empty slot
with a distinct, on-brand picture per user without an uploaded photo.

An alphanumeric `seed` drives the result deterministically: the same seed always
renders the same avatar, and different seeds are distinguishable. A `generator`
config caps each dimension to your brand.

## Generated userpic

Pass a `seed` (a stable user id) and a `name`. With no `generator`, each seed
draws a varied figure: background, head, and body colors, the figure's scale, the
head and shoulder angles, and the corner radius of each shape all move with the
seed, while the head and body hues stay coordinated with the background.

```tsx
<Avatar seed="user-42" name="Vlad Korobov" />
<Avatar seed="lena-r" name="Lena Rossi" />
<Avatar seed="8f21ac" name="Sam Okafor" />
```

## Initials

Turn the shape dimensions off in the `generator` and the avatar falls back to
initials — the first letter of each of the first three words of `name` — over the
generated background. The background color still varies with the seed.

```tsx
const initials = {
  headRadiusTop: { mode: 'off' },
  headRadiusBottom: { mode: 'off' },
  bodyBorderRadius: { mode: 'off' },
}

<Avatar name="Vlad Korobov" generator={initials} />
<Avatar name="Marie Skłodowska Curie" generator={initials} />
<Avatar name="Madonna" generator={initials} />
```

## Image and badge

Set `src` to show an uploaded photo instead of a generated figure, cropped to
fill the container.

`badge` adds a corner badge, colored by tone, on any avatar — image or generated.
It takes any named tone, so the application decides what each one means:
`success` for online, `critical` for busy, `warning` for idle, `neutral` for
offline. Named tones track light and dark mode automatically.

The badge sits in a hole masked out of the picture rather than behind a painted
ring, so whatever is behind the avatar shows through the gap and no ring color
has to track the surface.

```tsx
<Avatar round src="/anta-logo.svg" name="Anta" badge="success" />
<Avatar seed="lena-r" name="Lena Rossi" badge="critical" />
<Avatar seed="8f21ac" name="Sam Okafor" badge="warning" />
<Avatar seed="k-tanaka" name="Kenji Tanaka" badge="info" />
```

`badge` also accepts any literal CSS color for a one-off badge, derived in oklch
the same way a named tone is.

```tsx
<Avatar seed="a-lee" name="Ann Lee" badge="#ff1493" />
<Avatar seed="b-qi" name="Bo Qi" badge="rebeccapurple" />
```

## Size

`size` is `small` (32px), `medium` (44px, the default), or `large` (64px). Pass a
number for a pixel size.

```tsx
<Avatar seed="user-42" name="Vlad Korobov" size="small" />
<Avatar seed="user-42" name="Vlad Korobov" size="large" />
<Avatar seed="user-42" name="Vlad Korobov" size={96} />
```

## Round

`round` makes the frame a circle. Pass a number (px) or a CSS length for a custom
radius instead. The badge hugs the circle's edge on a round frame.

```tsx
<Avatar round seed="user-42" name="Vlad Korobov" />
<Avatar round seed="lena-r" name="Lena Rossi" badge="success" />
<Avatar seed="k-tanaka" name="Kenji Tanaka" round={10} />
```

## Brand constraints

The `generator` config caps the space so every avatar sits on your brand. Each
dimension takes one of four modes: `off` (excluded, a fixed default), `any` (its
full natural range), `range` (an explicit range), or `list` (a set of values the
seed picks from). Edit the config in the playground's **Code** tab to try them.

**Color ranges** cap OKLCH per channel — lightness, chroma, and hue. Narrow the
hue to your brand's, keep chroma modest, and every generated color stays in band
(chroma is clamped into sRGB, so it never clips). `harmony` ties the head and
body hue to the background.

```tsx
const brand = {
  bgColor: { mode: 'range', l: [0.5, 0.62], c: [0.09, 0.15], h: [255, 285] },
  harmony: true,
}

<Avatar seed={user.id} name={user.name} generator={brand} />
```

**Color lists** pass an explicit palette — a scheme the seed picks from at
random. Combine with `off` shapes for a classic initials avatar restricted to
your palette.

```tsx
const palette = {
  bgColor: { mode: 'list', values: ['#6c5ce7', '#00b894', '#e17055', '#0984e3', '#fdcb6e'] },
  headRadiusTop: { mode: 'off' },
  headRadiusBottom: { mode: 'off' },
  bodyBorderRadius: { mode: 'off' },
}

<Avatar name={user.name} generator={palette} />
```

### The dimensions

| Dimension | Range |
| --- | --- |
| `bgColor`, `headColor`, `bodyColor` | OKLCH `l` / `c` / `h` caps, or a palette via `list` |
| `figureScale` | Relative size of the whole figure |
| `figureTranslate` | X and Y shift from the centered position |
| `figureAngle` | Rotation of the whole figure |
| `headAngle`, `bodyAngle` | Rotation of each part within the figure |
| `figureGap` | Space between head and body, `0` to `1` of head height |
| `headRadiusTop`, `headRadiusBottom` | `0` square, `1` fully round, above `1` elongated |
| `bodyBorderRadius` | `0` square to `1` fully round shoulders |

Corner radius is normalized: `0` is a square corner and `1` is fully round, so a
head with both radii at `1` is a circle. **Above `1` the head elongates** into an
oval, spending the excess on that half's height — `1.3` on both radii is a tall
oval, and more at the bottom than the top is an egg.

Two rules keep the head reading as a head. The bottom is never rounded less than
the top, so a value below the top radius is raised to match it: a rounder crown
over a squarer jaw reads mechanical, and the reverse reads natural. And under
`any` both radii average near or above `1`, so heads read round to oval unless
you narrow them yourself.

## Generator config

`generator` takes an `AvatarGenConfig`. Every field is optional — anything you
leave out keeps its default from the table above.

```ts
interface AvatarGenConfig {
  bgColor?: ColorDim
  headColor?: ColorDim
  bodyColor?: ColorDim
  figureScale?: ScalarDim
  figureTranslate?: Vec2Dim
  figureAngle?: ScalarDim
  headAngle?: ScalarDim
  bodyAngle?: ScalarDim
  figureGap?: ScalarDim
  headRadiusTop?: ScalarDim
  headRadiusBottom?: ScalarDim
  bodyBorderRadius?: ScalarDim
  harmony?: boolean
}

type DimMode = 'off' | 'any' | 'range' | 'list'
```

### Modes

Every dimension carries a `mode`. It decides which of the dimension's other
fields are read; the rest are ignored.

| `mode` | Behavior | Fields read |
| --- | --- | --- |
| `off` | Excluded. The dimension holds a fixed neutral default. | none |
| `any` | Varies across the dimension's full natural range (the default). | none |
| `range` | Varies within an explicit range. | `min` / `max`, or `l` / `c` / `h`, or `x` / `y` |
| `list` | Picks one value at random from an explicit set. | `values` |

### Dimension types

**`ScalarDim`** — a single number: scale, an angle, the gap, a corner radius.

```ts
interface ScalarDim {
  mode?: DimMode
  min?: number      // range: lower bound
  max?: number      // range: upper bound
  values?: number[] // list: the allowed values
}
```

**`ColorDim`** — a color. `range` caps OKLCH per channel as `[min, max]` pairs,
with chroma clamped into sRGB so a value can never clip. `list` passes a palette
of any CSS colors.

```ts
interface ColorDim {
  mode?: DimMode
  l?: [number, number] // range: lightness, 0 to 1
  c?: [number, number] // range: chroma, 0 to ~0.4
  h?: [number, number] // range: hue, 0 to 360
  values?: string[]    // list: the allowed CSS colors
}
```

**`Vec2Dim`** — the figure's offset from center, used only by `figureTranslate`.
Each axis runs from −50 to 50 in the frame's coordinates, where 0 centers the
head.

```ts
interface Vec2Dim {
  mode?: DimMode              // 'list' is not used here
  x?: [number, number]        // range: horizontal bounds
  y?: [number, number]        // range: vertical bounds
  values?: [number, number][] // list: allowed [x, y] points
}
```

`harmony` is a plain boolean rather than a dimension: when true, `headColor` and
`bodyColor` take their hue from the background so the parts stay coordinated.

### Defaults per dimension

What `off` pins each dimension to, and what `any` samples. Corner radii are
sampled toward the top of their range, so heads average round to oval.

| Dimension | `off` | `any` samples |
| --- | --- | --- |
| `bgColor` | mid grey | `l` 0.5–0.82, `c` 0.02–0.12, any hue |
| `headColor` | light grey | `l` 0.78–0.96, `c` 0.015–0.075, any hue |
| `bodyColor` | light grey | `l` 0.68–0.9, `c` 0.015–0.09, any hue |
| `figureScale` | `1` | 0.76–1.2 |
| `figureTranslate` | `[0, 0]` | X −15 to 15; Y −14 to 4 |
| `figureAngle` | `0` | −15° to 15° |
| `headAngle` | `0` | −20° to 20° |
| `bodyAngle` | `0` | −16° to 16° |
| `figureGap` | `0.25` | 0.12–0.42 |
| `headRadiusTop` | `1` | 0.35–1.25 |
| `headRadiusBottom` | `1` | 0.45–1.5 |
| `bodyBorderRadius` | `1` | 0.25–1 |
| `harmony` | — | `true` |

With every shape dimension (`headRadiusTop`, `headRadiusBottom`,
`bodyBorderRadius`) set to `off`, no figure shape is configured and the avatar
renders initials instead.

The generation helpers are exported too, for a consumer that needs the result
outside a component: `resolveAvatar(config, seed)` returns the resolved colors
and geometry, `avatarToSvg(resolved)` renders it, and `getInitials(name)` derives
the fallback letters.

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `badge?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | — | Corner badge, colored by tone. Pass a named tone or any literal CSS color;
 the application decides what each tone means (`success` for online,
 `critical` for busy, `neutral` for offline). Omit for no badge. |
| `generator?` | AvatarGenConfig | — | Brand generation constraints — each dimension is OFF / ANY / RANGE / LIST.
 Colors cap OKLCH ranges or pass an explicit palette. Omit for the default
 varied figure. Define one config for the app and reuse it across avatars. |
| `name?` | string | — | Person or entity name. Supplies the initials fallback (up to 3 letters from
 the first 3 words) and the accessible name, and seeds generation when `seed`
 is absent. |
| `round?` | boolean \| number \| string | — | Fully-round (circular) frame. Pass a `number` (px) or a CSS length string
 for a custom radius instead. |
| `seed?` | string | — | Alphanumeric seed that deterministically drives the generated userpic. The
 same seed always renders the same avatar. Falls back to `name` when omitted,
 so a stable user id or name is a good value. |
| `size?` | 'small' \| 'medium' \| 'large' \| number | medium | Size of the square container. A number is a pixel size. |
| `src?` | string | — | Image URL. When set, the image is shown instead of a generated userpic,
 cropped to fill the container. |

## Vanilla web component

Use the web component directly when you are not using React or Preact. The
generation config rides the `config` attribute as a JSON string, so the element
generates from plain markup with no JavaScript of your own.

```html
<a-avatar seed="user-42" name="Vlad Korobov"></a-avatar>

<a-avatar
  name="Vlad Korobov"
  config='{"headRadiusTop":{"mode":"off"},"headRadiusBottom":{"mode":"off"},"bodyBorderRadius":{"mode":"off"}}'
></a-avatar>
```

## Styling

Reach for the props first: **`size`** sets the dimensions and **`generator`** the
generated look. Everything else is `--avatar-*` custom properties on the host and
`::part()` on the shadow content.

The container is a rounded square by default; `round` makes it a circle and takes
a length for a custom radius, so reach for the prop before the custom property.
The badge is sized and placed with `--avatar-badge-ratio` (its size as a fraction
of the frame), `--avatar-badge-inset`, and `--avatar-badge-gap` (the width of the
cutout around it). Its fill comes from `badge`, so route color through the prop
rather than overriding `--avatar-badge-color`.

```css
a-avatar.badge-dot {
  --avatar-badge-ratio: 0.34;  /* a larger badge */
  --avatar-badge-gap: 4px;     /* in a wider cutout */
}
```

The shadow content exposes `::part(frame)` (the picture — the generated figure or
the image, whichever is showing), `::part(image)` (only the `src` image), and
`::part(badge)` (the corner badge) for anything the custom properties do not
cover.

## Example

```tsx
import { Avatar, type AvatarGenConfig } from '@antadesign/anta'

/**
 * @play props Generator
 * The avatar's JSON-like generation settings. Nested values become editable
 * fields in the Props panel.
 */
const generator = {
  // Every dimension takes one mode: 'off' | 'any' | 'range' | 'list'.
  bgColor: { mode: 'range', l: [0.55, 0.72], c: [0.05, 0.12], h: [0, 360] },
  headColor: { mode: 'any' },
  bodyColor: { mode: 'any' },
  // Corner radius: 0 square, 1 fully round, above 1 elongated into an oval.
  // The bottom is never rounded less than the top, so an egg leans jaw-down.
  headRadiusTop: { mode: 'range', min: 0.5, max: 1.15 },
  headRadiusBottom: { mode: 'range', min: 0.6, max: 1.35 },
  bodyBorderRadius: { mode: 'any' },
  // Space between head and body, as a fraction of head height (0 to 1).
  figureGap: { mode: 'range', min: 0, max: 0.3 },
  figureScale: { mode: 'any' },
  headAngle: { mode: 'any' },
  bodyAngle: { mode: 'any' },
  harmony: true,
} satisfies AvatarGenConfig

function Demo() {
  return (
    /** @play props Avatar */
    <Avatar
      seed="user-42"
      name="Vlad Korobov"
      size={96}
      badge="success"
      round
      generator={generator}
    />
  )
}
```
