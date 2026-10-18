# Changelog

## Unreleased

- [Stickers](/stickers/#styling) load their shadow layout from external CSS and expose artwork styling parts. Bundled static SVGs work with `style-src-attr 'none'`; the `size` prop retains its inline-style API and requires [external CSS for strict CSP server rendering](/stickers/#strict-content-security-policy).
