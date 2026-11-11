const { chromium }=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.addInitScript(()=>{
  const Native=window.AudioContext;
  window.__contexts=[];window.__voices=[];window.__vibratos=0;
  window.AudioContext=class extends Native{
   constructor(...args){super(...args);window.__contexts.push(this);}
   createOscillator(){
    const o=super.createOscillator(),record={start:null,end:null};
    const start=o.start.bind(o),stop=o.stop.bind(o);
    o.start=t=>{record.start=t;if(o.frequency.value<10)window.__vibratos++;else window.__voices.push(record);return start(t)};
    o.stop=t=>{record.end=t??this.currentTime;return stop(t)};
    return o;
   }
  };
 });
 await page.goto((process.env.FACEFIELD_URL||'http://127.0.0.1:8000/')+'?seed=facefield');
 await page.waitForFunction(()=>document.querySelector('#world').scrollTop>0);
 assert.equal(await page.locator('[data-singer]').count(),1);
 assert.equal(await page.evaluate(()=>__contexts.length),0,'no audio context before a tap');
 const initialSinger=await page.locator('[data-singer]').getAttribute('data-index');
 await page.locator('#change-singer').tap();
 assert.notEqual(await page.locator('[data-singer]').getAttribute('data-index'),initialSinger);
 assert.equal(await page.evaluate(()=>__contexts.length),0,'changing singer does not enable audio');
 const singer=page.locator('[data-singer]'),index=await singer.getAttribute('data-index');
 const url=page.url(),world=await page.locator('#world').evaluate(w=>[w.scrollWidth,w.scrollHeight,w.scrollLeft,w.scrollTop]);
 const rect=await singer.boundingBox();assert.ok(rect.x<390&&rect.x+rect.width>0&&rect.y<844&&rect.y+rect.height>0);
 const waveform=await page.evaluate(async()=>{
  const {playNote}=await import('./singing.js');
  const c=new OfflineAudioContext(1,48000,48000),out=c.createGain();out.gain.value=.25;out.connect(c.destination);
  playNote(c,out,69,.1,.3);
  const data=(await c.startRendering()).getChannelData(0);
  let energy=0,peak=0,crossings=0;
  for(let i=7200;i<12000;i++){energy+=data[i]*data[i];peak=Math.max(peak,Math.abs(data[i]));if(data[i]>=0&&data[i-1]<0)crossings++;}
  return {rms:Math.sqrt(energy/4800),peak,crossings,before:data.slice(0,4000).every(x=>x===0),after:data.slice(22000).every(x=>x===0)};
 });
 assert.ok(waveform.rms>.003&&waveform.peak<.1&&waveform.crossings>=43&&waveform.crossings<=45);
 assert.ok(waveform.before&&waveform.after);
 await page.locator('#enable-sound').tap();
 await page.waitForFunction(()=>document.querySelector('#enable-sound').getAttribute('aria-pressed')==='true');
 assert.equal(await page.evaluate(()=>__contexts.length),1);
 assert.equal(await page.evaluate(()=>__contexts[0].state),'running');
 for(let i=0;i<3;i++) {
  const previous=await page.locator('[data-singer]').getAttribute('data-index');
  await page.locator('#change-singer').tap();
  assert.equal(await page.locator('[data-singer]').count(),1);
  assert.notEqual(await page.locator('[data-singer]').getAttribute('data-index'),previous);
  assert.equal(await page.locator(`.face[data-index="${previous}"] [data-feature=mouth]`).getAttribute('fill'),'none','previous singer releases its mouth');
  assert.deepEqual(await page.locator('#world').evaluate(w=>[w.scrollWidth,w.scrollHeight,w.scrollLeft,w.scrollTop]),world);
 }
 assert.equal(await page.evaluate(()=>__contexts.length),1);
 const result=await page.evaluate(async()=>{
  let open=0,closed=0,desync=0,othersOpen=false;const othersMoved=new Set();
  const observer=new MutationObserver(records=>records.forEach(({target,attributeName})=>{
   if(target.matches('[data-feature=mouth]')&&attributeName==='d'&&!target.closest('[data-singer]'))othersMoved.add(target.closest('.face').dataset.index);
  }));observer.observe(document.querySelector('#grid'),{subtree:true,attributes:true,attributeFilter:['d','fill']});
  const start=performance.now();
  return await new Promise(resolve=>{
   function check(){
    const mouth=document.querySelector('[data-singer] [data-feature=mouth]');
    const t=__contexts[0].currentTime;
    if(mouth.getAttribute('fill')!=='none'){
     open++;if(!__voices.some(n=>n.start<=t+.05&&n.end>=t-.05))desync++;
    }else closed++;
    othersOpen||=[...document.querySelectorAll('[data-feature=mouth]')].some(m=>!m.closest('[data-singer]')&&m.getAttribute('fill')!=='none');
    if(performance.now()-start>10500){observer.disconnect();resolve({open,closed,desync,othersOpen,othersMoved:othersMoved.size,notes:__voices.length});}else requestAnimationFrame(check);
   }check();
  });
 });
 assert.ok(await page.evaluate(()=>__vibratos)>0,'pitch modulation is scheduled');
 assert.ok(result.open>20&&result.closed>20&&result.notes>7);
 assert.equal(result.desync,0);assert.equal(result.othersOpen,false);assert.ok(result.othersMoved>0);
 assert.equal(page.url(),url);assert.deepEqual(await page.locator('#world').evaluate(w=>[w.scrollWidth,w.scrollHeight,w.scrollLeft,w.scrollTop]),world);
 const chosen=await singer.getAttribute('data-index');await singer.tap();assert.equal(await page.locator('[data-singer]').getAttribute('data-index'),chosen);
 await page.waitForFunction(()=>document.querySelector('[data-singer] [data-feature=mouth]').getAttribute('fill')!=='none');
 await page.locator('#shuffle').tap();assert.equal(await page.locator('[data-singer]').count(),1);assert.equal(await page.evaluate(()=>__contexts.length),1);
 await page.waitForFunction(()=>document.querySelector('[data-singer] [data-feature=mouth]').getAttribute('fill')!=='none');
 await page.emulateMedia({reducedMotion:'reduce'});await page.waitForTimeout(600);
 const still=await page.locator('[data-singer] [data-feature=mouth]').getAttribute('d');
 await page.waitForTimeout(300);assert.equal(await page.locator('[data-singer] [data-feature=mouth]').getAttribute('d'),still);
 assert.equal(await page.locator('[data-singer] [data-feature=mouth]').getAttribute('fill'),'none');
 await page.locator('#enable-sound').tap();assert.equal(await page.locator('#enable-sound').innerText(),'Enable Sound');
 const notes=await page.evaluate(()=>__voices.length);await page.waitForTimeout(400);assert.equal(await page.evaluate(()=>__voices.length),notes);
 await page.locator('#enable-sound').tap();assert.equal(await page.evaluate(()=>__contexts.length),1);
 await page.evaluate(()=>{Object.defineProperty(document,'hidden',{configurable:true,get:()=>true});document.dispatchEvent(new Event('visibilitychange'));});
 await page.waitForTimeout(100);assert.equal(await page.locator('#enable-sound').innerText(),'Enable Sound');
 assert.deepEqual(errors,[]);
 console.log('PASS singer browser:',JSON.stringify({waveform,...result}));
 await browser.close();
})();
