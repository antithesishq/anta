# Banner

Use Banner for announcements, status changes, and notices that need an action.
Its full-width surface keeps the message visible without opening a dialog.
Add supporting content and actions, or let the reader dismiss the notice.

## Message and content

Pass `message` for the notice and `children` for supporting information such as a
link, a timestamp, or a tag. Text messages use Banner's type scale. Pass your own
markup when the message needs a different presentation.

```tsx
<Banner tone="info" message="Deployment complete.">
  <Text size="small" priority="tertiary">2 minutes ago</Text>
</Banner>
```

## Actions

Use `actions` for controls related to the notice. Multiple actions form a compact
row after the message and supporting content. Give controls the notice's tone to
keep their emphasis consistent.

```tsx
<Banner
  tone="info"
  message="A new version is ready to install."
  actions={
    <>
      <Button size="small" priority="primary" tone="info" label="Update now" />
      <Button size="small" priority="tertiary" tone="info" label="Release notes" href="/changelog/" />
    </>
  }
/>
```

## Tone

Use `tone` to identify the kind of notice. The surface, text, and dismiss control
share the tone and follow the surrounding light or dark theme.

```tsx
<Banner message="A scheduled maintenance window is coming up." />
<Banner tone="brand" message="Introducing the new workspace." />
<Banner tone="info" message="A new release is available." />
<Banner tone="success" message="Your changes were saved." />
<Banner tone="warning" message="Your trial ends in 3 days." />
<Banner tone="critical" message="The last deployment failed." />
```

## Round

Add `round` when the notice sits inside a container. Pass a number or a CSS length
for a custom radius. Banner is borderless by default; add a border with CSS when
the notice needs a visible edge.

```tsx
<Banner round tone="info" message="A standalone notice." />
<Banner round={12} tone="success" message="A notice with a 12px radius." />
```

## Align

Content starts at the inline edge. Pass `align="center"` to center it. Long
messages wrap, and message text follows the selected alignment. The layout also
follows `direction: rtl`.

```tsx
<Banner tone="info" message="Scheduled maintenance starts tonight. Save your work before the workspace becomes temporarily unavailable." />
<Banner align="center" tone="info" message="Scheduled maintenance starts tonight. Save your work before the workspace becomes temporarily unavailable." />
```

## Dismiss

Select **Dismiss** or focus it and press Enter or Space to hide the notice.
Banner fades and collapses using the browser's supported transitions. Reduced
motion makes dismissal immediate.

```tsx
<Banner tone="success" message="Your changes were saved. You can dismiss this notice." />
<Banner tone="warning" message="A notice without a built-in dismiss control." closable={false} />
```

Give an action `data-banner-dismiss` to request dismissal when it runs. Put the
attribute on the final action, such as **Got it**, rather than on a menu trigger.
Try **Remind me later** in the Playground.

## Controlled vs uncontrolled

Use `dismissed` when your application needs to accept or reject a dismissal, save
it, or show the notice again. Update it in `onDismiss` to accept the request.
Leave it unchanged to reject. The demonstration counts requests so you can see
rejection without hiding the notice.

Without `dismissed`, Banner owns its visibility. `defaultDismissed` chooses its
initial visibility. Dismissal hides the rendered notice and retains its children
in the DOM.

