# Writing

One voice for everything we document: pages under `site/`, the changelog, comments in
source, and TSDoc on props and params. UI copy and commit messages are out of scope.

Write like an engineer explaining the code to another engineer who is new to it.
State what a thing does and the values it uses, then stop. The reader doesn't need
adjectives to know a fact matters.

## Say it once, concretely

- **Open with the point.** The first sentence says what the thing does. Skip the
  runway ("In this section…", "Let's look at…").
- **One idea per sentence.** A sentence carrying two asides is two sentences.
- **Give the value, not an adjective for it.** Write "24px tall", "defaults to 250ms",
  "caps at 240px". "exactly", "precisely", and "a sensible" add nothing the number
  hasn't said.
- **Skip the props table.** Types and defaults render from `@defaultValue` in
  `PropsTable`. Prose covers what a table can't: when to reach for a prop, what it
  interacts with, where it bites.
- **Show over describe.** A three-line code block beats a paragraph about the code.
- **Each fact once**, in the section it belongs to. Link to it from elsewhere.
- **Present tense, active voice, second person, contractions.** "Pass `open` to
  control it."

## Cut the AI tells

- **The "not X, but Y" frame.** Naming a thing by what it isn't reads as padding.
  Name what it is.
  - `It styles the rows, not the field.` → `It styles the rows.`
  - `This isn't a wrapper, it's the coordinator.` → `The wrapper is the coordinator.`
  - Keep a contrast only where the reader would otherwise get it wrong, and state it
    once.
- **Em dashes are rare.** One per page, often zero. A comma, colon, period, or
  parentheses covers nearly every use. A sentence with two dashes holds two
  sentences; split it.
  - `The trigger sets the floor — the viewport, the ceiling — so content grows the menu.`
    → `The trigger sets the floor, the viewport the ceiling. Content grows the menu
    between them.`
- **No empty intensifiers or stacked hedges.** Cut "very", "really", "truly",
  "simply", "just", "actually", "clearly", "of course", "seamlessly". Cut "could
  potentially" and "may sometimes" down to one word or none.
- **No hype or buzzwords.** Drop "powerful", "robust", "flexible", "rich", "elegant",
  "comprehensive". Plain verbs: "use" for "leverage"/"utilize", "let" for "enable",
  "so" for "in order to".
- **No signposts or wrap-ups.** Drop "It's worth noting", "Note that", "Keep in
  mind". Don't close a section with "In short" or "Overall". Start and end on
  substance.
- **No forced triads.** Use two items or four, whatever the facts need. Three
  parallel clauses for rhythm is a tell.
- **Vary sentence length.** A run of same-length clauses joined by dashes reads
  generated.

## Links and code

- **Don't wrap a link around a code pill.** `` [`renderIndicator`](#custom-indicators) ``
  renders as an underlined identifier that reads like a broken pill. Keep the pill in
  plain text and link the surrounding words: `` `renderIndicator` (see [Custom
  indicators](#custom-indicators)) ``.

## Length by surface

Same voice everywhere; the length changes.

- **Pages (`.mdx`):** one or two sentences, then a code block, then the caveats.
  `PropsTable` and the `## Styling` disclosure hold the reference detail (see
  `site/CLAUDE.md`).
- **Source comments:** the why, one line above the code. The code shows the what.
  Shadow `<style>` strings stay comment-free; put the reason in a TS comment above
  the string.
- **TSDoc on props/params:** first sentence says what it does. Then when to reach for
  it, gotchas, interactions. `@defaultValue` owns the default; don't repeat it or the
  type in prose. A few sentences.
- **Changelog (`CHANGELOG.md`):** one or two sentences per entry, lead with what
  changed. A new component gets its headline — what it is and the one capability that
  matters — not a tour of every prop, position, and part; the docs page holds that.
  A new prop: name it and what it does, skip the edge cases. When an entry runs to
  five clauses, cut to the one a consumer needs to decide "does this affect me".
  Long enumerations of props, positions, or parts belong on the page, not here.

## Editing existing docs

Most pages predate this guide and read denser, with more dashes and more contrast
framing. Bring a section into this voice when you edit it. Leave untouched sections
alone.
