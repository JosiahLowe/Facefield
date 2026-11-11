// Longer, lyrical major-key phrases with plenty of sustained notes and breaths.
export const SONG_PATTERNS = [
  [[0,2.4],[4,2],[7,3.2],[9,2.2],[7,2.8],[4,2],[2,2.6],[0,3.6],[null,.8],[2,2],[4,2.6],[7,3.4],[4,2.4],[2,2.2],[0,4],[null,1.6]],
  [[0,2.8],[2,1.8],[4,3],[2,2.4],[7,3.6],[9,2.6],[7,3],[null,.8],[4,2.2],[7,2.8],[12,3.8],[9,2.4],[7,2.6],[4,2],[0,4],[null,1.6]],
  [[0,3],[7,2.4],[4,2.8],[9,3.2],[7,2],[4,2.6],[0,3.4],[null,.8],[4,2.2],[2,2.8],[7,3.4],[4,2.4],[2,2.6],[0,4],[null,1.8]],
];
const KEYS = [57, 60, 62, 64, 65, 67];
export function chooseSong(previous = null, random = Math.random) {
  const roots = KEYS.filter(root => root !== previous?.root);
  const patterns = SONG_PATTERNS.map((_,i)=>i).filter(i=>i !== previous?.pattern);
  const root = roots[Math.floor(random()*roots.length)];
  const pattern = patterns[Math.floor(random()*patterns.length)];
  return { root, pattern, melody: SONG_PATTERNS[pattern].map(([interval,duration])=>({midi:interval===null?null:root+interval,duration})) };
}
export const MELODY = SONG_PATTERNS[0].map(([interval,duration])=>({midi:interval===null?null:60+interval,duration}));
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
export function playNote(context, output, midi, start, duration) {
  const oscillator = context.createOscillator(), gain = context.createGain();
  const end = start + duration;
  oscillator.type = 'sine';
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

export function createSinger({ button, status, animation, world }) {
  let context, output, panner, target = null, enabled = false, pending = false;
  let timer = 0, frame = 0, nextTime = 0, cursor = 0, generation = 0;
  const notes = [], voices = new Set();
  let song = { root: 60, pattern: 0, melody: MELODY }, hasSinger = false;
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
  function setFace(tile) {
    if (target) {
      animation.setSingingMouth(target, null);
      delete target.dataset.singer;
      delete target.dataset.songKey;
      delete target.dataset.melody;
      target.removeAttribute('aria-description');
    }
    target = tile;
    if (target) {
      if (hasSinger) {
        song = chooseSong(song);
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
      target.dataset.songKey = String(song.root);
      target.dataset.melody = String(song.pattern);
      target.setAttribute('aria-description', 'This face sings when sound is enabled.');
    }
  }
  function schedule() {
    if (!enabled || context.state !== 'running') return;
    while (nextTime < context.currentTime + .12) {
      const note = song.melody[cursor];
      if (note.midi !== null) {
        const voice = playNote(context, output, note.midi, nextTime, note.duration * .94);
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
    frame = requestAnimationFrame(mouthFrame);
  }
  function stop() {
    generation++;
    enabled = false;
    clearInterval(timer); cancelAnimationFrame(frame);
    timer = 0; frame = 0;
    for (const voice of voices) {
      try { voice.oscillator.stop(); voice.vibrato.stop(); } catch { /* already ended */ }
    }
    notes.length = 0;
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
    changeFace(candidates) {
      const next = chooseSinger(candidates, target);
      if (!next || next === target) { status.textContent = 'No other face is available.'; return; }
      setFace(next);
      status.textContent = enabled ? 'A different face elsewhere in the world is singing.' : 'New singer selected. Tap Enable Sound to hear it.';
    },
  };
}
