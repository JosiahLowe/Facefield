const {chromium}=require('playwright'),assert=require('node:assert/strict');
(async()=>{const browser=await chromium.launch({executablePath:'/usr/bin/chromium',args:['--no-sandbox']});try{
 const page=await browser.newPage({viewport:{width:393,height:852},isMobile:true,hasTouch:true});const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.FACEFIELD_URL||'http://127.0.0.1:8000/')+'?seed=facefield&style=crowd');await page.waitForSelector('#grid[data-visual-mode=crowd]');
 await page.locator('[data-singer]').evaluate(t=>{const w=document.querySelector('#world');w.scrollTo(t.offsetLeft+t.offsetWidth/2-w.clientWidth/2,t.offsetTop+t.offsetHeight/2-w.clientHeight/2);});
 const before=await page.locator('[data-singer]').getAttribute('data-index');
 const point=await page.locator('[data-singer] [data-crowd-head-shape]').evaluate(head=>{const p=new DOMPoint(50,52).matrixTransform(head.getScreenCTM());return {x:p.x,y:p.y};});
 await page.touchscreen.tap(point.x,point.y);await page.waitForTimeout(150);
 assert.notEqual(await page.locator('[data-singer]').getAttribute('data-index'),before,'touch selects the visible singer head');
 const snapshot=()=>page.locator('.face').evaluateAll(ts=>ts.map(t=>[t.dataset.index,t.style.left,t.style.top,t.querySelector('[data-crowd-head-shape]').outerHTML]));
 const stable=await snapshot();const camera=await page.locator('#world').evaluate(w=>[w.scrollLeft,w.scrollTop]);
 await page.locator('#world').evaluate(w=>w.scrollBy(500,500));await page.waitForTimeout(100);await page.locator('#world').evaluate((w,p)=>w.scrollTo(...p),camera);
 assert.deepEqual(await snapshot(),stable,'scrolling preserves character geometry and positions');
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(600);await page.selectOption('#visual-style','original');await page.selectOption('#visual-style','crowd');
 assert.equal(await page.locator('.face').count(),1152);assert.deepEqual(errors,[]);
 console.log('PASS Crowd mobile interactions: projected singer touch target, stable scrolling geometry, reduced-motion switching.');
 }finally{await browser.close();}})();
