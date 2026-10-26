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
- In release notes, link mentions of changed components and new props to the
  relevant section of the component page. Link descriptive text around a prop
  name rather than the code literal. Use site-relative paths such as
  `/box/#measurements`.
- Describe the result before implementation details. Include browser constraints,
  accessibility behavior, defaults, and migration steps only when they change a
  reader's decision.
- Prefer a small, accurate example when it resolves ambiguity. Omit examples that
  only restate the preceding sentence.
- Use headings to show the document hierarchy, not to change visual appearance.
  Each page has one `h1`; do not skip heading levels or put links in headings.
- Preserve a stable heading ID when renaming a frequently linked section, or
  update every known incoming link.

## Documentation pages

Write purposeful, concise, precise, and helpful documentation that guides readers
through their choices. Start with a short introduction to the component: what
it does and where it is useful. For each feature, explain what it does, why
someone would use it, and demonstrate it.

Put precise API contracts in TSDoc and raw markup in the reference. Give
technical nuances their own sections when readers need a fuller explanation;
prefer the relevant prop's TSDoc for details specific to that API. Shared setup,
browser support, and CSP guidance live on the dedicated Install and configure
page. Keep essential accessibility instructions discoverable.

### Explain features through use

- Introduce a feature in terms of a practical task and the result someone can
  expect. Give enough guidance to help readers choose between relevant options.
  Use realistic situations and the component's actual capabilities.
- Follow the explanation with a working demonstration and matching expandable
  code. Explain what the example teaches; let the demonstration show its visual
  details and interaction states.
- Name the props needed to use the feature. Keep prose understandable without
  knowing the implementation, and use the API reference for the complete contract.
- Preserve useful sections, feature coverage, examples, and reference material.
  Improve their wording, organization, and placement. Concision comes from clear
  explanations and avoiding repetition while retaining the information readers need.

Use [Text](site/src/content/components/text/index.mdx),
[Tooltip](site/src/content/components/tooltip/index.mdx),
[Progress](site/src/content/components/progress/index.mdx), and
[Button](site/src/content/components/button/index.mdx) as editorial examples.
Follow the approach of the relevant sections rather than copying a whole page's
structure onto every component.

### Keep detail accessible

| Information | Home |
| --- | --- |
| Purpose, feature choices, common tasks, and visible results | Main page guidance beside working examples. |
| Accepted values, defaults, units, event payloads, and API-specific nuances | Source TSDoc, rendered through `PropsTable` and the API reference. |
| Detailed usage, interaction, or integration explanations | A dedicated section when a prop description is insufficient. |
| Required raw markup and authored ARIA | Web Component or raw HTML reference. |
| Supported consumer selectors and customization recipes | Styling disclosure, with working previews and matching code. |
| Shared imports, renderer setup, browser support, and CSP | Install and configure; link to the relevant section. |

Keep numbers when they help readers choose or configure behavior. Place exact
visual measurements, timing defaults, and token mappings in the appropriate
reference when they are needed. Keep TSDoc focused on the caller's contract;
implementation notes belong with the source or development documentation.

Explain required labels, keyboard access, focus behavior, and material limitations
where readers need them to use an example correctly. Link to detailed guidance
without hiding essential instructions. A component-specific setup or CSP exception
may need a brief, actionable note beside its example and a link to the shared page.

### Reusable content-writing prompt

Use this instruction when writing or improving documentation. Replace the page
list with the requested scope:

```text
Write or improve Anta documentation for [pages or components].

Follow AGENTS.md, site/AGENTS.md, src/AGENTS.md, and WRITING.md. Use Text,
Tooltip, Progress, and Button as editorial examples. Verify explanations and
examples against the component source and TSDoc.

Write purposeful, concise, precise, helpful prose with a little guidance.
Start with a short introduction to the component in general. For each feature,
explain what it does, why someone would use it, and demonstrate it with a
working example and matching expandable code. Help readers choose appropriate
features and understand the result they can expect.

Preserve useful structure, feature coverage, demonstrations, and details.
Improve wording and organization rather than merely shortening the page.
Put precise API contracts and prop-specific nuances in TSDoc. Give broader
technical explanations their own sections where useful, and keep raw markup
in the reference. Shared setup, browser support, and CSP guidance belong on
Install and configure; link to that dedicated page.

Keep essential accessibility instructions, meaningful behavior differences,
and material limitations discoverable. Retain numbers when they help readers
act. Preserve anchors and keep previews and expandable code in sync. Maintain
accurate API descriptions and defaults, and do not invent behavior or change
the public API as part of a writing task.
```

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

### Human review markers

An MDX page has `author: Name` in its frontmatter only after a human has
reviewed the whole page. A standalone Astro page passes `author="Name"` to
`DocsLayout` after the same review. A TSDoc comment has `@author Name` only
after a human has reviewed that whole comment, including its examples and
tags. Without the marker, the documentation site shows a page warning. TypeDoc
shows a warning on documented declarations; declarations without TSDoc have no
review marker.

For an interface or type alias, one `@author` on the type covers the fields
declared inside it. Review the full declaration, including every field comment,
before adding that marker. It does not cover inherited fields or comments on
other declarations. `pnpm docs-review <source-file> <type-name>` shows the whole
declaration and can add a top-level comment when the type has none. Editing a
field later makes the parent marker stale; `pnpm docs-fix` removes it unless a
human reviews the updated declaration again.

Do not add or preserve a human author marker when generating or changing
documentation with an agent. Run `pnpm docs-fix` to inspect and remove stale
markers that already existed at the branch point with `main` when their
documentation has changed. The command shows its proposed removals and asks
before editing; `pnpm docs-fix --check` never edits files. The `/docs-fix` PR
comment runs the same removal in a bot commit. With the default comparison,
neither command removes author markers first added on the current branch;
remove those manually if they have not been reviewed.
Human review and author attribution happen after the final text is ready.
The human runs `pnpm docs-review <source-file> <declaration>` for TSDoc or
`pnpm docs-review <page.mdx>` for a page. The command proposes the name from
`git config user.name`, shows the review unit, and requires an interactive
`REVIEWED` confirmation before adding the marker. Use `--author <name>` when
the Git name is not the desired public attribution. Agents may inspect with
`--dry-run` but must not confirm review on a human's behalf.
CI compares each PR with its base commit. New author markers and edits that
retain an existing author require the `review-docs` PR label; without it, the
`docs-review` job fails. With the label, that job lists every affected
TSDoc comment and authored page in the Actions summary and annotates its source
line. The job log and summary show the full TSDoc text; for authored pages they
point to the PR diff for review. The job does not edit files or verify that a
human read them. The label asks the reviewer to
inspect those sections and the PR diff before approval.

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
  Consolidate overlapping Unreleased entries before adding another. Group long
  Fixed sections by component, record each behavior once, and put shared migration
  guidance in one entry instead of repeating compatibility notes for each component.

## Editing existing text

When you touch a section, remove repetition and details that do not change a
reader's decision. Preserve compatibility notes, migration steps, defaults,
constraints, and link targets. Leave unrelated copy alone.

Before finishing, check that the text names the right API, uses `color` spelling,
states conditions before instructions, and remains understandable without a
mouse, color, or a particular page layout.
