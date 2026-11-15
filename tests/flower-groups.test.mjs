import test from 'node:test';
import assert from 'node:assert/strict';
import {flowerGrouping,groupGeometry,MOUND_BLOOMS,groupStemPaths,groupFoliage} from '../flower-groups.js';
test('groupings use stable varieties with a central landing bloom and bounded heads',()=>{
 const found=new Set();for(let i=0;i<100;i++){
  const f={rank:i/100};const kind=flowerGrouping(f);found.add(kind);
  const g=groupGeometry(f,'#A776C0','#779944');assert.deepEqual(g,groupGeometry(f,'#A776C0','#779944'));
  if(kind==='single'){assert.equal(g,null);continue;}
  assert.ok(g.foliage.includes('path'));assert.ok(!g.petals.includes('<filter'));
  if(kind==='mound'){
   assert.equal((g.petals.match(/data-bloom=/g)||[]).length,7);
   assert.deepEqual(MOUND_BLOOMS[0],{x:0,y:0});
   assert.ok(MOUND_BLOOMS.every(p=>Math.abs(p.x)+.09<.33&&Math.abs(p.y)+.09<=.34));
  }else{assert.equal((g.petals.match(/data-spike=/g)||[]).length,4);assert.match(g.petals,/cx="0" cy="0"/);}
 }assert.deepEqual([...found],['mound','spikes','single']);
});

test('grouped blooms have distinct ground-rooted stems that follow moving heads',()=>{
 for(const kind of ['mound','spikes']){
  const pose={headX:.12,headOffset:-.65,headTilt:18},paths=groupStemPaths(kind,pose,1.08);
  assert.equal(paths.length,kind==='mound'?7:5);
  const roots=new Set();
  for(const path of paths){const n=path.replace(/[MQ]/g,' ').trim().split(/\s+/).map(Number);assert.equal(n[1],0,'each stem begins at ground level');assert.ok(n[5]<-.3,'stem reaches a separate elevated flower');roots.add(n[0]);}
  assert.ok(roots.size>=5,'stems spread over the base instead of sharing one raised stalk');
  const center=paths[kind==='mound'?0:4].replace(/[MQ]/g,' ').trim().split(/\s+/).map(Number);
  assert.equal(center[4],pose.headX);assert.equal(center[5],pose.headOffset,'central bloom remains a valid moth landing point');
  assert.ok(groupFoliage(kind).startsWith('M0 0'),'foliage grows at the ground base');
 }
});
