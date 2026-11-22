import type {ConfiguredInput,RehearsalProject} from './rehearsal-desk.js';

export function rehearsalInputs(configured:ConfiguredInput[],project:RehearsalProject){
 const remaining=new Set(project.recordTracks);
 const rows=configured.map(input=>{
  const channels=input.stereo?[input.usb,input.usb+1]:[input.usb];
  const track=project.recordTracks.find(t=>remaining.has(t)&&t.channels.length===channels.length&&channels.every((n,i)=>t.channels[i]===n));
  if(track)remaining.delete(track);
  return {input,track,name:input.name,channels,available:input.available&&channels.every(n=>n<=project.inputs)&&(track?.available??true)};
 });
 return [...rows,...Array.from(remaining,track=>({input:undefined,track,name:track.name,channels:track.channels,available:track.available}))];
}
