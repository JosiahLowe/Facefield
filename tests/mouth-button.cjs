const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.FACEFIELD_URL || 'http://127.0.0.1:8000/')+'?seed=facefield');
 await page.waitForSelector('.face');
 const selector='svg > path:not([data-feature]):not([data-animation])';
 const read=()=>page.locator(selector).evaluateAll(ps=>ps.map(p=>p.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number)));
 const bend=p=>p[3]-(p[1]+p[5])/2;
 const assertFlipped=(before,after)=>{
  for(let i=0;i<36;i++){
   const a=bend(before[i]),b=bend(after[i]);
   assert.ok(a ? Math.sign(b)===-Math.sign(a) : Math.abs(b)>=12,`tile ${i} switches expression`);
   assert.equal(after[i][0],before[i][0]);assert.equal(after[i][4],before[i][4]);
  }
  for(let i=40;i<192;i++)assert.deepEqual(after[i],before[i]);
 };
 const url=page.url();
 assert.equal(await page.locator('#test-mouths').innerText(),'Flip mouths');
 let before=await read();
 for(let i=0;i<3;i++){
  await page.locator('#test-mouths').click();await page.waitForTimeout(1000);
  const after=await read();assertFlipped(before,after);before=after;
 }
 assert.equal(page.url(),url);
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(600);
 // Simulate an expression already opposite to the generated resting expression.
 // This catches the old bug of choosing a target from rest instead of the screen.
 await page.locator(selector).evaluateAll(ps=>ps.slice(0,36).forEach(p=>{
  const n=p.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);
  const y=(n[1]+n[5])/2, opposite=-(Math.sign(n[3]-y)||1)*14;
  p.setAttribute('d',`M ${n[0]} ${y} Q ${n[2]} ${y+opposite} ${n[4]} ${y}`);
 }));
 before=await read();await page.locator('#test-mouths').click();
 const still=await read();assertFlipped(before,still);
 await page.waitForTimeout(250);assert.deepEqual(await read(),still);
 await page.setViewportSize({width:320,height:568});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth),320);
 const control=await page.locator('.controls').boundingBox();assert.ok(control.x>=0&&control.x+control.width<=320);
 await page.locator('#shuffle').click();assert.equal(await page.locator('.face').count(),192);
 assert.deepEqual(errors,[]);
 console.log('PASS: repeated flips reverse the displayed curve, including previously changed expressions and reduced motion; width, seed, offscreen faces, and mobile layout preserved.');
 await browser.close();
})();
