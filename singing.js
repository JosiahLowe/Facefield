// A single, quiet C-major phrase. Durations include a small breath between notes.
export const MELODY = [
  { midi: 60, duration: .45 }, { midi: 64, duration: .45 },
  { midi: 67, duration: .65 }, { midi: 64, duration: .35 },
  { midi: 62, duration: .45 }, { midi: 64, duration: .45 },
  { midi: 60, duration: .85 }, { midi: null, duration: 1.2 },
];
export const frequencyFor = midi => 440 * 2 ** ((midi - 69) / 12);
export function playNote(context, output, midi, start, duration) {
  const oscillator = context.createOscillator(), gain = context.createGain();
  const end = start + duration;
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(frequencyFor(midi), start);
  gain.gain.setValueAtTime(0, start);
  gain.gain.linearRampToValueAtTime(.25, start + Math.min(.025, duration / 4));
  gain.gain.exponentialRampToValueAtTime(.001, end - .015);
  gain.gain.linearRampToValueAtTime(0, end);
  oscillator.connect(gain); gain.connect(output);
  oscillator.start(start); oscillator.stop(end);
  return { oscillator, gain, start, end };
}

export function createSinger({ button, status, animation }) {
  let context, output, target = null, enabled = false, pending = false;
  let timer = 0, frame = 0, nextTime = 0, cursor = 0, generation = 0;
  const notes = [], voices = new Set();
  function setFace(tile) {
    if (target) {
      animation.setSingingMouth(target, null);
      delete target.dataset.singer;
      target.removeAttribute('aria-description');
    }
    target = tile;
    if (target) {
      target.dataset.singer = 'true';
      target.setAttribute('aria-description', 'This face sings when sound is enabled.');
    }
  }
  function schedule() {
    if (!enabled || context.state !== 'running') return;
    while (nextTime < context.currentTime + .12) {
      const note = MELODY[cursor];
      if (note.midi !== null) {
        const voice = playNote(context, output, note.midi, nextTime, note.duration * .82);
        voices.add(voice); notes.push(voice);
        voice.oscillator.onended = () => {
          voice.oscillator.disconnect(); voice.gain.disconnect(); voices.delete(voice);
        };
      }
      nextTime += note.duration;
      cursor = (cursor + 1) % MELODY.length;
    }
  }
  function mouthFrame() {
    if (!enabled) return;
    // Read the audio clock, rather than running a separate mouth timer.
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
      try { voice.oscillator.stop(); } catch { /* already ended */ }
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
        output = context.createGain(); output.gain.value = .25;
        output.connect(context.destination);
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
      enabled = true; cursor = 0; nextTime = context.currentTime + .06;
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
  return { setFace };
}
