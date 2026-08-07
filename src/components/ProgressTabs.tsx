import { useState } from "../jsx-runtime";
import type { ButtonProps } from "./Button";
import { Button } from "./Button";
import { Icon } from "./Icon";
import type { TabOption, TabsProps } from "./Tabs";
import { Tabs } from "./Tabs";
import "./ProgressTabs.css";

/** Process state shown by one progress tab. */
export type ProgressTabStatus =
  | "incomplete"
  | "loading"
  | "completed"
  | "error";

/** One phase rendered by `<ProgressTabs>`. */
export interface ProgressTabOption {
  /** Stable phase identity. Values must be unique within the strip. */
  value: string;
  /** Visible phase label. */
  label: React.ReactNode;
  /** Current application-owned process state. */
  status: ProgressTabStatus;
  /** Disables this phase. Use it to lock an incomplete future phase. */
  disabled?: boolean;
}

/** Props passed to a custom Previous or Next button renderer. Spread them onto
 * an Anta `Button` (or an equivalent control) to preserve navigation behavior. */
export type ProgressTabsNavigationButtonProps = ButtonProps;

/** Public props for `<ProgressTabs>`. Selection, panels, events, orientation,
 * size, and disabled behavior match `<Tabs>`. */
export interface ProgressTabsProps extends Omit<
  TabsProps,
  "options" | "priority" | "tone" | "noslide" | "round"
> {
  /** Ordered process phases. */
  options: ProgressTabOption[];
  /** Renders Previous/Next controls after panels horizontally, or within the
   * selected step's content flow vertically.
   * @defaultValue true */
  showNavigation?: boolean;
  /** Replaces the default Previous control. Spread the supplied props onto the
   * returned button to retain its computed action, disabled state, and size. */
  renderPreviousButton?: (
    props: ProgressTabsNavigationButtonProps,
  ) => React.ReactNode;
  /** Replaces the default Next control. Spread the supplied props onto the
   * returned button to retain its computed action, disabled state, and size. */
  renderNextButton?: (
    props: ProgressTabsNavigationButtonProps,
  ) => React.ReactNode;
}

type StateDetail = { next: string | null; prev: string | null };
type StateChangeEvent = CustomEvent<StateDetail>;

const STATUS_ICON: Partial<
  Record<ProgressTabStatus, "circle-large" | "check" | "x">
> = {
  loading: "circle-large",
  completed: "check",
  error: "x",
};

/**
 * A process stepper that switches tab-like content.
 *
 * The application owns phase statuses and transitions. `ProgressTabs` owns the
 * tab interaction pattern, status presentation, optional panels, and adjacent
 * Previous/Next navigation. It supports controlled (`value`) and uncontrolled
 * (`defaultValue`) selection. When neither is supplied, the first option is
 * selected.
 *
 * Explicitly disabled phases cannot be activated. Arrow-key behavior, panel
 * pairing, duplicate-value warnings, and change events match `<Tabs>`.
 *
 * @example
 * ```tsx
 * <ProgressTabs
 *   defaultValue="setup"
 *   label="Setup progress"
 *   options={[
 *     { value: "build", label: "Build", status: "completed" },
 *     { value: "setup", label: "Setup", status: "loading" },
 *     { value: "next", label: "Next steps", status: "incomplete", disabled: true },
 *   ]}
 * />
 * ```
 */
