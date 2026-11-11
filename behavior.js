import { eyelidColor } from './palette.js';
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
// World-pixel radius and response times in seconds; tune without touching flight.
export const FLY_TRACKING = { detectionRadius: 320, fullAttentionRadius: 120, reactionTime: .18, releaseTime: .55 };
export function flyAttention(dx, dy, radius = FLY_TRACKING.detectionRadius, innerRadius = FLY_TRACKING.fullAttentionRadius) {
  const inner = Math.max(0, Math.min(radius - 1, innerRadius));
  const near = Math.max(0, Math.min(1, (radius - Math.hypot(dx, dy)) / Math.max(1, radius - inner)));
  return near * near * (3 - 2 * near);
}
export function constrainGaze(offset, minY = -.88, maxY = .88) {
  const y = Math.max(minY, Math.min(maxY, offset[1]));
  const limitX = Math.sqrt(Math.max(0, .88 ** 2 - y ** 2));
  return [Math.max(-limitX, Math.min(limitX, offset[0])), y];
}
const MOUTH_PROFILES = {
  curious: { pause: [3000, 5000], amount: 2.2 },
  sleepy: { pause: [6000, 9000], amount: .65 },
  nervous: { pause: [2500, 4000], amount: 1.8 },
  calm: { pause: [5000, 8000], amount: 1.2 },
  observant: { pause: [4000, 6000], amount: 1.6 },
};
export function mouthTarget(currentBend, name, random = Math.random, requireNeutral = false) {
  const { amount } = MOUTH_PROFILES[name];
  const current = Math.abs(currentBend) < 3 ? 0 : Math.sign(currentBend);
  const choices = [-1, 0, 1].filter(expression => expression !== current);
  const expression = requireNeutral && current !== 0 ? 0 : choices[Math.floor(random() * choices.length)];
  const magnitude = name === 'sleepy' ? 8 + random() * 2 : 10 + random() * 6;
  const bend = expression * magnitude;
  const corner = expression && random() < .22 ? (random() * 2 - 1) * amount * .35 : 0;
  return { bend, corner };
}

export function mouthPause(name, neutral, random = Math.random) {
  const [low, high] = MOUTH_PROFILES[name].pause;
  const minimum = neutral ? Math.max(4000, low) : low;
  const maximum = neutral ? Math.max(6000, high) : high;
  return minimum + random() * (maximum - minimum);
}

const between = (a, b) => a + Math.random() * (b - a);
const NS = 'http://www.w3.org/2000/svg';
const smooth = t => t * t * (3 - 2 * t);

