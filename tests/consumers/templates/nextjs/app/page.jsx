'use client';

import { useState } from 'react';
import { Title, Tag, Button } from '@antadesign/anta/bundle';

export default function Page() {
  const [count, setCount] = useState(0);
  return (
    <main>
      <Title level={1}>Anta consumer test</Title>
      <Tag tone="success" label="App Router" />
      <Button
        tone="brand"
        priority="primary"
        label={`Count: ${count}`}
        onClick={() => setCount(value => value + 1)}
      />
    </main>
  );
}
