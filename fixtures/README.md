# Interactive component fixtures

Each directory contains one TSX source string and the Bombadil definition that exercises it.

Start the site from the repository root:

```sh
pnpm run dev
```

Open a fixture in the TSX editor:

```text
http://localhost:4321/test/?fixture=switch
```

Hide the editor for Bombadil:

```text
http://localhost:4321/test/?fixture=switch&bombadil=true
```

Run its five-minute Bombadil campaign:

```sh
pnpm exec bombadil browser test \
  --time-limit=5m \
  --output-path=fixtures/switch/.test-output \
  --output-path-overwrite \
  'http://localhost:4321/test/?fixture=switch&bombadil=true' \
  fixtures/switch/bombadil.spec.ts
```

Add `--headless` when you do not want Bombadil to open a browser window.
