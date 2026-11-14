const {chromium}=require('playwright'),assert=require('node:assert/strict'),audioSpy=require('./audio-spy.cjs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});await page.clock.install();await page.addInitScript(audioSpy);await page.addInitScript(()=>{Math.random=()=>.4;});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.goto((process.env.FACEFIELD_URL||'http://127.0.0.1:8000/')+'?seed=facefield');await page.waitForFunction(()=>document.querySelector('.butterfly')?.style.transform);
  await page.evaluate(()=>document.querySelector('#enable-sound').click());await page.clock.runFor(100);
  const initial=await page.evaluate(()=>{
   const b=document.querySelector('.butterfly'),w=document.querySelector('#world'),read=()=>[+b.dataset.worldX,+b.dataset.worldY];const point=read();
   document.querySelector('#kill-moth').click();return {point,after:read(),camera:[w.scrollLeft,w.scrollTop],unit:document.querySelector('#grid').clientWidth/48,singer:document.querySelector('[data-singer]').dataset.index};
  });assert.deepEqual(initial.point,initial.after,'natural singer transition never teleports the moth');
  await page.clock.runFor(800);
  assert.ok(await page.locator('.butterfly').evaluate((b,p)=>Math.hypot(+b.dataset.worldX-p.point[0],+b.dataset.worldY-p.point[1])<p.unit*2.2,initial),'event has no accelerated dart');
  await page.clock.runFor(11000);assert.equal(await page.locator('[data-chorus-voice]').count(),3);
  const singers=await page.locator('[data-chorus-voice]').evaluateAll(ts=>ts.map(t=>({index:t.dataset.index,voice:t.dataset.chorusVoice,x:t.offsetLeft+t.offsetWidth/2,y:t.offsetTop+t.offsetHeight/2})));
  assert.equal(new Set(singers.map(s=>s.index)).size,3);
  for(let i=0;i<3;i++)for(let j=0;j<i;j++)assert.ok(Math.abs(singers[i].x-singers[j].x)>=390*1.6||Math.abs(singers[i].y-singers[j].y)>=844*1.6,'singers occupy distant world positions');
  for(const singer of singers.slice().sort((a,b)=>+b.voice-+a.voice)){
   await page.evaluate(p=>{const w=document.querySelector('#world');w.scrollTo(p.x-w.clientWidth/2,p.y-w.clientHeight/2);},singer);await page.clock.runFor(250);
   assert.ok(await page.locator('.flower').count()>0,'each singer has visible songflowers');
  }
  assert.equal(await page.locator('[data-singer]').getAttribute('data-index'),initial.singer,'extra voices do not replace the moth’s singer');
  assert.ok(await page.locator('.butterfly').evaluate((b,index)=>b.dataset.singerIndex===index||b.dataset.pendingSinger===index,initial.singer));
  // Observe normal arrival and repeated landings while watching the moth.
  let landed=false;
  for(let i=0;i<160;i++){
   await page.clock.runFor(1000);
   if(await page.locator('.butterfly').getAttribute('data-mode')==='landed'){landed=true;break;}
  }assert.ok(landed,'moth reaches its original garden at natural speed and visits a real flower');
  await page.locator('.butterfly').evaluate(b=>{const w=document.querySelector('#world');w.scrollTo(+b.dataset.worldX-w.clientWidth/2,+b.dataset.worldY-w.clientHeight/2);});await page.clock.runFor(300);
  assert.equal(await page.locator('[data-chorus-voice]').count(),3);
  assert.notEqual(await page.locator('.butterfly').getAttribute('data-mode'),'dead');
  assert.ok(await page.locator('.flower[data-load]').evaluateAll(fs=>fs.some(f=>+f.dataset.load>.1)),'landed moth still bends its flower');
  assert.deepEqual(errors,[]);console.log('PASS stage 2 world: natural-speed moth transition, three distant singers and gardens, one chosen garden, actual flower visits/weight, camera independence and indefinite watched chorus.');
 }finally{await browser.close();}
})();
