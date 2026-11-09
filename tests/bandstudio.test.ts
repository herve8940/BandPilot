import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,readdir,readFile,rename,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {BandStudio} from '../src/bandstudio.js';
import {permitted} from '../src/access.js';
test('BandStudio local exchange binds project and session, no automatic retry',async()=>{
 const folder=await mkdtemp(join(tmpdir(),'bandstudio-'));const client=new BandStudio(folder,300);
 const state={version:1,session:'local-session',updated:Date.now()/1000,projectID:'song-a',name:'Session'};
 try{
  await assert.rejects(client.state(),/Relier BandPilot/);
  await writeFile(join(folder,'state.json'),JSON.stringify(state));
  await assert.rejects(client.command({action:'record'},'song-b'),/projet.*changé/);
  await assert.rejects(client.command({action:'shell'},'song-a'),/inconnue/);
  const command=client.command({action:'marker'},'song-a');
  let request:string|undefined;for(let i=0;i<20&&!request;i++){request=(await readdir(folder)).find(n=>/^request-.*\.json$/.test(n));if(!request)await new Promise(r=>setTimeout(r,10));}
  assert.ok(request);const payload=JSON.parse(await readFile(join(folder,request),'utf8'));
  assert.equal(payload.session,state.session);assert.equal(payload.projectID,'song-a');assert.equal(payload.args.action,'marker');
  const response=join(folder,`response-${payload.id}.json`);await writeFile(response+'.tmp',JSON.stringify({ok:true,state}));await rename(response+'.tmp',response);
  assert.equal((await command).projectID,'song-a');
  await assert.rejects(client.command({action:'record'},'song-a'),/n’est pas répétée/);
  assert.deepEqual(await readdir(folder),['state.json']);
  await writeFile(join(folder,'state.json'),JSON.stringify({...state,updated:0}));await assert.rejects(client.state(),/répond plus/);
 }finally{await rm(folder,{recursive:true,force:true});}
});
test('BandStudio controls and state remain administrator-only',()=>{
 const musician={id:'musician',name:'Musicien',role:'musician' as const,buses:[1]};
 assert.equal(permitted(musician,'GET','/api/bandstudio'),false);
 assert.equal(permitted(musician,'POST','/api/bandstudio/command'),false);
 assert.equal(permitted({...musician,role:'admin'},'POST','/api/bandstudio/command'),true);
});
