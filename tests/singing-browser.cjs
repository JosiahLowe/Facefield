const { chromium }=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const Native=window.AudioContext;
  window.__contexts=[];window.__voices=[];window.__vibratos=0;
  window.AudioContext=class extends Native{
   constructor(...args){super(...args);window.__contexts.push(this);}
   createOscillator(){
    const o=super.createOscillator(),record={start:null,end:null,frequency:null};
    const setFrequency=o.frequency.setValueAtTime.bind(o.frequency);
    o.frequency.setValueAtTime=(value,time)=>{record.frequency=value;return setFrequency(value,time);};
    const start=o.start.bind(o),stop=o.stop.bind(o);
    o.start=t=>{record.start=t;if(o.frequency.value<10)window.__vibratos++;else window.__voices.push(record);return start(t)};
    o.stop=t=>{record.end=t??this.currentTime;return stop(t)};
    return o;
   }
  };
 });
 await page.goto((process.env.FACEFIELD_URL||'http://127.0.0.1:8000/')+'?seed=facefield');
 await page.waitForFunction(()=>document.querySelector('#world').scrollTop>0);
 assert.equal(await page.locator('[data-singer]').count(),1);
 assert.equal(await page.evaluate(()=>__contexts.length),0,'no audio context before a tap');
 assert.equal(await page.locator('[data-singer]').getAttribute('data-chord'),'I');
 await page.evaluate(()=>{Math.random=()=>0;});
 const initialSinger=await page.locator('[data-singer]').getAttribute('data-index');
 await page.locator('[data-singer]').tap();
 assert.notEqual(await page.locator('[data-singer]').getAttribute('data-index'),initialSinger);
 assert.equal(await page.evaluate(()=>__contexts.length),0,'changing singer does not enable audio');
 const singer=page.locator('[data-singer]'),index=await singer.getAttribute('data-index');
 const url=page.url(),world=await page.locator('#world').evaluate(w=>[w.scrollWidth,w.scrollHeight,w.scrollLeft,w.scrollTop]);
 const rect=await singer.boundingBox();assert.ok(rect.x>=390||rect.x+rect.width<=0||rect.y>=844||rect.y+rect.height<=0,'new singer is outside the viewport');
 const waveform=await page.evaluate(async()=>{
  const {playNote,voiceHarmonics}=await import('./singing.js');
  const c=new OfflineAudioContext(1,48000,48000),out=c.createGain();out.gain.value=.25;out.connect(c.destination);
  const {real,imag}=voiceHarmonics({sine:.92,triangle:.055,square:.025});
  const wave=c.createPeriodicWave(real,imag,{disableNormalization:true});
  playNote(c,out,69,.1,.3,wave);
  const data=(await c.startRendering()).getChannelData(0);
  let energy=0,peak=0,crossings=0;
  for(let i=7200;i<12000;i++){energy+=data[i]*data[i];peak=Math.max(peak,Math.abs(data[i]));if(data[i]>=0&&data[i-1]<0)crossings++;}
  return {rms:Math.sqrt(energy/4800),peak,crossings,before:data.slice(0,4000).every(x=>x===0),after:data.slice(22000).every(x=>x===0)};
 });
 assert.ok(waveform.rms>.003&&waveform.peak<.1&&waveform.crossings>=42&&waveform.crossings<=46);
 assert.ok(waveform.before&&waveform.after);
 await page.locator('#enable-sound').tap();
 await page.waitForFunction(()=>document.querySelector('#enable-sound').getAttribute('aria-pressed')==='true');
 assert.equal(await page.evaluate(()=>__contexts.length),1);
 assert.equal(await page.evaluate(()=>__contexts[0].state),'running');
 await page.evaluate(()=>{Math.random=()=>0;});
 let retired = initialSinger;
 for(let i=0;i<3;i++) {
  await page.evaluate(i=>{Math.random=()=>i===0?.999:0;},i);
  const previous=await page.locator('[data-singer]').getAttribute('data-index');
  const previousKey=await singer.getAttribute('data-song-key'),previousMelody=await singer.getAttribute('data-melody');
  const previousChord=await singer.getAttribute('data-chord');
  const scheduled=await page.evaluate(()=>__voices.map(n=>({...n})));
  await singer.evaluate(t=>t.click());
  await singer.evaluate(t=>t.click());
  assert.equal(await singer.getAttribute('data-index'),previous,'repeated taps wait for the phrase');
  assert.ok(await page.locator('.butterfly').evaluate((b,previous)=>b.dataset.singerIndex===previous||b.dataset.pendingSinger===previous,previous),'butterfly remains attracted to the current music while a phrase handoff is queued');
  await page.waitForFunction(previous=>document.querySelector('[data-singer]').dataset.index!==previous,previous,{timeout:15000});
  assert.notEqual(await singer.getAttribute('data-index'),retired,'the previous singer cannot return immediately');
  retired=previous;
  const active=await singer.getAttribute('data-index');
  assert.ok(await page.locator('.butterfly').evaluate((b,active)=>b.dataset.singerIndex===active||b.dataset.pendingSinger===active,active),'actual audio handoff starts the reaction to the new singer');
  await page.locator(`[data-index="${previous}"]`).evaluate(t=>t.click());
  assert.equal(await singer.getAttribute('data-index'),active,'the retired singer is no longer actionable');
  if(i===0)assert.ok(await page.evaluate(()=>__contexts[0].currentTime)>=scheduled[0].start+12*.65,'handoff waits through the sustained phrase ending');
  const completed=await page.evaluate(()=>__voices);
  for(let n=0;n<scheduled.length;n++)assert.ok(completed[n].end>=scheduled[n].end,'scheduled notes are not cut short');
  assert.equal(await page.locator('[data-singer]').count(),1);
  assert.equal(await singer.getAttribute('data-song-key'),previousKey,'handoffs preserve the shared key');
  const progression=['I','V','vi','IV'];
  assert.equal(await singer.getAttribute('data-chord'),progression[(progression.indexOf(previousChord)+1)%4]);
  assert.notEqual(await singer.getAttribute('data-melody'),previousMelody);
  if(i===0){
   assert.equal(await singer.getAttribute('data-melody'),'4','new eighth-note variation is available to real singers');
   const since=await page.evaluate(()=>__contexts[0].currentTime);
   await page.waitForFunction(since=>__voices.filter(n=>n.start>=since).length>=3,since,{timeout:3000});
   const arpeggio=await page.evaluate(since=>__voices.filter(n=>n.start>=since).slice(0,3),since);
   for(let n=1;n<arpeggio.length;n++)assert.ok(Math.abs(arpeggio[n].start-arpeggio[n-1].start-.325)<.001,'scheduler plays two sequential notes per beat');
   assert.ok(arpeggio.every(n=>[9,0,4].includes(Math.round(69+12*Math.log2(n.frequency/440))%12)),'actual eighth notes outline A minor at the vi step');
  }
  assert.notEqual(await page.locator('[data-singer]').getAttribute('data-index'),previous);
  const bounds=await page.locator('[data-singer]').boundingBox();
  assert.ok(bounds.x>=780||bounds.x+bounds.width<=-390||bounds.y>=1688||bounds.y+bounds.height<=-844,'handoff requires a full screen of separation');
  assert.equal(await page.locator(`.face[data-index="${previous}"] [data-feature=mouth]`).getAttribute('fill'),'none','previous singer releases its mouth');
  assert.deepEqual(await page.locator('#world').evaluate(w=>[w.scrollWidth,w.scrollHeight,w.scrollLeft,w.scrollTop]),world);
 }
 assert.equal(await page.evaluate(()=>__contexts.length),1);
 const result=await page.evaluate(async()=>{
  let open=0,closed=0,desync=0,othersOpen=false;const othersMoved=new Set();
  const observer=new MutationObserver(records=>records.forEach(({target,attributeName})=>{
   if(target.matches('[data-feature=mouth]')&&attributeName==='d'&&!target.closest('[data-singer]'))othersMoved.add(target.closest('.face').dataset.index);
  }));observer.observe(document.querySelector('#grid'),{subtree:true,attributes:true,attributeFilter:['d','fill']});
  const start=performance.now();
  return await new Promise(resolve=>{
   function check(){
    const mouth=document.querySelector('[data-singer] [data-feature=mouth]');
    const t=__contexts[0].currentTime;
    if(mouth.getAttribute('fill')!=='none'){
     open++;if(!__voices.some(n=>n.start<=t+.05&&n.end>=t-.05))desync++;
    }else closed++;
    othersOpen||=[...document.querySelectorAll('[data-feature=mouth]')].some(m=>!m.closest('[data-singer]')&&m.getAttribute('fill')!=='none');
    if(performance.now()-start>10500){observer.disconnect();resolve({open,closed,desync,othersOpen,othersMoved:othersMoved.size,notes:__voices.length});}else requestAnimationFrame(check);
   }check();
  });
 });
 assert.ok(await page.evaluate(()=>__vibratos)>0,'pitch modulation is scheduled');
 assert.ok(result.open>20&&result.closed>20&&result.notes>=4,JSON.stringify(result));
 assert.equal(result.desync,0);assert.equal(result.othersOpen,false);assert.ok(result.othersMoved>0);
 assert.equal(page.url(),url);assert.deepEqual(await page.locator('#world').evaluate(w=>[w.scrollWidth,w.scrollHeight,w.scrollLeft,w.scrollTop]),world);
 const chosen=await singer.getAttribute('data-index');
 await singer.evaluate(t=>t.click());
 assert.equal(await singer.getAttribute('data-index'),chosen);
 await page.waitForFunction(chosen=>document.querySelector('[data-singer]').dataset.index!==chosen,chosen,{timeout:15000});
 assert.equal(await page.locator(`[data-index="${chosen}"]`).getAttribute('tabindex'),'-1');
 assert.equal(await singer.getAttribute('tabindex'),'0');
 const next=await singer.getAttribute('data-index');
 await singer.evaluate(t=>t.focus({preventScroll:true}));await page.keyboard.press('Enter');
 await page.waitForFunction(next=>document.querySelector('[data-singer]').dataset.index!==next,next,{timeout:15000});
 assert.equal(await page.evaluate(()=>__contexts.length),1);
 assert.equal(page.url(),url);
 assert.deepEqual(await page.locator('#world').evaluate(w=>[w.scrollWidth,w.scrollHeight,w.scrollLeft,w.scrollTop]),world);
 await page.waitForFunction(()=>document.querySelector('[data-singer] [data-feature=mouth]').getAttribute('fill')!=='none');
 assert.equal(await page.locator('[data-singer]').count(),1);assert.equal(await page.evaluate(()=>__contexts.length),1);
 await page.waitForFunction(()=>document.querySelector('[data-singer] [data-feature=mouth]').getAttribute('fill')!=='none');
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(600);
 const still=await page.locator('[data-singer] [data-feature=mouth]').getAttribute('d');
 await page.waitForTimeout(300);assert.equal(await page.locator('[data-singer] [data-feature=mouth]').getAttribute('d'),still);
 assert.equal(await page.locator('[data-singer] [data-feature=mouth]').getAttribute('fill'),'none');
 await page.locator('#enable-sound').tap();assert.equal(await page.locator('#enable-sound').innerText(),'Enable Sound');
 const notes=await page.evaluate(()=>__voices.length);await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>__voices.length),notes);
 await page.locator('#enable-sound').tap();assert.equal(await page.evaluate(()=>__contexts.length),1);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForTimeout(100);assert.equal(await page.locator('#enable-sound').innerText(),'Enable Sound');
 assert.deepEqual(errors,[]);
 console.log('PASS singer browser:',JSON.stringify({waveform,...result}));
 await browser.close();
})();
