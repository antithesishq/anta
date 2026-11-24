import { register_a_table } from '../../elements/table-element'

// Registration is explicit here, so bundlers that honor `sideEffects` keep it.
register_a_table()

export { ATableElement, register_a_table } from '../../elements/table-element'
export type { ATableAttributes, ATableCellAttributes, ATableRowAttributes } from '../../elements/table-attributes'