export const ProgressTabs = ({
  options,
  value,
  defaultValue,
  onStateChange,
  onChange,
  onValueChange,
  onFocus,
  onBlur,
  label,
  size,
  orientation,
  disabled,
  children,
  className,
  style,
  id,
  showNavigation = true,
  renderPreviousButton,
  renderNextButton,
  ...rest
}: ProgressTabsProps) => {
  const controlled = value !== undefined;
  const [internalValue, setInternalValue] = useState<string | undefined>(
    defaultValue,
  );
  const currentValue = controlled
    ? value
    : (internalValue ?? options[0]?.value);

  const handleStateChange = (event: StateChangeEvent, detail: StateDetail) => {
    onStateChange?.(event, detail);
    if (controlled || event.defaultPrevented) return;
    setInternalValue(detail.next ?? undefined);
  };

  const requestFromNavigation = (next: string) => {
    const detail = { next, prev: currentValue ?? null };
    const event = new CustomEvent<StateDetail>("statechange", {
      cancelable: true,
      detail,
    });
    handleStateChange(event, detail);
  };

  const tabs: TabOption[] = options.map((option) => {
    const icon = STATUS_ICON[option.status];

    return {
      value: option.value,
      disabled: option.disabled,
      tone: option.value === currentValue ? "brand" : undefined,
      children: (
        <>
          <a-progress-tab-ring data-status={option.status} aria-hidden="true">
            {icon && <Icon shape={icon} />}
          </a-progress-tab-ring>
          <a-tab-label>{option.label}</a-tab-label>
        </>
      ),
    };
  });

  const currentIndex = options.findIndex(
    (option) => option.value === currentValue,
  );
  let previous: ProgressTabOption | undefined;
  let next: ProgressTabOption | undefined;

  if (currentIndex >= 0) {
    for (let index = currentIndex - 1; index >= 0; index--) {
      const candidate = options[index];
      if (!candidate.disabled) {
        previous = candidate;
        break;
      }
    }
    for (let index = currentIndex + 1; index < options.length; index++) {
      const candidate = options[index];
      if (!candidate.disabled) {
        next = candidate;
        break;
      }
    }
  }

  const vertical = orientation === "vertical";

  const previousButtonProps: ButtonProps = {
    type: "button",
    priority: "tertiary",
    tone: "brand",
    size,
    label: "Previous",
    icon: vertical ? undefined : "chevron-left",
    disabled: disabled || previous == null,
    onClick: () => previous && requestFromNavigation(previous.value),
  };

  const nextButtonProps: ButtonProps = {
    type: "button",
    priority: "secondary",
    tone: "brand",
    size,
    label: "Next",
    iconTrailing: vertical ? undefined : "chevron-right",
    disabled: disabled || next == null,
    onClick: () => next && requestFromNavigation(next.value),
  };

  const hasPanels = children != null && children !== false;
  const verticalContentRows = (hasPanels ? 1 : 0) + (showNavigation ? 1 : 0);
  const verticalPanelRow = currentIndex + 2;
  const verticalNavigationRow = verticalPanelRow + (hasPanels ? 1 : 0);
  const hasVerticalContent =
    vertical && currentIndex >= 0 && verticalContentRows > 0;
  const rootStyle = hasVerticalContent
    ? ({
        ...style,
        "--progress-tabs-panel-row": verticalPanelRow,
        "--progress-tabs-navigation-row": verticalNavigationRow,
        "--progress-tabs-content-rows": verticalContentRows,
      } as React.CSSProperties)
    : style;

  const previousButton = renderPreviousButton ? (
    renderPreviousButton(previousButtonProps)
  ) : (
    <Button {...previousButtonProps} />
  );
  const nextButton = renderNextButton ? (
    renderNextButton(nextButtonProps)
  ) : (
    <Button {...nextButtonProps} />
  );

  return (
    <a-progress-tabs
      class={className}
      style={rootStyle}
      id={id}
      {...rest}
      data-orientation={vertical ? "vertical" : undefined}
      data-has-selection={currentIndex >= 0 ? "" : undefined}
      data-connects-next={
        hasVerticalContent && currentIndex < options.length - 1 ? "" : undefined
      }
      data-navigation={showNavigation ? "" : undefined}
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
        priority="secondary"
        noslide
        disabled={disabled}
        data-progress-tabs=""
      >
        {children}
      </Tabs>
      {showNavigation && (
        <a-progress-tabs-navigation role="group" aria-label="Progress controls">
          {previousButton}
          {nextButton}
        </a-progress-tabs-navigation>
      )}
    </a-progress-tabs>
  );
};
