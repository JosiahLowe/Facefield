import test from 'node:test';
import assert from 'node:assert/strict';
import {createButterflyFlight,retargetButterfly,stepButterfly} from '../butterfly.js';
import {randomFrom} from '../faces.js';

const bounds={width:48,height:48};
const patch={id:1,singer:520,center:{x:24,y:24},flowers:Array.from({length:9},(_,i)=>({id:`flower-${i}`,x:23+i%3,y:23+Math.floor(i/3)}))};
const head=id=>patch.flowers.find(f=>f.id===id)||null;

test('butterfly crosses the world smoothly and repeatedly hovers, lands and visits actual flowers',()=>{
  const r=randomFrom('butterfly-visits'),b=createButterflyFlight(2,2,r),modes=new Set(),visited=new Set();
  retargetButterfly(b,patch,r);
  let fastest=0,landings=0,previous='travel';
  for(let i=0;i<7200;i++){
    const x=b.x,y=b.y;
    stepButterfly(b,1/60,bounds,head,r);modes.add(b.mode);
    fastest=Math.max(fastest,Math.hypot(b.vx,b.vy));
    assert.ok(Math.hypot(b.x-x,b.y-y)<.25,'no teleporting');
    assert.ok(b.x>=.24&&b.x<=47.76&&b.y>=.24&&b.y<=47.76);
    if(b.target)assert.ok(head(b.target.id),'only existing flowers are destinations');
    if(b.mode==='landed'){
      assert.ok(Math.hypot(b.x-head(b.target.id).x,b.y-head(b.target.id).y)<.001);
      assert.equal(b.vx,0);assert.equal(b.vy,0);
      visited.add(b.target.id);if(previous!=='landed')landings++;
    }
    previous=b.mode;
  }
  assert.ok(fastest>8&&fastest<12.1,'faster long-distance travel');
  for(const mode of ['travel','approach','hover','landing','landed','takeoff'])assert.ok(modes.has(mode),mode);
  assert.ok(landings>7&&visited.size>4,'no stuck or endlessly circling targets');
  assert.ok(b.recent.length<=3,'bounded visit history');
});

test('singer changes immediately interrupt every flight or rest state without teleporting',()=>{
  const next={id:2,singer:900,center:{x:42,y:42},flowers:[{id:'new-flower',x:42,y:41}]};
  for(const mode of ['travel','approach','hover','landing','landed','takeoff']){
    const r=randomFrom(`interrupt-${mode}`),b=createButterflyFlight(24,24,r);
    retargetButterfly(b,patch,r);b.mode=mode;b.until=100000;
    const before=[b.x,b.y];
    retargetButterfly(b,next,r);
    assert.deepEqual([b.x,b.y],before);
    assert.equal(b.mode,'travel');assert.equal(b.patchId,next.id);assert.equal(b.target.id,'new-flower');
    const d=Math.hypot(b.x-42,b.y-41);
    stepButterfly(b,1/60,bounds,id=>next.flowers.find(f=>f.id===id),r);
    assert.ok(Math.hypot(b.x-42,b.y-41)<d,'begins moving immediately');
  }
});

test('butterfly waits at the singer for growing flowers and refreshes buds without interrupting rests',()=>{
  const r=randomFrom('buds'),b=createButterflyFlight(6,6,r),empty={...patch,flowers:[]};
  retargetButterfly(b,empty,r);
  for(let i=0;i<1200;i++)stepButterfly(b,1/60,bounds,()=>null,r);
  assert.ok(Math.hypot(b.x-24,b.y-24)<.1,'heads to singer even without open flowers');
  retargetButterfly(b,patch,r);
  for(let i=0;i<1200&&b.mode!=='landed';i++)stepButterfly(b,1/60,bounds,head,r);
  assert.equal(b.mode,'landed');
  const until=b.until,target=b.target.id;
  retargetButterfly(b,{...patch,flowers:[...patch.flowers,{id:'new-bud',x:24.5,y:24.5}]},r);
  assert.equal(b.mode,'landed');assert.equal(b.until,until);assert.equal(b.target.id,target);
  const shifted={...head(target),x:head(target).x+.01,y:head(target).y+.02};
  stepButterfly(b,1/60,bounds,id=>id===target?shifted:head(id),r);
  assert.equal(b.x,shifted.x);assert.equal(b.y,shifted.y,'resting butterfly stays on a bending head');
});

test('long frames remain bounded and removed flowers are abandoned',()=>{
  const r=randomFrom('bounds'),b=createButterflyFlight(1,1,r);
  retargetButterfly(b,patch,r);b.vx=12;b.vy=0;
  const x=b.x,y=b.y;
  stepButterfly(b,60,bounds,head,r);
  assert.ok(Math.hypot(b.x-x,b.y-y)<.65,'hidden tabs never cause a large jump');
  retargetButterfly(b,{...patch,flowers:[]},r);
  stepButterfly(b,1/60,bounds,()=>null,r);
  assert.equal(b.target,null);assert.equal(b.mode,'travel');
});
