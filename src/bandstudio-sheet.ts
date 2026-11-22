import {createHash} from 'node:crypto';
import {lstat,readFile,readdir} from 'node:fs/promises';
import {basename,dirname,extname,isAbsolute,join} from 'node:path';
import type {SheetCue,SongSheet} from '../shared/bandstudio-sheet.js';

const empty=():SongSheet=>({chords:[],lyrics:[]});
const hash=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
async function jsonFile(file:string):Promise<Record<string,unknown>|null>{
 try{
  const info=await lstat(file);
  if(!info.isFile()||info.size>16*1024*1024)return null;
  const value=JSON.parse(await readFile(file,'utf8'));
  return value&&typeof value==='object'&&!Array.isArray(value)?value:null;
 }catch{return null;}
}
function cues(value:unknown,offset:number):SheetCue[]{
 if(!Array.isArray(value))return [];
 return value.flatMap(e=>e&&typeof e.text==='string'&&e.text.trim()&&Number.isFinite(e.start)&&Number.isFinite(e.end)&&e.end>e.start?
  [{text:e.text.trim(),start:e.start+offset,end:e.end+offset}]:[]).sort((a,b)=>a.start-b.start);
}
export async function loadBandStudioSheet(path:string){
 const sheet=empty();
 let source:SongSheet|undefined;
 if(isAbsolute(path)&&extname(path).toLowerCase()==='.rpp'){
  const folder=dirname(path);
  const exported=await jsonFile(join(folder,'bandstudio-project.json'));
  if(exported&&typeof exported.exportPreroll==='number'&&Number.isFinite(exported.exportPreroll)&&exported.exportPreroll>=0){
   // A normal REAPER save changes its checksum. In a shared folder only a checksum can disambiguate exports.
   const siblings=(await readdir(folder)).filter(f=>extname(f).toLowerCase()==='.rpp');
   if(siblings.length===1||hash(await readFile(path))===exported.rppSHA256){
    const offset=exported.exportPreroll;
    if(typeof exported.key==='string'&&exported.key.trim())sheet.key=exported.key.trim();
    if(typeof exported.capo==='number'&&Number.isInteger(exported.capo)&&exported.capo>=0)sheet.capo=exported.capo;
    sheet.chords=cues(exported.chords,offset);sheet.lyrics=cues(exported.lyrics,offset);
    const exports=dirname(folder),bundle=dirname(exports);
    if((!sheet.chords.length||!sheet.lyrics.length)&&basename(exports)==='Exports'&&extname(bundle)==='.bandstudio'){
     const project=await jsonFile(join(bundle,'project.json'));
     if(project){
      const chords=sheet.chords.length?sheet.chords:cues(project.chords,offset);
      const lyrics=sheet.lyrics.length?sheet.lyrics:cues(project.lyrics,offset);
      if(chords.length>sheet.chords.length||lyrics.length>sheet.lyrics.length)source={...sheet,chords,lyrics};
     }
    }
   }
  }
 }
 return {sheet,source,revision:hash(JSON.stringify([path,sheet,source])).slice(0,32)};
}
export class SheetLibrary{
 private entry?:{path:string;at:number;read:ReturnType<typeof loadBandStudioSheet>};
 read(path:string){
  if(this.entry?.path!==path||Date.now()-this.entry.at>5000)this.entry={path,at:Date.now(),read:loadBandStudioSheet(path)};
  return this.entry.read;
 }
}
