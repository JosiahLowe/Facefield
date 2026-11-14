const {chromium}=require('playwright'),assert=require('node:assert/strict'),h=require('./story-helpers.cjs');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const {page,errors}=await h.setup(browser);await h.start(page);await h.arrive(page);
  const before=await page.evaluate(()=>audioRecords.length);
  await page.evaluate(()=>document.querySelector('#enable-sound').click());await page.clock.runFor(4000);assert.equal(await page.evaluate(()=>audioRecords.length),before,'mute stops every source');
  await page.evaluate(()=>document.querySelector('#enable-sound').click());await page.clock.runFor(1500);
  assert.equal(await page.locator('[data-chorus-voice]').count(),3,'unmute restores the existing three voices without duplicate joins');
  assert.equal(await page.evaluate(()=>audioContexts.length),1);
  assert.equal(await page.evaluate(()=>audioNodes.filter(n=>n.kind==='panner'&&n.outputs.length).length),3);
  await h.investigate(page);await h.until(page,()=>document.querySelector('#world').dataset.mothStory==='scream',100,50);await page.clock.runFor(150);
  const separation=await page.evaluate(()=>{
   const scream=audioRecords.find(n=>n.kind==='oscillator'&&n.frequency.value===560);
   const songs=audioRecords.filter(n=>n.kind==='oscillator'&&n.wave);
   return {start:scream?.startAt,end:Math.max(...songs.map(n=>n.endAt)),wet:audioNodes.filter(n=>n.kind==='convolver'&&n.outputs.length).length};
  });assert.ok(separation.start>0&&separation.end<=separation.start,'all three voices stop before the scream');
  await h.until(page,()=>document.querySelector('#world').dataset.mothStory==='crying',100,50);await page.clock.runFor(1400);
  assert.equal(await page.locator('[data-chorus-voice]').count(),0);
  assert.equal(await page.evaluate(()=>audioNodes.filter(n=>n.kind==='panner'&&n.outputs.length).length),1,'extra spatial channels cleaned up');
  const cry=await page.evaluate(()=>audioRecords.filter(n=>n.kind==='oscillator'&&[240,210,230].includes(n.frequency.value)&&!n.wave).length);assert.equal(cry,3);
  let moving=0,gaps=0;
  for(let i=0;i<100;i++){
   await page.clock.runFor(40);const sample=await page.evaluate(()=>{
    const now=performance.now()/1000,opening=+document.querySelector('[data-singer]').dataset.sobOpening;
    const sobs=audioRecords.filter(n=>n.kind==='oscillator'&&[240,210,230].includes(n.frequency.value)&&!n.wave);
    return {opening,active:sobs.some(n=>n.startAt<=now&&n.endAt>=now-.04),gap:!sobs.some(n=>n.startAt<=now+.04&&n.endAt>=now-.04)};
   });if(sample.opening>.05){moving++;assert.ok(sample.active);}if(sample.gap){gaps++;assert.equal(sample.opening,0);}
  }assert.ok(moving>2&&gaps>2);
  await h.move(page);await page.clock.runFor(1500);assert.equal(await h.state(page),'discovered');
  const soft=await page.evaluate(()=>audioRecords.filter(n=>n.kind==='oscillator'&&[240,210,230].includes(n.frequency.value)&&!n.wave).slice(-3).map(n=>Math.max(...n.output.gain.events.map(e=>e.v))));
  assert.ok(soft.every(v=>v<=.056001));
  const end=await page.evaluate(()=>{document.querySelector('[data-singer]').click();return performance.now()/1000;});
  assert.ok(await page.evaluate(at=>audioRecords.filter(n=>n.kind==='oscillator'&&!n.wave&&n.frequency.value>40).every(n=>n.endAt<=at),end));
  await page.clock.runFor(1500);assert.equal(await h.state(page),'idle');assert.equal(await page.locator('[data-singer]').getAttribute('data-audio-scene'),'song');
  assert.equal(await page.evaluate(()=>audioContexts.length),1);assert.deepEqual(errors,[]);
  console.log('PASS chorus audio transitions: one clock/context, mute/resume without duplicates, all voices/reverb stop for one spatial scream, local sob/mouth sync, soft discovery, cleanup and normal singing.');
 }finally{await browser.close();}})();
