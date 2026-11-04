import {SCENE_NODES} from './scene-nodes.js';
import type {IncomingMessage,ServerResponse} from 'node:http';
import type {XR18} from './xr18.js';
import type {Access,User} from './access.js';
import {LibraryStore} from './library-store.js';
import {ShowControl,validateFx} from './show-control.js';
export async function body(req:IncomingMessage):Promise<Record<string,unknown>>{let raw='';for await(const part of req){raw+=part;if(Buffer.byteLength(raw)>1000000)throw Error('Requête trop volumineuse');}const value:unknown=JSON.parse(raw||'{}');if(!value||typeof value!=='object'||Array.isArray(value))throw Error('Objet JSON requis');return value as Record<string,unknown>;}
export class StudioApi {
 busy=false;
 constructor(private xr:XR18,private access:Access,private library:LibraryStore,private show:ShowControl){}
 async handle(req:IncomingMessage,res:ServerResponse,path:string,user:User){
 const send=(data:unknown)=>res.end(JSON.stringify(data));
 if(!/^\/api\/(users|audit|library|reacue|monitor)(\/|$)/.test(path))return false;
 try{
  if(path==='/api/users'&&req.method==='GET'){send(this.access.list());return true;}
  if(path==='/api/users'&&req.method==='POST'){const d=await body(req);send(this.access.create(d.name,d.password,d.role,d.buses));return true;}
  const account=/^\/api\/users\/([a-f0-9-]+)$/.exec(path);
  if(account&&req.method==='PATCH'){const d=await body(req);send(this.access.update(account[1]!,d.role,d.buses,d.password));return true;}
  if(account&&req.method==='DELETE'){send(this.access.remove(account[1]!));return true;}
  if(path==='/api/audit'&&req.method==='GET'){send(this.access.audit());return true;}
  if(path==='/api/library'&&req.method==='GET'){send(['scene','fx','cue','native-scene','fx-backup','parameter-backup'].flatMap(k=>this.library.list(k)));return true;}
  if(path==='/api/library/capture-fx'&&req.method==='POST'){const d=await body(req);send(this.library.save('fx',d.name,await this.xr.readFx(Number(d.slot))));return true;}
  if(path==='/api/library/capture-native'&&req.method==='POST'){
   const d=await body(req);if(this.xr.mode!=='real')throw Error('Connexion XR18 réelle requise pour une capture native');
   const lines:string[]=[];for(const node of SCENE_NODES){lines.push(await this.xr.node(node));await new Promise(resolve=>setTimeout(resolve,5));}
   send(this.library.save('native-scene',d.name,lines.join('\n')+'\n'));return true;
  }
  if(path==='/api/library'&&req.method==='POST'){
   const d=await body(req);let value:unknown;
   if(d.kind==='scene')value=d.data===undefined?(d.complete===true?await this.show.console.capture():this.show.capture()):this.show.validateScene(d.data);
   else if(d.kind==='fx')value=validateFx(d.data);
   else if(d.kind==='native-scene'){if(typeof d.data!=='string'||d.data.length>900000||!d.data.split('\n').some(l=>l.startsWith('/ch/')))throw Error('Fichier .scn XR18 requis');value=d.data;}
   else if(d.kind==='cue'){const v=d.data as Record<string,unknown>;if(!v||typeof v.songId!=='string'||!v.songId.trim()||v.songId.length>120||typeof v.section!=='string'||!v.section.trim()||v.section.length>120||typeof v.targetId!=='string')throw Error('Morceau, section et cible requis');const target=this.library.get(v.targetId);if(!['scene','fx'].includes(target.kind))throw Error('Cible non rappelable');if(this.library.list('cue').some(e=>{const x=e.data as Record<string,unknown>;return x.songId===v.songId&&x.section===v.section;}))throw Error('Association déjà existante');value={songId:v.songId,section:v.section,targetId:v.targetId};}
   else throw Error('Type inconnu');
   if(d.kind==='scene'&&d.excludePhantom===true&&(value as {version?:number}).version===2){const scene=value as {values:Record<string,unknown>};for(const a of Object.keys(scene.values))if(a.endsWith('/phantom'))delete scene.values[a];}
   send(this.library.save(d.kind as string,d.name,value));return true;
  }
  const item=/^\/api\/library\/([a-f0-9-]+)(?:\/(preview|apply))?$/.exec(path);
  if(item){const id=item[1]!;if(req.method==='DELETE'&&!item[2]){send({ok:this.library.delete(id)});return true;}if(req.method==='GET'&&!item[2]){send(this.library.get(id));return true;}if(req.method==='POST'&&item[2]==='preview'){const d=await body(req);const entry=this.library.get(id);send(entry.kind==='parameter-backup'?await this.show.console.preview(entry.data,true):this.show.preview(id,d.excludePhantom===true));return true;}if(req.method==='POST'&&item[2]==='apply'){const d=await body(req);this.show.manualOverride();if(d.confirm!==true)throw Error('Confirmation requise');send(this.library.get(id).kind==='parameter-backup'?await this.show.console.apply(d.token,d.allowPhantom===true):await this.show.apply(id,d.token,d.confirm,d.allowPhantom));return true;}}
  if(path==='/api/reacue'&&req.method==='GET'){send(this.show.state());return true;}
  if(path==='/api/reacue/arm'&&req.method==='POST'){const d=await body(req);if(typeof d.armed!=='boolean'||d.confirm!==true)throw Error('Confirmation requise');send(this.show.arm(d.armed));return true;}
  if(path==='/api/reacue/event'&&req.method==='POST'){send(await this.show.event(await body(req)));return true;}
  const readMonitor=/^\/api\/monitor\/([1-6])$/.exec(path);
  if(readMonitor&&req.method==='GET'){const bus=Number(readMonitor[1]);if(bus>this.xr.model().monitorOutputs)throw Error('Sortie de retour absente sur ce modèle');const levels=[];for(let channel=1;channel<=this.xr.model().channels;channel++)levels.push(await this.xr.readParameter(`/ch/${String(channel).padStart(2,'0')}/mix/${String(bus).padStart(2,'0')}/level`));send({bus,levels});return true;}
  const monitor=/^\/api\/monitor\/([1-6])\/channels\/(\d+)$/.exec(path);
  if(monitor&&req.method==='POST'){if(Number(monitor[1])>this.xr.model().monitorOutputs)throw Error('Sortie de retour absente sur ce modèle');const d=await body(req);if(typeof d.value!=='number'||!Number.isFinite(d.value)||d.value<0||d.value>0.75||!Number.isInteger(Number(monitor[2]))||Number(monitor[2])<1||Number(monitor[2])>this.xr.model().channels)throw Error('Canal 1..16 et niveau 0..0,75 requis');const current=await this.xr.readParameter(`/ch/${String(Number(monitor[2])).padStart(2,'0')}/mix/${String(Number(monitor[1])).padStart(2,'0')}/level`);if(user.role==='musician'&&Math.abs(d.value-Number(current))>.1001)throw Error('Variation limitée à 0,10 par geste');this.show.manualOverride();await this.xr.setMonitor(Number(monitor[1]),Number(monitor[2]),d.value);send({ok:true,hardwareAcknowledged:false});return true;}
  res.writeHead(405);send({error:'Méthode non autorisée'});
 }catch(e){res.writeHead(400);send({error:(e as Error).message});}
 return true;
 }
}

