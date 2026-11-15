import {randomFrom} from './faces.js';
import {mixColor} from './palette.js';

export const CROWD_PALETTE={skin:['#FFDCBB','#FFE0C4','#FAD4B1','#FFDBB8'],hair:['#95551F','#321C0F','#B1870B','#B87931','#D4A858','#D8946F'],ink:'#111111',eye:'#FFFFFF',iris:'#B9DDE1',cheek:'#DDAEAA',back:'#FFFFFF'};
export function crowdTraits(seed,index,revision=0){
 const r=randomFrom(`${seed}:${index}:${revision}:crowd`);
 return {skin:CROWD_PALETTE.skin[Math.floor(r()*4)],hair:CROWD_PALETTE.hair[Math.floor(r()*6)],style:Math.floor(r()*6),
  rx:27+r()*4,ry:39+r()*4,tilt:(r()-.5)*22,shiftX:(r()-.5)*3,shiftY:(r()-.5)*3,scale:.98+r()*.09,
  eyes: r()<.08?'blue':'brown',eyeScale:.30+r()*.045,eyeGap:10+r()*1.5,eyeY:37+r()*2,mouthWidth:18+r()*3,facing:(r()-.5)*13};
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
// Complete filled silhouettes sit behind the face; no forehead cap or hollow
// contours are needed. The peach head itself masks the middle of each shape.
const HAIR=[
 'M7 52C-2 29 5 5 29 1C49-8 79 2 89 21C99 40 84 65 58 66C30 72 12 65 7 52Z',
 'M4 58C0 29 9 6 31 0C53-9 78-1 89 20C95 32 96 47 93 60L74 54L24 54Z',
 'M8 56C-3 28 14 0 39 2C57-5 70 8 77 14C85 22 90 17 91 9C100 35 86 62 63 67C41 74 13 73 8 56Z',
 'M12 52C-8 61-13 39 0 28C-4 17 9 8 22 11C19-4 39-10 51 0C62-10 80-2 79 11C96 4 105 19 96 31C113 45 94 64 79 53C63 65 28 68 12 52Z',
 'M7 58L0 50L5 43L-2 35L5 29L2 21L12 19L12 9L23 11L29 0L38 6L46-3L54 4L66-2L70 8L82 6L82 18L94 21L89 32L98 40L88 49L88 60L72 67L30 69Z',
 'M7 55C-3 52-5 41 1 35C-7 26 0 15 10 17C7 6 18-2 28 4C34-7 46-7 51 1C64-7 76 0 74 8C88 4 99 17 90 27C104 35 97 49 88 49C92 65 74 73 66 64C49 76 18 74 7 55Z',
];
// Shared paint servers avoid thousands of identical gradient/stop nodes.
export function crowdPaintDefinitions(){
 const skins=CROWD_PALETTE.skin.map((skin,i)=>`<radialGradient id="crowd-skin-${i}" cx="38%" cy="25%" r="82%"><stop stop-color="${mixColor(skin,'#FFF9EE',.025)}"/><stop offset=".68" stop-color="${skin}"/><stop offset="1" stop-color="${mixColor(skin,'#E8B38C',.035)}"/></radialGradient>`).join('');
 return `<defs><linearGradient id="crowd-body" x1="0" y1="0" x2="1" y2=".35"><stop stop-color="#8E8479"/><stop offset=".52" stop-color="#D1D0CB"/><stop offset="1" stop-color="#ACA59C"/></linearGradient>${skins}</defs>`;
}
export function crowdDecorations(traits,id){
 const p=CROWD_PALETTE;
 return `<defs data-crowd-decoration><clipPath id="${id}-mouth-clip"><use href="#${id}-mouth"/></clipPath></defs>
 <g data-crowd-decoration data-crowd-body><ellipse data-crowd-torso cx="50" cy="132" rx="43" ry="75" fill="#FFFFFF" stroke="#25211E" stroke-width=".7"/></g>
 <g data-crowd-decoration data-crowd-head><path data-crowd-hair d="${HAIR[traits.style]}" fill="${traits.hair}"/><ellipse data-crowd-head-shape cx="50" cy="52" rx="${traits.rx}" ry="${traits.ry}" fill="url(#crowd-skin-${p.skin.indexOf(traits.skin)})"/></g>`;
}
