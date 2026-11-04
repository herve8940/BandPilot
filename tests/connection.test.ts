import {test} from 'node:test';
import assert from 'node:assert/strict';
import dgram from 'node:dgram';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {broadcastTargets,discoveryTargets,parseIdentity,discoverXR18} from '../src/discovery.js';
import {connectionConfig,ConnectionManager,loadConnection} from '../src/connection.js';
import {XR18} from '../src/xr18.js';
import {encodeOsc,decodeOsc,oscFloat} from '../src/osc.js';
import {permitted,type User} from '../src/access.js';

test('identity uses console name, rejects other models and malformed replies',()=>{
 assert.equal(parseIdentity(encodeOsc('/info',['V0.50','Mon groupe','XR18','1.22']),'127.0.0.1',10024)?.name,'Mon groupe');
 for(const data of [Buffer.from('bad'),encodeOsc('/info',['XR18','wrong','XR16']),encodeOsc('/info',['XR18','XR18']),encodeOsc('/other',['V','name','XR18'])])assert.equal(parseIdentity(data,'127.0.0.1',10024),null);
 assert.equal(parseIdentity(encodeOsc('/xinfo',['192.168.50.10','Console','XR18','1.17']),'192.168.50.10',10024)?.name,'Console');
 assert.deepEqual(broadcastTargets({eth0:[{family:'IPv4',address:'10.1.2.42',netmask:'255.255.254.0',internal:false,cidr:'10.1.2.42/23',mac:'00:00:00:00:00:00'}]}),['10.1.3.255']);
 for(const host of ['999.1.2.3','0.0.0.0','224.0.0.1','host.local'])assert.throws(()=>connectionConfig({mode:'real',host}));
 for(const role of ['guest','musician'] as const){const u:User={id:'u',name:'u',role,buses:[1]};assert.equal(permitted(u,'POST','/api/connection'),false);assert.equal(permitted(u,'GET','/api/discovery'),false);}
});

test('UDP discovery and live switching, no mixer writes, persistence, failure and simulation reset',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'xr18-connect-')),path=join(directory,'connection.json');
 const socket=dgram.createSocket('udp4');await new Promise<void>(r=>socket.bind(0,'127.0.0.1',r));
 const port=(socket.address() as {port:number}).port,commands:{address:string;args:unknown[]}[]=[];
 let mixerReplies=true,identity=true;
 socket.on('message',(data,remote)=>{
  const msg=decodeOsc(data);commands.push(msg);
  if(msg.address==='/info'&&identity)socket.send(encodeOsc('/info',['V0.50','Repetition','XR18','1.22']),remote.port,remote.address);
  if(mixerReplies&&msg.address==='/lr/mix/fader')socket.send(encodeOsc(msg.address,[oscFloat(.25)]),remote.port,remote.address);
 });
 const initial={mode:'simulation' as const,host:'127.0.0.1',port,enableWrites:false};
 const xr=new XR18(initial),manager=new ConnectionManager(xr,path,initial);let resets=0;xr.on('reset',()=>resets++);
 try{
  const found=await discoverXR18(300,['127.0.0.1'],port);assert.equal(found[0]?.name,'Repetition');
  xr.setFader(1,.9);
  const pending=manager.change({mode:'real',host:'127.0.0.1',port});
  await assert.rejects(()=>manager.change(initial),/déjà en cours/);
  const status=await pending;assert.equal(status.mode,'real');assert.equal(status.connected,true);assert.equal(status.writesEnabled,false);
  assert.equal(xr.mainState().fader,.25);assert.equal(xr.listChannels()[0]?.updatedAt,null);
  assert.throws(()=>xr.setFader(1,.1),/disabled/);
  assert.equal((await loadConnection(path,initial)).mode,'real');
  assert.ok(commands.every(c=>!c.args.length||['/meters'].includes(c.address)),'Connecting must not write any mixer value');
  identity=false;await assert.rejects(()=>manager.change({mode:'real',host:'127.0.0.1',port}),/ne répond pas/);
  assert.equal(xr.status().connected,true);identity=true;
  mixerReplies=false;await assert.rejects(()=>manager.change({mode:'real',host:'127.0.0.1',port,enableWrites:true}),/aucune réponse/);
  assert.equal(xr.status().writesEnabled,false);assert.equal((await loadConnection(path,initial)).enableWrites,false);
  await manager.change({mode:'simulation'});assert.equal(xr.status().mode,'simulation');assert.equal(xr.mainState().updatedAt,null);assert.deepEqual(xr.advancedState(),{});assert.equal(xr.meterState().available,false);
  xr.setFader(1,.2);assert.equal(xr.listChannels()[0]?.fader,.2);assert.ok(resets>=3);
  assert.equal((await loadConnection(path,initial)).mode,'simulation');
 }finally{xr.close();socket.close();await rm(directory,{recursive:true,force:true});}
});

