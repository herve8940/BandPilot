import { test } from "node:test";
import assert from "node:assert/strict";
import { StudioDatabase } from "../src/database.js";
import {mkdtempSync,readdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createServer} from 'node:http';
import {serveSongPdf} from '../src/song-pdf.js';
test("SQLite persists songs, rehearsals and setlists across reopen",()=>{
 const db=new StudioDatabase(":memory:");
 try{
  const song=db.addSong({title:"Plug In Baby",artist:"Muse",bpm:136});
  assert.equal(db.listSongs().length,1);
  assert.throws(()=>db.addSong({title:"",bpm:100}));
  const list=db.addSetlist({name:"Répétition",songIds:[song.id,song.id]});
  assert.deepEqual(db.listSetlists()[0]?.songIds,[song.id,song.id]);
  assert.equal(db.listSetlists()[0]?.id,list.id);
  db.addRehearsal({title:"Répétition du mardi",startsAt:"2026-11-03T19:00:00",notes:"Travail du refrain"});
  assert.equal(db.listRehearsals().length,1);
  assert.equal(db.deleteSong(song.id),true);
  assert.deepEqual(db.listSetlists()[0]?.songIds,[]);
 } finally{db.close();}
});

test('song PDFs survive a restart, replace atomically, and follow the selected song ID',()=>{
 const dir=mkdtempSync(join(tmpdir(),'bp-sheet-test-')),file=join(dir,'studio.sqlite');
 let db=new StudioDatabase(file);
 try{
  const first=db.addSong({title:'Ouverture'}),second=db.addSong({title:'Ouverture'});
  const original=Buffer.from('%PDF-1.4\nfirst\n%%EOF'),updated=Buffer.from('%PDF-1.4\nupdated\n%%EOF');
  assert.equal(db.saveSongPdf('missing',original),false);
  assert.ok(db.saveSongPdf(first.id,original));
  db.close();db=new StudioDatabase(file);
  assert.deepEqual(db.songPdf(first.id),original);
  assert.equal(db.songPdf(second.id),undefined);
  assert.equal(db.listSongs().find(s=>s.id===first.id)?.hasPdf,true);
  assert.ok(db.saveSongPdf(first.id,updated));
  assert.deepEqual(db.songPdf(first.id),updated);
  assert.equal(readdirSync(file+'.sheets').length,1);
  assert.ok(db.deleteSongPdf(first.id));
  assert.equal(db.listSongs().find(s=>s.id===first.id)?.hasPdf,undefined);
  assert.ok(db.saveSongPdf(second.id,updated));assert.ok(db.deleteSong(second.id));
  assert.deepEqual(readdirSync(file+'.sheets'),[]);
 }finally{db.close();rmSync(dir,{recursive:true,force:true});}
});

test('PDF imports keep the previous attachment on malformed input and return the original bytes',async()=>{
 const db=new StudioDatabase(':memory:');
 const song=db.addSong({title:'Test document'});
 const server=createServer((req,res)=>{void serveSongPdf(req,res,db,song.id);});
 try{
  await new Promise<void>(resolve=>server.listen(0,'127.0.0.1',resolve));
  const address=server.address();assert.ok(address&&typeof address==='object');
  const url='http://127.0.0.1:'+address.port,headers={'Content-Type':'application/pdf'};
  const doc=Buffer.from('%PDF-1.4\nexample\n%%EOF');
  assert.equal((await fetch(url,{method:'PUT',headers,body:doc})).status,204);
  assert.equal((await fetch(url,{method:'PUT',headers,body:'invalid'})).status,422);
  assert.equal((await fetch(url,{method:'PUT',body:'wrong type'})).status,415);
  const read=await fetch(url);
  assert.equal(read.headers.get('content-type'),'application/pdf');
  assert.match(read.headers.get('cache-control')??'',/no-store/);
  assert.deepEqual(Buffer.from(await read.arrayBuffer()),doc);
  assert.equal((await fetch(url,{method:'DELETE'})).status,204);
  assert.equal((await fetch(url)).status,404);
 }finally{await new Promise<void>(resolve=>server.close(()=>resolve()));db.close();}
});

test('the setlist keeps its chosen order, duplicate encores and existing sheets when importing open rehearsal projects',()=>{
 const db=new StudioDatabase(':memory:');
 const tab=(id:string,title:string,number:number,fileKey?:string)=>({id,title,number,fileKey,saved:true,current:false});
 try{
  const known=db.addSong({title:'Ballade',artist:'Groupe',bpm:84});
  db.saveSongPdf(known.id,Buffer.from('fixture'));
  const tabs=[tab('t1','Ballade',1,'a'),tab('t2','Final',2,'b'),tab('t3','Final',3,'c')];
  const [final,ballade,other]=db.importOpenProjects(['t2','t1','t3'],tabs);
  assert.equal(ballade,known.id);assert.notEqual(final,other);
  assert.equal(db.listSongs().find(s=>s.id===final)?.bpm,null);
  const order=[other!,ballade!,final!,ballade!];db.addSetlist({name:'Live',songIds:order});
  assert.deepEqual(db.importOpenProjects(['new'],[tab('new','Ballade',3,'a')]),[ballade]);
  assert.ok(db.listSongs().find(s=>s.projectId==='new'&&s.hasPdf&&s.bpm===84));
  assert.deepEqual(db.listSetlists()[0]?.songIds,order);
  assert.throws(()=>db.importOpenProjects(['extra','closed'],[tab('extra','Ouverture',1)]),/fermé/);
  assert.equal(db.listSongs().length,3);
  const [first,second]=db.importOpenProjects(['copy1','copy2'],[tab('copy1','Même fichier',1,'same'),tab('copy2','Même fichier',2,'same')]);
  assert.equal(first,second);
 }finally{db.close();}
});
