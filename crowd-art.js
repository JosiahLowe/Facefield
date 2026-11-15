import {randomFrom} from './faces.js';
import {mixColor} from './palette.js';

export const CROWD_PALETTE={skin:['#F4E5D2','#EBC6AC','#EED6BD','#D9AC85'],hair:['#986238','#432A20','#BC912D','#AD8053','#CCAD7C','#B7B0A9'],ink:'#432A20',eye:'#FFF9EF',iris:'#B9DDE1',cheek:'#DDAEAA',back:'#B7B0A9'};
export function crowdTraits(seed,index,revision=0){
 const r=randomFrom(`${seed}:${index}:${revision}:crowd`);
 return {skin:CROWD_PALETTE.skin[Math.floor(r()*4)],hair:CROWD_PALETTE.hair[Math.floor(r()*6)],style:Math.floor(r()*6),
  rx:30+r()*5,ry:39+r()*4,tilt:(r()-.5)*12,shiftX:(r()-.5)*3,shiftY:(r()-.5)*3,scale:.98+r()*.09,
  eyes: r()<.30?'blue':'brown',eyeScale:.24+r()*.045,eyeGap:8+r()*2,eyeY:36+r()*2,mouthWidth:14+r()*5};
}
// A presentation layout only: model IDs, seeded mosaic cells and character
// streams stay intact. Every existing character gets exactly one crowd slot.
export function crowdLayout(model){
 const order=model.map((c,i)=>({i,x:c.column-1+c.width/2,y:c.row-1+c.height/2})).sort((a,b)=>a.y-b.y||a.x-b.x||a.i-b.i);
 const columns=32,rows=Math.ceil(model.length/columns),width=48/columns,height=48/rows,result=[];
 for(let rank=0;rank<order.length;rank++){
  const row=Math.floor(rank/columns),column=rank%columns;
  result[order[rank].i]={column:1+Math.max(0,Math.min(48-width,column*width+(row%2?.4:-.4))),row:1+row*height,width,height};
 }
 return result;
}
const HAIR=[
 'M14 47C6 33 12 9 30 6C42-2 68 1 79 13C90 22 89 41 83 48L76 32C69 19 49 14 32 22L21 48Z',
 'M12 45C8 27 23 6 43 6C53-1 64 6 66 9C83 8 94 22 86 42L75 34C68 19 48 18 38 24L23 44Z',
 'M14 41L10 27L16 26L14 15L23 18L26 6L34 11L41 1L46 9L56 1L61 10L72 5L73 15L86 14L81 26L90 30L83 45L74 34C66 21 35 20 25 36Z',
 'M15 49C3 51 5 29 13 26C7 15 17 6 27 10C31-1 44-2 50 5C59-5 71 0 73 8C87 5 94 17 86 27C98 36 90 52 81 49L74 30C60 18 38 18 26 31Z',
 'M12 55C4 29 17 7 38 4C65-5 88 10 89 38L83 56L78 30C69 19 60 14 48 18C34 23 27 23 22 43L22 57Z',
 'M12 45C7 33 13 13 29 10C37-2 58-1 64 7C79 4 93 22 86 39L78 48L74 29C61 18 42 18 29 31L23 48Z',
];
// Shared paint servers avoid thousands of identical gradient/stop nodes.
export function crowdPaintDefinitions(){
 const skins=CROWD_PALETTE.skin.map((skin,i)=>`<radialGradient id="crowd-skin-${i}" cx="38%" cy="25%" r="82%"><stop stop-color="${mixColor(skin,'#FFF9EE',.12)}"/><stop offset=".68" stop-color="${skin}"/><stop offset="1" stop-color="${mixColor(skin,'#B78460',.14)}"/></radialGradient>`).join('');
 return `<defs><linearGradient id="crowd-body" x1="0" y1="0" x2="1" y2=".35"><stop stop-color="#8E8479"/><stop offset=".52" stop-color="#D1D0CB"/><stop offset="1" stop-color="#ACA59C"/></linearGradient>${skins}</defs>`;
}
export function crowdDecorations(traits,id){
 const p=CROWD_PALETTE;
 return `<defs data-crowd-decoration><clipPath id="${id}-mouth-clip"><use href="#${id}-mouth"/></clipPath></defs>
 <g data-crowd-decoration data-crowd-body><path d="M-16 112C-11 84 17 70 49 72C79 71 108 87 119 112Z" fill="url(#crowd-body)"/><ellipse cx="52" cy="66" rx="35" ry="40" fill="#432A20" opacity=".09"/></g>
 <g data-crowd-decoration data-crowd-head><path d="${HAIR[traits.style]}" fill="${traits.hair}"/><ellipse data-crowd-head-shape cx="50" cy="52" rx="${traits.rx}" ry="${traits.ry}" fill="url(#crowd-skin-${p.skin.indexOf(traits.skin)})"/><path d="M16 36C17 12 35 6 51 9C68 4 86 20 83 40L76 28C69 17 52 15 41 23C31 23 26 25 22 39Z" fill="${traits.hair}"/><ellipse data-crowd-base-cheek cx="31" cy="55" rx="7" ry="4.8" fill="${p.cheek}" opacity=".46"/><ellipse data-crowd-base-cheek cx="69" cy="55" rx="7" ry="4.8" fill="${p.cheek}" opacity=".46"/></g>`;
}
