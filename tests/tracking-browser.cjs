const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:600,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 const base=process.env.FACEFIELD_URL||'http://127.0.0.1:8000/';
 await page.route('**/tracking-fixture',route=>route.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width, initial-scale=1"><style>
 body {margin:0} #world {position:fixed;inset:0;overflow:scroll} .grid {position:absolute;top:150px;left:0;width:480px;height:1700px;display:grid;grid-template-columns:repeat(4,120px);grid-auto-rows:120px;align-content:start} .face {width:120px;height:120px} svg {display:block;width:100%;height:100%} #control{opacity:0;pointer-events:none}
 </style><div id="world"><div id="tracked" class="grid"></div><div id="control" class="grid"></div></div><script type="module">
 import {renderFace} from './faces.js';import {animateFaces} from './behavior.js';
 Math.random=()=>.99;window.flyPoint={x:120,y:186};
 for(const id of ['tracked','control']){const grid=document.getElementById(id);const animation=animateFaces(grid,null,()=>id==='tracked'?window.flyPoint:null);for(let i=0;i<5;i++){const tile=document.createElement('div');tile.className='face';if(i===4)tile.style.gridArea='13 / 1';tile.innerHTML=renderFace('tracking-fixture',i).svg;grid.append(tile);animation.register(tile,'tracking-fixture',i,0);}}
 window.ready=true;
 </script>`}));
 await page.goto(base+'tracking-fixture');await page.waitForFunction(()=>window.ready);
 const read=()=>page.evaluate(()=>[...document.querySelectorAll('#tracked .face')].map(tile=>{
  const c=tile.querySelectorAll('circle');return [0,2].map(i=>{const e=c[i],p=c[i+1],n=(el,a)=>+el.getAttribute(a),travel=n(e,'r')-n(p,'r');return [(n(p,'cx')-n(e,'cx'))/travel,(n(p,'cy')-n(e,'cy'))/travel]});
 }));
 const initial=await read();
 const motion=await page.evaluate(async()=>{
  let previous=null,maxStep=0,bounds=true,lids=true,frames=0;
  const start=performance.now();
  return await new Promise(resolve=>{
   function sample(){
    const offsets=[];
    for(const tile of [...document.querySelectorAll('#tracked .face')].slice(0,4)){
     const circles=tile.querySelectorAll('circle');
     for(const i of [0,2]){
      const eye=circles[i],pupil=circles[i+1],n=(e,a)=>+e.getAttribute(a);
      const dx=n(pupil,'cx')-n(eye,'cx'),dy=n(pupil,'cy')-n(eye,'cy');
      bounds&&=Math.hypot(dx,dy)+n(pupil,'r')<=n(eye,'r')+.003;
      offsets.push(dx/(n(eye,'r')-n(pupil,'r')),dy/(n(eye,'r')-n(pupil,'r')));
      const lid=tile.querySelectorAll('[data-feature=eyelid]')[i/2];
      if(lid){const cut=+lid.getAttribute('d').split(' ')[2];lids&&=lid.dataset.side==='top'?n(pupil,'cy')+n(pupil,'r')*.5>=cut-.005:n(pupil,'cy')-n(pupil,'r')*.5<=cut+.005;}
     }
    }
    if(previous)maxStep=Math.max(maxStep,...offsets.map((v,i)=>Math.abs(v-previous[i])));
    previous=offsets;frames++;
    if(performance.now()-start>=750)resolve({maxStep,bounds,lids,frames});else requestAnimationFrame(sample);
   }sample();
  });
 });
 assert.ok(motion.frames>10&&motion.maxStep<.25&&motion.maxStep>0,'tracking moves with a smooth delay');
 assert.ok(motion.bounds&&motion.lids,'pupils stay within eye circles and remain exposed beneath resting lids');
 let tracked=await read();
 assert.ok(tracked[0][0][0]>.3&&tracked[1][0][0]<-.3,'multiple nearby faces look toward the fly from opposite sides: '+JSON.stringify({initial,tracked,errors}));
 assert.deepEqual(tracked[4],initial[4],'offscreen faces receive no pupil updates');
 const far=await page.evaluate(()=>['tracked','control'].map(id=>[...document.querySelectorAll('#'+id+' .face')][3].querySelector('svg').innerHTML));
 assert.equal(far[0],far[1],'outside-radius face keeps its idle behavior');
 await page.locator('#world').evaluate(w=>w.scrollTop=100);await page.waitForTimeout(150);
 tracked=await read();assert.ok(tracked[0][0][0]>.3&&tracked[1][0][0]<-.3,'scrolling preserves world-space gaze direction');
 for(const eyes of tracked)assert.ok(Math.abs(eyes[0][0]-eyes[1][0])<.003&&Math.abs(eyes[0][1]-eyes[1][1])<.003,'pupils remain coordinated');
 const before=await read();await page.evaluate(()=>{window.flyPoint={x:1100,y:1000}});
 const immediate=await read();assert.ok(Math.abs(immediate[1][0][0]-before[1][0][0])<.08,'leaving range does not snap');
 await page.waitForTimeout(6500);
 const difference=await page.evaluate(()=>{
  const tracked=document.querySelectorAll('#tracked circle'),idle=document.querySelectorAll('#control circle');
  return Math.max(...[...tracked].map((p,i)=>Math.abs(+p.getAttribute('cx')-+idle[i].getAttribute('cx'))));
 });assert.ok(difference<.12,'tracking gradually returns to the ongoing idle gaze');
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(100);
 const still=await read();await page.waitForTimeout(200);assert.deepEqual(await read(),still);
 assert.deepEqual(errors,[]);
 console.log('PASS fly tracking: simultaneous coordinated gaze, proximity falloff, unchanged distant/offscreen faces, scrolling, delayed release to idle, reduced motion.');
 await browser.close();
})();
