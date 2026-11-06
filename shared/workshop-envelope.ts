/** Short, local audio envelopes; values are dBFS, not acoustic listening levels. */
export type Envelope={step:number;peak:number[];rms:number[]};
export type EnvelopeWindow={start:number;duration:number;envelope?:Envelope};
export type EnvelopePoint={at:number;peak:number;rms:number};
export type TemporalEvidence={activeSpreadDb:number;activePeakDb:number;activeMedianDb:number;attackMs:number;decayMs:number;events:number;quietStart:number;softStart:number};
export type GateReference={quietStart:number;quietStop:number;softStart:number;softStop:number};
export const quantile=(values:number[],q:number)=>{const sorted=[...values].sort((a,b)=>a-b);return sorted[Math.min(sorted.length-1,Math.floor((sorted.length-1)*q))]??-120;};
export const bound=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v));
export function envelopePoints(windows:EnvelopeWindow[]):EnvelopePoint[]{
 const out:EnvelopePoint[]=[];
 for(const w of windows){const e=w.envelope;if(!e)continue;
  if(!Number.isFinite(e.step)||e.step<.005||e.step>.1||!Array.isArray(e.peak)||!Array.isArray(e.rms)||e.peak.length!==e.rms.length||e.peak.length!==Math.ceil(w.duration/e.step)||e.peak.some(v=>!Number.isFinite(v)||v< -120||v>24)||e.rms.some(v=>!Number.isFinite(v)||v< -120||v>24))throw Error('Enveloppe audio invalide');
  e.peak.forEach((peak,i)=>out.push({at:w.start+i*e.step,peak,rms:e.rms[i]!}));
 }
 return out.sort((a,b)=>a.at-b.at);
}
export function temporalEvidence(windows:EnvelopeWindow[]):TemporalEvidence|undefined{
 const points=envelopePoints(windows);if(points.length<25)return;
 const loud=quantile(points.map(p=>p.peak),.95),floor=quantile(points.map(p=>p.rms),.15);
 const active=points.filter(p=>p.rms>Math.max(-75,loud-30,floor+6));if(active.length<10||loud< -60)return;
 const attacks:number[]=[],decays:number[]=[];
 for(let i=1;i<points.length-1;i++){const p=points[i]!,prior=points[i-1]!;
  if(p.at-prior.at>.1||p.peak<loud-12||p.peak-prior.peak<6)continue;
  let top=i;while(top+1<points.length&&points[top+1]!.at-p.at<=.15&&points[top+1]!.peak>points[top]!.peak)top++;
  let end=top+1;while(end<points.length&&points[end]!.at-points[top]!.at<1&&points[end]!.peak>points[top]!.peak-12)end++;
  attacks.push(bound((points[top]!.at-prior.at)*1000,20,150));
  if(end<points.length&&points[end]!.peak<=points[top]!.peak-12)decays.push((points[end]!.at-points[top]!.at)*1000);
  i=Math.max(i,top+2);
 }
 // Suggested landmarks are only suggestions. The musician must identify silence and a soft note.
 const sliceScore=(at:number)=>quantile(points.filter(p=>p.at>=at&&p.at<at+.5).map(p=>p.rms),.9);
 const candidates=points.filter((_,i)=>i%25===0&&points.at(-1)!.at-points[i]!.at>=.48);
 const quiet=candidates.reduce((a,b)=>sliceScore(b.at)<sliceScore(a.at)?b:a,candidates[0]??points[0]!);
 const softLevel=quantile(active.map(p=>p.rms),.2);
 const soft=active.reduce((a,b)=>Math.abs(b.rms-softLevel)<Math.abs(a.rms-softLevel)?b:a,active[0]!);
 const median=quantile(active.map(p=>p.rms),.5),high=quantile(active.map(p=>p.rms),.95);
 return {activeSpreadDb:Math.round((high-softLevel)*10)/10,activePeakDb:loud,activeMedianDb:median,attackMs:attacks.length?quantile(attacks,.5):0,decayMs:decays.length?quantile(decays,.5):0,events:attacks.length,quietStart:quiet.at,softStart:soft.at};
}
