# Interactive component fixtures

Each directory contains one complete TSX application and the Bombadil definition that exercises it.

Start the site from the repository root:

```sh
pnpm run dev
```

Open a fixture directly:

```text
http://localhost:4321/fixtures/switch/
```

Run its Bombadil campaign:

```sh
pnpm test:fixture switch
```

Set `BOMBADIL_HEADLESS=true` for a headless run, `BOMBADIL_TIME_LIMIT` to change the default five-minute limit, or `ANTA_FIXTURE_ORIGIN` when the site uses another origin.

