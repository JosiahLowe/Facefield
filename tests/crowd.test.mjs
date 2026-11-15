import test from 'node:test';
import assert from 'node:assert/strict';
import {crowdTraits,crowdLayout,CROWD_PALETTE} from '../crowd-art.js';
import {mosaicLayout} from '../mosaic.js';
test('crowd presentation preserves all stable model identities in staggered bounded slots',()=>{
 const model=mosaicLayout('crowd',48,1152),before=JSON.stringify(model),a=crowdLayout(model);
 assert.deepEqual(a,crowdLayout(model));assert.equal(JSON.stringify(model),before);assert.equal(a.length,1152);
 assert.equal(new Set(a.map(c=>`${c.column}:${c.row}`)).size,1152);
 for(const c of a){assert.ok(c.column>=1&&c.column-1+c.width<=48);assert.ok(c.row>=1&&c.row-1+c.height<=48.00001);}
 assert.equal(new Set(a.map(c=>c.row)).size,36);
});
test('crowd traits use independent deterministic variation and the coordinated palette',()=>{
 const styles=new Set(),eyes=new Set();for(let i=0;i<1152;i++){
 const a=crowdTraits('crowd',i);assert.deepEqual(a,crowdTraits('crowd',i));assert.notDeepEqual(a,crowdTraits('other',i));
 assert.ok(CROWD_PALETTE.skin.includes(a.skin));assert.ok(CROWD_PALETTE.hair.includes(a.hair));styles.add(a.style);eyes.add(a.eyes);
 }assert.equal(styles.size,6);assert.equal(eyes.size,2);
});
