import {useEffect,useRef,useState} from 'react';
import {useMixerModel} from './MixerModel';
import {getLocale,tx} from './i18n';
import {balanceInputName,balanceInputs,inputId,type BalanceInput} from './MixerBalanceOverview';
import type {Profile,Source,Musician} from './CoachSetup';

type Scene={id:string;name:string;kind:string;data:{version:number;model:string;values:Record<string,number|string>;missing?:string[]}};
type Mix={kind:'mixer';scene:Scene;inputs:BalanceInput[];draft?:Profile;completed:string[];step:string};
type Blank={kind:'blank';profile:Profile;step:string;fresh:boolean;prepared?:string};
type Journey=Mix|Blank;
type Target={model?:string;host?:string;port?:number;mode:'real'|'simulation';connected:boolean};
type Request=(path:string,data?:unknown)=>Promise<any>;
const steps=['connect','inputs','levels','tone','ears','save'];
function lastStep(id:unknown){return typeof id==='string'&&steps.includes(id)?id:'inputs';}

/** Keep the captured channel numbers and names. Instrument and musician edits belong to this balance. */
export function mixerBalanceProfile(session:Mix,group:Profile,sources:Source[],outputs:number):Profile {
  const {values}=session.scene.data;
  const inputs=session.inputs.map(id=>{
    const channel=id==='aux'?0:id,name=balanceInputName(values,id);
    const stripName=values[(channel===0?'/rtn/aux':'/ch/'+String(channel).padStart(2,'0'))+'/config/name'];
    const match=typeof stripName==='string'&&stripName.trim()?group.inputs.find(i=>i.channel===channel&&i.name.trim()===stripName.trim()):undefined;
    const source=session.draft?.inputs.find(i=>i.channel===channel)?.source??match?.source??sources.find(s=>s.name===stripName)?.id??'';
    return {channel,name,source};
  });
  const captured:Musician[]=[];
  const monitors:NonNullable<Profile['tech']>['monitors']={};
  for(let bus=1;bus<=outputs;bus++){
    const name=values['/bus/'+bus+'/config/name'];
    if(typeof name!=='string'||!name.trim()||(bus%2===0&&values['/config/buslink/'+(bus-1)+'-'+bus]===1))continue;
    const saved=group.musicians?.find(m=>m.bus===bus&&m.name.trim()===name.trim());
    const settings=group.tech?.monitors?.[bus];
    if(saved&&settings)monitors[bus]=settings;
    const channels=saved?.channels.filter(c=>group.inputs.some(i=>i.channel===c&&inputs.some(selected=>selected.channel===c&&selected.name.trim()===i.name.trim())))??[];
    captured.push({bus,name:name.trim(),role:saved?.role??'unknown',channels});
  }
  const musicians=(session.draft?.musicians??captured).map(m=>({...m,channels:m.channels.filter(c=>inputs.some(i=>i.channel===c))}));
  return {version:1,completed:session.completed,inputs,musicians,tech:session.draft?.tech??{monitors},sound:group.sound,headroom:group.headroom};
}

export function useMixerBalance(status:Target,admin:boolean,api:Request){
  const model=useMixerModel();
  const key=JSON.stringify(['bp-guided-mixer',model.id,status.mode,status.host,status.port]);
  const [journey,setJourney]=useState<Journey|null>(null);
  const latest=useRef<Journey|null>(null);
  const [loading,setLoading]=useState(false);
  const generation=useRef(0);
  useEffect(()=>{
    const current=++generation.current;
    latest.current=null;setJourney(null);
    setLoading(false);
    if(admin){
      let draft;
      try{draft=JSON.parse(sessionStorage.getItem(key)??'null');}catch{}
      if(draft?.kind==='blank'&&draft.profile?.version===1&&Array.isArray(draft.profile.inputs)&&Array.isArray(draft.profile.completed)){
        latest.current={kind:'blank',profile:draft.profile,step:lastStep(draft.step),fresh:draft.fresh===true,prepared:typeof draft.prepared==='string'?draft.prepared:undefined};setJourney(latest.current);
      }else if(typeof draft?.id==='string'&&Array.isArray(draft.inputs)){
        setLoading(true);
        api('/api/library/'+encodeURIComponent(draft.id)).then((scene:Scene)=>{
          if(current!==generation.current||scene.kind!=='scene'||scene.data.model!==model.id||scene.data.version!==2)return;
          const inputs=balanceInputs(model.channels,scene.data.values).map(inputId).filter(n=>draft.inputs.includes(n));
          latest.current={kind:'mixer',scene,inputs,draft:draft.profile?.version===1&&Array.isArray(draft.profile.inputs)&&Array.isArray(draft.profile.musicians)?draft.profile:undefined,completed:Array.isArray(draft.completed)?draft.completed:[],step:lastStep(draft.step)};setJourney(latest.current);
        }).catch(()=>{}).finally(()=>{if(current===generation.current)setLoading(false);});
      }
    }
    return ()=>{++generation.current;};
  },[key,admin,api,model.id,model.channels]);
  function update(next:Journey|null){
    latest.current=next;setJourney(next);
    try{
      if(next)sessionStorage.setItem(key,JSON.stringify(next.kind==='blank'?next:{kind:'mixer',id:next.scene.id,inputs:next.inputs,profile:next.draft,completed:next.completed,step:next.step}));
      else sessionStorage.removeItem(key);
    }catch{/* The current balance still works when storage is unavailable. */}
  }
  async function capture(){
    const current=generation.current;
    const name=tx(status.mode==='simulation'?'Départ de balance en simulation':'Départ de balance')+' · '+model.label+' · '+new Date().toLocaleString(getLocale());
    const scene:Scene=await api('/api/coach/mixer-capture',{name,model:model.id,host:status.host,port:status.port,mode:status.mode});
    if(current!==generation.current)return false;
    update({kind:'mixer',scene,inputs:[],completed:['connect'],step:'inputs'});
    return true;
  }
  const session=journey?.kind==='mixer'?journey:null;
  const blank=journey?.kind==='blank'?journey:null;
  return {journey,session,blank,loading,capture,
    startBlank:(previous:Profile)=>update({kind:'blank',fresh:true,step:'inputs',profile:{version:1,inputs:[],musicians:[],completed:['connect'],sound:previous.sound,headroom:previous.headroom}}),
    finish:()=>update(null),
    prepared:(signature:string)=>{const active=latest.current;if(active?.kind==='blank')update({...active,prepared:signature});},
    saved:()=>{const active=latest.current;if(active?.kind==='blank'&&active.fresh)update({...active,fresh:false});},
    edit:(profile:Profile,step=blank?.step??'inputs')=>{const active=latest.current;if(active?.kind==='blank')update({...active,profile,step});},
    visit:(id:string)=>{const active=latest.current;if(active&&steps.includes(id))update({...active,step:id});},
    editMixer:(draft:Profile)=>{if(session)update({...session,draft});},
    select:(inputs:BalanceInput[])=>{if(session)update({...session,inputs,completed:['connect'],step:'inputs'});},
    mark:(completed:string[],step:string)=>{if(session)update({...session,completed,step});}};
}
