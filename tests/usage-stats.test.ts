import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {UsageStats,usageEndpoint,usagePlatform,usageDisabledByEnvironment,type UsageReport} from '../src/usage-stats.js';
import {USAGE_ENDPOINT} from '../shared/usage-endpoint.js';
// @ts-expect-error The counter is plain JavaScript for Cloudflare Workers.
import {validReport} from '../services/usage-counter/worker.js';

const ENDPOINT='https://counter.example/v1/ping';
async function setup(options:{endpoint?:string;ok?:boolean;fail?:boolean;day?:string;build?:string}={}){
 const dir=await mkdtemp(join(tmpdir(),'bandpilot-usage-'));const path=join(dir,'usage-stats.json');
 const sent:{url:string;report:UsageReport}[]=[];let day=options.day??'2026-11-15';
 const stats=new UsageStats(path,{endpoint:'endpoint' in options?options.endpoint:ENDPOINT,version:'2.3.11',build:options.build??'release',platform:'windows',now:()=>new Date(day+'T12:00:00Z'),
  fetch:(async(url:string,init:RequestInit)=>{if(options.fail)throw Error('offline');sent.push({url,report:JSON.parse(String(init.body))});return new Response(null,{status:options.ok===false?500:204});}) as typeof fetch});
 return {stats,path,sent,setDay:(value:string)=>{day=value;}};
}

test('the release build ships with the counter switched off until an address is configured',async()=>{
 assert.equal(USAGE_ENDPOINT,'');
 const {stats,sent}=await setup({endpoint:''});
 assert.deepEqual(await stats.snapshot(),{available:false,enabled:true,noticeSeen:false});
 await stats.update({noticeSeen:true});
 assert.equal(await stats.send('XR18'),'unavailable');assert.equal(sent.length,0);
});

test('nothing is sent before the notice, then one minimal message per day',async()=>{
 const {stats,sent,setDay,path}=await setup();
 assert.deepEqual(await stats.snapshot(),{available:true,enabled:true,noticeSeen:false});
 assert.equal(await stats.send('XR18'),'waiting-notice');assert.equal(sent.length,0);
 await stats.update({noticeSeen:true});
 assert.equal(await stats.send('XR18'),'sent');
 assert.equal(await stats.send('XR18'),'already-sent');
 assert.equal(sent.length,1);
 const {report,url}=sent[0]!;
 assert.equal(url,ENDPOINT);
 assert.deepEqual(Object.keys(report).sort(),['channel','day','id','model','platform','schema','version']);
 assert.match(report.id,/^[0-9a-f-]{36}$/);
 assert.deepEqual({...report,id:'x'},{schema:1,id:'x',day:'2026-11-15',version:'2.3.11',platform:'windows',channel:'release',model:'XR18'});
 setDay('2026-11-16');
 assert.equal(await stats.send('X32'),'sent');
 assert.equal(sent[1]!.report.id,report.id,'the same random number identifies the installation');
 assert.equal(validReport(sent[1]!.report,'2026-11-16')?.model,'X32','the counter accepts what the app sends');
 const saved=JSON.parse(await readFile(path,'utf8'));
 assert.deepEqual({...saved,id:'x'},{enabled:true,noticeSeen:true,id:'x',lastSent:'2026-11-16'});
});

test('turning the counter off stops sending and erases the random number',async()=>{
 const {stats,sent,path,setDay}=await setup();
 await stats.update({noticeSeen:true});await stats.send('XR18');
 assert.deepEqual(await stats.update({enabled:false}),{available:true,enabled:false,noticeSeen:true});
 assert.deepEqual(JSON.parse(await readFile(path,'utf8')),{enabled:false,noticeSeen:true});
 setDay('2026-11-16');
 assert.equal(await stats.send('XR18'),'disabled');assert.equal(sent.length,1);
 await stats.update({enabled:true});
 assert.equal(await stats.send('XR18'),'sent');
 assert.notEqual(sent[1]!.report.id,sent[0]!.report.id,'a new number is drawn after re-enabling');
});

test('failures never throw and are retried later; odd values are neutralised',async()=>{
 const offline=await setup({fail:true});await offline.stats.update({noticeSeen:true});
 assert.equal(await offline.stats.send('XR18'),'failed');
 const refused=await setup({ok:false});await refused.stats.update({noticeSeen:true});
 assert.equal(await refused.stats.send('XR18'),'failed');
 assert.equal(await refused.stats.send('XR18'),'failed','not marked as sent');
 const source=await setup({build:'source'});await source.stats.update({noticeSeen:true});
 await source.stats.send('<script>');
 assert.equal(source.sent[0]!.report.channel,'source');assert.equal(source.sent[0]!.report.model,'other');
 await assert.rejects(source.stats.update({enabled:'yes'}),/Préférence invalide/);
 await assert.rejects(source.stats.update({noticeSeen:false}),/Préférence invalide/);
});

test('a damaged preference file falls back to the defaults',async()=>{
 const {stats,path}=await setup();
 await writeFile(path,'{"enabled":"no","id":"../../etc","lastSent":"hier"}');
 assert.deepEqual(await stats.snapshot(),{available:true,enabled:true,noticeSeen:false});
});

test('only HTTPS addresses, real platforms and non-automated runs count',()=>{
 assert.equal(usageEndpoint('http://counter.example/v1/ping'),undefined);
 assert.equal(usageEndpoint('https://user:pw@counter.example/'),undefined);
 assert.equal(usageEndpoint(' https://counter.example/v1/ping '),ENDPOINT);
 assert.equal(usagePlatform({BANDPILOT_ANDROID:'1'},'linux'),'android');
 assert.equal(usagePlatform({},'win32'),'windows');assert.equal(usagePlatform({},'darwin'),'macos');
 assert.ok(usageDisabledByEnvironment({CI:'true'}));assert.ok(usageDisabledByEnvironment({BANDPILOT_USAGE_STATS:'0'}));
 assert.ok(!usageDisabledByEnvironment({}));
 const disabled=new UsageStats('/nonexistent/usage.json',{endpoint:ENDPOINT,version:'1',build:'release',platform:'linux',disabled:true});
 assert.equal(disabled.available,false);
});

test('the counter refuses malformed or out-of-date messages',()=>{
 const good={schema:1,id:'0f8fad5b-d9cb-469f-a165-70867728950e',day:'2026-11-15',version:'2.3.11',platform:'android',channel:'release',model:'XR18'};
 assert.ok(validReport(good,'2026-11-15'));
 assert.equal(validReport({...good,day:'2026-11-10'},'2026-11-15'),null);
 assert.equal(validReport({...good,platform:'ios'},'2026-11-15'),null);
 assert.equal(validReport({...good,id:'not-random'},'2026-11-15'),null);
 assert.equal(validReport({...good,model:'x'.repeat(40)},'2026-11-15'),null);
 assert.deepEqual(Object.keys(validReport({...good,extra:'ignored'},'2026-11-15')).sort(),['channel','day','id','model','platform','version']);
});
