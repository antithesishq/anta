import { Button, Dialog, Text, Title } from '@antadesign/anta'

export default function DialogZonesPreview() {
  return (
    <>
      <Button data-dialog-open="zones">Open dialog</Button>
      <Dialog
        name="zones"
        header={<Title level={4}>Enable telemetry?</Title>}
        footer={
          <>
            <Button data-dialog-close="zones">Not now</Button>
            <Button priority="primary" data-dialog-close="zones">Enable</Button>
          </>
        }
      >
        <Text>
          Anonymous usage data helps us find the bugs that matter. You can change
          this any time in settings.
        </Text>
      </Dialog>
    </>
  )
}
