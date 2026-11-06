import Database from 'better-sqlite3';
import {randomUUID} from 'node:crypto';
export type Entry={id:string;kind:string;name:string;data:unknown;createdAt:string};
export class LibraryStore {
 private db:Database.Database;
 constructor(filename:string){this.db=new Database(filename);this.db.exec('CREATE TABLE IF NOT EXISTS studio_library(id TEXT PRIMARY KEY,kind TEXT NOT NULL,name TEXT NOT NULL,data TEXT NOT NULL,created_at TEXT NOT NULL)');}
 list(kind:string,limit=1000000):Entry[]{if(!Number.isInteger(limit)||limit<1||limit>1000000)throw Error('Limite invalide');return (this.db.prepare('SELECT id,kind,name,data,created_at AS createdAt FROM studio_library WHERE kind=? ORDER BY created_at DESC,rowid DESC LIMIT ?').all(kind,limit) as (Omit<Entry,'data'>&{data:string})[]).map(e=>({...e,data:JSON.parse(e.data)}));}
 get(id:string){const row=this.db.prepare('SELECT id,kind,name,data,created_at AS createdAt FROM studio_library WHERE id=?').get(id) as (Omit<Entry,'data'>&{data:string})|undefined;if(!row)throw Error('Élément introuvable');return {...row,data:JSON.parse(row.data)} as Entry;}
 save(kind:string,name:unknown,data:unknown){if(typeof name!=='string'||!name.trim()||name.length>120)throw Error('Nom requis (120 caractères maximum)');const entry:Entry={id:randomUUID(),kind,name:name.trim(),data,createdAt:new Date().toISOString()};this.db.prepare('INSERT INTO studio_library VALUES(?,?,?,?,?)').run(entry.id,kind,entry.name,JSON.stringify(data),entry.createdAt);return entry;}
 update(id:string,data:unknown){if(!this.db.prepare('UPDATE studio_library SET data=? WHERE id=?').run(JSON.stringify(data),id).changes)throw Error('Élément introuvable');}
 delete(id:string){return this.db.prepare('DELETE FROM studio_library WHERE id=?').run(id).changes>0;}
 close(){this.db.close();}
}

