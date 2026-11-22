import type {MixerProfile} from '../shared/mixer-models.js';

export const LINKED_VIEWS=['console','channel','analysis'] as const;
type View=typeof LINKED_VIEWS[number];
type Selection={owner:string;scope:string;view:View;channel:number;until:number};

/** Shares only navigation within one BandPilot server. It has no mixer transport. */
export class ExpertViewLink{
 private current:Selection|null=null;
 constructor(private now:()=>number=Date.now){}
 read(scope:string){
  const current=this.current;
  if(!current||current.scope!==scope||current.until<=this.now())return null;
  return {view:current.view,channel:current.channel};
 }
 publish(user:string,scope:string,model:MixerProfile,input:Record<string,unknown>){
  const {publisher,channel,view}=input;
  if(typeof publisher!=='string'||!/^[a-f0-9-]{36}$/.test(publisher)||typeof view!=='string'||!LINKED_VIEWS.includes(view as View)||typeof channel!=='number'||!Number.isInteger(channel)||channel<1||channel>model.channels)throw Error('Sélection de vue invalide.');
  const owner=user+':'+publisher;
  if(this.read(scope)&&this.current?.owner!==owner)throw Error('Un autre écran partage déjà sa vue.');
  this.current={owner,scope,channel,view:view as View,until:this.now()+5000};
  return {ok:true};
 }
}
