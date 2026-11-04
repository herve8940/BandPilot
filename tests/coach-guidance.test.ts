import test from 'node:test';
import assert from 'node:assert/strict';
import {coachMeters,coachNext} from '../web/src/coach-guidance.js';
const base={simulation:false,connected:true,online:true,inputs:2,completed:[] as string[],meters:[] as {channel:number;name:string;db:number|null}[]};
test('coach overview: missing or stale measurements are unknown, not silence or zero dBFS',()=>{
 const inputs=[{channel:2,name:'Basse'},{channel:4,name:'Voix'}];
 assert.deepEqual(coachMeters(inputs,[-12,0],false).map(m=>m.db),[null,null]);
 assert.deepEqual(coachMeters(inputs,[-12,NaN],true).map(m=>m.db),[null,null]);
 assert.deepEqual(coachMeters(inputs,[-12,-4,-18,-128],true).map(m=>m.db),[-4,-128]);
 assert.equal(coachNext({...base,meters:coachMeters(inputs,[-12,0],false)}).tone,'neutral');
});
test('coach overview: a disconnected console precedes level warnings; simulation never claims a real overload',()=>{
 const meters=[{channel:2,name:'Basse',db:0}];
 assert.equal(coachNext({...base,meters,connected:false}).step,'connect');
 assert.equal(coachNext({...base,meters,online:false}).step,'connect');
 assert.equal(coachNext({...base,meters,simulation:true}).channel,undefined);
 assert.equal(coachNext({...base,meters,simulation:true}).tone,'neutral');
});
test('coach overview: a high received level targets the correct instrument without producing mixer commands',()=>{
 const next=coachNext({...base,completed:['levels','tone','ears'],meters:[{channel:1,name:'Voix',db:-2},{channel:5,name:'Kick',db:-.5},{channel:6,name:'Tom',db:null}]});
 assert.equal(next.step,'levels');assert.equal(next.channel,5);assert.equal(next.tone,'warn');
 assert.match(next.title,/Kick/);assert.equal('changes' in next,false);
});
test('coach overview: navigation respects missing setup and user-checked steps',()=>{
 assert.equal(coachNext({...base,inputs:0}).step,'inputs');
 assert.equal(coachNext(base).step,'levels');
 assert.equal(coachNext({...base,completed:['levels']}).step,'tone');
 assert.equal(coachNext({...base,completed:['levels','tone']}).step,'ears');
 assert.equal(coachNext({...base,completed:['levels','tone','ears']}).step,'save');
});
test('coach overview: manually checking every step never hides missing or stale calibration',()=>{
 const state={...base,completed:['levels','tone','ears','save'],meters:[{channel:1,name:'Voix',db:-15},{channel:2,name:'Basse',db:-20}]};
 const stale=coachNext({...state,calibration:[{channel:1,name:'Voix',state:'stale'},{channel:2,name:'Basse',state:'todo'}]});
 assert.equal(stale.step,'levels');assert.equal(stale.channel,1);assert.equal(stale.tone,'warn');
 const missing=coachNext({...state,calibration:[{channel:1,name:'Voix',state:'ok'}]});
 assert.equal(missing.step,'levels');assert.equal(missing.channel,2);
 assert.equal(coachNext({...state,calibration:null}).step,'levels');
 assert.equal(coachNext({...state,calibration:[{channel:1,name:'Voix',state:'ok'},{channel:2,name:'Basse',state:'ok'}]}).step,'save');
});
