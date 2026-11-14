import test from 'node:test';import assert from 'node:assert/strict';
import {createStorySequence,STORY_TIMING,inDiscoveryArea,outsideViewport} from '../story.js';
const ready={voices:3,arrived:true,investigated:true,offscreen:true,playing:true};
function active(s){s.start();s.step(0,{voices:3});assert.equal(s.state,'chorus_active');}
test('chorus starts gradually; time alone, arrival alone and scrolling alone never kill the moth',()=>{
 const s=createStorySequence();s.start();assert.equal(s.start(),false);
 s.step(10000,{...ready,voices:2});assert.equal(s.state,'chorus_starting');
 s.step(0,{voices:3});
 for(const missing of ['arrived','investigated','offscreen','playing']){s.step(10000,{...ready,[missing]:false});assert.equal(s.state,'chorus_active');assert.equal(s.offscreenTime,0);}
});
test('two continuous offscreen seconds plus brief chorus tail precede a single scream',()=>{
 const history=[],s=createStorySequence(state=>history.push(state));active(s);
 s.step(1.9,ready);assert.equal(s.state,'chorus_active');
 s.step(.1,{...ready,offscreen:false});assert.equal(s.offscreenTime,0);
 s.step(1.9,ready);assert.equal(s.state,'chorus_active');s.step(.11,ready);assert.equal(s.state,'death_pending');
 s.step(STORY_TIMING.chorusTail-.01,ready);assert.equal(s.state,'death_pending');s.step(.02,ready);assert.equal(s.state,'scream');
 s.step(STORY_TIMING.scream,{offscreen:false});assert.equal(s.state,'scream','returning during scream prevents onscreen death');
 s.step(1.9,{offscreen:true});assert.equal(s.state,'scream');s.step(.11,{offscreen:true});assert.equal(s.state,'death');
 s.step(STORY_TIMING.death);assert.equal(s.state,'crying');s.step(1000);assert.equal(s.state,'crying');
 s.step(0,{discovered:true});assert.equal(s.state,'discovered');assert.equal(s.resume(),true);
 assert.equal(history.filter(s=>s==='scream').length,1);assert.equal(s.state,'idle');
});
test('watching, muting or focus loss cancels pending death and resets continuous offscreen time',()=>{
 for(const pause of [false,true]){
  const s=createStorySequence();active(s);s.step(2.01,ready);assert.equal(s.state,'death_pending');
  if(pause)s.pause();else s.step(.1,{...ready,playing:false});
  assert.equal(s.state,'chorus_active');assert.equal(s.offscreenTime,0);
  s.step(.1,ready);assert.equal(s.state,'chorus_active');
 }
});
test('world viewport guards include face/moth bounds, zoom offsets and safety margins',()=>{
 const view={left:100,top:50,right:490,bottom:894};
 assert.equal(outsideViewport({left:480,top:100,right:600,bottom:220},view),false);
 assert.equal(outsideViewport({left:500,top:100,right:620,bottom:220},view,96),false);
 assert.equal(outsideViewport({left:600,top:100,right:720,bottom:220},view,96),true);
});
test('discovery retains the existing central area and reachable world-edge behavior',()=>{
 const view={x:2400,y:1800,width:390,height:844},center={x:2595,y:2222};
 assert.equal(inDiscoveryArea(center,view),true);assert.equal(inDiscoveryArea({...center,x:center.x+130},view),false);
 assert.equal(inDiscoveryArea(center,{...view,x:0,y:0}),false);
 assert.equal(inDiscoveryArea({x:50,y:50},{x:0,y:0,width:390,height:844},{width:5000,height:5000}),true);
});
