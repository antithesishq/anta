import { render } from 'preact';
import { useState } from 'preact/hooks';
import '@antadesign/anta/bundle.css';
import { Button, Title, Tag } from '@antadesign/anta/bundle';
import './app.css';
function App() {
  const [count, setCount] = useState(0);
  return <main>
    <Title level={1}>Anta consumer test</Title>
    <Tag tone="success" label="Preact" />
    <Button tone="brand" priority="primary" label={`Count: ${count}`} onClick={() => setCount(value => value + 1)} />
  </main>;
}
render(<App />, document.getElementById('app'));
