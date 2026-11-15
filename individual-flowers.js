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
export function stickerShadowOffset(angle,distance=.08){
  const radians=angle*Math.PI/180;
  // Cancel stem sway so the cutout shadow always projects down and right.
  return {x:distance*(Math.cos(radians)+Math.sin(radians)),y:distance*(Math.cos(radians)-Math.sin(radians))};
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
  const leaves=f.appearance.leaves.map(l=>`<g class="flower-leaf" transform="translate(${l.x} ${l.y}) rotate(${l.angle})"><path d="M${-l.rx} 0 Q0 ${-l.ry*2} ${l.rx} 0 Q0 ${l.ry*2} ${-l.rx} 0Z" stroke="none"/></g>`).join('');
  const center=style.form==='cone'?`<path id="${id}-center" d="M-.11 -.02 C-.10 -.20 .10 -.20 .11 -.02 Q0 .04 -.11 -.02Z"/>`
    :`<circle id="${id}-center" r="${style.form==='bell'?0:style.form==='ray'?'.08':'.065'}"/>`;
  // Uncolored source geometry is shared by colored uses and shadow uses.
  // Source path/leaf/spin updates therefore animate both without DOM cloning,
  // per-frame shadow geometry copies, or a filter that Safari must rasterize.
  return `<defs>
    <g id="${id}-stem"><path class="flower-stem-path" d="M0 0 Q0 -.35 0 -.70" fill="none" stroke="inherit" stroke-width=".036" stroke-linecap="round"/><g class="flower-leaves">${leaves}</g></g>
    <g id="${id}-petals"><g class="flower-spin">${petals(style)}</g></g>${center}
  </defs>
  <g class="flower-sticker-shadow" transform="translate(.08 .08)" opacity=".24" fill="#182038" stroke="#182038">
    <use class="flower-sticker-stem-shadow" href="#${id}-stem"/>
    <g class="flower-sticker-head-shadow" transform="translate(0 -.70)"><g class="flower-sticker-petals-shadow"><use href="#${id}-petals" stroke="none"/></g><use href="#${id}-center" stroke="none"/></g>
  </g>
  <g class="flower-stem" fill="${style.green}" stroke="${style.green}"><use href="#${id}-stem"/></g>
  <g class="flower-head" transform="translate(0 -.70)"><g class="flower-petals" fill="${style.color}"><use href="#${id}-petals"/></g><use class="flower-center" href="#${id}-center" fill="${style.center}"/></g>`;
}
