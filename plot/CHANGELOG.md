# Changelog

## Unreleased

- **Breaking:** Load `@antadesign/plot/plot.css` for [JSX plots, surfaces, and standalone charts](https://anta.design/plot/#styling). Every chart host requires this stylesheet, replacing per-instance injected styles.
- JSX `Plot` applies dimension and `style` props after commit through CSSOM, so they work under strict CSP after hydration. Use external CSS to reserve space before hydration.
