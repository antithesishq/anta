# Changelog

## 0.1.4

- [Stickers](https://anta.design/stickers/#styling) load their shadow layout from external CSS and expose artwork styling parts. Bundled static SVGs work with `style-src-attr 'none'`; the `size` prop retains its inline-style API and requires [external CSS for strict CSP server rendering](https://anta.design/stickers/#strict-content-security-policy).

- [Animated stickers](https://anta.design/stickers/#animation-control) expose artwork styling and apply initial seek and delay after Lottie is ready, including worker initialization. Numeric `paused={0}` now seeks to the first frame.
