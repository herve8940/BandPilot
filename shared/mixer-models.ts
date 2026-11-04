/** Device identity and physical capabilities; never infer a model from an IP address. */
export type MixerModelId='XR12'|'MR12'|'XR18'|'MR18'|'X18'|'X32'|'X32RACK'|'X32C'|'X32P'|'X32CORE';
export type MixerProfile={id:MixerModelId;brand:'Behringer'|'Midas';family:'xair'|'x32';label:string;port:number;channels:number;micPreamps:number;monitorOutputs:number;buses:number;dca:number;fxSlots:number;usbChannels:number;usbRecorder:'stereo'|'multitrack-card'|'interface';validation:'hardware-xr18'|'protocol-tests'};
const air=(id:MixerModelId,small=false):MixerProfile=>({id,brand:id.startsWith('MR')?'Midas':'Behringer',family:'xair',label:id,port:10024,channels:small?12:16,micPreamps:small?4:16,monitorOutputs:small?2:6,buses:6,dca:4,fxSlots:4,usbChannels:small?0:18,usbRecorder:small?'stereo':'interface',validation:id==='XR18'?'hardware-xr18':'protocol-tests'});
const x32=(id:MixerModelId,physical=32):MixerProfile=>({id,brand:'Behringer',family:'x32',label:({X32RACK:'X32 Rack',X32C:'X32 Compact',X32P:'X32 Producer',X32CORE:'X32 Core'} as Record<string,string>)[id]??id,port:10023,channels:32,micPreamps:physical,monitorOutputs:16,buses:16,dca:8,fxSlots:8,usbChannels:32,usbRecorder:'multitrack-card',validation:'protocol-tests'});
export const MIXER_MODELS:Record<MixerModelId,MixerProfile>={XR12:air('XR12',true),MR12:air('MR12',true),XR18:air('XR18'),MR18:air('MR18'),X18:air('X18'),X32:x32('X32'),X32RACK:x32('X32RACK',16),X32C:x32('X32C',16),X32P:x32('X32P',16),X32CORE:x32('X32CORE',0)};
export function identifyMixer(raw:string):MixerProfile|null {
 const id=raw.trim().toUpperCase().replace(/[ _-]/g,'').replace(/V2$/,'');
 const alias:Record<string,MixerModelId>={X32COMPACT:'X32C',X32PRODUCER:'X32P'};
 return MIXER_MODELS[(alias[id]??id) as MixerModelId]??null;
}
export const DEFAULT_MIXER=MIXER_MODELS.XR18;
export const APP_NAME='BandPilot';
