export default `import { Tooltip, Button } from '@antadesign/anta'

function Demo() {
  return (
    <div className="container">
      <Button label="Hover me">
        <Tooltip delay={300}>Edit my props or code</Tooltip>
      </Button>
    </div>
  )
}
`
