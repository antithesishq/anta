import { createRequire } from 'node:module'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
const work = mkdtempSync(join(tmpdir(), 'anta-showcase-'))
process.on('exit', () => rmSync(work, {recursive:true, force:true}))
process.env.PLAYWRIGHT_BROWSERS_PATH = join(work, 'browsers')
const require = createRequire(new URL('../site/package.json', import.meta.url))
execFileSync(process.execPath, [resolve(require.resolve('playwright'), '..', 'cli.js'), 'install', 'ffmpeg'], {env:process.env, stdio:'inherit'})
const { chromium } = require('playwright')
const origin = process.env.SHOWCASE_ORIGIN || 'http://localhost:4321'
const output = resolve(process.env.SHOWCASE_VIDEO || 'tests/.test-output/showcase/live-props.mp4')
const report = resolve('tests/.test-output/showcase/audit.json')
mkdirSync(resolve(output, '..'), {recursive:true})
mkdirSync(resolve(report, '..'), {recursive:true})
;(async()=>{
 const browser=await chromium.launch({executablePath:process.env.SHOWCASE_BROWSER || '/Applications/Brave Browser.app/Contents/MacOS/Brave Browser',headless:true});
 let audit
 try{
 const context=await browser.newContext({viewport:{width:1920,height:1080},deviceScaleFactor:1,recordVideo:{dir:join(work, 'raw'),size:{width:1920,height:1080}}});
 const page=await context.newPage();const errors=[],samples=[],actions=[];page.on('pageerror',e=>errors.push(e.stack));
  await page.goto(`${origin}/fixture-showcase/`);await page.waitForSelector('[data-card="11"]');await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>window.__showcaseReset());
  const start=Date.now();let round=0;let auditing=false;
  audit=setInterval(async()=>{if(auditing)return;auditing=true;try{samples.push(await page.evaluate(()=>({time:window.__showcase.time,width:innerWidth,scrollWidth:document.documentElement.scrollWidth,cards:[...document.querySelectorAll('[data-card]')].map(card=>({index:Number(card.dataset.card),mounted:card.dataset.mounted==='true',connected:!!card.querySelector('[data-subject]'),badge:card.querySelector('[data-badge]').textContent,radios:card.querySelectorAll('a-radio').length,tabs:card.querySelectorAll('a-tab').length,loading:!!card.querySelector('a-button[loading]'),disabled:!!card.querySelector('[disabled]')}))})));}catch{}finally{auditing=false}},120);
  const move=async(loc)=>{if(!await loc.count())return null;const box=await loc.first().boundingBox();if(!box)return null;await page.mouse.move(box.x+box.width/2,box.y+box.height/2,{steps:18});return box};
  const click=async(loc)=>{const box=await move(loc);if(!box)return false;await page.waitForTimeout(100);await page.mouse.click(box.x+box.width/2,box.y+box.height/2);return true};
  while(Date.now()-start<39500){
   const index=round++%12;const card=page.locator(`[data-card="${index}"]`);const state=await card.getAttribute('data-state');if(await card.getAttribute('data-mounted')==='false'||['disabled','loading'].includes(state))continue;
   try{
    let success=false;
    switch(index){
     case 0:case 1:case 3:success=await click(card.locator(index===0?'a-button':index===1?'a-checkbox':'a-switch'));break;
     case 2:{const items=card.locator('a-radio:not([disabled])');const count=await items.count();if(count)success=await click(items.nth((round/12|0)%count));break}
     case 4:{const thumb=card.locator('[part~="thumb-1"]');const rail=card.locator('[part~="rail-area"]');const a=await thumb.boundingBox(),b=await rail.boundingBox();if(a&&b){await page.mouse.move(a.x+a.width/2,a.y+a.height/2,{steps:14});await page.mouse.down();for(let step=1;step<=18;step++){await page.mouse.move(a.x+a.width/2+(b.x+b.width*.8-a.x-a.width/2)*step/18,a.y+a.height/2);await page.waitForTimeout(12)}await page.mouse.up();success=true}break}
     case 5:{const items=card.locator('a-tab:not([disabled])');const count=await items.count();if(count)success=await click(items.nth((round/12|0)%count));break}
     case 6:if(state!=='readOnly'){success=await click(card.locator('a-input'));if(success){await page.keyboard.press('Meta+A');await page.keyboard.type((round%2?'team':'hello')+'@anta.design',{delay:25})}}break;
     case 7:{const days=card.locator('[data-part="day-cell"]:not([disabled]):not([data-outside])');if(await days.count())success=await click(days.nth(12+(round%6)));break}
     case 8:{success=await click(card.locator('a-input'));await page.waitForTimeout(160);const options=card.locator('a-menu-item').filter({hasText:'Orange'});if(await options.isVisible())await click(options);await page.keyboard.press('Escape');break}
     case 9:{success=await click(card.locator('a-button').filter({hasText:'Open dialog'}));await page.waitForTimeout(450);const done=page.locator('a-dialog a-button').filter({hasText:'Done'});if(await done.isVisible())await click(done);break}
     case 10:success=await click(card.locator('[part="summary"]'));break;
     case 11:{const plot=card.locator('canvas');const box=await move(plot);if(box){await page.mouse.wheel(0,round%2?130:-130);success=true}break}
    }
    if(success)actions.push({index,at:Date.now()-start});
   }catch(e){actions.push({index,at:Date.now()-start,skipped:String(e.message).slice(0,180)});await page.mouse.up().catch(()=>{});await page.keyboard.press('Escape').catch(()=>{})}
   await page.waitForTimeout(180);
  }
  clearInterval(audit);await page.screenshot({path:join(work, 'final.png')});
  const video=page.video();await context.close();const raw = await video.path()
  const cards = Array.from({length:12}, (_, index) => {
    const observations = samples.map(s => ({time:s.time, ...s.cards[index]}))
    const absent = observations.filter(s => !s.mounted)
    if (!absent.length || absent.some(s => s.connected)) throw Error(`Missing real unmount for card ${index}`)
    return {index, unmountedForMs:absent.at(-1).time-absent[0].time, states:[...new Set(observations.map(s => s.badge))], interactions:actions.filter(a => a.index===index && !a.skipped).length}
  })
  if (errors.length) throw Error(errors.join('\n'))
  const duration = Number(execFileSync('ffprobe', ['-v','error','-show_entries','format=duration','-of','csv=p=0',raw], {encoding:'utf8'}))
  execFileSync('ffmpeg', ['-hide_banner','-loglevel','error','-y','-ss',String(Math.max(0,duration-39.8)),'-i',raw,'-t','39.8','-vf','fps=60','-an','-c:v','libx264','-preset','fast','-crf','18','-pix_fmt','yuv420p','-movflags','+faststart',output])
  writeFileSync(report,JSON.stringify({errors,cards,actions,video:output},null,2))
  console.log('Saved',output,'with',actions.length,'interactions')
 }finally{clearInterval(audit);await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1}).finally(()=>rmSync(work,{recursive:true,force:true}));
