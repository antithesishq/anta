export const SITE = 'https://anta.design'

export const llmsGuidance = "Anta is designed for a clean DOM. Prefer the props and attributes exposed by each component over custom `className` or `style` definitions. Learn about Anta components from the documentation links and use them whenever they meet the need. For example, use `<Title>` instead of `<h1>` through `<h6>`, `<Text>` instead of a styled `<div>` or `<p>`, and `<Tooltip>` instead of an element's `title` attribute. Refer to each component's documentation page to learn about configuration, customization, and styling."

export const documentationLinks = [
  ['Overview', '/'],
  ['Comparison', '/comparison/'],
  ['Install and configure', '/install/'],
  ['Normalization', '/normalization/'],
  ['Colors', '/colors/'],
  ['Theming', '/theming/'],
  ['Accessibility', '/accessibility/'],
  ['Credits', '/credits/'],
  ['Changelog', '/changelog/'],
]

export const componentGroups = [
  [
    ['Title', '/title/'],
    ['Text', '/text/'],
    ['Tag', '/tag/'],
    ['Tooltip', '/tooltip/'],
    ['Icon', '/icon/'],
    ['Loader', '/loader/'],
    ['Progress', '/progress/'],
  ],
  [
    ['Button', '/button/'],
    ['Checkbox', '/checkbox/'],
    ['Radio', '/radio/'],
    ['Switch', '/switch/'],
    ['Slider', '/slider/'],
    ['Tabs', '/tabs/'],
    ['Steps', '/steps/'],
  ],
  [['Expander', '/expander/'], ['Menu', '/menu/']],
  [
    ['Input', '/input/'],
    ['InputAutocomplete', '/input-autocomplete/'],
    ['InputDate', '/input-date/'],
    ['InputTime', '/input-time/'],
    ['Select', '/select/'],
    ['SelectFaceted', '/select-faceted/'],
  ],
  [['Banner', '/banner/'], ['Card', '/card/'], ['Dialog', '/dialog/'], ['Toaster', '/toaster/']],
]

export const packageLinks = [['Table', '/table/'], ['Stickers', '/stickers/']]

export const overview = `# Overview

Anta is an opinionated design system. It combines global CSS tokens,
framework-agnostic declarative web components, and JSX wrappers for dynamic
state and conditional composition.

Components use an attribute-driven DOM instead of utility-class stacks and
wrapper elements. Web components never mutate their own attributes, so they
work with Worker-driven UIs and other reactive renderers. JSX wrappers provide
the React and Preact integration layer.`

function renderLinks(links) {
  return links.map(([title, path]) => `- [${title}](${SITE}${path})`).join('\n')
}

export const llmsIndex = `# Anta

> Anta is an opinionated design system for building product interfaces. It provides
> design tokens, declarative web components, and typed JSX wrappers. Use the same
> components in React, Preact via compat, plain HTML, and custom JSX runtimes via \`configure()\`.
> Published as \`@antadesign/anta\` on npm.

${llmsGuidance}

## Documentation

${renderLinks(documentationLinks)}

## Components

${componentGroups.map(renderLinks).join('\n\n')}

## Packages

${renderLinks(packageLinks)}
`