test('discovery retries dropped packets, accepts xinfo and records rejected identity without writes',async()=>{
 const socket=dgram.createSocket('udp4');await new Promise<void>(r=>socket.bind(0,'127.0.0.1',r));
 const port=(socket.address() as {port:number}).port;let probes=0;
 socket.on('message',(data,remote)=>{
  const msg=decodeOsc(data);assert.equal(msg.args.length,0);
  if(msg.address==='/info')socket.send(encodeOsc('/info',['V','Other','XR16','1']),remote.port,remote.address);
  if(msg.address==='/xinfo'&&++probes>=2)socket.send(encodeOsc('/xinfo',['127.0.0.1','Retry console','XR18','1']),remote.port,remote.address);
 });
 const diagnostics={received:0,unrecognized:0,sendErrors:[] as string[]};
 try{const found=await discoverXR18(800,['127.0.0.1'],port,diagnostics);assert.equal(found[0]?.name,'Retry console');assert.ok(probes>=2);assert.ok(diagnostics.unrecognized>0);assert.deepEqual(diagnostics.sendErrors,[]);}finally{socket.close();}
});

test('physical XR18V2 firmware 1.23 identity captures are accepted',()=>{
 const info=Buffer.from('/info\0\0\0,ssss\0\0\0V0.04\0\0\0XR18-AA-BB-CC\0\0\0XR18V2\0\0'+'1.23\0\0\0\0','binary');
 const xinfo=Buffer.from('/xinfo\0\0,ssss\0\0\0'+'192.168.50.10\0\0\0XR18-AA-BB-CC\0\0\0XR18V2\0\0'+'1.23\0\0\0\0','binary');
 for(const packet of [info,xinfo]){const found=parseIdentity(packet,'192.168.50.10',10024)!;assert.equal(found.model,'XR18');assert.equal(found.firmware,'1.23');assert.equal(found.name,'XR18-AA-BB-CC');}
 for(const model of ['XR16V2','XR18V3','XR18V2-other'])assert.equal(parseIdentity(encodeOsc('/info',['V','Other',model,'1']),'127.0.0.1',10024),null);
});
test('X18 and MR18 share the XR18 OSC map, as in X-AIR Edit 1.8.1',()=>{
 for(const model of ['X18','X18V2','MR18','MR18V2','xr18'])assert.equal(parseIdentity(encodeOsc('/info',['V0.04','Rack',model,'1.23']),'10.0.0.2',10024)?.model,model.toUpperCase().replace(/V2$/,''));
});
test('unreachable network gets a plain explanation with the macOS Local Network fix',async()=>{
 const {unreachableMessage}=await import('../src/connection.js');
 const m=unreachableMessage('192.168.68.94',10024,['send EHOSTUNREACH 192.168.68.94:10024']);
 assert.match(m,/Réseau local/);assert.match(m,/Détecter et connecter/);assert.match(m,/EHOSTUNREACH/);
 assert.match(unreachableMessage('10.0.0.2',10024,[]),/ne répond pas/);
});
test('discovery also uses the limited broadcast, like X-AIR Edit',()=>{
 const t=discoveryTargets({en0:[{family:'IPv4',address:'192.168.68.20',netmask:'255.255.252.0',internal:false,cidr:'192.168.68.20/22',mac:'00:00:00:00:00:00'}]});
 assert.deepEqual(t,['192.168.71.255','255.255.255.255']);
 assert.deepEqual(discoveryTargets({}),[]);
});
