import { Select, optionsWithSelection, type SelectProps } from '@antadesign/anta'

declare const canClear: boolean
const options = [{ value: 'alpha', label: 'Alpha' }]

// The callback contract is the same with no Clear UI, a literal flag, or a dynamic one.
for (const clearable of [undefined, false, true, canClear]) {
  Select({ options, clearable, value: null, onValueChange: value => {
    // @ts-expect-error A single selection may be null, regardless of the Clear UI.
    value.toLowerCase()
    value?.toLowerCase()
    // @ts-expect-error The value must not widen to any or another primitive.
    const numeric: number | null = value
    void numeric
  } })
  // @ts-expect-error A string-only handler cannot accept the empty selection.
  Select({ options, clearable, onValueChange: (value: string) => value.toLowerCase() })
}

Select<string>({ options, defaultValue: null, onValueChange: value => value?.toLowerCase() })
;<Select options={options} value={null} onValueChange={value => {
  // @ts-expect-error JSX callbacks also require a null guard.
  value.toLowerCase()
  value?.toLowerCase()
}} />
;<Select options={options} clearable={canClear} onValueChange={value => value?.toLowerCase()} />

Select({ options: [{ value: 0 }], value: null, onValueChange: value => {
  const numeric: number | null = value
  // @ts-expect-error Numeric options preserve their primitive type.
  const string: string | null = value
  void [numeric, string]
} })
Select({ options: [{ value: false }], value: false, onValueChange: value => {
  const boolean: boolean | null = value
  // @ts-expect-error Boolean options preserve their primitive type.
  const numeric: number | null = value
  void [boolean, numeric]
} })
Select({ options: [''], value: '', onValueChange: value => value?.toLowerCase() })
Select({ options, value: undefined, defaultValue: 'alpha' })

Select({ options, selection: 'multiple', value: [], clearable: canClear, onValueChange: values => values.map(value => value.toLowerCase()) })
// @ts-expect-error Multiple selection uses an empty array, not null.
Select({ options, selection: 'multiple', value: null })
// @ts-expect-error Null is reserved for no selection, rather than an option identity.
Select({ options: [{ value: null }] })

const props: SelectProps = { options, value: null, onValueChange: value => value?.toLowerCase() }
optionsWithSelection(options, null)
Select({ ...props, renderTrigger: state => {
  const current: string | string[] | null = state.value
  // @ts-expect-error Trigger state exposes an explicit empty selection, not undefined.
  const absent: undefined = state.value
  void [current, absent]
  return null
} })
void props
