const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{Math.random=()=>.4;});
    await page.goto((process.env.FACEFIELD_URL||'http://127.0.0.1:8000/')+'?seed=facefield');
    await page.waitForFunction(()=>document.querySelector('.butterfly')?.style.transform);
    const b=page.locator('.butterfly'),world=page.locator('#world');
    const point=()=>b.evaluate(e=>[+e.dataset.worldX,+e.dataset.worldY]);
    const centerCamera=()=>b.evaluate(e=>{const w=document.querySelector('#world');w.scrollTo(+e.dataset.worldX-w.clientWidth/2,+e.dataset.worldY-w.clientHeight/2);});
    assert.equal(await b.count(),1);assert.equal(await page.locator('.fly').count(),0);
    assert.equal(await b.getAttribute('aria-hidden'),'true');
    assert.equal(await b.evaluate(e=>getComputedStyle(e).pointerEvents),'none');
    assert.equal(await b.locator('.butterfly-wing ellipse').count(),6);
    const extent=await world.evaluate(w=>[w.scrollWidth,w.scrollHeight]);
    const wings=await b.locator('.butterfly-wing').evaluateAll(ws=>ws.map(w=>w.getAttribute('transform')));
    await page.waitForTimeout(200);
    assert.notDeepEqual(await b.locator('.butterfly-wing').evaluateAll(ws=>ws.map(w=>w.getAttribute('transform'))),wings,'natural wing flutter');
    await page.waitForFunction(()=>document.querySelector('.butterfly').dataset.mode==='landed',null,{timeout:20000});
    await centerCamera();await page.waitForTimeout(900);
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
    await page.waitForFunction(()=>document.querySelector('.butterfly').dataset.mode!=='landed');
    await page.waitForTimeout(900);
    assert.ok(+(await flower.getAttribute('data-load'))<loaded*.7,'stem slowly eases upright after takeoff');
    const beforeScroll=await point();
    await world.evaluate(w=>w.scrollTo(0,0));await page.waitForTimeout(650);
    const afterScroll=await point();
    assert.ok(Math.hypot(afterScroll[0]-beforeScroll[0],afterScroll[1]-beforeScroll[1])<300,'scrolling does not attract the butterfly');
    assert.deepEqual(await world.evaluate(w=>[w.scrollLeft,w.scrollTop]),[0,0]);
    // Retarget during a landing, synchronously in the same browser task.
    await page.waitForFunction(()=>document.querySelector('.butterfly').dataset.mode==='landed',null,{timeout:20000});
    const handoff=await page.evaluate(()=>{
      const b=document.querySelector('.butterfly'),w=document.querySelector('#world');
      const before={x:+b.dataset.worldX,y:+b.dataset.worldY,singer:b.dataset.singerIndex,patch:b.dataset.patch};
      document.querySelector('[data-singer]').click();
      const singer=document.querySelector('[data-singer]');
      return {before,after:{x:+b.dataset.worldX,y:+b.dataset.worldY,singer:b.dataset.singerIndex,patch:b.dataset.patch,mode:b.dataset.mode},
        singer:{x:singer.offsetLeft+singer.offsetWidth/2,y:singer.offsetTop+singer.offsetHeight/2},scroll:[w.scrollLeft,w.scrollTop]};
    });
    assert.notEqual(handoff.after.singer,handoff.before.singer);
    assert.notEqual(handoff.after.patch,handoff.before.patch);
    assert.equal(handoff.after.mode,'travel','singer event interrupts the landing immediately');
    assert.equal(handoff.before.x,handoff.after.x);assert.equal(handoff.before.y,handoff.after.y,'no teleport');
    await page.waitForTimeout(800);
    const moving=await point(),goal=handoff.singer;
    assert.ok(Math.hypot(moving[0]-goal.x,moving[1]-goal.y)<Math.hypot(handoff.before.x-goal.x,handoff.before.y-goal.y),'immediate purposeful travel toward new singer');
    assert.deepEqual(await world.evaluate(w=>[w.scrollLeft,w.scrollTop]),handoff.scroll,'travel never moves the viewport');
    await page.waitForFunction(patch=>{const b=document.querySelector('.butterfly');return b.dataset.patch===patch&&b.dataset.mode==='landed';},handoff.after.patch,{timeout:20000});
    await centerCamera();await page.waitForTimeout(200);
    assert.equal(await page.locator('.butterfly').count(),1);
    const nextId=await b.getAttribute('data-flower');
    assert.equal(await page.locator(`.flower[data-flower="${handoff.after.patch}:${nextId}"]`).count(),1,'resumes actual flower visits at the new singer');
    assert.deepEqual(await world.evaluate(w=>[w.scrollWidth,w.scrollHeight]),extent);
    await page.screenshot({path:'/tmp/facefield-musical-butterfly.png'});
    await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(500);
    const still=await b.getAttribute('style'),wingStill=await b.locator('.butterfly-wing').evaluateAll(ws=>ws.map(w=>w.getAttribute('transform')));
    await page.waitForTimeout(400);
    assert.equal(await b.getAttribute('style'),still);
    assert.deepEqual(await b.locator('.butterfly-wing').evaluateAll(ws=>ws.map(w=>w.getAttribute('transform'))),wingStill,'reduced motion stops flight and flutter');
    await page.emulateMedia({reducedMotion:'no-preference'});await page.waitForTimeout(800);
    assert.notEqual(await b.getAttribute('style'),still,'flight resumes');
    assert.deepEqual(errors,[]);
    console.log('PASS musical butterfly: SVG wings, real flower visits, landings and stem weight/release, immediate singer interrupts, no teleport or viewport pursuit, stable extents, reduced motion.');
  } finally {await browser.close();}
})();
