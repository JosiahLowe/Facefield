import { PALETTE } from './palette.js';

const clamp = (n,a,b) => Math.max(a,Math.min(b,n));
const between = (r,a,b) => a+r()*(b-a);
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);

// Navigation uses mosaic cells, just like flower placement. Scrolling never
// enters this state; resizing scales both flowers and the butterfly together.
export function createButterflyFlight(x,y,random=Math.random) {
  return {x,y,vx:0,vy:0,time:0,phase:random()*Math.PI*2,cruise:1.25+random()*.35,
    patchId:null,singer:null,center:null,flowers:[],target:null,mode:'idle',until:0,
    recent:[],visits:0,aborted:0,skips:0,considered:false,pending:null,migrating:false,
    navAt:0,navOffset:0,navStart:0,guidance:0,progressAt:0,progressDistance:Infinity};
}
function chooseFlower(state,random) {
  const fresh=state.flowers.filter(f=>!state.recent.includes(f.id)&&f.id!==state.target?.id);
  const others=state.flowers.filter(f=>f.id!==state.target?.id);
  const pool=(fresh.length?fresh:others.length?others:state.flowers)
    .slice().sort((a,b)=>distance(a,state)-distance(b,state)).slice(0,8);
  return pool.length ? {...pool[Math.floor(random()*pool.length)]} : null;
}
function adoptPatch(state,patch) {
  state.patchId=patch?.id??null;state.singer=patch?.singer??null;
  state.center=patch?.center||null;state.flowers=patch?.flowers||[];
  state.pending=null;state.recent=[];state.target=null;state.until=0;
  state.migrating=!!patch;state.mode=patch?'travel':'idle';
  state.navAt=0;state.navStart=state.time;state.guidance=0;
  state.progressAt=state.time;state.progressDistance=patch?distance(state,patch.center):Infinity;
  state.considered=false;state.skips=0;
  if(!patch){state.vx=0;state.vy=0;}
}
export function retargetButterfly(state,patch,random=Math.random) {
  if(!patch){adoptPatch(state,null);return;}
  if(patch.id===state.pending?.patch.id){state.pending.patch=patch;return;}
  if(patch.id===state.patchId){state.center=patch.center;state.flowers=patch.flowers;return;}
  if(state.patchId===null){adoptPatch(state,patch);return;}
  // Repeated bud refreshes do not restart this reaction timer. Keep the old
  // activity, target and momentum until the butterfly notices the new music.
  state.pending={patch,at:state.time+between(random,1,3)};
}
function steer(state,vx,vy,dt,bounds,easing=3) {
  const ease=1-Math.exp(-dt*easing);
  state.vx+=(vx-state.vx)*ease;state.vy+=(vy-state.vy)*ease;
  state.x=clamp(state.x+state.vx*dt,.35,bounds.width-.35);
  state.y=clamp(state.y+state.vy*dt,.35,bounds.height-.35);
}
function migrate(state,dt,bounds,random) {
  const d=distance(state,state.center),toward=Math.atan2(state.center.y-state.y,state.center.x-state.x);
  if(state.flowers.length&&d<3.5){
    state.migrating=false;state.mode='approach';state.target=chooseFlower(state,random);
    state.considered=false;return false;
  }
  // An unnoticed lack of progress slowly strengthens attraction, never speed.
  if(state.time-state.progressAt>12){
    state.guidance=clamp(state.guidance+(d>state.progressDistance-.8 ? .09 : -.015),0,.28);
    state.progressDistance=d;state.progressAt=state.time;
  }
  if(state.time>=state.navAt){
    const previous=state.mode,r=random();
    state.mode=previous==='pause'||previous==='circle'?'travel':r<.16?'pause':r<.32?'circle':r<.52?'wander':'travel';
    state.navStart=state.time;state.navOffset=between(random,-(state.mode==='wander'?2.5:1.9),state.mode==='wander'?2.5:1.9);
    state.navAt=state.time+(state.mode==='pause'?between(random,.6,1.3):state.mode==='circle'?between(random,1.1,2.2):between(random,2.5,5));
  }
  if(state.mode==='pause'){
    steer(state,Math.sin(state.time*1.7+state.phase)*.06,Math.cos(state.time*1.3)*.05,dt,bounds);
    return true;
  }
  const attraction=clamp(.32+.44/(1+(d/8)**2)+state.guidance,.32,.9);
  const offset=state.mode==='circle'?state.navOffset+(state.time-state.navStart)*2.6
    :state.navOffset+Math.sin(state.time*.65+state.phase)*.38;
  const weight=state.mode==='circle' ? .18 : attraction;
  let dx=Math.cos(toward)*weight+Math.cos(toward+offset)*(1-weight);
  let dy=Math.sin(toward)*weight+Math.sin(toward+offset)*(1-weight);
  // Near world boundaries, bend the path inward rather than pushing against a wall.
  dx+=Math.max(0,1-state.x)*.8-Math.max(0,state.x-(bounds.width-1))*.8;
  dy+=Math.max(0,1-state.y)*.8-Math.max(0,state.y-(bounds.height-1))*.8;
  const length=Math.max(.001,Math.hypot(dx,dy));
  const speed=Math.min(state.cruise*(.93+.07*Math.sin(state.time*.7+state.phase)),d<1&&!state.flowers.length?d*1.4:Infinity);
  steer(state,dx/length*speed,dy/length*speed,dt,bounds,2.5);
  return true;
}
export function stepButterfly(state,dt,bounds,flowerHead=()=>null,random=Math.random) {
  dt=clamp(dt,0,.05);state.time+=dt;
  if(state.pending&&state.time>=state.pending.at)adoptPatch(state,state.pending.patch);
  if(!state.center)return state;
  if(state.migrating&&migrate(state,dt,bounds,random))return state;
  if(state.target){
    const head=flowerHead(state.target.id,state.patchId);
    if(head){state.target.x=head.x;state.target.y=head.y;}
    else{state.flowers=state.flowers.filter(f=>f.id!==state.target.id);state.target=null;state.mode='approach';}
  }
  if(!state.target){state.target=chooseFlower(state,random);state.considered=false;}
  if(!state.target){state.migrating=true;state.navAt=0;return state;}
  let goal=state.target;
  if(state.mode==='landed'){
    if(state.time<state.until){state.x=goal.x;state.y=goal.y;state.vx=0;state.vy=0;return state;}
    state.mode='takeoff';state.until=state.time+between(random,.7,1.1);
    state.recent=[...state.recent,state.target.id].slice(-3);state.visits++;
  }
  if(state.mode==='takeoff'){
    if(state.time>=state.until){
      state.target=chooseFlower(state,random);goal=state.target;state.mode='approach';state.considered=false;
      if(!goal){state.migrating=true;return state;}
    }else goal={x:goal.x+Math.cos(state.phase)*.25,y:goal.y-.38};
  }
  if(state.mode==='approach'&&!state.considered&&distance(state,goal)<.45){
    state.considered=true;
    if(state.skips<2&&random()<.23){
      state.recent=[...state.recent,state.target.id].slice(-3);state.skips++;state.aborted++;
      state.mode='takeoff';state.until=state.time+between(random,.6,1.1);
    }
  }
  if(state.mode==='approach'&&distance(state,goal)<.13){
    state.mode=random()<.6?'hover':'landing';state.until=state.time+between(random,.7,1.6);
  }
  if(state.mode==='hover'){
    if(state.time>=state.until)state.mode='landing';
    else goal={x:goal.x+Math.sin(state.time*1.6+state.phase)*.07,y:goal.y-.12+Math.cos(state.time*1.2)*.035};
  }
  if(state.mode==='landing'&&distance(state,goal)<.025){
    state.mode='landed';state.skips=0;state.until=state.time+between(random,2,4.8);
    state.x=goal.x;state.y=goal.y;state.vx=0;state.vy=0;return state;
  }
  const dx=goal.x-state.x,dy=goal.y-state.y,d=Math.hypot(dx,dy),length=Math.max(.001,d);
  const slow=state.mode==='hover'||state.mode==='landing';
  const speed=Math.min(slow ? .8 : 1.8,d*(slow?3:2));
  const curve=Math.sin(state.time*1.1+state.phase)*Math.min(.25,d*.14);
  steer(state,dx/length*speed-dy/length*curve,dy/length*speed+dx/length*curve,dt,bounds,5);
  return state;
}

