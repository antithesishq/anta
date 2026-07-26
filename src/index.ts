/**
 * @antadesign/anta — Antithesis Design System
 *
 * Portable UI components with web component internals and JSX wrappers.
 * Works with React, Preact (via compat or `configure()`), or any custom JSX runtime.
 *
 * Import components from this entry point:
 * ```ts
 * import { Progress } from '@antadesign/anta'
 * ```
 *
 * Register custom elements (client-side only):
 * ```ts
 * import '@antadesign/anta/elements'
 * ```
 *
 * @packageDocumentation
 */
export { Progress } from './components/Progress'
export type { ProgressProps } from './components/Progress'
export { Text } from './components/Text'
export type { TextProps, ExpandMode } from './components/Text'
export { Title } from './components/Title'
export type { TitleProps } from './components/Title'
export { Tag } from './components/Tag'
export type { TagProps } from './components/Tag'
export { Icon } from './components/Icon'
export type { IconProps } from './components/Icon'
export { Button } from './components/Button'
export type {
  ButtonProps,
  BaseButtonProps,
  ContentMode,
  SubmitMode,
  PriorityMode,
} from './components/Button'
export { ButtonCopy } from './components/ButtonCopy'
export type { ButtonCopyProps } from './components/ButtonCopy'
export type { CopyTarget } from './components/copy-props'
export { ICON_SHAPES, ICON_SYNONYMS } from './elements/a-icon.shapes'
export { Tooltip } from './components/Tooltip'
export type { TooltipProps } from './components/Tooltip'
export { Checkbox } from './components/Checkbox'
export type { CheckboxProps, CheckboxValue } from './components/Checkbox'
export { Menu } from './components/Menu'
export type { MenuProps } from './components/Menu'
export { MenuItem } from './components/MenuItem'
export type { MenuItemProps } from './components/MenuItem'
export { MenuItemCopy } from './components/MenuItemCopy'
export type { MenuItemCopyProps } from './components/MenuItemCopy'
export { MenuSeparator } from './components/MenuSeparator'
export type { MenuSeparatorProps } from './components/MenuSeparator'
export { MenuGroup } from './components/MenuGroup'
export type { MenuGroupProps } from './components/MenuGroup'
export { Expander } from './components/Expander'
export type { ExpanderProps } from './components/Expander'
export { Input } from './components/Input'
export type { InputProps, InputChangeAttrs } from './components/Input'
export { Calendar } from './components/Calendar'
export type { CalendarProps, CalendarChangeAttrs } from './components/Calendar'
export { InputDate } from './components/InputDate'
export type { InputDateProps, InputDateChangeAttrs } from './components/InputDate'
export { InputTime } from './components/InputTime'
export type { InputTimeProps, InputTimeChangeAttrs } from './components/InputTime'
export { InputAutocomplete } from './components/InputAutocomplete'
export type { InputAutocompleteProps } from './components/InputAutocomplete'
export {
  buildMonth,
  getWeekdays,
  firstDayOfWeek,
  clampDate,
  isOutOfRange,
  parseISODate,
  parseDateInput,
  formatDateInput,
  dateFormatPattern,
  parseTimeInput,
  parseDateTimeInput,
  formatDateTimeInput,
  dateTimeFormatPattern,
  usesHour12,
} from './calendar-core'
export type {
  CalendarDay,
  CalendarWeekday,
  CalendarMonth,
  BuildMonthOptions,
  ParseDateOptions,
} from './calendar-core'
export { RadioGroup } from './components/RadioGroup'
export type { RadioGroupProps, RadioOption } from './components/RadioGroup'
export { Select, optionsWithSelection } from './components/Select'
export type {
  SelectProps,
  SelectCommonProps,
  OptionValue,
  SelectOption,
  SelectGroup,
  SelectSubmenu,
  SelectItem,
  SelectChangeAttrs,
  OptionState,
  TriggerState,
  EmptyState,
  SelectionState,
  SelectedOption,
  SelectedGroup,
  SelectedSubmenu,
  SelectedItem,
} from './components/Select'
export { SelectFaceted } from './components/SelectFaceted'
export type {
  SelectFacetedProps,
  SelectFacet,
  SelectFacetSingle,
  SelectFacetMultiple,
  SelectFacetText,
  SelectFacetCustom,
  SelectFacetCustomContext,
  SelectFacetedValue,
  SelectFacetedChangeAttrs,
  SelectFacetedTriggerState,
} from './components/SelectFaceted'
export { Tabs } from './components/Tabs'
export type { TabsProps, TabOption, TabsChangeAttrs } from './components/Tabs'
export { TabPanel } from './components/TabPanel'
export type { TabPanelProps } from './components/TabPanel'
export { Dialog } from './components/Dialog'
export type { DialogProps } from './components/Dialog'
export { Card } from './components/Card'
export type { CardProps } from './components/Card'
export { Banner } from './components/Banner'
export type { BannerProps } from './components/Banner'
export type { BaseProps, BaseAttributes } from './general_types'
export { configure } from './jsx-runtime'
export type { AntaIntrinsicElements } from './jsx-runtime'

/**
 * Seed interface for the icon shape registry. The generated
 * `a-icon.shapes.d.ts` augments this interface with one key per
 * available shape; consumers can do the same with their own generated
 * .d.ts files (TypeScript merges them by interface name).
 */
export interface IconShapes {}
export type IconShape = keyof IconShapes
