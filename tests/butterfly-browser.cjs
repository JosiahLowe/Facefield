const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{Math.random=()=>.4;});
    await page.clock.install();
    const advance=ms=>page.clock.runFor(ms);
    async function until(fn,arg,limit=120){
      for(let i=0;i<limit;i++){if(await page.evaluate(fn,arg))return;await advance(1000);}
      assert.fail('butterfly did not reach expected state');
    }
    await page.goto((process.env.FACEFIELD_URL||'http://127.0.0.1:8000/')+'?seed=facefield');
    await page.waitForFunction(()=>document.querySelector('.butterfly')?.style.transform);
    const b=page.locator('.butterfly'),world=page.locator('#world');
    const point=()=>b.evaluate(e=>[+e.dataset.worldX,+e.dataset.worldY]);
    const centerCamera=()=>b.evaluate(e=>{const w=document.querySelector('#world');w.scrollTo(+e.dataset.worldX-w.clientWidth/2,+e.dataset.worldY-w.clientHeight/2);});
    assert.equal(await b.count(),1);assert.equal(await page.locator('.fly').count(),0);
    assert.equal(await b.getAttribute('aria-hidden'),'true');
    assert.equal(await b.evaluate(e=>getComputedStyle(e).pointerEvents),'none');
    assert.equal(await b.locator('.butterfly-wing ellipse').count(),4);
    assert.equal(await b.locator('svg [stroke],.butterfly-wing circle').count(),0,'four solid wings, no outlines or decorative patterns');
    const extent=await world.evaluate(w=>[w.scrollWidth,w.scrollHeight]);
    const wings=await b.locator('.butterfly-wing').evaluateAll(ws=>ws.map(w=>w.getAttribute('transform')));
    await advance(200);
    assert.notDeepEqual(await b.locator('.butterfly-wing').evaluateAll(ws=>ws.map(w=>w.getAttribute('transform'))),wings,'natural wing flutter');
    await until(()=>document.querySelector('.butterfly').dataset.mode==='landed');
    await centerCamera();await advance(900);
    const id=await b.getAttribute('data-flower'),patch=await b.getAttribute('data-patch');
    const flower=page.locator(`.flower[data-flower="${patch}:${id}"]`);
    assert.equal(await flower.count(),1,'lands on an existing flower in the active patch');
    assert.ok(+(await flower.getAttribute('data-load'))>.6,'flower bends under resting weight');
    const contact=await page.evaluate(()=>{
      const b=document.querySelector('.butterfly'),f=document.querySelector(`.flower[data-flower="${b.dataset.patch}:${b.dataset.flower}"] .flower-center`);
      const a=b.getBoundingClientRect(),c=f.getBoundingClientRect();
      return Math.hypot(a.x+a.width/2-c.x-c.width/2,a.y+a.height/2+9-c.y-c.height/2);
    });
    assert.ok(contact<4,'resting butterfly stays attached to bending flower: '+contact);
    const loaded=+(await flower.getAttribute('data-load'));
    await until(()=>document.querySelector('.butterfly').dataset.mode!=='landed');
    await advance(900);
    assert.ok(+(await flower.getAttribute('data-load'))<loaded*.7,'stem slowly eases upright after takeoff');
    const beforeScroll=await point();
    await world.evaluate(w=>w.scrollTo(0,0));await advance(650);
    const afterScroll=await point();
    assert.ok(Math.hypot(afterScroll[0]-beforeScroll[0],afterScroll[1]-beforeScroll[1])<300,'scrolling does not attract the butterfly');
    assert.deepEqual(await world.evaluate(w=>[w.scrollLeft,w.scrollTop]),[0,0]);
    // Observe the reaction window during a landing in the same browser task.
    await until(()=>document.querySelector('.butterfly').dataset.mode==='landed');
    const handoff=await page.evaluate(()=>{
      const b=document.querySelector('.butterfly'),w=document.querySelector('#world');
      const before={x:+b.dataset.worldX,y:+b.dataset.worldY,singer:b.dataset.singerIndex,patch:b.dataset.patch};
      document.querySelector('[data-singer]').click();
      const singer=document.querySelector('[data-singer]');
      return {before,after:{x:+b.dataset.worldX,y:+b.dataset.worldY,singer:b.dataset.singerIndex,patch:b.dataset.patch,mode:b.dataset.mode,pending:b.dataset.pendingSinger},
        singer:{x:singer.offsetLeft+singer.offsetWidth/2,y:singer.offsetTop+singer.offsetHeight/2},scroll:[w.scrollLeft,w.scrollTop]};
    });
    assert.equal(handoff.after.singer,handoff.before.singer,'reaction delay preserves current activity');
    assert.equal(handoff.after.patch,handoff.before.patch);
    assert.equal(handoff.after.mode,'landed');
    const activeSinger=await page.locator('[data-singer]').getAttribute('data-index');
    assert.equal(handoff.after.pending,activeSinger);
    assert.equal(handoff.before.x,handoff.after.x);assert.equal(handoff.before.y,handoff.after.y,'no teleport');
    await advance(800);
    assert.equal(await b.getAttribute('data-patch'),handoff.before.patch,'no immediate directional reaction');
    await advance(2400);
    const newPatch=await b.getAttribute('data-patch');
    assert.notEqual(newPatch,handoff.before.patch,'new music is noticed within 1–3 seconds');
    assert.equal(await b.getAttribute('data-singer-index'),activeSinger);
    const moving=await point();
    assert.ok(Math.hypot(moving[0]-handoff.before.x,moving[1]-handoff.before.y)<550,'no dramatic acceleration');
    assert.deepEqual(await world.evaluate(w=>[w.scrollLeft,w.scrollTop]),handoff.scroll,'travel never moves the viewport');
    await until(patch=>{const b=document.querySelector('.butterfly');return b.dataset.patch===patch&&b.dataset.mode==='landed';},newPatch);
    await centerCamera();await advance(200);
    assert.equal(await page.locator('.butterfly').count(),1);
    const nextId=await b.getAttribute('data-flower');
    assert.equal(await page.locator(`.flower[data-flower="${newPatch}:${nextId}"]`).count(),1,'resumes actual flower visits at the new singer');
    assert.deepEqual(await world.evaluate(w=>[w.scrollWidth,w.scrollHeight]),extent);
    await page.screenshot({path:'/tmp/facefield-musical-butterfly.png'});
    await page.emulateMedia({reducedMotion:'reduce'});await advance(500);
    const still=await b.getAttribute('style'),wingStill=await b.locator('.butterfly-wing').evaluateAll(ws=>ws.map(w=>w.getAttribute('transform')));
    await advance(400);
    assert.equal(await b.getAttribute('style'),still);
    assert.deepEqual(await b.locator('.butterfly-wing').evaluateAll(ws=>ws.map(w=>w.getAttribute('transform'))),wingStill,'reduced motion stops flight and flutter');
    await page.emulateMedia({reducedMotion:'no-preference'});await advance(800);
    assert.notEqual(await b.getAttribute('style'),still,'flight resumes');
    assert.deepEqual(errors,[]);
    console.log('PASS musical butterfly: SVG wings, real flower visits, landings and stem weight/release, delayed wandering migration, no teleport or viewport pursuit, stable extents, reduced motion.');
  } finally {await browser.close();}
})();
