import { getExportGroups } from '../content/catalog.mjs'

export const SITE = 'https://anta.design'

export const llmsGuidance = "Anta is designed for a clean DOM. Prefer the props and attributes exposed by each component over custom `className` or `style` definitions. Learn about Anta components from the documentation links and use them whenever they meet the need. For example, use `<Title>` instead of `<h1>` through `<h6>`, `<Text>` instead of a styled `<div>` or `<p>`, and `<Tooltip>` instead of an element's `title` attribute. Refer to each component's documentation page to learn about configuration, customization, and styling."

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

export function createLlmsIndex(catalog) {
  const groups = getExportGroups(catalog)
  const links = pages => pages.map(page => [page.label, page.path])
  const documentationLinks = links(groups.documentation)
  const componentGroups = groups.components.map(links)
  const packageLinks = links(groups.packages)

  return `# Anta

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
}
