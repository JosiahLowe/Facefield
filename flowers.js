import { randomFrom } from './faces.js';
import { PALETTE, mixColor } from './palette.js?v=white-rounded-3';

const clamp = n => Math.max(0, Math.min(1, n));
const smooth = n => { const t = clamp(n); return t * t * (3 - 2 * t); };
export const FLOWER_LIMITS = { remnants: 48, retiring: 4, rendered: 420 };

// Mosaic-cell coordinates survive scrolling and scale with the faces on resize.
// These bounds include full petal expansion, stem sway and the retiring droop.
export function flowerBounds(f) {
  return { left: f.x - f.size * .58, right: f.x + f.size * .58,
    top: f.y - f.size * 1.08, bottom: f.y + f.size * .10 };
}
export function featureBounds(cell) {
  const u = Math.min(cell.width, cell.height);
  const x = cell.column - 1 + (cell.width - u) / 2;
  const y = cell.row - 1 + (cell.height - u) / 2;
  // Resting lids, pupil travel, all mouth expressions and the singing mouth.
  return [[.11,.10,.89,.50], [.34,.10,.65,.65], [.19,.60,.81,.91]]
    .map(([l,t,r,b]) => ({ left: x+l*u, top: y+t*u, right: x+r*u, bottom: y+b*u }));
}
const overlaps = (a,b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
export function safeFlower(f, cell) {
  return !featureBounds(cell).some(rect => overlaps(flowerBounds(f), rect));
}
export function generateFlowerSites(seed, layout) {
  const sites = [], occupied = new Map();
  let width = 0, height = 0;
  layout.forEach((cell,tile) => {
    width = Math.max(width,cell.column-1+cell.width);
    height = Math.max(height,cell.row-1+cell.height);
    for (let y=cell.row-1;y<cell.row-1+cell.height;y++) {
      for (let x=cell.column-1;x<cell.column-1+cell.width;x++) occupied.set(`${x},${y}`,tile);
    }
  });
  function seam(axis,x,y) {
    const r = randomFrom(`${seed}:flower-seam:${axis}:${x}:${y}`);
    const local = [];
    for (let attempt=0;attempt<16 && local.length<2;attempt++) {
      const offset = .12+r()*.76;
      const f = { id: `${axis}-${x}-${y}-${local.length}`,
        x: axis==='v' ? x : x+offset, y: axis==='h' ? y : y+offset,
        size: .14+r()*.20, phase: r()*Math.PI*2, rotation: (r()-.5)*12,
        petals: 4+Math.floor(r()*4), shape: Math.floor(r()*2), color: 0,
        rank: r(), delay: r()*5, duration: 10+r()*5 };
      const bounds = flowerBounds(f), tiles = new Set();
      if (bounds.left<0 || bounds.top<0 || bounds.right>width || bounds.bottom>height) continue;
      for (let row=Math.floor(bounds.top);row<=Math.floor(bounds.bottom);row++) {
        for (let col=Math.floor(bounds.left);col<=Math.floor(bounds.right);col++) {
          const tile = occupied.get(`${col},${row}`);
          if (tile!==undefined) tiles.add(tile);
        }
      }
      f.tiles = [...tiles];
      if (f.tiles.every(tile=>safeFlower(f,layout[tile]))
        && local.every(other=>Math.hypot(f.x-other.x,f.y-other.y)>(f.size+other.size)*.6)) local.push(f);
    }
    sites.push(...local);
  }
  // Only actual shared face edges qualify, never internal lines within a tile
  // or the outside world border. Roots sit exactly on these seams.
  for (let y=0;y<height;y++) for (let x=1;x<width;x++) {
    if (occupied.get(`${x-1},${y}`)!==occupied.get(`${x},${y}`)) seam('v',x,y);
  }
  for (let y=1;y<height;y++) for (let x=0;x<width;x++) {
    if (occupied.get(`${x},${y-1}`)!==occupied.get(`${x},${y}`)) seam('h',x,y);
  }
  return sites;
}
export function singerStyle(seed, singer) {
  const r = randomFrom(`${seed}:flower-style:${singer}`);
  return { shape: Math.floor(r()*2), petals: 4+Math.floor(r()*4), color: Math.floor(r()*PALETTE.flowers.petals.length) };
}
// Compact, softly tapered patches grow only close to a singer. Overlapping
// waves vary the reach so the edge does not form a perfect circle.
export const FLOWER_RADIUS = 7;
export function singerDensity(x, y, singer, phase = 0) {
  const dx = x-singer.x, dy = y-singer.y;
  const distance = Math.hypot(dx,dy);
  const organic = .82 + .12*Math.sin(x*.79+phase)*Math.cos(y*.63-phase)
    + .06*Math.sin(x*1.71+y*.91+phase);
  return .94 * organic * (1-smooth(distance/(5.5+organic)));
}
export function flowerLife(f, patch, now) {
  if (!patch) return { growth: 1, bloom: 1, opacity: .86, droop: 0, dry: false, dryProgress: 0, responsive: false };
  const growAt = time => f.cue ? 1 : smooth((time-patch.born-f.delay)/f.duration);
  const growth = growAt(patch.retired ?? now);
  const age = patch.retired === null ? 0 : smooth((now-patch.retired)/(10+f.rank*10));
  const dry = patch.retired !== null;
  return { growth: (.18+.82*growth)*(1-age*.62), bloom: smooth((growth-.15)/.85)*(1-age*.65),
    opacity: (.35+.65*growth)*(f.remnant ? 1-age*.53 : 1-age),
    droop: age*(22+f.rank*9), dry, dryProgress: age,
    responsive: !dry && growth > .95 };
}

export function createFlowerField(seed, layout) {
  const sites = generateFlowerSites(seed, layout), bins = new Map();
  for (const f of sites) {
    const key = `${Math.floor(f.x/4)},${Math.floor(f.y/4)}`;
    if (!bins.has(key)) bins.set(key, []);
    bins.get(key).push(f);
  }
  let active = null, retiring = [], remnants = [], serial = 0;
  function near(view) {
    const result = [];
    for (let y=Math.floor(view.top/4);y<=Math.floor(view.bottom/4);y++) {
      for (let x=Math.floor(view.left/4);x<=Math.floor(view.right/4);x++) {
        for (const f of bins.get(`${x},${y}`) || []) {
          if (f.x >= view.left && f.x <= view.right && f.y >= view.top && f.y <= view.bottom) result.push(f);
        }
      }
    }
    return result;
  }
  function settle(patch) {
    const dried = [...patch.flowers.values()].filter(f => f.remnant);
    remnants.push(...dried.map(f => ({ ...f, key: `${patch.id}:${f.id}`, style: patch.style, singer: patch.singer })));
    remnants = remnants.slice(-FLOWER_LIMITS.remnants);
  }
  function prune(now) {
    retiring = retiring.filter(patch => {
      if (now-patch.retired < 20) return true;
      settle(patch); return false;
    });
  }
  return {
    sites,
    get active() { return active; },
    get retiring() { return retiring; },
    get remnants() { return remnants; },
    changeSinger(index, now) {
      if (active?.singer === index) return;
      prune(now);
      if (active) {
        active.retired = now;
        // Only a few of the closest flowers become lasting traces.
        [...active.flowers.values()].filter(f => f.distance < 4 && flowerLife(f,active,now).bloom > .6)
          .sort((a,b) => a.rank-b.rank).slice(0,3).forEach(f => { f.remnant = true; });
        retiring.push(active);
        if (retiring.length > FLOWER_LIMITS.retiring) settle(retiring.shift());
      }
      const cell = layout[index];
      if (!cell) { active = null; return; }
      const center = { x: cell.column-1+cell.width/2, y: cell.row-1+cell.height/2 };
      const style = singerStyle(seed,index), flowers = new Map();
      for (const site of sites) {
        const r = randomFrom(`${seed}:patch:${index}:${site.id}`);
        const density = singerDensity(site.x,site.y,center,style.color);
        if (r() < density) flowers.set(site.id, { ...site, cue: r() < .38,
          distance: Math.hypot(site.x-center.x,site.y-center.y), remnant: false });
      }
      // Prevent multiple old visits to one singer from accumulating decoration.
      retiring = retiring.filter(patch => patch.singer !== index);
      remnants = remnants.filter(f => f.singer !== index);
      active = { id: ++serial, singer: index, center, style, flowers, born: now, retired: null };
    },
    visible(view, now) {
      prune(now);
      const local = near(view), result = [];
      const append = (f, patch, key, style) => {
        const life = flowerLife(f,patch,now);
        if (life.opacity > .015) result.push({ f, patch, key, style, life });
      };
      // Current cues have priority under the DOM budget.
      if (active) for (const site of local) {
        const f = active.flowers.get(site.id);
        if (f) append(f,active,`${active.id}:${f.id}`,active.style);
      }
      for (const f of remnants) {
        if (f.x>=view.left && f.x<=view.right && f.y>=view.top && f.y<=view.bottom) {
          result.push({ f, key: f.key, style: f.style, patch: null,
            life: { growth: .38, bloom: .22, opacity: .47, droop: 28, dry: true, dryProgress: 1, responsive: false } });
        }
      }
      for (const patch of retiring) for (const site of local) {
        const f = patch.flowers.get(site.id);
        if (f) append(f,patch,`${patch.id}:${f.id}`,patch.style);
      }
      return result.slice(0,FLOWER_LIMITS.rendered);
    },
  };
}

const NS = 'http://www.w3.org/2000/svg';
const number = n => n.toFixed(4);
function geometry(f, style) {
  const shape = f.rank < .8 ? style.shape : f.shape;
  const count = f.rank < .8 ? style.petals : f.petals;
  const color = PALETTE.flowers.petals[0];
  const stem = PALETTE.flowers.stems[f.color % PALETTE.flowers.stems.length];
  let petals = '';
  for (let i=0;i<count;i++) {
    const petal = shape === 0 ? '<ellipse cx="0" cy="-.16" rx=".105" ry=".15"/>'
      : '<ellipse cx="0" cy="-.16" rx=".12" ry=".13"/>';
    petals += `<g transform="rotate(${i*360/count})">${petal}</g>`;
  }
  return `<g class="flower-stem" fill="${stem}"><rect x="-.018" y="-.70" width=".036" height=".70" rx=".018"/>
    <ellipse cx="-.13" cy="-.34" rx=".16" ry=".065" transform="rotate(30 -.13 -.34)"/>
    <ellipse cx=".12" cy="-.48" rx=".14" ry=".06" transform="rotate(-30 .12 -.48)"/></g>
    <g class="flower-head" transform="translate(0 -.70)"><g class="flower-petals" fill="${color}">${petals}</g>
    <circle r=".082" fill="${PALETTE.ink}"/><circle r=".037" fill="${PALETTE.flowers.petals[0]}"/></g>`;
}

// Shares the face loop. Only culling/lifecycle reconciliation runs at 8 Hz;
// visible SVG pivots animate at 30 Hz, with no per-frame world/face measurements.
export function createFlowers(world, grid) {
  const layer = document.createElementNS(NS,'svg');
  layer.classList.add('flowers');
  layer.setAttribute('aria-hidden','true'); layer.setAttribute('focusable','false');
  world.append(layer);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  const nodes = new Map();
  let field, unit = 1, last = 0, reconciled = -Infinity, dirty = true, music = 0, duration = 0;
  let visible = [];
  function resize() {
    unit = grid.clientWidth/48 || 1;
    layer.setAttribute('width',grid.clientWidth); layer.setAttribute('height',grid.clientHeight);
    layer.setAttribute('viewBox',`0 0 ${grid.clientWidth/unit} ${grid.clientHeight/unit}`);
    dirty = true;
  }
  function reconcile(now) {
    if (!field) return;
    const view = window.visualViewport;
    const x = (world.scrollLeft+(view?.offsetLeft || 0))/unit;
    const y = (world.scrollTop+(view?.offsetTop || 0))/unit;
    visible = field.visible({ left: x-.6, top: y-.6,
      right: x+(view?.width || world.clientWidth)/unit+.6,
      bottom: y+(view?.height || world.clientHeight)/unit+.6 },now/1000);
    const keys = new Set(visible.map(item => item.key));
    for (const [key,node] of nodes) if (!keys.has(key)) { node.root.remove(); nodes.delete(key); }
    for (const item of visible) {
      if (nodes.has(item.key)) continue;
      const root = document.createElementNS(NS,'g');
      root.classList.add('flower'); root.dataset.flower = item.key;
      root.dataset.site = item.f.id; root.dataset.x = item.f.x; root.dataset.y = item.f.y;
      root.setAttribute('transform',`translate(${number(item.f.x)} ${number(item.f.y)}) scale(${number(item.f.size)})`);
      root.innerHTML = `<g class="flower-growth">${geometry(item.f,item.style)}</g>`;
      layer.append(root);
      nodes.set(item.key,{ root, growth: root.firstElementChild,
        stem: root.querySelector('.flower-stem'), head: root.querySelector('.flower-head'),
        petals: root.querySelector('.flower-petals'),
        stemColor: root.querySelector('.flower-stem').getAttribute('fill'), dryLevel: -1, energy: 0 });
    }
    reconciled = now; dirty = false;
  }
  function update(now, force = false) {
    if (!field || document.hidden || (!force && now-last<32)) return;
    const dt = last ? Math.min(.05,(now-last)/1000) : 0;
    last = now;
    if (dirty || now-reconciled>120) reconcile(now);
    for (const item of visible) {
      const {f,patch} = item, node = nodes.get(item.key);
      const life = patch ? flowerLife(f,patch,now/1000) : item.life;
      const response = life.responsive && patch === field.active ? music/(1+(f.distance/4)**2) : 0;
      node.energy += (response-node.energy)*(1-Math.exp(-dt*(4+f.phase)));
      const pulse = reduced.matches ? 0 : node.energy*(.07+Math.min(1,duration/4)*.035);
      const sway = reduced.matches || life.dry ? 0 : Math.sin(now/1800+f.phase)*2.4;
      node.root.dataset.stage = life.dry ? 'dry' : life.bloom<.95 ? 'growing' : 'bloom';
      node.root.setAttribute('opacity',number(life.opacity));
      node.growth.setAttribute('transform',`rotate(${number(f.rotation+sway+life.droop*.35)}) scale(${number(life.growth)})`);
      node.head.setAttribute('transform',`translate(0 -.70) rotate(${number(life.droop*.5)})`);
      node.petals.setAttribute('transform',`scale(${number(.18+life.bloom*.82+pulse)})`);
      const dryLevel = Math.round(life.dryProgress*20);
      if (node.dryLevel !== dryLevel) {
        node.stem.setAttribute('fill',mixColor(node.stemColor,PALETTE.flowers.dried,dryLevel/20));
        node.petals.setAttribute('fill',PALETTE.flowers.petals[0]);
        node.dryLevel = dryLevel;
      }
    }
  }
  world.addEventListener('scroll',() => { dirty = true; if (reduced.matches) update(performance.now(),true); },{passive:true});
  new ResizeObserver(() => { resize(); update(performance.now(),true); }).observe(grid);
  window.visualViewport?.addEventListener('resize',() => { dirty = true; });
  reduced.addEventListener('change',() => update(performance.now(),true));
  // Lifecycles still settle with reduced motion; no decorative sway or pulsing.
  setInterval(() => { if (reduced.matches && !document.hidden) update(performance.now(),true); },250);
  document.addEventListener('visibilitychange',() => { last = 0; dirty = true; });
  return {
    reset(seed,layout) { field = createFlowerField(seed,layout); nodes.clear(); layer.replaceChildren(); visible = []; music = 0; resize(); },
    changeSinger(tile) { music = 0; field?.changeSinger(tile ? Number(tile.dataset.index) : null,performance.now()/1000); dirty = true; update(performance.now(),true); },
    music(opening,noteDuration = 0) { music = opening; duration = noteDuration; },
    update,
    nearby(point,reach = 110) {
      if (!point) return null;
      let best = null, distance = reach;
      for (const item of visible) {
        if (item.life.dry || item.life.bloom<.6) continue;
        const f = item.f, x = f.x*unit, y = (f.y-f.size*.70)*unit;
        const d = Math.hypot(x-point.x,y-point.y);
        if (d<distance) { distance = d; best = {x,y}; }
      }
      return best;
    },
  };
}
