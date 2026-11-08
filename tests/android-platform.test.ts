import test from 'node:test';
import assert from 'node:assert/strict';
import {nativeAccess} from '../src/native-access.js';
import {androidUpdate} from '../src/android-updates.js';
import {consoleName} from '../src/sound-coach.js';
test('Android preserves Latin names even when its runtime has no ICU normalization',()=>{
 const original=String.prototype.normalize;
 try{String.prototype.normalize=function(){return String(this);};assert.equal(consoleName('Basse Éric'),'Basse Eric');assert.equal(consoleName('Chœur Léa'),'Choeur Lea');assert.equal(consoleName('João Müller'),'Joao Muller');}
 finally{String.prototype.normalize=original;}
});
test('Android loopback requires its private launch token for HTTP and WebSocket requests',()=>{
 const token='a'.repeat(64),request=(headers:object)=>({headers}) as never;
 assert.equal(nativeAccess(request({}),token),false);
 assert.equal(nativeAccess(request({cookie:'bandpilot_native='+'b'.repeat(64)}),token),false);
 assert.equal(nativeAccess(request({cookie:'other=x; bandpilot_native='+token}),token),true);
 assert.equal(nativeAccess(request({'x-bandpilot-native-token':token}),token),true);
});
test('Android updates select a published APK and ignore desktop installers and foreign URLs',async()=>{
 const version='2.4.0-android.2',tag='android-v'+version,name=`BandPilot-Android-${version}-universal.apk`,url=`https://github.com/herve8940/BandPilot/releases/download/${tag}/${name}`;
 const release={tag_name:tag,draft:false,assets:[{name,state:'uploaded',size:10,browser_download_url:url}]};
 const fetcher=(releases:unknown[])=>async()=>new Response(JSON.stringify(releases));
 assert.equal((await androidUpdate('2.4.0-android.1',fetcher([release]) as typeof fetch)).downloadURL,url);
 assert.equal((await androidUpdate(version,fetcher([release]) as typeof fetch)).available,false);
 assert.equal((await androidUpdate('2.4.0-android.1',fetcher([{...release,draft:true}]) as typeof fetch)).available,false);
 assert.equal((await androidUpdate('2.4.0-android.1',fetcher([{...release,assets:[{...release.assets[0],browser_download_url:'https://elsewhere.test/app.apk'}]}]) as typeof fetch)).available,false);
 await assert.rejects(androidUpdate(version,async()=>new Response('',{status:503})),/indisponible/);
});
