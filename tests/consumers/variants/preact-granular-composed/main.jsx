import { render } from 'preact';
import { useState } from 'preact/hooks';
import '@antadesign/anta/tokens.css';
import '@antadesign/anta/reset.css';
import '@antadesign/anta/elements/a-button';
import '@antadesign/anta/elements/a-title';
import '@antadesign/anta/elements/a-tag';
import '@antadesign/anta/elements/a-breadcrumbs';
import '@antadesign/anta/elements/a-steps';
import '@antadesign/anta/elements/a-input-date';
import '@antadesign/anta/elements/a-select';
import '@antadesign/anta/elements/a-select-faceted';
import '@antadesign/anta/elements/a-icon';
import '@antadesign/anta/elements/a-loader';
import '@antadesign/anta/elements/a-tooltip';
import '@antadesign/anta/elements/a-tabs';
import '@antadesign/anta/elements/a-tab';
import '@antadesign/anta/elements/a-tabpanel';
import '@antadesign/anta/elements/a-input';
import '@antadesign/anta/elements/a-input-time';
import '@antadesign/anta/elements/a-calendar';
import '@antadesign/anta/elements/a-menu';
import '@antadesign/anta/elements/a-menu-item';
import '@antadesign/anta/elements/a-menu-group';
import '@antadesign/anta/elements/a-menu-separator';
import { Button, Title, Tag, Breadcrumbs, Steps, TabPanel, InputDate, Select, SelectFaceted } from '@antadesign/anta';
import './app.css';
function App() {
  const [count, setCount] = useState(0);
  const [phase, setPhase] = useState('build');
  const [selection, setSelection] = useState('Alpha');
  return <main>
    <Title level={1}>Anta consumer test</Title>
    <Tag tone="success" label="Clicks" value={String(count)} />
    <Button tone="brand" priority="primary" label={`Count: ${count}`} onClick={() => setCount(count => count + 1)} /><output id="count">Count: {count}</output>
    <section id="breadcrumbs"><Title level={3}>Breadcrumbs</Title><Breadcrumbs aria-label="Project location" items={[{label:'Home',href:'#home',icon:'home'},{label:'Anta',href:'#anta'},{label:'CSS test',current:true}]} /></section>
    <section id="steps"><Title level={3}>Steps</Title><Steps label="Validation progress" fill tone="brand" value={phase} onStateChange={(_event,{next})=>next && setPhase(next)} options={[{value:'build',label:'Build',state:'completed'},{value:'review',label:'Review',state:'loading'},{value:'deploy',label:'Deploy',state:'incomplete'}]}><TabPanel value="build">Build panel</TabPanel><TabPanel value="review">Review panel</TabPanel><TabPanel value="deploy">Deploy panel</TabPanel></Steps><output id="phase">Phase: {phase}</output></section>
    <section id="date"><Title level={3}>Date with time</Title><InputDate label="Scheduled date" time locale="en-US" defaultValue="2026-06-15T09:00" /></section>
    <section id="select"><Title level={3}>Select</Title><Select label="Choice" filter options={['Alpha','Beta','Gamma']} value={selection} onValueChange={setSelection} /><output id="choice">Choice: {selection}</output></section>
    <section id="faceted"><Title level={3}>SelectFaceted</Title><SelectFaceted label="Filters" searchable defaultValue={{status:'Open'}} facets={[{key:'status',label:'Status',kind:'single',options:['Open','Closed']}]} /></section>
  </main>;
}
render(<App />, document.getElementById('app'));
