const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||'/usr/bin/chromium',args:['--no-sandbox']});
  try{
    const page=await browser.newPage({viewport:{width:390,height:844}}),errors=[];
    page.on('pageerror',e=>errors.push(e.message));await page.clock.install();
    // Deterministic Web Audio scheduling spy. The other story browser test
    // renders the actual synth with OfflineAudioContext to check its waveform.
    await page.addInitScript(()=>{
      Math.random=()=>.8;window.audioRecords=[];window.master=null;window.contexts=0;
      const param=value=>({value,events:[],setValueAtTime(v,t){this.value=v;this.events.push({v,t});},
        linearRampToValueAtTime(v,t){this.events.push({v,t});},exponentialRampToValueAtTime(v,t){this.events.push({v,t});},
        setTargetAtTime(v,t){this.value=v;this.events.push({v,t});},cancelScheduledValues(){},cancelAndHoldAtTime(){}});
      class Node{connect(n){this.output=n;}disconnect(){this.disconnected=true;}}
      window.AudioContext=class{
        constructor(){this.state='suspended';this.destination=new Node();window.contexts++;}
        get currentTime(){return performance.now()/1000;}
        async resume(){this.state='running';}async suspend(){this.state='suspended';}
        addEventListener(){}createPeriodicWave(){return {};}
        createStereoPanner(){const n=new Node();n.pan=param(0);return n;}
        createGain(){const n=new Node();n.gain=param(1);if(!window.master)window.master=n;return n;}
        createOscillator(){const n=new Node();n.frequency=param(440);n.detune=param(0);n.setPeriodicWave=()=>{};
          n.start=t=>{n.startAt=t;window.audioRecords.push(n);};
          n.stop=t=>{n.endAt=t??this.currentTime;clearTimeout(n.timer);n.timer=setTimeout(()=>n.onended?.(),Math.max(0,(n.endAt-this.currentTime)*1000));};return n;}
      };
    });
    await page.goto((process.env.FACEFIELD_URL||'http://127.0.0.1:8000/')+'?seed=facefield');
    await page.waitForFunction(()=>document.querySelector('.butterfly')?.style.transform);
    const state=()=>page.locator('#world').getAttribute('data-moth-story');
    const until=async desired=>{for(let i=0;i<400;i++){if(await state()===desired)return;await page.clock.runFor(100);}assert.fail('expected '+desired);};
    await page.evaluate(()=>document.querySelector('#enable-sound').click());await page.clock.runFor(100);
    await page.evaluate(()=>document.querySelector('#kill-moth').click());
    const index=await page.locator('[data-singer]').getAttribute('data-index');
    await until('singing');await page.clock.runFor(1000);
    const notesBefore=await page.evaluate(()=>audioRecords.filter(n=>n.frequency.value>40).length);
    assert.ok(notesBefore>=3,'new singer plays an introduction');
    await until('scream');await page.clock.runFor(150);
    const separation=await page.evaluate(()=>{
      const tones=audioRecords.filter(n=>n.frequency.value>40),scream=tones.find(n=>n.frequency.value===560);
      const songs=tones.filter(n=>n!==scream);
      return {scream:scream?.startAt,latestSongEnd:Math.max(...songs.map(n=>n.endAt))};
    });
    assert.ok(separation.scream>0&&separation.latestSongEnd<=separation.scream,'all scheduled song voices stop before scream starts');
    await until('death');
    const deathAt=await page.evaluate(()=>performance.now()/1000);
    assert.ok(await page.evaluate(at=>audioRecords.every(n=>n.endAt<=at),deathAt),'silent fall has no overlapping audio');
    await until('crying');await page.clock.runFor(1400);
    const crying=await page.evaluate(()=>({count:audioRecords.length,gain:master.gain.value,
      sobs:audioRecords.filter(n=>[240,210,230].includes(n.frequency.value)).length}));
    assert.equal(crying.sobs,3,'first sob replaces the song');
    assert.ok(crying.gain>.02&&crying.gain<.1,'offscreen crying uses spatial attenuation');
    const mouths=new Set();let opened=0,rested=0;
    for(let i=0;i<110;i++){
      await page.clock.runFor(40);
      const sample=await page.evaluate(()=>{
        const t=document.querySelector('[data-singer]'),now=performance.now()/1000;
        const sobs=audioRecords.filter(n=>[240,210,230].includes(n.frequency.value));
        return {opening:+t.dataset.sobOpening,path:t.querySelector('[data-feature=mouth]').getAttribute('d'),
          active:sobs.some(n=>n.startAt<=now&&n.endAt>=now-.04),
          gap:!sobs.some(n=>n.startAt<=now+.04&&n.endAt>=now-.04)};
      });
      mouths.add(sample.path);
      if(sample.opening>.05){opened++;assert.equal(sample.active,true,'mouth expansion coincides with an audible sob');}
      if(sample.gap){rested++;assert.equal(sample.opening,0,'no mouth pulsing in silent gaps');}
    }
    assert.ok(opened>2&&rested>2&&mouths.size>3,'crying mouth follows individual pulses and relaxes between them');
    await page.evaluate(()=>document.querySelector('#enable-sound').click());
    assert.equal(await page.locator('[data-singer]').getAttribute('data-sob-opening'),'0.000','muting resets the sob envelope');
    const mute=await page.evaluate(()=>({at:performance.now()/1000,count:audioRecords.length}));
    assert.ok(await page.evaluate(at=>audioRecords.every(n=>n.endAt<=at),mute.at),'mute cancels every scheduled voice');
    await page.clock.runFor(5000);assert.equal(await page.evaluate(()=>audioRecords.length),mute.count);
    await page.evaluate(()=>document.querySelector('#enable-sound').click());await page.clock.runFor(1500);
    assert.ok(await page.evaluate(count=>audioRecords.slice(count).every(n=>n.frequency.value<40||[240,210,230].includes(n.frequency.value)),mute.count),'unmuting a crying scene never restarts its song');
    await page.evaluate(()=>{const w=document.querySelector('#world'),s=document.querySelector('[data-singer]');w.scrollTo(s.offsetLeft+s.offsetWidth/2-w.clientWidth/2,s.offsetTop+s.offsetHeight/2-w.clientHeight/2);});
    await page.clock.runFor(1500);assert.equal(await state(),'discovered');
    assert.ok(await page.evaluate(()=>master.gain.value>.245),'crying shares close-listening position');
    const soft=await page.evaluate(()=>audioRecords.filter(n=>[240,210,230].includes(n.frequency.value)).slice(-3).map(n=>Math.max(...n.output.gain.events.map(e=>e.v))));
    assert.ok(soft.every(v=>v<=.056001),'discovery softens subsequent sobs');
    const restartAt=await page.evaluate(()=>{document.querySelector('[data-singer]').click();return performance.now()/1000;});
    assert.equal(await state(),'idle');assert.notEqual(await page.locator('[data-singer]').getAttribute('data-index'),index);
    assert.ok(await page.evaluate(at=>audioRecords.filter(n=>[240,210,230,560].includes(n.frequency.value)).every(n=>n.endAt<=at),restartAt),'resolution stops all event voices');
    await page.clock.runFor(1500);
    assert.equal(await page.evaluate(()=>contexts),1,'event reuses the existing context');
    assert.equal(await page.locator('[data-singer]').getAttribute('data-audio-scene'),'song');
    assert.deepEqual(errors,[]);
    console.log('PASS story audio: melody → scream → silence → spatial sobs → softened discovery → normal song; no overlaps, complete mute/cleanup, one context.');
  }finally{await browser.close();}
})();
