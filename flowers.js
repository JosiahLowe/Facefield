import { randomFrom } from './faces.js';
import { PALETTE, mixColor } from './palette.js?v=botanical-variety-8';

const clamp = n => Math.max(0, Math.min(1, n));
const smooth = n => { const t = clamp(n); return t * t * (3 - 2 * t); };
export const FLOWER_LIMITS = { remnants: 48, retiring: 4, rendered: 420 };

export function flowerAppearance(seed, id) {
  const r = randomFrom(`${seed}:flower-appearance:${id}`);
  const green = PALETTE.flowers.stems[Math.floor(r()*PALETTE.flowers.stems.length)];
  const stemColor = mixColor(green,r()<.5 ? PALETTE.paper : PALETTE.ink,r()*.09);
  const leafCount = 1+Math.floor(r()*4), count = 3+Math.floor(r()*7);
  const leaves = Array.from({length:leafCount},(_,i)=>{
    const side = r()<.5 ? -1 : 1, rx = .10+r()*.09;
    return { x: side*rx*.7, y: -.16-(i+.25+r()*.5)/leafCount*.43,
      rx, ry: .035+r()*.04, angle: -side*(20+r()*25) };
  });
  // Dimensions stay within the original animated clearance envelope.
  const petals = Array.from({length:9},()=>({ radius: .085+r()*.045,
    rx: .075+r()*.04, ry: .11+r()*.04, offset: .14+r()*.02 }));
  return {stemColor,leaves,count,shape:r()<.5 ? 'circle' : 'oval',petals};
}

export function flowerMotionProfile(seed, id) {
  // A separate stream leaves all existing positions, sizes and density intact.
  const r = randomFrom(`${seed}:flower-motion:${id}`);
  return { speed: 2*Math.PI/(8+r()*6), amplitude: .8+r()*1.3, phase: r()*Math.PI*2,
    bloomPeriod: 26+r()*20, bloomDuration: 4.5+r()*3, bloomPhase: r(), bloomAmount: .025+r()*.015,
    spinDuration: 8+r()*6, spinPause: 1.5+r()*1.5, spinPhase: r(), spinDirection: r()<.5 ? -1 : 1 };
}
export function flowerHeadTurn(f, seconds) {
  const m = f.motion, leg = m.spinDuration+m.spinPause, period = leg*2;
  const time = seconds+m.spinPhase*period, cycle = Math.floor(time/period);
  const local = time-cycle*period;
  // Half a turn, a short rest, a quarter turn back, another rest. The net
  // quarter turn lets heads wander rather than repeat the same orientation.
  const turn = local<leg ? 180*smooth(local/m.spinDuration)
    : 180-90*smooth((local-leg)/m.spinDuration);
  return m.spinDirection*(cycle*90+turn);
}
export function flowerMotion(f, seconds, life, energy = 0, duration = 0, reduced = false) {
  if (reduced || life.dry) return { sway: 0, expansion: 0, bloom: 0, pulse: 0 };
  const m = f.motion;
  const angle = seconds*m.speed+m.phase;
  const sway = Math.sin(angle)*m.amplitude + Math.sin(angle*.73+m.phase)*.3*clamp(energy);
  const cycleTime = ((seconds+m.bloomPhase*m.bloomPeriod)%m.bloomPeriod+m.bloomPeriod)%m.bloomPeriod;
  const progress = cycleTime/m.bloomDuration;
  // A slow opening and relaxation, followed by a much longer still interval.
  const bloom = life.responsive && progress<1 ? Math.sin(progress*Math.PI)**2*m.bloomAmount : 0;
  const pulse = life.responsive ? clamp(energy)*(.07+clamp(duration/4)*.035) : 0;
  return { sway, expansion: Math.min(.105,bloom+pulse), bloom, pulse };
}

