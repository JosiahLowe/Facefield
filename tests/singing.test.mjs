import test from 'node:test';
import assert from 'node:assert/strict';
import { MELODY, frequencyFor, VIBRATO, chooseSinger, chooseSong } from '../singing.js';

test('long melody stays in C major and includes sustained notes and breaths', () => {
  assert.ok(MELODY.length >= 15);
  assert.ok(MELODY.some(n=>n.midi===null));
  assert.ok(MELODY.reduce((sum,n)=>sum+n.duration,0) >= 30);
  for(const n of MELODY) {
    assert.ok(n.duration>=.65);
    if(n.midi!==null)assert.ok([60,62,64,65,67,69,71,72].includes(n.midi));
  }
  assert.equal(frequencyFor(69),440);
  assert.ok(Math.abs(frequencyFor(60)-261.625565)<.001);
});

test('vibrato stays restrained and singer changes exclude the current face', () => {
  assert.ok(VIBRATO.rate >= 4 && VIBRATO.rate <= 6);
  assert.ok(VIBRATO.depth > 0 && VIBRATO.depth <= 40);
  const faces = [0, 1, 2, 3];
  const choices = new Set();
  for(let i=0;i<100;i++) {
    const choice = chooseSinger(faces, 1, () => i/100);
    assert.notEqual(choice,1);choices.add(choice);
  }
  assert.deepEqual([...choices].sort(),[0,2,3]);
  assert.equal(chooseSinger([1],1),1);
});

test('distance attenuation is bounded, monotonic and retains distant audibility', async () => {
  const { distanceVolume } = await import('../singing.js');
  for(const diagonal of [500,930,1800]) {
    assert.equal(distanceVolume(0,diagonal),.25);
    assert.equal(distanceVolume(diagonal*.1,diagonal),.25);
    let previous=.25;
    for(let i=1;i<=100;i++) {
      const gain=distanceVolume(i*diagonal/10,diagonal);
      assert.ok(gain<=previous && gain>.02 && gain<=.25);
      previous=gain;
    }
    assert.ok(distanceVolume(10*diagonal,diagonal)<.022);
  }
});

test('horizontal panning is centered, symmetric, gradual and never hard-separated', async () => {
  const { horizontalPan } = await import('../singing.js');
  for(const width of [320,390,1440]) {
    assert.equal(horizontalPan(0,width),0);
    let previous=0;
    for(let i=1;i<=100;i++) {
      const pan=horizontalPan(i*width/20,width);
      assert.ok(pan>previous&&pan<=.65);
      assert.ok(Math.abs(pan+horizontalPan(-i*width/20,width))<1e-12);
      previous=pan;
    }
    assert.ok(horizontalPan(width,width)>.5);
  }
});

test('singer handoffs share a key, advance I–V–vi–IV, and vary the melodic pattern', () => {
  let song=chooseSong(null,()=>0);
  for(let i=0;i<100;i++){
    const next=chooseSong(song,()=>i/100);
    assert.equal(next.root,song.root);assert.notEqual(next.pattern,song.pattern);
    assert.equal(next.progressionIndex,(song.progressionIndex+1)%4);
    assert.deepEqual(next.chordTones.map(n=>n%12),[[0,4,7],[7,11,2],[9,0,4],[5,9,0]][next.progressionIndex]);
    for(const note of next.melody.filter(n=>n.midi!==null)) {
      assert.ok([0,2,4,5,7,9,11].includes(note.midi%12),'every note remains in C major');
      if(note.duration>=4*.65)assert.ok(next.chordTones.some(tone=>tone%12===note.midi%12),'phrase endings resolve to current chord');
    }
    assert.ok(next.melody.reduce((sum,n)=>sum+n.duration,0)>30);
    const sung=next.melody.filter(n=>n.midi!==null);
    assert.ok(sung.some(n=>n.duration===.65));
    assert.ok([-12,0,12].includes(next.octave));
    assert.ok(sung.filter(n=>n.duration>=2.5).length>=4);
    song=next;
  }
});

test('songs span three octave choices and use restrained, distinct mixed voices', async()=>{
 const {voiceHarmonics,chooseSong}=await import('../singing.js');
 const octaves=new Set(),voices=new Set();
 for(let i=0;i<99;i++){
  const song=chooseSong(null,()=>i/99);octaves.add(song.octave);voices.add(JSON.stringify(song.voice));
  assert.ok(song.voice.sine>.85&&song.voice.triangle>0&&song.voice.square>0);
  const {imag}=voiceHarmonics(song.voice);
  assert.ok(imag[1]>.9&&Math.abs(imag[3])>0);
  assert.ok(imag.reduce((sum,n)=>sum+Math.abs(n),0)<1.00001);
  assert.equal(imag[2],0);
 }
 assert.deepEqual([...octaves].sort((a,b)=>a-b),[-12,0,12]);assert.ok(voices.size>50);
});

test('new fifth melody plays sequential eighth-note triad arpeggios on every progression chord', async()=>{
 const {QUARTER,SONG_PATTERNS}=await import('../singing.js');
 assert.equal(SONG_PATTERNS.length,5);
 let song=null;
 for(let i=0;i<8;i++){
  // Select the new variation on alternate turns; adjacent singers still differ.
  song=chooseSong(song,()=>i%2===0?.999:0);
  if(song.pattern!==4)continue;
  const arpeggio=song.melody.slice(0,6);
  assert.ok(arpeggio.every(n=>n.duration===QUARTER/2),'two notes per beat at the existing tempo');
  assert.deepEqual(arpeggio.map(n=>(n.midi-song.octave)%12),[song.chordTones[0],song.chordTones[1],song.chordTones[2],song.chordTones[0],song.chordTones[2],song.chordTones[1]].map(n=>n%12));
 }
 for(let index=0;index<4;index++){
  const previous={...chooseSong(null,()=>0),progressionIndex:(index+3)%4,pattern:0};
  const variation=chooseSong(previous,()=>.999);
  assert.equal(variation.pattern,4);
  assert.ok(variation.melody.filter(n=>n.duration===QUARTER/2).every(n=>variation.chordTones.some(t=>t%12===n.midi%12)));
 }
});
