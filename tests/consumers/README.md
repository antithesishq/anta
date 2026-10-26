# Consumer validation

Run saved Next.js and Preact apps against the current Anta package without
publishing to npm. These production checks run only when requested. They are
excluded from `pnpm test` and the regular CI workflow.

## Run locally

Install workspace dependencies with `pnpm install --frozen-lockfile`, then run:

```sh
pnpm test:consumers
```

Use Node from `.node-version` and installed Chrome. The runner uses the site's
Playwright dependency; set `CAPTURE_TEST_BROWSER_CHANNEL` to another installed
Playwright channel if needed.

The command builds Anta, packs its built output with `npm pack --ignore-scripts`,
and installs that tarball into isolated temporary apps. Framework dependencies
use the committed npm lockfiles. Anta is installed separately because each run
has a new tarball integrity. Apps resolve the installed package and its export
map; they do not use workspace links or aliases to Anta source.

```sh
pnpm test:consumers --framework preact
pnpm test:consumers --framework nextjs --mode granular
pnpm test:consumers --skip-build --keep-apps
```

| Option | Behavior |
| --- | --- |
| `--framework all\|nextjs\|preact` | Select a framework; default `all`. |
| `--mode all\|full\|granular` | Select the import strategy; default `all`. |
| `--skip-build` | Reuse verified current package output and packaged docs. Use after workspace installation has already built them. |
| `--keep-apps` | Keep temporary apps, installed dependencies, and the tarball for troubleshooting. |

Servers and browsers stop after each case, including failures. Temporary apps
are removed unless `--keep-apps` is set. Reports remain in the ignored directory
`tests/consumers/.runs/<timestamp>/`: build and install logs, emitted CSS,
dependency graphs where supported, screenshots, browser observations, Next.js
server HTML, and a summary with versions, commit, and tarball SHA-256.
Next.js builds always use Turbopack through `next build --turbopack`.

## Cases and assertions

| Case | Imports and coverage |
| --- | --- |
| `nextjs-full` | Bundle JS and CSS, App Router rendering, and hydration. |
| `preact-full` | Bundle JS and CSS through Vite and `preact/compat`. |
| `preact-granular-basic` | Tokens, reset, Button/Title/Tag UI entries, and root JSX wrappers. No composed CSS. |
| `nextjs-granular` | Basic elements plus Steps and its primitives. Only Steps composed CSS. |
| `preact-granular-composed` | Breadcrumbs, Steps, InputDate, Select, and SelectFaceted, with their explicit UI entries and primitives. |

Every case checks Title/Tag styling without custom element registration, Button
registration, pointer/Enter/Space activation, and browser errors. Granular cases
exclude the full bundle and unrelated styles. Composed cases check layout and
popups; shared Select CSS must appear once. Next.js checks server markup and
styles with JavaScript disabled, then checks hydrated interactions. Vite records
Anta's dependency graph. Both frameworks check emitted CSS.

The fixtures preserve the consumer validation performed during the granular CSS
export and JSX/UI separation changes. See [Original consumer validation](baseline.md)
for the initial import choices, results, and corrections. Framework versions are pinned in the
manifests and lockfiles. Update those files deliberately when expanding coverage.

Steps generates tooltips, so its granular fixtures explicitly import
`elements/a-tooltip` with the other required primitives. Missing that entry
previously produced duplicate accessible labels. For selected tabs, inspect the
`selected` property and `:state(selected)`: Playwright's `selected` role filter
can miss selection exposed through `ElementInternals`.

These saved apps test package behavior. To test whether the installation docs
lead a new developer to the correct imports, use the fresh-context agent procedure
in the root `AGENTS.md`. Keep that occasional exercise separate from rerunning
the fixtures.

## Run in GitHub Actions

The **Consumer validation** workflow has only a `workflow_dispatch` trigger.
After it reaches the default branch, open **Actions**, select **Consumer
validation**, and select **Run workflow**. Choose framework and import strategy.
Logs and reports are uploaded as an artifact, including
on failure. The workflow reuses package builds from workspace installation.

There is no push, pull request, or scheduled trigger.
