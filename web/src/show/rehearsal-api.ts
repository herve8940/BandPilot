import type {RehearsalCommand,RehearsalStatus} from '../../../shared/rehearsal-desk.js';

export type DeskStatus=RehearsalStatus;
export async function deskApi<T>(path:string,body?:unknown,token?:string,signal?:AbortSignal){
 const route=(token===undefined?'/api/rehearsal-desk/':'/ears-api/'+encodeURIComponent(token)+'/rehearsal/')+path;
 const response=await fetch(route,{
  method:body===undefined?'GET':'POST',signal,
  headers:body===undefined?undefined:{'Content-Type':'application/json'},
  body:body===undefined?undefined:JSON.stringify(body),
 });
 const data=await response.json();
 if(!response.ok)throw Object.assign(Error(data.error??'Commande de répétition invalide.'),{status:response.status});
 return data as T;
}
export const deskState=(known:string|undefined,token?:string,signal?:AbortSignal)=>deskApi<DeskStatus>('state'+(known?'?known='+encodeURIComponent(known):''),undefined,token,signal);
export const deskCommand=(input:RehearsalCommand,token?:string)=>deskApi<DeskStatus>('command',input,token);
