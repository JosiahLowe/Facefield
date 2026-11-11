import { PALETTE } from './palette.js';

const clamp = (value, low, high) => Math.max(low, Math.min(high, value));
const between = (random, low, high) => low + random() * (high - low);

export function createFlight(x, y, random = Math.random) {
  return { x, y, vx: 0, vy: 0, gx: x, gy: y, time: 0, turnAt: between(random, .9, 1.8),
    mode: 'hover', lostFor: 0, following: false, phase: random() * Math.PI * 2 };
}

// All positions and velocities are in world pixels, independent of scroll speed.
export function stepFlight(fly, dt, view, world, random = Math.random) {
  dt = clamp(dt, 0, .05); // No jumps after a hidden tab or a long Safari frame.
  fly.time += dt;
  const inset = Math.min(60, view.width * .16, view.height * .16);
  const inside = fly.x >= view.x && fly.x <= view.x + view.width
    && fly.y >= view.y && fly.y <= view.y + view.height;
  fly.lostFor = inside ? 0 : fly.lostFor + dt;
  if (fly.lostFor > .7) fly.following = true;
  if (fly.following && fly.x > view.x + inset && fly.x < view.x + view.width - inset
    && fly.y > view.y + inset && fly.y < view.y + view.height - inset) {
    fly.following = false;
    fly.turnAt = 0;
  }
  if (fly.following) {
    // Chase a world-space destination only after noticing the player has left.
    fly.gx = view.x + view.width * .5;
    fly.gy = view.y + view.height * .48;
  } else if (fly.time >= fly.turnAt) {
    const choice = random();
    // A focused pause always ends in a trip across the viewport, never another pause.
    const previous = fly.mode;
    fly.mode = previous === 'hover' ? 'cross'
      : previous === 'cross' ? (choice < .65 ? 'hover' : choice < .85 ? 'loop' : 'dart')
      : choice < .25 ? 'hover' : choice < .45 ? 'dart' : choice < .65 ? 'loop' : choice < .8 ? 'drift' : 'cross';
    if (fly.mode === 'cross') {
      // Cross to the opposite horizontal side. Vary the vertical band so trips
      // intersect across the screen rather than retracing one diagonal.
      const fractionX = fly.x < view.x + view.width / 2 ? between(random, .72, .92) : between(random, .08, .28);
      const goDown = (fly.y < view.y + view.height / 2) !== (random() < .3);
      const fractionY = goDown ? between(random, .72, .92) : between(random, .08, .28);
      fly.gx = clamp(view.x + view.width * fractionX, view.x + inset, view.x + view.width - inset);
      fly.gy = clamp(view.y + view.height * fractionY, view.y + inset, view.y + view.height - inset);
      fly.turnAt = fly.time + Math.hypot(fly.gx - fly.x, fly.gy - fly.y) / 180 + 1.2;
    } else {
      const reach = fly.mode === 'hover' ? 12 : fly.mode === 'dart' ? 150 : 180;
      fly.gx = clamp(fly.x + between(random, -reach, reach), view.x + inset, view.x + view.width - inset);
      fly.gy = clamp(fly.y + between(random, -reach, reach), view.y + inset, view.y + view.height - inset);
      fly.turnAt = fly.time + (fly.mode === 'hover' ? between(random, 1.1, 2.2)
        : fly.mode === 'dart' ? between(random, .45, .8) : between(random, .9, 1.8));
    }
  }
  const dx = fly.gx - fly.x, dy = fly.gy - fly.y;
  const distance = Math.hypot(dx, dy);
  const speed = fly.following ? Math.min(780, distance * 1.5)
    : Math.min(fly.mode === 'cross' ? 260 : fly.mode === 'dart' ? 240 : fly.mode === 'hover' ? 12 : 95, distance * 1.8)
      * (.88 + .12 * Math.sin(fly.time * 1.6 + fly.phase));
  if (!fly.following && fly.mode === 'cross' && distance < 24) fly.turnAt = fly.time;
  const curl = !fly.following && fly.mode === 'loop' ? .85 : 0;
  const length = Math.max(1, distance);
  const sway = fly.mode === 'hover' && !fly.following ? 0 : 7;
  const vx = (dx - dy * curl) / length * speed + Math.sin(fly.time * 1.7 + fly.phase) * sway;
  const vy = (dy + dx * curl) / length * speed + Math.cos(fly.time * 2.3 + fly.phase) * sway;
  const ease = 1 - Math.exp(-dt * (fly.mode === 'dart' && !fly.following ? 5 : 2.6));
  fly.vx += (vx - fly.vx) * ease;
  fly.vy += (vy - fly.vy) * ease;
  fly.x = clamp(fly.x + fly.vx * dt, 18, world.width - 18);
  fly.y = clamp(fly.y + fly.vy * dt, 18, world.height - 18);
  return fly;
}

