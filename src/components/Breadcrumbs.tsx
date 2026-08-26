import type { IconShape } from '../elements/a-icon.shapes'
import type { BaseProps } from '../general_types'
import type { BaseButtonProps } from './Button'
import { Button } from './Button'
import { ButtonCopy, type ButtonCopyProps } from './ButtonCopy'
import type { CopyTarget } from './copy-props'
import { Icon } from './Icon'
import { Menu } from './Menu'
import { MenuItem } from './MenuItem'
import { MenuItemCopy, type MenuItemCopyProps } from './MenuItemCopy'
import './Breadcrumbs.css'

/** The text separators built into `<Breadcrumbs>`. Pass an `IconShape` for a
 *  graphic separator instead. */
export type BreadcrumbTextSeparator = '→' | '＞' | '/' | '•' | '〉' | '▸' | '▶︎'

/** A built-in text separator or any registered Anta icon shape. */
export type BreadcrumbSeparator = BreadcrumbTextSeparator | IconShape

/** Props shared by every breadcrumb item. They land on the visible `Button`
 *  and, when the item is folded, on the corresponding `MenuItem`. */
type BreadcrumbItemBase = Omit<BaseProps, 'children' | 'key' | 'slot' | 'tabIndex'> & {
  /** Visible item content. It is reused as the folded menu row's label. */
  label: React.ReactNode
  /** Leading icon shape. */
  icon?: IconShape
  /** Trailing icon shape. Copy items reserve the trailing icon for their copy
   *  feedback and therefore do not accept this prop. */
  iconTrailing?: IconShape
  /** Semantic tone or a literal CSS color. */
  tone?: BaseButtonProps['tone']
  /** Disable the item. */
  disabled?: boolean
  /** Mark this item as the current page. The wrapper passes
   *  `aria-current="page"` through to its button or link. */
  current?: boolean
  /** Runs when an action item is activated. A folded item calls it from the
   *  corresponding `MenuItem` selection. */
  onClick?: (event: any) => void
}

/** A breadcrumb that navigates to an href. */
export type BreadcrumbLinkItem = BreadcrumbItemBase & {
  /** Destination URL. */
  href: string
  /** Where to open the destination. */
  target?: string
  copy?: never
  copyNode?: never
  copyUrl?: never
}

/** A non-navigating breadcrumb action. */
export type BreadcrumbActionItem = BreadcrumbItemBase & {
  href?: never
  target?: never
  copy?: never
  copyNode?: never
  copyUrl?: never
}

/** A breadcrumb that copies a literal value, a marked DOM region, or the page
 *  URL. It uses `ButtonCopy` when visible and `MenuItemCopy` when folded. */
export type BreadcrumbCopyItem = Omit<BreadcrumbItemBase, 'iconTrailing'> & CopyTarget & {
  href?: never
  target?: never
  iconTrailing?: never
  /** Where the copy glyph sits relative to the label — or `'none'` to omit it.
   *  @defaultValue 'leading' */
  iconPlacement?: 'leading' | 'trailing' | 'none'
  /** Text in the successful no-icon confirmation.
   *  @defaultValue Copied */
  copiedLabel?: string
}

/** One item in a `<Breadcrumbs>` trail. Link, action, and copy items share
 *  presentation props while keeping incompatible behaviours type-safe. */
export type BreadcrumbItem =
  | BreadcrumbLinkItem
  | BreadcrumbActionItem
  | BreadcrumbCopyItem

/** Public props for `<Breadcrumbs>`. */
export type BreadcrumbsProps = BaseProps & {
  children?: never
} & {
  /** Ordered breadcrumb entries. */
  items: BreadcrumbItem[]
  /** Button size applied to every visible item and the More control.
   *  @defaultValue 'medium' */
  size?: 'small' | 'medium' | 'large'
  /** Separator between visible entries.
   *  @defaultValue '/' */
  separator?: BreadcrumbSeparator
  /** Maximum number of original breadcrumb items left visible. The More
   *  control does not count. Omit to keep every item visible. */
  maxItems?: number
  /** Number of original items kept before the More control when `maxItems`
   *  collapses the trail. The rest of the visible-item budget is kept from the
   *  end, so `0` puts More first.
   *  @defaultValue 0 */
  itemsBeforeCollapse?: number
  /** Accessible name for the More control.
   *  @defaultValue 'Show more breadcrumbs' */
  moreLabel?: string
} & (
  | {
      /** Button priority applied to every visible item and the More control.
       *  @defaultValue quaternary */
      priority?: 'quaternary'
      /** Remove horizontal padding from every visible breadcrumb control. */
      paddingless?: boolean
    }
  | {
      /** Button priority applied to every visible item and the More control. */
      priority: 'tertiary'
      paddingless?: never
    }
) & (
  | {
      underline?: never
      underlineOnHover?: never
    }
  | {
      /** Underline style applied to every visible breadcrumb control. */
      underline: 'solid' | 'dashed' | 'dotted'
      /** Hide the underline at rest and reveal it on hover. */
      underlineOnHover?: boolean
    }
)

type BreadcrumbEntry =
  | { kind: 'item'; item: BreadcrumbItem }
  | { kind: 'overflow'; items: BreadcrumbItem[] }

const TEXT_SEPARATORS = new Set<BreadcrumbTextSeparator>(['→', '＞', '/', '•', '〉', '▸', '▶︎'])

function isCopyItem(item: BreadcrumbItem): item is BreadcrumbCopyItem {
  return 'copy' in item || 'copyNode' in item || 'copyUrl' in item
}

