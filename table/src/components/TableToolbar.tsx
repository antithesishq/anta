import {
  Box, Button, Icon, Input, Menu, MenuItem, MenuSeparator, Select, SelectFaceted, Tag, Tooltip,
  type OptionValue, type SelectFacet, type SelectFacetCustom, type SelectFacetedChangeAttrs, type SelectFacetedValue,
} from '@antadesign/anta'
import { useState } from '@antadesign/anta/jsx-runtime'
import type { TableDownload, TableMatchRules, TableSearchResult } from '../core/table-types'

// The folded text filter rides in SelectFaceted's value record under this key.
const TEXT_FACET_KEY = '__table_text_filter__'
// Matches the delay of Anta's own isolate hint on a multiple Select option.
const ISOLATE_HINT_DELAY_MS = 700

export type ToggleRule = (key: keyof TableMatchRules) => void

function RuleButtons({ rules, onToggle, disabled, negate }: {
  rules: Pick<TableMatchRules, 'matchCase' | 'matchRegex'> & Partial<TableMatchRules>
  onToggle: ToggleRule
  disabled?: boolean
  negate?: boolean
}) {
  const rule = (key: keyof TableMatchRules, label: string, icon: 'case-sensitive' | 'regex' | 'not-equal', shortcut: string) => (
    <Button
      aria-label={label}
      priority="tertiary"
      icon={icon}
      size="small"
      disabled={disabled}
      selected={!!rules[key]}
      aria-pressed={rules[key] ? 'true' : 'false'}
      onClick={() => onToggle(key)}
    >
      <Tooltip follow>{label} <kbd>Alt</kbd><kbd>{shortcut}</kbd></Tooltip>
    </Button>
  )
  return (
    <>
      {rule('matchCase', 'Case sensitive', 'case-sensitive', 'C')}
      {rule('matchRegex', 'Use regular expression', 'regex', 'R')}
      {negate && rule('negate', 'Exclude matches', 'not-equal', 'N')}
    </>
  )
}

/** Alt + C, Alt + R, and Alt + N toggle the match rules of the focused field. */
function ruleShortcut(event: KeyboardEvent, onToggle: ToggleRule, negate: boolean) {
  if (!event.altKey) return
  const key = event.key.toLowerCase()
  if (key === 'c') onToggle('matchCase')
  else if (key === 'r') onToggle('matchRegex')
  else if (key === 'n' && negate) onToggle('negate')
}

function CustomFacetChip({ facet, value, onChange, disabled }: {
  facet: SelectFacetCustom
  value: unknown
  onChange: (value: unknown) => void
  disabled?: boolean
}) {
  const [open, setOpen] = useState(false)
  const summary = facet.summary(value)
  const plain = summary === null || summary === undefined || typeof summary === 'string' || typeof summary === 'number'
  return (
    <>
      {plain
        ? <Input
            button
            aria-haspopup="dialog"
            aria-expanded={open ? 'true' : 'false'}
            aria-label={`${facet.label}: ${summary ?? ''}`}
            disabled={disabled}
            leading={`${facet.label}:`}
            value={summary === null || summary === undefined ? '' : String(summary)}
            trailing={<Icon shape="chevron-down" />}
          />
        : <Button aria-haspopup="dialog" aria-expanded={open ? 'true' : 'false'} disabled={disabled} label={`${facet.label}: `} iconTrailing="chevron-down">
            {summary}
          </Button>}
      <Menu open={open} onStateChange={(_event, { next }) => setOpen(next)} role="dialog" aria-label={`${facet.label} editor`}>
        <div data-menu-open="">{facet.render({ value, onChange, close: () => setOpen(false) })}</div>
        <MenuItem role="button" icon="x" label="Clear" onSelect={() => onChange(undefined)} />
      </Menu>
    </>
  )
}

export interface TableToolbarProps {
  disabled?: boolean
  /** The text filter; absent when the table has nothing to filter. */
  textFilter?: {
    value: string
    placeholder: string
    rules: TableMatchRules
    onChange: (value: string) => void
    onToggleRule: ToggleRule
    /** Narrow tables move the field into the Filter menu. */
    folded: boolean
  }
  facets?: {
    facets: SelectFacet[]
    value: SelectFacetedValue
    onChange: (value: SelectFacetedValue) => void
    /** Narrow tables hide the selected-facet chips. */
    hideChips: boolean
  }
  search?: {
    value: string
    error?: string
    rules: Pick<TableMatchRules, 'matchCase' | 'matchRegex'>
    result: TableSearchResult
    onChange: (value: string) => void
    onToggleRule: ToggleRule
    onStep: (delta: 1 | -1) => void
    /** Narrow tables move the field into the actions menu. */
    folded: boolean
  }
  /** The actions menu's open state, controlled so Mod + F can open it to the folded search field. */
  menu: {
    open: boolean
    onOpenChange: (open: boolean) => void
  }
  actions?: {
    maximized: boolean
    onExpand?: () => void
    columns?: {
      options: { key: string, label: string }[]
      hidden: ReadonlySet<string>
      onChange: (hidden: Set<string>) => void
    }
    downloads?: TableDownload[]
    onDownload: (download: TableDownload) => void
  }
}

