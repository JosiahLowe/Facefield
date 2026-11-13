const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
    await page.addInitScript(()=>{Math.random=()=>.8;});
    await page.goto((process.env.FACEFIELD_URL||'http://127.0.0.1:8000/')+'?seed=facefield');
    await page.waitForFunction(()=>document.querySelector('.butterfly')?.style.transform);
    const state=()=>page.locator('#world').getAttribute('data-moth-story');
    const move=async visible=>page.evaluate(visible=>{
      const w=document.querySelector('#world'),t=document.querySelector('[data-singer]');
      if(visible)w.scrollTo(t.offsetLeft+t.offsetWidth/2-w.clientWidth/2,t.offsetTop+t.offsetHeight/2-w.clientHeight/2);
      else w.scrollTo(t.offsetLeft<w.scrollWidth/2?w.scrollWidth:0,t.offsetTop<w.scrollHeight/2?w.scrollHeight:0);
      return [w.scrollLeft,w.scrollTop];
    },visible);
    await page.evaluate(()=>{
      const w=document.querySelector('#world');window.storyTransitions=[];
      new MutationObserver(()=>{
        const state=w.dataset.mothStory,t=document.querySelector('[data-singer]'),r=t.getBoundingClientRect();
        window.storyTransitions.push({state,visible:r.right>0&&r.bottom>0&&r.left<innerWidth&&r.top<innerHeight,
          mode:document.querySelector('.butterfly').dataset.mode});
      }).observe(w,{attributes:true,attributeFilter:['data-moth-story']});
      document.querySelector('#kill-moth').click();
    });
    assert.ok(await page.locator('[data-singer]').evaluate(t=>{
      const r=t.getBoundingClientRect(),margin=Math.max(innerWidth,innerHeight);
      return r.right<=-margin||r.left>=innerWidth+margin||r.bottom<=-margin||r.top>=innerHeight+margin;
    }),'new singer is at least a viewport away');
    const camera=await move(true);
    await page.clock.runFor(16000);
    assert.equal(await state(),'singing','getting there early defers the event indefinitely');
    assert.notEqual(await page.locator('.butterfly').getAttribute('data-mode'),'dead');
    assert.deepEqual(await page.locator('#world').evaluate(w=>[w.scrollLeft,w.scrollTop]),camera,'player camera remains unrestricted');
    await move(false);await page.clock.runFor(32);assert.equal(await state(),'scream');
    await page.clock.runFor(720);await move(true);await page.clock.runFor(32);
    assert.equal(await state(),'singing','fast arrival during scream cancels death');
    assert.equal(await page.locator('[data-singer]').getAttribute('data-audio-scene'),'song');
    assert.notEqual(await page.locator('.butterfly').getAttribute('data-mode'),'dead');
    // Move across the whole world once per animation frame, including around
    // the point at which an uninterrupted introduction would have completed.
    for(let i=0;i<310;i++){await move(i%2===0);await page.clock.runFor(16);}
    assert.notEqual(await page.locator('.butterfly').getAttribute('data-mode'),'dead');
    await move(false);
    for(let i=0;i<80&&await state()!=='death';i++)await page.clock.runFor(100);
    assert.equal(await state(),'death');
    assert.equal(await page.locator('.butterfly').getAttribute('data-mode'),'dead','death resolves immediately offscreen');
    await move(true);await page.clock.runFor(32);
    const point=await page.locator('.butterfly').getAttribute('style');await page.clock.runFor(300);
    assert.equal(await page.locator('.butterfly').getAttribute('style'),point,'scrolling in cannot reveal a fall');
    await page.clock.runFor(1500);assert.equal(await state(),'discovered');
    const transitions=await page.evaluate(()=>storyTransitions);
    assert.ok(transitions.some(t=>t.state==='death'));
    assert.ok(transitions.filter(t=>['scream','death'].includes(t.state)).every(t=>!t.visible),'no scream or death starts onscreen');
    await page.evaluate(()=>document.querySelector('[data-singer]').click());assert.equal(await state(),'idle');
    assert.deepEqual(errors,[]);
    console.log('PASS offscreen story: distant selection, visible singer waits, last-moment scream cancellation, frame-by-frame cross-world scrolling, atomic hidden death, unchanged camera and normal discovery/resolution.');
  }finally{await browser.close();}
})();
