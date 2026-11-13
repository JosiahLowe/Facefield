const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH || '/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto((process.env.FACEFIELD_URL || 'http://127.0.0.1:8000/') + '?seed=facefield');
 await page.waitForSelector('.face svg');
 await page.waitForFunction(()=>document.querySelector('#world').scrollTop>0);
 await page.waitForTimeout(100);
 const result=await page.evaluate(async()=>{
  const visibleIndices=[...document.querySelectorAll('.face')].map((t,i)=>({i,r:t.getBoundingClientRect()})).filter(({r})=>r.bottom>0&&r.top<innerHeight&&r.right>0&&r.left<innerWidth).map(({i})=>i);
  const start=performance.now();let frames=0, bounds=true, coordinated=true, closed=false;
  const mouthMoved=new Set();let mouthBounds=true,nosesUnchanged=true,neutralRest=false,noFarSmiles=true;
  const neutralStarts=new Map(),previousBends=new Map();
  const mouthPaths=[...document.querySelectorAll('[data-feature=mouth]')];
  const mouthRest=mouthPaths.map(p=>p.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number));
  const noses=[...document.querySelectorAll('[data-feature=nose]')].map(p=>p.getAttribute('d'));
  const moved=new Set(), blinked=new Set();const initial=[...document.querySelectorAll('.face')].map(t=>t.querySelectorAll('circle')[1].getAttribute('cx'));
  return await new Promise(resolve=>{
   function check(){frames++;
    [...document.querySelectorAll('.face')].forEach((tile,index)=>{
     const c=[...tile.querySelectorAll('circle')]; const offsets=[];
     const mouth=mouthPaths[index].getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number), rest=mouthRest[index];
     if(mouth.some((n,i)=>Math.abs(n-rest[i])>.0001))mouthMoved.add(index);
     const bend=mouth[3]-(mouth[1]+mouth[5])/2;
     if(tile.dataset.mothNearby!=='true')noFarSmiles&&=bend<=.000001&&+tile.querySelector('[data-feature=cheeks]').getAttribute('opacity')===0;
     const now=performance.now();
     if(bend===0 && previousBends.has(index) && previousBends.get(index)!==0)neutralStarts.set(index,now);
     if(bend!==0)neutralStarts.delete(index);
     if(neutralStarts.has(index)&&now-neutralStarts.get(index)>=3900)neutralRest=true;
     previousBends.set(index,bend);
     mouthBounds&&=mouth[0]===rest[0]&&mouth[2]===rest[2]&&mouth[4]===rest[4]&&Math.abs(mouth[3]-rest[1])<=Math.max(16,Math.abs(rest[3]-rest[1]))+.001&&Math.abs(mouth[1]-rest[1])<=.7701&&Math.abs(mouth[5]-rest[5])<=.7701;
     nosesUnchanged&&=tile.querySelector('[data-feature=nose]').getAttribute('d')===noses[index];
     for(let i=0;i<4;i+=2){const num=(e,a)=>+e.getAttribute(a);const eye=c[i],p=c[i+1],r=num(eye,'r'),pr=num(p,'r'); const dx=num(p,'cx')-num(eye,'cx'),dy=num(p,'cy')-num(eye,'cy');bounds&&=Math.hypot(dx,dy)+pr<=r+.003;offsets.push([dx/(r-pr),dy/(r-pr)]);}
     coordinated&&=Math.abs(offsets[0][0]-offsets[1][0])<.003&&Math.abs(offsets[0][1]-offsets[1][1])<.003;
     if(c[1].getAttribute('cx')!==initial[index])moved.add(index);
     const lids=[...tile.querySelectorAll('[data-animation=blink]')];
     if(lids.length){blinked.add(index);const paths=lids.map(l=>l.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number));closed||=paths[0][1]>=paths[1][1];}
    });
    if(performance.now()-start>18000)resolve({frames,bounds,coordinated,closed,moved:[...moved],blinked:[...blinked],mouthMoved:[...mouthMoved],mouthBounds,nosesUnchanged,neutralRest,noFarSmiles,visibleIndices});else requestAnimationFrame(check);
   }check();
  });
 });
 assert.ok(result.noFarSmiles,'only moth-aware faces smile or blush');
 assert.ok(result.mouthMoved.length>4&&result.mouthBounds&&result.nosesUnchanged);

 assert.ok(result.moved.every(i=>result.visibleIndices.includes(i)));
 assert.ok(result.mouthMoved.every(i=>result.visibleIndices.includes(i)));
 assert.ok(result.frames>100);assert.ok(result.bounds&&result.coordinated&&result.closed);assert.ok(result.moved.length>4&&result.blinked.length>4);

 await page.emulateMedia({reducedMotion:'reduce'});
 await page.waitForTimeout(100);
 assert.equal(await page.locator('[data-animation=blink]').count(),0);
 const still=await page.locator('#grid').innerHTML();await page.waitForTimeout(500);assert.equal(await page.locator('#grid').innerHTML(),still);
 const restored=await page.locator('.face').evaluateAll(ts=>ts.map(t=>[...t.querySelectorAll('circle')].map(c=>[c.getAttribute('cx'),c.getAttribute('cy')])));
 // A reload with reduced motion must reproduce exactly the original gaze.
 await page.reload();
 assert.ok(await page.locator('.face').evaluateAll(ts=>ts.every(t=>{const m=t.querySelector('[data-feature=mouth]').getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);return t.dataset.mothNearby==='true'||m[3]-(m[1]+m[5])/2<=0;})),'reduced-motion reload keeps smiles confined to the moth');
 const reloaded=await page.locator('.face').evaluateAll(ts=>ts.map(t=>[...t.querySelectorAll('circle')].map(c=>[c.getAttribute('cx'),c.getAttribute('cy')])));
 for(let i=0;i<restored.length;i++) assert.ok(JSON.stringify(reloaded[i])===JSON.stringify(restored[i]), 'restored gaze mismatch tile '+i+': '+JSON.stringify({restored:restored[i],reloaded:reloaded[i]}));
 await page.emulateMedia({reducedMotion:'no-preference'});
 await page.locator('.face').nth(0).click();
 await page.waitForTimeout(250);assert.equal(await page.locator('.face').count(),1152);assert.deepEqual(errors,[]);
 console.log('PASS animated browser:',JSON.stringify(result));
 await browser.close();
})();
