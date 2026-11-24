import {sendWebAsset} from './web-asset.js';
import {busPairStart,busLinkAddress,validStereoBus,pairedMonitorAddress} from '../shared/monitor-pairs.js';
import type {PersonalPatchInput} from '../shared/tech-rider.js';
// Partage des retours sur le réseau local : chaque musicien ouvre SON mix par un lien
// personnel (QR code). Le lien ne donne accès qu'aux envois de son bus, au volume et au
// mute de son retour, et à ses profils. La console complète reste sur l'ordinateur.
import Database from 'better-sqlite3';
import http from 'node:http';
import {randomBytes,randomUUID} from 'node:crypto';
import {stat} from 'node:fs/promises';
import {networkInterfaces} from 'node:os';
import {resolve,sep} from 'node:path';
import {WebSocketServer,WebSocket} from 'ws';
import QRCode from 'qrcode';
import type {RehearsalDesk} from './rehearsal-desk.js';
import type {XR18} from './xr18.js';
import {diagnostic} from './diagnostics.js';

export interface EarShare {id:string;name:string;bus:number;token:string;createdAt:string;stereo?:boolean}
export interface EarMixProfile {id:string;shareId:string;name:string;values:Record<string,number>;updatedAt:string}

/** Never louder than 0 dB on a send or on the monitor master, from a phone. */
export const EAR_CAP=.75;
/** A single move can raise a level by at most this much (about 3 to 6 dB): no sudden blast. */
export const EAR_MAX_RAISE=.15;
const pad=(n:number)=>String(n).padStart(2,'0');
export const EAR_SOURCES=[
 ...Array.from({length:16},(_,i)=>({prefix:`/ch/${pad(i+1)}`,label:`Entrée ${i+1}`,meters:[i]})),
 {prefix:'/rtn/aux',label:'Aux',meters:[16,17]},
 ...Array.from({length:4},(_,i)=>({prefix:`/rtn/${i+1}`,label:`Effet ${i+1}`,meters:[18+i*2,19+i*2]})),
];
/** Addresses a share may change, with the kind of check that applies. */
export function earAddressKind(bus:number,address:string,stereo=false):'level'|'mute'|'pan'|null{
 if(!Number.isInteger(bus)||bus<1||bus>6)return null;
 if(stereo&&bus%2===1&&EAR_SOURCES.some(s=>address===`${s.prefix}/mix/${pad(bus)}/pan`))return 'pan';
 if(address===`/bus/${bus}/mix/fader`)return 'level';
 if(address===`/bus/${bus}/mix/on`)return 'mute';
 return EAR_SOURCES.some(s=>address===`${s.prefix}/mix/${pad(bus)}/level`)?'level':null;
}
/** Applies the ceiling and the progressive-raise rule; lowering is always allowed. */
export function earSafeValue(kind:'level'|'mute'|'pan',value:unknown,current:number|undefined):number{
 if(typeof value!=='number'||!Number.isFinite(value))throw Error('Valeur invalide');
 if(kind==='pan'){if(value<0||value>1)throw Error('Panorama : 0 à 1');return value;}
 if(kind==='mute'){if(value!==0&&value!==1)throw Error('Mute : 0 ou 1');return value;}
 let v=Math.max(0,Math.min(EAR_CAP,value));
 if(typeof current==='number'&&v>current+EAR_MAX_RAISE)v=current+EAR_MAX_RAISE;
 return Math.round(v*10000)/10000;
}
export function lanAddresses(interfaces=safeInterfaces()){
 const list:string[]=[];
 for(const [name,addresses] of Object.entries(interfaces))for(const a of addresses??[]){
  if(a.family!=='IPv4'||a.internal||a.address.startsWith('169.254.'))continue;
  // Prefer real Wi-Fi/Ethernet over virtual adapters (VPN, Docker, VirtualBox).
  const virtual=/^(docker|veth|br-|vbox|vmnet|utun|tun|tap|zt|tailscale|virbr)/i.test(name);
  if(virtual)list.push(a.address);else list.unshift(a.address);
 }
 return [...new Set(list)];
}
function safeInterfaces(){try{return networkInterfaces();}catch{return {};}}

