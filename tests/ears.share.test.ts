import test from "node:test";
import assert from "node:assert/strict";
import {mkdtempSync} from "node:fs";
import {tmpdir} from "node:os";
import {join} from "node:path";
import WebSocket from "ws";
import {XR18} from "../src/xr18.js";
import {EarsShare,earAddressKind,earSafeValue,EAR_CAP,EAR_MAX_RAISE,lanAddresses} from "../src/ears.js";

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
