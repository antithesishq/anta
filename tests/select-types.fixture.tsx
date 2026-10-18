import { Select, type SelectProps } from '@antadesign/anta'

declare const canClear: boolean
const options = [{ value: 'alpha', label: 'Alpha' }]

// Ordinary single selects keep their non-nullable callback, including explicit generics.
Select({ options, onValueChange: value => {
  value.toLowerCase()
  // @ts-expect-error Ordinary callbacks must infer string, not any.
  const numeric: number = value
  void numeric
} })
Select({ options, clearable: false, onValueChange: value => value.toLowerCase() })
Select<string>({ options, onValueChange: value => value.toLowerCase() })
;<Select options={options} onValueChange={value => value.toLowerCase()} />

for (const clearable of [true, canClear]) {
  Select({ options, clearable, onValueChange: value => {
    // @ts-expect-error Clear can pass undefined, including for a dynamic boolean.
    value.toLowerCase()
    value?.toLowerCase()
  } })
  // @ts-expect-error A handler that accepts only strings cannot handle Clear.
  Select({ options, clearable, onValueChange: (value: string) => value.toLowerCase() })
}

Select<string>({ options, clearable: true, onValueChange: value => {
  // @ts-expect-error Explicit value generics must still account for Clear.
  value.toLowerCase()
  value?.toLowerCase()
} })
;<Select options={options} clearable onValueChange={value => {
  // @ts-expect-error JSX inference must account for Clear.
  value.toLowerCase()
  value?.toLowerCase()
}} />
;<Select options={options} clearable={canClear} onValueChange={value => {
  // @ts-expect-error Dynamic JSX props must account for Clear.
  value.toLowerCase()
  value?.toLowerCase()
}} />

Select({ options: [{ value: 0 }], clearable: true, onValueChange: value => {
  const numeric: number | undefined = value
  // @ts-expect-error Numeric values must not widen to strings.
  const string: string | undefined = value
  void [numeric, string]
} })
Select({ options: [{ value: false }], clearable: canClear, onValueChange: value => {
  const boolean: boolean | undefined = value
  // @ts-expect-error Boolean values must not widen to numbers.
  const numeric: number | undefined = value
  void [boolean, numeric]
} })
Select({ options, selection: 'multiple', clearable: canClear, onValueChange: values => values.map(value => value.toLowerCase()) })

const props: SelectProps = { options, clearable: canClear, onValueChange: value => {
  // @ts-expect-error Reusable props must safely handle a possible Clear.
  value.toLowerCase()
  value?.toLowerCase()
} }
const fixed: SelectProps<string, false> = { options, onValueChange: value => value.toLowerCase() }
// @ts-expect-error Props declared non-clearable cannot enable the Clear footer.
const invalid: SelectProps<string, false> = { options, clearable: true }
void [props, fixed, invalid]