/** The row above the table: text filter, facets, search, and the actions menu. */
export function TableToolbar({ disabled, textFilter, facets, search, menu, actions }: TableToolbarProps) {
  const textInput = textFilter && (
    <Input
      value={textFilter.value}
      name="table-filter"
      type="search"
      data-table-filter=""
      leading={<Icon shape="search" />}
      placeholder={textFilter.placeholder}
      disabled={disabled}
      onInput={(event: Event) => textFilter.onChange(inputValue(event))}
      onKeyDown={(event: KeyboardEvent) => ruleShortcut(event, textFilter.onToggleRule, true)}
      trailing={<RuleButtons rules={textFilter.rules} onToggle={textFilter.onToggleRule} disabled={disabled} negate />}
    />
  )

  const textFacet: SelectFacetCustom | undefined = textFilter?.folded ? {
    key: TEXT_FACET_KEY,
    label: 'Filter by text',
    kind: 'custom',
    icon: 'search',
    render: () => textInput,
    summary: value => typeof value === 'string' && value.length > 0 ? value : null,
  } : undefined

  let filterMenu: React.ReactNode = null
  let chips: React.ReactNode = null
  if (facets && (facets.facets.length > 0 || textFacet)) {
    const value = textFacet && textFilter?.value ? { ...facets.value, [TEXT_FACET_KEY]: textFilter.value } : facets.value
    const onFacetChange = (next: SelectFacetedValue, attrs: SelectFacetedChangeAttrs) => {
      if (!('all' in attrs) && attrs.facet === TEXT_FACET_KEY) {
        textFilter?.onChange(typeof attrs.value === 'string' ? attrs.value : '')
        return
      }
      if ('all' in attrs) textFilter?.onChange('')
      const columns = { ...next }
      delete columns[TEXT_FACET_KEY]
      facets.onChange(columns)
    }
    filterMenu = (
      <SelectFaceted
        label="Filter"
        tone="brand"
        toneScope="selected"
        facets={textFacet ? [textFacet, ...facets.facets] : facets.facets}
        value={value}
        onValueChange={onFacetChange}
        disabled={disabled}
        searchable
      />
    )
    const selected = facets.facets.filter(facet => facets.value[facet.key] !== undefined)
    if (selected.length > 0 && !facets.hideChips) {
      const setFacet = (key: string, next: unknown) => {
        const record = { ...facets.value }
        if (next === undefined || (Array.isArray(next) && next.length === 0)) delete record[key]
        else record[key] = next
        facets.onChange(record)
      }
      // Chips follow the facet order, so toggling an option never reshuffles them.
      chips = (
        <Box fade fadeSize={20} display="flex" gap={8}>
            {selected.map(facet => {
              const current = facets.value[facet.key]
              if (facet.kind === 'custom') {
                return <CustomFacetChip key={facet.key} facet={facet} value={current} disabled={disabled} onChange={next => setFacet(facet.key, next)} />
              }
              if (facet.kind !== 'multiple' || !isOptionValues(current)) return null
              return (
                <Select
                  key={facet.key}
                  selection="multiple"
                  verbose
                  tone="brand"
                  toneScope="selected"
                  leading={`${facet.label}: `}
                  options={facet.options}
                  renderOption={facet.renderOption}
                  value={current}
                  onValueChange={(next: OptionValue | OptionValue[]) => setFacet(facet.key, Array.isArray(next) ? next : [next])}
                  disabled={disabled}
                  clearable
                />
              )
            })}
            <Button priority="tertiary" icon="filter-x" label="Clear all" disabled={disabled} onClick={() => facets.onChange({})} />
        </Box>
      )
    }
  }

  return (
    <a-table-toolbar>
      {textFilter && !textFilter.folded && textInput}
      {filterMenu}
      {chips}
      <a-table-toolbar-end>
        {search && !search.folded && <SearchField search={search} disabled={disabled} />}
        {(actions || search?.folded) && (
          <ActionsMenu actions={actions} search={search?.folded ? search : undefined} menu={menu} disabled={disabled} />
        )}
      </a-table-toolbar-end>
    </a-table-toolbar>
  )
}

