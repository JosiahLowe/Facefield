// Each grouping stays inside the existing animated head clearance envelope.
// The central bloom/floret remains the moth's existing landing destination.
export function flowerGrouping(f){return f.rank<.34?'mound':f.rank<.68?'spikes':'single';}
export const MOUND_BLOOMS=[{x:0,y:0},{x:-.18,y:-.06},{x:.17,y:-.10},{x:-.09,y:-.23},{x:.09,y:-.25},{x:-.19,y:.12},{x:.18,y:.12}];
export const SPIKE_TIPS=[{x:-.21,y:-.04},{x:-.075,y:-.26},{x:.085,y:-.21},{x:.22,y:-.07}];
export function groupStemPaths(kind,pose,expansion=1){
 const targets=kind==='mound'?MOUND_BLOOMS:[...SPIKE_TIPS,{x:0,y:0}],angle=pose.headTilt*Math.PI/180;
 return targets.map(p=>{
  const root=p.x*.35,x=pose.headX+(Math.cos(angle)*p.x-Math.sin(angle)*p.y)*expansion,y=pose.headOffset+(Math.sin(angle)*p.x+Math.cos(angle)*p.y)*expansion;
  return `M${root} 0 Q${root+(x-root)*.25} ${y*.52} ${x} ${y}`;
 });
}
function leaf(x,y,dx,dy){return `M${x} ${y} Q${x+dx*.08-dy*.34} ${y+dy*.08+dx*.34} ${x+dx} ${y+dy} Q${x+dx*.5+dy*.3} ${y+dy*.5-dx*.3} ${x} ${y}Z`;}
export function groupFoliage(kind){
 const count=kind==='mound'?9:7;
 return Array.from({length:count},(_,i)=>{
  const angle=Math.PI+(i/(count-1))*Math.PI,dx=Math.cos(angle)*.32,dy=Math.sin(angle)*.36-.03;
  return leaf(0,0,dx,dy);
 }).join('');
}
function daisy(x,y,color,index){
 const petals=Array.from({length:5},(_,i)=>`<ellipse cx="0" cy="-.043" rx=".027" ry=".044" transform="rotate(${i*72})"/>`).join('');
 return `<g class="flower-group-bloom" data-bloom="${index}" transform="translate(${x} ${y})"><g fill="${color}">${petals}</g>${index?'<circle r=".025" fill="#F0D148"/>':''}</g>`;
}
export function groupGeometry(f,color,green){
 const kind=flowerGrouping(f);
 if(kind==='single')return null;
 const foliage=`<path class="flower-group-foliage" d="${groupFoliage(kind)}" fill="${green}"/>`;
 if(kind==='mound')return {kind,foliage,center:.025,petals:MOUND_BLOOMS.map((p,i)=>daisy(p.x,p.y,color,i)).join('')};
 const spikes=SPIKE_TIPS;
 const florets=spikes.map((p,index)=>{
  let petals='';for(let j=0;j<4;j++)for(const side of [-1,1])petals+=`<ellipse cx="${p.x+side*.024}" cy="${p.y+j*.045}" rx=".025" ry=".033" transform="rotate(${side*32} ${p.x+side*.024} ${p.y+j*.045})" fill="${j%2?'#A16BBA':color}"/>`;
  return `<g class="flower-group-spike" data-spike="${index}">${petals}</g>`;
 }).join('');
 return {kind,center:0,foliage,petals:`${florets}<ellipse class="flower-group-bloom" cx="0" cy="0" rx=".029" ry=".034" fill="${color}"/>`};
}