// A single frame loop serves visible faces. Sleeping and hidden faces do no work.
export function animateFaces(grid, onFrame = null, getFlyPosition = () => null) {
  const states = new Map(), visible = new Set();
  let geometryVersion = 0;
  new ResizeObserver(() => { geometryVersion++; }).observe(grid);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let frame = 0, motionPaused = reduced.matches;
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      const state = states.get(entry.target);
      if (!state) continue;
      if (entry.isIntersecting && entry.intersectionRect.width > 0 && entry.intersectionRect.height > 0) {
        visible.add(state);
        schedule(state, performance.now());
      } else {
        visible.delete(state);
        restore(state);
      }
    }
    wake();
  }, { threshold: .001 });
  function schedule(s, now) {
    s.nextGaze = now + between(...s.profile.gaze) * s.profile.pace;
    s.nextBlink = now + between(2000, 8000);
    s.double = false;
    s.nextMouth = now + mouthPause(s.profile.name, s.mouth.current.bend === 0);
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
    s.idle = [...s.restLook]; s.look = [...s.restLook]; s.flyLook = [...s.restLook]; s.attention = 0; s.lastLook = 0;
    s.blink = null;
    s.mouth.element.setAttribute('d', s.mouth.original);
    s.mouth.element.setAttribute('fill', 'none');
    s.mouth.current = { bend: s.mouth.restBend, corner: 0 };
    s.mouth.motion = null;
    s.mouth.manual = false;
    s.mouth.sinceNeutral = 0;
  }
  function makeBlinkLids(s) {
    for (const eye of s.eyes) {
      if (eye.blinkLids.length) continue;
      for (let i = 0; i < 2; i++) {
        const path = document.createElementNS(NS, 'path');
        path.setAttribute('fill', s.lidColor);
        path.dataset.animation = 'blink';
        eye.blinkLids.push(path);
        s.svg.querySelector('[data-features]').append(path);
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
      const a = s.tile.getBoundingClientRect();
      const candidates = [...visible].filter(other => other !== s).map(other => {
        const box = other.tile.getBoundingClientRect();
        const dx = box.left + box.width/2 - a.left - a.width/2;
        const dy = box.top + box.height/2 - a.top - a.height/2;
        return { dx, dy, distance: Math.hypot(dx,dy) };
      }).sort((a,b) => a.distance-b.distance).slice(0,4);
      const neighbor = candidates[Math.floor(Math.random()*candidates.length)];
      if (!neighbor) target = [0,0];
      else target = gazeOffset(Math.atan2(neighbor.dy, neighbor.dx), .65);
    } else {
      target = Math.random() < .18 ? [0, 0] : gazeOffset(between(0, Math.PI * 2), between(.25, .82));
    }
    const from = [...s.idle];
    s.gaze = { from, target, start: now, duration: s.profile.move * s.profile.pace };
    s.nextGaze = now + between(...s.profile.gaze) * s.profile.pace;
  }
  function updateMouth(s, now) {
    const mouth = s.mouth;
    if (mouth.singing) return;
    if (!mouth.manual && !mouth.motion && now >= s.nextMouth) {
      const target = mouthTarget(mouth.current.bend, s.profile.name, Math.random, mouth.sinceNeutral >= 1);
      mouth.motion = { from: { ...mouth.current }, target, start: now, duration: between(1200, 1800) };
    }
    if (!mouth.motion) return;
    const { from, target, start, duration } = mouth.motion;
    const progress = Math.min(1, (now - start) / duration), t = smooth(progress);
    const bend = progress === 1 ? target.bend : from.bend + (target.bend - from.bend) * t;
    const corner = progress === 1 ? target.corner : from.corner + (target.corner - from.corner) * t;
    mouth.current = { bend, corner };
    mouth.element.setAttribute('d', `M ${mouth.left} ${mouth.y - corner} Q ${mouth.center} ${mouth.y + bend} ${mouth.right} ${mouth.y + corner}`);
    if (progress === 1) {
      mouth.motion = null;
      mouth.sinceNeutral = target.bend === 0 ? 0 : mouth.sinceNeutral + 1;
      s.nextMouth = now + mouthPause(s.profile.name, s.mouth.current.bend === 0);
    }
  }
  function updateLook(s, now, fly) {
    const dt = s.lastLook ? Math.min(.05, (now - s.lastLook) / 1000) : 0;
    s.lastLook = now;
    let attention = 0, target = s.idle;
    if (fly) {
      if (s.geometryVersion !== geometryVersion) {
        const box = s.svg.viewBox.baseVal;
        const tile = s.tile.getBoundingClientRect();
        const world = grid.closest('#world') || grid.parentElement;
        const origin = world.getBoundingClientRect();
        const scale = tile.width / box.width;
        s.center = { x: tile.left - origin.left + world.scrollLeft + tile.width / 2,
          y: tile.top - origin.top + world.scrollTop + ((box.height - 100) / 2 + s.eyes[0].y) * scale };
        s.geometryVersion = geometryVersion;
      }
      const dx = fly.x - s.center.x, dy = fly.y - s.center.y;
      attention = flyAttention(dx, dy);
      target = gazeOffset(Math.atan2(dy, dx), .88);
    }
    const response = attention > s.attention ? FLY_TRACKING.reactionTime : FLY_TRACKING.releaseTime;
    const ease = 1 - Math.exp(-dt / response);
    s.attention += (attention - s.attention) * ease;
    if (s.attention > .0001) {
      const desired = constrainGaze(target, s.minLookY, s.maxLookY);
      s.flyLook = constrainGaze(s.flyLook.map((value, i) => value + (desired[i] - value) * ease), s.minLookY, s.maxLookY);
      // Blend into the independently running idle gaze, so release never snaps
      // even when an idle glance starts while the fly is leaving.
      s.look = constrainGaze(s.idle.map((value, i) => value + (s.flyLook[i] - value) * s.attention));
    } else {
      s.attention = 0;
      s.look = [...s.idle];
      s.flyLook = [...s.idle];
    }
    // The same normalized offset drives both pupils; eyelids and blink caps stay above them.
    for (const eye of s.eyes) {
      const x = String(eye.x + s.look[0] * eye.travel), y = String(eye.y + s.look[1] * eye.travel);
      if (eye.pupil.getAttribute('cx') !== x) eye.pupil.setAttribute('cx', x);
      if (eye.pupil.getAttribute('cy') !== y) eye.pupil.setAttribute('cy', y);
    }
  }
  function tick(now) {
    frame = 0;
    if (reduced.matches || document.hidden) { resetActivity(); return; }
    if (onFrame) onFrame(now);
    const fly = getFlyPosition();
    for (const s of visible) {
      updateMouth(s, now);
      if (now >= s.nextGaze) startGaze(s, now);
      if (s.gaze) {
        const progress = Math.min(1, (now - s.gaze.start) / s.gaze.duration);
        const t = smooth(progress), { from, target } = s.gaze;
        s.idle = from.map((value, i) => value + (target[i] - value) * t);
        if (progress === 1) s.gaze = null;
      }
      updateLook(s, now, fly);
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
    if (!frame && (visible.size || onFrame) && !document.hidden && !reduced.matches) frame = requestAnimationFrame(tick);
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
    setSingingMouth(tile, opening) {
      const s = states.get(tile);
      if (!s) return;
      const mouth = s.mouth;
      mouth.singing = opening !== null;
      mouth.motion = null;
      if (opening === null || reduced.matches || opening <= 0) {
        mouth.element.setAttribute('d', mouth.original);
        mouth.element.setAttribute('fill', 'none');
        mouth.current = { bend: mouth.restBend, corner: 0 };
        if (opening === null) s.nextMouth = performance.now() + mouthPause(s.profile.name, mouth.restBend === 0);
        return;
      }
      const amount = Math.max(0, Math.min(1, opening));
      mouth.element.setAttribute('d', `M ${mouth.left} ${mouth.y} Q ${mouth.center} ${mouth.y - amount * 8} ${mouth.right} ${mouth.y} Q ${mouth.center} ${mouth.y + amount * 12} ${mouth.left} ${mouth.y} Z`);
      mouth.element.setAttribute('fill', mouth.element.getAttribute('stroke'));
    },
    changeMouths() {
      const now = performance.now();
      for (const s of states.values()) {
        const box = s.tile.getBoundingClientRect();
        if (box.bottom <= 0 || box.top >= innerHeight || box.right <= 0 || box.left >= innerWidth) continue;
        const mouth = s.mouth;
        if (mouth.singing) continue;
        // Read the displayed curve, including any in-progress ambient transition.
        const coordinates = mouth.element.getAttribute('d').match(/-?\d+(?:\.\d+)?/g).map(Number);
        const displayedBend = coordinates[3] - (coordinates[1] + coordinates[5]) / 2;
        mouth.current = { bend: displayedBend, corner: (coordinates[5] - coordinates[1]) / 2 };
        const target = mouthTarget(displayedBend, s.profile.name, Math.random, mouth.sinceNeutral >= 1);
        mouth.manual = false;
        if (reduced.matches) {
          mouth.current = target;
          mouth.sinceNeutral = target.bend === 0 ? 0 : mouth.sinceNeutral + 1;
          mouth.motion = null;
          mouth.element.setAttribute('d', `M ${mouth.left} ${mouth.y - target.corner} Q ${mouth.center} ${mouth.y + target.bend} ${mouth.right} ${mouth.y + target.corner}`);
        } else {
          mouth.motion = { from: { ...mouth.current }, target, start: now, duration: 1200 };
        }
        s.nextMouth = now + mouthPause(s.profile.name, s.mouth.current.bend === 0);
      }
      wake();

    },
    register(tile, seed, index, revision) {
      const previous = states.get(tile);
      if (previous) { visible.delete(previous); observer.unobserve(tile); }
      const svg = tile.querySelector('svg');
      const circles = [...svg.querySelectorAll('circle')];
      const lids = [...svg.querySelectorAll('[data-feature="eyelid"]')];
      const color = svg.dataset.skin;
      const lidColor = eyelidColor(color);
      const eyes = [0, 2].map((i, eyeIndex) => {
        const white = circles[i], pupil = circles[i + 1], lid = lids[eyeIndex];
        const number = attr => +white.getAttribute(attr);
        return { pupil, pupilRadius: +pupil.getAttribute('r'), x: number('cx'), y: number('cy'), r: number('r'),
          travel: number('r') - +pupil.getAttribute('r'), originalX: pupil.getAttribute('cx'), originalY: pupil.getAttribute('cy'),
          lid, lidSide: lid?.dataset.side, cut: lid ? +lid.getAttribute('d').split(' ')[2] : 0, blinkLids: [] };
      });
      const mouthElement = svg.querySelector('[data-feature=mouth]');
      const original = mouthElement.getAttribute('d');
      const [left, y, center, controlY, right] = original.match(/-?\d+(?:\.\d+)?/g).map(Number);
      const restBend = controlY - y;
      const mouth = { element: mouthElement, original, left, y, center, right, restBend,
        current: { bend: restBend, corner: 0 }, motion: null, sinceNeutral: 0 };
      const s = { tile, svg, eyes, lidColor, mouth, profile: personality(seed, index, revision), gaze: null, blink: null };
      const eye = eyes[0];
      s.restLook = [(+eye.originalX - eye.x) / eye.travel, (+eye.originalY - eye.y) / eye.travel];
      s.idle = [...s.restLook]; s.look = [...s.restLook]; s.flyLook = [...s.restLook]; s.attention = 0; s.lastLook = 0;
      s.geometryVersion = -1;
      s.minLookY = Math.max(-.88, ...eyes.filter(e => e.lidSide === 'top').map(e => (e.cut - e.y - e.pupilRadius * .5) / e.travel));
      s.maxLookY = Math.min(.88, ...eyes.filter(e => e.lidSide === 'bottom').map(e => (e.cut - e.y + e.pupilRadius * .5) / e.travel));
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