function buildEntries(
  items: BreadcrumbItem[],
  maxItems: number | undefined,
  itemsBeforeCollapse: number,
): BreadcrumbEntry[] {
  if (maxItems == null || !Number.isFinite(maxItems))
    return items.map((item) => ({ kind: 'item', item }))

  // A collapsed breadcrumb must retain its final location. Treat fractional,
  // zero, and negative values as the smallest meaningful one-item tail.
  const visibleCount = Math.max(1, Math.floor(maxItems))
  if (items.length <= visibleCount) return items.map((item) => ({ kind: 'item', item }))

  // The prop is a count instead of an array index, avoiding a zero-/one-based
  // API ambiguity. Reserve at least one visible item after More.
  const beforeCount = Math.min(
    Math.max(0, Number.isFinite(itemsBeforeCollapse) ? Math.floor(itemsBeforeCollapse) : 0),
    visibleCount - 1,
  )
  const afterCount = visibleCount - beforeCount
  const hidden = items.slice(beforeCount, items.length - afterCount)

  return [
    ...items.slice(0, beforeCount).map((item) => ({ kind: 'item' as const, item })),
    { kind: 'overflow' as const, items: hidden },
    ...items.slice(items.length - afterCount).map((item) => ({ kind: 'item' as const, item })),
  ]
}

function currentAttrs(item: BreadcrumbItem) {
  return item.current ? { 'aria-current': 'page' as const } : {}
}

function renderButtonItem(
  item: BreadcrumbItem,
  priority: 'tertiary' | 'quaternary',
  size: 'small' | 'medium' | 'large',
  underline: 'solid' | 'dashed' | 'dotted' | undefined,
  underlineOnHover: boolean | undefined,
  paddingless: boolean | undefined,
  key: string | number,
) {
  const { label, current, ...props } = item
  const a11y = currentAttrs(item)

  if (isCopyItem(item)) {
    const copyProps = {
      ...props,
      priority,
      size,
      underline,
      underlineOnHover,
      paddingless,
      ...a11y,
    } as ButtonCopyProps
    return (
      <ButtonCopy key={key} {...copyProps}>
        {label}
      </ButtonCopy>
    )
  }

  const buttonProps = {
    ...props,
    priority,
    size,
    underline,
    underlineOnHover,
    paddingless,
    ...a11y,
  }
  return (
    <Button key={key} {...buttonProps as any}>
      {label}
    </Button>
  )
}

function renderMenuItem(item: BreadcrumbItem, key: string | number) {
  const { label, current, onClick, ...props } = item
  const a11y = currentAttrs(item)

  if (isCopyItem(item)) {
    return (
      <MenuItemCopy
        key={key}
        {...props as MenuItemCopyProps}
        label={label}
        onSelect={onClick}
        {...a11y}
      />
    )
  }

  return (
    <MenuItem
      key={key}
      {...props as any}
      label={label}
      onSelect={onClick}
      {...a11y}
    />
  )
}

/**
 * Breadcrumbs — hierarchy navigation assembled from Anta Buttons. Entries can
 * be links, actions, or copy controls; an optional `maxItems` replaces one
 * contiguous range with a More menu without measuring the available width.
 *
 * @example
 * ```tsx
 * <Breadcrumbs
 *   maxItems={3}
 *   items={[
 *     { label: 'Home', href: '/' },
 *     { label: 'Projects', href: '/projects' },
 *     { label: 'Anta', href: '/projects/anta' },
 *     { label: 'Button.tsx', current: true, copy: 'src/components/Button.tsx' },
 *   ]}
 * />
 * ```
 */
export const Breadcrumbs = ({
  items,
  priority = 'quaternary',
  size = 'medium',
  separator = '/',
  maxItems,
  itemsBeforeCollapse = 0,
  moreLabel = 'Show more breadcrumbs',
  underline,
  underlineOnHover,
  paddingless,
  className,
  style,
  'aria-label': ariaLabel,
  ...rest
}: BreadcrumbsProps) => {
  const entries = buildEntries(items, maxItems, itemsBeforeCollapse)
  const separatorNode = TEXT_SEPARATORS.has(separator as BreadcrumbTextSeparator)
    ? separator
    : <Icon shape={separator as IconShape} />

  return (
    <a-breadcrumbs
      role="navigation"
      aria-label={ariaLabel ?? 'Breadcrumb'}
      data-size={size === 'medium' ? undefined : size}
      data-paddingless={paddingless ? '' : undefined}
      class={className}
      style={style}
      {...rest}
    >
      {entries.flatMap((entry, index) => {
        const nodes: React.ReactNode[] = entry.kind === 'overflow'
          ? [
              <Button
                key={`more-${index}`}
                {...{
                  priority,
                  size,
                  paddingless,
                  icon: 'more',
                  'aria-label': moreLabel,
                  'aria-haspopup': 'menu',
                } as any}
              />,
              <Menu key={`menu-${index}`} autoWidth>
                {entry.items.map((item, hiddenIndex) => renderMenuItem(item, hiddenIndex))}
              </Menu>,
            ]
          : [renderButtonItem(entry.item, priority, size, underline, underlineOnHover, paddingless, index)]

        if (index < entries.length - 1) {
          nodes.push(
            <a-breadcrumb-separator key={`separator-${index}`} aria-hidden="true">
              {separatorNode}
            </a-breadcrumb-separator>,
          )
        }

        return nodes
      })}
    </a-breadcrumbs>
  )
}
