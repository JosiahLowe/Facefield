import {randomFrom} from './faces.js';
import {mixColor,contrastRatio} from './palette.js';

export const CROWD_PALETTE={skin:['#F8DFC9','#EBC6A5','#D7AB86','#C69268','#BD9A78','#EED3BA','#DDB593','#CFA27F','#BE8B6B'],hair:['#95551F','#321C0F','#B1870B','#B87931','#D4A858','#D8946F'],ink:'#111111',eye:'#FFFFFF',iris:'#B9DDE1',cheek:'#DDAEAA',back:'#FFFFFF'};
export const CROWD_HAIR_STYLES=['cropped','close-cropped','swept','bob','short-spiky','curly'];
const HAIR_WEIGHTS=[0,0,0,1,1,1,2,3,4,5];
export function crowdTraits(seed,index,revision=0){
 const r=randomFrom(`${seed}:${index}:${revision}:crowd`);
 const skin=CROWD_PALETTE.skin[Math.floor(r()*CROWD_PALETTE.skin.length)];
 const hairChoice=r(),hairColors=CROWD_PALETTE.hair.filter(color=>contrastRatio(skin,color)>=2);
 const hair=hairColors[Math.floor(hairChoice*hairColors.length)],style=HAIR_WEIGHTS[Math.floor(r()*HAIR_WEIGHTS.length)];
 return {skin,hair,style,hairKind:CROWD_HAIR_STYLES[style],
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
// contours are needed. The head itself masks the middle of each shape.
const HAIR=[
 'M12 39C11 18 25 7 49 7C73 5 88 17 88 39L84 48L17 48Z',
 'M15 37C13 23 24 11 39 10L63 10C78 12 86 23 85 38L80 44L20 44Z',
 'M8 56C-3 28 14 0 39 2C57-5 70 8 77 14C85 22 90 17 91 9C100 35 86 62 63 67C41 74 13 73 8 56Z',
 'M4 58C0 29 9 6 31 0C53-9 78-1 89 20C95 32 96 47 93 60L74 54L24 54Z',
 'M13 40L12 28L20 29L23 14L34 17L42 6L50 14L62 8L68 19L80 17L85 30L88 40L74 48L25 48Z',
 'M7 55C-3 52-5 41 1 35C-7 26 0 15 10 17C7 6 18-2 28 4C34-7 46-7 51 1C64-7 76 0 74 8C88 4 99 17 90 27C104 35 97 49 88 49C92 65 74 73 66 64C49 76 18 74 7 55Z',
];
// Shared paint servers avoid thousands of identical gradient/stop nodes.
export function crowdPaintDefinitions(){
 const skins=CROWD_PALETTE.skin.map((skin,i)=>`<radialGradient id="crowd-skin-${i}" cx="38%" cy="25%" r="82%"><stop stop-color="${mixColor(skin,'#FFF9EE',.025)}"/><stop offset=".68" stop-color="${skin}"/><stop offset="1" stop-color="${mixColor(skin,'#E8B38C',.035)}"/></radialGradient>`).join('');
 return `<defs><linearGradient id="crowd-body-outline" x1="0" y1="0" x2="0" y2="1"><stop stop-color="#25211E" stop-opacity="1"/><stop offset=".22" stop-color="#25211E" stop-opacity=".9"/><stop offset=".5" stop-color="#25211E" stop-opacity=".25"/><stop offset=".7" stop-color="#25211E" stop-opacity="0"/><stop offset="1" stop-color="#25211E" stop-opacity="0"/></linearGradient>${skins}</defs>`;
}
export function crowdDecorations(traits,id){
 const p=CROWD_PALETTE;
 return `<defs data-crowd-decoration><clipPath id="${id}-mouth-clip"><use href="#${id}-mouth"/></clipPath></defs>
 <g data-crowd-decoration data-crowd-body><ellipse data-crowd-torso cx="50" cy="132" rx="43" ry="75" fill="#FFFFFF" stroke="url(#crowd-body-outline)" stroke-width=".7"/></g>
 <g data-crowd-decoration data-crowd-head><path data-crowd-hair d="${HAIR[traits.style]}" data-hair-style="${traits.hairKind}" transform="translate(50 34) scale(.8 .88) translate(-50 -42)" fill="${traits.hair}"/><ellipse data-crowd-head-shape cx="50" cy="52" rx="${traits.rx}" ry="${traits.ry}" fill="url(#crowd-skin-${p.skin.indexOf(traits.skin)})"/></g>`;
}
