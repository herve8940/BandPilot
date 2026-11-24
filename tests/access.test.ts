import {test} from 'node:test';
import assert from 'node:assert/strict';
import {Access,permitted,sameOrigin,type User} from '../src/access.js';
import type {IncomingMessage} from 'node:http';
test('accounts disable anonymous local access, sessions authenticate and logout invalidates',()=>{const a=new Access(':memory:');const req={headers:{}} as IncomingMessage;try{assert.equal(a.user(req)?.role,'admin');a.create('Herve','long-password-123','admin',[]);assert.equal(a.user(req),null);assert.throws(()=>a.login('Herve','incorrect'));const token=a.login('Herve','long-password-123');req.headers.cookie='xr18_session='+token;assert.equal(a.user(req)?.name,'Herve');a.logout(req);assert.equal(a.user(req),null);}finally{a.close();}});
test('musician only writes own bus, guests cannot write, management admin only',()=>{const u:User={id:'1',name:'Musicien',role:'musician',buses:[2]};assert.equal(permitted(u,'POST','/api/monitor/2/channels/1'),true);for(const p of ['/api/monitor/3/channels/1','/api/channels/1/fader','/api/osc/advanced/write','/api/users','/api/library','/api/rehearsal-desk/import-songs'])assert.equal(permitted(u,'POST',p),false);assert.equal(permitted({...u,role:'guest'},'POST','/api/monitor/2/channels/1'),false);assert.equal(permitted(u,'GET','/api/users'),false);assert.equal(permitted(u,'GET','/api/channels'),true);});
test('reject forged hosts and cross-origin browser requests',()=>{const req=(host:string,origin?:string)=>({headers:{host,origin}} as IncomingMessage);assert.equal(sameOrigin(req('127.0.0.1:3000','http://127.0.0.1:3000')),true);assert.equal(sameOrigin(req('127.0.0.1:3000','https://attacker.example')),false);assert.equal(sameOrigin(req('attacker.example:3000')),false);});

test('HTTPS LAN origins require an allowed host, matching scheme and matching port',()=>{
 const previous=process.env.XR18_ALLOWED_HOSTS;process.env.XR18_ALLOWED_HOSTS='studio.band.local';
 const req=(origin:string)=>({headers:{host:'studio.band.local:3443',origin},socket:{encrypted:true}} as unknown as IncomingMessage);
 try{assert.equal(sameOrigin(req('https://studio.band.local:3443')),true);assert.equal(sameOrigin(req('http://studio.band.local:3443')),false);assert.equal(sameOrigin(req('https://studio.band.local:4443')),false);}
 finally{if(previous===undefined)delete process.env.XR18_ALLOWED_HOSTS;else process.env.XR18_ALLOWED_HOSTS=previous;}
});

test('account changes revoke sessions and cannot remove or demote the last administrator',()=>{
 const a=new Access(':memory:');try{
  const admin=a.create('Admin','long-admin-password','admin',[]),u=a.create('Musician','long-musician-password','musician',[1]);
  const token=a.login('Musician','long-musician-password');const req={headers:{cookie:'xr18_session='+token}} as IncomingMessage;assert.ok(a.user(req));
  a.update(u.id,'musician',[2]);assert.equal(a.user(req),null);assert.deepEqual(a.list().find(x=>x.id===u.id)?.buses,[2]);
  assert.throws(()=>a.remove(admin.id),/administrateur/);assert.throws(()=>a.update(admin.id,'guest',[]),/administrateur/);a.remove(u.id);assert.equal(a.list().length,1);
 }finally{a.close();}
});

