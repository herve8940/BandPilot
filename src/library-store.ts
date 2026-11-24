import {validateParameterLinks,LINKS_CONFLICT,type ParameterLinksDefinition} from '../shared/parameter-links.js';
import {surfaceModel,validateSurfaces,SURFACE_CONFLICT,type ExpertSurfaces} from '../shared/expert-surfaces.js';
import {outputRules,type OutputProtections} from '../shared/output-recall.js';
import Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {protectionModel,protectionRules,PROTECTION_CONFLICT,PROTECTION_INVALID,type SceneProtections} from '../shared/scene-protections.js';
export type Entry={id:string;kind:string;name:string;data:unknown;createdAt:string};
export class LibraryStore {
 private db:Database.Database;
 constructor(filename:string){this.db=new Database(filename);this.db.exec('CREATE TABLE IF NOT EXISTS studio_library(id TEXT PRIMARY KEY,kind TEXT NOT NULL,name TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL); CREATE TABLE IF NOT EXISTS scene_protections(model TEXT PRIMARY KEY,revision INTEGER NOT NULL,rules TEXT NOT NULL); CREATE TABLE IF NOT EXISTS recall_scopes(scene_id TEXT NOT NULL, kind TEXT NOT NULL, data TEXT NOT NULL, PRIMARY KEY(scene_id,kind)); CREATE TABLE IF NOT EXISTS output_scene_protections(model TEXT PRIMARY KEY,revision INTEGER NOT NULL,rules TEXT NOT NULL); CREATE TABLE IF NOT EXISTS expert_surfaces(model TEXT PRIMARY KEY,revision INTEGER NOT NULL,surfaces TEXT NOT NULL); CREATE TABLE IF NOT EXISTS parameter_links(model TEXT PRIMARY KEY,revision INTEGER NOT NULL,links TEXT NOT NULL)');}
 parameterLinks(model:unknown):ParameterLinksDefinition{
  const {id}=surfaceModel(model);
  const row=this.db.prepare('SELECT revision,links FROM parameter_links WHERE model=?').get(id) as {revision:number;links:string}|undefined;
  return validateParameterLinks({model:id,revision:row?.revision??0,links:row?JSON.parse(row.links):[]});
 }
 saveParameterLinks(input:unknown){
  const next=validateParameterLinks(input);
  return this.db.transaction(()=>{
   if(this.parameterLinks(next.model).revision!==next.revision)throw Error(LINKS_CONFLICT);
   const revision=next.revision+1;
   this.db.prepare('INSERT INTO parameter_links VALUES(?,?,?) ON CONFLICT(model) DO UPDATE SET revision=excluded.revision,links=excluded.links').run(next.model,revision,JSON.stringify(next.links));
   return {...next,revision};
  })();
 }
 surfaces(model:unknown):ExpertSurfaces{
  const {id}=surfaceModel(model);
  const row=this.db.prepare('SELECT revision,surfaces FROM expert_surfaces WHERE model=?').get(id) as {revision:number;surfaces:string}|undefined;
  return row?validateSurfaces({model:id,revision:row.revision,surfaces:JSON.parse(row.surfaces)}):{model:id,revision:0,surfaces:[]};
 }
 saveSurfaces(input:unknown){
  const next=validateSurfaces(input);
  return this.db.transaction(()=>{
   const previous=this.surfaces(next.model);
   if(previous.revision!==next.revision)throw Error(SURFACE_CONFLICT);
   const revision=next.revision+1;
   this.db.prepare('INSERT INTO expert_surfaces VALUES(?,?,?) ON CONFLICT(model) DO UPDATE SET revision=excluded.revision,surfaces=excluded.surfaces').run(next.model,revision,JSON.stringify(next.surfaces));
   return {...next,revision};
  })();
 }
 protections(model:unknown):SceneProtections{
  const m=protectionModel(model),row=this.db.prepare('SELECT revision,rules FROM scene_protections WHERE model=?').get(m.id) as {revision:number;rules:string}|undefined;
  return {model:m.id,revision:row?.revision??0,rules:row?protectionRules(m.id,JSON.parse(row.rules)):[]};
 }
 saveProtections(input:unknown):SceneProtections{
  const v=input as SceneProtections;if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!['model','revision','rules'].includes(k))||!Number.isSafeInteger(v.revision)||v.revision<0)throw Error(PROTECTION_INVALID);
  const model=protectionModel(v.model).id,rules=protectionRules(model,v.rules);
  return this.db.transaction(()=>{
   const old=this.protections(model);if(old.revision!==v.revision)throw Error(PROTECTION_CONFLICT);
   if(JSON.stringify(old.rules)===JSON.stringify(rules))return old;
   const revision=old.revision+1;
   this.db.prepare('INSERT INTO scene_protections VALUES(?,?,?) ON CONFLICT(model) DO UPDATE SET revision=excluded.revision,rules=excluded.rules').run(model,revision,JSON.stringify(rules));
   return {model,revision,rules};
  })();
 }
 outputProtections(model:string):OutputProtections{
  outputRules(model,[]);const row=this.db.prepare('SELECT revision,rules FROM output_scene_protections WHERE model=?').get(model) as {revision:number;rules:string}|undefined;
  return {model,revision:row?.revision??0,rules:row?outputRules(model,JSON.parse(row.rules)):[]};
 }
 saveOutputProtections(input:unknown){
  const v=input as OutputProtections;if(!v||typeof v.model!=='string'||!Number.isSafeInteger(v.revision)||v.revision<0)throw Error(PROTECTION_INVALID);
  const rules=outputRules(v.model,v.rules);
  return this.db.transaction(()=>{const old=this.outputProtections(v.model);if(old.revision!==v.revision)throw Error(PROTECTION_CONFLICT);if(JSON.stringify(old.rules)===JSON.stringify(rules))return old;
   const revision=old.revision+1;this.db.prepare('INSERT INTO output_scene_protections VALUES(?,?,?) ON CONFLICT(model) DO UPDATE SET revision=excluded.revision,rules=excluded.rules').run(v.model,revision,JSON.stringify(rules));return {model:v.model,revision,rules};
  })();
 }
 recallScope(id:string,kind:'inputs'|'outputs'){
  const row=this.db.prepare('SELECT data FROM recall_scopes WHERE scene_id=? AND kind=?').get(id,kind) as {data:string}|undefined;
  return row?JSON.parse(row.data) as unknown:null;
 }
 saveRecallScope(id:string,kind:'inputs'|'outputs',scope:unknown){
  this.db.prepare('INSERT INTO recall_scopes VALUES(?,?,?) ON CONFLICT(scene_id,kind) DO UPDATE SET data=excluded.data').run(id,kind,JSON.stringify(scope));
  return scope;
 }
 list(kind:string,limit=1000000):Entry[]{if(!Number.isInteger(limit)||limit<1||limit>1000000)throw Error('Limite invalide');return (this.db.prepare('SELECT id,kind,name,data,created_at AS createdAt FROM studio_library WHERE kind=? ORDER BY created_at DESC,rowid DESC LIMIT ?').all(kind,limit) as (Omit<Entry,'data'>&{data:string})[]).map(e=>({...e,data:JSON.parse(e.data)}));}
 get(id:string){const row=this.db.prepare('SELECT id,kind,name,data,created_at AS createdAt FROM studio_library WHERE id=?').get(id) as (Omit<Entry,'data'>&{data:string})|undefined;if(!row)throw Error('Élément introuvable');return {...row,data:JSON.parse(row.data)} as Entry;}
 save(kind:string,name:unknown,data:unknown){if(typeof name!=='string'||!name.trim()||name.length>120)throw Error('Nom requis (120 caractères maximum)');const entry:Entry={id:randomUUID(),kind,name:name.trim(),data,createdAt:new Date().toISOString()};this.db.prepare('INSERT INTO studio_library VALUES(?,?,?,?,?)').run(entry.id,kind,entry.name,JSON.stringify(data),entry.createdAt);return entry;}
 update(id:string,data:unknown){if(!this.db.prepare('UPDATE studio_library SET data=? WHERE id=?').run(JSON.stringify(data),id).changes)throw Error('Élément introuvable');}
 delete(id:string){return this.db.transaction(()=>{this.db.prepare('DELETE FROM recall_scopes WHERE scene_id=?').run(id);return this.db.prepare('DELETE FROM studio_library WHERE id=?').run(id).changes>0;})();}
 close(){this.db.close();}
}

