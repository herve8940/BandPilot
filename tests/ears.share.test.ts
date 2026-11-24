import Database from 'better-sqlite3';
import test from "node:test";
import assert from "node:assert/strict";
import {mkdirSync,mkdtempSync,writeFileSync} from "node:fs";
import {gzipSync} from "node:zlib";
import {tmpdir} from "node:os";
import {join} from "node:path";
import WebSocket from "ws";
import {XR18} from "../src/xr18.js";
import {EarsShare,earAddressKind,earSafeValue,EAR_CAP,EAR_MAX_RAISE,lanAddresses} from "../src/ears.js";

test("phone caches only versioned assets and serves the same content with and without gzip",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"ears-assets-"));
 mkdirSync(join(dir,"assets"));
 const asset="ears-12345678.js", source="const ready=true;";
 writeFileSync(join(dir,"assets",asset),source);
 writeFileSync(join(dir,"assets",asset+".gzip"),gzipSync(source));
 writeFileSync(join(dir,"ears.html"),"<title>Monitor</title>");
 const xr=new XR18({mode:"simulation",host:"127.0.0.1",port:10024,enableWrites:false});
 const ears=new EarsShare(join(dir,"db.sqlite"),xr,()=>dir,()=>null,()=>{});
 try {
  const share=ears.create("Test",1), {port}=await ears.start(0);
  const base="http://127.0.0.1:"+port;
  for(const [accept,encoded] of [["gzip","gzip"],["gzip;q=0, identity",null],["identity",null]] as const){
   const r=await fetch(base+"/assets/"+asset,{headers:{"Accept-Encoding":accept}});
   assert.equal(r.headers.get("content-encoding"),encoded);
   assert.match(r.headers.get("cache-control")??"",/immutable/);
   assert.equal(r.headers.get("vary"),"Accept-Encoding");
   assert.equal(await r.text(),source);
  }
  for(const path of ["/ears/"+share.token,"/ears-api/"+share.token+"/profiles"]){
   const r=await fetch(base+path);assert.equal(r.status,200);assert.equal(r.headers.get("cache-control"),"no-store");
  }
 }finally{await ears.stop();ears.close();xr.close();}
});

test("a monitor link only reaches its own bus",()=>{
 assert.equal(earAddressKind(2,"/ch/05/mix/02/level"),"level");
 assert.equal(earAddressKind(2,"/rtn/aux/mix/02/level"),"level");
 assert.equal(earAddressKind(2,"/bus/2/mix/fader"),"level");
 assert.equal(earAddressKind(2,"/bus/2/mix/on"),"mute");
 for(const a of ["/ch/05/mix/03/level","/ch/05/mix/fader","/lr/mix/fader","/bus/3/mix/fader","/headamp/01/phantom","/ch/05/mix/02/tap"])assert.equal(earAddressKind(2,a),null,a);
});
test("phone levels are capped at 0 dB and raised progressively, lowering is free",()=>{
 assert.equal(earSafeValue("level",1,EAR_CAP),EAR_CAP);
 assert.equal(earSafeValue("level",.7,.2),.2+EAR_MAX_RAISE);
 assert.equal(earSafeValue("level",0,.7),0);
 assert.throws(()=>earSafeValue("mute",.5,1));
 assert.throws(()=>earSafeValue("level","x",0));
});
test("virtual adapters are listed after real network cards",()=>{
 const list=lanAddresses({docker0:[{address:"172.17.0.1",family:"IPv4",internal:false} as never],en0:[{address:"192.168.1.20",family:"IPv4",internal:false} as never],lo:[{address:"127.0.0.1",family:"IPv4",internal:true} as never]});
 assert.deepEqual(list,["192.168.1.20","172.17.0.1"]);
});

