# Contributing to Anta

Thanks for your interest! Anta is in early development and contributions are currently **limited to Antithesis employees**. The repository is public so the design system can be browsed and consumed (`@antadesign/anta` on npm), but we're not yet accepting external contributions.

If you find a bug or have a question and you're outside Antithesis, please don't open a PR — open an issue and we'll respond when we can. Issues from non-collaborators are subject to interaction limits.

## For Antithesis employees

Every member of the [`antithesishq`](https://github.com/antithesishq) GitHub organization already has access to this repository through the org's base role — no additional invite needed. Your usual `git clone` against `git@github.com:antithesishq/anta.git` should just work.

### Workflow

1. **Create a branch** off `main` with a descriptive name (e.g. `text-link-defaults`, `fix-progress-aria`). Avoid pushing directly to `main` — branch protection enforces this for everyone except admins, and even admins should go through PRs for the paper trail.
2. **Make your changes.** Run `pnpm run build && pnpm run typecheck` locally before pushing; the pre-commit hook auto-rebuilds `dist/` if source files are staged.
3. **Open a PR** against `main`. Include:
   - What changed (the *what*)
   - Why it changed (the *why* — link the slack thread, design discussion, ticket, or your own reasoning)
   - A short test plan (how to verify it locally and what to look for)
4. **Wait for review.** Every PR needs **Vlad Korobov ([@terpimost](https://github.com/terpimost))** to review and approve before merging — please do not self-merge or merge another teammate's PR without Vlad's explicit approval. The `CODEOWNERS` file enforces this requirement automatically.
5. **CI must pass.** Required check is `build`; if it fails, fix the issue rather than bypassing.
6. After merge, delete the branch (the GitHub UI offers this on the merged PR page).

### What goes in `CHANGELOG.md`

Only changes to the **published `@antadesign/anta` package** — anything under `src/`, `dist/`, the build/generator scripts, and root files in the published tarball. Documentation-site changes (anything under `site/`) are intentionally excluded; the commit history is the record for those.

When in doubt: would a consumer who installs this version see this change in their app? If yes, add a `CHANGELOG.md` entry under the next dev version.

### Style and conventions

The repo's `CLAUDE.md` documents the architecture and conventions in detail (file layout, web-component pattern, color manipulation rules, naming, etc.). The short version:

- Two tiers per component: web component under `src/elements/a-*` (declarative, attribute-driven, no JS-set host attributes) and JSX wrapper under `src/components/<Name>.tsx`.
- `color-mix(in oklch, …)` is the standard way to tune any color's alpha. Never `rgba()` or `#rrggbbaa`.
- Web components must work in Node/SSR — `extends HTMLElement` is guarded via `HTMLElementBase` in `anta_helpers.ts`.

### Releasing

Vlad handles npm publishes for now. If a PR's changes warrant a release, mention it in the PR description so the version bump can land in the same merge window.
