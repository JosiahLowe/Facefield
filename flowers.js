import {crowdFlowerPlacement,crowdFlowerColor} from './crowd-flowers.js?v=crowd-petal-colors-9';
import { randomFrom } from './faces.js';
import { PALETTE, mixColor } from './palette.js?v=botanical-variety-8';

const clamp = n => Math.max(0, Math.min(1, n));
const smooth = n => { const t = clamp(n); return t * t * (3 - 2 * t); };
export const FLOWER_LIMITS = { remnants: 48, retiring: 4, rendered: 420 };

export function flowerPosture(seed,id) {
  const r=randomFrom(`${seed}:flower-posture:${id}`),choice=r();
  const kind=choice<.4?'upright':choice<.7?'left':'right';
  const bow=kind==='upright'?0:(kind==='left'?-1:1)*(.10+r()*.18);
  // Keep the curved head, leaves and projected shadow inside the original
  // clearance envelope without moving or removing a seeded flower site.
  return {kind,bow,scale:.58/(.58+Math.abs(bow))};
}

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
  // One template per flower; preserve seeded variety between different flowers.
  petals.fill(petals[0]);
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
  const posture=f.posture||{kind:'upright',bow:0,scale:1};
  const side=Math.sign(posture.bow)||(f.rotation<0?-1:1);
  const base=Math.max(-8.4,Math.min(8.4,f.rotation*.25+motion.sway*(1-weight*.7)+weight*5*side));
  const angle=base+life.droop*.35*side;
  const headTilt=Math.sign(posture.bow)*(10+Math.abs(posture.bow)*40)+life.droop*.5*side+weight*3*side;
  const headX=posture.bow,headOffset=-.70+Math.abs(posture.bow)*.3+weight*.045;
  const growthScale=life.growth*posture.scale,radians=angle*Math.PI/180,scale=f.size*growthScale;
  return {motion,angle,headTilt,headX,headOffset,growthScale,weight,
    x:f.x+(Math.cos(radians)*headX-Math.sin(radians)*headOffset)*scale,
    y:f.y+(Math.sin(radians)*headX+Math.cos(radians)*headOffset)*scale};
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
    for (const f of local) {
      f.motion = flowerMotionProfile(seed,f.id);
      f.posture = flowerPosture(seed,f.id);
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
  let active = null, companions = [], retiring = [], remnants = [], serial = 0;
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
  function makePatch(index,now){
    const cell = layout[index];
    if (!cell) return null;
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
    return { id: ++serial, singer: index, center, style, flowers, born: now, retired: null };
  }
  return {
    sites,
    get active() { return active; },
    get retiring() { return retiring; },
    get companions() { return companions; },
    get remnants() { return remnants; },
    clear() { active=null;companions=[];retiring=[];remnants=[]; },
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
      for(const patch of companions){patch.retired=now;for(const f of patch.flowers.values())f.retiredAt=now;retiring.push(patch);}
      companions=[];
      while(retiring.length>FLOWER_LIMITS.retiring)settle(retiring.shift());
      active=makePatch(index,now);
    },
    addSinger(index,now){
      if(active?.singer===index)return active;
      const existing=companions.find(p=>p.singer===index);if(existing)return existing;
      if(!active||companions.length>=2)return null;
      const patch=makePatch(index,now);if(patch)companions.push(patch);return patch;
    },
    visible(view, now, projection = () => ({x:0,y:0})) {
      prune(now);
      const result = [];
      const localFor = singer => { const d=projection(singer);return near({left:view.left-d.x,right:view.right-d.x,top:view.top-d.y,bottom:view.bottom-d.y}); };
      const append = (f, patch, key, style) => {
        const life = flowerLife(f,patch,now);
        if (life.opacity > .015) result.push({ f, patch, key, style, life });
      };
      // Current cues have priority under the DOM budget.
      for(const patch of [active,...companions].filter(Boolean))for(const site of localFor(patch.singer)){
        const f=patch.flowers.get(site.id);
        if(f)append(f,patch,`${patch.id}:${f.id}`,patch.style);
      }
      for (const f of remnants) {
        const d=projection(f.singer);
        if (f.x+d.x>=view.left && f.x+d.x<=view.right && f.y+d.y>=view.top && f.y+d.y<=view.bottom) {
          result.push({ f, key: f.key, style: f.style, patch: null,
            life: { growth: .38, bloom: .22, opacity: .47, droop: 28, dry: true, dryProgress: 1, responsive: false } });
        }
      }
      for (const patch of retiring) for (const site of localFor(patch.singer)) {
        const f = patch.flowers.get(site.id);
        if (f) append(f,patch,`${patch.id}:${f.id}`,patch.style);
      }
      return result.slice(0,FLOWER_LIMITS.rendered);
    },
  };
}

