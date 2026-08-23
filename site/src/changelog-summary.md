## 0.2.0 — June 9, 2026

This stable release combines the final prereleases. See [Dev releases](/changelog/dev/)
for the complete history.

- `Button`, `Tooltip`, and `Tag`, plus the `rotate-ccw` and `tag` icons.
- Per-element registration through `@antadesign/anta/elements/a-{name}`.
- Stickers moved to `@antadesign/stickers`, keeping `lottie-web` out of Anta's
  dependency graph.
- **Breaking:** background tokens use `--bg-1` through `--bg-5`; `Button`
  replaces `leadingIcon` with `icon`; Text defaults to `priority="secondary"`.
