# Live component showcase

This is a staged visual demonstration, separate from the Hegel/Bombadil campaign.
It uses the real Anta components and a repeatable 40-second schedule. Props change
while components remain mounted; each component also leaves the DOM for 2.2
seconds before a fresh instance mounts. Radio and tab arrays and orientations
change alongside disabled, loading, validation, locale, and Plot props.

Start `pnpm run dev` from the repository root and open
`http://localhost:4321/fixture-showcase/`. Pause and Replay control the schedule.
The page is interactive without the recorder.

To record real pointer and keyboard interactions, run:

```sh
node scripts/record-fixture-showcase.mjs
```

This Mac's Brave installation is used without downloading browsers. Playwright's
small capture encoder is downloaded into the temporary recording folder; system
FFmpeg handles the final export. `SHOWCASE_ORIGIN`, `SHOWCASE_BROWSER`, and `SHOWCASE_VIDEO` override the
server, browser executable, and output path. The default video and compact audit
report go to `tests/.test-output/showcase/`. Temporary recordings, browser data,
and encoder links are deleted when the recorder finishes or fails.

The report verifies absent DOM nodes and observed state changes. It is not a
property-test result; use `fixtures/bombadil.spec.ts` for that campaign.
