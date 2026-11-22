import type {XR18} from './xr18.js';
import type {ConsoleControl} from './console-control.js';
import {busLinkAddress,validStereoBus} from '../shared/monitor-pairs.js';
import type {Value} from './parameters.js';
/** Copy sends only. ConsoleControl guards both the source and destination until apply. */
export async function previewMonitorCopy(xr:XR18,control:ConsoleControl,source:unknown,target:unknown){
 if(xr.model().family!=='xair')throw Error('Copie de mix disponible uniquement pour X-Air / M-Air.');
 if(typeof source!=='number'||typeof target!=='number'||![source,target].every(n=>Number.isInteger(n)&&n>=1&&n<=xr.model().monitorOutputs)||source===target)throw Error('Choisis deux retours distincts disponibles sur cette console.');
 const identity=control.identity(),epoch=xr.operationId(),guards:Record<string,Value>={},values:Record<string,Value>={};
 for(const bus of [source,target])guards[busLinkAddress(bus)]=await xr.readParameter(busLinkAddress(bus));
 const stereo=guards[busLinkAddress(source)]===1;
 if(stereo!==(guards[busLinkAddress(target)]===1)||stereo&&(!validStereoBus(source,xr.model().monitorOutputs)||!validStereoBus(target,xr.model().monitorOutputs)))throw Error('Choisis deux retours mono ou deux paires stéréo complètes.');
 const prefixes=[...Array.from({length:xr.model().channels},(_,i)=>`/ch/${String(i+1).padStart(2,'0')}`),'/rtn/aux',...Array.from({length:4},(_,i)=>`/rtn/${i+1}`)];
 for(const prefix of prefixes)for(const offset of stereo?[0,1]:[0])for(const leaf of stereo&&offset===0?['level','pan']:['level']){
  const from=`${prefix}/mix/${String(source+offset).padStart(2,'0')}/${leaf}`,to=`${prefix}/mix/${String(target+offset).padStart(2,'0')}/${leaf}`;
  if(!xr.supports(from)||!xr.supports(to))continue;
  values[to]=guards[from]=await xr.readParameter(from);
 }
 if(identity!==control.identity()||epoch!==xr.operationId())throw Error('Connexion modifiée');
 return {...await control.preview(values,true,guards),source,target,stereo};
}
