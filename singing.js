import {playVocalNote as playNote, vocalWave, createVocalSpace} from './vocal.js?v=nearby-chorus-27';
import {chorusEntrances, synchronizedParts, melodyPosition} from './chorus.js?v=nearby-chorus-27';
export {playNote};
// 92 BPM: quarter/eighth-note arpeggios, breaths and sustained phrase endings.
export const QUARTER = .65;
export const SONG_PATTERNS = [
  [[0,2],[2,2],[4,2],[7,6],[null,1],[0,1],[4,1],[7,1],[12,1],[9,6],[null,1],[9,2],[7,2],[4,2],[2,6],[null,1],[4,1],[2,1],[0,8],[null,2]],
  [[12,2],[9,2],[7,2],[4,6],[null,1],[12,1],[7,1],[4,1],[0,1],[2,6],[null,1],[7,2],[4,2],[2,2],[0,6],[null,1],[4,1],[7,1],[4,8],[null,2]],
  [[4,2],[7,2],[9,2],[12,6],[null,1],[9,1],[7,1],[4,1],[0,1],[4,6],[null,1],[2,2],[4,2],[7,2],[9,6],[null,1],[7,1],[4,1],[0,8],[null,2]],
  [[9,2],[7,2],[4,2],[2,6],[null,1],[0,1],[4,1],[7,1],[4,1],[9,6],[null,1],[12,2],[9,2],[7,2],[4,6],[null,1],[2,1],[4,1],[0,8],[null,2]],
  [[0,.5],[4,.5],[7,.5],[12,.5],[7,.5],[4,.5],[0,1],[4,2],[7,6],[null,1],
   [4,.5],[7,.5],[12,.5],[7,.5],[4,.5],[0,.5],[4,1],[12,6],[null,1],
   [12,.5],[7,.5],[4,.5],[0,.5],[4,2],[0,6],[null,1],
   [7,.5],[4,.5],[0,1],[4,2],[0,8],[null,2]],
].map(phrase=>phrase.map(([interval,beats])=>[interval,beats*QUARTER]));
export function voiceHarmonics(voice) {
  const real=new Float32Array(33),imag=new Float32Array(33);
  imag[1]=voice.sine;
  for(let n=1;n<imag.length;n+=2) {
    imag[n]+=voice.triangle*8/Math.PI**2*(-1)**((n-1)/2)/(n*n)+voice.square*4/Math.PI/n;
  }
  const peakBound=imag.reduce((sum,n)=>sum+Math.abs(n),0);
  for(let i=1;i<imag.length;i++)imag[i]/=peakBound;
  return {real,imag};
}
const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
export const CHORD_PROGRESSION = [
  { name: 'I', degree: 0 }, { name: 'V', degree: 4 },
  { name: 'vi', degree: 5 }, { name: 'IV', degree: 3 },
];
const scalePitch = degree => MAJOR_SCALE[degree % 7] + 12 * Math.floor(degree / 7);
function chordMelody(pattern, root, progressionIndex, octave) {
  const {degree: chordDegree} = CHORD_PROGRESSION[progressionIndex];
  return SONG_PATTERNS[pattern].map(([interval,duration]) => {
    if (interval === null) return {midi: null, duration};
    let degree = Math.floor(interval / 12) * 7 + MAJOR_SCALE.indexOf(interval % 12);
    // Preserve passing tones and each contour; long phrase endings resolve to the triad.
    if (duration >= QUARTER * 4) {
      degree = [0,2,4,7].reduce((best,tone) => Math.abs(tone-degree) < Math.abs(best-degree) ? tone : best, 0);
    }
    return {midi: root + octave + scalePitch(chordDegree + degree), duration};
  });
}
export function chooseSong(previous = null, random = Math.random) {
  const root = previous?.root ?? 60; // One shared C-major key across all singer handoffs.
  const progressionIndex = previous ? (previous.progressionIndex + 1) % CHORD_PROGRESSION.length : 0;
  const patterns = SONG_PATTERNS.map((_,i)=>i).filter(i=>i !== previous?.pattern);
  const pattern = patterns[Math.floor(random()*patterns.length)];
  const octave = [-12, 0, 12][Math.floor(random()*3)];
  const triangle = .035 + random()*.045, square = .015 + random()*.025;
  const voice = { sine: 1-triangle-square, triangle, square };
  const chordDegree = CHORD_PROGRESSION[progressionIndex].degree;
  return { root, progressionIndex, chordName: CHORD_PROGRESSION[progressionIndex].name,
    chordRoot: root + scalePitch(chordDegree),
    chordTones: [0,2,4].map(degree=>root+scalePitch(chordDegree+degree)),
    pattern, octave, voice, melody: chordMelody(pattern, root, progressionIndex, octave) };
}
export const MELODY = chordMelody(0, 60, 0, 0);
export const VIBRATO = { rate: 5.5, depth: 32 }; // Hz and cents: fuller sustained vibrato.
export function chooseSinger(candidates, current, random = Math.random) {
  const alternatives = candidates.filter(face => face !== current);
  return alternatives.length ? alternatives[Math.floor(random() * alternatives.length)] : current;
}
// Existing master gain is .25 nearby, with an audible 8% floor in the distance.
export function distanceVolume(distance, diagonal, floor = .08) {
  const normalized = Math.max(0, distance - diagonal * .12) / Math.max(1, diagonal * .6);
  return .25 * (floor + (1-floor) / (1 + normalized * normalized));
}
export const chorusVolume=(distance,diagonal)=>distanceVolume(distance,diagonal,.24);
export const screamVolume=(distance,diagonal)=>distanceVolume(distance,diagonal,.72);
// Soft saturation leaves sound in the opposite ear, even very far offscreen.
export function horizontalPan(offset, viewportWidth) {
  return .65 * Math.tanh(offset / Math.max(1, viewportWidth * .65));
}
export const frequencyFor = midi => 440 * 2 ** ((midi - 69) / 12);
// Quiet synthetic vocal gestures, routed through the song's existing spatial
// master. No samples, extra AudioContext, or full-volume connection to speakers.
export const SOB_PULSES=[[0,.29,240,350,170,.20],[.39,.27,210,310,155,.16],[.78,.45,230,290,140,.18]];
export function sobOpening(effects,now){
  let opening=0;
  for(const effect of effects){
    if(effect.kind!=='sob')continue;
    for(const [offset,duration,,,,level] of SOB_PULSES){
      const t=now-effect.start-offset;
      if(t<0||t>=duration)continue;
      const envelope=t<.025?t/.025:t<duration-.02
        ?Math.pow(.001/level,(t-.025)/(duration-.045))
        :.001/level*(duration-t)/.02;
      opening=Math.max(opening,envelope);
    }
  }
  return opening;
}
export function playStorySound(context, output, kind, start, softened = false) {
  const sources=[],envelopes=[];
  const scream=kind==='scream',end=start+(scream?.74:1.25);
  const pulses=scream?[[0,.72,560,1180,310,.19]]
    :SOB_PULSES;
  for(const [offset,duration,from,peak,to,level] of pulses){
    const at=start+offset,until=at+duration;
    const voice=context.createOscillator(),gain=context.createGain();
    const tremble=context.createOscillator(),depth=context.createGain();
    voice.type='triangle';voice.frequency.setValueAtTime(from,at);
    voice.frequency.exponentialRampToValueAtTime(peak,at+duration*.23);
    voice.frequency.exponentialRampToValueAtTime(to,until);
    tremble.frequency.value=scream?27:7.5;depth.gain.value=scream?75:58;
    tremble.connect(depth);depth.connect(voice.detune);
    gain.gain.setValueAtTime(0,at);
    gain.gain.linearRampToValueAtTime(level*(softened?.28:1),at+.025);
    gain.gain.exponentialRampToValueAtTime(.001,until-.02);
    gain.gain.linearRampToValueAtTime(0,until);
    voice.connect(gain);gain.connect(output);
    voice.start(at);voice.stop(until);tremble.start(at);tremble.stop(until);
    voice.onended=()=>{voice.disconnect();gain.disconnect();tremble.disconnect();depth.disconnect();};
    sources.push(voice,tremble);envelopes.push(gain.gain);
  }
  return {start,end,kind,stop(){
    const now=context.currentTime;
    for(const envelope of envelopes){
      envelope.cancelScheduledValues(now);envelope.setValueAtTime(0,now);
    }
    for(const source of sources)try{source.stop(now);}catch{/* already ended */}
  }};
}

