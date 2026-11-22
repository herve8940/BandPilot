export const busPairStart=(bus:number)=>bus%2?bus:bus-1;
export const busLinkAddress=(bus:number)=>{const first=busPairStart(bus);return `/config/buslink/${first}-${first+1}`;};
export function validStereoBus(bus:number,outputs:number){return Number.isInteger(bus)&&bus>=1&&bus%2===1&&bus+1<=outputs;}
export function pairedMonitorAddress(bus:number,address:string){
 if(address.startsWith(`/bus/${bus}/mix/`))return address.replace(`/bus/${bus}/`,`/bus/${bus+1}/`);
 const first=String(bus).padStart(2,'0'),second=String(bus+1).padStart(2,'0');
 return address.endsWith(`/mix/${first}/level`)?address.replace(`/mix/${first}/level`,`/mix/${second}/level`):null;
}
