import { optionPresentationAttrs } from "../anta_helpers"
import type { IconShape } from "../elements/a-icon.shapes"
import type { OptionPresentationProps } from "../general_types"
import { useState } from "../jsx-runtime"
import { Icon } from "./Icon"
import { Loader } from "./Loader"
import type { TabOption, TabsProps } from "./Tabs"
import { Tabs } from "./Tabs"
import { Tooltip } from "./Tooltip"
import "./Steps.css"

/** Named Anta tone used by Steps. */
export type StepTone =
  | "neutral"
  | "brand"
  | "info"
  | "success"
  | "warning"
  | "critical"

/** Process state shown by one step. */
export type StepState = "incomplete" | "loading" | "completed" | "error"

/** Visual emphasis for the step markers and completed connectors. */
export type StepPriority = "primary" | "secondary" | "tertiary"

/** A static step marker: a number or any registered Anta icon shape. */
export type StepMarker = number | IconShape

/** Snapshot passed to `renderMarker` for a step. */
export interface StepMarkerState {
  /** This step's application-owned process state. */
  state: StepState
  /** Whether this step is the selected tab. */
  selected: boolean
  /** Whether this step cannot be selected. */
  disabled: boolean
}

/** One phase rendered by `<Steps>`. Inherited `className` and `style` land on
 * the individual `<a-tab>`, not on the enclosing Steps sequence. */
export interface StepOption extends OptionPresentationProps {
  /** Stable phase identity. Values must be unique within the sequence. */
  value: string
  /** Visible phase label. It ellipsizes in a constrained step; its full content
   * is available in a tooltip only when clipped. */
  label: React.ReactNode
  /** Secondary text shown below the label. It ellipsizes in a constrained step;
   * its full content is available in a tooltip only when clipped. */
  hint?: React.ReactNode
  /** Application-owned process state. Selection and availability are separate;
   * `error` keeps a critical icon and outline, and selection adds the fill. */
  state: StepState
  /** Tone for this phase. It colors the label, hint, marker, and completed
   * connector. Error steps stay critical, and disabled steps stay neutral.
   * @defaultValue 'neutral' */
  tone?: StepTone | ""
  /** Replaces the marker derived from `state`. A number is shown directly; an
   * Anta icon shape is rendered as an `<Icon>`. */
  marker?: StepMarker
  /** Disables this phase. A custom `marker` or `renderMarker` result is kept;
   * otherwise it uses the incomplete marker. */
  disabled?: boolean
}

/** Public props for `<Steps>`. Selection, panels, events, orientation, size,
 * and disabled behavior match `<Tabs>`. */
export interface StepsProps extends Omit<
  TabsProps,
  "options" | "priority" | "tone" | "noslide" | "round"
> {
  /** Ordered process phases. */
  options: StepOption[]
  /** Visual emphasis. Primary uses a solid selected marker and a stronger
   * completed connector; secondary is the outlined default; tertiary is compact
   * and borderless.
   * @defaultValue 'secondary' */
  priority?: StepPriority
  /** Builds a custom marker from a step and its current state. A returned node
   * replaces `marker` and the built-in state marker; return `undefined` to use
   * those fallbacks, or `null` for an empty ring. */
  renderMarker?: (
    option: StepOption,
    state: StepMarkerState,
  ) => React.ReactNode
}

type StateDetail = { next: string | null; prev: string | null }
type StateChangeEvent = CustomEvent<StateDetail>

const STATE_ICON: Record<Exclude<StepState, "loading">, IconShape> = {
  incomplete: "circle-large",
  completed: "check",
  error: "x",
}