## Component props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `actions?` | ReactNode | — | Trailing controls (buttons, links) rendered as a compact row after the message and `children`. |
| `align?` | 'start' \| 'center' | 'start' | Positions the content row. `'start'` aligns it to the inline edge; `'center'` centers it. Wrapped message text follows the selected alignment. |
| `children?` | ReactNode | — | Supporting content between the message and actions. |
| `closable?` | boolean | true | Show the built-in Dismiss control. Set false when the notice is permanent or another action requests dismissal through `data-banner-dismiss`. |
| `defaultDismissed?` | boolean | — | Initial dismissed state for the uncontrolled case (read once on mount). |
| `dismissed?` | boolean | — | Controlled visibility. Set true in `onDismiss` to accept a request, or keep false to reject it. Set false to show the notice again. Dismissal hides the host and retains its children; it does not unmount them. |
| `message?` | ReactNode | — | Leading message: a string at the banner type scale or any node. |
| `onDismiss?` | () => void | — | Dismissal request from the close control or a `data-banner-dismiss` action. Controlled Banner stays visible until `dismissed` changes. Uncontrolled Banner applies an uncanceled request itself. |
| `role?` | string | 'status' | Host role. Use 'status' for polite announcements or 'alert' for urgent ones. |
| `round?` | boolean \| number \| string | — | Rounded corners for a standalone, floating banner (`border-radius: 999px`, which clamps to a stadium) instead of the edge-to-edge strip. Still borderless by default. Pass a `number` (px) or a CSS length string for a custom radius. |
| `tone?` | 'neutral' \| 'brand' \| 'info' \| 'success' \| 'warning' \| 'critical' \| (string & {}) | 'neutral' | Semantic tone or a CSS color. Colors the surface, text, border, and dismiss control. Custom colors use an inline CSS variable; under a CSP that blocks style attributes, provide that variable through external CSS instead. |

## Web Component

Supply the light-DOM regions and the attributes your application needs. Use
`a-banner-message` for Banner's text scale and boxless `a-banner-content` for
custom message markup or supporting content. Put actions in one
`a-banner-actions` region and the close Button in `a-banner-close`.

```html
<a-banner role="status" tone="info">
  <a-banner-message>A new release is available.</a-banner-message>
  <a-banner-actions>
    <a-button role="button" tabindex="0" size="small" tone="info" data-banner-dismiss>
      <a-button-label>Got it</a-button-label>
    </a-button>
  </a-banner-actions>
  <a-banner-close>
    <a-button role="button" tabindex="0" priority="quaternary" tone="info"
      aria-label="Dismiss" data-custom-event="dismissrequest">
      <a-icon shape="x" aria-hidden="true"></a-icon>
    </a-button>
  </a-banner-close>
</a-banner>
```

External CSS renders Banner before registration. Browser dismissal needs
`@antadesign/anta/elements/a-banner` and `@antadesign/anta/elements/a-button`;
load `@antadesign/anta/elements/a-icon` for the close icon. The full bundle
includes these entries.

`state="open"` or `state="closed"` controls visibility. Without `state`,
`default-state` seeds visibility once; an omitted default shows the notice.
`statechange` is a cancelable request with serializable `{ next, prev }` detail.
Call `preventDefault()` to reject an uncontrolled request. In controlled mode,
update `state` to accept it or leave it unchanged to reject. Set `state="open"`
to restore visibility. Nested Banners handle their own dismissal.

Omit unused regions. CSS hides an empty actions region. Whitespace counts as
content, so omit a whitespace-only region or author `hidden`. JSX omits absent
actions and whitespace-only string actions. Banner never changes your markup.

Named tones and boolean `round` need no inline styles. Custom colors and lengths
use JSX-owned CSS variables. For raw HTML, supply `--banner-tone-source` or
`--banner-round` through your stylesheet on browsers without typed CSS `attr()`.
A CSP that blocks style attributes also requires these values in external CSS.

Banner now uses explicit regions instead of shadow slots. Group raw actions in
`a-banner-actions` and replace `::part()` overrides with direct region selectors.

## Styling

Use `tone` for color and `round` for corners. `--banner-tone-source` connects a
custom tone to an application color. Customize the surface and regions with
plain CSS. Unlayered rules override Anta's defaults without `!important`.

The classes in these examples identify the demonstrations. Substitute your own
selectors in your application.

Connect a custom tone to your application color through external CSS.

```css
.notice-color { --banner-tone-source: #e0457b; }
```

Add a rule or an outline by setting its width. Banner supplies the tone-aware
border color.

```css
.notice-rule { border-bottom-width: 1px; }
.notice-outline { border-width: 1px; }
```

Change height, message type, or action spacing through the host and its direct
regions. Direct-child selectors keep nested Banners independent.

```css
.notice-custom { min-height: 56px; }
.notice-custom > a-banner-message { font-size: 16px; }
.notice-custom > a-banner-actions { gap: 8px; }
```
