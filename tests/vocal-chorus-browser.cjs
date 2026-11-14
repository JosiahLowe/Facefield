const {chromium}=require('playwright'),assert=require('node:assert/strict');
const audioSpy=require('./audio-spy.cjs');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
 try{
  const base=process.env.FACEFIELD_URL||'http://127.0.0.1:8000/';
  const render=await browser.newPage();await render.goto(base);
  const sound=await render.evaluate(async()=>{
    const {playVocalNote,createVocalSpace}=await import('./vocal.js');
    const results=[];
    for(const chorus of [false,true]){
      const c=new OfflineAudioContext(2,96000,48000),space=createVocalSpace(c),lanes=[];
      for(let i=0;i<(chorus?3:1);i++){
        const gain=c.createGain(),pan=c.createStereoPanner();gain.gain.value=.25;pan.pan.value=chorus?[-.55,.55,0][i]:0;
        gain.connect(pan);space.connect(pan);playVocalNote(c,gain,60+[0,12,-12][i],.1,.6,null,i);lanes.push(pan);
      }space.chorus(chorus);
      const buffer=await c.startRendering();let peak=0,energy=0,tail=0;
      for(let ch=0;ch<2;ch++){const data=buffer.getChannelData(ch);for(let i=0;i<data.length;i++){peak=Math.max(peak,Math.abs(data[i]));energy+=data[i]**2;if(i>36000&&i<50000)tail+=data[i]**2;}}
      results.push({peak,rms:Math.sqrt(energy/192000),tail});
    }
    const brief=new OfflineAudioContext(1,24000,48000),out=brief.createGain();out.gain.value=.25;out.connect(brief.destination);
    playVocalNote(brief,out,60,.1,.008);
    const short=(await brief.startRendering()).getChannelData(0);
    if(!short.every(Number.isFinite)||!short.some(n=>n!==0))throw Error('brief resumed note must have a valid audible envelope');
    return results;
  });
  assert.ok(sound.every(s=>s.peak>.005&&s.peak<.3&&s.rms>.001&&s.tail>1e-10),'vocal/chorus render has audible bounded output and a subtle reverb tail');
  await render.close();
  const page=await browser.newPage({viewport:{width:600,height:450}});await page.clock.install();await page.addInitScript(audioSpy);
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/chorus-fixture',r=>r.fulfill({contentType:'text/html',body:`<style>#world{position:fixed;inset:0;overflow:scroll}#grid{width:6000px;height:6000px}.face{position:absolute;width:120px;height:120px}</style><div id="world"><div id="grid"></div></div><button id="sound">Enable Sound</button><span id="status"></span><script type="module">
  import {renderFace} from './faces.js';import {animateFaces} from './behavior.js';import {createSinger} from './singing.js';
  const grid=document.querySelector('#grid'),world=document.querySelector('#world'),animation=animateFaces(grid);
  const tiles=[];for(let i=0;i<3;i++){const t=document.createElement('div');t.className='face';t.dataset.index=i;t.style.left=(i*1800+800)+'px';t.style.top=(i*700+600)+'px';t.innerHTML=renderFace('chorus',i).svg;grid.append(t);animation.register(t,'chorus',i,0);tiles.push(t);}
  window.joined=[];window.singer=createSinger({button:document.querySelector('#sound'),status:document.querySelector('#status'),animation,world,onChorusJoin:(t,i)=>joined.push(i)});
  singer.setFace(tiles[0]);singer.startChorus(tiles.slice(1));window.ready=true;
  </script>`}));
  await page.goto(base+'chorus-fixture');await page.waitForFunction(()=>window.ready);
  await page.evaluate(()=>document.querySelector('#sound').click());await page.clock.runFor(12000);
  assert.deepEqual(await page.evaluate(()=>joined),[1,2]);
  const groups=await page.evaluate(()=>{
    const map=new Map();for(const n of audioRecords.filter(n=>n.kind==='oscillator'&&n.frequency.value>40)){
      const key=n.startAt.toFixed(5);if(!map.has(key))map.set(key,[]);map.get(key).push({f:n.frequency.value,d:n.endAt-n.startAt});
    }return [...map.values()];
  });
  const triples=groups.filter(g=>g.length===3);assert.ok(triples.length>=2);
  for(const group of triples){assert.ok(Math.abs(group[1].f/group[0].f-2)<1e-8&&Math.abs(group[2].f/group[0].f-.5)<1e-8);assert.ok(group.every(n=>Math.abs(n.d-group[0].d)<1e-8));}
  const nodes=await page.evaluate(()=>({contexts:audioContexts.length,pans:audioNodes.filter(n=>n.kind==='panner').map(n=>n.pan.value),convolvers:audioNodes.filter(n=>n.kind==='convolver'&&n.outputs.length).length}));
  assert.equal(nodes.contexts,1);assert.equal(nodes.convolvers,1);assert.equal(nodes.pans.length,3);assert.ok(new Set(nodes.pans.map(p=>p.toFixed(3))).size>=2,'spatial panning differs by world position');
  await page.evaluate(()=>singer.setScene('scream'));await page.clock.runFor(1500);
  assert.equal(await page.locator('[data-chorus-voice]').count(),0);assert.equal(await page.evaluate(()=>audioNodes.filter(n=>n.kind==='panner'&&n.outputs.length).length),1,'secondary channels disconnect');
  await page.evaluate(()=>document.querySelector('#sound').click());const count=await page.evaluate(()=>audioRecords.length);await page.clock.runFor(1000);assert.equal(await page.evaluate(()=>audioRecords.length),count);
  assert.deepEqual(errors,[]);console.log('PASS stage 1 vocal chorus: real bounded la-formant waveform, reverb tail, exact synchronized octaves/durations, distinct pan, one shared reverb, cleanup and mute.',sound);
 }finally{await browser.close();}
})();