export function createSinger({ button, status, animation, world, onSingerChange = () => {}, onMusic = () => {}, onChorusJoin = () => {} }) {
  let context, output, panner, wave, target = null, enabled = false, pending = false;
  let timer = 0, frame = 0, nextTime = 0, cursor = 0, generation = 0;
  const notes = [], voices = new Set();
  let handoff = null, previousSinger = null;
  const phraseEnds = [];
  let song = { root: 60, progressionIndex: 0, chordName: 'I', chordRoot: 60, pattern: 0, octave: 0, voice: {sine:.92,triangle:.055,square:.025}, melody: MELODY }, hasSinger = false;
  let lastVolume = null, lastPan = null;
  let scene='song',nextEffect=0,space=null,chorus=null,origin=0;
  let eventActive=false,resumeOnFocus=false,screamPlayed=false;
  let lanes=[];
  const effects=new Set();
  function stopEffects(){
    for(const effect of effects)effect.stop();effects.clear();
    if(target)animation.setCryingMouth(target,0);
  }
  function silenceMelody(){
    if(context){
      const now=context.currentTime;
      for(const voice of voices){
        const gain=voice.gain.gain;
        if(gain.cancelAndHoldAtTime)gain.cancelAndHoldAtTime(now);
        else{gain.cancelScheduledValues(now);gain.setValueAtTime(gain.value,now);}
        gain.linearRampToValueAtTime(0,now+.025);
        try{voice.stop(now+.035);}catch{/* already ended */}
      }
    }
    notes.length=0;phraseEnds.length=0;handoff=null;onMusic(0);
    if(target)animation.setSingingMouth(target,null);
  }
  function setScene(next){
    if(next===scene)return;
    if(next!=='song')endChorus();
    space?.singing(next==='song');
    silenceMelody();stopEffects();scene=next;if(next==='scream')screamPlayed=false;
    if(next==='scream')updateVolume();
    if(target)target.dataset.audioScene=scene;
    nextEffect=(context?.currentTime||0)+.05;
    cursor=0;nextTime=nextEffect;
  }
  function scheduleEffects(now){
    for(const effect of effects)if(effect.end<=now)effects.delete(effect);
    if(!['scream','crying','discovered'].includes(scene)||now<nextEffect||scene==='scream'&&screamPlayed)return;
    const start=now+.01;
    effects.add(playStorySound(context,output,scene==='scream'?'scream':'sob',start,scene==='discovered'));
    if(scene==='scream')screamPlayed=true;
    nextEffect=scene==='scream'?Infinity:start+2.8+Math.random()*2;
  }
  function updateVolume() {
    if (!enabled || !target || !output || context.state !== 'running') return;
    // Both rectangles use viewport coordinates, so scrolling is already applied.
    const face = target.getBoundingClientRect();
    const bounds = world.getBoundingClientRect(), view = window.visualViewport;
    const left = Math.max(bounds.left, view?.offsetLeft || 0);
    const top = Math.max(bounds.top, view?.offsetTop || 0);
    const right = Math.min(bounds.right, (view?.offsetLeft || 0) + (view?.width || innerWidth));
    const bottom = Math.min(bounds.bottom, (view?.offsetTop || 0) + (view?.height || innerHeight));
    const width = Math.max(1, right - left), height = Math.max(1, bottom - top);
    const distance = Math.hypot(face.left + face.width / 2 - left - width / 2,
      face.top + face.height / 2 - top - height / 2);
    const volumeFor=scene==='scream'?screamVolume:chorus?chorusVolume:distanceVolume;
    const volume = volumeFor(distance, Math.hypot(width, height));
    const pan = horizontalPan(face.left + face.width / 2 - left - width / 2, width);
    if (lastPan === null || Math.abs(pan - lastPan) > .00001) {
      panner.pan.setTargetAtTime(pan, context.currentTime, .18);
      lastPan = pan;
    }
    if (lastVolume === null || Math.abs(volume - lastVolume) > .00001) {
      // AudioParam smoothing is continuous, including rapid scroll reversals.
      output.gain.setTargetAtTime(volume, context.currentTime, scene==='scream'?.025:.18);
      lastVolume = volume;
    }
  }
  function updateLane(lane){
    if(!lane.output||!enabled||context.state!=='running')return;
    const face=lane.tile.getBoundingClientRect(),bounds=world.getBoundingClientRect(),view=window.visualViewport;
    const left=Math.max(bounds.left,view?.offsetLeft||0),top=Math.max(bounds.top,view?.offsetTop||0);
    const width=Math.max(1,Math.min(bounds.right,(view?.offsetLeft||0)+(view?.width||innerWidth))-left);
    const height=Math.max(1,Math.min(bounds.bottom,(view?.offsetTop||0)+(view?.height||innerHeight))-top);
    const dx=face.left+face.width/2-left-width/2,dy=face.top+face.height/2-top-height/2;
    const volume=chorusVolume(Math.hypot(dx,dy),Math.hypot(width,height)),pan=horizontalPan(dx,width);
    if(lane.volume!==volume){lane.output.gain.setTargetAtTime(volume,context.currentTime,.18);lane.volume=volume;}
    if(lane.pan!==pan){lane.panner.pan.setTargetAtTime(pan,context.currentTime,.18);lane.pan=pan;}
  }
  function attachLanes(){
    if(!context||!chorus)return;
    lanes[0].output=output;lanes[0].panner=panner;
    for(const lane of lanes.slice(1))if(!lane.output){
      lane.output=context.createGain();lane.output.gain.value=0;lane.panner=context.createStereoPanner();
      lane.output.connect(lane.panner);space.connect(lane.panner);updateLane(lane);
    }
    space.chorus(true);
  }
  function endChorus(){
    if(!chorus)return;
    for(const lane of lanes){
      animation.setSingingMouth(lane.tile,null);delete lane.tile.dataset.chorusVoice;delete lane.tile.dataset.chorusJoined;
      if(lane.output&&lane.output!==output){const old=lane;setTimeout(()=>{old.output.disconnect();old.panner.disconnect();},80);}
    }
    lanes=[];chorus=null;space?.chorus(false);
  }
  function startChorus(tiles){
    endChorus();eventActive=true;
    const joins=chorusEntrances(song.melody);
    chorus={joins,elapsed:0,playing:enabled};
    lanes=[{tile:target,output,panner,joined:true,offset:0},...tiles.map((tile,i)=>({tile,joined:false,offset:i===0?12:-12}))];
    target.dataset.chorusVoice='0';target.dataset.chorusJoined='true';
    if(enabled){silenceMelody();cursor=0;origin=context.currentTime+.12;nextTime=origin;attachLanes();}
    return joins;
  }
  function chorusStatus(){
    const elapsed=chorus?(enabled?Math.max(0,context.currentTime-origin):chorus.elapsed):0;
    return {elapsed,playing:!!chorus&&enabled&&context?.state==='running',joined:lanes.filter(l=>l.joined).map(l=>l.tile)};
  }
  function updateVoice() {
    if (!context) return;
    wave = vocalWave(context,0);
  }
  function setFace(tile) {
    endChorus();
    handoff = null;
    phraseEnds.length = 0;
    if (target && tile) previousSinger = target;
    if (target) {
      animation.setSingingMouth(target, null);
      delete target.dataset.singer;
      target.tabIndex = -1;
      target.setAttribute('aria-label', `Face ${Number(target.dataset.index) + 1}`);
      delete target.dataset.songKey;
      delete target.dataset.chord;
      delete target.dataset.chordRoot;
      delete target.dataset.octave;
      delete target.dataset.melody;
      delete target.dataset.audioScene;
      target.removeAttribute('aria-description');
    }
    target = tile;
    if (target) {
      if (hasSinger) {
        song = chooseSong(song);
        updateVoice();
        if (enabled) {
          const now = context.currentTime;
          for (const voice of voices) {
            const envelope = voice.gain.gain;
            if (envelope.cancelAndHoldAtTime) envelope.cancelAndHoldAtTime(now);
            else {
              const level = envelope.value;
              envelope.cancelScheduledValues(now); envelope.setValueAtTime(level, now);
            }
            envelope.linearRampToValueAtTime(0, now + .08);
            voice.stop(now+.09);
          }
          notes.length = 0; cursor = 0; nextTime = now + .12;origin=nextTime;
        }
      }
      hasSinger = true;
      target.dataset.singer = 'true';
      target.dataset.audioScene=scene;
      target.tabIndex = 0;
      target.setAttribute('aria-label', 'Current singer: advance to the next singer');
      target.dataset.songKey = String(song.root);
      target.dataset.chord = song.chordName;
      target.dataset.chordRoot = String(song.chordRoot);
      target.dataset.octave = String(song.octave);
      target.dataset.melody = String(song.pattern);
      target.setAttribute('aria-description', 'This face sings when sound is enabled. Tap or press Enter or Space to finish this phrase, then pass singing to another offscreen face.');
    }
    onMusic(0);
    onSingerChange(target);
  }
  function changeFace(candidates) {
    const available = candidates.filter(face => face !== previousSinger);
    const next = chooseSinger(available, target);
    if (!next || next === target) { status.textContent = 'No other offscreen face is available.'; return null; }
    setFace(next);
    status.textContent = enabled ? 'A different face elsewhere in the world is singing.' : 'New singer selected. Tap Enable Sound to hear it.';
    return target;
  }
  function schedule() {
    if (!enabled || context.state !== 'running') return;
    const now = context.currentTime;
    if(scene!=='song'){scheduleEffects(now);return;}
    if (handoff && handoff.end !== null && now >= handoff.end) {
      const candidates = handoff.candidates;
      handoff = null;
      changeFace(candidates());
    }
    while (phraseEnds.length && phraseEnds[0] < now) phraseEnds.shift();
    while (nextTime < context.currentTime + .12) {
      if (handoff && handoff.end !== null && nextTime >= handoff.end) break;
      const note = song.melody[cursor];
      if (note.midi === null) {
        phraseEnds.push(nextTime);
        if (handoff && handoff.end === null) { handoff.end = nextTime; break; }
      }
      if(note.midi!==null){
        const elapsed=nextTime-origin;
        const parts=chorus?synchronizedParts(note,elapsed,chorus.joins):[{lane:0,midi:note.midi,duration:note.duration}];
        for(const part of parts){
          const lane=chorus?lanes[part.lane]:{tile:target,output};
          const start=Math.max(nextTime,context.currentTime+.005),end=nextTime+note.duration*.94;
          if(end<=start)continue;
          const voice=playNote(context,lane.output,part.midi,start,end-start,part.lane?vocalWave(context,part.lane):wave,part.lane);
          voice.tile=lane.tile;voice.lane=part.lane;voices.add(voice);notes.push(voice);
          voice.oscillator.onended=()=>{voice.dispose();voices.delete(voice);};
        }
      }
      nextTime += note.duration;
      cursor = (cursor + 1) % song.melody.length;
    }
  }
  function mouthFrame() {
    if (!enabled) return;
    // Read the audio clock, rather than running a separate mouth timer.
    updateVolume();
    const now = context.currentTime;
    while (notes.length && notes[0].end < now - .2) notes.shift();
    const openingFor=tile=>{
      const note=notes.find(note=>note.tile===tile&&note.start<=now&&note.end>now);
      const opening=note?Math.max(0,Math.min(1,(now-note.start)/.045,(note.end-now)/.075)):0;
      return {opening,note};
    };
    if(chorus&&scene==='song'){
      const elapsed=Math.max(0,now-origin);
      for(const [i,lane] of lanes.entries()){
        if(!lane.joined&&elapsed>=chorus.joins[i]){
          lane.joined=true;lane.tile.dataset.chorusVoice=String(i);lane.tile.dataset.chorusJoined='true';
          onChorusJoin(lane.tile,i);
        }
        if(i)updateLane(lane);
        if(lane.joined)animation.setSingingMouth(lane.tile,openingFor(lane.tile).opening);
      }
    }else if(target&&scene==='song')animation.setSingingMouth(target,openingFor(target).opening);
    const {opening,note}=openingFor(target);
    if(target&&(scene==='crying'||scene==='discovered'))animation.setCryingMouth(target,
      context.state==='running'?sobOpening(effects,now):0);
    onMusic(context.state === 'running' && scene==='song' ? opening : 0, note ? note.end-note.start : 0);
    frame = requestAnimationFrame(mouthFrame);
  }
  function stop() {
    if(chorus&&enabled)chorus.elapsed=Math.max(0,context.currentTime-origin);
    space?.singing(false);
    if(chorus)for(const lane of lanes)animation.setSingingMouth(lane.tile,null);
    generation++;
    handoff = null;
    phraseEnds.length = 0;
    enabled = false;
    clearInterval(timer); cancelAnimationFrame(frame);
    timer = 0; frame = 0;
    for (const voice of voices) {
      try { voice.stop(); } catch { /* already ended */ }
    }
    notes.length = 0;
    stopEffects();
    onMusic(0);
    if (target) animation.setSingingMouth(target, null);
    if (context?.state === 'running') context.suspend().catch(() => {});
    button.textContent = 'Enable Sound';
    button.setAttribute('aria-pressed', 'false');
  }
  async function toggleSound(){
    if (enabled) { stop(); status.textContent = 'Sound muted.'; return; }
    if (pending) return;
    pending = true; button.disabled = true;
    const attempt = ++generation;
    try {
      // Construction and resume happen directly in the user-tap handler for Safari.
      const Audio = window.AudioContext || window.webkitAudioContext;
      if (!Audio) throw new Error('Web Audio is unavailable');
      if (!context || context.state === 'closed') {
        context = new Audio();
        output = context.createGain(); output.gain.value = 0;
        panner = context.createStereoPanner();
        space=createVocalSpace(context);output.connect(panner);space.connect(panner);
        context.addEventListener('statechange', () => {
          if (enabled && context.state !== 'running') stop();
        });
      }
      updateVoice();
      await context.resume();
      if (attempt !== generation || document.hidden) {
        if (context.state === 'running') await context.suspend();
        return;
      }
      if (context.state !== 'running') throw new Error('Audio is not running');
      enabled = true; lastVolume = null; lastPan = null; updateVolume();
      space.flush();space.singing(scene==='song');
      if(chorus){
        const position=melodyPosition(song.melody,chorus.elapsed);cursor=position.cursor;
        origin=context.currentTime+.06-chorus.elapsed;nextTime=origin+position.at;attachLanes();
      }else{cursor=0;nextTime=context.currentTime+.06;origin=nextTime;}
      nextEffect=context.currentTime+.06;
      button.textContent = 'Mute Sound'; button.setAttribute('aria-pressed', 'true');
      status.textContent = scene==='song'?'Sound enabled.':'Sound enabled for the current scene.';
      schedule(); timer = setInterval(schedule, 25); mouthFrame();
    } catch {
      stop(); status.textContent = 'Sound could not start. Tap Enable Sound to try again.';
    } finally {
      pending = false; button.disabled = false;
    }
  }
  function pauseForFocus(){resumeOnFocus=resumeOnFocus||(eventActive&&enabled);stop();}
  function restoreFocus(){if(!document.hidden&&resumeOnFocus){resumeOnFocus=false;toggleSound();}}
  button.addEventListener('click',()=>{resumeOnFocus=false;toggleSound();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)pauseForFocus();else restoreFocus();});
  window.addEventListener('blur',()=>{if(eventActive)pauseForFocus();});
  window.addEventListener('focus',restoreFocus);
  window.addEventListener('pagehide',()=>{resumeOnFocus=false;stop();});
  return {
    setFace,
    setScene,
    advanceNow: changeFace,
    startChorus,endChorus,chorusStatus,
    setEventActive(value){eventActive=value;if(!value)resumeOnFocus=false;},
    advanceAfterPhrase(candidates) {
      if (handoff) return;
      if (!enabled) { changeFace(candidates()); return; }
      handoff = { candidates, end: phraseEnds.find(end => end >= context.currentTime) ?? null };
      status.textContent = 'The singer will finish this phrase, then another face will sing offscreen.';
    },
  };
}
