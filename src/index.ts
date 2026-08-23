/**
 * @antadesign/anta — Anta design system
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
export { Avatar } from './components/Avatar'
export type { AvatarProps } from './components/Avatar'
export {
  resolveAvatar,
  avatarToSvg,
  getInitials,
  hashSeed,
  mulberry32,
  rngFromSeed,
  maxChroma,
  oklchString,
  colorLightness,
  hasFigure,
  DEFAULT_CONFIG,
} from './avatar-core'
export type {
  AvatarGenConfig,
  DimMode,
  ScalarDim,
  Vec2Dim,
  ColorDim,
  ResolvedAvatar,
  ResolvedHead,
  ResolvedBody,
  SvgOptions,
} from './avatar-core'
export { Progress } from './components/Progress'
export type { ProgressProps } from './components/Progress'
export { Loader } from './components/Loader'
export type { LoaderProps } from './components/Loader'
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
export { Switch } from './components/Switch'
export type { SwitchProps, SwitchChangeAttrs } from './components/Switch'
export { Menu } from './components/Menu'
export type { MenuProps } from './components/Menu'
export { MenuItem } from './components/MenuItem'
export type {
  MenuItemProps,
  MenuItemCommonProps,
  MenuItemLinkMode,
  MenuItemActionMode,
} from './components/MenuItem'
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
export { Slider } from './components/Slider'
export type { SliderProps, SliderMarker, SliderChangeAttrs } from './components/Slider'
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
  FacetFilter,
  SelectFacetedValue,
  SelectFacetedChangeAttrs,
  SelectFacetedTriggerState,
} from './components/SelectFaceted'
export { Tabs } from './components/Tabs'
export type { TabsProps, TabOption, TabsChangeAttrs } from './components/Tabs'
export { Steps } from './components/Steps'
export type {
  StepsProps,
  StepMarker,
  StepMarkerState,
  StepOption,
  StepPriority,
  StepState,
  StepTone,
} from './components/Steps'
export { TabPanel } from './components/TabPanel'
export type { TabPanelProps } from './components/TabPanel'
export { Dialog } from './components/Dialog'
export type { DialogProps } from './components/Dialog'
export { Card } from './components/Card'
export type { CardProps } from './components/Card'
export { Banner } from './components/Banner'
export type { BannerProps } from './components/Banner'
export { Toaster, createToaster } from './components/Toaster'
export type {
  ToasterProps,
  ToasterManager,
  ToastOptions,
  ToastPlacement,
  ToastContent,
  ToastRender,
} from './components/Toaster'
export type { BaseProps, BaseAttributes } from './general_types'
export { configure } from './jsx-runtime'
export type { AntaIntrinsicElements } from './jsx-runtime'

/**
 * Seed interface for the icon shape registry. The generated
 * `a-icon.shapes.d.ts` augments this interface with one key per
 * available shape; consumers can do the same with their own generated
 * .d.ts files (TypeScript merges them by interface name). `loader` is the
 * animated string-shape alias; its CSS lives with the Loader component rather
 * than the generated static SVG set.
 */
export interface IconShapes {
  loader: true
}
export type IconShape = keyof IconShapes
