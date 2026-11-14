const {chromium}=require('playwright'),assert=require('node:assert/strict'),h=require('./story-helpers.cjs');
(async()=>{const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const {page,errors}=await h.setup(browser);const start=await h.start(page);assert.deepEqual(start.before,start.after);
  assert.equal(await h.state(page),'chorus_starting');assert.equal(await page.locator('#kill-moth').isDisabled(),true);
  await page.evaluate(()=>{document.querySelector('#kill-moth').click();document.querySelector('[data-singer]').click();});assert.equal(await page.locator('[data-singer]').getAttribute('data-index'),start.singer);
  await h.arrive(page);await page.clock.runFor(12000);assert.equal(await h.state(page),'chorus_active','watching keeps a living chorus, regardless of song time');
  await h.die(page);assert.equal(await page.locator('.butterfly').getAttribute('data-mode'),'dead');
  assert.equal(await page.locator('[data-chorus-voice]').count(),0);assert.equal(await page.locator('.flower').count(),0);
  const dead=await page.locator('.butterfly').getAttribute('style');await page.clock.runFor(2000);assert.equal(await page.locator('.butterfly').getAttribute('style'),dead);
  assert.equal(await h.state(page),'crying','corpse stays at its offscreen location');
  await h.move(page);await page.clock.runFor(300);assert.equal(await h.state(page),'discovered');
  assert.equal(await page.locator('.flower').count(),0);assert.equal(await page.locator('[data-singer]').getAttribute('data-story-expression'),'crying');
  assert.ok(await page.locator('[data-singer] [data-feature=tears] path').count()>=2);assert.ok(await page.locator('[data-mourning=true]').count()>0);
  assert.ok(await page.locator('[data-mourning=true]').evaluateAll(ts=>ts.every(t=>{const m=t.querySelector('[data-feature=mouth]'),p=m.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);return p[3]-(p[1]+p[5])/2<0&&+t.querySelector('[data-feature=cheeks]').getAttribute('opacity')===0;})));
  assert.equal(await page.locator('.moth-remnant').evaluate(e=>getComputedStyle(e).display),'block');
  const clear=await page.evaluate(()=>{
   const s=document.querySelector('[data-singer]'),b=document.querySelector('.butterfly'),a=[...b.querySelectorAll('.moth-wing-shape,.moth-head,.moth-abdomen,.moth-remnant path,.moth-remnant circle')].map(e=>e.getBoundingClientRect());
   const f=[...s.querySelectorAll('circle:not([data-feature=cheek]),[data-feature=nose],[data-feature=mouth]')].map(e=>e.getBoundingClientRect());return !a.some(r=>f.some(c=>r.left<c.right&&r.right>c.left&&r.top<c.bottom&&r.bottom>c.top));
  });assert.ok(clear,'corpse and splats stay clear of the singer features');
  await page.screenshot({path:'/tmp/facefield-chorus-aftermath.png'});
  await page.emulateMedia({reducedMotion:'reduce'});await page.clock.runFor(600);const still=await page.locator('[data-singer]').innerHTML();await page.clock.runFor(500);assert.equal(await page.locator('[data-singer]').innerHTML(),still);
  await page.evaluate(()=>document.querySelector('[data-singer]').click());assert.equal(await h.state(page),'idle');assert.equal(await page.locator('#kill-moth').isDisabled(),false);
  assert.equal(await page.locator('[data-mourning],[data-story-expression],[data-feature=tears]').count(),0);assert.equal(await page.locator('.butterfly').count(),1);assert.notEqual(await page.locator('.butterfly').getAttribute('data-mode'),'dead');
  await h.move(page);await page.clock.runFor(300);assert.ok(await page.locator('.flower').count()>0,'normal flowers resume');
  await page.evaluate(()=>document.querySelector('#kill-moth').click());assert.equal(await h.state(page),'chorus_starting','event can run again');
  await h.arrive(page);await h.die(page);assert.equal(await page.locator('.butterfly').getAttribute('data-mode'),'dead','full repeat event works under reduced motion');
  assert.deepEqual(errors,[]);console.log('PASS chorus story: watched chorus, exploration-gated offscreen death, fixed corpse, flowers clear, local mourning/eye tracking, safe corner, discovery, reduced motion, cleanup and repeatability.');
 }finally{await browser.close();}})();
