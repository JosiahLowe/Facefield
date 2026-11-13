const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
    await page.addInitScript(()=>{Math.random=()=>.8;});
    const base=(process.env.FACEFIELD_URL||'http://127.0.0.1:8000/')+'?seed=facefield';
    const state=()=>page.locator('#world').getAttribute('data-moth-story');
    const start=()=>page.evaluate(()=>{
      const w=document.querySelector('#world');window.transitions=[];
      new MutationObserver(()=>{
        const t=document.querySelector('[data-singer]'),r=t.getBoundingClientRect();
        transitions.push({state:w.dataset.mothStory,time:performance.now(),visible:r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight});
      }).observe(w,{attributes:true,attributeFilter:['data-moth-story']});
      const at=performance.now();document.querySelector('#kill-moth').click();return {at,camera:[w.scrollLeft,w.scrollTop]};
    });
    const visit=()=>page.evaluate(()=>{
      const w=document.querySelector('#world'),t=document.querySelector('[data-singer]');
      w.scrollTo(t.offsetLeft+t.offsetWidth/2-w.clientWidth/2,t.offsetTop+t.offsetHeight/2-w.clientHeight/2);
      return t.dataset.index;
    });
    const until=async expected=>{for(let i=0;i<100&&await state()!==expected;i++)await page.clock.runFor(50);assert.equal(await state(),expected);};
    await page.goto(base);await page.waitForFunction(()=>document.querySelector('.butterfly')?.style.transform);
    const first=await start();await page.clock.runFor(300);
    assert.notEqual(await page.locator('.butterfly').getAttribute('data-mode'),'dead','not an immediate kill');
    await until('crying');
    const timing=await page.evaluate(()=>transitions.find(t=>t.state==='crying').time);
    assert.ok(timing-first.at>=1200&&timing-first.at<3000,'crying begins within three seconds of pressing Kill Moth');
    assert.deepEqual(await page.locator('#world').evaluate(w=>[w.scrollLeft,w.scrollTop]),first.camera,'no camera movement');
    assert.ok(await page.evaluate(()=>transitions.filter(t=>['scream','death'].includes(t.state)).every(t=>!t.visible)));
    await visit();await page.clock.runFor(100);assert.equal(await state(),'discovered');
    await page.evaluate(()=>document.querySelector('[data-singer]').click());assert.equal(await state(),'idle');
    // Race straight to the new singer: the moth must not wait there forever.
    await start();const caught=await visit();await page.clock.runFor(1600);
    assert.notEqual(await page.locator('[data-singer]').getAttribute('data-index'),caught,'watched scene redirects to a new distant singer');
    await until('crying');
    assert.equal(await page.locator('.butterfly').getAttribute('data-mode'),'dead');
    assert.ok(await page.evaluate(()=>transitions.filter(t=>['scream','death'].includes(t.state)).every(t=>!t.visible)));
    await visit();await page.clock.runFor(100);await page.evaluate(()=>document.querySelector('[data-singer]').click());
    // Jump across the world every frame. Fresh geometry must still guard death.
    await start();
    for(let i=0;i<120;i++){
      await page.evaluate(i=>{
        const w=document.querySelector('#world'),t=document.querySelector('[data-singer]');
        if(i%2)w.scrollTo(t.offsetLeft+t.offsetWidth/2-w.clientWidth/2,t.offsetTop+t.offsetHeight/2-w.clientHeight/2);
        else w.scrollTo(t.offsetLeft<w.scrollWidth/2?w.scrollWidth:0,t.offsetTop<w.scrollHeight/2?w.scrollHeight:0);
      },i);await page.clock.runFor(16);
      if(['crying','discovered'].includes(await state()))break;
    }
    // Leave the current destination offscreen and allow the short scene to finish.
    await page.evaluate(()=>{const w=document.querySelector('#world'),t=document.querySelector('[data-singer]');w.scrollTo(t.offsetLeft<w.scrollWidth/2?w.scrollWidth:0,t.offsetTop<w.scrollHeight/2?w.scrollHeight:0);});
    if(await state()!=='discovered')await until('crying');
    assert.ok(await page.evaluate(()=>transitions.filter(t=>['scream','death'].includes(t.state)).every(t=>!t.visible)),'fast scrolling never exposes a death');
    await visit();await page.clock.runFor(100);assert.equal(await state(),'discovered');
    const corpse=await page.locator('.butterfly').getAttribute('style');await page.clock.runFor(400);
    assert.equal(await page.locator('.butterfly').getAttribute('style'),corpse,'only a motionless corpse is discovered');
    assert.deepEqual(errors,[]);
    console.log('PASS quick offscreen event: crying within 3 seconds, brief delay, no camera motion, pursued scene redirects instead of waiting, fast-scroll guards, fixed corpse and normal resolution.');
  }finally{await browser.close();}
})();