const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
async function waitFor(ok:()=>boolean,ms=3000){for(const end=Date.now()+ms;!ok()&&Date.now()<end;)await wait(20);}
test("QR link: snapshot, capped control, refusal outside the bus, revocation",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"ears-"));
 const xr=new XR18({mode:"simulation",host:"127.0.0.1",port:10024,enableWrites:false});
 await xr.syncLiveView();
 let busy=false;
 const ears=new EarsShare(join(dir,"db.sqlite"),xr,()=>undefined,()=>busy?"occupé":null,()=>{});
 try{
  const share=ears.create("Hervé",3);
  const status=await ears.start(0);
  assert.ok(status.running&&status.port>0);
  const bad=new WebSocket(`ws://127.0.0.1:${status.port}/ears-ws?token=nope`);
  await new Promise<void>(r=>{bad.on("error",()=>r());bad.on("unexpected-response",()=>r());});
  const ws=new WebSocket(`ws://127.0.0.1:${status.port}/ears-ws?token=${share.token}`);
  const messages:Record<string,unknown>[]=[];ws.on("message",d=>messages.push(JSON.parse(String(d))));
  await new Promise(r=>ws.once("open",r));await waitFor(()=>messages.some(m=>m.type==="snapshot"));
  const snap=messages.find(m=>m.type==="snapshot") as {share:{bus:number};values:Record<string,unknown>};
  assert.equal(snap.share.bus,3);
  assert.ok(Object.keys(snap.values).every(a=>/\/(mix\/03\/level|config\/(name|color)|mix\/on)$/.test(a)||a.startsWith("/bus/3/")),"only bus 3 data is shared");
  xr.liveSet("/ch/01/mix/03/level",.7);
  ws.send(JSON.stringify({type:"set",address:"/ch/01/mix/03/level",value:1}));await waitFor(()=>xr.parameterState()["/ch/01/mix/03/level"]!.value===EAR_CAP);
  assert.equal(xr.parameterState()["/ch/01/mix/03/level"]!.value,EAR_CAP);
  ws.send(JSON.stringify({type:"set",address:"/ch/01/mix/fader",value:1}));await waitFor(()=>messages.some(m=>m.type==="error"));
  assert.ok(messages.some(m=>m.type==="error"),"front-of-house fader is refused");
  busy=true;ws.send(JSON.stringify({type:"set",address:"/bus/3/mix/on",value:0}));await waitFor(()=>messages.filter(m=>m.type==="error").length>=2);busy=false;
  assert.ok(messages.filter(m=>m.type==="error").length>=2,"blocked while an operation runs");
  const closed=new Promise(r=>ws.once("close",r));ears.regenerate(share.id);await closed;
  const page=await fetch(`http://127.0.0.1:${status.port}/ears/${share.token}`);
  assert.equal(page.status,404,"old QR code no longer works");
  const qr=await ears.qr(share.id).catch(()=>null);
  if(qr)assert.match(qr.svg,/<svg/);
 }finally{await ears.stop();ears.close();xr.close();}
});

test("phone: a saved monitor profile can be deleted (and only by its own link)",async()=>{
 const dir=mkdtempSync(join(tmpdir(),"ears-"));
 const xr=new XR18({mode:"simulation",host:"127.0.0.1",port:10024,enableWrites:false});
 const ears=new EarsShare(join(dir,"db.sqlite"),xr,()=>undefined,()=>null,()=>{});
 try{
  const mine=ears.create("Hervé",1),other=ears.create("Pascal",2);
  const {port}=await ears.start(0),base=`http://127.0.0.1:${port}/ears-api`;
  const saved=await (await fetch(`${base}/${mine.token}/profiles`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({name:"Concert"})})).json() as {id:string};
  assert.ok(saved.id);
  const foreign=await fetch(`${base}/${other.token}/profiles/${saved.id}`,{method:"DELETE"});
  assert.equal(foreign.status,200);assert.equal(((await foreign.json()) as {deleted:number}).deleted,0,"another musician cannot delete it");
  const r=await fetch(`${base}/${mine.token}/profiles/${saved.id}`,{method:"DELETE"});
  assert.equal(r.status,200);assert.deepEqual(await r.json(),{ok:true,deleted:1});
  assert.deepEqual(await (await fetch(`${base}/${mine.token}/profiles`)).json(),[]);
 }finally{await ears.stop();ears.close();xr.close();}
});

test('an already open phone updates control permissions on connection changes without reloading',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'ears-permissions-'));
 const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false});
 const base=xr.status.bind(xr);let enabled=false;
 xr.status=()=>({...base(),mode:'real',connected:true,writesEnabled:enabled});
 const ears=new EarsShare(join(dir,'db.sqlite'),xr,()=>undefined,()=>null,()=>{});
 let ws:WebSocket|undefined;
 try{
  const share=ears.create('Test',1),{port}=await ears.start(0);
  const snapshots:{type:string;control:boolean}[]=[];
  ws=new WebSocket(`ws://127.0.0.1:${port}/ears-ws?token=${share.token}`);
  ws.on('message',raw=>snapshots.push(JSON.parse(String(raw))));
  await new Promise(r=>ws!.once('open',r));await waitFor(()=>snapshots.length>0);
  assert.equal(snapshots.at(-1)?.control,false);
  enabled=true;xr.emit('connection');await waitFor(()=>snapshots.at(-1)?.control===true);
  assert.equal(snapshots.at(-1)?.control,true);
  enabled=false;xr.emit('connection');await waitFor(()=>snapshots.at(-1)?.control===false);
  assert.equal(snapshots.at(-1)?.control,false);
 }finally{ws?.terminate();await ears.stop();ears.close();xr.close();}
});

