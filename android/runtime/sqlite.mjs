// Android-only adapter. The desktop keeps better-sqlite3 unchanged.
// All handles for a filename share one SQLite database, like native connections.
import initSqlJs from 'sql.js';
import {readFileSync,existsSync,mkdirSync,openSync,writeFileSync,fsyncSync,closeSync,renameSync} from 'node:fs';
import {dirname,resolve} from 'node:path';
const SQL=await initSqlJs();
const databases=new Map();
function parameters(args){
 if(args.length===1&&args[0]&&typeof args[0]==='object'&&!Array.isArray(args[0])&&!ArrayBuffer.isView(args[0])){
  return Object.fromEntries(Object.entries(args[0]).flatMap(([k,v])=>['@',':','$'].map(prefix=>[prefix+k,v])));
 }
 return args;
}
function persist(state){
 if(state.depth||!state.file)return;
 const bytes=state.db.export();
 // sql.js export closes/reopens SQLite internally, resetting connection pragmas.
 state.db.run('PRAGMA foreign_keys = ON');
 const temp=state.file+'.tmp',fd=openSync(temp,'w',0o600);
 try{writeFileSync(fd,bytes);fsyncSync(fd);}finally{closeSync(fd);}
 renameSync(temp,state.file);
}
export default class Database{
 constructor(filename){
  const file=filename===':memory:'?null:resolve(filename);
  if(file)mkdirSync(dirname(file),{recursive:true});
  this.state=(file&&databases.get(file))||{db:new SQL.Database(file&&existsSync(file)?readFileSync(file):undefined),file,refs:0,depth:0};
  this.state.refs++;this.closed=false;
  this.state.db.run('PRAGMA foreign_keys = ON');
  if(file)databases.set(file,this.state);
 }
 check(){if(this.closed)throw Error('Database closed');return this.state;}
 exec(sql){const state=this.check();state.db.exec(sql);persist(state);return this;}
 pragma(sql){if(/^journal_mode/i.test(sql))return [{journal_mode:'delete'}];const result=this.check().db.exec('PRAGMA '+sql);return result.flatMap(r=>r.values.map(v=>Object.fromEntries(r.columns.map((k,i)=>[k,v[i]]))));}
 prepare(sql){
  const owner=this;
  const query=(args,all)=>{const stmt=owner.check().db.prepare(sql);try{stmt.bind(parameters(args));const rows=[];while(stmt.step()){rows.push(stmt.getAsObject());if(!all)break;}return all?rows:rows[0];}finally{stmt.free();}};
  return {
   all(...args){return query(args,true);},get(...args){return query(args,false);},
   run(...args){const state=owner.check();state.db.run(sql,parameters(args));const changes=state.db.getRowsModified();const lastInsertRowid=state.db.exec('SELECT last_insert_rowid()')[0]?.values[0][0]??0;persist(state);return {changes,lastInsertRowid};}
  };
 }
 transaction(fn){return (...args)=>{
  const s=this.check(),savepoint='bp_'+s.depth;s.db.run('SAVEPOINT '+savepoint);s.depth++;
  try{const result=fn(...args);s.db.run('RELEASE '+savepoint);s.depth--;persist(s);return result;}
  catch(error){s.db.run('ROLLBACK TO '+savepoint);s.db.run('RELEASE '+savepoint);s.depth--;throw error;}
 };}
 close(){if(this.closed)return;const s=this.state;this.closed=true;if(--s.refs===0){persist(s);s.db.close();if(s.file)databases.delete(s.file);}}
}
