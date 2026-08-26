# Breadcrumbs

Hierarchy navigation assembled from Anta Buttons. Breadcrumb entries can be
links, actions, or copy controls. Set `maxItems` to fold one middle range into a
More menu without measuring the available width.

## Items

Pass ordered data through `items`. An `href` renders a native link with the
Button appearance; omit it for an action button. Each item accepts `label`,
`icon`, `iconTrailing`, `tone`, `disabled`, `onClick`, `className`, `style`,
`id`, `title`, and `data-*` / `aria-*` attributes. `size`, priority, and
underline treatment belong to the whole trail so every visible control retains
the same height.

```tsx
<Breadcrumbs
  aria-label="Project location"
  items={[
    { label: 'Home', href: '/', icon: 'home' },
    { label: 'Projects', href: '/projects', icon: 'folder-open', tone: 'brand' },
    { label: 'Refresh', icon: 'refresh', onClick: reload },
  ]}
/>
```

An item with `current` receives `aria-current="page"`. The current item may
remain a link when revisiting the page is useful, or it can be an action such as
copying the current path.

## Priority, size, underline, and padding

Breadcrumbs use either `tertiary` or `quaternary` Button priority. `size` drives
every visible crumb and the More control: small is 24px, medium is 28px, and
large is 32px. `underline` and `underlineOnHover` forward to each visible Button.
With `priority="quaternary"` (the default), `paddingless` removes their horizontal
padding without changing their height, and uses a `0.75ch` gap around separators.

```tsx
<Breadcrumbs priority="tertiary" size="small" items={items} />
<Breadcrumbs priority="quaternary" underline="solid" underlineOnHover items={items} />
<Breadcrumbs paddingless items={items} />
<Breadcrumbs priority="tertiary" size="large" items={items} />
```

The default is medium quaternary. `tertiary` adds a hover fill. `quaternary`
keeps the trail text-only, which suits dense page headers. An underline is
permanent unless `underlineOnHover` is set. `paddingless` is only available with
quaternary priority.

## Separators

Pass any of `→`, `/`, `•`, or `▸` for a text separator. Pass an
Anta icon shape for an icon separator. Separators are decorative and hidden from
assistive technology.

```tsx
<Breadcrumbs separator="→" items={items} />
<Breadcrumbs separator="/" items={items} />
<Breadcrumbs separator="•" items={items} />
<Breadcrumbs separator="▸" items={items} />
<Breadcrumbs separator="chevron-right" items={items} />
```

`chevron-right` is the default. The icon form accepts any registered `IconShape`,
including icons added by an application through Anta's icon generator. Icon
separators use no flex gap; text separators keep the configured gap.

## Folding into More

`maxItems` limits the number of original breadcrumb entries that remain visible;
the More control does not count. When folding, `itemsBeforeCollapse` controls
where More appears. Its default is `0`, so More comes first and the most recent
items remain visible. The final original item is always kept visible.

```tsx
// More / Projects / Anta / Button.tsx
<Breadcrumbs maxItems={3} items={items} />

// Home / Workspace / More / src / Button.tsx
<Breadcrumbs maxItems={4} itemsBeforeCollapse={2} items={items} />
```

The More trigger is an icon-only Button followed by an Anta `Menu`; it supports
pointer, keyboard, and outside-dismiss interaction through the existing menu
primitive. Folded links retain their native link behavior, while folded actions
become menu selections.

## Copying the current item

An item with `copy`, `copyNode`, or `copyUrl` uses `ButtonCopy` while visible and
`MenuItemCopy` if it is folded. Copy entries cannot combine with `href`. Mark a
copying final item `current` when it represents the current page.

```tsx
<Breadcrumbs
  items={[
    { label: 'Home', href: '/' },
    {
      label: 'Button.tsx',
      current: true,
      copy: 'src/components/Button.tsx',
      iconPlacement: 'trailing',
      copiedLabel: 'Path copied',
    },
  ]}
/>
```

Use `copyUrl` to copy `location.href`, `copyNode` to copy a marked rendered
region, or `copy` for a known string. `onCopyRequest` refreshes a reactive string
before copying, and `onCopied` receives the result.

### Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `items` | BreadcrumbItem[] | — | Ordered breadcrumb entries. |
| `itemsBeforeCollapse?` | number | 0 | Number of original items kept before the More control when `maxItems`
 collapses the trail. The rest of the visible-item budget is kept from the
 end, so `0` puts More first. |
| `maxItems?` | number | — | Maximum number of original breadcrumb items left visible. The More
 control does not count. Omit to keep every item visible. |
| `moreLabel?` | string | 'Show more breadcrumbs' | Accessible name for the More control. |
| `paddingless?` | boolean | — | Remove horizontal padding from every visible breadcrumb control. |
| `priority?` | 'quaternary' \| 'tertiary' | quaternary | Button priority applied to every visible item and the More control. |
| `separator?` | BreadcrumbSeparator | 'chevron-right' | Separator between visible entries. |
| `size?` | 'small' \| 'medium' \| 'large' | 'medium' | Button size applied to every visible item and the More control. |
| `underline?` | 'solid' \| 'dashed' \| 'dotted' | — | Underline style applied to every visible breadcrumb control. |
| `underlineOnHover?` | boolean | — | Hide the underline at rest and reveal it on hover. |

`Breadcrumbs` deliberately adds no custom-element behavior: it assembles Anta
Buttons, an optional Menu, and two light-DOM layout tags. When you are not using
JSX, import the Breadcrumbs stylesheet and the primitives, then compose the same
structure yourself. Keep an overflow Menu immediately after its More Button.

```ts
import '@antadesign/anta/components/Breadcrumbs.css'
import '@antadesign/anta/elements'
```

```html
<a-breadcrumbs role="navigation" aria-label="Project location" data-paddingless>
  <a href="/" data-anta role="button" priority="quaternary" paddingless>
    <a-button-label>Home</a-button-label>
  </a>
  <a-breadcrumb-separator aria-hidden="true">•</a-breadcrumb-separator>

  <a-button role="button" tabindex="0" priority="quaternary" paddingless
    aria-label="Show more breadcrumbs" aria-haspopup="menu">
    <a-icon shape="more" aria-hidden="true"></a-icon>
  </a-button>
  <a-menu autowidth>
    <a href="/workspace" data-anta-menu-item role="menuitem"><a-menu-item-label>Workspace</a-menu-item-label></a>
    <a href="/workspace/projects" data-anta-menu-item role="menuitem"><a-menu-item-label>Projects</a-menu-item-label></a>
  </a-menu>

  <a-breadcrumb-separator aria-hidden="true">•</a-breadcrumb-separator>
  <a href="/workspace/projects/anta" data-anta role="button" priority="quaternary"
    paddingless aria-current="page"><a-button-label>Anta</a-button-label></a>
</a-breadcrumbs>
```

Use `priority`, `size`, and `separator` before adding CSS. A `className` on
`Breadcrumbs` lands on the navigation wrapper; item `className` values land on
their individual Buttons. The composed structure uses light-DOM tags, so plain
CSS can style a separator directly.

```tsx
<Breadcrumbs className="project-breadcrumbs" separator="chevron-right" items={items} />
```

```css
.project-breadcrumbs a-breadcrumb-separator {
  color: var(--text-2);
}
```
