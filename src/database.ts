import Database from "better-sqlite3";
import { mkdirSync,mkdtempSync,readFileSync,rmSync,writeFileSync } from "node:fs";
import { dirname,join } from "node:path";
import { tmpdir } from "node:os";
import { randomUUID } from "node:crypto";

import type {RehearsalTab} from '../shared/rehearsal-desk.js';

export interface Song { id:string; title:string; artist:string; bpm:number|null; createdAt:string; hasPdf?:boolean;projectId?:string;fileKey?:string }
export interface Rehearsal { id:string; title:string; startsAt:string; notes:string; createdAt:string }
export interface EarProfile {id:string;musician:string;bus:number;levels:number[];createdAt:string;updatedAt:string}
export interface Setlist { id:string; name:string; songIds:string[]; createdAt:string }
const requiredText=(v:unknown,label:string,max=200):string=>{
 if(typeof v!=="string"||!v.trim()||v.trim().length>max)throw Error(label+" required (max "+max+" chars)");
 return v.trim();
};
export class StudioDatabase {
 private db:Database.Database;
 private pdfFolder?:string;
 constructor(private filename=process.env.XR18_DB_PATH??"data/xr18-studio.db"){
  if(filename!==":memory:")mkdirSync(dirname(filename),{recursive:true});
  this.db=new Database(filename);
  this.db.pragma("journal_mode = WAL");
  this.db.pragma("foreign_keys = ON");
  this.db.exec(`
   CREATE TABLE IF NOT EXISTS songs(id TEXT PRIMARY KEY,title TEXT NOT NULL,artist TEXT NOT NULL DEFAULT '',bpm INTEGER NOT NULL,created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS song_projects(song_id TEXT PRIMARY KEY REFERENCES songs(id) ON DELETE CASCADE,project_id TEXT UNIQUE NOT NULL,file_key TEXT UNIQUE);
   CREATE TABLE IF NOT EXISTS song_pdfs(song_id TEXT PRIMARY KEY REFERENCES songs(id) ON DELETE CASCADE,file_id TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS rehearsals(id TEXT PRIMARY KEY,title TEXT NOT NULL,starts_at TEXT NOT NULL,notes TEXT NOT NULL DEFAULT '',created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS setlists(id TEXT PRIMARY KEY,name TEXT NOT NULL,created_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS ear_profiles(id TEXT PRIMARY KEY,musician TEXT NOT NULL,bus INTEGER NOT NULL,levels_json TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS setlist_items(setlist_id TEXT NOT NULL REFERENCES setlists(id) ON DELETE CASCADE,song_id TEXT NOT NULL REFERENCES songs(id) ON DELETE CASCADE,position INTEGER NOT NULL,PRIMARY KEY(setlist_id,position));
   CREATE TABLE IF NOT EXISTS workspace_draft(id INTEGER PRIMARY KEY CHECK(id=1),data TEXT NOT NULL);
  `);
 }
 listSongs():Song[]{
  const rows=this.db.prepare(`SELECT s.id,s.title,s.artist,NULLIF(s.bpm,0) AS bpm,s.created_at AS createdAt,p.song_id AS attached,r.project_id AS projectId,r.file_key AS fileKey
   FROM songs s LEFT JOIN song_pdfs p ON p.song_id=s.id LEFT JOIN song_projects r ON r.song_id=s.id ORDER BY s.created_at DESC`).all() as (Song & {attached:string|null})[];
  return rows.map(({attached,projectId,fileKey,...song})=>({...song,...(attached&&{hasPdf:true}),...(projectId&&{projectId}),...(fileKey&&{fileKey})}));
 }
 importOpenProjects(ids:unknown,tabs:RehearsalTab[]){
  if(!Array.isArray(ids)||!ids.length||ids.length>100||new Set(ids).size!==ids.length)throw Error('Sélection de projets invalide.');
  const normalize=(value:string)=>value.normalize('NFC').trim().toLowerCase();
  return this.db.transaction(()=>{
   const songs=this.listSongs();
   const link=this.db.prepare('INSERT INTO song_projects VALUES(?,?,?) ON CONFLICT(song_id) DO UPDATE SET project_id=excluded.project_id,file_key=COALESCE(excluded.file_key,song_projects.file_key)');
   return ids.map(id=>{
    const tab=tabs.find(t=>t.id===id);
    if(!tab)throw Error('Un projet a été fermé. Relis les onglets de Répéter.');
    const title=tab.title.trim()||('REAPER · '+tab.number);
    let song=songs.find(s=>s.projectId===id||tab.fileKey&&s.fileKey===tab.fileKey);
    if(!song){
     const matches=songs.filter(s=>!s.projectId&&normalize(s.title)===normalize(title));
     if(matches.length===1&&tabs.filter(t=>normalize(t.title)===normalize(title)).length===1)song=matches[0];
    }
    if(!song){song=this.insertSong(title,"",null);songs.push(song);}
    link.run(song.id,id,tab.fileKey??null);
    song.projectId=id;
    if(tab.fileKey)song.fileKey=tab.fileKey;
    return song.id;
   });
  })();
 }
 private pdfPath(fileId:string){
  if(!/^[a-f0-9-]{36}$/.test(fileId))throw Error('Invalid document ID');
  this.pdfFolder??=this.filename===':memory:'?mkdtempSync(join(tmpdir(),'bandpilot-pdfs-')):this.filename+'.sheets';
  return join(this.pdfFolder,fileId+'.pdf');
 }
 private pdfId(id:string){
  return (this.db.prepare('SELECT file_id FROM song_pdfs WHERE song_id=?').get(id) as {file_id:string}|undefined)?.file_id;
 }
 songPdf(id:string){
  const fileId=this.pdfId(id);
  return fileId ? readFileSync(this.pdfPath(fileId)) : undefined;
 }
 saveSongPdf(id:string,document:Buffer){
  if(!this.db.prepare('SELECT 1 FROM songs WHERE id=?').get(id))return false;
  // Only the reference enters SQLite. Android can persist a fader preference without copying every PDF.
  const fileId=randomUUID(),path=this.pdfPath(fileId);
  mkdirSync(dirname(path),{recursive:true});
  let previous:string|undefined;
  try{
   writeFileSync(path,document,{flag:'wx',mode:0o600});
   previous=this.db.transaction(()=>{
    const old=this.pdfId(id);
    this.db.prepare('INSERT INTO song_pdfs VALUES(?,?) ON CONFLICT(song_id) DO UPDATE SET file_id=excluded.file_id').run(id,fileId);
    return old;
   })();
  }catch(error){rmSync(path,{force:true});throw error;}
  if(previous)rmSync(this.pdfPath(previous),{force:true});
  return true;
 }
 private removeSongData(id:string,sql:string){
  const {old,changed}=this.db.transaction(()=>{
   const old=this.pdfId(id);
   return {old,changed:this.db.prepare(sql).run(id).changes>0};
  })();
  if(old)rmSync(this.pdfPath(old),{force:true});
  return changed;
 }
 deleteSongPdf(id:string){return this.removeSongData(id,'DELETE FROM song_pdfs WHERE song_id=?');}
 addSong(input:Record<string,unknown>):Song{
  const title=requiredText(input.title,"title");const artist=typeof input.artist==="string"?input.artist.trim().slice(0,200):"";
  const bpm=input.bpm??120;if((typeof bpm!=="number"||!Number.isInteger(bpm))||Number(bpm)<20||Number(bpm)>300)throw Error("bpm must be 20..300");
  return this.insertSong(title,artist,bpm);
 }
 private insertSong(title:string,artist:string,bpm:number|null):Song{
  const song={id:randomUUID(),title,artist,bpm,createdAt:new Date().toISOString()};
  this.db.prepare("INSERT INTO songs(id,title,artist,bpm,created_at) VALUES(@id,@title,@artist,@bpm,@createdAt)").run({...song,bpm:bpm??0});return song;
 }
 deleteSong(id:string){return this.removeSongData(id,'DELETE FROM songs WHERE id=?');}
 listRehearsals():Rehearsal[]{return this.db.prepare("SELECT id,title,starts_at AS startsAt,notes,created_at AS createdAt FROM rehearsals ORDER BY starts_at DESC").all() as Rehearsal[];}
 addRehearsal(input:Record<string,unknown>):Rehearsal{
  const title=requiredText(input.title,"title");const startsAt=requiredText(input.startsAt,"startsAt",40);
  if(!Number.isFinite(Date.parse(startsAt)))throw Error("Invalid startsAt");
  const notes=typeof input.notes==="string"?input.notes.slice(0,10000):"";
  const rehearsal={id:randomUUID(),title,startsAt,notes,createdAt:new Date().toISOString()};
  this.db.prepare("INSERT INTO rehearsals(id,title,starts_at,notes,created_at) VALUES(@id,@title,@startsAt,@notes,@createdAt)").run(rehearsal);return rehearsal;
 }
 listSetlists():Setlist[]{
  const rows=this.db.prepare(`
   SELECT s.id,s.name,s.created_at AS createdAt,i.song_id AS songId
   FROM setlists s LEFT JOIN setlist_items i ON i.setlist_id=s.id
   ORDER BY s.created_at DESC,s.rowid,i.position
  `).all() as (Omit<Setlist,"songIds"> & {songId:string|null})[];
  const lists: Setlist[] = [];
  let current: Setlist | undefined;
  for (const {id,name,createdAt,songId} of rows) {
   if (current?.id !== id) { current = {id,name,createdAt,songIds:[]}; lists.push(current); }
   if (songId !== null) current.songIds.push(songId);
  }
  return lists;
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
  const row=this.db.prepare('SELECT data FROM workspace_draft WHERE id=1').get() as {data:string}|undefined;
  return row?JSON.parse(row.data):null;
 }
 saveWorkspace(input:Record<string,unknown>){
  if(typeof input.notes!=='string'||input.notes.length>10000||!Array.isArray(input.setlist)||input.setlist.length>100||input.setlist.some(v=>typeof v!=='string'||v.length>120))throw Error('Brouillon invalide');
  const draft={notes:input.notes,setlist:input.setlist as string[]};
  this.db.prepare('INSERT INTO workspace_draft VALUES(1,?) ON CONFLICT(id) DO UPDATE SET data=excluded.data').run(JSON.stringify(draft));return draft;
 }
 close(){this.db.close();if(this.filename===':memory:'&&this.pdfFolder)rmSync(this.pdfFolder,{recursive:true,force:true});}
}
