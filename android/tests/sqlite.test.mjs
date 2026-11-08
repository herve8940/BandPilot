import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from '../runtime/sqlite.mjs';
test('Android SQLite shares handles, preserves accented names, rolls back and persists foreign keys',()=>{
 const dir=mkdtempSync(join(tmpdir(),'bandpilot-android-db-')),file=join(dir,'library.db');
 const a=new Database(file),b=new Database(file);
 try{
  a.exec('CREATE TABLE parent(id INTEGER PRIMARY KEY,name TEXT); CREATE TABLE child(id INTEGER PRIMARY KEY,parent INTEGER REFERENCES parent(id) ON DELETE CASCADE)');
  a.prepare('INSERT INTO parent VALUES(@id,@name)').run({id:1,name:'Basse Éric'});
  assert.equal(b.prepare('SELECT name FROM parent WHERE id=?').get(1).name,'Basse Éric');
  assert.throws(()=>b.transaction(()=>{b.prepare('INSERT INTO parent VALUES(?,?)').run(2,'Guitare');b.prepare('INSERT INTO child VALUES(?,?)').run(1,99);})(),/FOREIGN KEY/);
  assert.equal(a.prepare('SELECT * FROM parent WHERE id=2').get(),undefined);
  b.prepare('INSERT INTO child VALUES(?,?)').run(2,1);a.close();
  assert.equal(b.prepare('SELECT COUNT(*) AS n FROM child').get().n,1);b.close();
  const c=new Database(file);assert.equal(c.prepare('SELECT name FROM parent').get().name,'Basse Éric');
  c.prepare('DELETE FROM parent WHERE id=?').run(1);assert.equal(c.prepare('SELECT COUNT(*) AS n FROM child').get().n,0);c.close();
 }finally{a.close();b.close();rmSync(dir,{recursive:true,force:true});}
});
