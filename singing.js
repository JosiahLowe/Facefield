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
export function distanceVolume(distance, diagonal) {
  const normalized = Math.max(0, distance - diagonal * .12) / Math.max(1, diagonal * .6);
  return .25 * (.08 + .92 / (1 + normalized * normalized));
}
// Soft saturation leaves sound in the opposite ear, even very far offscreen.
export function horizontalPan(offset, viewportWidth) {
  return .65 * Math.tanh(offset / Math.max(1, viewportWidth * .65));
}
export const frequencyFor = midi => 440 * 2 ** ((midi - 69) / 12);
export function playNote(context, output, midi, start, duration, wave = null) {
  const oscillator = context.createOscillator(), gain = context.createGain();
  const end = start + duration;
  if (wave) oscillator.setPeriodicWave(wave); else oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequencyFor(midi), start);
  const vibrato = context.createOscillator(), vibratoGain = context.createGain();
  vibrato.frequency.value = VIBRATO.rate;
  vibratoGain.gain.setValueAtTime(0, start);
  vibratoGain.gain.linearRampToValueAtTime(VIBRATO.depth, start + Math.min(.18, duration * .4));
  vibrato.connect(vibratoGain); vibratoGain.connect(oscillator.detune);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(.25, start + Math.min(.025, duration / 4));
  gain.gain.linearRampToValueAtTime(.18, end - Math.min(.12, duration / 3));
  gain.gain.exponentialRampToValueAtTime(.001, end - .015);
  gain.gain.linearRampToValueAtTime(0, end);
  oscillator.connect(gain); gain.connect(output);
  oscillator.start(start); oscillator.stop(end);
  vibrato.start(start); vibrato.stop(end);
  return { oscillator, gain, vibrato, vibratoGain, start, end };
}

export function createSinger({ button, status, animation, world, onSingerChange = () => {}, onMusic = () => {} }) {
  let context, output, panner, wave, target = null, enabled = false, pending = false;
  let timer = 0, frame = 0, nextTime = 0, cursor = 0, generation = 0;
  const notes = [], voices = new Set();
  let handoff = null, previousSinger = null;
  const phraseEnds = [];
  let song = { root: 60, progressionIndex: 0, chordName: 'I', chordRoot: 60, pattern: 0, octave: 0, voice: {sine:.92,triangle:.055,square:.025}, melody: MELODY }, hasSinger = false;
  let lastVolume = null, lastPan = null;
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
    const volume = distanceVolume(distance, Math.hypot(width, height));
    const pan = horizontalPan(face.left + face.width / 2 - left - width / 2, width);
    if (lastPan === null || Math.abs(pan - lastPan) > .00001) {
      panner.pan.setTargetAtTime(pan, context.currentTime, .18);
      lastPan = pan;
    }
    if (lastVolume === null || Math.abs(volume - lastVolume) > .00001) {
      // AudioParam smoothing is continuous, including rapid scroll reversals.
      output.gain.setTargetAtTime(volume, context.currentTime, .18);
      lastVolume = volume;
    }
  }
  function updateVoice() {
    if (!context) return;
    const {real,imag} = voiceHarmonics(song.voice);
    wave = context.createPeriodicWave(real,imag,{disableNormalization:true});
  }
  function setFace(tile) {
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
            voice.oscillator.stop(now + .09); voice.vibrato.stop(now + .09);
          }
          notes.length = 0; cursor = 0; nextTime = now + .12;
        }
      }
      hasSinger = true;
      target.dataset.singer = 'true';
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
    if (!next || next === target) { status.textContent = 'No other offscreen face is available.'; return; }
    setFace(next);
    status.textContent = enabled ? 'A different face elsewhere in the world is singing.' : 'New singer selected. Tap Enable Sound to hear it.';
  }
  function schedule() {
    if (!enabled || context.state !== 'running') return;
    const now = context.currentTime;
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
      if (note.midi !== null) {
        const voice = playNote(context, output, note.midi, nextTime, note.duration * .94, wave);
        voices.add(voice); notes.push(voice);
        voice.oscillator.onended = () => {
          voice.oscillator.disconnect(); voice.gain.disconnect(); voice.vibrato.disconnect(); voice.vibratoGain.disconnect(); voices.delete(voice);
        };
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
    const note = notes.find(note => note.start <= now && note.end > now);
    let opening = 0;
    if (note) {
      const attack = Math.min(1, (now - note.start) / .04);
      const release = Math.min(1, (note.end - now) / .075);
      opening = Math.max(0, Math.min(attack, release));
    }
    if (target) animation.setSingingMouth(target, opening);
    onMusic(context.state === 'running' ? opening : 0, note ? note.end-note.start : 0);
    frame = requestAnimationFrame(mouthFrame);
  }
  function stop() {
    generation++;
    handoff = null;
    phraseEnds.length = 0;
    enabled = false;
    clearInterval(timer); cancelAnimationFrame(frame);
    timer = 0; frame = 0;
    for (const voice of voices) {
      try { voice.oscillator.stop(); voice.vibrato.stop(); } catch { /* already ended */ }
    }
    notes.length = 0;
    onMusic(0);
    if (target) animation.setSingingMouth(target, null);
    if (context?.state === 'running') context.suspend().catch(() => {});
    button.textContent = 'Enable Sound';
    button.setAttribute('aria-pressed', 'false');
  }
  button.addEventListener('click', async () => {
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
        output.connect(panner); panner.connect(context.destination);
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
      enabled = true; lastVolume = null; lastPan = null; updateVolume(); cursor = 0; nextTime = context.currentTime + .06;
      button.textContent = 'Mute Sound'; button.setAttribute('aria-pressed', 'true');
      status.textContent = 'Sound enabled. One face is singing.';
      schedule(); timer = setInterval(schedule, 25); mouthFrame();
    } catch {
      stop(); status.textContent = 'Sound could not start. Tap Enable Sound to try again.';
    } finally {
      pending = false; button.disabled = false;
    }
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop(); });
  window.addEventListener('pagehide', stop);
  return {
    setFace,
    advanceAfterPhrase(candidates) {
      if (handoff) return;
      if (!enabled) { changeFace(candidates()); return; }
      handoff = { candidates, end: phraseEnds.find(end => end >= context.currentTime) ?? null };
      status.textContent = 'The singer will finish this phrase, then another face will sing offscreen.';
    },
  };
}
