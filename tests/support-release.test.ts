import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {sanitizeDiagnostic,diagnosticEvents} from '../shared/diagnostic-report.js';
const {newer,checkUpdate,createIssue,findIssue,issueContent}=createRequire(import.meta.url)('../desktop/github-support.cjs');
test('support exports exclude credentials, identity probes and personal paths while keeping the failure',()=>{
 const safe=JSON.stringify(sanitizeDiagnostic({apiKey:'sk-private',cookie:'secret',stack:'Error: Pas de réponse /ch/01 at /Users/alice/private/file.ts:20 from 192.168.1.2',message:'Bearer github_pat_PRIVATE123 user@example.org https://local/?token=abc',action:'/api/coach/prepare'}));
 for(const secret of ['sk-private','alice','192.168.1.2','PRIVATE123','user@example','token=abc'])assert.ok(!safe.includes(secret),secret);
 assert.ok(safe.includes('/ch/01'));assert.ok(safe.includes('/api/coach/prepare'));
 assert.deepEqual(diagnosticEvents('{"event":"discovery.reply","hex":"private"}\n{"event":"coach.error","message":"lost reply"}'),[{event:'coach.error',message:'lost reply'}]);
});
test('updates require a newer stable published installer for this architecture',async()=>{
 assert.equal(newer('2.10.0','2.9.9'),true);assert.equal(newer('2.3.2','2.3.2'),false);assert.equal(newer('2.3.3-dev.1','2.3.2'),false);
 const web='https://github.com/herve8940/BandPilot';
 let release={tag_name:'v2.3.3',html_url:web+'/releases/tag/v2.3.3',draft:false,prerelease:false,assets:[{name:'BandPilot-macOS-2.3.3-x64.dmg',state:'uploaded',size:100,browser_download_url:web+'/releases/download/v2.3.3/BandPilot-macOS-2.3.3-x64.dmg'}]};
 let main='2.3.3';const fetcher=async(url:string)=>new Response(JSON.stringify(url.includes('/contents/')?{version:main}:release));
 assert.equal((await checkUpdate(fetcher,'2.3.2','darwin','x64')).available,true);
 assert.equal((await checkUpdate(fetcher,'2.3.2','darwin','arm64')).available,false);
 release.prerelease=true;assert.equal((await checkUpdate(fetcher,'2.3.2','darwin','x64')).available,false);release.prerelease=false;
 assert.equal((await checkUpdate(fetcher,'2.3.3-dev.1','darwin','x64')).available,true);
 assert.equal((await checkUpdate(fetcher,'2.4.0-dev.1','darwin','x64')).available,false);
 release.assets[0]!.browser_download_url='https://example.com/untrusted';assert.equal((await checkUpdate(fetcher,'2.3.2','darwin','x64')).available,false);
 await assert.rejects(checkUpdate(async()=>new Response('',{status:403}),'2.3.2','darwin','x64'),/GitHub/);
});
test('GitHub reports are sent only to the fixed repository with an id for duplicate recovery',async()=>{
 const report={id:'abc-123',app:{version:'2.3.2'},summary:'Ajout instrument',events:[{event:'coach.error'}]};
 const calls:any[]=[];const fetcher=async(url:string,options:any)=>{calls.push({url,options});return new Response(JSON.stringify({number:42,html_url:'https://github.com/herve8940/BandPilot/issues/42'}));};
 const issue=await createIssue(fetcher,'private-fixture-token',report);assert.equal(issue.number,42);assert.equal(calls[0].url,'https://api.github.com/repos/herve8940/BandPilot/issues');assert.equal(calls[0].options.method,'POST');
 assert.equal(calls[0].options.headers.Authorization,'Bearer private-fixture-token');assert.ok(!calls[0].options.body.includes('private-fixture-token'));assert.match(calls[0].options.body,/bandpilot-report:abc-123/);
 const body=issueContent(report).body;
 const found=await findIssue(async()=>new Response(JSON.stringify({items:[{number:42,html_url:issue.url,body}]})),'token','abc-123');assert.equal(found.number,42);
 await assert.rejects(createIssue(async()=>new Response('',{status:401}),'token',report),/refuse/);
});
