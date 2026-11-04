import {AIR_PARAMETER_ADDRESSES} from './parameters.js';
import type {MixerProfile} from '../shared/mixer-models.js';
/** Explicit surface for each protocol. No X-Air routing/FX vector is sent to an X32. */
export function supportsMixerAddress(p:MixerProfile,a:string):boolean {
 const ch=/^\/ch\/(\d\d)\/(.+)$/.exec(a),bus=/^\/bus\/(\d+)\/(.+)$/.exec(a),head=/^\/headamp\/(\d+)\//.exec(a),dca=/^\/dca\/(\d+)\/(.+)$/.exec(a);
 if(ch&&(Number(ch[1])<1||Number(ch[1])>p.channels))return false;
 if(bus&&(Number(bus[1])<1||Number(bus[1])>p.buses))return false;
 if(dca&&(Number(dca[1])<1||Number(dca[1])>p.dca))return false;
 if(p.family==='xair'){
  if(head&&Number(head[1])>p.micPreamps)return false;
  if(!p.usbChannels&&(a.startsWith('/routing/usb/')||a.includes('/preamp/rtnsw')))return false;
  return AIR_PARAMETER_ADDRESSES.has(a)||/^\/-stat\/solosw\/(0[1-9]|1[0-6])$/.test(a)||/^\/fx\/[1-4]\/par$/.test(a)||a.startsWith('/-prefs/');
 }
 if(head||a.startsWith('/routing/')||a.startsWith('/config/')||a.startsWith('/fx/')||a.startsWith('/rtn/')||a.startsWith('/fxsend/')||a.startsWith('/-stat/'))return false;
 const config=/^config\/(name|color)$/;
 const mix=/^mix\/(fader|on|pan|lr)$/;
 const eq=/^eq\/(on|[1-6]\/(type|f|g|q))$/;
 const gate=/^gate\/(on|mode|thr|range|attack|hold|release)$/;
 const comp=/^dyn\/(on|mode|det|env|thr|ratio|knee|mgain|attack|hold|release|mix|auto)$/;
 if(ch)return config.test(ch[2]!)||mix.test(ch[2]!)||/^mix\/(0[1-9]|1[0-6])\/(level|on|pan)$/.test(ch[2]!)||eq.test(ch[2]!)||gate.test(ch[2]!)||comp.test(ch[2]!)||/^preamp\/(hpon|hpf)$/.test(ch[2]!);
 if(bus)return config.test(bus[2]!)||mix.test(bus[2]!)||eq.test(bus[2]!)||comp.test(bus[2]!);
 if(dca)return /^(fader|on|config\/(name|color))$/.test(dca[2]!);
 if(a.startsWith('/lr/'))return mix.test(a.slice(4))||eq.test(a.slice(4))||comp.test(a.slice(4));
 return /^\/(mtx\/0[1-6]|main\/m)\/mix\/(fader|on)$/.test(a);
}
export function toMixerAddress(p:MixerProfile,a:string){
 if(p.family!=='x32')return a;
 return a.replace(/^\/lr\//,'/main/st/').replace(/^\/bus\/(\d+)\//,(_,n)=>`/bus/${String(n).padStart(2,'0')}/`).replace(/^(\/ch\/\d\d\/mix)\/lr$/,'$1/st');
}
export function fromMixerAddress(p:MixerProfile,a:string){
 if(p.family!=='x32')return a;
 return a.replace(/^\/main\/st\//,'/lr/').replace(/^\/bus\/0?(\d+)\//,(_,n)=>`/bus/${Number(n)}/`).replace(/^(\/ch\/\d\d\/mix)\/st$/,'$1/lr');
}
