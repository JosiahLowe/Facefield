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

// Restore chroma without washing out a face's value. Interpolating in linear
// RGB keeps luminance stable from grayscale through the seeded full color.
export function pigmentColor(color,saturation){
 const amount=Math.max(0,Math.min(1,saturation));
 const linear=color.slice(1).match(/../g).map(c=>parseInt(c,16)/255).map(v=>v<=.04045?v/12.92:((v+.055)/1.055)**2.4);
 const gray=linear[0]*.2126+linear[1]*.7152+linear[2]*.0722;
 return '#'+linear.map(v=>{
  const value=gray+(v-gray)*amount;
  const encoded=value<=.0031308?value*12.92:1.055*value**(1/2.4)-.055;
  return Math.round(Math.max(0,Math.min(1,encoded))*255).toString(16).padStart(2,'0');
 }).join('').toUpperCase();
}

export const RESTING_FACE_SATURATION=.30;
export function facePigmentColor(color,pigment){
 const level=Math.max(0,Math.min(1,pigment));
 return pigmentColor(color,RESTING_FACE_SATURATION+(1-RESTING_FACE_SATURATION)*level);
}
