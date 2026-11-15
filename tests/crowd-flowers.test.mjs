import test from 'node:test';
import assert from 'node:assert/strict';
import {mosaicLayout} from '../mosaic.js';
import {crowdLayout} from '../crowd-art.js';
import {createFlowerField,flowerPose} from '../flowers.js';
import {crowdFlowerPlacement,crowdFlowerColor,CROWD_FLOWER_COLORS} from '../crowd-flowers.js';
test('tall crowd flowers keep stable identities and mature heads between neighboring people',()=>{
 const layout=mosaicLayout('tall',48,1152),crowd=crowdLayout(layout),field=createFlowerField('tall',layout);field.changeSinger(500,0);
 const a=layout[500],b=crowd[500],offset={x:b.column+b.width/2-a.column-a.width/2,y:b.row+b.height/2-a.row-a.height/2};
 const colors=new Set();
 for(const f of field.active.flowers.values()){
  const before=JSON.stringify(f),p=crowdFlowerPlacement(f,offset,crowd);
  assert.deepEqual(p,crowdFlowerPlacement(f,offset,crowd));assert.equal(JSON.stringify(f),before);assert.equal(p.flower.id,f.id);
  const head=flowerPose(p.flower,{growth:1,droop:0,dry:false,responsive:false},0,0,0,0,true);
  const [row,column]=p.slot.split(':').map(Number),stagger=row%2?.4:-.4;
  assert.ok(Math.abs(head.x-(column*crowd[0].width+stagger))<1e-9);
  assert.ok(Math.abs(head.y-(row*crowd[0].height+crowd[0].height*.45))<1e-9);
  assert.ok(p.flower.y>head.y+.5);assert.ok(p.depth<Math.floor((1+row*crowd[0].height)*10));
  assert.ok(CROWD_FLOWER_COLORS.includes(crowdFlowerColor(f)));colors.add(crowdFlowerColor(f));
 }assert.ok(colors.size>2);
});
