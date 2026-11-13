import test from 'node:test';
import assert from 'node:assert/strict';
import { createStorySequence, STORY_TIMING, inDiscoveryArea, outsideViewport } from '../story.js';
import { stepStoryFlight } from '../butterfly.js';
const step=(s,dt,input={})=>s.step(dt,{offscreen:true,...input});

test('death is gated by fresh offscreen geometry, even after the introduction or scream',()=>{
  const s=createStorySequence();s.start();s.step(0,{arrived:true});
  s.step(100,{offscreen:false});assert.equal(s.state,'singing');
  s.step(0,{offscreen:true});assert.equal(s.state,'scream');
  s.step(STORY_TIMING.scream,{offscreen:false});assert.equal(s.state,'singing','arrival on the last scream frame cancels death');
  for(let i=0;i<500;i++)s.step(.016,{offscreen:i%2===0});
  assert.notEqual(s.state,'death','rapid visibility changes cannot kill the moth');
  s.step(STORY_TIMING.introduction,{offscreen:true});assert.equal(s.state,'scream');
  s.step(STORY_TIMING.scream,{offscreen:true});assert.equal(s.state,'death');
});

test('viewport guard counts partial visibility, zoom offsets and a safety margin',()=>{
  const view={left:100,top:50,right:490,bottom:894};
  assert.equal(outsideViewport({left:480,top:100,right:600,bottom:220},view),false);
  assert.equal(outsideViewport({left:500,top:100,right:620,bottom:220},view,64),false);
  assert.equal(outsideViewport({left:560,top:100,right:680,bottom:220},view,64),true);
  assert.equal(outsideViewport({left:100,top:-100,right:220,bottom:49},view),true);
});

test('stage 1: repeated presses cannot interrupt; introduction waits for actual arrival',()=>{
  const history=[],s=createStorySequence(state=>history.push(state));
  assert.equal(s.start(),true);
  for(let i=0;i<100;i++){step(s,1);assert.equal(s.start(),false);}
  assert.equal(s.state,'traveling','offscreen journeys have no timeout');
  step(s,.05,{arrived:true});assert.equal(s.state,'singing');
  step(s,STORY_TIMING.introduction-.1);assert.equal(s.state,'singing');
  step(s,.11);assert.equal(s.state,'scream');
  assert.deepEqual(history,['traveling','singing','scream']);
});

test('stage 1: direct world flight is continuous, bounded and reaches a distant singer',()=>{
  const state={x:.4,y:.4},goal={x:47,y:47};let arrived=false;
  for(let i=0;i<1000&&!arrived;i++){
    const before={...state};arrived=stepStoryFlight(state,.05,goal);
    assert.ok(Math.hypot(state.x-before.x,state.y-before.y)<=.400001);
    assert.ok(state.x<=goal.x&&state.y<=goal.y);
  }
  assert.equal(arrived,true);assert.equal(state.x,goal.x);assert.equal(state.y,goal.y);
});

test('stage 2: scream, silent fall and crying occur in order without skipping stages',()=>{
  const events=[],s=createStorySequence(state=>events.push(state));s.start();
  step(s,0,{arrived:true});step(s,STORY_TIMING.introduction);
  assert.equal(s.state,'scream');step(s,STORY_TIMING.scream-.01);assert.equal(s.state,'scream');
  step(s,.02);assert.equal(s.state,'death');step(s,STORY_TIMING.death);assert.equal(s.state,'crying');
  step(s,3600);assert.equal(s.state,'crying','scene remains until discovery');
  assert.deepEqual(events,['traveling','singing','scream','death','crying']);
});

test('stage 3: only discovery unlocks resolution; the complete event can run again',()=>{
  const s=createStorySequence();
  for(let cycle=0;cycle<12;cycle++){
    assert.equal(s.state,'idle');assert.equal(s.start(),true);
    assert.equal(s.resume(),false);
    step(s,0,{arrived:true,discovered:true});step(s,STORY_TIMING.introduction);
    step(s,STORY_TIMING.scream);step(s,STORY_TIMING.death);
    assert.equal(s.state,'crying');assert.equal(s.resume(),false);
    step(s,1,{discovered:true});assert.equal(s.state,'discovered');
    step(s,100);assert.equal(s.state,'discovered');assert.equal(s.start(),false);
    assert.equal(s.resume(),true);
  }
});

test('stage 3: discovery uses world coordinates and the existing close-listening radius',()=>{
  const view={x:2400,y:1800,width:390,height:844},center={x:2595,y:2222};
  assert.equal(inDiscoveryArea(center,view),true);
  assert.equal(inDiscoveryArea({...center,x:center.x+100},view),true);
  assert.equal(inDiscoveryArea({...center,x:center.x+130},view),false);
  assert.equal(inDiscoveryArea(center,{...view,x:0,y:0}),false);
  const extent={width:5000,height:5000};
  assert.equal(inDiscoveryArea({x:50,y:50},{x:0,y:0,width:390,height:844},extent),true,'corner singers remain reachable');
  assert.equal(inDiscoveryArea({x:4950,y:4950},{x:4610,y:4156,width:390,height:844},extent),true);
  assert.equal(inDiscoveryArea({x:50,y:50},view,extent),false,'a distant edge scene stays undiscovered');
});
