const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const Native=window.AudioContext;window.__masters=[];window.__ramps=[];window.__contextCount=0;
  window.AudioContext=class extends Native {
   constructor(...a){super(...a);window.__contextCount++;}
   createGain(){
    const gain=super.createGain(),connect=gain.connect.bind(gain),ramp=gain.gain.setTargetAtTime.bind(gain.gain);
    gain.connect=(target,...args)=>{if(target===this.destination || target instanceof StereoPannerNode)window.__masters.push(gain);return connect(target,...args)};
    gain.gain.setTargetAtTime=(value,time,constant)=>{window.__ramps.push({value,time,constant});return ramp(value,time,constant)};
    return gain;
   }
  };
 });
 await page.goto((process.env.FACEFIELD_URL||'http://127.0.0.1:8000/')+'?seed=facefield');
 await page.waitForFunction(()=>document.querySelector('#world').scrollTop>0);
 const url=page.url();
 await page.locator('#enable-sound').tap();
 await page.waitForFunction(()=>document.querySelector('#enable-sound').getAttribute('aria-pressed')==='true');
 const near=await page.locator('#world').evaluate(w=>({x:w.scrollLeft,y:w.scrollTop}));
 await page.waitForTimeout(1200);
 const nearGain=await page.evaluate(()=>__masters[0].gain.value);
 assert.ok(nearGain>.245&&nearGain<=.25);
 await page.locator('#world').evaluate(w=>w.scrollTo(0,0));
 await page.waitForTimeout(70);
 const transitioning=await page.evaluate(()=>__masters[0].gain.value);
 await page.waitForTimeout(1200);
 const farGain=await page.evaluate(()=>__masters[0].gain.value);
 assert.ok(farGain>.02&&farGain<nearGain*.5);assert.ok(transitioning>farGain+.01,'no instantaneous volume jump');
 await page.locator('#world').evaluate((w,p)=>w.scrollTo(p.x/2,p.y/2),near);
 await page.waitForTimeout(1200);
 const middleGain=await page.evaluate(()=>__masters[0].gain.value);assert.ok(middleGain>farGain&&middleGain<nearGain);
 await page.locator('#world').evaluate((w,p)=>w.scrollTo(p.x,p.y),near);
 await page.waitForTimeout(1200);assert.ok(await page.evaluate(()=>__masters[0].gain.value)>.245);
 const ramps=await page.evaluate(()=>__ramps);
 assert.ok(ramps.length>=4&&ramps.every(r=>r.constant===.18&&r.value>.02&&r.value<=.25));
 assert.equal(await page.evaluate(()=>__masters.length),1);assert.equal(await page.evaluate(()=>__contextCount),1);
 assert.equal(page.url(),url);assert.equal(await page.locator('[data-singer]').count(),1);
 await page.locator('#enable-sound').tap();assert.deepEqual(errors,[]);
 console.log('PASS distance audio:',JSON.stringify({nearGain,transitioning,middleGain,farGain,masters:1,contexts:1}));
 await browser.close();
})();
