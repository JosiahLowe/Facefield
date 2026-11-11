import test from 'node:test';
import assert from 'node:assert/strict';
import {createFlight, stepFlight} from '../fly.js';
import {randomFrom} from '../faces.js';

const world = {width:4680,height:4680};
const initialView = {x:2100,y:1900,width:390,height:844};
test('one flight wanders with hover, dart and looping phases, bounded speed and no jumps',()=>{
 const random=randomFrom('flight');
 const fly=createFlight(2295,2322,random), modes=new Set();
 let minSpeed=Infinity,maxSpeed=0;
 for(let i=0;i<7200;i++){
  const x=fly.x,y=fly.y;
  stepFlight(fly,1/60,initialView,world,random);
  modes.add(fly.mode);
  const speed=Math.hypot(fly.vx,fly.vy);
  minSpeed=Math.min(minSpeed,speed);maxSpeed=Math.max(maxSpeed,speed);
  assert.ok(Math.hypot(fly.x-x,fly.y-y)<14);
  assert.ok(fly.x>=18&&fly.x<=world.width-18&&fly.y>=18&&fly.y<=world.height-18);
 }
 assert.equal(modes.size,4);
 assert.ok(minSpeed<5&&maxSpeed>70);
});
test('fast scrolling leaves the fly behind before it catches up from the departure direction',()=>{
 for(const [dx,dy] of [[1300,0],[-1300,0],[0,1300],[0,-1300],[1300,1300]]){
  const random=randomFrom(`follow-${dx}-${dy}`),fly=createFlight(2295,2322,random);
  const view={...initialView,x:initialView.x+dx,y:initialView.y+dy};
  const x=fly.x,y=fly.y;
  for(let i=0;i<30;i++)stepFlight(fly,1/60,view,world,random);
  assert.equal(fly.following,false,'notice delay');
  assert.ok(Math.hypot(fly.x-x,fly.y-y)<35,'no teleport or scroll-speed matching');
  for(let i=0;i<600;i++)stepFlight(fly,1/60,view,world,random);
  assert.ok(fly.x>view.x&&fly.x<view.x+view.width&&fly.y>view.y&&fly.y<view.y+view.height,'returns to viewport');
  assert.equal(fly.following,false,'resumes wandering');
 }
});
