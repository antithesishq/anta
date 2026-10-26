'use client';
import { useState } from 'react';
import '@antadesign/anta/elements/a-button';
import '@antadesign/anta/elements/a-title';
import '@antadesign/anta/elements/a-tag';
import '@antadesign/anta/elements/a-steps';
import '@antadesign/anta/elements/a-tabs';
import '@antadesign/anta/elements/a-tab';
import '@antadesign/anta/elements/a-tabpanel';
import '@antadesign/anta/elements/a-icon';
import '@antadesign/anta/elements/a-loader';
import '@antadesign/anta/elements/a-tooltip';
import { Button, Title, Tag, Steps, TabPanel } from '@antadesign/anta';
const options=[
 {value:'build',label:'Build',state:'completed'},
 {value:'review',label:'Review',state:'loading'},
 {value:'deploy',label:'Deploy',state:'incomplete'},
];
export default function Page() {
 const [count,setCount]=useState(0);
 const [phase,setPhase]=useState('review');
 return <main>
  <Title level={1}>Anta consumer test</Title>
  <div><Tag tone="success" label="Granular UI" /></div>
  <div><Button tone="brand" priority="primary" label={`Count: ${count}`} onClick={()=>setCount(value=>value+1)} /></div>
  <Steps fill priority="primary" tone="brand" label="Deployment progress" value={phase} options={options} onStateChange={(_event,{next})=>next&&setPhase(next)}>
   <TabPanel value="build">Build output is ready.</TabPanel>
   <TabPanel value="review">Review the result.</TabPanel>
   <TabPanel value="deploy">Deploy the release.</TabPanel>
  </Steps>
  <output aria-live="polite">Phase: {phase}</output>
 </main>;
}
