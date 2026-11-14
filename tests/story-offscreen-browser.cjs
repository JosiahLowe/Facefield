const {chromium}=require('playwright'),assert=require('node:assert/strict'),h=require('./story-helpers.cjs');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const {page,errors}=await h.setup(browser);await h.start(page);await h.arrive(page);
  const moveAway=()=>page.locator('[data-singer]').evaluate(t=>{const w=document.querySelector('#world');w.scrollTo(t.offsetLeft<w.scrollWidth/2?w.scrollWidth:0,t.offsetTop<w.scrollHeight/2?w.scrollHeight:0);});
  await page.clock.runFor(20000);assert.equal(await h.state(page),'chorus_active');
  // Leaving without actually investigating a voice does not start the death.
  await moveAway();await page.clock.runFor(5000);assert.equal(await h.state(page),'chorus_active');
  await h.investigate(page);await page.clock.runFor(1200);assert.equal(await h.state(page),'chorus_active','under two seconds is insufficient');
  await h.move(page);await page.clock.runFor(100);assert.equal(await h.state(page),'chorus_active');
  await h.investigate(page);await page.clock.runFor(1200);assert.equal(await h.state(page),'chorus_active','offscreen dwell resets after returning');
  await page.evaluate(()=>document.querySelector('#enable-sound').click());await page.clock.runFor(5000);assert.equal(await h.state(page),'chorus_active','mute cannot complete a pending death');
  await page.evaluate(()=>document.querySelector('#enable-sound').click());await page.clock.runFor(150);assert.equal(await h.state(page),'chorus_active');
  await page.clock.runFor(700);
  await page.evaluate(()=>window.dispatchEvent(new Event('blur')));const paused=await h.state(page);await page.clock.runFor(10000);assert.equal(await h.state(page),paused);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.clock.runFor(100);assert.equal(await page.locator('#enable-sound').getAttribute('aria-pressed'),'true');
  assert.equal(await h.state(page),'chorus_active','focus loss resets the contiguous two-second dwell');
  // Continuously jump between primary and distant companion at frame cadence.
  for(let i=0;i<60;i++){await h.move(page,i%2?'[data-singer]':'[data-chorus-voice="1"]');await page.clock.runFor(16);}
  assert.equal(await h.state(page),'chorus_active');
  await h.investigate(page);
  await h.until(page,()=>document.querySelector('#world').dataset.mothStory==='death_pending',60,50);
  await h.move(page);await page.clock.runFor(50);assert.equal(await h.state(page),'chorus_active','watching during the brief chorus tail cancels death');
  await h.investigate(page);await h.until(page,()=>document.querySelector('#world').dataset.mothStory==='scream',100,50);
  await h.move(page);await page.clock.runFor(1200);assert.equal(await h.state(page),'scream','rushing back during scream never exposes a death');
  assert.notEqual(await page.locator('.butterfly').getAttribute('data-mode'),'dead');
  const screamCount=await page.evaluate(()=>audioRecords.filter(n=>n.kind==='oscillator'&&n.frequency.value===560).length);assert.equal(screamCount,1);
  await moveAway();await h.until(page,()=>document.querySelector('#world').dataset.mothStory==='crying',80,50);
  assert.equal(await page.evaluate(()=>audioRecords.filter(n=>n.kind==='oscillator'&&n.frequency.value===560).length),1,'no repeated scream');
  await h.move(page);await page.clock.runFor(100);assert.equal(await h.state(page),'discovered');
  const corpse=await page.locator('.butterfly').getAttribute('style');await page.clock.runFor(300);assert.equal(await page.locator('.butterfly').getAttribute('style'),corpse);
  assert.deepEqual(errors,[]);console.log('PASS chorus death guards: no elapsed-time death, real investigation, two continuous seconds, watched/tail cancellation, mute/focus reset, frame-speed scrolling, one scream, offscreen-only corpse and discovery.');
 }finally{await browser.close();}})();
