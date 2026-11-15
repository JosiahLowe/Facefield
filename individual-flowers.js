import {randomFrom} from './faces.js';

// Saturated cool blooms and emerald foliage stay apart from the muted earth
// pigments of Original faces. Avoid cream/white, ochre, peach and orange.
export const INDIVIDUAL_FLOWER_COLORS=['#D938AB','#9652D4','#3F76DF','#D92D57','#B64BC5','#229CD1'];
export const INDIVIDUAL_FLOWER_CENTERS=['#51237A','#F187D4','#223E86','#6D2CA0'];
export const INDIVIDUAL_FLOWER_DRIED='#315365';
export const INDIVIDUAL_FLOWER_GREENS=['#196A3C','#238A4A','#28733F','#21865B','#1D754D','#398B49'];
export function individualFlowerStyle(f){
  const r=randomFrom(`${f.id}:${f.phase}:individual-flower`);
  const form=['daisy','ray','bell','cone'][Math.floor(r()*4)];
  return {form,dried:INDIVIDUAL_FLOWER_DRIED,color:INDIVIDUAL_FLOWER_COLORS[Math.floor(r()*INDIVIDUAL_FLOWER_COLORS.length)],
    center:INDIVIDUAL_FLOWER_CENTERS[Math.floor(r()*INDIVIDUAL_FLOWER_CENTERS.length)],
    green:INDIVIDUAL_FLOWER_GREENS[Math.floor(r()*INDIVIDUAL_FLOWER_GREENS.length)],
    count:form==='daisy'?5+Math.floor(r()*2):7+Math.floor(r()*3),round:r()<.35};
}
export function stickerShadowMatrix(angle,shear=.12){
  const r=angle*Math.PI/180,c=Math.cos(r),s=Math.sin(r);
  // Project down/right in world space, conjugated into the swaying plant's
  // local coordinates. No translation: the planted stem base remains fixed.
  return {a:1-shear*s*(c+s),b:shear*s*(s-c),c:-shear*c*(c+s),d:1+shear*c*(s-c),e:0,f:0};
}
// The bell's cubic crown has its top at (0, -.2275). Follow its complete
// rotation/bloom transform so the hooked stalk stays attached to that point.
export function bellStemGeometry(pose,turn=0,expansion=1,side=1,leaves=[]){
  const a=(pose.headTilt+turn)*Math.PI/180;
  const end={x:pose.headX+Math.sin(a)*.2275*expansion,y:pose.headOffset-Math.cos(a)*.2275*expansion};
  const c1={x:side*.16,y:-.2},c2={x:pose.headX+side*.4,y:end.y-.08},arch={x:end.x+side*.18,y:end.y-.08};
  const path=`M0 0 C${c1.x} ${c1.y} ${c2.x} ${c2.y} ${arch.x} ${arch.y} C${end.x+side*.06} ${end.y-.13} ${end.x} ${end.y-.09} ${end.x} ${end.y}`;
  const anchors=leaves.map(l=>{
    const t=Math.min(.8,Math.max(.1,-l.y/.7*.75)),u=1-t;
    const x=3*u*u*t*c1.x+3*u*t*t*c2.x+t*t*t*arch.x,y=3*u*u*t*c1.y+3*u*t*t*c2.y+t*t*t*arch.y;
    const dx=3*u*u*c1.x+6*u*t*(c2.x-c1.x)+3*t*t*(arch.x-c2.x),dy=3*u*u*c1.y+6*u*t*(c2.y-c1.y)+3*t*t*(arch.y-c2.y);
    return {x:x+l.x,y,angle:l.angle+Math.atan2(dx,-dy)*180/Math.PI};
  });
  return {path,end,anchors};
}
function petals(style){
  if(style.form==='bell')return '<path d="M-.13 -.07 C-.14 -.28 .14 -.28 .13 -.07 Q.13 .03 .22 .10 Q.13 .15 .08 .10 Q0 .21 -.08 .10 Q-.13 .15 -.22 .10 Q-.13 .03 -.13 -.07Z"/>';
  if(style.form==='cone')return [-60,-30,0,30,60].map(angle=>`<ellipse cx="0" cy=".08" rx=".068" ry=".15" transform="rotate(${angle} 0 -.05)"/>`).join('');
  return Array.from({length:style.count},(_,i)=>{
    const petal=style.form==='daisy'&&style.round?'<circle cx="0" cy="-.145" r=".10"/>'
      :`<ellipse cx="0" cy="-.14" rx="${style.form==='ray'?'.055':'.085'}" ry=".14"/>`;
    return `<g transform="rotate(${i*360/style.count})">${petal}</g>`;
  }).join('');
}
export function individualFlowerGeometry(f,id){
  const style=individualFlowerStyle(f);
  const initialBell=style.form==='bell'?bellStemGeometry({headX:0,headOffset:-.7,headTilt:0},0,1,f.rotation<0?-1:1,f.appearance.leaves):null;
  const leaves=f.appearance.leaves.map((l,i)=>{const anchor=initialBell?.anchors[i]||l;return `<g class="flower-leaf" transform="translate(${anchor.x} ${anchor.y}) rotate(${anchor.angle})"><path d="M${-l.rx} 0 Q0 ${-l.ry*2} ${l.rx} 0 Q0 ${l.ry*2} ${-l.rx} 0Z" stroke="none"/></g>`;}).join('');
  const center=style.form==='cone'?`<path id="${id}-center" d="M-.11 -.02 C-.10 -.20 .10 -.20 .11 -.02 Q0 .04 -.11 -.02Z"/>`
    :`<circle id="${id}-center" r="${style.form==='bell'?0:style.form==='ray'?'.08':'.065'}"/>`;
  // Uncolored source geometry is shared by colored uses and shadow uses.
  // Source path/leaf/spin updates therefore animate both without DOM cloning,
  // per-frame shadow geometry copies, or a filter that Safari must rasterize.
  return `<defs>
    <g id="${id}-stem"><path class="flower-stem-path" d="${initialBell?.path||'M0 0 Q0 -.35 0 -.70'}" fill="none" stroke="inherit" stroke-width=".036" stroke-linecap="round"/><g class="flower-leaves">${leaves}</g></g>
    <g id="${id}-petals"><g class="flower-spin">${petals(style)}</g></g>${center}
  </defs>
  <g class="flower-sticker-shadow" transform="matrix(1 0 -.12 .88 0 0)" opacity=".24" fill="#182038" stroke="#182038">
    <use class="flower-sticker-stem-shadow" href="#${id}-stem"/>
    <g class="flower-sticker-head-shadow" transform="translate(0 -.70)"><g class="flower-sticker-petals-shadow"><use href="#${id}-petals" stroke="none"/></g><use href="#${id}-center" stroke="none"/></g>
  </g>
  <g class="flower-stem" fill="${style.green}" stroke="${style.green}"><use href="#${id}-stem"/></g>
  <g class="flower-head" transform="translate(0 -.70)"><g class="flower-petals" fill="${style.color}"><use href="#${id}-petals"/></g><use class="flower-center" href="#${id}-center" fill="${style.center}"/></g>`;
}
