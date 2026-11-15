import test from 'node:test';
import assert from 'node:assert/strict';
import {flowerGrouping,groupGeometry,MOUND_BLOOMS} from '../flower-groups.js';
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
