import {crowdTraits,crowdLayout,crowdDecorations,crowdPaintDefinitions,CROWD_PALETTE} from './crowd-art.js?v=crowd-black-body-6';
const NS='http://www.w3.org/2000/svg';
export function createVisualModes({world,grid,animation,flowers,butterfly,seed,layout,sizeWorld,selector}){
 const originalLayout=layout,crowd=crowdLayout(layout),records=new Map();let mode='original';
 let paintServers=null;
 const nearViewport=new Set();
 const visibility=new IntersectionObserver(entries=>{for(const entry of entries){
  if(entry.isIntersecting)nearViewport.add(entry.target);else nearViewport.delete(entry.target);
  entry.target.querySelector('svg').style.display=mode==='crowd'&&!entry.isIntersecting?'none':'';
 }},{root:world,rootMargin:'150px'});
 for(const tile of grid.children)visibility.observe(tile);

 const saved=(()=>{try{return sessionStorage.getItem('facefield-visual-mode');}catch{return null;}})();
 function center(cell){return {x:cell.column-1+cell.width/2,y:cell.row-1+cell.height/2};}
 function setAreas(cells){for(let i=0;i<cells.length;i++){
  const t=grid.children[i],c=cells[i];
  if(mode==='crowd'){
   t.style.zIndex=String(Math.floor(c.row*10));
   t.style.gridArea='auto';t.style.left=`${(c.column-1)/48*100}%`;t.style.top=`${(c.row-1)/48*100}%`;
   t.style.width=`${c.width/48*100}%`;t.style.height=`${c.height/48*100}%`;
  }else{t.style.removeProperty('z-index');t.style.removeProperty('left');t.style.removeProperty('top');t.style.removeProperty('width');t.style.removeProperty('height');t.style.gridArea=`${c.row} / ${c.column} / span ${c.height} / span ${c.width}`;}
 }}
 function record(tile,i){
  if(records.has(tile))return records.get(tile);
  if(!paintServers){paintServers=document.createElementNS(NS,'svg');paintServers.setAttribute('width','0');paintServers.setAttribute('height','0');paintServers.setAttribute('aria-hidden','true');paintServers.style.position='absolute';paintServers.innerHTML=crowdPaintDefinitions();world.append(paintServers);}

  const svg=tile.querySelector('svg'),features=svg.querySelector('[data-features]'),mouth=svg.querySelector('[data-feature=mouth]');
  const eyes=[...svg.querySelectorAll('circle:not([data-feature=cheek])')];
  const all=[svg,features,mouth,svg.querySelector('[data-feature=skin]'),svg.querySelector('[data-feature=nose]'),svg.querySelector('[data-feature=cheeks]'),...eyes,...svg.querySelectorAll('[data-feature=eyelid]')];
  const attrs=new Map(all.map(el=>[el,new Map(['transform','fill','stroke','stroke-width','viewBox','preserveAspectRatio','id','visibility','vector-effect','stroke-linecap','r'].map(a=>[a,el.getAttribute(a)]))]));
  const nose=svg.querySelector('[data-feature=nose]');attrs.get(nose).set('d',nose.getAttribute('d'));
  const traits=crowdTraits(seed,i),id=`crowd-${i}`,holder=document.createElementNS(NS,'g');holder.innerHTML=crowdDecorations(traits,id);
  const decorations=[...holder.children];for(const el of decorations)svg.insertBefore(el,features);
  for(const el of decorations)el.setAttribute('display','none');
  const tongue=document.createElementNS(NS,'ellipse');tongue.dataset.crowdDecoration='';tongue.dataset.crowdTongue='';tongue.setAttribute('cx','50');tongue.setAttribute('cy','75');tongue.setAttribute('rx','4.8');tongue.setAttribute('ry','3.2');tongue.setAttribute('fill','#DDAEAA');tongue.setAttribute('clip-path',`url(#${id}-mouth-clip)`);tongue.setAttribute('display','none');features.append(tongue);decorations.push(tongue);
  const oval=document.createElementNS(NS,'ellipse');oval.dataset.crowdSingingMouth='';oval.id=`${id}-oval`;const clip=document.createElementNS(NS,'clipPath');clip.id=`${oval.id}-clip`;const use=document.createElementNS(NS,'use');use.setAttribute('href',`#${oval.id}`);clip.append(use);decorations[0].append(clip);oval.setAttribute('fill',CROWD_PALETTE.ink);oval.setAttribute('display','none');features.insertBefore(oval,tongue);decorations.push(oval);
  const value={svg,features,mouth,eyes,attrs,traits,id,decorations,tongue,oval};records.set(tile,value);return value;
 }
 function art(tile,i){
  const r=record(tile,i),{svg,features,mouth,traits,id}=r;
  svg.style.display=mode==='crowd'&&!nearViewport.has(tile)?'none':'';
  if(mode==='original'){
   const filled=mouth.getAttribute('fill')!=='none';
   for(const [el,attrs] of r.attrs)for(const [a,value] of attrs)if(value===null)el.removeAttribute(a);else el.setAttribute(a,value);
   mouth.setAttribute('fill',filled?mouth.getAttribute('stroke'):'none');
   for(const d of r.decorations)d.setAttribute('display','none');return null;
  }
  svg.setAttribute('viewBox','0 0 100 100');svg.setAttribute('preserveAspectRatio','xMidYMid meet');
  features.setAttribute('transform',`translate(${traits.shiftX} ${traits.shiftY}) rotate(${traits.tilt} 50 52) scale(${traits.scale})`);
  for(const d of r.decorations)d.removeAttribute('display');
  for(const d of svg.querySelectorAll('[data-crowd-head],[data-crowd-body]'))d.setAttribute('transform',features.getAttribute('transform'));
  svg.querySelector('[data-feature=skin]').setAttribute('visibility','hidden');
  const projected=[];
  for(let j=0;j<2;j++){
   const white=r.eyes[j*2],pupil=r.eyes[j*2+1],x=+white.getAttribute('cx'),y=+white.getAttribute('cy');
   const nx=50+traits.facing+(j?1:-1)*traits.eyeGap,ny=traits.eyeY;
   const eyeScale=4.8/+white.getAttribute('r');
   const transform=`translate(${nx} ${ny}) scale(${eyeScale}) translate(${-x} ${-y})`;
   pupil.setAttribute('r',String(1.55/eyeScale));
   for(const el of [white,pupil])el.setAttribute('transform',transform);
   white.setAttribute('fill',CROWD_PALETTE.eye);pupil.setAttribute('fill',CROWD_PALETTE.ink);
   if(traits.eyes==='blue'){pupil.setAttribute('stroke',CROWD_PALETTE.iris);pupil.setAttribute('stroke-width','4');}
   projected.push({x:nx,y:ny,scale:eyeScale,transform});
  }
  [...svg.querySelectorAll('[data-feature=eyelid]')].forEach((el,j)=>{el.setAttribute('transform',projected[j].transform);el.setAttribute('fill',traits.skin);});
  const nose=svg.querySelector('[data-feature=nose]');
  nose.setAttribute('d','M46 42 L46 50 C46 56 54 56 54 50 L54 42');
  nose.setAttribute('transform',`translate(${traits.facing} 0)`);
  for(const line of [nose,mouth]){line.setAttribute('stroke',CROWD_PALETTE.ink);line.setAttribute('stroke-width','.8');line.setAttribute('vector-effect','non-scaling-stroke');line.setAttribute('stroke-linecap','round');}

  const cheeks=svg.querySelector('[data-feature=cheeks]');cheeks.setAttribute('transform',`translate(${50+traits.facing} 54) scale(.48 .48) translate(-50 -55)`);cheeks.setAttribute('fill',CROWD_PALETTE.cheek);
  mouth.setAttribute('id',`${id}-mouth`);mouth.setAttribute('stroke',CROWD_PALETTE.ink);
  return {mode,eyes:projected,skin:traits.skin,mouthWidth:traits.mouthWidth,facing:traits.facing,tongue:r.tongue,oval:r.oval};
 }
 function apply(next){
  if(!['original','crowd'].includes(next)||next===mode&&records.size)return;
  const old=mode==='crowd'?crowd:originalLayout,oldUnit=grid.clientWidth/48;
  let anchor=0,best=Infinity;const oldPoint={x:(world.scrollLeft+world.clientWidth/2)/oldUnit,y:(world.scrollTop+world.clientHeight/2)/oldUnit};
  for(let i=0;i<old.length;i++){const c=center(old[i]),d=Math.hypot(c.x-oldPoint.x,c.y-oldPoint.y);if(d<best){best=d;anchor=i;}}
  const moth=butterfly.position();
  if(moth){const screen={x:moth.x-world.scrollLeft,y:moth.y-world.scrollTop};if(screen.x>=0&&screen.y>=0&&screen.x<=world.clientWidth&&screen.y<=world.clientHeight){const b=world.querySelector('.butterfly');if(b?.dataset.singerIndex)anchor=+b.dataset.singerIndex;}}
  mode=next;document.documentElement.dataset.visualMode=mode;grid.dataset.visualMode=mode;selector.value=mode;
  const cells=mode==='crowd'?crowd:originalLayout;setAreas(cells);sizeWorld(mode);
  const poses=new Map();for(let i=0;i<grid.children.length;i++)poses.set(grid.children[i],art(grid.children[i],i));
  flowers.setPresentation(mode==='crowd'?crowd:null);butterfly.reproject(old,cells);animation.setVisualMode(poses);
  const oldAnchor=center(old[anchor]),newAnchor=center(cells[anchor]),unit=grid.clientWidth/48;
  world.scrollTo((newAnchor.x+oldPoint.x-oldAnchor.x)*unit-world.clientWidth/2,(newAnchor.y+oldPoint.y-oldAnchor.y)*unit-world.clientHeight/2);
  try{sessionStorage.setItem('facefield-visual-mode',mode);}catch{}
  world.dispatchEvent(new Event('scroll'));world.dispatchEvent(new CustomEvent('visualmodechange',{detail:{mode}}));
 }
 selector.addEventListener('change',()=>apply(selector.value));
 // The Original startup path leaves every original SVG and layout untouched.
 if(saved==='crowd'||saved!=='original'&&new URL(location.href).searchParams.get('style')==='crowd')apply('crowd');
 return {get mode(){return mode;},get layout(){return mode==='crowd'?crowd:originalLayout;},set:apply,
  hitFace(event){
   const fallback=event.target.closest('.face');if(mode!=='crowd'||event.detail===0)return fallback;
   let best=null,z=-Infinity;
   for(const tile of grid.children){
    const head=tile.querySelector('[data-crowd-head-shape]');if(!head)continue;
    const box=head.getBoundingClientRect();if(event.clientX<box.left||event.clientX>box.right||event.clientY<box.top||event.clientY>box.bottom)continue;
    const matrix=head.getScreenCTM();if(!matrix)continue;
    const p=new DOMPoint(event.clientX,event.clientY).matrixTransform(matrix.inverse());
    if(((p.x-50)/+head.getAttribute('rx'))**2+((p.y-52)/+head.getAttribute('ry'))**2<=1&&+tile.style.zIndex>=z){best=tile;z=+tile.style.zIndex;}
   }
   return best||fallback;
  }};
}
