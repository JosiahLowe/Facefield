import { PALETTE } from './palette.js';

const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const between = (r,a,b) => a+r()*(b-a);
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);

// Navigation uses mosaic cells, just like flower placement. Scrolling never
// enters this state; resizing scales both flowers and the butterfly together.
export function createButterflyFlight(x,y,random=Math.random) {
  return {x,y,vx:0,vy:0,time:0,phase:random()*Math.PI*2,patchId:null,
    center:null,flowers:[],target:null,mode:'idle',until:0,recent:[],visits:0};
}
function chooseFlower(state,random) {
  const fresh=state.flowers.filter(f=>!state.recent.includes(f.id)&&f.id!==state.target?.id);
  const others=state.flowers.filter(f=>f.id!==state.target?.id);
  const pool=(fresh.length?fresh:others.length?others:state.flowers)
    .slice().sort((a,b)=>distance(a,state)-distance(b,state)).slice(0,8);
  return pool.length ? {...pool[Math.floor(random()*pool.length)]} : null;
}
export function retargetButterfly(state,patch,random=Math.random) {
  if (patch?.id===state.patchId) {
    state.flowers=patch?.flowers||[];
    state.center=patch?.center||null;
    return;
  }
  state.patchId=patch?.id??null;
  state.center=patch?.center||null;
  state.flowers=patch?.flowers||[];
  state.recent=[];state.target=null;state.until=0;
  state.mode=patch?'travel':'idle';
  // Interrupt a landing or old flight immediately, without changing position.
  if (patch) {
    state.target=chooseFlower(state,random);
    const goal=state.target||state.center,d=distance(state,goal)||1;
    const speed=Math.min(4,Math.hypot(state.vx,state.vy));
    state.vx=(goal.x-state.x)/d*speed;state.vy=(goal.y-state.y)/d*speed;
  } else {state.vx=0;state.vy=0;}
}
export function stepButterfly(state,dt,bounds,flowerHead=()=>null,random=Math.random) {
  dt=clamp(dt,0,.05);state.time+=dt;
  if (!state.center) return state;
  if (state.target) {
    const head=flowerHead(state.target.id);
    if (head) {state.target.x=head.x;state.target.y=head.y;}
    else {
      state.flowers=state.flowers.filter(f=>f.id!==state.target.id);
      state.target=null;state.mode='travel';state.until=0;
    }
  }
  if (!state.target&&state.flowers.length) state.target=chooseFlower(state,random);
  let goal=state.target||state.center;
  if (state.mode==='idle') state.mode='travel';
  if (state.mode==='landed') {
    if (state.time<state.until&&state.target) {
      state.x=goal.x;state.y=goal.y;state.vx=0;state.vy=0;
      return state;
    }
    state.mode='takeoff';state.until=state.time+between(random,.7,1.1);
    if (state.target) state.recent=[...state.recent,state.target.id].slice(-3);
    state.visits++;
  }
  if (state.mode==='takeoff') {
    if (state.time>=state.until) {
      state.target=chooseFlower(state,random);goal=state.target||state.center;
      state.mode=state.target?'approach':'travel';
    } else goal={x:goal.x+Math.cos(state.phase)*.25,y:goal.y-.38};
  }
  if (state.mode==='travel'&&state.target&&distance(state,goal)<2) state.mode='approach';
  if (state.mode==='approach'&&state.target&&distance(state,goal)<.13) {
    state.mode=random()<.6?'hover':'landing';
    state.until=state.time+between(random,.7,1.6);
  }
  if (state.mode==='hover') {
    if (state.time>=state.until) state.mode='landing';
    else goal={x:goal.x+Math.sin(state.time*1.6+state.phase)*.07,y:goal.y-.12+Math.cos(state.time*1.2)*.035};
  }
  if (state.mode==='landing'&&state.target&&distance(state,goal)<.025) {
    state.mode='landed';state.until=state.time+between(random,2,4.8);
    state.x=goal.x;state.y=goal.y;state.vx=0;state.vy=0;
    return state;
  }
  const dx=goal.x-state.x,dy=goal.y-state.y,d=Math.hypot(dx,dy),length=Math.max(.001,d);
  const traveling=state.mode==='travel',slow=state.mode==='hover'||state.mode==='landing';
  const speed=Math.min(traveling?12:slow ? .8 : 2.6,d*(slow?3:2));
  // Perpendicular drift fades near a destination, so it cannot cause circling.
  const curve=Math.sin(state.time*1.1+state.phase)*Math.min(traveling ? .7 : .25,d*.14);
  const vx=dx/length*speed-dy/length*curve,vy=dy/length*speed+dx/length*curve;
  const ease=1-Math.exp(-dt*(traveling?3.5:5));
  state.vx+=(vx-state.vx)*ease;state.vy+=(vy-state.vy)*ease;
  state.x=clamp(state.x+state.vx*dt,.35,bounds.width-.35);
  state.y=clamp(state.y+state.vy*dt,.35,bounds.height-.35);
  return state;
}