export function createButterfly(world,grid,flowers) {
  const element=document.createElement('div');
  element.className='butterfly';element.setAttribute('aria-hidden','true');
  const wing=(side)=>`<g class="butterfly-wing butterfly-wing-${side}">
    <ellipse cx="11" cy="17" rx="9" ry="11" fill="${PALETTE.skin[0]}"/>
    <ellipse cx="12" cy="28" rx="7" ry="8" fill="${PALETTE.skin[2]}"/>
  </g>`;
  element.innerHTML=`<span class="butterfly-shadow"></span><svg class="butterfly-body" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    ${wing('left')}<g transform="translate(40 0) scale(-1 1)">${wing('right')}</g>
    <ellipse cx="20" cy="21" rx="1.8" ry="10" fill="${PALETTE.complements.hair}"/>
    <g fill="${PALETTE.complements.hair}"><polygon points="19,12 16,6 18,7"/><polygon points="21,12 24,6 22,7"/></g>
  </svg>`;
  world.append(element);
  const body=element.querySelector('.butterfly-body'),shadow=element.querySelector('.butterfly-shadow');
  const wings=[...element.querySelectorAll('.butterfly-wing')];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let flight=null,last=0,nextPatch=0,heading=0,lift=4,position=null,occupied=null;
  function occupancy() {
    const id=flight?.mode==='landed'?flight.target?.id:null;
    const next=id?`${flight.patchId}:${id}`:null;
    if(next!==occupied){occupied=next;flowers.setOccupant(id,flight?.patchId);}
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
    element.dataset.pendingSinger=flight.pending?String(flight.pending.patch.singer):'';
    element.dataset.worldX=x.toFixed(3);element.dataset.worldY=y.toFixed(3);
  }
  function followSinger(patch) {
    if (!flight&&patch) {
      flight=createButterflyFlight(patch.center.x+.45,patch.center.y-.35);
    }
    if (!flight) return;
    retargetButterfly(flight,patch);
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
      if (now>=nextPatch) {retargetButterfly(flight,flowers.patch(now));nextPatch=now+450;}
      stepButterfly(flight,dt,{width:48,height:grid.clientHeight/(grid.clientWidth/48)},(id,patchId)=>flowers.flowerHead(id,now,patchId));
      occupancy();draw(dt);
    },
  };
}
