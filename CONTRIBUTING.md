# Contributing to Anta

Contributions are currently limited to project maintainers. The public repository
provides source and documentation for consumers of `@antadesign/anta`.
If you are outside the maintainer group, open an issue for a bug or question.

## Maintainer workflow

1. Read [AGENTS.md](AGENTS.md), the closest scoped guide, and
   [WRITING.md](WRITING.md) before editing. Use the repository's SSH URL to clone.
2. Create a descriptive branch from `main`. Keep changes off `main` and submit
   them through a pull request.
3. Use `pnpm run dev` from the repository root for development. It rebuilds the
   workspace packages and serves the documentation site. See
   [local servers](site/AGENTS.md#local-servers) for preview commands.
4. Run the checks relevant to your changes. Package changes usually need a build,
   lint, type checking, and affected regression suites. Run the complete set for
   broad changes. See [verification](AGENTS.md#verification) and the
   [test guide](tests/README.md) for commands. `dist/` is generated and ignored
   by Git. Package builds regenerate it.
5. Open a pull request against `main`. Explain the problem, resulting behavior,
   and validation. Include limitations that affect review.
6. Request review from Vlad Korobov ([@terpimost](https://github.com/terpimost)),
   as specified in [CODEOWNERS](.github/CODEOWNERS). Do not merge without his
   explicit approval.
7. Wait for required CI checks to pass. Follow the
   [human review marker rules](WRITING.md#human-review-markers) for documentation.
   The `review-docs` label is required when changed documentation retains or adds
   a human review marker. Delete the branch after merging.

## Changelog

Record changes to the published `@antadesign/anta` package in
[CHANGELOG.md](CHANGELOG.md). Keep documentation-site changes in the pull request.
Follow the [repository changelog scope](AGENTS.md#changelog) when deciding whether
an entry belongs in a release.

## Shared conventions

- Keep JSX rendering separate from browser behavior and styles. Follow
  [component architecture and DOM ownership](src/AGENTS.md#architecture).
- Use `color-mix(in oklch, ...)` to adjust color alpha, as described in
  [shared conventions](AGENTS.md#shared-conventions).
- Browser element classes use `HTMLElementBase` for imports without a DOM.
  CSS-only component entries do not require registration.
- Follow [WRITING.md](WRITING.md) for prose, source comments, and API documentation.

## Releasing

Vlad handles npm publishing. Follow [RELEASING.md](RELEASING.md) for package order
and commands. If a change needs a release, mention it in the pull request.
