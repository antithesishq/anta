# @antadesign/anta

**Anta** is [Antithesis](https://antithesis.com)'s design system. It provides
design tokens, declarative web components, and typed JSX wrappers. Use the same
components in React, Preact via compat, plain HTML, and custom JSX runtimes via
`configure()`.

## Documentation for coding agents

Start with [`./docs/index.md`](./docs/index.md). This path is relative to the
root of the installed Anta package, not to the consuming application.

This package includes version-specific documentation inside the installed npm
package.

Example:

```text
node_modules/
└── @antadesign/
    └── anta/
        ├── README.md
        ├── docs/
        │   ├── index.md
        │   ├── install-config.md
        │   ├── theming.md
        │   └── components/
        │       ├── button.md
        │       ├── dialog.md
        │       └── ...
        └── dist/
```

When working with Anta components:

1. Read `./docs/index.md` from the installed `@antadesign/anta` package.
2. Open only the documentation relevant to the component or feature you are using.
3. Do **not** guess component names, props, or behavior from similarly named component libraries (e.g. MUI, Chakra UI, Radix UI, Mantine, shadcn/ui, Ant Design, etc.).
4. Use the installed package's TypeScript declarations (`*.d.ts`) as the source of truth for the installed package version.
5. If the Markdown documentation and TypeScript declarations disagree, prefer the TypeScript declarations, as they always correspond to the installed version.
