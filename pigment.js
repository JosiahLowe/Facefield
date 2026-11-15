export const PIGMENT_TIMING={hold:20000,fade:30000,arrival:450};
export function pigmentLevel(trace,now){
 if(!trace)return 0;
 const t=Math.max(0,Math.min(1,(now-trace.at-PIGMENT_TIMING.hold)/PIGMENT_TIMING.fade));
 return trace.value*(1-t*t*(3-2*t));
}
export function depositPigment(trace,proximity,now,elapsed){
 const value=pigmentLevel(trace,now),target=Math.max(value,Math.min(1,Math.max(0,proximity)));
 if(proximity<=0)return trace;
 return {value:value+(target-value)*(1-Math.exp(-Math.max(0,elapsed)/PIGMENT_TIMING.arrival)),at:now};
}
