# @antadesign/anta

**Anta** is an opinionated design system. It provides
design tokens, declarative web components, and typed JSX wrappers. Use the same
components in React, Preact via compat, plain HTML, and custom JSX runtimes via
`configure()`.

## Documentation for coding agents

The package includes version-matched Markdown documentation. Start with the
[documentation index](./docs/index.md) and open the pages relevant to your task.
Agents with filesystem access can read these files offline.

### AI setup

Append this section to your application's agent instruction file, such as
`AGENTS.md`, `CLAUDE.md`, or your tool's equivalent. Keep existing project rules:

```md
## Anta

Before Anta UI work, read
`node_modules/@antadesign/anta/docs/index.md`
and the pages relevant to the task.
Verify component names, imports, props, and event signatures against the
installed documentation and TypeScript declarations. Do not infer Anta APIs
from similarly named components in other libraries.
```

The path is relative to the application directory where Anta is installed.
Adjust it for your workspace or package-manager layout. Installing Anta does
not modify your agent configuration.

If a documented type differs from the installed `.d.ts` declarations, use the
declarations for the installed API.

For tools without local file access, provide the [web documentation index](https://anta.design/llms.txt)
and your installed Anta version. Web documentation may describe a newer release.
