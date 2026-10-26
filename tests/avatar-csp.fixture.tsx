/** @jsxImportSource @antadesign/anta */
import { h, render } from 'preact'
import { configure } from '../src/jsx-runtime'
import { Avatar } from '../src/components/Avatar'
import { Button } from '../src/components/Button'
import '../src/tokens.css'
import '../src/reset.css'
import '../src/elements/a-avatar'
import '../src/elements/a-button'
import './avatar-csp.fixture.css'

configure(h)

const violations: string[] = []
document.addEventListener('securitypolicyviolation', event => {
  violations.push(event.effectiveDirective)
})

Object.assign(window, {
  cspViolations: violations,
  renderAvatar: (props: object) => render(
    <Button className="account-row" priority="tertiary">
      <Avatar name="Octo Cat" {...props} />
      <span>octocat</span>
    </Button>,
    document.querySelector('#mount')!,
  ),
})
