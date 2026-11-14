// Lightweight voiced source plus moving formants: an approximate "l-ah",
// rather than a speech sample. Buffers and the reverb impulse are shared.
const caches=new WeakMap();
function resources(context){
  if(caches.has(context))return caches.get(context);
  const noise=context.createBuffer(1,Math.ceil(context.sampleRate*.5),context.sampleRate);
  const samples=noise.getChannelData(0);let state=713;
  for(let i=0;i<samples.length;i++){state=(Math.imul(state,1664525)+1013904223)>>>0;samples[i]=state/2147483648-1;}
  const value={noise,waves:new Map()};caches.set(context,value);return value;
}
export function vocalWave(context,variant=0){
  const cache=resources(context);if(cache.waves.has(variant))return cache.waves.get(variant);
  const real=new Float32Array(49),imag=new Float32Array(49);
  for(let n=1;n<imag.length;n++)imag[n]=1/Math.pow(n,1.18+variant*.04);
  const wave=context.createPeriodicWave(real,imag);cache.waves.set(variant,wave);return wave;
}
export function playVocalNote(context,output,midi,start,duration,wave=null,variant=0){
  const oscillator=context.createOscillator(),gain=context.createGain(),end=start+duration;
  oscillator.setPeriodicWave(wave||vocalWave(context,variant));
  oscillator.frequency.setValueAtTime(440*2**((midi-69)/12),start);
  const vibrato=context.createOscillator(),vibratoGain=context.createGain();
  vibrato.frequency.value=5.5+variant*.12;
  vibratoGain.gain.setValueAtTime(0,start);
  vibratoGain.gain.linearRampToValueAtTime(duration>.7?24:10,start+Math.min(.24,duration*.45));
  vibrato.connect(vibratoGain);vibratoGain.connect(oscillator.detune);
  const nodes=[oscillator,gain,vibrato,vibratoGain];
  const direct=context.createGain();direct.gain.value=.42;oscillator.connect(direct);direct.connect(gain);nodes.push(direct);
  const formants=[[700,4,.9],[1150,5,.5],[2600,8,.2]];
  for(const [frequency,q,level] of formants){
    const filter=context.createBiquadFilter(),weight=context.createGain();filter.type='bandpass';filter.Q.value=q;
    const shift=1+variant*.035;
    filter.frequency.setValueAtTime(frequency*shift*.66,start);
    filter.frequency.exponentialRampToValueAtTime(frequency*shift,start+Math.min(.065,duration*.25));
    weight.gain.value=level;oscillator.connect(filter);filter.connect(weight);weight.connect(gain);nodes.push(filter,weight);
  }
  const breath=context.createBufferSource(),air=context.createBiquadFilter(),airGain=context.createGain();
  breath.buffer=resources(context).noise;breath.loop=true;air.type='bandpass';air.frequency.value=1900;air.Q.value=.7;airGain.gain.value=.018;
  breath.connect(air);air.connect(airGain);airGain.connect(gain);nodes.push(breath,air,airGain);
  gain.gain.setValueAtTime(0,start);
  gain.gain.linearRampToValueAtTime(.24,start+Math.min(.045,duration/4));
  gain.gain.linearRampToValueAtTime(.18,end-Math.min(.12,duration/3));
  gain.gain.exponentialRampToValueAtTime(.001,end-Math.min(.015,duration/4));gain.gain.linearRampToValueAtTime(0,end);
  gain.connect(output);oscillator.start(start);oscillator.stop(end);vibrato.start(start);vibrato.stop(end);
  breath.start(start,(start*.137)%breath.buffer.duration);breath.stop(end);
  return {oscillator,gain,vibrato,vibratoGain,breath,start,end,midi,
    dispose(){for(const node of nodes)node.disconnect();},
    stop(at=context.currentTime){try{oscillator.stop(at);vibrato.stop(at);breath.stop(at);}catch{/* already ended */}}};
}
export function createVocalSpace(context){
  const mix=context.createGain(),limiter=context.createDynamicsCompressor(),send=context.createGain(),wet=context.createGain();
  mix.gain.value=1;send.gain.value=.09;wet.gain.value=1;
  limiter.threshold.value=-12;limiter.knee.value=16;limiter.ratio.value=4;limiter.attack.value=.003;limiter.release.value=.15;
  mix.connect(limiter);limiter.connect(context.destination);
  const impulse=context.createBuffer(2,Math.ceil(context.sampleRate*.65),context.sampleRate);let state=917;
  for(let channel=0;channel<2;channel++){
    const data=impulse.getChannelData(channel);let low=0;
    for(let i=0;i<data.length;i++){state=(Math.imul(state,1664525)+1013904223)>>>0;low=low*.6+(state/2147483648-1)*.4;data[i]=low*Math.exp(-i/context.sampleRate*10);}
  }
  let convolver;
  function flush(){
    if(convolver){send.disconnect();convolver.disconnect();}
    convolver=context.createConvolver();convolver.buffer=impulse;send.connect(convolver);convolver.connect(wet);
  }
  wet.connect(mix);flush();
  return {connect(panner){panner.connect(mix);panner.connect(send);},
    singing(on){send.gain.setValueAtTime(on?.09:0,context.currentTime);wet.gain.setValueAtTime(on?1:0,context.currentTime);},
    chorus(on){mix.gain.setTargetAtTime(on?.82:1,context.currentTime,.18);},flush};
}
