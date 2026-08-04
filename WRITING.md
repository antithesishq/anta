# Writing

This guide covers documentation pages, `CHANGELOG.md`, source comments, and TSDoc.
UI copy and commit messages are out of scope.

Write for an engineer who needs to understand the change and decide what to do next.
State the fact, its consequence, and stop.

## Core rules

- **Lead with the result.** Start with what changed or what the API does. Do not
  narrate the investigation, implementation, or section structure.
- **Use short, complete sentences.** Keep one main idea in each sentence. Split a
  sentence when it needs several commas, parenthetical asides, or an em dash.
- **Name concrete values and conditions.** Write `24px`, `default`, `disabled`,
  and `when the menu is open`. Replace vague words such as “appropriate”,
  “seamless”, “robust”, and “flexible” with the behaviour that supports them.
- **Keep facts in their home.** Explain an API's full contract in its docs. Keep
  the changelog to the fact that consumers need to decide whether to read those
  docs. Do not repeat a prop table in prose.
- **Prefer a small example to an abstract explanation.** Show the relevant call
  or CSS rule when it resolves ambiguity. Omit examples that merely restate the
  sentence above them.
- **Use active, plain language.** “Pass `open` to control it” is clearer than
  “Control is enabled through the `open` property.” Use contractions where they
  sound natural.
- **Use the reader's vocabulary.** Name the component, prop, value, or DOM
  relationship directly. Do not replace it with an implementation metaphor such
  as “stitched”, “piped”, “rides on”, “owns”, “glue”, or “grab”. Explain a
  specialised term before relying on it, and say when names in an example are
  application-defined rather than Anta terms.
- **Make responsibility explicit.** Say “the application filters the rows” or
  “pass a custom renderer” instead of “your code” or “bring your own”. Use
  second person for direct instructions, but do not switch between second person
  and impersonal phrasing within the same explanation.

## Sound like a person

- Do not announce the writing: avoid “In this section”, “Note that”, “It is worth
  noting”, “In short”, and “Overall”.
- Do not manufacture contrasts. Say what something does instead of framing it as
  “not X, but Y”, unless the distinction prevents a real mistake.
- Do not pad a claim with intensifiers or hedges: cut “very”, “really”, “just”,
  “actually”, “clearly”, “simply”, “generally”, “potentially”, and “may sometimes”.
- Avoid hype, sales language, and rhythm for its own sake. A list of three is not
  better than a list of two.
- Use em dashes sparingly. A period or colon is usually clearer.
- Do not turn implementation history into prose. Readers need the current
  behaviour, not the sequence of internal fixes that produced it.
- Do not compress several behaviours, exceptions, and implementation details
  into one paragraph. State the common behaviour first. Put conditions in a
  following sentence or a short list. Parentheses should clarify a brief term,
  not carry part of the contract.

## Length by surface

- **Pages (`.mdx`):** State the purpose in one or two sentences, show the common
  case, then cover only the interactions or constraints a reader can act on.
  `PropsTable` provides types and defaults; the `## Styling` disclosure
  documents the styling surface.
- **Source comments:** Explain a non-obvious reason, browser limitation, or
  ordering constraint immediately above the code. Do not describe code that is
  already readable. Most changes need no comment.
- **TSDoc:** Start with what the prop or function does. Add when to use it and a
  material interaction or pitfall. `@defaultValue` documents the default.
- **Changelog:** Use one bullet per consumer-visible change and one or two short
  sentences per bullet. Lead with the API, component, or behaviour that changed.
  Include breaking changes, migrations, new public APIs, and bug fixes that alter
  a consumer's result. Omit internal architecture, exact implementation steps,
  exhaustive prop/part/token lists, and minor visual tuning. Link readers to the
  component docs when they need the full contract.

## Editing existing text

When you touch a section, remove repetition and details that do not change a
reader's decision. Preserve compatibility notes, migration steps, defaults, and
constraints. Leave unrelated copy alone.

## Links and code

Do not wrap a link around a code pill. Write `renderIndicator` in plain code, then
link the surrounding words: `renderIndicator` (see [Custom indicators](#custom-indicators)).
