const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const Native=window.AudioContext;window.__panners=[];window.__masters=[];window.__panRamps=[];window.__contexts=0;
  window.AudioContext=class extends Native {
   constructor(...a){super(...a);window.__contexts++;}
   createPanner(){throw new Error('3D panning is out of scope');}
   createStereoPanner(){
    const p=super.createStereoPanner(),ramp=p.pan.setTargetAtTime.bind(p.pan);window.__panners.push(p);
    p.pan.setTargetAtTime=(value,time,constant)=>{window.__panRamps.push({value,time,constant});return ramp(value,time,constant)};
    return p;
   }
   createGain(){const g=super.createGain(),connect=g.connect.bind(g);g.connect=(target,...args)=>{if(target instanceof StereoPannerNode)window.__masters.push(g);return connect(target,...args)};return g;}
  };
 });
 await page.goto((process.env.FACEFIELD_URL||'http://127.0.0.1:8000/')+'?seed=facefield');
 await page.waitForFunction(()=>document.querySelector('#world').scrollTop>0);
 const channels=await page.evaluate(async()=>{
  const {playNote}=await import('./singing.js');const result=[];
  for(const pan of [-.65,0,.65]){
   const c=new OfflineAudioContext(2,24000,48000),p=c.createStereoPanner();p.pan.value=pan;p.connect(c.destination);playNote(c,p,69,0,.4);
   const buffer=await c.startRendering();result.push([0,1].map(channel=>{const samples=buffer.getChannelData(channel);let sum=0;for(let i=2400;i<14400;i++)sum+=samples[i]**2;return Math.sqrt(sum/12000)}));
  }
  return result;
 });
 assert.ok(channels[0][0]>channels[0][1]*3&&channels[2][1]>channels[2][0]*3);
 assert.ok(channels[0][1]>channels[0][0]*.2&&channels[2][0]>channels[2][1]*.2,'opposite ear remains audible');
 assert.ok(Math.abs(channels[1][0]-channels[1][1])<1e-6);
 const energies=channels.map(pair=>pair[0]**2+pair[1]**2);assert.ok(Math.max(...energies)-Math.min(...energies)<1e-6,'equal-power stereo preserves total signal energy');
 await page.locator('#enable-sound').tap();await page.waitForFunction(()=>document.querySelector('#enable-sound').getAttribute('aria-pressed')==='true');
 const center=await page.locator('#world').evaluate(w=>{const r=document.querySelector('[data-singer]').getBoundingClientRect();return {x:w.scrollLeft+r.left+r.width/2-w.clientWidth/2,y:w.scrollTop+r.top+r.height/2-w.clientHeight/2}});
 const move=async(dx,dy=0)=>{await page.locator('#world').evaluate((w,p)=>w.scrollTo(p.x,p.y),{x:center.x+dx,y:center.y+dy});};
 const read=()=>page.evaluate(()=>({pan:__panners[0].pan.value,gain:__masters[0].gain.value}));
 await move(0);await page.waitForTimeout(1300);const middle=await read();assert.ok(Math.abs(middle.pan)<.002&&middle.gain>.245);
 await move(390);await page.waitForTimeout(1300);const left=await read();assert.ok(left.pan<-.5&&left.pan>=-.65);
 await move(-390);await page.waitForTimeout(60);const changing=await read();assert.ok(changing.pan<.4,'pan does not jump immediately');
 await page.waitForTimeout(1300);const right=await read();assert.ok(right.pan>.5&&right.pan<=.65);assert.ok(Math.abs(right.gain-left.gain)<.002,'symmetric distances retain matching volume');
 const rampCount=await page.evaluate(()=>__panRamps.length);await move(-390,350);await page.waitForTimeout(1300);const vertical=await read();
 assert.ok(Math.abs(vertical.pan-right.pan)<.002&&vertical.gain<right.gain);assert.equal(await page.evaluate(()=>__panRamps.length),rampCount,'vertical movement does not affect panning');
 assert.ok(await page.evaluate(()=>__panRamps.every(r=>Math.abs(r.value)<=.65&&r.constant===.18)));
 assert.deepEqual(await page.evaluate(()=>[__contexts,__masters.length,__panners.length]),[1,1,1]);
 await page.locator('#enable-sound').tap();await page.locator('#enable-sound').tap();assert.deepEqual(await page.evaluate(()=>[__contexts,__masters.length,__panners.length]),[1,1,1]);
 assert.deepEqual(errors,[]);console.log('PASS stereo audio:',JSON.stringify({channels,middle,left,changing,right,vertical,nodes:'one context, master gain, stereo panner'}));
 await browser.close();
})();
