import { randomFrom } from './faces.js';

const PROFILES = {
  curious: { gaze: [1800, 4300], move: 160, blink: 140, neighbor: .25 },
  sleepy: { gaze: [5000, 10000], move: 300, blink: 200, neighbor: .1 },
  nervous: { gaze: [900, 2600], move: 100, blink: 110, neighbor: .15 },
  calm: { gaze: [6000, 12000], move: 200, blink: 150, neighbor: .1 },
  observant: { gaze: [4000, 8500], move: 180, blink: 160, neighbor: .6 },
};
export function personality(seed, index, revision = 0) {
  const r = randomFrom(`${seed}:${index}:${revision}:behavior`);
  const name = Object.keys(PROFILES)[Math.floor(r() * 5)];
  return { name, ...PROFILES[name], pace: .85 + r() * .3 };
}
export function gazeOffset(angle, distance) {
  const magnitude = Math.max(0, Math.min(.88, distance));
  return [Math.cos(angle) * magnitude, Math.sin(angle) * magnitude];
}
const between = (a, b) => a + Math.random() * (b - a);
const NS = 'http://www.w3.org/2000/svg';
const smooth = t => t * t * (3 - 2 * t);

// A single frame loop serves visible faces. Sleeping and hidden faces do no work.
export function animateFaces(grid) {
  const states = new Map(), visible = new Set();
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0, motionPaused = reduced.matches;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const state = states.get(entry.target);
      if (!state) continue;
      if (entry.isIntersecting) {
        visible.add(state);
        schedule(state, performance.now());
      } else {
        visible.delete(state);
        restore(state);
      }
    }
    wake();
  });
  function schedule(s, now) {
    s.nextGaze = now + between(...s.profile.gaze) * s.profile.pace;
    s.nextBlink = now + between(2000, 8000);
    s.double = false;
  }
  function restore(s) {
    for (const eye of s.eyes) {
      eye.pupil.setAttribute('cx', eye.originalX);
      eye.pupil.setAttribute('cy', eye.originalY);
      if (eye.lid) eye.lid.style.removeProperty('visibility');
      for (const lid of eye.blinkLids) lid.remove();
      eye.blinkLids = [];
    }
    s.gaze = null;
    s.blink = null;
  }
  function makeBlinkLids(s) {
    for (const eye of s.eyes) {
      if (eye.blinkLids.length) continue;
      for (let i = 0; i < 2; i++) {
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('fill', s.lidColor);
        path.dataset.animation = 'blink';
        eye.blinkLids.push(path);
        s.svg.append(path);
      }
    }
  }
  function blink(s, amount) {
    makeBlinkLids(s);
    for (const eye of s.eyes) {
      if (eye.lid) eye.lid.style.visibility = 'hidden';
      [-1, 1].forEach((side, i) => {
        const rest = eye.lidSide === (side === -1 ? 'top' : 'bottom') ? eye.cut : eye.y + side * eye.r;
        // Slight overlap at closure prevents an antialiased white seam.
        const cut = rest + (eye.y - side * .02 - rest) * amount;
        const offset = Math.max(-1, Math.min(1, (cut - eye.y) / eye.r));
        const half = eye.r * Math.sqrt(1 - offset * offset);
        eye.blinkLids[i].setAttribute('d', `M ${eye.x - half} ${cut} A ${eye.r} ${eye.r} 0 ${side * offset < 0 ? 1 : 0} ${i === 0 ? 1 : 0} ${eye.x + half} ${cut} Z`);
      });
    }
  }
  function startGaze(s, now) {
    let target;
    if (Math.random() < s.profile.neighbor) {
      const columns = getComputedStyle(grid).gridTemplateColumns.split(' ').length;
      const index = Number(s.tile.dataset.index);
      const neighbors = [index - columns, index + columns];
      if (index % columns) neighbors.push(index - 1);
      if (index % columns < columns - 1) neighbors.push(index + 1);
      const candidates = neighbors.map(i => grid.children[i]).filter(Boolean);
      const neighbor = candidates[Math.floor(Math.random() * candidates.length)];
      const a = s.tile.getBoundingClientRect(), b = neighbor.getBoundingClientRect();
      target = gazeOffset(Math.atan2(b.top - a.top, b.left - a.left), .65);
    } else {
      target = Math.random() < .18 ? [0, 0] : gazeOffset(between(0, Math.PI * 2), between(.25, .82));
    }
    const eye = s.eyes[0];
    const from = [(+eye.pupil.getAttribute('cx') - eye.x) / eye.travel,
      (+eye.pupil.getAttribute('cy') - eye.y) / eye.travel];
    s.gaze = { from, target, start: now, duration: s.profile.move * s.profile.pace };
    s.nextGaze = now + between(...s.profile.gaze) * s.profile.pace;
  }
  function tick(now) {
    frame = 0;
    if (reduced.matches || document.hidden) { resetActivity(); return; }
    for (const s of visible) {
      if (now >= s.nextGaze) startGaze(s, now);
      if (s.gaze) {
        const progress = Math.min(1, (now - s.gaze.start) / s.gaze.duration);
        const t = smooth(progress), { from, target } = s.gaze;
        for (const eye of s.eyes) {
          eye.pupil.setAttribute('cx', eye.x + (from[0] + (target[0] - from[0]) * t) * eye.travel);
          eye.pupil.setAttribute('cy', eye.y + (from[1] + (target[1] - from[1]) * t) * eye.travel);
        }
        if (progress === 1) s.gaze = null;
      }
      if (!s.blink && now >= s.nextBlink) s.blink = now;
      if (s.blink !== null) {
        const progress = (now - s.blink) / s.profile.blink;
        if (progress >= 1) {
          for (const eye of s.eyes) {
            if (eye.lid) eye.lid.style.removeProperty('visibility');
            eye.blinkLids.forEach(lid => lid.remove());
            eye.blinkLids = [];
          }
          s.blink = null;
          const double = !s.double && Math.random() < .12;
          s.double = double;
          s.nextBlink = now + (double ? between(90, 160) : between(2000, 8000));
        } else {
          const closure = progress < .35 ? progress / .35 : progress < .55 ? 1 : (1 - progress) / .45;
          blink(s, smooth(Math.max(0, closure)));
        }
      }
    }
    wake();
  }
  function wake() {
    if (!frame && visible.size && !document.hidden && !reduced.matches) frame = requestAnimationFrame(tick);
  }
  function resetActivity() {
    motionPaused = reduced.matches;
    cancelAnimationFrame(frame);
    frame = 0;
    for (const s of states.values()) { restore(s); schedule(s, performance.now()); }
    wake();
  }
  reduced.addEventListener('change', resetActivity);
  // Some browser/media-emulation paths update matches without firing change.
  // One lightweight watchdog also resumes a grid that started in reduced motion.
  setInterval(() => { if (reduced.matches !== motionPaused) resetActivity(); }, 500);
  document.addEventListener('visibilitychange', resetActivity);
  return {
    register(tile, seed, index, revision) {
      const previous = states.get(tile);
      if (previous) { visible.delete(previous); observer.unobserve(tile); }
      const svg = tile.querySelector('svg');
      const circles = [...svg.querySelectorAll('circle')];
      const lids = [...svg.querySelectorAll('[data-feature="eyelid"]')];
      const color = svg.querySelector('rect').getAttribute('fill');
      const lidColor = '#' + color.slice(1).match(/../g).map(c => Math.round(parseInt(c, 16) * .82).toString(16).padStart(2, '0')).join('');
      const eyes = [0, 2].map((i, eyeIndex) => {
        const white = circles[i], pupil = circles[i + 1], lid = lids[eyeIndex];
        const number = attr => +white.getAttribute(attr);
        return { pupil, x: number('cx'), y: number('cy'), r: number('r'),
          travel: number('r') - +pupil.getAttribute('r'), originalX: pupil.getAttribute('cx'), originalY: pupil.getAttribute('cy'),
          lid, lidSide: lid?.dataset.side, cut: lid ? +lid.getAttribute('d').split(' ')[2] : 0, blinkLids: [] };
      });
      const s = { tile, svg, eyes, lidColor, profile: personality(seed, index, revision), gaze: null, blink: null };
      states.set(tile, s);
      schedule(s, performance.now());
      observer.observe(tile);
    },
    clear() {
      observer.disconnect();
      cancelAnimationFrame(frame);
      frame = 0;
      states.clear();
      visible.clear();
    },
  };
}
