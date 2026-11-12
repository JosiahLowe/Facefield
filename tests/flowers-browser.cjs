const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const base = process.env.FACEFIELD_URL || 'http://127.0.0.1:8000/';

(async () => {
  const browser = await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const page = await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    const errors=[]; page.on('pageerror',e=>errors.push(e.message));
    await page.clock.install();
    await page.goto(base+'?seed=facefield');
    await page.waitForSelector('.flower');
    await page.waitForFunction(()=>document.querySelector('#world').scrollTop>0);
    const initial = await page.locator('.flower').evaluateAll(fs=>({
      cues:fs.filter(f=>f.dataset.stage==='bloom').length,
      buds:fs.filter(f=>f.dataset.stage==='growing').length,
    }));
    assert.ok(initial.cues>5 && initial.buds>5,'immediate flowers give a cue while the remaining buds grow');
    await page.clock.fastForward(21000);
    await page.waitForFunction(()=>!document.querySelector('.flower[data-stage=growing]'));
    const read = () => page.locator('.flower').evaluateAll(fs=>Object.fromEntries(fs.map(f=>[f.dataset.flower,f.getAttribute('transform')])));
    const position=await page.locator('#world').evaluate(w=>[w.scrollLeft,w.scrollTop]);
    const before=await read();
    await page.locator('#world').evaluate(w=>w.scrollTo(0,0));
    await page.waitForTimeout(200);
    const farCount=await page.locator('.flower').count();
    await page.locator('#world').evaluate((w,[x,y])=>w.scrollTo(x,y),position);
    await page.waitForTimeout(200);
    assert.deepEqual(await read(),before,'scroll return preserves flower positions and appearance');
    assert.ok(Object.keys(before).length>farCount*2,'vegetation visibly increases toward the singer');
    assert.equal(farCount,0,'no flowers far from any singer patch');
    assert.ok(await page.locator('.flower-petals').evaluateAll(ps=>ps.every(p=>p.getAttribute('fill')==='#FFFFFF')),'all petals are white');
    assert.ok(await page.locator('.flower-petals').evaluateAll(ps=>ps.every(p=>[...p.children].every(g=>g.firstElementChild.tagName==='ellipse'))),'every petal is rounded');
    assert.equal(await page.locator('.flower-head [fill="#D0A35B"]').count(),0,'flower heads contain no yellow');
    const sizes=await page.locator('.flower').evaluateAll(fs=>fs.map(f=>+f.getAttribute('transform').match(/scale\(([\d.]+)/)[1]));
    assert.ok(Math.max(...sizes)/Math.min(...sizes)>1.5,'flowers have noticeably varied sizes');
    assert.ok(await page.locator('.flower').evaluateAll(fs=>fs.every(f=>Number.isInteger(+f.dataset.x)||Number.isInteger(+f.dataset.y))),'all roots sit on seams');

    async function clearance() {
      return page.evaluate(()=>{
        const flowers=[...document.querySelectorAll('.flower')].map(f=>({id:f.dataset.site,box:f.getBoundingClientRect()}));
        const features=[...document.querySelectorAll('.face circle,.face [data-feature=nose],.face [data-feature=mouth]')]
          .map(e=>e.getBoundingClientRect()).filter(b=>b.right>0&&b.left<innerWidth&&b.bottom>0&&b.top<innerHeight);
        return flowers.filter(({box:a})=>features.some(b=>a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top)).map(f=>f.id);
      });
    }
    assert.deepEqual(await clearance(),[],'flower geometry clears eyes, noses and mouths');
    assert.equal(await page.locator('#flower-shadow').count(),1,'one shared shadow definition');
    assert.ok(await page.locator('.flower').evaluateAll(fs=>fs.every(f=>
      f.querySelector('.flower-head').getAttribute('filter')==='url(#flower-shadow)'
      && f.querySelector('.flower-leaves').getAttribute('filter')==='url(#flower-shadow)')),'heads and leaves cast local shadows');
    const quietPetals=()=>page.locator('.flower-petals').evaluateAll(ps=>ps.map(p=>+p.getAttribute('transform').match(/[\d.]+/)[0]));
    const rotations=await page.locator('.flower-growth').evaluateAll(gs=>gs.map(g=>g.getAttribute('transform')));
    let blooms=0,resting=0;
    for(let i=0;i<8;i++){
      await page.clock.fastForward(1000);await page.waitForTimeout(60);
      const scales=await quietPetals();
      blooms+=scales.filter(s=>s>1.002).length;resting+=scales.filter(s=>s===1).length;
      assert.ok(scales.every(s=>s<=1.04),'idle blooms are small');
      assert.deepEqual(await clearance(),[],'sway and blooms retain facial clearance');
    }
    assert.ok(blooms>0&&resting>blooms,'idle blooms are occasional and independent');
    const swaying=await page.locator('.flower-growth').evaluateAll((gs,before)=>gs.filter((g,i)=>g.getAttribute('transform')!==before[i]).length,rotations);
    assert.ok(swaying>10,'flowers sway independently at their stem bases');
    await page.locator('#enable-sound').tap();
    await page.waitForFunction(()=>[...document.querySelectorAll('.flower-petals')].some(p=>+p.getAttribute('transform').match(/[\d.]+/)[0]>1.045));
    assert.deepEqual(await clearance(),[],'music expansion preserves facial clearance');
    await page.locator('#enable-sound').tap();
    await page.waitForTimeout(1600);
    assert.ok(await page.locator('.flower-petals').evaluateAll(ps=>ps.every(p=>+p.getAttribute('transform').match(/[\d.]+/)[0]<1.041)),'muting releases music pulses while idle blooming remains restrained');

    const previous=await page.locator('[data-singer]').getAttribute('data-index');
    await page.locator('[data-singer]').evaluate(t=>t.click());
    const next=await page.locator('[data-singer]').getAttribute('data-index');
    assert.notEqual(next,previous);
    assert.ok(await page.locator('.flower[data-stage=dry]').count()>10,'old patch remains during gradual wilting');
    const oldSizes=await page.locator('.flower[data-stage=dry]').evaluateAll(fs=>Object.fromEntries(fs.map(f=>[f.dataset.flower,+f.querySelector('.flower-growth').getAttribute('transform').match(/scale\(([\d.]+)/)[1]])));
    await page.clock.fastForward(4000); await page.waitForTimeout(200);
    assert.ok(await page.locator('.flower[data-stage=dry]').evaluateAll((fs,old)=>fs.every(f=>+f.querySelector('.flower-growth').getAttribute('transform').match(/scale\(([\d.]+)/)[1]<old[f.dataset.flower]),oldSizes),'previous patch visibly shrinks after changing singers');
    assert.ok(await page.locator('.flower-petals').evaluateAll(ps=>ps.every(p=>p.getAttribute('fill')==='#FFFFFF')),'wilting petals stay white');
    await page.locator('[data-singer]').evaluate(t=>{
      const w=document.querySelector('#world');w.scrollTo(t.offsetLeft-w.clientWidth/2+t.offsetWidth/2,t.offsetTop-w.clientHeight/2+t.offsetHeight/2);
    });
    await page.waitForTimeout(200);
    const growing=await page.locator('.flower').evaluateAll(fs=>({cues:fs.filter(f=>f.dataset.stage==='bloom').length,buds:fs.filter(f=>f.dataset.stage==='growing').length}));
    assert.ok(growing.cues>3 && growing.buds>3,'next singer is discoverable immediately');
    await page.clock.fastForward(21000);
    await page.waitForTimeout(200);
    await page.locator('#world').evaluate((w,[x,y])=>w.scrollTo(x,y),position);
    await page.waitForTimeout(200);
    const dry=await page.locator('.flower[data-stage=dry]').count();
    assert.ok(dry>0 && dry<=3,'only sparse stable remnants survive at the old singer');
    assert.deepEqual(await clearance(),[],'drooping flowers remain clear of features');
    const remnants=await page.locator('.flower[data-stage=dry]').evaluateAll(fs=>fs.map(f=>[f.dataset.site,f.getAttribute('transform')]));
    await page.locator('#world').evaluate(w=>w.scrollTo(0,0));await page.waitForTimeout(200);
    await page.locator('#world').evaluate((w,[x,y])=>w.scrollTo(x,y),position);await page.waitForTimeout(200);
    assert.deepEqual(await page.locator('.flower[data-stage=dry]').evaluateAll(fs=>fs.map(f=>[f.dataset.site,f.getAttribute('transform')])),remnants);

    await page.emulateMedia({reducedMotion:'reduce'});
    await page.waitForTimeout(400);
    const still=await page.locator('.flowers').innerHTML();
    await page.waitForTimeout(500);
    assert.equal(await page.locator('.flowers').innerHTML(),still,'mature flowers hold still with reduced motion');
    await page.emulateMedia({reducedMotion:'no-preference'});
    const performanceChecks=[];
    for (const viewport of [{width:390,height:844},{width:1440,height:900}]) {
      await page.setViewportSize(viewport); await page.waitForTimeout(250);
      await page.locator('[data-singer]').evaluate(t=>{
        const w=document.querySelector('#world');w.scrollTo(t.offsetLeft-w.clientWidth/2+t.offsetWidth/2,t.offsetTop-w.clientHeight/2+t.offsetHeight/2);
      });
      await page.waitForTimeout(200);
      const result=await page.evaluate(async()=>{
        const samples=[],start=performance.now();let last=start;
        return new Promise(resolve=>{function frame(now){samples.push(now-last);last=now;
          if(now-start<1200)requestAnimationFrame(frame);else{samples.sort((a,b)=>a-b);resolve({frames:samples.length,p95:samples[Math.floor(samples.length*.95)],flowers:document.querySelectorAll('.flower').length,world:[world.scrollWidth,world.scrollHeight]});}}
          requestAnimationFrame(frame);
        });
      });
      assert.ok(result.flowers<=420 && result.frames>20 && result.p95<100,JSON.stringify(result));
      assert.equal(result.world[0],result.world[1],'SVG overlay does not expand world bounds');
      performanceChecks.push({viewport,...result});
      if (viewport.width===390) await page.screenshot({path:'/tmp/facefield-flowers-mobile.png'});
    }
    assert.deepEqual(errors,[]);
    await page.screenshot({path:'/tmp/facefield-flowers-desktop.png'});
    console.log('PASS flower ecosystem: deterministic scroll return, density cue, clearance, audio pulse/mute, growth/wilt/remnants, reduced motion, bounded rendering.',JSON.stringify({initial,growing,performanceChecks}));
  } finally { await browser.close(); }
})();
