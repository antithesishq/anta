/** Slugs of the component doc pages, now served at the site root (`/button`,
 *  `/tabs`, …). Flattening out of `/components/` removed the URL namespace that
 *  used to distinguish component pages from other top-level pages (Colors,
 *  Changelog, …), so this is the shared source of truth for "is this a
 *  component page": used by DocsLayout (breadcrumb JSON-LD) and the llms.txt
 *  generators to filter the root `.mdx` set. Keep in sync with the sidebar nav
 *  in DocsLayout.astro when adding a component. */
export const COMPONENT_SLUGS = [
  'avatar', 'banner', 'button', 'card', 'checkbox', 'dialog', 'expander', 'icon', 'loader', 'progress', 'input',
  'input-autocomplete', 'input-date', 'input-time', 'slider',
  'menu', 'radio', 'select', 'select-faceted', 'stickers', 'table',
  'switch', 'tabs', 'tag', 'text', 'title', 'toaster', 'tooltip',
]
