## 0.3.23 — August 23, 2026

- `Avatar` renders an image, generated placeholder, or initials, with
  `generator`, `badge`, and `round` options.
- `Steps` provides controlled and uncontrolled process navigation with panels,
  states, markers, hints, tones, and horizontal or vertical layouts.
- `Loader`, `Progress`, and the full `bundle` entry expand the package's
  loading and import options.
- Tabs and Steps can fill their available width, and Slider thumbs use smaller
  defaults.

## 0.2.0 — June 9, 2026

This stable release combines the final prereleases. See [Dev releases](/changelog/dev/)
for the complete history.

- `Button`, `Tooltip`, and `Tag`, plus the `rotate-ccw` and `tag` icons.
- Per-element registration through `@antadesign/anta/elements/a-{name}`.
- Stickers moved to `@antadesign/stickers`, keeping `lottie-web` out of Anta's
  dependency graph.
- **Breaking:** background tokens use `--bg-1` through `--bg-5`; `Button`
  replaces `leadingIcon` with `icon`; Text defaults to `priority="secondary"`.