export function createFly(world, grid) {
  const element = document.createElement('div');
  element.className = 'fly';
  element.setAttribute('aria-hidden', 'true');
  element.innerHTML = `<span class="fly-shadow"></span><svg class="fly-body" viewBox="0 0 28 28" xmlns="http://www.w3.org/2000/svg">
    <g fill="${PALETTE.eye}" fill-opacity=".8" stroke="${PALETTE.skin[3]}" stroke-width=".8">
      <path class="fly-wing fly-wing-left" d="M11 13 C8 14 4 18 5 22 C7 26 14 21 15 14Z"/>
      <path class="fly-wing fly-wing-right" d="M17 13 C20 14 24 18 23 22 C21 26 14 21 13 14Z"/>
    </g>
    <path d="M11 18l-3 2m9-2 3 2M12 10l-2-3m6 3 2-3" fill="none" stroke="${PALETTE.ink}" stroke-width="1" stroke-linecap="round"/>
    <ellipse cx="14" cy="16" rx="4.5" ry="6" fill="${PALETTE.complements.hair}"/>
    <ellipse cx="14" cy="11" rx="3.7" ry="3.2" fill="${PALETTE.ink}"/>
    <ellipse cx="12.6" cy="14.5" rx="1.2" ry="2.1" fill="${PALETTE.skin[1]}"/>
    <ellipse cx="12.8" cy="10" rx="1" ry=".65" fill="${PALETTE.paper}" fill-opacity=".55"/>
  </svg>`;
  world.append(element);
  const body = element.querySelector('.fly-body'), shadow = element.querySelector('.fly-shadow');
  const wings = [...element.querySelectorAll('.fly-wing')];
  let flight, last = 0, heading = 0, position = null;
  function viewport() {
    const view = window.visualViewport;
    return { x: world.scrollLeft + (view?.offsetLeft || 0), y: world.scrollTop + (view?.offsetTop || 0),
      width: view?.width || world.clientWidth, height: view?.height || world.clientHeight };
  }
  function place() {
    const view = viewport();
    flight = createFlight(view.x + view.width * .62, view.y + view.height * .42);
    last = 0;
    draw(0);
  }
  function draw(dt) {
    const t = flight.time, phase = flight.phase;
    const altitude = .5 + .5 * Math.sin(t * 1.4 + phase) * Math.cos(t * .57);
    const flutter = flight.mode === 'hover' ? .35 : 1;
    const x = flight.x + Math.sin(t * 23 + phase) * 1.3 * flutter;
    const y = flight.y + Math.cos(t * 29) * .9 * flutter;
    position = { x, y: y - altitude * 3 };
    // Native SVG pivots avoid CSS transform-box/individual-scale differences in Safari.
    const flutterAngle = Math.sin(t * 83) * 10;
    wings[0].setAttribute('transform', `rotate(${flutterAngle.toFixed(2)} 14 13)`);
    wings[1].setAttribute('transform', `rotate(${(-flutterAngle).toFixed(2)} 14 13)`);
    const moving = Math.hypot(flight.vx, flight.vy) > 8;
    const direction = moving ? Math.atan2(flight.vy, flight.vx) + Math.PI / 2 : heading;
    heading += Math.atan2(Math.sin(direction - heading), Math.cos(direction - heading)) * (1 - Math.exp(-dt * 5));
    element.style.transform = `translate3d(${(x - 14).toFixed(2)}px,${(y - 14).toFixed(2)}px,0)`;
    body.style.transform = `translateY(${-altitude * 3}px) rotate(${heading.toFixed(3)}rad) scale(${(.88 + altitude * .14).toFixed(3)})`;
    shadow.style.transform = `translate(${(3 + altitude * 4).toFixed(2)}px,${(5 + altitude * 4).toFixed(2)}px) scale(${(1 - altitude * .25).toFixed(3)})`;
    shadow.style.opacity = (.29 - altitude * .08).toFixed(3);
  }
  return {
    place,
    position: () => position,
    update(now) {
      if (!flight) return;
      const dt = last ? Math.min(.05, (now - last) / 1000) : 0;
      last = now;
      stepFlight(flight, dt, viewport(), { width: grid.clientWidth, height: grid.clientHeight });
      draw(dt);
    },
  };
}
