export const CHORUS_OFFSETS=[0,12,-12];
// Pick nearby sounded-note boundaries: the existing phrases have a long note
// at 3.9 seconds and the next phrase starts at 8.45. No partial notes or new tune.
export function chorusEntrances(melody){
  const starts=[];let at=0;
  for(const note of melody){if(note.midi!==null)starts.push(at);at+=note.duration;}
  const result=[0];
  for(const wanted of [4,8]){
    const eligible=starts.filter(t=>t>=result[result.length-1]+2.6-1e-6);
    result.push(eligible.reduce((best,t)=>Math.abs(t-wanted)<Math.abs(best-wanted)?t:best,eligible[0]??at));
  }
  return result;
}
export function synchronizedParts(note,elapsed,entrances){
  if(note.midi===null)return [];
  return CHORUS_OFFSETS.flatMap((offset,lane)=>elapsed+1e-6>=entrances[lane]?[{lane,midi:note.midi+offset,duration:note.duration}]:[]);
}
export function melodyPosition(melody,elapsed){
  const length=melody.reduce((sum,n)=>sum+n.duration,0);
  const cycle=Math.floor(Math.max(0,elapsed)/length);let at=cycle*length;
  for(let cursor=0;cursor<melody.length;cursor++){
    if(at+melody[cursor].duration>elapsed+1e-6)return {cursor,at};
    at+=melody[cursor].duration;
  }
  return {cursor:0,at:(cycle+1)*length};
}

// Faces are DOM-independent records here so selection can be tested over seeds
// and viewport sizes without touching the camera or generating new faces.
export function selectChorusCompanions(candidates,original,view,random=Math.random){
  const selected=[original],result=[];
  const reach=c=>Math.hypot((c.x-original.x)/view.width,(c.y-original.y)/view.height);
  for(let i=0;i<2;i++){
    // Keep the chorus in the same neighborhood, just beyond a shared viewport,
    // rather than choosing arbitrary far corners of the world.
    const pool=candidates.filter(c=>reach(c)<=2.1&&!selected.includes(c)&&selected.every(other=>
      Math.abs(c.x-other.x)>=view.width*1.05||Math.abs(c.y-other.y)>=view.height*1.05))
      .sort((a,b)=>reach(a)-reach(b)).slice(0,8);
    if(!pool.length)return [];
    const next=pool[Math.min(pool.length-1,Math.floor(random()*pool.length))];selected.push(next);result.push(next);
  }
  return result;
}
