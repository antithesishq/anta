# Writing

This guide covers package and site documentation, `README.md`, `CHANGELOG.md`,
source comments, and TSDoc. It defines how Anta documents a frontend UI library
and design system.

Application UI copy and commit messages are out of scope. This guide does cover
how to document UI labels, controls, states, and interactions.

Write for an engineer who needs to understand a component or change and decide
what to do next. State the fact, its consequence, and stop.

## Scope and precedence

- Use this guide for prose and examples. Follow the closest `AGENTS.md` for
  architecture, API, CSS, and page-structure rules.
- Keep product terminology consistent. If a new term needs a special spelling or
  treatment, add a rule here instead of relying on an external style guide.
- Prefer clarity over a mechanical rule. When an exception improves a reader's
  understanding, make it consistent within the page or feature.

## Audience and voice

- Write for frontend engineers. Name the component, prop, token, DOM
  relationship, browser behavior, or application responsibility directly.
- Write in active voice. Say “Pass `open` to control the menu” instead of “Menu
  control is enabled through the `open` property.”
- Address the reader as “you” for instructions. Name the application when it
  performs work: “The application filters the rows.” Do not alternate between
  “you,” “we,” and an unnamed actor in the same explanation.
- Write short, complete sentences with one main idea. Put a condition before the
  instruction it qualifies: “When the menu is open, press Escape to close it.”
- Sound informed and human, not promotional. Avoid hype, filler, slang, cultural
  references, and figurative implementation language such as “glue,” “stitch,”
  or “pipe.”
- Use contractions when they make a sentence read naturally. Avoid contractions
  when they make a technical instruction harder to scan or translate.
- Do not pre-announce the writing. Cut phrases such as “In this section,” “Note
  that,” “It is worth noting,” “In short,” and “Overall.”
- Do not manufacture contrasts. State what a component does unless distinguishing
  it from another behavior prevents a real mistake.
- Cut intensifiers and vague claims, including “very,” “really,” “just,”
  “actually,” “clearly,” “simply,” “seamless,” “robust,” and “flexible.” Replace
  them with a concrete behavior, value, or condition.

## Language and terminology

- Use US English. Write `color`, `behavior`, `customize`, `center`, and
  `capitalize`. Preserve a different spelling only in a literal code value,
  product name, quotation, or compatibility term.
- Use sentence case for document titles, navigation labels, and headings. Start
  task headings with a verb, such as “Style the indicator.” Use a concise noun
  phrase for concepts, such as “Keyboard interaction.”
- Use a serial comma in prose.
- Write “and,” not `&`, in prose, headings, navigation, and tables. Keep `&`
  only when it is part of a literal UI label, product name, or code.
- Use the established component and API names exactly. Do not invent a synonym
  for a component, prop, slot, part, token, or element.
- Define an uncommon abbreviation on first use. Avoid abbreviations in headings
  unless readers know the shortened form better than the expansion.

## Documentation structure

- Start a page or section with the purpose or result. Explain the common path
  before exceptions and edge cases.
- Keep facts in their home. Explain an API's contract in its component docs;
  keep the changelog to the consumer decision that changed. Do not repeat a prop
  table in prose.
- Describe the result before implementation details. Include browser constraints,
  accessibility behavior, defaults, and migration steps only when they change a
  reader's decision.
- Prefer a small, accurate example when it resolves ambiguity. Omit examples that
  only restate the preceding sentence.
- Use headings to show the document hierarchy, not to change visual appearance.
  Each page has one `h1`; do not skip heading levels or put links in headings.
- Preserve a stable heading ID when renaming a frequently linked section, or
  update every known incoming link.

## Components, APIs, and UI interactions

- Describe a component in terms of what the application can render, configure,
  or observe. Do not lead with the implementation history.
- Name a prop, attribute, CSS custom property, part, slot, tag, selector, file,
  command, or literal value in code font: `tone`, `a-menu`, `::part(content)`,
  `--button-tone-source`.
- State the default, accepted values, controlled or uncontrolled behavior, and
  material interaction rules where they affect use. `PropsTable` provides the
  complete type and default reference for component pages.
- Use the actual visible UI label in bold: select **Save**, open **Settings**.
  Use code font for a component or API name, not bold: pass `disabled` to
  `Button`.
- Describe an action by its result, not an assumed pointer gesture. Prefer
  “select **Save**” to “click the button.” Use “enter” for text fields, “select”
  for choices and buttons, and “press” for keyboard keys.
