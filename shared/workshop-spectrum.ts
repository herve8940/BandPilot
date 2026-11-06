/** Local, measured spectral/mono evidence. No genre-independent "ideal EQ" is assumed. */
export const SPECTRUM_HZ=[31.5,40,50,63,80,100,125,160,200,250,315,400,500,630,800,1000,1250,1600,2000,2500,3150,4000,5000,6300,8000,10000,12500,16000];
export const WORKSHOP_FAMILIES=['guitar','voice','backing','bass','drums','keys','other'] as const;
export type WorkshopFamily=typeof WORKSHOP_FAMILIES[number];
export type SpectralWindow={start:number;duration:number;spectrum?:number[];stereo?:{left:number;right:number;cross:number;frames:number}};
export type SpectralEvidence={bands:number[];lowMidPercent:number;rumblePercent:number;activeSeconds:number;lowMidSeconds:number;lowMidStart:number;rumbleStart:number;phase?:{correlation:number;monoLossDb:number;worstLossDb:number;negativePercent:number;activeSeconds:number;variable:boolean;start:number;stop:number;balanced:boolean}};
const round=(v:number)=>Math.round(v*10)/10||0;
const sum=(a:number[])=>a.reduce((x,y)=>x+y,0);
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v));
export function inferWorkshopFamily(name:string):WorkshopFamily{
 const n=name.toLowerCase();
 if(/ch(oe|œ)ur|backing voc/.test(n))return 'backing';
 if(/bass|basse/.test(n))return 'bass';
 if(/guit|gtr/.test(n))return 'guitar';
 if(/chant|voix|vocal|voc\b/.test(n))return 'voice';
 if(/batterie|drum|kick|snare|cymbal|tom\b/.test(n))return 'drums';
 if(/piano|clav|keys|orgue|synth/.test(n))return 'keys';
 return 'other';
}
const zone=(bands:number[],lo:number,hi:number)=>sum(bands.filter((_,i)=>SPECTRUM_HZ[i]!>=lo&&SPECTRUM_HZ[i]!<=hi));
export function spectralEvidence(windows:SpectralWindow[]):SpectralEvidence|undefined{
 const valid=windows.filter(w=>w.spectrum?.length===SPECTRUM_HZ.length&&w.spectrum.every(v=>Number.isFinite(v)&&v>=0));
 if(!valid.length)return;
 const bands=SPECTRUM_HZ.map((_,i)=>sum(valid.map(w=>w.spectrum![i]!*w.duration))/sum(valid.map(w=>w.duration)));
 const max=Math.max(...bands),active=valid.filter(w=>sum(w.spectrum!)>Math.max(1e-12,sum(bands)*.01));
 const low=(w:SpectralWindow)=>zone(w.spectrum!,160,400)/Math.max(1e-20,zone(w.spectrum!,80,8000));
 const rumble=(w:SpectralWindow)=>zone(w.spectrum!,25,63)/Math.max(1e-20,zone(w.spectrum!,25,8000));
 // Require a broad zone rather than one isolated fundamental or one loud transient.
 const broad=(w:SpectralWindow)=>w.spectrum!.filter((v,i)=>SPECTRUM_HZ[i]!>=160&&SPECTRUM_HZ[i]!<=400&&v>zone(w.spectrum!,160,400)*.12).length>=3;
 const muddy=active.filter(w=>low(w)>.5&&broad(w));
 const strongest=active.reduce<SpectralWindow|undefined>((a,b)=>!a||low(b)>low(a)?b:a,undefined);
 const lowest=active.reduce<SpectralWindow|undefined>((a,b)=>!a||rumble(b)>rumble(a)?b:a,undefined);
 const result:SpectralEvidence={bands:bands.map(v=>max>1e-20?round(Math.max(-60,10*Math.log10(Math.max(v,1e-30)/max))):-60),lowMidPercent:round(100*zone(bands,160,400)/Math.max(1e-20,zone(bands,80,8000))),rumblePercent:round(100*zone(bands,25,63)/Math.max(1e-20,zone(bands,25,8000))),activeSeconds:sum(active.map(w=>w.duration)),lowMidSeconds:sum(muddy.map(w=>w.duration)),lowMidStart:strongest?.start??windows[0]!.start,rumbleStart:lowest?.start??windows[0]!.start};
 const stereo=valid.filter(w=>{const p=w.stereo;return p&&[p.left,p.right,p.cross,p.frames].every(Number.isFinite)&&p.frames>0&&p.left/p.frames>1e-7&&p.right/p.frames>1e-7;});
 if(stereo.length){
  const metrics=(p:NonNullable<SpectralWindow['stereo']>)=>({correlation:clamp(p.cross/Math.sqrt(p.left*p.right),-1,1),loss:-10*Math.log10(Math.max(1e-9,(p.left+p.right+2*p.cross)/(2*(p.left+p.right))))});
  const negative=stereo.filter(w=>{const m=metrics(w.stereo!);return m.correlation<-.5&&m.loss>6;});
  const worst=(negative.length?negative:stereo).reduce((a,b)=>metrics(b.stereo!).loss>metrics(a.stereo!).loss?b:a);
  const left=sum(stereo.map(w=>w.stereo!.left)),right=sum(stereo.map(w=>w.stereo!.right)),cross=sum(stereo.map(w=>w.stereo!.cross));
  const all=metrics({left,right,cross,frames:1}),seconds=sum(stereo.map(w=>w.duration)),badSeconds=sum(negative.map(w=>w.duration));
  result.phase={correlation:Math.round(all.correlation*100)/100||0,monoLossDb:round(all.loss),worstLossDb:round(metrics(worst.stereo!).loss),negativePercent:round(badSeconds/seconds*100),activeSeconds:seconds,variable:negative.length>0&&badSeconds/seconds<.9,start:worst.start,stop:worst.start+worst.duration,balanced:Math.abs(10*Math.log10(left/right))<3};
 }
 return result;
}
