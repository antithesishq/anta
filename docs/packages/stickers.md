# Stickers

Square illustrated stickers in two flavors per name — a lightweight
static SVG and a Lottie-driven animated version. Stickers ship in their
own package, `@antadesign/stickers` (a companion to `@antadesign/anta`,
kept separate so apps that don't use stickers never install
`lottie-web`). Each one is its own named export, so the consumer's
bundler ships only the stickers actually used. The static variant is
the default; reach for the animated one explicitly when you want
motion.

```sh
npm install @antadesign/stickers   # pulls @antadesign/anta + lottie-web
```

> Both flavors are JSX wrappers over two custom elements,
> `<a-sticker>` and `<a-sticker-animated>`, registered by
> `@antadesign/stickers/elements`. Plain HTML/JS consumers can drive the
> elements directly via `setAttribute` instead of using the JSX
> wrappers — see *Non-React consumers* below.

The full set is also published as a [Telegram sticker pack](https://t.me/addstickers/SnoutyAntithesis).

## Available stickers

| Name | Static export | Animated export | Asset imports |
| --- | --- | --- | --- |
| Angry | `StickerAngry` | `StickerAngryAnimated` | `@antadesign/stickers/angry`, `@antadesign/stickers/angry-animated` |
| Ask | `StickerAsk` | `StickerAskAnimated` | `@antadesign/stickers/ask`, `@antadesign/stickers/ask-animated` |
| Balance | `StickerBalance` | `StickerBalanceAnimated` | `@antadesign/stickers/balance`, `@antadesign/stickers/balance-animated` |
| Butterfly | `StickerButterfly` | `StickerButterflyAnimated` | `@antadesign/stickers/butterfly`, `@antadesign/stickers/butterfly-animated` |
| ButterflySnake | `StickerButterflySnake` | `StickerButterflySnakeAnimated` | `@antadesign/stickers/butterfly-snake`, `@antadesign/stickers/butterfly-snake-animated` |
| Catch | `StickerCatch` | `StickerCatchAnimated` | `@antadesign/stickers/catch`, `@antadesign/stickers/catch-animated` |
| Clap | `StickerClap` | `StickerClapAnimated` | `@antadesign/stickers/clap`, `@antadesign/stickers/clap-animated` |
| Coding | `StickerCoding` | `StickerCodingAnimated` | `@antadesign/stickers/coding`, `@antadesign/stickers/coding-animated` |
| Cowboy | `StickerCowboy` | `StickerCowboyAnimated` | `@antadesign/stickers/cowboy`, `@antadesign/stickers/cowboy-animated` |
| Dance | `StickerDance` | `StickerDanceAnimated` | `@antadesign/stickers/dance`, `@antadesign/stickers/dance-animated` |
| Detective | `StickerDetective` | `StickerDetectiveAnimated` | `@antadesign/stickers/detective`, `@antadesign/stickers/detective-animated` |
| Disapprove | `StickerDisapprove` | `StickerDisapproveAnimated` | `@antadesign/stickers/disapprove`, `@antadesign/stickers/disapprove-animated` |
| Distracted | `StickerDistracted` | `StickerDistractedAnimated` | `@antadesign/stickers/distracted`, `@antadesign/stickers/distracted-animated` |
| Dive | `StickerDive` | `StickerDiveAnimated` | `@antadesign/stickers/dive`, `@antadesign/stickers/dive-animated` |
| Eat | `StickerEat` | `StickerEatAnimated` | `@antadesign/stickers/eat`, `@antadesign/stickers/eat-animated` |
| Facepalm | `StickerFacepalm` | `StickerFacepalmAnimated` | `@antadesign/stickers/facepalm`, `@antadesign/stickers/facepalm-animated` |
| Failed | `StickerFailed` | `StickerFailedAnimated` | `@antadesign/stickers/failed`, `@antadesign/stickers/failed-animated` |
| Found | `StickerFound` | `StickerFoundAnimated` | `@antadesign/stickers/found`, `@antadesign/stickers/found-animated` |
| Grow | `StickerGrow` | `StickerGrowAnimated` | `@antadesign/stickers/grow`, `@antadesign/stickers/grow-animated` |
| Handstand | `StickerHandstand` | `StickerHandstandAnimated` | `@antadesign/stickers/handstand`, `@antadesign/stickers/handstand-animated` |
| Heart | `StickerHeart` | `StickerHeartAnimated` | `@antadesign/stickers/heart`, `@antadesign/stickers/heart-animated` |
| Hello | `StickerHello` | `StickerHelloAnimated` | `@antadesign/stickers/hello`, `@antadesign/stickers/hello-animated` |
| Idea | `StickerIdea` | `StickerIdeaAnimated` | `@antadesign/stickers/idea`, `@antadesign/stickers/idea-animated` |
| Laugh | `StickerLaugh` | `StickerLaughAnimated` | `@antadesign/stickers/laugh`, `@antadesign/stickers/laugh-animated` |
| Love | `StickerLove` | `StickerLoveAnimated` | `@antadesign/stickers/love`, `@antadesign/stickers/love-animated` |
| Nap | `StickerNap` | `StickerNapAnimated` | `@antadesign/stickers/nap`, `@antadesign/stickers/nap-animated` |
| Party | `StickerParty` | `StickerPartyAnimated` | `@antadesign/stickers/party`, `@antadesign/stickers/party-animated` |
| Passed | `StickerPassed` | `StickerPassedAnimated` | `@antadesign/stickers/passed`, `@antadesign/stickers/passed-animated` |
| Peekaboo | `StickerPeekaboo` | `StickerPeekabooAnimated` | `@antadesign/stickers/peekaboo`, `@antadesign/stickers/peekaboo-animated` |
| Pizza | `StickerPizza` | `StickerPizzaAnimated` | `@antadesign/stickers/pizza`, `@antadesign/stickers/pizza-animated` |
| Puzzle | `StickerPuzzle` | `StickerPuzzleAnimated` | `@antadesign/stickers/puzzle`, `@antadesign/stickers/puzzle-animated` |
| Sad | `StickerSad` | `StickerSadAnimated` | `@antadesign/stickers/sad`, `@antadesign/stickers/sad-animated` |
| Scared | `StickerScared` | `StickerScaredAnimated` | `@antadesign/stickers/scared`, `@antadesign/stickers/scared-animated` |
| Scroll | `StickerScroll` | `StickerScrollAnimated` | `@antadesign/stickers/scroll`, `@antadesign/stickers/scroll-animated` |
| Search | `StickerSearch` | `StickerSearchAnimated` | `@antadesign/stickers/search`, `@antadesign/stickers/search-animated` |
| Shield | `StickerShield` | `StickerShieldAnimated` | `@antadesign/stickers/shield`, `@antadesign/stickers/shield-animated` |
| Shocked | `StickerShocked` | `StickerShockedAnimated` | `@antadesign/stickers/shocked`, `@antadesign/stickers/shocked-animated` |
| Sleep | `StickerSleep` | `StickerSleepAnimated` | `@antadesign/stickers/sleep`, `@antadesign/stickers/sleep-animated` |
| Stressed | `StickerStressed` | `StickerStressedAnimated` | `@antadesign/stickers/stressed`, `@antadesign/stickers/stressed-animated` |
| Suspicious | `StickerSuspicious` | `StickerSuspiciousAnimated` | `@antadesign/stickers/suspicious`, `@antadesign/stickers/suspicious-animated` |
| Thanks | `StickerThanks` | `StickerThanksAnimated` | `@antadesign/stickers/thanks`, `@antadesign/stickers/thanks-animated` |
| Think | `StickerThink` | `StickerThinkAnimated` | `@antadesign/stickers/think`, `@antadesign/stickers/think-animated` |
| ThinkOfYou | `StickerThinkOfYou` | `StickerThinkOfYouAnimated` | `@antadesign/stickers/think-of-you`, `@antadesign/stickers/think-of-you-animated` |
| ThumbsUp | `StickerThumbsUp` | `StickerThumbsUpAnimated` | `@antadesign/stickers/thumbs-up`, `@antadesign/stickers/thumbs-up-animated` |
| Vacation | `StickerVacation` | `StickerVacationAnimated` | `@antadesign/stickers/vacation`, `@antadesign/stickers/vacation-animated` |
| Wait | `StickerWait` | `StickerWaitAnimated` | `@antadesign/stickers/wait`, `@antadesign/stickers/wait-animated` |
| Wink | `StickerWink` | `StickerWinkAnimated` | `@antadesign/stickers/wink`, `@antadesign/stickers/wink-animated` |
| Work | `StickerWork` | `StickerWorkAnimated` | `@antadesign/stickers/work`, `@antadesign/stickers/work-animated` |
| Zen | `StickerZen` | `StickerZenAnimated` | `@antadesign/stickers/zen`, `@antadesign/stickers/zen-animated` |

## Props

Both flavors share the same base props; the animated flavor adds playback props.

### `Sticker{Name}` (static)

| Prop | Type | Description |
|---|---|---|
| `size?` | `number` | Edge length in pixels. Stickers are always square. Defaults to `256`. |
| `label?` | `string` | Accessible name. When set, the sticker is exposed as `role="img"` + `aria-label`. Omitted ⇒ `aria-hidden="true"` (decorative). |

Inherited props (`className`, `style`).

### `Sticker{Name}Animated` (Lottie)

Same as the static base, plus:

| Prop | Type | Description |
|---|---|---|
| `paused?` | `boolean \| number` | `true` freezes at the current frame; a number freezes at that time in seconds. Omit (or pass `false`) to play. |
| `delay?` | `number` | Seconds to wait at the first frame before playing. |
| `playOnce?` | `boolean` | Plays once and holds the final frame instead of looping. |
| `replayOnClick?` | `boolean` | With `playOnce`, lets people click or press Enter/Space to replay the animation. The sticker becomes a labeled button. |

## Web Component

Use the web component directly when you are not using React or Preact and a native control does not fit.

Pass the generated SVG payload to `<a-sticker>` and set a size through
`--sticker-size`. The animated element takes its generated Lottie JSON through
`animation` instead.

```html
<a-sticker
  role="img"
  aria-label="Purple circle"
  svg='<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 16 16"><circle cx="8" cy="8" r="7" fill="currentColor"/></svg>'
  style="--sticker-size: 96px; color: var(--text-1-brand)"
></a-sticker>
```

## Sizing

Pass `size` (a number, in pixels) to control width and height together.
Default is `256`. Stickers are always square.

```tsx
<StickerVacation />                    // 256×256
<StickerVacation size={128} />         // 128×128
<StickerVacationAnimated size={64} />  // 64×64
```

Internally, `size` is applied as the `--sticker-size` CSS custom
property on the rendered `<a-sticker>` / `<a-sticker-animated>`. The
base CSS rule reads it as
`width: var(--sticker-size, 256px); height: var(--sticker-size, 256px)`.
That means consumer CSS (or a parent's variable cascade) can drive
sticker size too:

```css
.sticker-grid { --sticker-size: 96px; }
```

## Animation control

`paused`, `delay`, `playOnce`, and `replayOnClick` only apply to
`Sticker{Name}Animated`.
They map to observed element attributes:

```tsx
<StickerCodingAnimated />                  // autoplay, looping
<StickerCodingAnimated paused />           // freeze at the current frame
<StickerCodingAnimated paused={1.5} />     // freeze at 1.5 seconds
<StickerCodingAnimated paused={false} />   // explicitly play (same as omitted)
<StickerCodingAnimated delay={0.5} />      // wait half a second, then play
<StickerCodingAnimated playOnce />         // play once, then hold the final frame
<StickerCodingAnimated playOnce replayOnClick label="Replay coding sticker" />
```

## Adding your own stickers

`@antadesign/stickers` ships a generator script at
`@antadesign/stickers/generate-stickers.mjs`. Drop your sources in a
folder structured the same way as the built-in set — one subfolder per
sticker, with a `<name>.json` (Lottie) and/or `<name>.svg` (static
pose):

```
my-stickers/
  happy/
    happy.json
    happy.svg
  sad/
    sad.json
```

Then point the generator at it:

```sh
node ./node_modules/@antadesign/stickers/dist/generate-stickers.mjs \
  --input ./my-stickers \
  --output ./src/my-generated-stickers
```

The emitted modules import their `Sticker` / `StickerAnimated` runtime
wrappers from `@antadesign/stickers` by default; pass `--package <name>`
to point them at a different specifier (e.g. your own re-export).

Out comes one `<name>.ts` per static sticker and one `<name>-animated.ts`
per animated sticker, plus an `index.ts` barrel. Import and use:

```ts
import { StickerHappy, StickerSadAnimated } from './my-generated-stickers'

<StickerHappy size={96} />
<StickerSadAnimated paused={1.5} />
```

### Source conventions

- Animated stickers are `<name>.json` Lottie payloads.
- Either file is optional — supply just the SVG for a static-only
  sticker, just the JSON for an animated-only one, or both.

### Conflicting names

If a generated sticker has the same name as one of the pack's built-ins
(e.g. `vacation`), the generator prints a warning. The built-in sticker
imported from `@antadesign/stickers` is unaffected — your generated
barrel exposes yours under your own import path.

## Non-React consumers

The custom elements `<a-sticker>` and `<a-sticker-animated>` are
framework-agnostic. Each generated module exports the raw payload
(`svg` string for static, `animationJson` string for animated)
alongside the JSX component, so non-React consumers can pull just the
data and drive the elements directly:

```js
import { svg } from '@antadesign/stickers/vacation'
import { animationJson } from '@antadesign/stickers/vacation-animated'

const still = document.createElement('a-sticker')
still.setAttribute('svg', svg)
still.style.setProperty('--sticker-size', '128px')
document.body.appendChild(still)

const movie = document.createElement('a-sticker-animated')
movie.setAttribute('animation', animationJson)
document.body.appendChild(movie)
```

The static element renders the SVG into its own shadow DOM; the
animated element drives a shadow-DOM `<svg>` via `lottie-web`. Both
consume their payload through the `svg` / `animation` HTML attribute —
the JSX wrapper passes the same data, just through React/Preact's
prop layer.

## SSR

`@antadesign/stickers/elements` references browser APIs (`HTMLElement`,
`customElements`, `lottie-web`). In SSR contexts (Astro, Next.js) gate
the import behind a client boundary — same rule as anta's own elements.
The sticker components themselves render fine on the server (just JSX);
only the underlying custom-element classes need the browser.