export class EarsShare {
 private db:Database.Database;
 private server?:http.Server;
 private wss?:WebSocketServer;
 private port=0;
 private recalling=new Set<string>();
 private shares=new Map<string,EarShare>();
 private manager:string|null=null;
 private managerRequests:number[]=[];
 private sockets=new Map<WebSocket,{share:EarShare;rate:number[];lastMeters:number}>();
 constructor(file:string,private xr:XR18,private webDist:()=>string|undefined,private guard:()=>string|null,private onWrite:()=>void=()=>{},private patch?:(bus:number,name:string,stereo:boolean)=>PersonalPatchInput[],private rehearsal?:RehearsalDesk){
  this.db=new Database(file);
  this.db.exec(`CREATE TABLE IF NOT EXISTS ear_sheet_sources(revision TEXT PRIMARY KEY);
  CREATE TABLE IF NOT EXISTS ear_shares(id TEXT PRIMARY KEY,name TEXT NOT NULL,bus INTEGER NOT NULL,token TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS ear_share_archive(id TEXT PRIMARY KEY,name TEXT NOT NULL,bus INTEGER NOT NULL,stereo INTEGER NOT NULL,created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS ear_mix_profiles(id TEXT PRIMARY KEY,share_id TEXT NOT NULL,name TEXT NOT NULL,values_json TEXT NOT NULL,updated_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS ear_rehearsal_manager(slot INTEGER PRIMARY KEY CHECK(slot=1),share_id TEXT NOT NULL)`);
  if(!(this.db.prepare('PRAGMA table_info(ear_shares)').all() as {name:string}[]).some(c=>c.name==='stereo'))this.db.exec('ALTER TABLE ear_shares ADD COLUMN stereo INTEGER NOT NULL DEFAULT 0');
  this.reload();
  const assigned=this.db.prepare('SELECT share_id AS id FROM ear_rehearsal_manager WHERE slot=1').get() as {id:string}|undefined;
  if(assigned&&this.list().some(s=>s.id===assigned.id))this.manager=assigned.id;
  xr.on('parameter',(state:{address:string;value:unknown;updatedAt:string})=>this.pushParameter(state));
  xr.on('meters',()=>this.pushMeters());
  xr.on('connection',()=>{for(const ws of this.sockets.keys())this.sendSnapshot(ws);});
  xr.on('reset',()=>{for(const ws of this.sockets.keys())this.sendSnapshot(ws);});
 }
 private reload(){
  this.shares.clear();
  for(const r of this.db.prepare('SELECT id,name,bus,token,created_at AS createdAt,stereo FROM ear_shares ORDER BY bus,name').all() as EarShare[])this.shares.set(r.token,{...r,stereo:!!r.stereo});
 }
 list(){return [...this.shares.values()].sort((a,b)=>a.bus-b.bus||a.name.localeCompare(b.name));}
 create(name:unknown,bus:unknown,stereo=false){
  if(typeof name!=='string'||!name.trim()||name.trim().length>40)throw Error('Nom du musicien : 1 à 40 caractères');
  if(typeof bus!=='number'||!Number.isInteger(bus)||bus<1||bus>this.xr.model().monitorOutputs)throw Error('Bus 1 à 6');
  if(stereo&&(!validStereoBus(bus,this.xr.model().monitorOutputs)||this.xr.parameterState()[busLinkAddress(bus)]?.value!==1))throw Error('Lie d’abord la paire de bus dans la console, puis crée le retour stéréo.');
  const share=this.insertShare(name.trim(),bus,stereo);
  this.reload();diagnostic('ears.share_created',{bus});return share;
 }
 private insertShare(name:string,bus:number,stereo:boolean,id:string=randomUUID()){
  const share:EarShare={id,name,bus,stereo,token:randomBytes(18).toString('base64url'),createdAt:new Date().toISOString()};
  this.db.prepare('INSERT INTO ear_shares(id,name,bus,token,created_at,stereo) VALUES(?,?,?,?,?,?)').run(share.id,share.name,share.bus,share.token,share.createdAt,stereo?1:0);
  return share;
 }
 async createStereo(name:unknown,bus:unknown){
  if(typeof bus!=='number'||!validStereoBus(bus,this.xr.model().monitorOutputs)||this.xr.model().family!=='xair')throw Error('Paire stéréo indisponible sur cette console');
  const epoch=this.xr.operationId();await this.xr.readParameter(busLinkAddress(bus));
  if(epoch!==this.xr.operationId())throw Error('Connexion modifiée');return this.create(name,bus,true);
 }
 /** Resolve the prepared musicians against physical outputs without changing audio or access. */
 async prepareRoster(musicians:ReadonlyArray<{bus:number;name:string}>,onlyBus?:number){
  const model=this.xr.model(),epoch=this.xr.operationId();
  if(model.family!=='xair')throw Error('Cette opération nécessite une console X-Air / M-Air.');
  const guards:Record<string,number>={},desired:{bus:number;name:string;stereo:boolean}[]=[];
  const scope=onlyBus===undefined?undefined:new Set([onlyBus]);
  const online=this.xr.mode==='simulation'||this.xr.status().connected;
  for(const m of musicians){
   if(onlyBus!==undefined&&busPairStart(onlyBus)!==busPairStart(m.bus))continue;
   if(!Number.isInteger(m.bus)||m.bus<1||m.bus>model.monitorOutputs)throw Error('Sortie de retour absente sur '+model.label);
   const first=busPairStart(m.bus),link=busLinkAddress(first);
   if(guards[link]===undefined){
    const cached=this.xr.parameterState()[link]?.value;
    const linked=online?await this.xr.readParameter(link):cached??Number(this.list().some(s=>s.bus===first&&s.stereo));
    if(this.xr.operationId()!==epoch)throw Error('Connexion modifiée');
    if(linked!==0&&linked!==1)throw Error('État de liaison stéréo inconnu');
    guards[link]=linked;
   }
   const stereo=guards[link]===1;
   if(scope&&!stereo&&m.bus!==onlyBus)continue;
   const bus=stereo?first:m.bus;
   if(desired.some(s=>s.bus===bus))throw Error('Deux musiciens occupent la même paire de retours stéréo. Vérifie leurs sorties.');
   if(scope&&stereo){scope.add(first);scope.add(first+1);}
   desired.push({bus,name:m.name.trim(),stereo});
  }
  return {guards,scope,commit:()=>this.replaceRoster(desired,scope)};
 }
 private replaceRoster(desired:{bus:number;name:string;stereo:boolean}[],scope?:Set<number>){
  const current=this.list(),retired=new Set(current.filter(s=>!scope||scope.has(s.bus)||(s.stereo&&scope.has(s.bus+1))));
  const missing=desired.filter(m=>{
   const match=current.find(s=>s.bus===m.bus&&s.name===m.name&&!!s.stereo===m.stereo);
   if(match)retired.delete(match);
   return !match;
  });
  this.db.transaction(()=>{
   for(const share of retired){
    // Keep personal presets with their owner, without keeping the old token valid.
    if(this.db.prepare('SELECT 1 FROM ear_mix_profiles WHERE share_id=? LIMIT 1').get(share.id))this.db.prepare('INSERT INTO ear_share_archive VALUES(?,?,?,?,?)').run(share.id,share.name,share.bus,Number(!!share.stereo),share.createdAt);
    this.db.prepare('DELETE FROM ear_shares WHERE id=?').run(share.id);
    this.db.prepare('DELETE FROM ear_rehearsal_manager WHERE share_id=?').run(share.id);
   }
   for(const m of missing){
    const old=this.db.prepare('SELECT id FROM ear_share_archive WHERE name=? AND bus=? AND stereo=? ORDER BY created_at DESC,rowid DESC LIMIT 1').get(m.name,m.bus,Number(m.stereo)) as {id:string}|undefined;
    this.insertShare(m.name,m.bus,m.stereo,old?.id);
    if(old)this.db.prepare('DELETE FROM ear_share_archive WHERE id=?').run(old.id);
   }
  })();
  this.reload();
  for(const share of retired){
   if(this.manager===share.id){this.manager=null;this.managerRequests=[];}
   this.disconnect(share.id);
  }
  return {created:missing.length,retired:retired.size};
 }
 private async checkShare(share:EarShare){
  const epoch=this.xr.operationId();
  if(this.shares.get(share.token)?.id!==share.id||share.bus>this.xr.model().monitorOutputs||this.xr.model().family!=='xair')throw Error('Retour indisponible sur cette console');
  if(share.stereo&&!validStereoBus(share.bus,this.xr.model().monitorOutputs))throw Error('Paire stéréo indisponible sur cette console');
  const linked=await this.xr.readParameter(busLinkAddress(share.bus));
  if(epoch!==this.xr.operationId())throw Error('Connexion modifiée');
  if(linked!==(share.stereo?1:0))throw Error('La liaison stéréo a changé. Demande un nouveau lien adapté à ce retour.');
  const blocked=this.guard();if(blocked)throw Error(blocked);
  if(this.shares.get(share.token)?.id!==share.id)throw Error('Lien invalide ou révoqué');
 }
 private setShared(share:EarShare,address:string,kind:'level'|'mute'|'pan',target:unknown){
  const state=this.xr.parameterState(),paired=share.stereo?pairedMonitorAddress(share.bus,address):null;
  const current=[state[address]?.value,...(paired?[state[paired]?.value]:[])].filter((v):v is number=>typeof v==='number');
  if(current.length!==(paired?2:1))throw Error('Réglage non reçu : relire le retour');
  const value=earSafeValue(kind,target,Math.min(...current));
  this.xr.liveSet(address,value);if(paired)this.xr.liveSet(paired,value);return value;
 }
 assignManager(id:unknown){
  if(id!==null&&(typeof id!=='string'||!this.list().some(s=>s.id===id)))throw Error('Musicien introuvable');
  if(id===this.manager)return;
  if(id===null)this.db.prepare('DELETE FROM ear_rehearsal_manager WHERE slot=1').run();
  else this.db.prepare('INSERT INTO ear_rehearsal_manager VALUES(1,?) ON CONFLICT(slot) DO UPDATE SET share_id=excluded.share_id').run(id);
  this.manager=id;this.managerRequests=[];
  for(const [ws,c] of this.sockets)if(ws.readyState===WebSocket.OPEN){
   ws.send(JSON.stringify({type:'rehearsal-role',enabled:c.share.id===id}));
  }
 }
 /** New link; the old QR code stops working immediately (lost phone, musician left). */
 regenerate(id:string){
  const old=this.list().find(s=>s.id===id);if(!old)throw Error('Musicien introuvable');
  const token=randomBytes(18).toString('base64url');
  this.db.prepare('UPDATE ear_shares SET token=? WHERE id=?').run(token,id);this.reload();this.disconnect(id);return this.list().find(s=>s.id===id)!;
 }
 remove(id:string){
  if(this.manager===id)this.assignManager(null);
  const changes=this.db.prepare('DELETE FROM ear_shares WHERE id=?').run(id).changes;
  this.db.prepare('DELETE FROM ear_mix_profiles WHERE share_id=?').run(id);
  this.reload();this.disconnect(id);if(!changes)throw Error('Musicien introuvable');
 }
 private disconnect(id:string){for(const [ws,s] of this.sockets)if(s.share.id===id){ws.close(4001,'Lien révoqué');this.sockets.delete(ws);}}
 status(){
  const addresses=lanAddresses();
  return {running:!!this.server?.listening,port:this.port,addresses,clients:this.sockets.size,managerId:this.manager,
   shares:this.list().map(s=>({...s,url:addresses[0]&&this.port?`http://${addresses[0]}:${this.port}/ears/${s.token}`:null,connected:[...this.sockets.values()].filter(c=>c.share.id===s.id).length}))};
 }
 async qr(id:string,host?:string){
  const share=this.list().find(s=>s.id===id);if(!share)throw Error('Musicien introuvable');
  const address=host&&lanAddresses().includes(host)?host:lanAddresses()[0];
  if(!address||!this.port)throw Error('Partage arrêté ou aucun réseau local');
  const url=`http://${address}:${this.port}/ears/${share.token}`;
  return {url,svg:await QRCode.toString(url,{type:'svg',margin:1,errorCorrectionLevel:'M',color:{dark:'#0b0d10',light:'#ffffff'}})};
 }
 async start(port=Number(process.env.XR18_EARS_PORT??8018)){
  if(this.server?.listening)return this.status();
  const server=http.createServer((req,res)=>{void this.handle(req,res);});
  const wss=new WebSocketServer({noServer:true,maxPayload:1024});
  server.on('upgrade',(req,socket,head)=>{
   const url=new URL(req.url??'/','http://x');const share=this.shares.get(url.searchParams.get('token')??'');
   if(url.pathname!=='/ears-ws'||!share){socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');socket.destroy();return;}
   wss.handleUpgrade(req,socket,head,ws=>this.attach(ws,share));
  });
  const listen=(p:number)=>new Promise<number>((ok,fail)=>{server.once('error',fail);server.listen(p,'0.0.0.0',()=>{server.off('error',fail);const a=server.address();ok(typeof a==='object'&&a?a.port:p);});});
  try{this.port=await listen(port);}catch{this.port=await listen(0);}
  this.server=server;this.wss=wss;
  if(Object.keys(this.xr.parameterState()).length<2000)void this.xr.syncLiveView().catch(()=>{});
  diagnostic('ears.started',{port:this.port});
  return this.status();
 }
 async stop(){
  for(const ws of this.sockets.keys())ws.close(4000,'Partage arrêté');
  this.sockets.clear();this.wss?.close();
  const server=this.server;this.server=undefined;this.wss=undefined;this.port=0;
  if(server)await new Promise<void>(r=>server.close(()=>r()));
  diagnostic('ears.stopped');return this.status();
 }
 close(){void this.stop();this.db.close();}

 // ---------- HTTP (LAN): only the ears page, its assets and the per-token API ----------
 private async handle(req:http.IncomingMessage,res:http.ServerResponse){
  const url=new URL(req.url??'/','http://x'),path=url.pathname;
  res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('Referrer-Policy','no-referrer');
  try{
   const sheet=/^\/ears-api\/([A-Za-z0-9_-]{20,40})\/sheet$/.exec(path);
   if(sheet&&this.rehearsal)return await this.handleSheet(req,res,url,sheet[1]!,this.rehearsal);
   const desk=/^\/ears-api\/([A-Za-z0-9_-]{20,40})\/rehearsal\/(state|command|configured-inputs)$/.exec(path);
   if(desk&&this.rehearsal)return await this.handleRehearsal(req,res,url,desk[1]!,desk[2]!,this.rehearsal);
   const page=/^\/ears\/([A-Za-z0-9_-]{20,40})$/.exec(path);
   if(req.method==='GET'&&page)return await this.serveFile(req,res,'ears.html',!!this.shares.get(page[1]!));
   if(req.method==='GET'&&/^\/assets\/[A-Za-z0-9._-]+$/.test(path))return await this.serveFile(req,res,path.slice(1),true);
   const api=/^\/ears-api\/([A-Za-z0-9_-]{20,40})\/(profiles)(?:\/([a-f0-9-]{36})(?:\/(recall))?)?$/.exec(path);
   const share=api?this.shares.get(api[1]!):undefined;
   if(api&&!share){res.writeHead(401,{'Content-Type':'application/json'});res.end('{"error":"Lien invalide ou révoqué"}');return;}
   if(api&&share){
    res.setHeader('Content-Type','application/json; charset=utf-8');
    if(req.method==='GET'&&!api[3]){res.end(JSON.stringify(this.profiles(share.id)));return;}
    if(req.method==='POST'&&!api[3]){const body=await readBody(req);res.end(JSON.stringify(this.saveProfile(share,body.name)));return;}
    if(req.method==='POST'&&api[4]==='recall'){res.end(JSON.stringify(await this.recallProfile(share,api[3]!)));return;}
    if(req.method==='DELETE'&&api[3]&&!api[4]){const gone=this.db.prepare('DELETE FROM ear_mix_profiles WHERE id=? AND share_id=?').run(api[3],share.id).changes;diagnostic('ears.profile_deleted',{bus:share.bus,deleted:gone});res.end(JSON.stringify({ok:true,deleted:gone}));return;}
   }
   res.writeHead(404,{'Content-Type':'text/plain; charset=utf-8'});res.end('Introuvable');
  }catch(e){if(!res.headersSent)res.writeHead(400,{'Content-Type':'application/json'});res.end(JSON.stringify({error:(e as Error).message}));}
 }
 private async handleSheet(req:http.IncomingMessage,res:http.ServerResponse,url:URL,token:string,desk:RehearsalDesk){
  const send=(code:number,data:unknown)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8'});res.end(JSON.stringify(data));};
  const share=this.shares.get(token);
  if(!share){send(403,{});return;}
  const received=performance.now();
  const approve=req.method==='POST';
  if(req.method!=='GET'&&!approve){send(405,{});return;}
  if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){send(403,{});return;}
  const manager=()=>this.manager===share.id;
  if(approve&&(!manager()||req.headers['content-type']?.split(';')[0]!=='application/json')){send(403,{});return;}
  const body=approve?await readBody(req):null;
  const preview=manager()&&url.searchParams.get('preview')==='1';
  const frame=await desk.sheet(url.searchParams.get('known'),preview||approve,key=>!!this.db.prepare('SELECT 1 FROM ear_sheet_sources WHERE revision=?').get(key));
  if(this.shares.get(token)?.id!==share.id||((approve||preview)&&!manager())){send(403,{});return;}
  if(approve){
   if(!frame||body?.project!==frame.project||body?.revision!==frame.revision){send(409,{});return;}
   const key=frame.revision.split('.')[0];
   if(body.reset===true&&frame.sourceApproved)this.db.prepare('DELETE FROM ear_sheet_sources WHERE revision=?').run(key);
   else if(!body.reset&&frame.preview)this.db.prepare('INSERT OR IGNORE INTO ear_sheet_sources(revision) VALUES(?)').run(key);
   else{send(409,{});return;}
  }
  send(200,frame&&{...frame,sentAt:Date.now(),serverMs:performance.now()-received});
 }
 private async handleRehearsal(req:http.IncomingMessage,res:http.ServerResponse,url:URL,token:string,route:string,desk:RehearsalDesk){
  res.setHeader('Content-Type','application/json; charset=utf-8');
  const send=(status:number,result:unknown)=>{res.writeHead(status);res.end(JSON.stringify(result));};
  const allowed=()=>!!this.manager&&this.shares.get(token)?.id===this.manager;
  const revoked=()=>send(403,{error:'Le rôle de gestionnaire a changé.'});
  if(!allowed()){revoked();return;}
  if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`){send(403,{error:'Origine refusée'});return;}
  const now=Date.now();
  this.managerRequests=this.managerRequests.filter(t=>now-t<1000);
  if(this.managerRequests.length>=12){send(429,{error:'Une commande de répétition est déjà en cours.'});return;}
  this.managerRequests.push(now);
  if(req.method==='GET'&&(route==='state'||route==='configured-inputs')){
   const state=route==='configured-inputs'?await desk.configuredInputs():await desk.state(url.searchParams.get('project')??undefined,false,url.searchParams.get('known')??undefined);
   if(!allowed()){revoked();return;}
   send(200,state);return;
  }
  if(req.method==='POST'&&route==='command'){
   if(req.headers['content-type']?.split(';')[0]!=='application/json'){send(415,{error:'Objet JSON requis'});return;}
   const body=await readBody(req);
   if(!allowed()){revoked();return;}
   const state=await desk.command(body);
   if(!allowed()){revoked();return;}
   send(200,state);return;
  }
  send(405,{error:'Méthode non autorisée'});
 }
 private async serveFile(req:http.IncomingMessage,res:http.ServerResponse,file:string,valid:boolean){
  const dist=this.webDist();
  if(!valid){res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><meta name="viewport" content="width=device-width"><body style="background:#0b0d10;color:#e8ecf1;font-family:system-ui;padding:32px"><h1>Lien expiré</h1><p>Ce QR code n’est plus valable. Demande un nouveau lien à la personne qui gère la console.</p>');return;}
  if(!dist){res.writeHead(503);res.end('Interface indisponible');return;}
  const root=resolve(dist),target=resolve(root,file);
  if(!target.startsWith(root+sep)||!(await stat(target).catch(()=>null))?.isFile()){res.writeHead(404);res.end();return;}
  res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; media-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; frame-ancestors 'none'");
  await sendWebAsset(req,res,target,"/"+file);
 }

 // ---------- profiles ----------
 profiles(shareId:string):EarMixProfile[]{
  return (this.db.prepare('SELECT id,share_id AS shareId,name,values_json,updated_at AS updatedAt FROM ear_mix_profiles WHERE share_id=? ORDER BY updated_at DESC').all(shareId) as (Omit<EarMixProfile,'values'>&{values_json:string})[]).map(({values_json,...r})=>({...r,values:JSON.parse(values_json)}));
 }
 private saveProfile(share:EarShare,name:unknown){
  if(this.shares.get(share.token)?.id!==share.id)throw Error('Lien invalide ou révoqué');
  if(typeof name!=='string'||!name.trim()||name.trim().length>40)throw Error('Nom du profil : 1 à 40 caractères');
  if(this.profiles(share.id).length>=20)throw Error('20 profils maximum');
  const state=this.xr.parameterState(),values:Record<string,number>={};
  for(const a of this.allowed(share.bus,!!share.stereo)){const v=state[a]?.value;if(typeof v==='number')values[a]=v;}
  const existing=this.profiles(share.id).find(p=>p.name.toLowerCase()===name.trim().toLowerCase());
  const id=existing?.id??randomUUID();
  this.db.prepare('INSERT INTO ear_mix_profiles VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET values_json=excluded.values_json,updated_at=excluded.updated_at').run(id,share.id,name.trim(),JSON.stringify(values),new Date().toISOString());
  return this.profiles(share.id).find(p=>p.id===id)!;
 }
 /** Smooth recall over ~1 s, still capped: a profile can never exceed today's limits. */
 private async recallProfile(share:EarShare,id:string){
  const profile=this.profiles(share.id).find(p=>p.id===id);if(!profile)throw Error('Profil introuvable');
  if(this.recalling.has(share.id))throw Error('Rappel en cours');
  await this.checkShare(share);const epoch=this.xr.operationId();
  if(this.recalling.has(share.id))throw Error('Rappel en cours');this.recalling.add(share.id);
  try{
   const state=this.xr.parameterState(),start:Record<string,number>={};
   for(const a of Object.keys(profile.values)){if(!earAddressKind(share.bus,a,!!share.stereo)||!this.xr.supports(a))delete profile.values[a];else{const v=state[a]?.value;if(typeof v!=='number')throw Error('Réglage non reçu : relire le retour');start[a]=v;}}
   this.onWrite();
   for(let step=1;step<=10;step++){
    await this.checkShare(share);if(epoch!==this.xr.operationId())throw Error('Rappel interrompu');
    for(const [a,target] of Object.entries(profile.values)){
     const kind=earAddressKind(share.bus,a,!!share.stereo)!;
     const goal=earSafeValue(kind,target,undefined),value=kind==='mute'?(step===10?goal:start[a]!):start[a]!+(goal-start[a]!)*step/10;
     this.setShared(share,a,kind,value);
    }
    await new Promise(r=>setTimeout(r,100));
   }
  }finally{this.recalling.delete(share.id);}
  return {ok:true};
 }

 // ---------- live (WebSocket) ----------
 private sources(){return EAR_SOURCES.filter(s=>this.xr.supports(`${s.prefix}/mix/01/level`));}
 private allowed(bus:number,stereo=false){return [`/bus/${bus}/mix/fader`,`/bus/${bus}/mix/on`,...this.sources().flatMap(s=>[`${s.prefix}/mix/${pad(bus)}/level`,...(stereo?[`${s.prefix}/mix/${pad(bus)}/pan`]:[])])];}
 private visible(bus:number,stereo=false){
  const extra=[`/bus/${bus}/config/name`,`/bus/${bus}/config/color`,...this.sources().flatMap(s=>[`${s.prefix}/config/name`,`${s.prefix}/config/color`,`${s.prefix}/mix/on`])];
  return new Set([...this.allowed(bus,stereo),...extra]);
 }
 private attach(ws:WebSocket,share:EarShare){
  this.sockets.set(ws,{share,rate:[],lastMeters:0});
  this.sendSnapshot(ws);
  let queue=Promise.resolve();ws.on('message',raw=>{queue=queue.then(()=>this.onMessage(ws,raw as Buffer)).catch(()=>{});});
  ws.on('close',()=>this.sockets.delete(ws));
  ws.on('error',()=>this.sockets.delete(ws));
 }
 refreshTechnicalCards(){
  for(const [ws,{share}] of this.sockets)if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify({type:"technical-card",patch:this.patch?.(share.bus,share.name,!!share.stereo)??[]}));
 }
 private sendSnapshot(ws:WebSocket){
  const c=this.sockets.get(ws);if(!c||ws.readyState!==WebSocket.OPEN)return;
  // Re-read the share: the token may have been regenerated or removed meanwhile.
  const share=this.list().find(s=>s.id===c.share.id);if(!share||share.bus>this.xr.model().monitorOutputs||this.xr.model().family!=='xair'){ws.close(4001,'Lien indisponible sur cette console');return;}
  const state=this.xr.parameterState(),values:Record<string,unknown>={};
  for(const a of this.visible(share.bus,!!share.stereo))if(state[a])values[a]=state[a]!.value;
  const st=this.xr.status();
  ws.send(JSON.stringify({type:'snapshot',share:{name:share.name,bus:share.bus,stereo:!!share.stereo},rehearsal:share.id===this.manager,cap:EAR_CAP,sources:this.sources(),values,patch:this.patch?.(share.bus,share.name,!!share.stereo)??[],
   control:(share.stereo?state[busLinkAddress(share.bus)]?.value===1:state[busLinkAddress(share.bus)]?.value!==1)&&(st.mode==='simulation'||(st.connected&&st.writesEnabled)),mode:st.mode}));
 }
 private async onMessage(ws:WebSocket,raw:Buffer){
  const c=this.sockets.get(ws);if(!c)return;
  const now=Date.now();c.rate=c.rate.filter(t=>now-t<1000);c.rate.push(now);
  if(c.rate.length>60)return; // ~60 moves per second is far more than a finger needs.
  let m:{type?:unknown;address?:unknown;value?:unknown};try{m=JSON.parse(raw.toString('utf8'));}catch{return;}
  if(m.type!=='set'||typeof m.address!=='string')return;
  const reply=(data:unknown)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));};
  try{
   if(c.share.bus>this.xr.model().monitorOutputs||this.xr.model().family!=='xair')throw Error('Retour indisponible sur cette console');
   const kind=earAddressKind(c.share.bus,m.address,!!c.share.stereo);if(!kind||!this.xr.supports(m.address))throw Error('Réglage non autorisé pour ton retour');
   await this.checkShare(c.share);if(this.recalling.has(c.share.id))throw Error('Rappel en cours');
   this.onWrite();const value=this.setShared(c.share,m.address,kind,m.value);
   if(value!==m.value)reply({type:'adjusted',address:m.address,value});
  }catch(e){reply({type:'error',address:m.address,error:(e as Error).message});}
 }
 private pushParameter(state:{address:string;value:unknown}){
  if(state.address.startsWith('/config/buslink/'))for(const ws of this.sockets.keys())this.sendSnapshot(ws);
  for(const [ws,c] of this.sockets)if(ws.readyState===WebSocket.OPEN&&this.visible(c.share.bus,!!c.share.stereo).has(state.address))ws.send(JSON.stringify({type:'parameter',address:state.address,value:state.value}));
 }
 private pushMeters(){
  const m=this.xr.meterState();if(!m.available)return;const now=Date.now();
  for(const [ws,c] of this.sockets){
   if(ws.readyState!==WebSocket.OPEN||now-c.lastMeters<100)continue; // 10 fps: enough, and easy on phone batteries
   c.lastMeters=now;
   ws.send(JSON.stringify({type:'meters',levels:m.all.slice(0,26),bus:m.all[25+c.share.bus]??-128,busRight:c.share.stereo?m.all[26+c.share.bus]??-128:undefined}));
  }
 }
}
async function readBody(req:http.IncomingMessage){
 let raw='';for await(const part of req){raw+=part;if(raw.length>2048)throw Error('Requête trop longue');}
 const d=raw?JSON.parse(raw):{};if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Requête invalide');return d as Record<string,unknown>;
}
