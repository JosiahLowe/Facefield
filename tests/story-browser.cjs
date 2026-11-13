const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));
    await page.addInitScript(()=>{Math.random=()=>.8;});
    await page.clock.install();
    await page.goto((process.env.FACEFIELD_URL||'http://127.0.0.1:8000/')+'?seed=facefield');
    await page.waitForFunction(()=>document.querySelector('.butterfly')?.style.transform);
    const state=()=>page.locator('#world').getAttribute('data-moth-story');
    const point=()=>page.locator('.butterfly').evaluate(b=>[+b.dataset.worldX,+b.dataset.worldY]);
    const camera=()=>page.locator('#world').evaluate(w=>[w.scrollLeft,w.scrollTop]);
    const scroll=await camera(),old=await page.locator('[data-singer]').getAttribute('data-index');
    const positions=await page.evaluate(()=>{
      const b=document.querySelector('.butterfly'),read=()=>[+b.dataset.worldX,+b.dataset.worldY];
      const before=read();document.querySelector('#kill-moth').click();return {before,after:read()};
    });
    assert.equal(await state(),'traveling');
    const next=await page.locator('[data-singer]').getAttribute('data-index');assert.notEqual(next,old);
    assert.deepEqual(positions.after,positions.before,'no teleport when triggered');
    assert.equal(await page.locator('#kill-moth').isDisabled(),true);
    await page.evaluate(()=>{document.querySelector('#kill-moth').click();document.querySelector('[data-singer]').click();});
    assert.equal(await page.locator('[data-singer]').getAttribute('data-index'),next,'active event cannot be interrupted by taps');
    for(let i=0;i<20&&await state()==='traveling';i++)await page.clock.runFor(1000);
    assert.equal(await state(),'singing','offscreen moth reaches singer');
    const arrival=await page.evaluate(()=>{
      const b=document.querySelector('.butterfly'),s=document.querySelector('[data-singer]'),u=document.querySelector('#grid').clientWidth/48;
      return Math.hypot(+b.dataset.worldX-(s.offsetLeft+s.offsetWidth/2),+b.dataset.worldY-(s.offsetTop+s.offsetHeight/2-.32*u));
    });
    assert.ok(arrival<10,'actual arrival before introduction');
    assert.deepEqual(await camera(),scroll,'camera never follows the story');
    for(let i=0;i<60&&await state()==='singing';i++)await page.clock.runFor(100);
    assert.equal(await state(),'scream');
    assert.equal(await page.locator('[data-singer]').getAttribute('data-story-expression'),'scream');
    assert.equal(await page.locator('[data-singer]').getAttribute('data-audio-scene'),'scream');
    await page.clock.runFor(900);assert.equal(await state(),'death');
    assert.equal(await page.locator('[data-singer]').getAttribute('data-audio-scene'),'silence');
    const wings=await page.locator('.butterfly-wing').evaluateAll(ws=>ws.map(w=>w.getAttribute('transform')));
    await page.clock.runFor(200);
    assert.deepEqual(await page.locator('.butterfly-wing').evaluateAll(ws=>ws.map(w=>w.getAttribute('transform'))),wings,'flutter stops during the fall');
    await page.clock.runFor(1300);assert.equal(await state(),'crying');
    assert.equal(await page.locator('[data-singer] [data-feature=tears] ellipse').count(),2);
    assert.equal(await page.locator('[data-singer]').getAttribute('data-story-expression'),'crying');
    assert.equal(await page.locator('[data-singer]').getAttribute('data-audio-scene'),'crying');
    const dead=await point(),wingDead=await page.locator('.butterfly-wing').evaluateAll(ws=>ws.map(w=>w.getAttribute('transform')));
    await page.clock.runFor(2000);
    assert.deepEqual(await point(),dead,'dead moth remains fixed offscreen');
    assert.deepEqual(await page.locator('.butterfly-wing').evaluateAll(ws=>ws.map(w=>w.getAttribute('transform'))),wingDead);
    const sounds=await page.evaluate(async()=>{
      const {playStorySound}=await import('./singing.js');const result=[];
      for(const kind of ['scream','sob']){
        const c=new OfflineAudioContext(1,96000,48000),out=c.createGain();out.gain.value=.25;out.connect(c.destination);
        playStorySound(c,out,kind,.1);const data=(await c.startRendering()).getChannelData(0);
        let peak=0,energy=0;for(const n of data){peak=Math.max(peak,Math.abs(n));energy+=n*n;}
        result.push({peak,rms:Math.sqrt(energy/data.length),tail:data.slice(72000).every(n=>n===0)});
      }return result;
    });
    assert.ok(sounds.every(s=>s.rms>.001&&s.peak<.06&&s.tail),'expressive bounded audio has silent endings');
    assert.equal(await state(),'crying','offscreen scene cannot discover itself');
    await page.evaluate(()=>{
      const w=document.querySelector('#world'),t=document.querySelector('[data-singer]');
      w.scrollTo(t.offsetLeft+t.offsetWidth/2-w.clientWidth/2,t.offsetTop+t.offsetHeight/2-w.clientHeight/2);
    });
    await page.clock.runFor(500);assert.equal(await state(),'discovered');
    assert.equal(await page.locator('[data-singer]').getAttribute('data-audio-scene'),'discovered');
    assert.equal(await page.locator('[data-singer]').getAttribute('data-story-expression'),'crying');
    assert.deepEqual(await point(),dead,'scrolling to discovery does not move the body');
    const tear=await page.locator('[data-singer] [data-feature=tears]').innerHTML();
    await page.clock.runFor(500);
    assert.notEqual(await page.locator('[data-singer] [data-feature=tears]').innerHTML(),tear,'tears move once visible');
    await page.screenshot({path:'/tmp/facefield-moth-story.png'});
    await page.emulateMedia({reducedMotion:'reduce'});await page.clock.runFor(600);
    const staticFace=await page.locator('[data-singer]').innerHTML();await page.clock.runFor(500);
    assert.equal(await page.locator('[data-singer]').innerHTML(),staticFace,'reduced motion keeps a static crying expression');
    await page.evaluate(()=>document.querySelector('[data-singer]').click());
    assert.equal(await state(),'idle');assert.equal(await page.locator('#kill-moth').isDisabled(),false);
    assert.equal(await page.locator('[data-story-expression],[data-feature=tears]').count(),0,'expression and tears cleaned up');
    assert.equal(await page.locator('.butterfly').count(),1,'only one living replacement');
    assert.notEqual(await page.locator('.butterfly').getAttribute('data-mode'),'dead');
    assert.equal(await page.locator('[data-singer]').getAttribute('data-audio-scene'),'song');
    assert.notEqual(await page.locator('[data-singer]').getAttribute('data-index'),next);
    assert.equal(await page.locator('#enable-sound').getAttribute('aria-pressed'),'false','event never enables sound');
    // Repeat while reduced-motion is enabled: necessary world travel continues
    // without flutter, sway, decorative tears, or a falling animation.
    await page.evaluate(()=>{Math.random=()=>0;document.querySelector('#kill-moth').click();});
    const reducedWings=await page.locator('.butterfly-wing').evaluateAll(ws=>ws.map(w=>w.getAttribute('transform')));
    await page.clock.runFor(500);
    assert.deepEqual(await page.locator('.butterfly-wing').evaluateAll(ws=>ws.map(w=>w.getAttribute('transform'))),reducedWings);
    const paused=await page.evaluate(()=>{
      Object.defineProperty(document,'hidden',{configurable:true,value:true});document.dispatchEvent(new Event('visibilitychange'));
      const b=document.querySelector('.butterfly');return [+b.dataset.worldX,+b.dataset.worldY];
    });
    const pauseState=await state();await page.clock.runFor(30000);
    assert.equal(await state(),pauseState);assert.deepEqual(await point(),paused,'backgrounding pauses the narrative');
    await page.evaluate(()=>{delete document.hidden;document.dispatchEvent(new Event('visibilitychange'));});
    for(let i=0;i<25&&await state()!=='crying';i++)await page.clock.runFor(1000);
    assert.equal(await state(),'crying','repeat event completes under reduced motion');
    assert.equal(await page.locator('.butterfly').getAttribute('data-mode'),'dead');
    await page.setViewportSize({width:1440,height:900});
    await page.evaluate(()=>{
      const w=document.querySelector('#world'),s=document.querySelector('[data-singer]');
      w.scrollTo(s.offsetLeft+s.offsetWidth/2-w.clientWidth/2,s.offsetTop+s.offsetHeight/2-w.clientHeight/2);
    });
    await page.clock.runFor(600);assert.equal(await state(),'discovered','corner singer is discoverable after a viewport resize');
    await page.evaluate(()=>document.querySelector('[data-singer]').click());
    assert.equal(await state(),'idle');assert.equal(await page.locator('[data-feature=tears]').count(),0);
    assert.deepEqual(errors,[]);
    console.log('PASS complete moth story: offscreen arrival gate, locked presses, scream/fall/cry ordering, fixed dead moth, visible tears, discovery and cleanup, repeat events, reduced motion, background pause, restrained audio.',sounds);
  }finally{await browser.close();}
})();