function SearchField({ search, disabled }: { search: NonNullable<TableToolbarProps['search']>, disabled?: boolean }) {
  const { result } = search
  const hasMatches = result.total > 0
  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Enter') {
      event.preventDefault()
      search.onStep(event.shiftKey ? -1 : 1)
    } else {
      ruleShortcut(event, search.onToggleRule, false)
    }
  }
  return (
    <a-table-search>
      {/* The count sits left of the field and grows leftward, so the field never moves. */}
      {search.value !== '' && (
        <output aria-live="polite">
          {hasMatches && result.active ? `${(result.active.matchIndex + 1).toLocaleString()}/${result.total.toLocaleString()}` : '0/0'}
          {result.capped ? '+' : null}
        </output>
      )}
      <Input
        value={search.value}
        type="search"
        name="table-search"
        data-table-search=""
        aria-label="Search the table"
        placeholder="Search by text"
        disabled={disabled}
        status={search.error ? 'critical' : undefined}
        onInput={(event: Event) => search.onChange(inputValue(event))}
        onClearInput={() => search.onChange('')}
        onKeyDown={onKeyDown}
        trailing={
          <>
            <RuleButtons rules={search.rules} onToggle={search.onToggleRule} disabled={disabled} />
            <Button aria-label="Previous match" priority="tertiary" icon="arrow-narrow-up" size="small" disabled={disabled || !hasMatches} onClick={() => search.onStep(-1)}>
              <Tooltip follow>Previous match <kbd>Shift</kbd><kbd>Enter</kbd></Tooltip>
            </Button>
            <Button aria-label="Next match" priority="tertiary" icon="arrow-narrow-down" size="small" disabled={disabled || !hasMatches} onClick={() => search.onStep(1)}>
              <Tooltip follow>Next match <kbd>Enter</kbd></Tooltip>
            </Button>
          </>
        }
      >
        {search.error && <Tooltip follow>{search.error}</Tooltip>}
      </Input>
    </a-table-search>
  )
}

function ActionsMenu({ actions, search, menu, disabled }: {
  actions?: TableToolbarProps['actions']
  search?: TableToolbarProps['search']
  menu: TableToolbarProps['menu']
  disabled?: boolean
}) {
  const columns = actions?.columns
  const downloads = actions?.downloads
  const hiddenCount = columns?.hidden.size ?? 0
  const count = hiddenCount > 0 ? <Tag size="small" priority="secondary" tone="neutral" label={String(hiddenCount)} /> : null
  const allVisible = !!columns && columns.options.length > 0 && hiddenCount === 0
  const downloadDisabled = disabled || !downloads || downloads.length === 0
  const downloadItem = (download: TableDownload, icon?: boolean) => (
    <MenuItem key={download.fileName + download.label} icon={icon ? 'download' : undefined} label={download.label} disabled={downloadDisabled}
      onSelect={() => actions?.onDownload(download)} />
  )
  return (
    <div>
      <Button priority="secondary" aria-label="Table actions" aria-haspopup="menu"
        // Never disabled while maximized, so the reader can always collapse the table.
        disabled={disabled && !actions?.maximized}
      >
        <Icon shape="columns-3-cog" />
        {count}
      </Button>
      <Menu placement="bottom-end" open={menu.open} onStateChange={(_event, { next }) => menu.onOpenChange(next)}>
        {search && (
          // `data-menu-open` keeps the menu open while the reader types and steps through matches.
          <div data-menu-open="">
            <SearchField search={search} disabled={disabled} />
          </div>
        )}
        {search && actions && <MenuSeparator />}
        {actions?.onExpand && (
          <MenuItem icon={actions.maximized ? 'minimize' : 'maximize'} label={actions.maximized ? 'Collapse' : 'Expand'} onSelect={actions.onExpand} />
        )}
        {columns && (
          <MenuItem icon="table-2" label="Columns" submenu disabled={disabled}>
            {count}
            <Menu>
              <MenuItem
                selectionIndicator="checkbox"
                label="Select all"
                selected={allVisible}
                indeterminate={!allVisible && hiddenCount < columns.options.length}
                data-menu-open=""
                data-menu-skip-active=""
                onSelect={() => columns.onChange(allVisible ? new Set(columns.options.map(option => option.key)) : new Set())}
              />
              <MenuSeparator />
              {columns.options.map(option => {
                const visible = !columns.hidden.has(option.key)
                return (
                  <MenuItem
                    key={option.key}
                    selectionIndicator="checkbox"
                    indicator={<Icon shape={visible ? 'eye' : 'eye-closed'} />}
                    label={option.label}
                    selected={visible}
                    data-menu-open=""
                    onSelect={(event: MouseEvent) => {
                      if (event.altKey) {
                        columns.onChange(new Set(columns.options.map(o => o.key).filter(key => key !== option.key)))
                      } else {
                        const next = new Set(columns.hidden)
                        if (visible) next.add(option.key)
                        else next.delete(option.key)
                        columns.onChange(next)
                      }
                    }}
                  >
                    <Tooltip delay={ISOLATE_HINT_DELAY_MS} placement="left">Alt + click to show only this column</Tooltip>
                  </MenuItem>
                )
              })}
            </Menu>
          </MenuItem>
        )}
        {downloads && (actions?.onExpand || columns) && <MenuSeparator />}
        {downloads && (downloads.length === 1
          ? downloadItem(downloads[0], true)
          : <MenuItem icon="download" label="Download" submenu disabled={downloadDisabled}>
              <Menu>{downloads.map(download => downloadItem(download))}</Menu>
            </MenuItem>)}
      </Menu>
    </div>
  )
}

function isOptionValues(value: unknown): value is OptionValue[] {
  return Array.isArray(value) && value.every(item => typeof item === 'string' || typeof item === 'number' || typeof item === 'boolean')
}

function inputValue(event: Event): string {
  const target = event.target
  return target !== null && typeof target === 'object' && 'value' in target && typeof target.value === 'string' ? target.value : ''
}
