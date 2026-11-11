const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},reducedMotion:'reduce'});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.FACEFIELD_URL || 'http://127.0.0.1:8000/';
 await page.goto(base+'?seed=facefield');await page.waitForSelector('.face svg');
 await page.waitForFunction(()=>document.querySelector('#world').scrollTop>0);
 await page.waitForTimeout(100);
 for(const width of [320,390,768,1440]){
  await page.setViewportSize({width,height:844});await page.waitForTimeout(100);
  const result=await page.evaluate(()=>{
   const tiles=[...document.querySelectorAll('.face')],rects=tiles.map(t=>t.getBoundingClientRect());
   let overlap=false,uniform=true;
   for(let i=0;i<rects.length;i++)for(let j=i+1;j<rects.length;j++){
    const a=rects[i],b=rects[j];
    if(Math.min(a.right,b.right)-Math.max(a.left,b.left)>.1&&Math.min(a.bottom,b.bottom)-Math.max(a.top,b.top)>.1)overlap=true;
   }
   tiles.forEach(t=>{const matrix=t.querySelector('[data-features]').getScreenCTM();uniform&&=Math.abs(matrix.a-matrix.d)<.001;});
   const ids=[...document.querySelectorAll('[id]')].map(e=>e.id);
   return {count:tiles.length,overlap,uniform,uniqueIds:new Set(ids).size===ids.length,
    width:document.documentElement.scrollWidth, shapes:new Set(tiles.map(t=>t.querySelector('svg').dataset.shape)).size,
    sizes:new Set(rects.map(r=>`${Math.round(r.width)}x${Math.round(r.height)}`)).size};
  });
  assert.deepEqual(result,{count:1152,overlap:false,uniform:true,uniqueIds:true,width,shapes:2,sizes:4});
 }
 await page.setViewportSize({width:390,height:844});await page.waitForTimeout(100);
 const before=await page.locator('.face').evaluateAll(ts=>ts.map(t=>({html:t.innerHTML,area:t.style.gridArea})));
 await page.locator('.face').nth(2).click();
 const after=await page.locator('.face').evaluateAll(ts=>ts.map(t=>({html:t.innerHTML,area:t.style.gridArea})));
 for(let i=0;i<1152;i++){
  assert.equal(before[i].area,after[i].area);
  assert.equal(before[i].html,after[i].html);
 }
 const state=await page.locator('#grid').innerHTML();await page.reload();await page.waitForSelector('.face');
 assert.equal(await page.locator('#grid').innerHTML(),state);
 await page.locator('#shuffle').click();assert.notEqual(await page.locator('#grid').innerHTML(),state);
 assert.deepEqual(errors,[]);console.log('PASS mosaic browser: 320/390/768/1440px, four sizes with rectangular silhouettes, no overlap/overflow, uniform facial scale, unique gradient IDs, inert face taps, exact seed reload and shuffle.');
 await browser.close();
})();
