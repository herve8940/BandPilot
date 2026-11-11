import {networkInterfaces} from 'node:os';
import Database from 'better-sqlite3';
import { randomBytes, randomUUID, scryptSync, timingSafeEqual, createHash } from 'node:crypto';
import type { IncomingMessage } from 'node:http';
export type Role='admin'|'musician'|'guest';
export type User={id:string;name:string;role:Role;buses:number[]};
export class Access {
 private db:Database.Database;
 private attempts=new Map<string,{count:number;until:number}>();
 constructor(filename:string){this.db=new Database(filename);this.db.exec(`CREATE TABLE IF NOT EXISTS users(id TEXT PRIMARY KEY,name TEXT UNIQUE NOT NULL,role TEXT NOT NULL,buses TEXT NOT NULL,salt TEXT NOT NULL,hash TEXT NOT NULL); CREATE TABLE IF NOT EXISTS sessions(token TEXT PRIMARY KEY,user_id TEXT NOT NULL,expires INTEGER NOT NULL); CREATE TABLE IF NOT EXISTS audit(id INTEGER PRIMARY KEY,at TEXT NOT NULL,user_id TEXT NOT NULL,action TEXT NOT NULL);`);}
 enabled(){return Number((this.db.prepare('SELECT COUNT(*) AS n FROM users').get() as {n:number}).n)>0;}
 list():User[]{return (this.db.prepare('SELECT id,name,role,buses FROM users').all() as (Omit<User,'buses'>&{buses:string})[]).map(u=>({...u,buses:JSON.parse(u.buses)}));}
 create(name:unknown,password:unknown,role:unknown,buses:unknown):User{
  if(typeof name!=='string'||!name.trim()||name.length>80||typeof password!=='string'||password.length<12||password.length>200||!['admin','musician','guest'].includes(String(role))||!Array.isArray(buses)||buses.some(b=>!Number.isInteger(b)||b<1||b>6))throw Error('Nom, mot de passe de 12 à 200 caractères, rôle et bus 1..6 requis');
  const user:User={id:randomUUID(),name:name.trim(),role:role as Role,buses:[...new Set(buses)]};const salt=randomBytes(16).toString('hex');
  this.db.prepare('INSERT INTO users VALUES(?,?,?,?,?,?)').run(user.id,user.name,user.role,JSON.stringify(user.buses),salt,scryptSync(password,salt,64).toString('hex'));return user;
 }
 login(name:unknown,password:unknown){
  if(typeof name!=='string'||typeof password!=='string'||name.length>80||password.length>200)throw Error('Identifiants invalides');
  const key=name.trim();const now=Date.now();const a=this.attempts.get(key);if(a&&a.until>now&&a.count>=5)throw Error('Trop de tentatives ; réessayer dans 5 minutes');
  const row=this.db.prepare('SELECT * FROM users WHERE name=?').get(key) as {id:string;salt:string;hash:string}|undefined;
  const computed=scryptSync(password,row?.salt??'invalid-user',64);if(!row||!timingSafeEqual(computed,Buffer.from(row.hash,'hex'))){if(this.attempts.size>1000)this.attempts.clear();this.attempts.set(key,{count:a&&a.until>now?a.count+1:1,until:now+300000});throw Error('Identifiants invalides');}
  this.attempts.delete(key);const token=randomBytes(32).toString('hex');this.db.prepare('DELETE FROM sessions WHERE expires<?').run(now);this.db.prepare('INSERT INTO sessions VALUES(?,?,?)').run(this.digest(token),row.id,now+12*3600000);return token;
 }
 private digest(token:string){return createHash('sha256').update(token).digest('hex');}
 token(req:IncomingMessage){return /(?:^|;\s*)xr18_session=([a-f0-9]{64})(?:;|$)/.exec(req.headers.cookie??'')?.[1];}
 user(req:IncomingMessage):User|null{if(!this.enabled())return {id:'local',name:'Session locale',role:'admin',buses:[]};const token=this.token(req);if(!token)return null;const session=this.db.prepare('SELECT user_id FROM sessions WHERE token=? AND expires>?').get(this.digest(token),Date.now()) as {user_id:string}|undefined;return session?this.list().find(u=>u.id===session.user_id)??null:null;}
 logout(req:IncomingMessage){const token=this.token(req);if(token)this.db.prepare('DELETE FROM sessions WHERE token=?').run(this.digest(token));}
 log(user:User,action:string){this.db.prepare('INSERT INTO audit(at,user_id,action) VALUES(?,?,?)').run(new Date().toISOString(),user.id,action);}
 audit(){return this.db.prepare('SELECT * FROM audit ORDER BY id DESC LIMIT 200').all();}
 update(id:string,role:unknown,buses:unknown,password?:unknown){
  const old=this.list().find(u=>u.id===id);if(!old)throw Error('Compte absent');
  if(!['admin','musician','guest'].includes(String(role))||!Array.isArray(buses)||buses.some(b=>!Number.isInteger(b)||b<1||b>6))throw Error('Rôle ou bus invalides');
  if(old.role==='admin'&&role!=='admin'&&this.list().filter(u=>u.role==='admin').length===1)throw Error('Conserver au moins un administrateur');
  if(password!==undefined&&(typeof password!=='string'||password.length<12||password.length>200))throw Error('Mot de passe de 12 à 200 caractères requis');
  this.db.transaction(()=>{
   this.db.prepare('UPDATE users SET role=?,buses=? WHERE id=?').run(role,JSON.stringify([...new Set(buses)]),id);
   if(typeof password==='string'){const salt=randomBytes(16).toString('hex');this.db.prepare('UPDATE users SET salt=?,hash=? WHERE id=?').run(salt,scryptSync(password,salt,64).toString('hex'),id);}
   this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);
  })();return this.list().find(u=>u.id===id)!;
 }
 remove(id:string){
  const old=this.list().find(u=>u.id===id);if(!old)throw Error('Compte absent');
  if(old.role==='admin'&&this.list().filter(u=>u.role==='admin').length===1)throw Error('Conserver au moins un administrateur');
  this.db.transaction(()=>{this.db.prepare('DELETE FROM sessions WHERE user_id=?').run(id);this.db.prepare('DELETE FROM users WHERE id=?').run(id);})();return {ok:true};
 }
 close(){this.db.close();}
}
export function permitted(user:User,method:string,path:string){
 if(user.role==='admin')return true;
 if(path.startsWith('/api/android/update')||path.startsWith('/api/workshop')||path.startsWith('/api/mixer-sync')||path.startsWith('/api/diagnostics/')||path==='/api/discovery'||path==='/api/connection')return false;
 if(path.startsWith('/api/users')||path==='/api/audit'||path.startsWith('/api/reacue')||path.startsWith('/api/reaper')||path.startsWith('/api/show')||path.startsWith('/api/ears-share'))return false;
 if(method==='GET')return true;
 // A musician can change only assigned monitor sends, never FOH or another bus.
 const profile=/^\/api\/monitor\/([1-6])\/profiles(?:\/[a-f0-9-]+\/apply)?$/.exec(path);
 if(profile)return user.role==='musician'&&method==='POST'&&user.buses.includes(Number(profile[1]));
 const send=/^\/api\/monitor\/([1-6])\/channels\/(\d+)$/.exec(path);
 return user.role==='musician'&&method==='POST'&&!!send&&user.buses.includes(Number(send[1]));
}
/** Direct control from the graphical mixer: admins everything allowed live, musicians only their own monitor sends. */
export function liveControlPermitted(user:User,address:string){
 if(user.role==='admin')return true;
 const send=/^\/(?:ch\/(?:0[1-9]|1[0-6])|rtn\/(?:[1-4]|aux))\/mix\/0([1-6])\/level$/.exec(address);
 return user.role==='musician'&&!!send&&user.buses.includes(Number(send[1]));
}
export function sameOrigin(req:IncomingMessage){
 const host=req.headers.host??'';
 const allowed=new Set(['localhost','127.0.0.1',...(process.env.XR18_ALLOWED_HOSTS??'').split(',').filter(Boolean)]);
 try{for(const entries of Object.values(networkInterfaces()))for(const a of entries??[])if(a.family==='IPv4')allowed.add(a.address);}catch{/* Explicitly allowed hosts remain available on restricted systems. */}
 let target:URL;try{target=new URL('http://'+host);}catch{return false;}
 if(!allowed.has(target.hostname)||!target.port||target.username||target.password||target.pathname!=='/')return false;
 if(!req.headers.origin)return true;
 try{const origin=new URL(req.headers.origin),secure=Boolean((req.socket as {encrypted?:boolean}|undefined)?.encrypted);return origin.protocol===(secure?'https:':'http:')&&(origin.host===host||(!secure&&['localhost','127.0.0.1'].includes(target.hostname)&&['localhost','127.0.0.1'].includes(origin.hostname)&&['5173','5174'].includes(origin.port)));}catch{return false;}
}