/**
 * A process stepper that switches tab-like content.
 *
 * The application owns phase states and transitions. `Steps` owns the tab
 * interaction pattern, state presentation, and optional panels. Compose
 * application-owned navigation controls beside it when the flow needs actions
 * such as Back or Continue.
 *
 * It supports controlled (`value`) and uncontrolled (`defaultValue`) selection.
 * When neither is supplied, the first option is selected. Explicitly disabled
 * phases cannot be activated. Arrow-key behavior, panel pairing,
 * duplicate-value warnings, and change events match `<Tabs>`.
 *
 * @example
 * ```tsx
 * <Steps
 *   defaultValue="setup"
 *   label="Setup progress"
 *   options={[
 *     { value: "build", label: "Build", state: "completed" },
 *     { value: "setup", label: "Setup", state: "loading" },
 *     { value: "next", label: "Next steps", state: "incomplete", disabled: true },
 *   ]}
 * />
 * ```
 */
export const Steps = ({
  options,
  value,
  defaultValue,
  onStateChange,
  onChange,
  onValueChange,
  onFocus,
  onBlur,
  label,
  priority = "secondary",
  renderMarker,
  size,
  orientation,
  fill,
  disabled,
  children,
  className,
  style,
  id,
  ...rest
}: StepsProps) => {
  const controlled = value !== undefined
  const [internalValue, setInternalValue] = useState<string | undefined>(
    defaultValue,
  )
  const currentValue = controlled
    ? value
    : (internalValue ?? options[0]?.value)

  const handleStateChange = (event: StateChangeEvent, detail: StateDetail) => {
    onStateChange?.(event, detail)
    if (controlled || event.defaultPrevented) return
    setInternalValue(detail.next ?? undefined)
  }

  const tabs: TabOption[] = options.map((option) => {
    const { className: optionClassName, style: optionStyle, ...optionAttrs } =
      optionPresentationAttrs(option)

    const stepTone: StepTone = option.disabled
      ? "neutral"
      : option.state === "error"
        ? "critical"
        : (option.tone || "neutral")
    const customMarker = renderMarker?.(option, {
      state: option.state,
      selected: option.value === currentValue,
      disabled: !!option.disabled,
    })
    const builtInMarker = option.disabled
      ? <Icon shape={STATE_ICON.incomplete} />
      : option.state === "loading"
        ? <Loader tone={stepTone} />
        : <Icon shape={STATE_ICON[option.state]} />
    const marker =
      customMarker !== undefined
        ? customMarker
        : option.marker !== undefined
          ? typeof option.marker === "number"
            ? option.marker
            : <Icon shape={option.marker} />
          : builtInMarker

    return {
      ...optionAttrs,
      value: option.value,
      disabled: option.disabled,
      "data-step-state": option.state,
      tone: stepTone !== "neutral" ? stepTone : undefined,
      className: optionClassName,
      style: optionStyle,
      children: (
        <>
          <a-step-marker aria-hidden="true">
            {marker}
          </a-step-marker>
          <a-step-desc>
            <a-tab-label>{option.label}</a-tab-label>
            {option.hint != null && <a-step-hint>{option.hint}</a-step-hint>}
          </a-step-desc>
          <Tooltip
            truncatedOnly
            truncatedSelector="a-tab-label, a-step-hint"
          >
            {option.label}
            {option.hint != null && <> — {option.hint}</>}
          </Tooltip>
        </>
      ),
    }
  })

  const currentIndex = options.findIndex(
    (option) => option.value === currentValue,
  )
  const vertical = orientation === "vertical"
  const hasPanels = children != null && children !== false
  const hasVerticalPanel = vertical && hasPanels && currentIndex >= 0
  const rootStyle = hasVerticalPanel
    ? ({
        ...style,
        "--steps-panel-row": currentIndex + 2,
      } as React.CSSProperties)
    : style

  return (
    <a-steps
      class={className}
      style={rootStyle}
      id={id}
      {...rest}
      data-orientation={vertical ? "vertical" : undefined}
    >
      <Tabs
        options={tabs}
        value={currentValue}
        onStateChange={handleStateChange}
        onChange={onChange}
        onValueChange={onValueChange}
        onFocus={onFocus}
        onBlur={onBlur}
        label={label}
        size={size}
        orientation={orientation}
        fill={fill}
        priority={priority}
        noslide
        disabled={disabled}
        data-steps=""
      >
        {children}
      </Tabs>
    </a-steps>
  )
}
