/** A narrow, persistent electrical-spectrum peak is a candidate to investigate,
 * not proof of acoustic feedback. Never creates a console write. */
export type Resonance={bin:number;hz:number;db:number;prominence:number;since:number;at:number;frames:number};
export function trackResonance(previous:Resonance|null,frame:{bands:number[];at:number}|null,now:number):Resonance|null{
 if(!frame||frame.bands.length!==100||!frame.bands.every(Number.isFinite)||!Number.isFinite(frame.at)||now-frame.at>1500||frame.at>now+1000)return null;
 if(previous&&frame.at===previous.at)return previous;
 let best:Resonance|null=null;
 for(let i=4;i<96;i++){
  const db=frame.bands[i]!;
  if(db<-55||db<frame.bands[i-1]!||db<frame.bands[i+1]!)continue;
  const shoulders=[...frame.bands.slice(i-4,i-1),...frame.bands.slice(i+2,i+5)].sort((a,b)=>a-b);
  const prominence=db-(shoulders[2]!+shoulders[3]!)/2;
  if(prominence<8||best&&best.prominence>=prominence)continue;
  const continuous=previous&&frame.at>previous.at&&frame.at-previous.at<=1000&&Math.abs(i-previous.bin)<=1;
  best={bin:i,hz:20*Math.pow(1000,i/99),db,prominence,since:continuous?previous.since:frame.at,at:frame.at,frames:continuous?previous.frames+1:1};
 }
 return best;
}
export const sustainedResonance=(r:Resonance|null)=>!!r&&r.at-r.since>=2000&&r.frames>=5;
