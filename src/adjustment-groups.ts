import Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
import {groupModel,groupSelection,GROUP_CONFLICT,type AdjustmentGroup} from '../shared/adjustment-group.js';

/** Metadata only, deliberately independent from the console transport. */
export class AdjustmentGroups {
 private db:Database.Database;
 constructor(filename:string){this.db=new Database(filename);this.db.exec('CREATE TABLE IF NOT EXISTS adjustment_groups(id TEXT PRIMARY KEY,model TEXT NOT NULL,name TEXT NOT NULL,selection TEXT NOT NULL,revision INTEGER NOT NULL)');}
 list(model:unknown):AdjustmentGroup[]{
  const m=groupModel(model);
  return (this.db.prepare('SELECT * FROM adjustment_groups WHERE model=? ORDER BY rowid').all(m.id) as {id:string;model:AdjustmentGroup['model'];name:string;selection:string;revision:number}[]).map(({selection,...row})=>({...row,...groupSelection(row.model,JSON.parse(selection))}));
 }
 save(input:unknown):AdjustmentGroup{
  const v=input as AdjustmentGroup;if(!v||typeof v!=='object'||Array.isArray(v))throw Error('Groupe invalide.');
  if(Object.keys(v).some(k=>!['id','model','name','revision','channels','target','bus','band'].includes(k)))throw Error('Groupe invalide.');
  const selection=groupSelection(v.model,v),model=groupModel(v.model).id;
  if(typeof v.name!=='string'||!v.name.trim()||v.name.trim().length>60)throw Error('Nomme le groupe (60 caractères maximum).');
  const name=v.name.trim();
  return this.db.transaction(()=>{
   const groups=this.list(model),old=v.id===undefined?undefined:groups.find(g=>g.id===v.id);
   if(v.id!==undefined&&(!old||old.revision!==v.revision))throw Error(GROUP_CONFLICT);
   if(v.id===undefined&&v.revision!==undefined)throw Error('Groupe invalide.');
   if(groups.some(g=>g.id!==old?.id&&g.name.normalize('NFC').toLowerCase()===name.normalize('NFC').toLowerCase()))throw Error('Un groupe porte déjà ce nom pour ce modèle.');
   if(!old&&groups.length>=32)throw Error('32 groupes maximum par modèle.');
   const group={...selection,id:old?.id??randomUUID(),model,name,revision:(old?.revision??0)+1};
   if(old)this.db.prepare('UPDATE adjustment_groups SET name=?,selection=?,revision=? WHERE id=?').run(name,JSON.stringify(selection),group.revision,old.id);
   else this.db.prepare('INSERT INTO adjustment_groups VALUES(?,?,?,?,?)').run(group.id,model,name,JSON.stringify(selection),group.revision);
   return group;
  })();
 }
 remove(input:unknown){
  const v=input as {id:string;model:string;revision:number};if(!v||typeof v.id!=='string'||!Number.isInteger(v.revision))throw Error('Groupe invalide.');
  const model=groupModel(v.model).id;
  if(!this.db.prepare('DELETE FROM adjustment_groups WHERE id=? AND model=? AND revision=?').run(v.id,model,v.revision).changes)throw Error(GROUP_CONFLICT);
  return {ok:true};
 }
 close(){this.db.close();}
}
