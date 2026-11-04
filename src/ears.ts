// Partage des retours sur le réseau local : chaque musicien ouvre SON mix par un lien
// personnel (QR code). Le lien ne donne accès qu'aux envois de son bus, au volume et au
// mute de son retour, et à ses profils. La console complète reste sur l'ordinateur.
import Database from 'better-sqlite3';
import http from 'node:http';
import {randomBytes,randomUUID} from 'node:crypto';
import {readFile,stat} from 'node:fs/promises';
import {networkInterfaces} from 'node:os';
import {extname,resolve,sep} from 'node:path';
import {WebSocketServer,WebSocket} from 'ws';
import QRCode from 'qrcode';
import type {XR18} from './xr18.js';
import {diagnostic} from './diagnostics.js';

export interface EarShare {id:string;name:string;bus:number;token:string;createdAt:string}
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
export function earAddressKind(bus:number,address:string):'level'|'mute'|null{
 if(!Number.isInteger(bus)||bus<1||bus>6)return null;
 if(address===`/bus/${bus}/mix/fader`)return 'level';
 if(address===`/bus/${bus}/mix/on`)return 'mute';
 return EAR_SOURCES.some(s=>address===`${s.prefix}/mix/${pad(bus)}/level`)?'level':null;
}
/** Applies the ceiling and the progressive-raise rule; lowering is always allowed. */
export function earSafeValue(kind:'level'|'mute',value:unknown,current:number|undefined):number{
 if(typeof value!=='number'||!Number.isFinite(value))throw Error('Valeur invalide');
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
 private shares=new Map<string,EarShare>();
 private sockets=new Map<WebSocket,{share:EarShare;rate:number[];lastMeters:number}>();
 constructor(file:string,private xr:XR18,private webDist:()=>string|undefined,private guard:()=>string|null,private onWrite:()=>void){
  this.db=new Database(file);
  this.db.exec(`CREATE TABLE IF NOT EXISTS ear_shares(id TEXT PRIMARY KEY,name TEXT NOT NULL,bus INTEGER NOT NULL,token TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS ear_mix_profiles(id TEXT PRIMARY KEY,share_id TEXT NOT NULL,name TEXT NOT NULL,values_json TEXT NOT NULL,updated_at TEXT NOT NULL)`);
  this.reload();
  xr.on('parameter',(state:{address:string;value:unknown;updatedAt:string})=>this.pushParameter(state));
  xr.on('meters',()=>this.pushMeters());
  xr.on('connection',()=>{for(const ws of this.sockets.keys())this.sendSnapshot(ws);});
  xr.on('reset',()=>{for(const ws of this.sockets.keys())this.sendSnapshot(ws);});
 }
 private reload(){
  this.shares.clear();
  for(const r of this.db.prepare('SELECT id,name,bus,token,created_at AS createdAt FROM ear_shares ORDER BY bus,name').all() as EarShare[])this.shares.set(r.token,r);
 }
 list(){return [...this.shares.values()].sort((a,b)=>a.bus-b.bus||a.name.localeCompare(b.name));}
 create(name:unknown,bus:unknown){
  if(typeof name!=='string'||!name.trim()||name.trim().length>40)throw Error('Nom du musicien : 1 à 40 caractères');
  if(typeof bus!=='number'||!Number.isInteger(bus)||bus<1||bus>this.xr.model().monitorOutputs)throw Error('Bus 1 à 6');
  const share:EarShare={id:randomUUID(),name:name.trim(),bus,token:randomBytes(18).toString('base64url'),createdAt:new Date().toISOString()};
  this.db.prepare('INSERT INTO ear_shares VALUES(?,?,?,?,?)').run(share.id,share.name,share.bus,share.token,share.createdAt);
  this.reload();diagnostic('ears.share_created',{bus});return share;
 }
 /** New link; the old QR code stops working immediately (lost phone, musician left). */
 regenerate(id:string){
  const old=this.list().find(s=>s.id===id);if(!old)throw Error('Musicien introuvable');
  const token=randomBytes(18).toString('base64url');
  this.db.prepare('UPDATE ear_shares SET token=? WHERE id=?').run(token,id);this.reload();this.disconnect(id);return this.list().find(s=>s.id===id)!;
 }
 remove(id:string){
  const changes=this.db.prepare('DELETE FROM ear_shares WHERE id=?').run(id).changes;
  this.db.prepare('DELETE FROM ear_mix_profiles WHERE share_id=?').run(id);
  this.reload();this.disconnect(id);if(!changes)throw Error('Musicien introuvable');
 }
 private disconnect(id:string){for(const [ws,s] of this.sockets)if(s.share.id===id){ws.close(4001,'Lien révoqué');this.sockets.delete(ws);}}
 status(){
  const addresses=lanAddresses();
  return {running:!!this.server?.listening,port:this.port,addresses,clients:this.sockets.size,
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
   const page=/^\/ears\/([A-Za-z0-9_-]{20,40})$/.exec(path);
   if(req.method==='GET'&&page)return this.serveFile(res,'ears.html',!!this.shares.get(page[1]!));
   if(req.method==='GET'&&/^\/assets\/[A-Za-z0-9._-]+$/.test(path))return this.serveFile(res,path.slice(1),true);
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
 private async serveFile(res:http.ServerResponse,file:string,valid:boolean){
  const dist=this.webDist();
  if(!valid){res.writeHead(404,{'Content-Type':'text/html; charset=utf-8'});res.end('<!doctype html><meta name="viewport" content="width=device-width"><body style="background:#0b0d10;color:#e8ecf1;font-family:system-ui;padding:32px"><h1>Lien expiré</h1><p>Ce QR code n’est plus valable. Demande un nouveau lien à la personne qui gère la console.</p>');return;}
  if(!dist){res.writeHead(503);res.end('Interface indisponible');return;}
  const root=resolve(dist),target=resolve(root,file);
  if(!target.startsWith(root+sep)||!(await stat(target).catch(()=>null))?.isFile()){res.writeHead(404);res.end();return;}
  const mime:Record<string,string>={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2'};
  res.setHeader('Content-Type',mime[extname(target)]??'application/octet-stream');
  res.setHeader('Content-Security-Policy',"default-src 'self'; connect-src 'self' ws: wss:; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; object-src 'none'; frame-ancestors 'none'");
  res.end(await readFile(target));
 }

 // ---------- profiles ----------
 profiles(shareId:string):EarMixProfile[]{
  return (this.db.prepare('SELECT id,share_id AS shareId,name,values_json,updated_at AS updatedAt FROM ear_mix_profiles WHERE share_id=? ORDER BY updated_at DESC').all(shareId) as (Omit<EarMixProfile,'values'>&{values_json:string})[]).map(({values_json,...r})=>({...r,values:JSON.parse(values_json)}));
 }
 private saveProfile(share:EarShare,name:unknown){
  if(typeof name!=='string'||!name.trim()||name.trim().length>40)throw Error('Nom du profil : 1 à 40 caractères');
  if(this.profiles(share.id).length>=20)throw Error('20 profils maximum');
  const state=this.xr.parameterState(),values:Record<string,number>={};
  for(const a of this.allowed(share.bus)){const v=state[a]?.value;if(typeof v==='number')values[a]=v;}
  const existing=this.profiles(share.id).find(p=>p.name.toLowerCase()===name.trim().toLowerCase());
  const id=existing?.id??randomUUID();
  this.db.prepare('INSERT INTO ear_mix_profiles VALUES(?,?,?,?,?) ON CONFLICT(id) DO UPDATE SET values_json=excluded.values_json,updated_at=excluded.updated_at').run(id,share.id,name.trim(),JSON.stringify(values),new Date().toISOString());
  return this.profiles(share.id).find(p=>p.id===id)!;
 }
 /** Smooth recall over ~1 s, still capped: a profile can never exceed today's limits. */
 private async recallProfile(share:EarShare,id:string){
  const profile=this.profiles(share.id).find(p=>p.id===id);if(!profile)throw Error('Profil introuvable');
  const blocked=this.guard();if(blocked)throw Error(blocked);
  const state=this.xr.parameterState(),start:Record<string,number>={};
  for(const a of Object.keys(profile.values)){if(!earAddressKind(share.bus,a)||!this.xr.supports(a))delete profile.values[a];else start[a]=typeof state[a]?.value==='number'?state[a]!.value as number:0;}
  this.onWrite();
  for(let step=1;step<=10;step++){
   for(const [a,target] of Object.entries(profile.values)){
    const kind=earAddressKind(share.bus,a)!;
    const v=kind==='mute'?(step===10?target:start[a]!):start[a]!+(Math.min(EAR_CAP,target)-start[a]!)*step/10;
    this.xr.liveSet(a,kind==='mute'?v:Math.round(Math.min(EAR_CAP,v)*10000)/10000);
   }
   await new Promise(r=>setTimeout(r,100));
  }
  return {ok:true};
 }

 // ---------- live (WebSocket) ----------
 private sources(){return EAR_SOURCES.filter(s=>this.xr.supports(`${s.prefix}/mix/01/level`));}
 private allowed(bus:number){return [`/bus/${bus}/mix/fader`,`/bus/${bus}/mix/on`,...this.sources().map(s=>`${s.prefix}/mix/${pad(bus)}/level`)];}
 private visible(bus:number){
  const extra=[`/bus/${bus}/config/name`,`/bus/${bus}/config/color`,...this.sources().flatMap(s=>[`${s.prefix}/config/name`,`${s.prefix}/config/color`,`${s.prefix}/mix/on`])];
  return new Set([...this.allowed(bus),...extra]);
 }
 private attach(ws:WebSocket,share:EarShare){
  this.sockets.set(ws,{share,rate:[],lastMeters:0});
  this.sendSnapshot(ws);
  ws.on('message',raw=>this.onMessage(ws,raw as Buffer));
  ws.on('close',()=>this.sockets.delete(ws));
  ws.on('error',()=>this.sockets.delete(ws));
 }
 private sendSnapshot(ws:WebSocket){
  const c=this.sockets.get(ws);if(!c||ws.readyState!==WebSocket.OPEN)return;
  // Re-read the share: the token may have been regenerated or removed meanwhile.
  const share=this.list().find(s=>s.id===c.share.id);if(!share||share.bus>this.xr.model().monitorOutputs||this.xr.model().family!=='xair'){ws.close(4001,'Lien indisponible sur cette console');return;}
  const state=this.xr.parameterState(),values:Record<string,unknown>={};
  for(const a of this.visible(share.bus))if(state[a])values[a]=state[a]!.value;
  const st=this.xr.status();
  ws.send(JSON.stringify({type:'snapshot',share:{name:share.name,bus:share.bus},cap:EAR_CAP,sources:this.sources(),values,
   control:st.mode==='simulation'||(st.connected&&st.writesEnabled),mode:st.mode}));
 }
 private onMessage(ws:WebSocket,raw:Buffer){
  const c=this.sockets.get(ws);if(!c)return;
  const now=Date.now();c.rate=c.rate.filter(t=>now-t<1000);c.rate.push(now);
  if(c.rate.length>60)return; // ~60 moves per second is far more than a finger needs.
  let m:{type?:unknown;address?:unknown;value?:unknown};try{m=JSON.parse(raw.toString('utf8'));}catch{return;}
  if(m.type!=='set'||typeof m.address!=='string')return;
  const reply=(data:unknown)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));};
  try{
   if(c.share.bus>this.xr.model().monitorOutputs||this.xr.model().family!=='xair')throw Error('Retour indisponible sur cette console');
   const kind=earAddressKind(c.share.bus,m.address);if(!kind)throw Error('Réglage non autorisé pour ton retour');
   const blocked=this.guard();if(blocked)throw Error(blocked);
   const current=this.xr.parameterState()[m.address]?.value;
   const value=earSafeValue(kind,m.value,typeof current==='number'?current:undefined);
   this.onWrite();this.xr.liveSet(m.address,value);
   if(value!==m.value)reply({type:'adjusted',address:m.address,value});
  }catch(e){reply({type:'error',address:m.address,error:(e as Error).message});}
 }
 private pushParameter(state:{address:string;value:unknown}){
  for(const [ws,c] of this.sockets)if(ws.readyState===WebSocket.OPEN&&this.visible(c.share.bus).has(state.address))ws.send(JSON.stringify({type:'parameter',address:state.address,value:state.value}));
 }
 private pushMeters(){
  const m=this.xr.meterState();if(!m.available)return;const now=Date.now();
  for(const [ws,c] of this.sockets){
   if(ws.readyState!==WebSocket.OPEN||now-c.lastMeters<100)continue; // 10 fps: enough, and easy on phone batteries
   c.lastMeters=now;
   ws.send(JSON.stringify({type:'meters',levels:m.all.slice(0,26),bus:m.all[25+c.share.bus]??-128}));
  }
 }
}
async function readBody(req:http.IncomingMessage){
 let raw='';for await(const part of req){raw+=part;if(raw.length>2048)throw Error('Requête trop longue');}
 const d=raw?JSON.parse(raw):{};if(!d||typeof d!=='object'||Array.isArray(d))throw Error('Requête invalide');return d as Record<string,unknown>;
}
