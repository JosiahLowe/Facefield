const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Hold the existing flight in its supported hover mode so actual gaze can settle.
 await page.addInitScript(()=>{Math.random=()=>.1;});
 await page.goto((process.env.FACEFIELD_URL||'http://127.0.0.1:8000/')+'?seed=facefield');
 await page.waitForFunction(()=>document.querySelector('.fly')?.style.transform);
 const sample=()=>page.evaluate(()=>{
  const body=document.querySelector('.fly-body').getBoundingClientRect(),fly={x:body.x+body.width/2,y:body.y+body.height/2};
  return [...document.querySelectorAll('.face')].map(tile=>{
   const rect=tile.getBoundingClientRect();if(rect.bottom<0||rect.y>innerHeight||rect.right<0||rect.x>innerWidth)return null;
   const c=tile.querySelectorAll('circle'),n=(e,a)=>+e.getAttribute(a);
   const eye=new DOMPoint((n(c[0],'cx')+n(c[2],'cx'))/2,n(c[0],'cy')).matrixTransform(c[0].getScreenCTM());
   const dx=fly.x-eye.x,dy=fly.y-eye.y,d=Math.hypot(dx,dy),travel=n(c[0],'r')-n(c[1],'r');
   const x=(n(c[1],'cx')-n(c[0],'cx'))/travel,y=(n(c[1],'cy')-n(c[0],'cy'))/travel;
   return {index:tile.dataset.index,d,alignment:(x*dx+y*dy)/Math.max(1,d)};
  }).filter(Boolean).sort((a,b)=>a.d-b.d);
 });
 const checks=[];
 for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
  await page.setViewportSize(viewport);
  await page.locator('#world').evaluate(w=>w.scrollTo((w.scrollWidth-w.clientWidth)/2,(w.scrollHeight-w.clientHeight)/2));
  await page.waitForTimeout(viewport.width===390?1600:5500);
  const near=(await sample())[0];
  assert.ok(near.d<110&&near.alignment>.3,'actual app connects fly position to nearby pupils: '+JSON.stringify(near));
  checks.push({width:viewport.width,...near});
 }
 await page.setViewportSize({width:390,height:844});
 await page.locator('#world').evaluate(w=>w.scrollBy(800,500));await page.waitForTimeout(6500);
 const followed=(await sample())[0];
 assert.ok(followed.d<110&&followed.alignment>.3,'gaze tracks the real fly after scroll and delayed catch-up: '+JSON.stringify(followed));
 assert.equal(await page.locator('.fly').count(),1);
 assert.equal(await page.locator('.fly-wing').evaluateAll(wings=>wings.every(wing=>wing.tagName==='path')),true,'loads the attached-wing asset');
 assert.deepEqual(errors,[]);
 console.log('PASS actual app fly-to-eye wiring:',JSON.stringify({checks,followed}));
 await browser.close();
})();
