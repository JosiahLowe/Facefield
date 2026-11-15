// Presentation only: retain the site's identity and song lifecycle, while placing
// tall flowers in the staggered crowd's gaps at the neighboring heads' height.
export function crowdFlowerPlacement(f,offset,layout){
 const w=layout[0].width,h=layout[0].height;
 const row=Math.max(0,Math.min(Math.round((f.y+offset.y-h*.45)/h),Math.round(48/h)-1));
 const stagger=row%2?.4:-.4;
 const column=Math.max(1,Math.min(31,Math.round((f.x+offset.x-stagger)/w)));
 const headX=column*w+stagger,headY=row*h+h*.45;
 const size=1.35+f.rank*.35,p=f.posture,angle=Math.max(-8.4,Math.min(8.4,f.rotation*.25))*Math.PI/180;
 const hx=p.bow,hy=-.7+Math.abs(p.bow)*.3,scale=size*p.scale;
 return {slot:`${row}:${column}`,depth:Math.floor((1+row*h)*10)-1,
  flower:{...f,size,x:headX-(Math.cos(angle)*hx-Math.sin(angle)*hy)*scale,
   y:headY-(Math.sin(angle)*hx+Math.cos(angle)*hy)*scale}};
}
export const CROWD_FLOWER_COLORS=['#DC5B95','#A776C0','#6C91CE','#C93C52','#8A6BC4','#4B9EBE'];
export function crowdFlowerColor(f){return CROWD_FLOWER_COLORS[Math.floor(f.phase*997)%CROWD_FLOWER_COLORS.length];}
