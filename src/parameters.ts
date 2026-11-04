import {SCENE_SCHEMA} from './scene-schema.js';
export type Value=number|string;
export type Parameter={address:string;kind:string;type:'i'|'f'|'s';min?:number;max?:number;options?:string[];sensitive:boolean};
export const PARAMETERS:Record<string,Parameter>=Object.create(null);
for(const [node,fields] of Object.entries(SCENE_SCHEMA))for(const f of fields){
 const address=node+'/'+(node.endsWith('/geq')?f.leaf.replace(/^geq\//,''):f.leaf);
 const type=f.kind==='StrC'?'s':['OnOffC','EnumC','IntC','BitmaskC'].includes(f.kind)?'i':'f';
 const ranges:Record<string,[number,number]>={OnOffC:[0,1],IntC:[0,15],BitmaskC:[0,15],LevelC:[-90,10],PanC:[-100,100],PercentC:[0,100],EqQC:[.3,10]};
 const range=f.kind==='EnumC'?[0,(f.options?.length??1)-1]:ranges[f.kind]??[f.lo??0,f.hi??1];
 PARAMETERS[address]={address,kind:f.kind,type,min:range[0],max:range[1],options:f.options,sensitive:address.endsWith('/phantom')||address.startsWith('/routing/')||address.startsWith('/headamp/')};
}
// Physical XR18 has 16 mic preamps plus stereo aux; larger headamp entries are not exposed.
for(const a of Object.keys(PARAMETERS))if(/^\/headamp\/(1[7-9]|2\d)\//.test(a))delete PARAMETERS[a];
export const AIR_PARAMETER_ADDRESSES=new Set(Object.keys(PARAMETERS));
// Additional X32 core addresses. Each transport filters this catalog by its detected profile.
for(let n=17;n<=32;n++)for(const [a,p] of Object.entries(PARAMETERS))if(a.startsWith('/ch/01/')){const address=a.replace('/ch/01/',`/ch/${String(n).padStart(2,'0')}/`);PARAMETERS[address]={...p,address};}
for(let n=7;n<=16;n++)for(const [a,p] of Object.entries(PARAMETERS))if(a.startsWith('/bus/1/')){const address=a.replace('/bus/1/',`/bus/${n}/`);PARAMETERS[address]={...p,address};}
for(let ch=1;ch<=32;ch++)for(let bus=7;bus<=16;bus++)for(const leaf of ['level','on','pan']){const base=PARAMETERS[`/ch/01/mix/01/${leaf}`];if(base){const address=`/ch/${String(ch).padStart(2,'0')}/mix/${String(bus).padStart(2,'0')}/${leaf}`;PARAMETERS[address]={...base,address};}}
for(let n=5;n<=8;n++)for(const [a,p] of Object.entries(PARAMETERS))if(a.startsWith('/dca/1/')){const address=a.replace('/dca/1/',`/dca/${n}/`);PARAMETERS[address]={...p,address};}
for(const prefix of [...Array.from({length:6},(_,i)=>`/mtx/${String(i+1).padStart(2,'0')}`),'/main/m'])for(const leaf of ['fader','on']){const base=PARAMETERS[`/lr/mix/${leaf}`]!;const address=`${prefix}/mix/${leaf}`;PARAMETERS[address]={...base,address};}
/**
 * The XR18 quantizes every float to a fixed number of steps (as X-AIR Edit does):
 * faders 1024, send levels 161, pan 101, EQ frequency 201, HPF 101, Q 72, times 101…
 * A write is accepted when the readback lands within one step of the request: the real XR18
 * truncates some log-scaled values (HPF, Q, times) to the step below instead of the nearest one
 * (35 Hz asked → 34.3 Hz kept), so half a step was too strict on hardware.
 */
const LIN_STEP:Record<string,number>={gain:.5,rtntrim:.25,g:.25,thr:.5,range:1,attack:1,knee:1,mgain:.5,weight:.5,sourcetrim:.5,dimatt:1};
export function wireSteps(address:string):number|undefined{
 const p=PARAMETERS[address];if(!p||p.type!=='f')return undefined;
 const leaf=address.split('/').at(-1)!;
 if(p.kind==='LevelC')return leaf==='fader'?1024:161;
 if(p.kind==='PanC')return 101;
 if(p.kind==='EqQC')return 72;
 if(p.kind==='PercentC')return 21;
 if(p.kind==='LogFreqC')return leaf==='hpf'?101:201;
 if(p.kind==='LogTimeC')return 101;
 if(address.includes('/geq/'))return 61;
 const step=LIN_STEP[leaf];
 return step&&p.max!==undefined&&p.min!==undefined?Math.round((p.max-p.min)/step)+1:undefined;
}
export function readbackTolerance(address:string):number{
 const steps=wireSteps(address);
 return steps?Math.max(.003,1.1/(steps-1)):.011;
}
export function descriptor(address:string){const p=PARAMETERS[address];if(!p)throw Error('Paramètre XR18 non autorisé : '+address);return p;}
export function validateWire(address:string,value:unknown):Value {
 const p=descriptor(address);
 if(p.type==='s'){if(typeof value!=='string'||Buffer.byteLength(value,'utf8')>12||/[\x00-\x1f\x7f]/.test(value))throw Error('Nom : 12 octets maximum, sans caractères de contrôle');return value;}
 const max=p.type==='f'?1:p.max!,min=p.type==='f'?0:p.min!;
 if(typeof value!=='number'||!Number.isFinite(value)||value<min||value>max||(p.type==='i'&&!Number.isInteger(value)))throw Error(`Valeur OSC hors plage : ${address} (reçu ${typeof value==='string'?JSON.stringify(value):String(value)})`);
 return value;
}
export function toWire(address:string,input:unknown):Value {
 const p=descriptor(address);if(p.type==='s')return validateWire(address,input);
 let value=input;
 if(typeof value==='string'&&p.options){const i=p.options.indexOf(value);if(i<0)throw Error('Option inconnue');value=i;}
 if(typeof value!=='number'||!Number.isFinite(value)||value<p.min!||value>p.max!)throw Error('Valeur hors plage : '+address);
 if(p.type==='i')return validateWire(address,value);
 let wire:number;
 if(p.kind==='LevelC'){const d=value;wire=d>=-10?(d+30)/40:d>=-30?(d+50)/80:d>=-60?(d+70)/160:(d+90)/480;}
 else if(p.kind==='EqQC')wire=1-Math.log(value/.3)/Math.log(10/.3);
 else if(p.kind==='LogFreqC'||p.kind==='LogTimeC')wire=Math.log(value/p.min!)/Math.log(p.max!/p.min!);
 else wire=(value-p.min!)/(p.max!-p.min!);
 return validateWire(address,Math.max(0,Math.min(1,wire)));
}
export function fromWire(address:string,value:Value):Value {
 const p=descriptor(address);if(p.type!=='f'||typeof value!=='number')return value;
 if(p.kind==='LevelC')return value>=.5?value*40-30:value>=.25?value*80-50:value>=.0625?value*160-70:value*480-90;
 if(p.kind==='EqQC')return .3*Math.pow(10/.3,1-value);
 if(p.kind==='LogFreqC'||p.kind==='LogTimeC')return p.min!*Math.pow(p.max!/p.min!,value);
 return p.min!+value*(p.max!-p.min!);
}
export function defaultWire(p:Parameter):Value {
 if(p.type==='s')return '';
 if(/\/(?:fader|level)$/.test(p.address))return 0;
 if(p.kind==='OnOffC')return p.address.endsWith('/on')?1:0;
 if(p.kind==='PanC'||p.kind==='EqQC'||p.kind==='LinC')return .5;
 return 0;
}
