import test from 'node:test';import assert from 'node:assert/strict';
import {chorusEntrances,synchronizedParts,melodyPosition} from '../chorus.js';
import {chooseSong} from '../singing.js';
test('chorus joins near 4/8 seconds on real note boundaries and uses exact octave copies',()=>{
  for(let i=0;i<50;i++){
    const song=chooseSong(null,()=>i/50),joins=chorusEntrances(song.melody);
    assert.ok(Math.abs(joins[1]-4)<.5&&Math.abs(joins[2]-8)<.6);
    let elapsed=0;
    for(const note of song.melody){
      const parts=synchronizedParts(note,elapsed,joins);
      if(note.midi!==null){
        assert.equal(parts.length,1+(elapsed+1e-6>=joins[1]?1:0)+(elapsed+1e-6>=joins[2]?1:0));
        for(const part of parts){assert.equal(part.midi-note.midi,[0,12,-12][part.lane]);assert.equal(part.duration,note.duration);}
      }else assert.deepEqual(parts,[]);
      const at=melodyPosition(song.melody,elapsed+.01);assert.ok(Math.abs(at.at-elapsed)<1e-6);
      elapsed+=note.duration;
    }
    assert.ok(melodyPosition(song.melody,elapsed+2).at>=elapsed,'resume can seek past a full cycle');
  }
});

test('three singers can be selected with large pairwise world separation',async()=>{
  const {selectChorusCompanions}=await import('../chorus.js');
  const faces=Array.from({length:100},(_,i)=>({x:(i%10)*600,y:Math.floor(i/10)*600}));
  for(const view of [{width:390,height:844},{width:1440,height:900}])for(let i=0;i<50;i++){
    const group=[faces[55],...selectChorusCompanions(faces,faces[55],view,()=>i/50)];assert.equal(group.length,3);
    for(let a=0;a<3;a++)for(let b=0;b<a;b++)assert.ok(Math.abs(group[a].x-group[b].x)>=view.width*1.6||Math.abs(group[a].y-group[b].y)>=view.height*1.6);
  }
});