test('stereo phone explicitly owns one linked pair: pan, paired levels, recall and unlink protection',async()=>{
 const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false});await xr.syncLiveView();
 const ears=new EarsShare(':memory:',xr,()=>undefined,()=>null,()=>{});let ws:WebSocket|undefined;
 try{
  await assert.rejects(ears.createStereo('Stereo',1),/Lie d’abord/);
  await xr.writeParameter('/config/buslink/1-2',1);const share=await ears.createStereo('Stereo',1);assert.equal(share.stereo,true);
  const {port}=await ears.start(0);ws=new WebSocket(`ws://127.0.0.1:${port}/ears-ws?token=${share.token}`);
  const messages:any[]=[];ws.on('message',d=>messages.push(JSON.parse(String(d))));await new Promise(r=>ws!.once('open',r));await waitFor(()=>messages.length>0);
  assert.equal(messages[0].share.stereo,true);const set=(address:string,value:number)=>ws!.send(JSON.stringify({type:'set',address,value}));
  set('/ch/01/mix/01/pan',.9);await waitFor(()=>xr.parameterState()['/ch/01/mix/01/pan']?.value===.9);assert.equal(await xr.readParameter('/ch/01/mix/01/pan'),.9);
  await xr.writeParameter('/ch/01/mix/01/level',.2);await xr.writeParameter('/ch/01/mix/02/level',.1);
  set('/ch/01/mix/01/level',.7);await waitFor(()=>xr.parameterState()['/ch/01/mix/02/level']?.value===.25);assert.equal(await xr.readParameter('/ch/01/mix/01/level'),.25);assert.equal(await xr.readParameter('/ch/01/mix/02/level'),.25);
  const base=`http://127.0.0.1:${port}/ears-api/${share.token}/profiles`,saved=await (await fetch(base,{method:'POST',body:JSON.stringify({name:'Stereo fixture'})})).json() as {id:string;values:Record<string,number>};assert.equal(saved.values['/ch/01/mix/01/pan'],.9);
  await xr.writeParameter('/ch/01/mix/01/pan',.1);const recalled=await fetch(`${base}/${saved.id}/recall`,{method:'POST'});assert.equal(recalled.status,200);assert.equal(await xr.readParameter('/ch/01/mix/01/pan'),.9);
  set('/ch/01/mix/03/level',.6);await waitFor(()=>messages.some(m=>m.type==='error'));assert.ok(messages.some(m=>m.type==='error'));
  await xr.writeParameter('/config/buslink/1-2',0);const before=await xr.readParameter('/ch/01/mix/01/pan');set('/ch/01/mix/01/pan',.1);await waitFor(()=>messages.some(m=>String(m.error).includes('liaison stéréo')));assert.equal(await xr.readParameter('/ch/01/mix/01/pan'),before);
  assert.equal((await fetch(`${base}/${saved.id}/recall`,{method:'POST'})).status,400);
 }finally{ws?.terminate();await ears.stop();ears.close();xr.close();}
});
test('stereo access never extends a mono link and rejects missing output pairs',async()=>{
 assert.equal(earAddressKind(1,'/ch/01/mix/01/pan'),null);assert.equal(earAddressKind(1,'/ch/01/mix/01/pan',true),'pan');assert.equal(earAddressKind(1,'/ch/01/mix/02/pan',true),null);
 assert.equal(earSafeValue('pan',1,.5),1);assert.throws(()=>earSafeValue('pan',1.1,.5));
 const xr=new XR18({mode:'simulation',model:'XR12',host:'127.0.0.1',port:10024,enableWrites:false}),ears=new EarsShare(':memory:',xr,()=>undefined,()=>null,()=>{});
 try{await assert.rejects(ears.createStereo('Bad',3),/indisponible/);await assert.rejects(ears.createStereo('Bad',2),/indisponible/);assert.equal(ears.create('Old mono',1).stereo,false);}finally{ears.close();xr.close();}
});

