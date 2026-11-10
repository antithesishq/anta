# Changelog

Changes that ship in `@antadesign/virtual-scroll`.

## Unreleased

### Added

- `<a-virtual-scroll>` and the `VirtualScroll` component (experimental): a
  virtualized list that mounts only rows near the viewport and owns scrolling,
  row measurement, and its scrollbars on the browser thread.
- Rows passed as `items` type `renderItem`; `@antadesign/virtual-scroll/source`
  gives renderers outside JSX, such as a worker, the same typing.
- `marks` and `secondary-marks` draw two layers of row marks on the scrollbar.
- `item-height-fixed` skips row measurement for rows pinned to one height.
- `intercept-keys` lets the application own shortcuts such as `Mod+f`; every
  key the list does not use keeps its browser default.
- `@antadesign/virtual-scroll/bundle` registers the element, loads its
  stylesheet, and exports everything the root entry does, in one import.
- `VirtualScroll` accepts standard DOM handlers, such as `onKeyDown` and
  `onClick`, and passes them to the element.
- The mounted window is always `4 × ceil(height / item-min-height) + 1` rows,
  shifted below the anchor so late rows have room in both scroll directions.
- Notched mouse wheels glide over about 100ms instead of jumping a notch at a
  time. Trackpads, macOS, and `prefers-reduced-motion` scroll at once.
- A track press or thumb drag that lands outside the mounted rows keeps the
  last frame for up to 150ms while the new rows arrive, instead of flashing
  placeholder lines.