export function createButterfly(world,grid,flowers) {
  const element=document.createElement('div');
  element.className='butterfly';element.setAttribute('aria-hidden','true');
  const wing=(side)=>`<g class="butterfly-wing butterfly-wing-${side}">
    <ellipse cx="11" cy="17" rx="9" ry="11" fill="${PALETTE.skin[0]}" stroke="${PALETTE.ink}" stroke-width=".65"/>
    <ellipse cx="12" cy="28" rx="7" ry="8" fill="${PALETTE.skin[2]}" stroke="${PALETTE.ink}" stroke-width=".65"/>
    <ellipse cx="10" cy="16" rx="4" ry="6" fill="${PALETTE.skin[2]}"/>
    <circle cx="11" cy="27" r="2.8" fill="${PALETTE.skin[1]}"/>
    <circle cx="8" cy="11" r="1.4" fill="${PALETTE.paper}"/>
  </g>`;
  element.innerHTML=`<span class="butterfly-shadow"></span><svg class="butterfly-body" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    ${wing('left')}<g transform="translate(40 0) scale(-1 1)">${wing('right')}</g>
    <ellipse cx="20" cy="22" rx="1.9" ry="10" fill="${PALETTE.ink}"/>
    <circle cx="20" cy="11" r="2.6" fill="${PALETTE.ink}"/>
    <g fill="${PALETTE.ink}"><polygon points="19,10 15,4 18,5"/><polygon points="21,10 25,4 22,5"/></g>
  </svg>`;
  world.append(element);
  const body=element.querySelector('.butterfly-body'),shadow=element.querySelector('.butterfly-shadow');
  const wings=[...element.querySelectorAll('.butterfly-wing')];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let flight=null,last=0,nextPatch=0,heading=0,lift=4,position=null,occupied=null;
  function occupancy() {
    const next=flight?.mode==='landed'?flight.target?.id:null;
    if (next!==occupied) {occupied=next;flowers.setOccupant(next);}
  }
  function draw(dt) {
    if (!flight) return;
    const unit=grid.clientWidth/48,landed=flight.mode==='landed';
    const altitude=landed?0:.5+.5*Math.sin(flight.time*1.4+flight.phase);
    lift+=((landed?9:3+altitude*3)-lift)*(1-Math.exp(-dt*5));
    const x=flight.x*unit,y=flight.y*unit-lift;
    position={x,y};
    element.style.transform=`translate3d(${(x-18).toFixed(2)}px,${(y-18).toFixed(2)}px,0)`;
    const moving=Math.hypot(flight.vx,flight.vy)>.06;
    const direction=landed?0:moving?Math.atan2(flight.vy,flight.vx)+Math.PI/2:heading;
    heading+=Math.atan2(Math.sin(direction-heading),Math.cos(direction-heading))*(1-Math.exp(-dt*4));
    body.style.transform=`rotate(${heading.toFixed(3)}rad)`;
    const spread=reduced.matches ? .65 : landed ? .47+.1*Math.sin(flight.time*3+flight.phase):.3+.7*(.5+.5*Math.sin(flight.time*21));
    for (const w of wings) w.setAttribute('transform',`translate(20 0) scale(${spread.toFixed(3)} 1) translate(-20 0)`);
    shadow.style.transform=`translate(${(4+altitude*3).toFixed(2)}px,${(4+altitude*3).toFixed(2)}px) scale(${(landed ? .7 : .9).toFixed(2)})`;
    shadow.style.opacity=(landed ? .14 : .21).toFixed(2);
    element.dataset.mode=flight.mode;element.dataset.singerIndex=flight.center?String(flight.singer):'';
    element.dataset.flower=flight.target?.id||'';element.dataset.patch=flight.patchId??'';
    element.dataset.worldX=x.toFixed(3);element.dataset.worldY=y.toFixed(3);
  }
  function followSinger(patch) {
    if (!flight&&patch) {
      flight=createButterflyFlight(patch.center.x+.45,patch.center.y-.35);
    }
    if (!flight) return;
    retargetButterfly(flight,patch);flight.singer=patch?.singer;
    occupancy();last=0;nextPatch=0;draw(0);
  }
  reduced.addEventListener('change',()=>{last=0;if(reduced.matches){flowers.setOccupant(null);occupied=null;}draw(0);});
  document.addEventListener('visibilitychange',()=>{last=0;});
  return {
    followSinger,
    place(){draw(0);},
    position:()=>position,
    update(now) {
      if (!flight||document.hidden||reduced.matches) return;
      const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
      if (now>=nextPatch) {followPatch(flowers.patch(now));nextPatch=now+450;}
      stepButterfly(flight,dt,{width:48,height:grid.clientHeight/(grid.clientWidth/48)},id=>flowers.flowerHead(id,now));
      occupancy();draw(dt);
    },
  };
  function followPatch(patch) {
    // Same-patch refresh only discovers newly opened buds; it never interrupts a visit.
    if (patch?.id!==flight.patchId) followSinger(patch);
    else {retargetButterfly(flight,patch);flight.singer=patch?.singer;}
  }
}
