export default `import { Tooltip, Button } from '@antadesign/anta'

function Demo() {
  return (
    <div className="container">
      <Button label="Publish" aria-description="Makes the draft public">
        <Tooltip id="publish-help" delay={300}>Makes the draft public</Tooltip>
      </Button>
    </div>
  )
}
`
