import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { randomUUID } from "node:crypto";

export interface Song { id:string; title:string; artist:string; bpm:number; createdAt:string }
export interface Rehearsal { id:string; title:string; startsAt:string; notes:string; createdAt:string }
export interface EarProfile {id:string;musician:string;bus:number;levels:number[];createdAt:string;updatedAt:string}
export interface Setlist { id:string; name:string; songIds:string[]; createdAt:string }
const requiredText=(v:unknown,label:string,max=200):string=>{
 if(typeof v!=="string"||!v.trim()||v.trim().length>max)throw Error(label+" required (max "+max+" chars)");
 return v.trim();
};
export class StudioDatabase {
 private db:Database.Database;
 constructor(filename=process.env.XR18_DB_PATH??"data/xr18-studio.db"){
  if(filename!==":memory:")mkdirSync(dirname(filename),{recursive:true});
  this.db=new Database(filename);
  this.db.pragma("journal_mode = WAL");
  this.db.pragma("foreign_keys = ON");
  this.db.exec(`
   CREATE TABLE IF NOT EXISTS songs(id TEXT PRIMARY KEY,title TEXT NOT NULL,artist TEXT NOT NULL DEFAULT '',bpm INTEGER NOT NULL,created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS rehearsals(id TEXT PRIMARY KEY,title TEXT NOT NULL,starts_at TEXT NOT NULL,notes TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS setlists(id TEXT PRIMARY KEY,name TEXT NOT NULL,created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS ear_profiles(id TEXT PRIMARY KEY,musician TEXT NOT NULL,bus INTEGER NOT NULL,levels_json TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS setlist_items(setlist_id TEXT NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,position INTEGER NOT NULL,PRIMARY KEY(setlist_id,position));
  `);
 }
 listSongs():Song[]{return (this.db.prepare("SELECT id,title,artist,bpm,created_at AS createdAt FROM songs ORDER BY created_at DESC").all() as Song[]);}
 addSong(input:Record<string,unknown>):Song{
  const title=requiredText(input.title,"title");const artist=typeof input.artist==="string"?input.artist.trim().slice(0,200):"";
  const bpm=input.bpm??120;if((typeof bpm!=="number"||!Number.isInteger(bpm))||Number(bpm)<20||Number(bpm)>300)throw Error("bpm must be 20..300");
  const song={id:randomUUID(),title,artist,bpm:Number(bpm),createdAt:new Date().toISOString()};
  this.db.prepare("INSERT INTO songs(id,title,artist,bpm,created_at) VALUES(@id,@title,@artist,@bpm,@createdAt)").run(song);return song;
 }
 deleteSong(id:string){return this.db.prepare("DELETE FROM songs WHERE id=?").run(id).changes>0;}
 listRehearsals():Rehearsal[]{return this.db.prepare("SELECT id,title,starts_at AS startsAt,notes,created_at AS createdAt FROM rehearsals ORDER BY starts_at DESC").all() as Rehearsal[];}
 addRehearsal(input:Record<string,unknown>):Rehearsal{
  const title=requiredText(input.title,"title");const startsAt=requiredText(input.startsAt,"startsAt",40);
  if(!Number.isFinite(Date.parse(startsAt)))throw Error("Invalid startsAt");
  const notes=typeof input.notes==="string"?input.notes.slice(0,10000):"";
  const rehearsal={id:randomUUID(),title,startsAt,notes,createdAt:new Date().toISOString()};
  this.db.prepare("INSERT INTO rehearsals(id,title,starts_at,notes,created_at) VALUES(@id,@title,@startsAt,@notes,@createdAt)").run(rehearsal);return rehearsal;
 }
 listSetlists():Setlist[]{
  const rows=this.db.prepare("SELECT id,name,created_at AS createdAt FROM setlists ORDER BY created_at DESC").all() as Omit<Setlist,"songIds">[];
  const items=this.db.prepare("SELECT song_id FROM setlist_items WHERE setlist_id=? ORDER BY position");
  return rows.map(s=>({...s,songIds:(items.all(s.id) as {song_id:string}[]).map(i=>i.song_id)}));
 }
 addSetlist(input:Record<string,unknown>):Setlist{
  const name=requiredText(input.name,"name");const ids=input.songIds??[];
  if(!Array.isArray(ids)||ids.length>100||ids.some(v=>typeof v!=="string"))throw Error("songIds must be a list of up to 100 IDs");
  const setlist={id:randomUUID(),name,songIds:ids as string[],createdAt:new Date().toISOString()};
  this.db.transaction(()=>{
   this.db.prepare("INSERT INTO setlists(id,name,created_at) VALUES(?,?,?)").run(setlist.id,name,setlist.createdAt);
   const add=this.db.prepare("INSERT INTO setlist_items(setlist_id,song_id,position) VALUES(?,?,?)");
   setlist.songIds.forEach((id,index)=>add.run(setlist.id,id,index));
  })();return setlist;
 }
 deleteSetlist(id:string){return this.db.prepare("DELETE FROM setlists WHERE id=?").run(id).changes>0;}
 listEarProfiles():EarProfile[]{
   const rows=this.db.prepare("SELECT id,musician,bus,levels_json,created_at AS createdAt,updated_at AS updatedAt FROM ear_profiles ORDER BY updated_at DESC").all() as (Omit<EarProfile,"levels">&{levels_json:string})[];
   return rows.map(({levels_json,...row})=>({...row,levels:JSON.parse(levels_json) as number[]}));
 }
 saveEarProfile(input:Record<string,unknown>):EarProfile{
   const musician=requiredText(input.musician,"musician",80);
   const bus=input.bus;
   if(typeof bus!=="number"||!Number.isInteger(bus)||bus<1||bus>6)throw Error("Bus must be 1..6");
   const levels=input.levels;
   if(!Array.isArray(levels)||levels.length!==16||levels.some(v=>typeof v!=="number"||!Number.isFinite(v)||v<0||v>1))throw Error("16 normalized channel levels (0..1) required");
   const id=typeof input.id==="string"&&/^[a-f0-9-]{36}$/.test(input.id)?input.id:randomUUID();
   const now=new Date().toISOString();
   this.db.prepare(`INSERT INTO ear_profiles(id,musician,bus,levels_json,created_at,updated_at) VALUES(?,?,?,?,?,?)
   ON CONFLICT(id) DO UPDATE SET musician=excluded.musician,bus=excluded.bus,levels_json=excluded.levels_json,updated_at=excluded.updated_at`).run(id,musician,bus,JSON.stringify(levels),now,now);
   return this.listEarProfiles().find(p=>p.id===id)!;
 }
 deleteEarProfile(id:string){return this.db.prepare("DELETE FROM ear_profiles WHERE id=?").run(id).changes>0;}
 workspace():{notes:string;setlist:string[]}|null{
  this.db.exec("CREATE TABLE IF NOT EXISTS workspace_draft(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL)");
  const row=this.db.prepare('SELECT data FROM workspace_draft WHERE id=1').get() as {data:string}|undefined;
  return row?JSON.parse(row.data):null;
 }
 saveWorkspace(input:Record<string,unknown>){
  if(typeof input.notes!=='string'||input.notes.length>10000||!Array.isArray(input.setlist)||input.setlist.length>100||input.setlist.some(v=>typeof v!=='string'||v.length>120))throw Error('Brouillon invalide');
  this.workspace();const draft={notes:input.notes,setlist:input.setlist as string[]};
  this.db.prepare('INSERT INTO workspace_draft VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(JSON.stringify(draft));return draft;
 }
 close(){this.db.close();}
}
