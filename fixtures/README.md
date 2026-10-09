# Interactive component fixtures

Each directory contains one TSX source string and the Bombadil definition that exercises it.

Start the site from the repository root:

```sh
pnpm run dev
```

Open a fixture in the TSX editor:

```text
http://localhost:4321/test/?fixture=plot
```

Replace `plot` with `switch`, `checkbox`, or `radio-group` to open those fixtures.

Hide the editor for Bombadil:

```text
http://localhost:4321/test/?fixture=plot&bombadil=true
```

Run its five-minute Bombadil campaign:

```sh
pnpm test:fixture plot
```

Set `BOMBADIL_HEADLESS=true` for a headless run, `BOMBADIL_TIME_LIMIT` to change the five-minute limit, `BOMBADIL_OUTPUT_PATH` to change the results directory, or `ANTA_FIXTURE_ORIGIN` when the site uses another origin.