export function flowerWeight(load,seconds) {
  if (!load) return 0;
  return load.target+(load.value-load.target)*Math.exp(-Math.max(0,seconds-load.at)/(load.target ? .45 : 1.1));
}
export function flowerPose(f,life,seconds,energy=0,duration=0,weight=0,reduced=false) {
  const motion=flowerMotion(f,seconds,life,energy,duration,reduced);
  weight=reduced?0:clamp(weight,0,1);
  const side=f.rotation<0?-1:1;
  const base=Math.max(-8.4,Math.min(8.4,f.rotation+motion.sway*(1-weight*.7)+weight*5*side));
  const angle=base+life.droop*.35,headTilt=life.droop*.5+weight*3*side;
  const headOffset=-.70+weight*.045,radians=angle*Math.PI/180,scale=f.size*life.growth;
  return {motion,angle,headTilt,headOffset,weight,
    x:f.x-Math.sin(radians)*headOffset*scale,y:f.y+Math.cos(radians)*headOffset*scale};
}

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
    for (const f of local) f.motion = flowerMotionProfile(seed,f.id);
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
        for (const f of active.flowers.values()) f.retiredAt = now;
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
        if (r() < density) flowers.set(site.id, { ...site, cue: r() < .38, appearance: flowerAppearance(seed,site.id),
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
  const a = f.appearance;
  const shape = f.rank < .35 ? (style.shape ? 'circle' : 'oval') : a.shape;
  const count = f.rank < .35 ? style.petals : a.count;
  const color = PALETTE.flowers.petals[0];
  let petals = '';
  for (let i=0;i<count;i++) {
    const p = a.petals[i];
    const petal = shape === 'circle' ? `<circle cx="0" cy="${-p.offset}" r="${p.radius}"/>`
      : `<ellipse cx="0" cy="${-p.offset}" rx="${p.rx}" ry="${p.ry}"/>`;
    petals += `<g transform="rotate(${i*360/count})">${petal}</g>`;
  }
  const leaves = a.leaves.map(l=>`<ellipse cx="${l.x}" cy="${l.y}" rx="${l.rx}" ry="${l.ry}" transform="rotate(${l.angle} ${l.x} ${l.y})"/>`).join('');
  return `<g class="flower-stem" fill="${a.stemColor}"><rect x="-.018" y="-.70" width=".036" height=".70" rx=".018"/>
    <g class="flower-leaves">${leaves}</g></g>
    <g class="flower-head" transform="translate(0 -.70)">
    <g class="flower-head-shadow" fill="${PALETTE.ink}" transform="translate(.16 .16)"><circle r=".28" opacity=".065"/><circle r=".24" opacity=".14"/></g>
    <g class="flower-petals" fill="${color}"><g class="flower-spin">${petals}</g></g>
    <circle class="flower-center" r=".08" fill="${PALETTE.flowers.center}" stroke="${PALETTE.ink}" stroke-width=".012"/></g>`;
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
  const loads = new Map();
  let occupant=null;
  let field, unit = 1, last = 0, reconciled = -Infinity, dirty = true, music = 0, duration = 0;
  let visible = [];
  function loadFor(id,seconds) {
    const load=loads.get(id),value=flowerWeight(load,seconds);
    if (load&&!load.target&&value<.001) loads.delete(id);
    return value;
  }
  function setOccupant(id) {
    id=reduced.matches?null:id;
    if (id===occupant) return;
    const seconds=performance.now()/1000;
    if (occupant) loads.set(occupant,{value:loadFor(occupant,seconds),target:0,at:seconds});
    occupant=field?.active?.flowers.has(id)?id:null;
    if (occupant) loads.set(occupant,{value:loadFor(occupant,seconds),target:1,at:seconds});
    for (const key of loads.keys()) loadFor(key,seconds);
  }
  function headFor(f,patch,now) {
    const life=flowerLife(f,patch,now/1000),node=nodes.get(`${patch.id}:${f.id}`);
    const energy=node?.energy??(life.responsive?music/(1+(f.distance/4)**2):0);
    return flowerPose(f,life,now/1000,energy,duration,loadFor(f.id,now/1000),reduced.matches);
  }
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
        stem: root.querySelector('.flower-stem'), head: root.querySelector('.flower-head'), headShadow: root.querySelector('.flower-head-shadow'),
        petals: root.querySelector('.flower-petals'), spin: root.querySelector('.flower-spin'),
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
      const pose = flowerPose(f,life,now/1000,node.energy,duration,loadFor(f.id,now/1000),reduced.matches);
      const motion = pose.motion;
      node.root.dataset.stage = life.dry ? 'dry' : life.bloom<.95 ? 'growing' : 'bloom';
      node.root.dataset.load=number(pose.weight);
      node.root.setAttribute('opacity',number(life.opacity));
      node.growth.setAttribute('transform',`rotate(${number(pose.angle)}) scale(${number(life.growth)})`);
      node.head.setAttribute('transform',`translate(0 ${number(pose.headOffset)}) rotate(${number(pose.headTilt)})`);
      const petalScale = number(.18+life.bloom*.82+motion.expansion);
      node.petals.setAttribute('transform',`scale(${petalScale})`);
      const turn = reduced.matches ? 0 : flowerHeadTurn(f,life.dry ? (f.retiredAt??0) : now/1000);
      node.spin.setAttribute('transform',`rotate(${number(turn%360)})`);
      // Cancel the parent stem/head tilt so the shadow stays at 4:30 in world
      // coordinates, even as petals spin, stems sway and retired heads droop.
      const tilt = (pose.angle+pose.headTilt)*Math.PI/180;
      const shadowX = .16*(Math.cos(tilt)+Math.sin(tilt));
      const shadowY = .16*(Math.cos(tilt)-Math.sin(tilt));
      node.headShadow.setAttribute('transform',`translate(${number(shadowX)} ${number(shadowY)}) scale(${petalScale})`);
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
    reset(seed,layout) { field = createFlowerField(seed,layout); nodes.clear(); loads.clear(); occupant=null; layer.replaceChildren(); visible = []; music = 0; resize(); },
    changeSinger(tile) { setOccupant(null); music = 0; field?.changeSinger(tile ? Number(tile.dataset.index) : null,performance.now()/1000); dirty = true; update(performance.now(),true); },
    music(opening,noteDuration = 0) { music = opening; duration = noteDuration; },
    update,
    setOccupant,
    patch(now=performance.now()) {
      const patch=field?.active;
      if (!patch) return null;
      const destinations=[];
      for (const f of patch.flowers.values()) {
        if (flowerLife(f,patch,now/1000).bloom>.65) {
          const head=headFor(f,patch,now);
          // Leave room for the butterfly at outer world edges; unreachable
          // edge blossoms must not trap a landing against the flight bounds.
          if (head.x>.45&&head.x<48-.45&&head.y>.45&&head.y<grid.clientHeight/unit-.45) {
            destinations.push({id:f.id,x:head.x,y:head.y});
          }
        }
      }
      return {id:patch.id,singer:patch.singer,center:patch.center,flowers:destinations};
    },
    flowerHead(id,now=performance.now()) {
      const patch=field?.active,f=patch?.flowers.get(id);
      if (!f||flowerLife(f,patch,now/1000).bloom<=.65) return null;
      const pose=headFor(f,patch,now);
      return {id,x:pose.x,y:pose.y};
    },
  };
}
