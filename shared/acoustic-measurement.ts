import {ROOM_FREQUENCIES} from './room-eq.js';

export type AcousticPoint=[frequency:number,relativeDb:number];
export const ACOUSTIC_BANDS=ROOM_FREQUENCIES.filter(hz=>hz>=40&&hz<=12500);
export const ACOUSTIC_QUIET='Le signal de test doit dépasser le bruit de fond d’au moins 10 dB sur une plage suffisante. Vérifie le micro et le bruit rose.';
export const ACOUSTIC_CLIP='Le micro sature. Baisse son gain ou le niveau du signal de test et recommence.';

export function acousticBins(sampleRate:number,fftSize:number){
 const step=sampleRate/fftSize;
 return ACOUSTIC_BANDS.map(hz=>({
  start:Math.ceil(hz/2**(1/6)/step),
  end:Math.min(fftSize/2-1,Math.ceil(hz*2**(1/6)/step)-1),
 }));
}

export function accumulateAcousticSpectrum(spectrum:Float32Array,bins:ReturnType<typeof acousticBins>,sum:number[]){
 bins.forEach(({start,end},band)=>{
  for(let bin=start;bin<=end;bin++)sum[band]=sum[band]!+10**(spectrum[bin]!/10);
 });
}

export function acousticResponse(ambient:number[],signal:number[],calibration:AcousticPoint[]=[]):AcousticPoint[]{
 const calibrated=[...calibration].sort(([a],[b])=>a-b);
 const raw=ACOUSTIC_BANDS.flatMap((hz,i):AcousticPoint[]=>{
  const floor=ambient[i]!,observed=signal[i]!;
  if(!Number.isFinite(floor)||!Number.isFinite(observed)||floor<0||observed<=0||observed<10*floor)return [];
  let offset=0;
  if(calibrated.length){
   const hi=calibrated.findIndex(([f])=>f>=hz);
   if(hi<0||hi===0&&calibrated[0]![0]>hz)return [];
   const [f2,y2]=calibrated[hi]!;
   const [f1,y1]=calibrated[Math.max(0,hi-1)]!;
   offset=f1===f2?y2:y1+(y2-y1)*Math.log(hz/f1)/Math.log(f2/f1);
  }
  return [[hz,10*Math.log10(observed-floor)-offset]];
 });
 const mids=raw.filter(([hz])=>hz>=250&&hz<=2000).map(([,db])=>db).sort((a,b)=>a-b);
 if(raw.length<12||mids.length<5)throw Error(ACOUSTIC_QUIET);
 const reference=(mids[Math.floor((mids.length-1)/2)]!+mids[Math.floor(mids.length/2)]!)/2;
 return raw.map(([hz,db])=>[hz,Math.round((db-reference)*10)/10||0]);
}