const NS = 'http://www.w3.org/2000/svg';
const number = n => n.toFixed(4);
function geometry(f, style, crowd=false) {
  const a = f.appearance;
  const shape = f.rank < .35 ? (style.shape ? 'circle' : 'oval') : a.shape;
  const count = f.rank < .35 ? style.petals : a.count;
  const color = crowd?crowdFlowerColor(f):PALETTE.flowers.petals[0];
  let petals = '';
  for (let i=0;i<count;i++) {
    const p = a.petals[i];
    const petal = shape === 'circle' ? `<circle cx="0" cy="${-p.offset}" r="${p.radius}"/>`
      : `<ellipse cx="0" cy="${-p.offset}" rx="${p.rx}" ry="${p.ry}"/>`;
    petals += `<g transform="rotate(${i*360/count})">${petal}</g>`;
  }
  const leaves = a.leaves.map(l=>`<ellipse cx="${l.x}" cy="${l.y}" rx="${l.rx}" ry="${l.ry}" transform="rotate(${l.angle} ${l.x} ${l.y})"/>`).join('');
  return `<g class="flower-stem" ${crowd?'mask="url(#crowd-stem-fade)"':''} fill="${a.stemColor}"><path class="flower-stem-path" d="M0 0 Q0 -.35 0 -.70" fill="none" stroke="${a.stemColor}" stroke-width=".036" stroke-linecap="round"/>
    <g class="flower-leaves">${leaves}</g></g>
    <g class="flower-head" transform="translate(0 -.70)">
    <g class="flower-head-shadow" fill="${PALETTE.ink}" transform="translate(.16 .16)"><circle r=".28" opacity=".065"/><circle r=".24" opacity=".14"/></g>
    <g class="flower-petals" fill="${color}"><g class="flower-spin">${petals}</g></g>
    <circle class="flower-center" r=".08" fill="${PALETTE.flowers.center}"/></g>`;
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
  const rows=new Map(),placements=new Map();
  function clearRows(){for(const row of rows.values())row.remove();rows.clear();placements.clear();}
  function rowLayer(depth){
    if(rows.has(depth))return rows.get(depth);
    if(!layer.querySelector('#crowd-stem-fade'))layer.innerHTML='<defs><linearGradient id="crowd-stem-alpha" gradientUnits="userSpaceOnUse" x1="0" y1="-.7" x2="0" y2="0"><stop stop-color="white"/><stop offset=".45" stop-color="white"/><stop offset="1" stop-color="white" stop-opacity="0"/></linearGradient><mask id="crowd-stem-fade" maskUnits="userSpaceOnUse" x="-2" y="-2" width="4" height="4"><rect x="-2" y="-2" width="4" height="4" fill="url(#crowd-stem-alpha)"/></mask></defs>';
    const svg=document.createElementNS(NS,'svg');svg.classList.add('crowd-flower-row');svg.setAttribute('aria-hidden','true');svg.style.zIndex=depth;world.append(svg);rows.set(depth,svg);sizeRow(svg);return svg;
  }
  function sizeRow(svg){svg.setAttribute('width',grid.clientWidth);svg.setAttribute('height',grid.clientHeight);svg.setAttribute('viewBox',`0 0 48 ${grid.clientHeight/unit}`);}

  let occupant=null;
  let field, unit = 1, last = 0, reconciled = -Infinity, dirty = true, music = 0, duration = 0;
  let visible = [], modelLayout=[], presentation=null, headBins=new Map();
  const offset = singer => { const a=modelLayout[singer],b=presentation?.[singer];return b?{x:b.column+b.width/2-a.column-a.width/2,y:b.row+b.height/2-a.row-a.height/2}:{x:0,y:0}; };
  function clearHead(x,y){
    if(!presentation)return true;
    for(let bx=Math.floor(x/2)-1;bx<=Math.floor(x/2)+1;bx++)for(let by=Math.floor(y/2)-1;by<=Math.floor(y/2)+1;by++)for(const c of headBins.get(`${bx}:${by}`)||[]){
      const size=Math.min(c.width,c.height),cx=c.column-1+c.width/2,cy=c.row-1+c.height*.52;
      if(Math.abs(x-cx)<size*.31&&Math.abs(y-cy)<size*.39)return false;
    }
    return true;
  }
  function placement(f,patch){return crowdFlowerPlacement(f,offset(patch?.singer??f.singer),presentation);}
  function allowed(f,patch){
    if(!presentation)return true;
    if(!patch)return true;
    if(!placements.has(patch.id)){
      const chosen=new Set(),slots=new Set();
      for(const site of [...patch.flowers.values()].sort((a,b)=>Number(b.cue)-Number(a.cue)||a.rank-b.rank)){
        const p=placement(site,patch);if(!slots.has(p.slot)){slots.add(p.slot);chosen.add(site.id);}
      }
      placements.set(patch.id,chosen);
    }
    return placements.get(patch.id).has(f.id);
  }
  function projectedHead(f,patch,now){const p=headFor(f,patch,now),d=offset(patch.singer);return presentation?p:{...p,x:p.x+d.x,y:p.y+d.y};}
  function loadFor(id,seconds) {
    const load=loads.get(id),value=flowerWeight(load,seconds);
    if (load&&!load.target&&value<.001) loads.delete(id);
    return value;
  }
  function patchFor(id) {
    return field?.active?.id===id?field.active:field?.companions.find(p=>p.id===id)||field?.retiring.find(p=>p.id===id);
  }
  function setOccupant(id,patchId=field?.active?.id) {
    id=reduced.matches?null:id;
    const key=id?`${patchId}:${id}`:null;
    if (key===occupant) return;
    const seconds=performance.now()/1000;
    if (occupant) loads.set(occupant,{value:loadFor(occupant,seconds),target:0,at:seconds});
    occupant=patchFor(patchId)?.flowers.has(id)?key:null;
    if (occupant) loads.set(occupant,{value:loadFor(occupant,seconds),target:1,at:seconds});
    for (const key of loads.keys()) loadFor(key,seconds);
  }
  function headFor(f,patch,now) {
    const life=flowerLife(f,patch,now/1000),node=nodes.get(`${patch.id}:${f.id}`);
    const energy=node?.energy??(life.responsive?music/(1+(f.distance/4)**2):0);
    return flowerPose(presentation?placement(f,patch).flower:f,life,now/1000,energy,duration,loadFor(`${patch.id}:${f.id}`,now/1000),reduced.matches);
  }
  function resize() {
    unit = grid.clientWidth/48 || 1;
    layer.setAttribute('width',grid.clientWidth); layer.setAttribute('height',grid.clientHeight);
    layer.setAttribute('viewBox',`0 0 ${grid.clientWidth/unit} ${grid.clientHeight/unit}`);
    for(const row of rows.values())sizeRow(row);
    dirty = true;
  }
  function reconcile(now) {
    if (!field) return;
    const view = window.visualViewport;
    const x = (world.scrollLeft+(view?.offsetLeft || 0))/unit;
    const y = (world.scrollTop+(view?.offsetTop || 0))/unit;
    visible = field.visible({ left: x-(presentation?2:.6), top: y-(presentation?2.5:.6),
      right: x+(view?.width || world.clientWidth)/unit+(presentation?2:.6),
      bottom: y+(view?.height || world.clientHeight)/unit+(presentation?2.5:.6) },now/1000,offset).filter(({f,patch})=>{const d=offset(patch?.singer??f.singer);return presentation?allowed(f,patch):clearHead(f.x+d.x,f.y+d.y-f.size*.7);});
    const keys = new Set(visible.map(item => item.key));
    for (const [key,node] of nodes) if (!keys.has(key)) { node.root.remove(); node.frontRoot?.remove(); nodes.delete(key); }
    for (const item of visible) {
      if (nodes.has(item.key)) continue;
      const root = document.createElementNS(NS,'g');
      root.classList.add('flower'); root.dataset.flower = item.key;
      const d=offset(item.patch?.singer??item.f.singer),display=presentation?placement(item.f,item.patch):null,draw=display?.flower||item.f,px=display?draw.x:item.f.x+d.x,py=display?draw.y:item.f.y+d.y;
      root.dataset.site = item.f.id; root.dataset.x = px; root.dataset.y = py;
      root.dataset.posture=item.f.posture.kind;
      root.setAttribute('transform',`translate(${number(px)} ${number(py)}) scale(${number(draw.size)})`);
      root.innerHTML = `<g class="flower-growth">${geometry(item.f,item.style,!!presentation)}</g>`;
      (display?rowLayer(display.depth):layer).append(root);
      if(display)root.querySelector('.flower-head-shadow').setAttribute('display','none');
      nodes.set(item.key,{ root, growth: root.firstElementChild,
        stem: root.querySelector('.flower-stem'), head: root.querySelector('.flower-head'), headShadow: root.querySelector('.flower-head-shadow'),
        petals: root.querySelector('.flower-petals'), spin: root.querySelector('.flower-spin'),
        stemPath: root.querySelector('.flower-stem-path'), leaves:[...root.querySelectorAll('.flower-leaves ellipse')],
        stemColor: root.querySelector('.flower-stem').getAttribute('fill'), dryLevel: -1, energy: 0 });
      if(display){
        // Keep a single animated head, but paint it in the foreground SVG.
        // Matching base/growth transforms keep it attached to the layered stem.
        const node=nodes.get(item.key),frontRoot=document.createElementNS(NS,'g'),frontGrowth=document.createElementNS(NS,'g');
        frontRoot.classList.add('crowd-flower-head-foreground');frontRoot.dataset.flowerHead=item.key;
        frontRoot.setAttribute('transform',root.getAttribute('transform'));
        frontGrowth.append(node.head);frontRoot.append(frontGrowth);layer.append(frontRoot);
        node.frontRoot=frontRoot;node.frontGrowth=frontGrowth;
      }
    }
    for(const [depth,row] of rows)if(!row.childElementCount){row.remove();rows.delete(depth);}
    const live=new Set([field.active,...field.companions,...field.retiring].filter(Boolean).map(p=>p.id));for(const id of placements.keys())if(!live.has(id))placements.delete(id);
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
      const response = life.responsive && (patch === field.active||field.companions.includes(patch)) ? music/(1+(f.distance/4)**2) : 0;
      node.energy += (response-node.energy)*(1-Math.exp(-dt*(4+f.phase)));
      const pose = flowerPose(presentation?placement(f,patch).flower:f,life,now/1000,node.energy,duration,loadFor(item.key,now/1000),reduced.matches);
      const motion = pose.motion;
      node.root.dataset.stage = life.dry ? 'dry' : life.bloom<.95 ? 'growing' : 'bloom';
      node.root.dataset.load=number(pose.weight);
      node.root.setAttribute('opacity',number(life.opacity));
      const growthTransform=`rotate(${number(pose.angle)}) scale(${number(pose.growthScale)})`;
      node.growth.setAttribute('transform',growthTransform);
      if(node.frontRoot){node.frontRoot.setAttribute('opacity',number(life.opacity));node.frontGrowth.setAttribute('transform',growthTransform);}
      node.stemPath.setAttribute('d',`M0 0 Q0 -.35 ${number(pose.headX)} ${number(pose.headOffset)}`);
      node.leaves.forEach((leaf,i)=>{
        const l=f.appearance.leaves[i],t=-l.y/.70;
        const x=l.x+pose.headX*t*t,y=l.y+(pose.headOffset+.70)*t*t;
        const tilt=Math.atan2(2*pose.headX*t,.70-2*(pose.headOffset+.70)*t)*180/Math.PI;
        leaf.setAttribute('cx',number(x));leaf.setAttribute('cy',number(y));
        leaf.setAttribute('transform',`rotate(${number(l.angle+tilt)} ${number(x)} ${number(y)})`);
      });
      node.head.setAttribute('transform',`translate(${number(pose.headX)} ${number(pose.headOffset)}) rotate(${number(pose.headTilt)})`);
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
        node.stemPath.setAttribute('stroke',mixColor(node.stemColor,PALETTE.flowers.dried,dryLevel/20));
        node.petals.setAttribute('fill',presentation?crowdFlowerColor(f):PALETTE.flowers.petals[0]);
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
    setPresentation(layout) { clearRows();presentation=layout;headBins=new Map();for(const c of layout||[]){const key=`${Math.floor((c.column-1+c.width/2)/2)}:${Math.floor((c.row-1+c.height/2)/2)}`;if(!headBins.has(key))headBins.set(key,[]);headBins.get(key).push(c);}nodes.clear();layer.replaceChildren();visible=[];resize();update(performance.now(),true); },
    reset(seed,layout) { clearRows();modelLayout=layout; field = createFlowerField(seed,layout); nodes.clear(); loads.clear(); occupant=null; layer.replaceChildren(); visible = []; music = 0; resize(); },
    clear() { clearRows();field?.clear();nodes.clear();loads.clear();occupant=null;layer.replaceChildren();visible=[];music=0;dirty=true; },
    changeSinger(tile) { music = 0; field?.changeSinger(tile ? Number(tile.dataset.index) : null,performance.now()/1000); dirty = true; update(performance.now(),true); },
    addSinger(tile){field?.addSinger(Number(tile.dataset.index),performance.now()/1000);dirty=true;update(performance.now(),true);},
    music(opening,noteDuration = 0) { music = opening; duration = noteDuration; },
    update,
    setOccupant,
    patch(now=performance.now()) {
      const patch=field?.active;
      if (!patch) return null;
      const destinations=[];
      for (const f of patch.flowers.values()) {
        if (flowerLife(f,patch,now/1000).bloom>.65) {
          const head=projectedHead(f,patch,now);
          // Leave room for the butterfly at outer world edges; unreachable
          // edge blossoms must not trap a landing against the flight bounds.
          if (allowed(f,patch)&&(presentation||clearHead(f.x+offset(patch.singer).x,f.y+offset(patch.singer).y-f.size*.7))&&head.x>.45&&head.x<48-.45&&head.y>.45&&head.y<grid.clientHeight/unit-.45) {
            destinations.push({id:f.id,x:head.x,y:head.y});
          }
        }
      }
      return {id:patch.id,singer:patch.singer,center:{x:patch.center.x+offset(patch.singer).x,y:patch.center.y+offset(patch.singer).y},flowers:destinations};
    },
    flowerHead(id,now=performance.now(),patchId=field?.active?.id) {
      const patch=patchFor(patchId),f=patch?.flowers.get(id);
      if (!f||!allowed(f,patch)||(!presentation&&!clearHead(f.x+offset(patch.singer).x,f.y+offset(patch.singer).y-f.size*.7))||flowerLife(f,patch,now/1000).bloom<=(patch.retired===null ? .65 : .15)) return null;
      const pose=projectedHead(f,patch,now);
      return {id,x:pose.x,y:pose.y};
    },
  };
}
