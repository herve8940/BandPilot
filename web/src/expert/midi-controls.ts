import type {MixerProfile} from '../../../shared/mixer-models';
import {dbToFader,faderToDb} from '../xairMath';
export type MidiSignal={kind:'cc'|'note'|'pitch'|'program';channel:number;number:number;value:number;pressed:boolean;raw:number};
export const MIDI_ENCODERS={absolute:'CC absolu',twos:'Relatif : complément à deux',offset:'Relatif : centre 64',signed:'Relatif : bit de signe',custom:'Relatif : valeurs personnalisées'} as const;
export type MidiBinding={id:string;device:string;kind:MidiSignal['kind'];channel:number;number:number;target:string;ccMode?:keyof typeof MIDI_ENCODERS;stepDb?:number;increment?:number;decrement?:number;feedback?:boolean};
export function midiSignal(data:Uint8Array|null):MidiSignal|null{
 if(!data||data.length<2||data[0]!<128||data[1]!>127)return null;
 const type=data[0]!>>4,channel=(data[0]!&15)+1,number=data[1]!;
 if(type===12)return data.length===2?{kind:'program',channel,number,value:1,pressed:true,raw:number}:null;
 if(data.length!==3||data[2]!>127)return null;const raw=data[2]!;
 if(type===11)return {kind:'cc',channel,number,value:raw/127,pressed:raw>=64,raw};
 if(type===9||type===8)return {kind:'note',channel,number,value:type===8?0:raw/127,pressed:type===9&&raw>0,raw};
 if(type===14)return {kind:'pitch',channel,number:0,value:(number+raw*128)/16383,pressed:true,raw:number+raw*128};
 return null;
}
export function midiTargets(model:MixerProfile){
 const targets:{address:string;label:string;toggle:boolean}[]=[];
 for(let ch=1;ch<=model.channels;ch++){
  const p=`/ch/${String(ch).padStart(2,'0')}`;
  targets.push({address:p+'/mix/fader',label:`${ch} · Fader`,toggle:false},{address:p+'/mix/on',label:`${ch} · Mute`,toggle:true});
  for(let bus=1;bus<=model.monitorOutputs;bus++)targets.push({address:`${p}/mix/${String(bus).padStart(2,'0')}/level`,label:`${ch} → Bus ${bus}`,toggle:false});
 }
 return targets;
}
export const midiCommandId=(target:string)=>/^command:([a-f0-9-]{36})$/.exec(target)?.[1];
export function validMidiBindings(input:unknown,model:MixerProfile):MidiBinding[]{
 if(!Array.isArray(input)||input.length>64||model.family!=='xair')throw Error('Affectations MIDI invalides.');
 const targets=midiTargets(model),ids=new Set<string>(),signals=new Set<string>();
 return input.map(b=>{
  const signal=JSON.stringify([b?.device,b?.kind,b?.channel,b?.number]);
  const target=targets.find(t=>t.address===b?.target),command=typeof b?.target==='string'&&midiCommandId(b.target),relative=b?.ccMode!==undefined&&b.ccMode!=='absolute';
  if(!b||typeof b.id!=='string'||!b.id||b.id.length>128||ids.has(b.id)||typeof b.device!=='string'||b.device.length>256||!['cc','note','pitch','program'].includes(b.kind)||!Number.isInteger(b.channel)||b.channel<1||b.channel>16||!Number.isInteger(b.number)||b.number<0||b.number>127||b.kind==='pitch'&&b.number!==0||(!target&&!command)||signals.has(signal))throw Error('Affectations MIDI invalides.');
  if(b.ccMode!==undefined&&(!Object.hasOwn(MIDI_ENCODERS,b.ccMode)||b.kind!=='cc')||relative&&(target?.toggle||command)||b.kind==='note'&&!target?.toggle&&!command||b.kind==='pitch'&&(target?.toggle||command)||b.kind==='program'&&!command)throw Error('Type de commande MIDI incompatible avec cette cible.');
  if(b.stepDb!==undefined&&(!relative||typeof b.stepDb!=='number'||![.1,.5,1,2].includes(b.stepDb))||b.ccMode==='custom'&&(!Number.isInteger(b.increment)||!Number.isInteger(b.decrement)||b.increment<0||b.increment>127||b.decrement<0||b.decrement>127||b.increment===b.decrement))throw Error('Réglage d’encodeur MIDI invalide.');
  if(b.feedback!==undefined&&(typeof b.feedback!=='boolean'||!target?.toggle||!['cc','note'].includes(b.kind)))throw Error('Le retour MIDI concerne les voyants des mutes (notes ou CC).');
  ids.add(b.id);signals.add(signal);
  return {id:b.id,device:b.device,kind:b.kind,channel:b.channel,number:b.number,target:b.target,...(b.ccMode!==undefined?{ccMode:b.ccMode}:{}),...(b.stepDb!==undefined?{stepDb:b.stepDb}:{}),...(b.ccMode==='custom'?{increment:b.increment,decrement:b.decrement}:{}),...(b.feedback!==undefined?{feedback:b.feedback}:{})};
 });
}
export function midiPickup(previous:number|undefined,next:number,current:number){return Math.abs(next-current)<=2/127||previous!==undefined&&(previous-current)*(next-current)<=0;}
/** Protocol is selected explicitly: guessing a relative format can invert a knob. */
export function midiDelta(raw:number,b:MidiBinding){
 if(!Number.isInteger(raw)||raw<0||raw>127)return 0;
 if(b.ccMode==='custom')return raw===b.increment?1:raw===b.decrement?-1:0;
 if(raw===0||raw===64)return 0;
 if(b.ccMode==='twos')return raw<64?raw:raw-128;
 if(b.ccMode==='offset')return raw-64;
 if(b.ccMode==='signed')return raw<64?raw:64-raw;
 return 0;
}
export function relativeMidiLevel(value:number,raw:number,b:MidiBinding){
 const delta=midiDelta(raw,b);if(!delta||!Number.isFinite(value)||value<0||value>1)return value;
 const db=value===0?-90:faderToDb(value);
 return dbToFader(Math.max(-90,Math.min(10,db+Math.max(-16,Math.min(16,delta))*(b.stepDb??.5))));
}
export function midiFeedback(b:MidiBinding,value:unknown):number[]|null{
 if(!b.feedback||!b.target.endsWith('/mix/on')||![0,1].includes(Number(value))||typeof value!=='number'||!['note','cc'].includes(b.kind))return null;
 return [(b.kind==='note'?0x90:0xb0)+b.channel-1,b.number,value===0?127:0];
}