- Refer to a UI control by its label or accessible name. Do not rely on its color,
  shape, position, or an icon alone. If a control has no visible label, document
  the accessible name or provide a screenshot when discovery is the problem.
- Avoid spatial directions such as “above,” “below,” “on the right,” and “the
  blue button.” Use a label, heading, preceding step, or semantic relationship.
- Document keyboard behavior and focus movement when it is part of a component's
  public interaction model. Do not present pointer interaction as the only path.

## Accessibility and global readability

- Use plain, literal language that works for readers with varied English fluency.
  Avoid idioms, humor that carries meaning, metaphors, and culture-specific
  references.
- Make meaning available without color, position, animation, sound, or
  punctuation. Name the state or outcome in text as well.
- Write descriptive link text that tells readers where the link goes or what it
  does. Avoid “here,” “this,” and a bare URL as the link text.
- Give meaningful images and diagrams concise alternative text. Decorative
  images need no explanatory prose. Explain information in surrounding text when
  the image alone cannot carry it.
- Use semantic Markdown and HTML. Do not add visual formatting only for emphasis
  when the words or a semantic element can carry the meaning.

## Formatting, links, and lists

- Use bold only for literal UI labels and short run-in labels. Use italics
  sparingly for a word discussed as a word or for a title that needs that
  treatment. Do not use underlining for emphasis.
- Use inline code for literal code and computer input or output. Do not put
  product names, prose concepts, or URLs in code font just because they are
  technical.
- Link descriptive surrounding text, not a code pill. Write `renderIndicator`
  (see [Custom indicators](#custom-indicators)), not a link around
  `renderIndicator`.
- Use a numbered list only when sequence matters. Use a bulleted list for an
  unordered set and a table when readers need to compare the same fields across
  several items. Keep list items parallel.
- End a complete-sentence list item with a period. Do not add a period to a
  single word, a code literal, a document title, or a link by itself.
- Introduce a list or example with a complete sentence when readers need context.
  Do not create a list with one item.
- Use a period or colon instead of an em dash when either makes the relationship
  clearer. Avoid semicolons unless the sentence genuinely needs them.

## Code, CSS, HTML, and JSX examples

- Make every example minimal, accurate, and consistent with the repository's
  current API and code style. Show only the imports, setup, and markup needed to
  teach the point.
- Introduce an example with the outcome it demonstrates. Use a colon when the
  code immediately follows; otherwise end the introduction with a period.
- Use the language's comment syntax to mark omitted code. Do not use `...` or
  `…` as a substitute for real code.
- Use code font for values readers must type, copy, or recognize. Explain
  application-defined names when they might look like Anta API.
- Use semantic HTML in documentation examples. For a design-system component,
  show Anta's component when one exists; use native HTML only when the native
  element is the subject or Anta has no equivalent.
- For CSS examples, show the consumer-owned selector and the supported public
  styling surface. Do not teach readers to override internal output tokens.
- Keep code samples accessible: include visible labels or accessible names, do
  not encode a state in color alone, and show keyboard-relevant behavior when it
  changes the example's use.

## Rules by surface

- **Pages (`.mdx`):** State the purpose in one or two sentences, show the common
  case, then cover interactions and constraints a reader can act on. Component
  pages use `PropsTable` for types and defaults and a `## Styling` disclosure
  for the documented styling surface.
- **README files:** Lead with what the package provides, its runtime or framework
  requirements, and the smallest useful installation or import example.
- **Source comments:** Explain a non-obvious reason, browser limitation, or
  ordering constraint immediately above the code. Do not narrate readable code.
  Most changes need no comment.
- **TSDoc:** Start with what the prop, type, or function does. Add when to use it
  and a material interaction or pitfall. Use `@defaultValue` for the default.
- **Changelog:** Use one bullet per consumer-visible change and one or two short
  sentences per bullet. Lead with the API, component, or behavior that changed.
  Include breaking changes, migrations, public APIs, and behavior-changing fixes.
  Omit internal architecture, exact implementation steps, exhaustive
  prop/part/token lists, and minor visual tuning.

## Editing existing text

When you touch a section, remove repetition and details that do not change a
reader's decision. Preserve compatibility notes, migration steps, defaults,
constraints, and link targets. Leave unrelated copy alone.

Before finishing, check that the text names the right API, uses `color` spelling,
states conditions before instructions, and remains understandable without a
mouse, color, or a particular page layout.
