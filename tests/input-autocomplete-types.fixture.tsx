import { InputAutocomplete, type InputAutocompleteProps } from '@antadesign/anta'

const props: InputAutocompleteProps = {
  suggestions: ['Alpha', {value:'Beta',label:'Beta'}], value:'', defaultValue:'Seed',
  onFocus: event => event.preventDefault(), onBlur: event => event.type,
  onInput: event => event.currentTarget.value,
  onKeyDown: event => event.key === 'Enter' && event.preventDefault(),
  onCompositionStart: event => event.data, onCompositionEnd: event => event.data,
  onSelect: option => option.value.toLowerCase(),
  onValueChange: value => {
    const text: string = value
    // @ts-expect-error Text callbacks never report null.
    const empty: null = value
    void [text, empty]
  },
}
;<InputAutocomplete {...props} />
InputAutocomplete({suggestions:[],value:undefined,defaultValue:'Free text'})
// @ts-expect-error Text uses an empty string, not null.
InputAutocomplete({suggestions:[],value:null})
// @ts-expect-error Suggestions fill string text, rather than a numeric identity.
InputAutocomplete({suggestions:[{value:0}]})
// @ts-expect-error Misspelled handlers are not part of the public field API.
InputAutocomplete({suggestions:[],onFoucs:()=>{}})
