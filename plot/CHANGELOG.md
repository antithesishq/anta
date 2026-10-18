# Changelog

## Unreleased

- Load `@antadesign/plot/plot.css` for [JSX plots, surfaces, and standalone charts](/plot/#styling) to replace injected stylesheets under strict CSP. Runtime geometry still uses CSSOM, and `style-src-attr 'none'` requires external CSS for server-rendered dimensions and consumer styles.