test('upgrading an old mono-share database preserves its token, bus and saved mix without audio writes',async()=>{
 const dir=mkdtempSync(join(tmpdir(),'ears-legacy-')),file=join(dir,'old.sqlite'),old=new Database(file);
 old.exec(`CREATE TABLE ear_shares(id TEXT PRIMARY KEY,name TEXT NOT NULL,bus INTEGER NOT NULL,token TEXT NOT NULL UNIQUE,created_at TEXT NOT NULL);
 CREATE TABLE ear_mix_profiles(id TEXT PRIMARY KEY,share_id TEXT NOT NULL,name TEXT NOT NULL,values_json TEXT NOT NULL,updated_at TEXT NOT NULL)`);
 old.prepare('INSERT INTO ear_shares VALUES(?,?,?,?,?)').run('old-id','Legacy',2,'legacy-token','2025-01-01');
 old.prepare('INSERT INTO ear_mix_profiles VALUES(?,?,?,?,?)').run('mix-id','old-id','Legacy mix',JSON.stringify({'/ch/01/mix/02/level':.3}),'2025-01-01');old.close();
 const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false});let writes=0;xr.liveSet=(_address,value)=>{writes++;return value;};
 const ears=new EarsShare(file,xr,()=>undefined,()=>null,()=>{});
 try{assert.equal(ears.list()[0]?.token,'legacy-token');assert.equal(ears.list()[0]?.bus,2);assert.equal(ears.list()[0]?.stereo,false);assert.equal(ears.profiles('old-id')[0]?.values['/ch/01/mix/02/level'],.3);assert.equal(writes,0);}finally{ears.close();xr.close();}
});

test('prepared roster replaces former musicians, keeps valid QR links and isolates personal mixes across restarts',async()=>{
 const file=join(mkdtempSync(join(tmpdir(),'ears-roster-')),'group.sqlite');
 const xr=new XR18({mode:'simulation',host:'127.0.0.1',port:10024,enableWrites:false,autoSync:false});
 let ears=new EarsShare(file,xr,()=>undefined,()=>null);
 try{
  const old=ears.create('Alex',1),kept=ears.create('Sam',2);
  ears.create('Jo',3);ears.create('Robin',4);ears.create('Chris',5);ears.assignManager(old.id);
  const {port}=await ears.start(0);
  const url=(token:string)=>`http://127.0.0.1:${port}/ears-api/${token}/profiles`;
  const saved=await (await fetch(url(old.token),{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:'Répétition'})})).json() as {id:string};
  assert.ok(saved.id);
  const ws=new WebSocket(`ws://127.0.0.1:${port}/ears-ws?token=${old.token}`);
  await new Promise(r=>ws.once('open',r));
  const closed=new Promise<number>(r=>ws.once('close',r));
  const before=xr.parameterState(),roster=[{name:'Lou',bus:1},{name:'Sam',bus:2}];
  const plan=await ears.prepareRoster(roster);assert.equal(ears.list().length,5);
  assert.deepEqual(plan.commit(),{created:1,retired:4});
  assert.equal(await closed,4001);assert.equal((await fetch(url(old.token))).status,401);
  assert.equal((await fetch(url(kept.token))).status,200);
  const next=ears.list()[0]!;assert.deepEqual(await (await fetch(url(next.token))).json(),[]);
  assert.equal(ears.status().managerId,null);assert.deepEqual(ears.list()[1],kept);
  assert.deepEqual((await ears.prepareRoster(roster)).commit(),{created:0,retired:0});
  assert.deepEqual(xr.parameterState(),before);
  await ears.stop();ears.close();ears=new EarsShare(file,xr,()=>undefined,()=>null);
  assert.deepEqual(ears.list(),[next,kept]);assert.equal(ears.status().running,false);
  (await ears.prepareRoster([{name:'Alex',bus:1}],1)).commit();
  const restored=ears.list()[0]!;assert.equal(restored.id,old.id);assert.notEqual(restored.token,old.token);
  assert.equal(ears.profiles(restored.id)[0]?.id,saved.id);assert.equal(ears.status().managerId,null);
  assert.deepEqual(ears.list()[1],kept);
 }finally{await ears.stop();ears.close();xr.close();}
});

test('prepared stereo return uses the linked pair and rejects conflicts on an XR12 before retiring any QR',async()=>{
 const xr=new XR18({mode:'simulation',model:'XR12',host:'127.0.0.1',port:10024,enableWrites:false,autoSync:false});
 const ears=new EarsShare(':memory:',xr,()=>undefined,()=>null);
 try{
  const old=ears.create('Ancien',2);
  await xr.writeParameter('/config/buslink/1-2',1);
  await assert.rejects(ears.prepareRoster([{name:'A',bus:1},{name:'B',bus:2}],2),/même paire/);
  await assert.rejects(ears.prepareRoster([{name:'C',bus:3}]),/absente/);
  assert.deepEqual(ears.list(),[old]);
  (await ears.prepareRoster([{name:'Duo',bus:2}],2)).commit();
  assert.deepEqual(ears.list().map(({name,bus,stereo})=>({name,bus,stereo})),[{name:'Duo',bus:1,stereo:true}]);
  const kept=ears.list()[0];(await ears.prepareRoster([{name:'Duo',bus:1}])).commit();assert.deepEqual(ears.list(),[kept]);
  (await ears.prepareRoster([])).commit();assert.deepEqual(ears.list(),[]);
 }finally{ears.close();xr.close();}
});
