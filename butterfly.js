import { PALETTE } from './palette.js?v=moth-6a-11';

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

export function mothShadowPose(heading,spread,height,rest,speed) {
  height=clamp(height,0,1);rest=clamp(rest,0,1);spread=clamp(spread,0,1);
  const size=.9+.1*height-.15*rest;
  return {rotation:heading+Math.PI/2,offset:4+height*3,
    scaleX:size*(.6+.4*spread),scaleY:size*(.85+.1*clamp(speed/1.8,0,1)),
    opacity:(.22-.07*height-.06*rest)*(.8+.2*spread)};
}

// Special story flight is deliberately direct. Normal wandering is unchanged.
export function stepStoryFlight(state, dt, goal, speed = 8) {
  const dx=goal.x-state.x,dy=goal.y-state.y,d=Math.hypot(dx,dy);
  const travel=Math.min(d,Math.max(0,dt)*speed);
  state.vx=d ? dx/d*speed : 0;state.vy=d ? dy/d*speed : 0;
  if(d){state.x+=dx/d*travel;state.y+=dy/d*travel;}
  if(d<=travel){state.x=goal.x;state.y=goal.y;state.vx=0;state.vy=0;return true;}
  return false;
}

export function createButterfly(world,grid,flowers) {
  const element=document.createElement('div');
  element.className='butterfly';element.setAttribute('aria-hidden','true');
  // Moth 6A: two mirrored, downward teardrops. Each wing begins on the
  // existing x=20 hinge, so fluttering stays attached to the body at all scales.
  const wing=(side)=>`<g class="butterfly-wing butterfly-wing-${side}">
    <path class="moth-wing-shape" d="M20 14.5 L3.8 27 C1.2 29 1 30.8 3.6 31.4 C5.9 32 9 32.4 11.6 32.3 C15.8 32 18.1 23.3 20 17Z" fill="${PALETTE.moth.wing}"/>
    <circle class="moth-eyespot" cx="10.2" cy="27" r="2.1" fill="${PALETTE.moth.eyespot}"/>
  </g>`;
  element.innerHTML=`<span class="butterfly-shadow"></span><svg class="moth-remnant" style="display:none" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg"><g fill="#B7463D"><path transform="translate(20 25) scale(1.12) translate(-20 -25)" d="M5 23 C3 18 10 16 16 18 C21 13 30 17 29 21 C37 22 35 29 29 30 C24 35 18 31 14 32 C7 33 3 29 5 23Z"/><circle cx="3" cy="15" r="1.4"/><circle cx="36" cy="15" r="1.8"/><circle cx="37" cy="34" r="1.2"/><circle cx="8" cy="36" r=".9"/></g></svg><svg class="butterfly-body" viewBox="0 0 40 40" xmlns="http://www.w3.org/2000/svg">
    ${wing('left')}<g transform="translate(40 0) scale(-1 1)">${wing('right')}</g>
    <path class="moth-antenna" d="M18.8 12.2 C17.8 8.8 14.8 6.1 11.9 7.8 M21.2 12.2 C22.2 8.8 25.2 6.1 28.1 7.8" fill="none" stroke="${PALETTE.moth.antenna}" stroke-width=".75" stroke-linecap="round"/>
    <path class="moth-abdomen" d="M20 15.5 C17.5 15.5 17 20.6 17.3 25 C17.6 29.3 19.1 33.2 20 33.2 C20.9 33.2 22.4 29.3 22.7 25 C23 20.6 22.5 15.5 20 15.5Z" fill="${PALETTE.moth.body}"/>
    <circle class="moth-head" cx="20" cy="14.1" r="2.6" fill="${PALETTE.moth.body}"/>
  </svg>`;
  world.append(element);
  const body=element.querySelector('.butterfly-body'),shadow=element.querySelector('.butterfly-shadow');
  const remnant=element.querySelector('.moth-remnant');
  const wings=[...element.querySelectorAll('.butterfly-wing')];
  const reduced=matchMedia('(prefers-reduced-motion: reduce)');
  let flight=null,last=0,nextPatch=0,heading=0,lift=4,position=null,occupied=null;
  let shadowHeight=.5,shadowRest=0;
  let story=null,storyLast=null;
  function occupancy() {
    const id=flight?.mode==='landed'?flight.target?.id:null;
    const next=id?`${flight.patchId}:${id}`:null;
    if(next!==occupied){occupied=next;flowers.setOccupant(id,flight?.patchId);}
  }
  function draw(dt) {
    if (!flight) return;
    const unit=grid.clientWidth/48,landed=flight.mode==='landed';
    const dead=story?.phase==='death'||story?.phase==='dead';
    const altitude=dead||landed?0:.5+.5*Math.sin(flight.time*1.4+flight.phase);
    lift+=((dead?0:landed?9:3+altitude*3)-lift)*(1-Math.exp(-dt*5));
    const x=flight.x*unit,y=flight.y*unit-lift;
    position={x,y};
    element.style.transform=`translate3d(${(x-18).toFixed(2)}px,${(y-18).toFixed(2)}px,0)`;
    const moving=Math.hypot(flight.vx,flight.vy)>.06;
    const direction=dead?1.05:landed?0:moving?Math.atan2(flight.vy,flight.vx)+Math.PI/2:heading;
    heading+=Math.atan2(Math.sin(direction-heading),Math.cos(direction-heading))*(1-Math.exp(-dt*4));
    body.style.transform=`rotate(${heading.toFixed(3)}rad)`;
    const spread=dead?.72:reduced.matches ? .65 : landed ? .47+.1*Math.sin(flight.time*3+flight.phase):.3+.7*(.5+.5*Math.sin(flight.time*21));
    for (const w of wings) w.setAttribute('transform',`translate(20 0) scale(${spread.toFixed(3)} 1) ${dead?'rotate(-16) ':''}translate(-20 0)`);
    body.style.opacity=dead?'.78':'1';
    remnant.style.display=story?.phase==='dead'?'block':'none';
    const shadowEase=1-Math.exp(-dt*5);
    shadowHeight+=((landed||dead?0:altitude)-shadowHeight)*shadowEase;
    shadowRest+=((landed||dead?1:0)-shadowRest)*shadowEase;
    const projection=mothShadowPose(heading,spread,shadowHeight,shadowRest,Math.hypot(flight.vx,flight.vy));
    // Projection stays down/right in world space; its footprint turns with the
    // moth and narrows with its wings. Only transform and opacity animate.
    shadow.style.transform=`translate(${projection.offset.toFixed(2)}px,${projection.offset.toFixed(2)}px) rotate(${projection.rotation.toFixed(3)}rad) scale(${projection.scaleX.toFixed(3)}, ${projection.scaleY.toFixed(3)})`;
    shadow.style.opacity=projection.opacity.toFixed(3);
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
    beginStory(tile) {
      const patch=flowers.patch();
      if(!flight||!patch)return;
      adoptPatch(flight,patch);flowers.setOccupant(null);occupied=null;
      const unit=grid.clientWidth/48;
      const rest={x:(tile.offsetLeft+tile.offsetWidth)/unit-.10,y:(tile.offsetTop+tile.offsetHeight)/unit-.12};
      story={goal:{x:patch.center.x,y:patch.center.y-.32},rest,arrived:false,phase:'travel'};
      flight.target=null;flight.mode='story-travel';storyLast=null;draw(0);
    },
    storyArrived:()=>!!story?.arrived,
    fall({immediate=false}={}){
      if(!story)return;
      story.phase='death';story.fallAt=null;story.from={x:flight.x,y:flight.y};
      if(immediate){
        flight.x=story.rest.x;flight.y=story.rest.y;flight.vx=0;flight.vy=0;flight.mode='dead';
        story.phase='dead';heading=1.05;lift=0;shadowHeight=0;shadowRest=1;draw(0);
      }
    },
    endStory(){
      if(!flight)return;
      const {x,y}=flight;
      story=null;storyLast=null;last=0;nextPatch=0;occupied=null;
      flowers.setOccupant(null);
      // A fresh living creature starts at the scene, never at the camera.
      flight=createButterflyFlight(x,y);heading=0;lift=4;draw(0);
    },
    updateStory(now) {
      if(!story||!flight)return;
      const dt=storyLast===null?0:Math.min(.1,(now-storyLast)/1000);storyLast=now;
      flight.time+=dt;
      if(story.phase==='dead'){
        // Dead geometry is static; only a resize needs a new pixel projection.
        const unit=grid.clientWidth/48;
        if(story.unit!==unit){story.unit=unit;draw(0);}return;
      }
      if(story.phase==='death'){
        if(story.fallAt===null)story.fallAt=now;
        const t=reduced.matches?1:clamp((now-story.fallAt)/900,0,1),ease=t*t;
        flight.x=story.from.x+(story.rest.x-story.from.x)*ease;
        flight.y=story.from.y+(story.rest.y-story.from.y)*ease;
        flight.vx=0;flight.vy=0;flight.mode='dead';
        if(t===1){story.phase='dead';heading=1.05;lift=0;shadowHeight=0;shadowRest=1;}
      }else{
        if(!story.arrived)story.arrived=stepStoryFlight(flight,dt,story.goal);
        else{
          const hover={x:story.goal.x+Math.sin(flight.time*1.8)*.20,
            y:story.goal.y+Math.sin(flight.time*2.4+flight.phase)*.10};
          if(!reduced.matches)stepStoryFlight(flight,dt,hover,.5);
        }
        flight.mode=story.arrived?'story-hover':'story-travel';
      }
      draw(dt);
    },
    place(){draw(0);},
    position:()=>position,
    update(now) {
      if (story||!flight||document.hidden||reduced.matches) return;
      const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
      if (now>=nextPatch) {retargetButterfly(flight,flowers.patch(now));nextPatch=now+450;}
      stepButterfly(flight,dt,{width:48,height:grid.clientHeight/(grid.clientWidth/48)},(id,patchId)=>flowers.flowerHead(id,now,patchId));
      occupancy();draw(dt);
    },
  };
}
