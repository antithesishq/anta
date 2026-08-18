export type NodeId = string

export type HarnessComponent =
  | 'Button'
  | 'ButtonCopy'
  | 'Card'
  | 'Checkbox'
  | 'Dialog'
  | 'Input'
  | 'RadioGroup'
  | 'TabPanel'
  | 'Tabs'
  | 'Text'
  | 'Tooltip'

export interface TreeNode {
  id: NodeId
  type: HarnessComponent
  props: Record<string, unknown>
  text?: string
  children?: TreeNode[]
  propNodes?: Record<string, TreeNode[]>
}

export interface AppScenario {
  index: number
  archetype: string
  root: TreeNode
}

export interface ScenarioCorpus {
  runId: string
  seed: number
  scenarios: AppScenario[]
}
