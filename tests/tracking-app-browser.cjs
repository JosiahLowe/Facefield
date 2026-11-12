const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 // Replay deterministic flower selections while checking the actual insect-to-eye wiring.
 await page.addInitScript(()=>{Math.random=()=>.1;});
 await page.goto((process.env.FACEFIELD_URL||'http://127.0.0.1:8000/')+'?seed=facefield');
 await page.waitForFunction(()=>document.querySelector('.butterfly')?.style.transform);
 const sample=()=>page.evaluate(()=>{
  const body=document.querySelector('.butterfly-body').getBoundingClientRect(),fly={x:body.x+body.width/2,y:body.y+body.height/2};
  return [...document.querySelectorAll('.face')].map(tile=>{
   const rect=tile.getBoundingClientRect();if(rect.bottom<0||rect.y>innerHeight||rect.right<0||rect.x>innerWidth)return null;
   const c=tile.querySelectorAll('circle'),n=(e,a)=>+e.getAttribute(a);
   const eye=new DOMPoint((n(c[0],'cx')+n(c[2],'cx'))/2,n(c[0],'cy')).matrixTransform(c[0].getScreenCTM());
   const dx=fly.x-eye.x,dy=fly.y-eye.y,d=Math.hypot(dx,dy),travel=n(c[0],'r')-n(c[1],'r');
   const x=(n(c[1],'cx')-n(c[0],'cx'))/travel,y=(n(c[1],'cy')-n(c[0],'cy'))/travel;
   return {index:tile.dataset.index,d,alignment:(x*dx+y*dy)/Math.max(1,d)};
  }).filter(Boolean).sort((a,b)=>a.d-b.d);
 });
 async function expectTracking(message){
  let near;
  for(let i=0;i<25;i++){
   near=(await sample())[0];
   if(near.d<150&&near.alignment>.3)return near;
   await page.waitForTimeout(200);
  }
  assert.fail(message+': '+JSON.stringify(near));
 }
 const checks=[];
 for(const viewport of [{width:390,height:844},{width:1440,height:900}]){
  await page.setViewportSize(viewport);
  await page.locator('.butterfly').evaluate(b=>{const w=document.querySelector('#world');w.scrollTo(+b.dataset.worldX-w.clientWidth/2,+b.dataset.worldY-w.clientHeight/2);});
  await page.waitForTimeout(viewport.width===390?1600:5500);
  const near=await expectTracking('actual app connects butterfly position to nearby pupils');
  checks.push({width:viewport.width,...near});
 }
 await page.setViewportSize({width:390,height:844});
 const before=await page.locator('.butterfly').evaluate(b=>[+b.dataset.worldX,+b.dataset.worldY]);
 await page.locator('#world').evaluate(w=>w.scrollTo(0,0));await page.waitForTimeout(700);
 const away=await page.locator('.butterfly').evaluate(b=>[+b.dataset.worldX,+b.dataset.worldY]);
 assert.ok(Math.hypot(away[0]-before[0],away[1]-before[1])<400,'butterfly stays at the flowers rather than pursuing the viewport');
 await page.locator('.butterfly').evaluate(b=>{const w=document.querySelector('#world');w.scrollTo(+b.dataset.worldX-w.clientWidth/2,+b.dataset.worldY-w.clientHeight/2);});
 await page.waitForTimeout(900);
 const followed=await expectTracking('gaze follows the butterfly when returning to its flower patch');
 assert.equal(await page.locator('.butterfly').count(),1);
 assert.equal(await page.locator('.butterfly-wing').evaluateAll(wings=>wings.every(wing=>wing.tagName==='g')),true,'loads the geometric butterfly wings');
 assert.deepEqual(errors,[]);
 console.log('PASS actual app butterfly-to-eye wiring:',JSON.stringify({checks,followed}));
 await browser.close();
})();
