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
