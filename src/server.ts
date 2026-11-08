import {diagnosticEvents,sanitizeDiagnostic} from '../shared/diagnostic-report.js';
import {nativeAccess,isNativeMobile} from './native-access.js';
import {androidUpdate} from './android-updates.js';
import {patchSignature,personalPatch} from '../shared/tech-rider.js';
import {languageOrFrench} from '../shared/languages.js';
import {MIXER_MODELS} from '../shared/mixer-models.js';
import {readFileSync,writeFileSync} from 'node:fs';
import {Workshop} from './workshop.js';
import type {GateReference} from '../shared/workshop-envelope.js';
import {VocalFx} from './vocal-fx.js';
import {Analyzer,familyFromName,type Instrument} from './analysis.js';
import {ReaperLink,planSession,createSession,openInReaper,defaultSessionsFolder,freeHours,presenceCommands} from './reaper.js';
import {ReaperBridge,BRIDGE_VERSION,saveLiveRoles} from './reaper-bridge.js';
import {wavPeaks} from './peaks.js';
import {source as coachSource} from './sound-coach.js';
import {MixerSync} from './mixer-sync.js';
import {DiagnosticLog,setDiagnosticLogger,diagnostic} from './diagnostics.js';
import {SoundCoach,identifySymptom} from "./sound-coach.js";
import {askConnectedCoach} from "./coach-ai.js";
import {PARAMETERS,fromWire,type Value} from "./parameters.js";
import {processingCommands} from "./processing-osc.js";
import {homedir} from 'node:os';
import http from "node:http";
import https from "node:https";
import { readFile, stat } from "node:fs/promises";
import { resolve, extname, sep } from "node:path";
import { WebSocketServer, WebSocket } from "ws";
import {discoverXR18} from "./discovery.js";
import {EarsShare} from "./ears.js";
import {blankSceneValues,BLANK_SCENE_TEXT} from "./blank-scene.js";
import {ConnectionManager,loadConnection} from "./connection.js";
import {dirname,join} from "node:path";
import { XR18 } from "./xr18.js";
import { ProcessingStore } from "./processing.js";
import { StudioDatabase } from "./database.js";
import { Access, permitted, sameOrigin, liveControlPermitted } from "./access.js";
import { LibraryStore } from "./library-store.js";
import { ShowControl } from "./show-control.js";
import { StudioApi, body } from "./studio-api.js";
const database = new StudioDatabase();
const processing = new ProcessingStore();
const dbPath=process.env.XR18_DB_PATH??"data/xr18-studio.db";
const diagnostics=new DiagnosticLog(join(dirname(dbPath),'logs','xr18-studio.log'));
setDiagnosticLogger(diagnostics);
// Version shown in Réglages and written in the diagnostic log (set by the desktop app, else package.json).
const APP_VERSION=process.env.XR18_APP_VERSION??(()=>{try{return JSON.parse(readFileSync(new URL('../../package.json',import.meta.url),'utf8')).version as string;}catch{return 'source';}})();
const APP_BUILD=process.env.XR18_APP_BUILD??'source';
diagnostic('startup',{build:APP_BUILD,version:APP_VERSION,platform:process.platform,arch:process.arch,node:process.version});
const configPath=process.env.XR18_CONNECTION_PATH??join(dirname(dbPath),'connection.json');
let config=await loadConnection(configPath,{mode:process.env.XR18_MODE==='real'?'real':'simulation',host:process.env.XR18_HOST??'192.168.1.1',port:Number(process.env.XR18_PORT??10024),enableWrites:process.env.XR18_ENABLE_WRITES==='true'});
if(config.mode==='real'){const devices=await discoverXR18(1500,[config.host],config.port).catch(()=>[]);const found=devices.find(d=>d.host===config.host);config=found?{...config,model:found.model}:{...config,enableWrites:false};}
const xr18 = new XR18(config);
type DynamicsFrame={gate:number[];comp:number[];bus:number[];lr:number;at:number};
let dynamicsFrame:DynamicsFrame|null=null;
xr18.on('dynamics',(frame:DynamicsFrame)=>{dynamicsFrame=frame;});
xr18.on('reset',()=>{dynamicsFrame=null;});
const connection=new ConnectionManager(xr18,configPath,config);
let discoveryPending:ReturnType<typeof discoverXR18>|undefined;
const access=new Access(dbPath), library=new LibraryStore(dbPath);
const show=new ShowControl(xr18,processing,library);
const mixerSync=new MixerSync(xr18,show.console,library);
const coach=new SoundCoach(xr18,show.console,library);
const vocalFx=new VocalFx(xr18,library,()=>coach.profile());
let aiRequestAt=0;
// Live analysis: instruments named on the console, family from the coach when it knows the source.
const instruments=():Instrument[]=>{
 const v=xr18.parameterState(),profile=coach.profile(),out:Instrument[]=[];
 for(let c=1;c<=xr18.model().channels;c++){
  const input=profile.inputs.find(i=>i.channel===c),name=String(v[`/ch/${String(c).padStart(2,'0')}/config/name`]?.value??'').trim()||input?.name||'';
  if(!name&&!input)continue;
  let family=null;try{family=input?coachSource(input.source).family:null;}catch{family=null;}
  out.push({channel:c,name:name||`Canal ${c}`,family:family??familyFromName(name),source:input?.source});
 }
 return out;
};
const analyzer=new Analyzer(xr18,instruments);
const bridge=new ReaperBridge();
const reaper=new ReaperLink({transport:()=>bridge.transport(),actions:ids=>bridge.actions(ids)});
const workshop=new Workshop(xr18,bridge,library,resolve(dirname(dbPath),'workshops'));
const SONG_TAIL_S=8;
/** Reads the console fresh: a session built on stale routing would record the wrong inputs. */
let planCache:{at:number;plan:ReturnType<typeof planSession>}|undefined;
/** Reading the whole console takes seconds: screens reuse a recent read, a new session always reads again. */
async function recentPlan(){if(!planCache||Date.now()-planCache.at>60000)planCache={at:Date.now(),plan:await reaperPlan()};return structuredClone(planCache.plan);}
async function reaperPlan(){
 if(xr18.model().usbRecorder!=='interface')throw Error(xr18.model().usbChannels===0?'Ce modèle enregistre en stéréo sur clé USB ; pas d’interface USB multipiste vers REAPER.':'La carte audio X32 et son routage doivent être validés avant de préparer une session multipiste.');
 const simulation=xr18.mode==='simulation';let sampleRate:number|null=simulation?48000:null,usbMode:'18x18'|'2x2'|null=null;
 if(!simulation){
  for(const prefix of ['/routing/usb','/config/chlink','/rtn/aux/config','/rtn/aux/mix'])await xr18.refreshParameters(prefix);
  for(let c=1;c<=16;c++)for(const part of ['config','mix','preamp'])await xr18.refreshParameters(`/ch/${String(c).padStart(2,'0')}/${part}`);
  try{const v=(await xr18.query('/-prefs/clockrate')).args[0];sampleRate=v===0||/^48/.test(String(v))?48000:v===1||/^44/.test(String(v))?44100:null;}catch{/* warned in the plan */}
  try{const v=(await xr18.query('/-prefs/usbifcmode')).args[0];usbMode=v===0||String(v)==='18x18'?'18x18':v===1||String(v)==='2x2'?'2x2':null;}catch{/* warned in the plan */}
 }
 // The simulator has no real USB routing: its default values would all point to channel 1.
 const state=xr18.parameterState(),values=Object.fromEntries(Object.entries(state).filter(([a])=>!simulation||!a.startsWith('/routing/usb/')).map(([a,v])=>[a,v.value]));
 return planSession({values,instruments:instruments(),sampleRate,usbMode,simulation});
}
// Rehearsal mode survives a restart: the Main must not come back on by surprise.
const rehearsalPath=join(dirname(configPath),'rehearsal.json');
try{xr18.setRehearsal(JSON.parse(readFileSync(rehearsalPath,'utf8')).on===true);}catch{/* first start: off */}
const studioApi=new StudioApi(xr18,access,library,show,()=>patchSignature(coach.profile()));
// Musicians' monitor mixes on the local network (QR links). Off until started from the app.
const ears=new EarsShare(dbPath,xr18,()=>process.env.XR18_WEB_DIST,()=>studioApi.busy?'Une opération est en cours sur l’ordinateur, réessaie dans un instant':null,()=>show.manualOverride(),(bus,name)=>personalPatch(coach.profile(),bus,name));
const listenHost=process.env.XR18_HTTP_HOST??'127.0.0.1';
const tls=process.env.XR18_TLS_CERT&&process.env.XR18_TLS_KEY?{cert:await readFile(process.env.XR18_TLS_CERT),key:await readFile(process.env.XR18_TLS_KEY)}:undefined;
if(!['127.0.0.1','localhost'].includes(listenHost)&&(!tls||!access.enabled()))throw Error('Accès réseau : HTTPS et comptes configurés requis.');
const handler: http.RequestListener = async (req, res) => {
  let ownsWriteLock=false;
  try {
  if(!nativeAccess(req)){res.writeHead(403);res.end(JSON.stringify({error:'Application locale requise'}));return;}
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if(!sameOrigin(req)){res.writeHead(403);res.end(JSON.stringify({error:"Origine refusée"}));return;}
  if(isNativeMobile&&['/api/native/suspend','/api/android/suspend'].includes(path)&&req.method==='POST'){
   show.manualOverride();await connection.suspend();res.end(JSON.stringify({ok:true}));return;
  }
  if(process.env.BANDPILOT_ANDROID==='1'&&path==='/api/android/update'&&req.method==='GET'){
   res.end(JSON.stringify(await androidUpdate(APP_VERSION)));return;
  }
  if(isNativeMobile&&/^\/api\/(?:reaper|workshop)(?:\/|$)/.test(path)){
   res.writeHead(501);res.end(JSON.stringify({error:'REAPER et l’Atelier du son sont disponibles dans BandPilot sur ordinateur.'}));return;
  }
  if(path==='/api/auth'&&req.method==='GET'){res.end(JSON.stringify({enabled:access.enabled(),user:access.user(req)}));return;}
  if(path==='/api/auth/setup'&&req.method==='POST'){
    try{const d=await body(req);if(access.enabled())throw Error('Comptes déjà configurés');access.create(d.name,d.password,'admin',[]);for(const ws of wss.clients)ws.terminate();res.end(JSON.stringify({ok:true}));}catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));}return;
  }
  if(path==='/api/auth/login'&&req.method==='POST'){
    try{const d=await body(req);const token=access.login(d.name,d.password);res.setHeader('Set-Cookie',`xr18_session=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${tls?"; Secure":""}`);res.end(JSON.stringify({ok:true}));}catch(e){res.writeHead(401);res.end(JSON.stringify({error:(e as Error).message}));}return;
  }
  if(path==='/api/auth/logout'&&req.method==='POST'){access.logout(req);res.setHeader('Set-Cookie','xr18_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');for(const ws of wss.clients)ws.terminate();res.end(JSON.stringify({ok:true}));return;}
  const user=access.user(req);
  if(path.startsWith('/api/')&&(!user||!permitted(user,req.method??'GET',path))){res.writeHead(user?403:401);res.end(JSON.stringify({error:user?'Droits insuffisants':'Connexion requise'}));return;}
  if(path==='/api/workspace'){
   try{if(req.method==='GET')res.end(JSON.stringify(database.workspace()));
   else if(req.method==='PUT')res.end(JSON.stringify(database.saveWorkspace(await body(req))));
   else{res.writeHead(405);res.end('{}');}}catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));}return;
  }
  if(workshop.blocksRecording()&&req.method!=='GET'&&(['/api/reaper/rec','/api/reaper/session','/api/show/rec','/api/show/presence','/api/show/original','/api/show/take','/api/show/track','/api/show/play','/api/show/loop','/api/show/goto','/api/mixer-sync/apply','/api/console/apply','/api/coach/apply','/api/coach/vocal-fx/apply','/api/coach/vocal-fx/undo','/api/coach/vocal-fx/keep','/api/analysis/listen','/api/reacue/event','/api/reacue/arm'].includes(path)||/^\/api\/library\/[^/]+\/apply$/.test(path))){res.writeHead(409);res.end(JSON.stringify({error:'Termine l’Atelier du son et restaure les sources avant cette action ; les réglages directs de canal restent disponibles dans Console'}));return;}
  if(path==='/api/reacue/stop'&&req.method==='POST'){show.arm(false);access.log(user!,'Arrêt ReaCue');res.end(JSON.stringify({ok:true}));return;}
  const readOnlyCoach=['/api/coach/ask','/api/coach/advice','/api/coach/measure','/api/coach/suggest','/api/coach/prepare','/api/coach/ears','/api/coach/gain','/api/coach/bleed','/api/coach/calibration','/api/coach/undo',
    // Analysis only changes what the console's analyser looks at, never the sound: no global lock.
    '/api/reaper/plan','/api/reaper/session','/api/reaper/rec','/api/reaper/stop','/api/reaper/marker','/api/reaper/dismiss','/api/show/install','/api/show/goto','/api/show/loop','/api/show/take','/api/show/track','/api/show/play','/api/show/stop','/api/show/continue','/api/show/presence','/api/show/original','/api/show/rec',
    '/api/analysis/start','/api/analysis/stop','/api/analysis/target','/api/analysis/scan','/api/analysis/dismiss','/api/analysis/release'].includes(path);
  if(path.startsWith('/api/')&&req.method!=='GET'&&!readOnlyCoach){
    const coachMetadata=(path.startsWith('/api/coach/')&&!['/api/coach/apply','/api/coach/vocal-fx/apply','/api/coach/vocal-fx/undo'].includes(path))||(path.startsWith('/api/mixer-sync')&&path!=='/api/mixer-sync/apply')||path.startsWith('/api/ears-share');
    if(studioApi.busy&&!path.startsWith('/api/reacue')&&!coachMetadata){show.manualOverride();}
    if(studioApi.busy){res.writeHead(409);res.end(JSON.stringify({error:'Une opération est déjà en cours'}));return;}
    studioApi.busy=true;ownsWriteLock=true;
    access.log(user!,`${req.method} ${path}`);
    if(!path.startsWith('/api/reacue')&&!path.startsWith('/api/library')&&!coachMetadata)show.manualOverride();
  }
  if(req.method==='GET'&&path==='/api/models'){res.end(JSON.stringify(Object.values(MIXER_MODELS)));return;}
  if(xr18.model().family==='x32'&&(path.startsWith('/api/ears-share')||path.startsWith('/api/coach')||path.startsWith('/api/mixer-sync')||path.startsWith('/api/reacue')||path.startsWith('/api/analysis')||path==='/api/rehearsal')){res.writeHead(409);res.end(JSON.stringify({error:'Cette fonction nécessite l’adaptateur avancé X32. Le mélangeur X32 reste disponible.'}));return;}
  if(path.startsWith('/api/ears-share')){
   try{
    const m=/^\/api\/ears-share(?:\/(start|stop|musicians)(?:\/([a-f0-9-]{36})(?:\/(regenerate|qr))?)?)?$/.exec(path);
    if(!m){res.writeHead(404);res.end(JSON.stringify({error:'Introuvable'}));return;}
    let result:unknown;
    if(req.method==='GET'&&!m[1])result=ears.status();
    else if(req.method==='POST'&&m[1]==='start')result=await ears.start();
    else if(req.method==='POST'&&m[1]==='stop')result=await ears.stop();
    else if(req.method==='POST'&&m[1]==='musicians'&&!m[2]){const d=await body(req);ears.create(d.name,d.bus);result=ears.status();}
    else if(req.method==='POST'&&m[3]==='regenerate'){ears.regenerate(m[2]!);result=ears.status();}
    else if(req.method==='DELETE'&&m[2]&&!m[3]){ears.remove(m[2]);result=ears.status();}
    else if(req.method==='GET'&&m[3]==='qr')result=await ears.qr(m[2]!,new URL(req.url!,'http://localhost').searchParams.get('host')??undefined);
    else{res.writeHead(405);res.end(JSON.stringify({error:'Méthode non autorisée'}));return;}
    res.end(JSON.stringify(result));
   }catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));}
   return;
  }
  if(path==='/api/mixer-sync'&&req.method==='GET'){res.end(JSON.stringify(mixerSync.status()));return;}
  if(path.startsWith('/api/mixer-sync/')&&req.method==='POST'){
   try{const d=await body(req);let result:unknown;
    if(path==='/api/mixer-sync/save-pc')result=await mixerSync.savePc();
    else if(path==='/api/mixer-sync/pull')result=await mixerSync.pull();
    else if(path==='/api/mixer-sync/preview')result=await mixerSync.preview(d.sourceId,d.includePhantom===true);
    else if(path==='/api/mixer-sync/apply')result=await mixerSync.apply(d.token,d.confirm,d.allowPhantom);
    else{res.writeHead(404);res.end(JSON.stringify({error:'Action inconnue'}));return;}
    res.end(JSON.stringify(result));
   }catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));}return;
  }
  if(path==='/api/version'&&req.method==='GET'){res.end(JSON.stringify({version:APP_VERSION,build:APP_BUILD}));return;}
  if(path==='/api/diagnostics/report'&&req.method==='GET'){
    const state=xr18.status(),fx=vocalFx.status(),p=coach.profile();
    res.end(JSON.stringify({schema:1,createdAt:new Date().toISOString(),app:{version:APP_VERSION,build:APP_BUILD},system:{platform:process.platform,arch:process.arch,node:process.version,electron:process.versions.electron},console:{mode:state.mode,model:state.model,connected:state.connected,writesEnabled:state.writesEnabled},group:{inputs:p.inputs.map(i=>({channel:i.channel,source:i.source})),monitors:(p.musicians??[]).map(m=>({bus:m.bus,channels:m.channels}))},ambience:fx.session?{slot:fx.session.slot,phase:fx.session.phase,sameConsole:fx.session.sameConsole,sourceMissing:fx.session.sourceMissing,channel:fx.session.choice.channel,ambience:fx.session.choice.ambience}:null,events:diagnosticEvents(diagnostics.read())}));return;
  }
  if(path==='/api/diagnostics/event'&&req.method==='POST'){
    const d=await body(req);diagnostic('ui.error',sanitizeDiagnostic({action:String(d.action??'').slice(0,120),message:String(d.message??''),stack:String(d.stack??'')}) as Record<string,unknown>);res.end(JSON.stringify({ok:true}));return;
  }
  if(path==='/api/diagnostics/log'&&req.method==='GET'){
    try{res.setHeader('Content-Type','text/plain; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="xr18-studio-diagnostic.log"');res.end(diagnostics.read());}
    catch{res.writeHead(503);res.end('Journal indisponible : vérifier les droits du dossier de données.');}return;
  }
  if(path==='/api/discovery'&&req.method==='GET'){
    if(process.env.BANDPILOT_IOS==='1'){res.writeHead(501);res.end(JSON.stringify({error:'Sur iPad, connecte la console avec son adresse IP dans Connexion.'}));return;}
    try{discoveryPending??=discoverXR18().finally(()=>{discoveryPending=undefined;});res.end(JSON.stringify({devices:await discoveryPending}));}
    catch(e){res.writeHead(503);res.end(JSON.stringify({error:(e as Error).message}));}return;
  }
  if(path==='/api/connection'&&req.method==='POST'){
    try{const data=await body(req);if(data.mode==='real'&&xr18.mode==='simulation')await mixerSync.savePc();const status=await connection.change(data);res.end(JSON.stringify({status}));}
    catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));}return;
  }
  if(path==='/api/coach'&&req.method==='GET'){res.end(JSON.stringify({...coach.catalog(),role:user!.role}));return;}
  if(path==='/api/coach/advice'&&req.method==='GET'){
    try{const q=new URL(req.url!,'http://localhost').searchParams;res.end(JSON.stringify(coach.advice(Number(q.get('channel')),String(q.get('symptom')))));}catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));}return;
  }
  if(path==='/api/workshop'&&req.method==='GET'){res.end(JSON.stringify(workshop.status()));return;}
  if(path.startsWith('/api/workshop/')&&req.method==='POST'){
   try{const d=await body(req);let result:unknown;
   if(path==='/api/workshop/catalog')result=await workshop.catalog();
   else if(path==='/api/workshop/create')result=await workshop.create({name:typeof d.name==='string'?d.name:undefined,source:String(d.source),start:Number(d.start),stop:Number(d.stop),mapping:d.mapping,confirm:d.confirm===true,rawConfirmed:d.rawConfirmed===true,deviceConfirmed:d.deviceConfirmed===true,token:String(d.token)});
   else if(path==='/api/workshop/transport')result=await workshop.transport(String(d.action),d.start===undefined?undefined:Number(d.start));
   else if(path==='/api/workshop/compare')result=await workshop.compare(d.side as 'A'|'B');
   else if(path==='/api/workshop/save')result=await workshop.save(String(d.note??''),d.preference as 'A'|'B');
   else if(path==='/api/workshop/finish')result=await workshop.finish(d.keep as 'A'|'B',d.confirm===true);
   else if(path==='/api/workshop/gate-reference')result=await workshop.gateReference(Number(d.channel),d.reference as GateReference,d.confirm===true);
   else if(path==='/api/workshop/analyze')result=await workshop.analyze();
   else if(path==='/api/workshop/listen-analyze'){if(d.confirm!==true)throw Error('Confirme la lecture pour mesurer les traitements');result=await workshop.listenAnalyze();}
   else if(path==='/api/workshop/cancel')result=workshop.cancelAnalysis();
   else if(path==='/api/workshop/trial')result=await workshop.trial(String(d.id),d.action as 'try'|'keep'|'undo'|'before'|'after');
   else throw Error('Action atelier inconnue');
   res.end(JSON.stringify(result));}catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));}return;
  }
  if(path.startsWith('/api/show')){
   try{
    const q=new URL(req.url??'/','http://localhost').searchParams;let result:unknown;
    if(path==='/api/show'&&req.method==='GET'){
     const state=bridge.alive()?await bridge.state():null;
     const plan=state?(planCache?.plan??planSession({values:Object.fromEntries(Object.entries(xr18.parameterState()).map(([a,v])=>[a,v.value])),instruments:instruments(),sampleRate:48000,usbMode:'18x18',simulation:true})):null;
     const presence=plan?.tracks.filter(t=>state?.tracks.some(r=>r.name===`REC ${t.name}`&&r.armed)).map(t=>t.id)??[];
     result={alive:!!state,installed:bridge.installed(),bridgeCurrent:BRIDGE_VERSION,rehearsal:xr18.isRehearsal(),presence,...state};
    }
    else if(path==='/api/show/peaks'&&req.method==='GET'){
     const track=Number(q.get('track')),item=Number(q.get('item')),take=Number(q.get('take')),buckets=Math.min(1200,Number(q.get('buckets'))||600);
     const state=await bridge.state(),selected=state.tracks.find(t=>t.index===track),file=selected?.items[item]?.takes[take]?.file;
     if(state.recording){res.end(JSON.stringify({peaks:null}));return;}
     if(file===undefined)throw Error('Prise introuvable dans le projet');
     // WAV takes are read here so Reaper is not slowed down; anything else (MP3, MIDI click) is read by Reaper.
     const peaks=/\.wav$/i.test(file)?await wavPeaks(file,buckets).catch(()=>null):null;
     result={peaks:peaks??(await bridge.peaks(track,item,take,buckets)).peaks};
    }
    else if(req.method!=='POST'){res.writeHead(405);res.end(JSON.stringify({error:'Méthode non autorisée'}));return;}
    else{
     const d=await body(req);
     if(path==='/api/show/install'){if(d.confirm!==true)throw Error('Confirmation requise');access.log(user!,'Installation du pont Re…4673 tokens truncated…e,readOnly:true}));return;}
  const earsMatch=/^\/api\/ears\/profiles(?:\/([a-f0-9-]+))?$/.exec(path);
  if(earsMatch){
    try{
      if(req.method==="GET"&&!earsMatch[1]){res.end(JSON.stringify({profiles:database.listEarProfiles(),simulationOnly:true}));return;}
      if(req.method==="DELETE"&&earsMatch[1]){const deleted=database.deleteEarProfile(earsMatch[1]);res.writeHead(deleted?200:404);res.end(JSON.stringify({ok:deleted}));return;}
      if(req.method==="POST"&&!earsMatch[1]){
        let raw="";for await(const part of req){raw+=part;if(raw.length>8000){res.writeHead(413);res.end(JSON.stringify({error:"Payload too large"}));return;}}
        const data:unknown=JSON.parse(raw);if(!data||typeof data!=="object"||Array.isArray(data))throw Error("Invalid JSON body");
        const profile=database.saveEarProfile(data as Record<string,unknown>);
        res.writeHead(201);res.end(JSON.stringify({profile,simulationOnly:true,hardwareWrite:false}));return;
      }
      res.writeHead(405);res.end(JSON.stringify({error:"Method not allowed"}));return;
    }catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));return;}
  }
  // Rehearsal data is persisted in local SQLite. API is loopback-only and unauthenticated.
  const resource = /^\/api\/(songs|rehearsals|setlists)(?:\/([a-zA-Z0-9-]+))?$/.exec(path);
  if (resource) {
    const kind=resource[1],itemId=resource[2];
    try {
      if (req.method==="GET"&&!itemId) {
        const data=kind==="songs"?database.listSongs():kind==="rehearsals"?database.listRehearsals():database.listSetlists();
        res.end(JSON.stringify(data));return;
      }
      if (req.method==="DELETE"&&itemId&&kind!=="rehearsals") {
        const deleted=kind==="songs"?database.deleteSong(itemId):database.deleteSetlist(itemId);
        res.writeHead(deleted?200:404);res.end(JSON.stringify({ok:deleted}));return;
      }
      if (req.method==="POST"&&!itemId) {
        let raw="";for await(const part of req){raw+=part;if(raw.length>20000){res.writeHead(413);res.end(JSON.stringify({error:"Payload too large"}));return;}}
        const body:unknown=JSON.parse(raw);
        if(!body||typeof body!=="object"||Array.isArray(body))throw Error("Invalid JSON body");
        const data=body as Record<string,unknown>;
        const result=kind==="songs"?database.addSong(data):kind==="rehearsals"?database.addRehearsal(data):database.addSetlist(data);
        res.writeHead(201);res.end(JSON.stringify(result));return;
      }
      res.writeHead(405);res.end(JSON.stringify({error:"Method not allowed"}));return;
    } catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));return;}
  }
  const processingMatch = /^\/api\/channels\/(\d+)\/processing(?:\/(preview|undo))?$/.exec(path);
  if (processingMatch) {
    const channel = Number(processingMatch[1]);
    try {
      if (req.method === "GET" && !processingMatch[2]) { res.end(JSON.stringify({ state: processing.get(channel), simulationOnly: true })); return; }
      if (req.method !== "POST") { res.writeHead(405); res.end(JSON.stringify({ error: "Method not allowed" })); return; }
      let raw = "";
      for await (const part of req) { raw += part; if (raw.length > 16000) { res.writeHead(413); res.end(JSON.stringify({ error: "Payload too large" })); return; } }
      const body: unknown = JSON.parse(raw);
      if (!body || typeof body !== "object") throw Error("Invalid JSON");
      const data = body as Record<string,unknown>;
      if(xr18.mode==='real'){
        if(processingMatch[2]==='undo')throw Error('Restaurer la sauvegarde des paramètres depuis la bibliothèque');
        if(processingMatch[2]==='preview'){const plan=processingCommands(channel,data.processing);const preview=await show.console.preview(plan.values,true);res.end(JSON.stringify({...preview,ratio:plan.ratio,preservedThresholds:plan.preservedThresholds}));return;}
        if(data.confirm!==true)throw Error('Confirmation requise');
        const result=await show.console.apply(data.token);res.end(JSON.stringify({...result,state:{revision:Date.now()}}));return;
      }
      if (processingMatch[2] === "preview") { res.end(JSON.stringify(processing.preview(channel,data.processing))); return; }
      if (xr18.mode !== "simulation") { res.writeHead(403); res.end(JSON.stringify({ error: "Processing hardware writes are not implemented or validated; simulation only" })); return; }
      if (processingMatch[2] === "undo") {
        if (!Number.isInteger(data.expectedRevision)) throw Error("expectedRevision required");
        const state = processing.undo(channel,data.expectedRevision as number);
        res.end(JSON.stringify({ state, simulationOnly: true })); return;
      }
      if (data.confirm !== true || !Number.isInteger(data.expectedRevision)) throw Error("Explicit confirmation and expectedRevision required");
      const state = processing.apply(channel,data.processing,data.expectedRevision as number);
      res.end(JSON.stringify({ state, simulationOnly: true })); return;
    } catch(e) { const message=(e as Error).message;res.writeHead(message.includes("conflict")?409:400);res.end(JSON.stringify({ error: message }));return; }
  }
  if (req.method === "POST" && /^\/api\/channels\/\d+\/fader$/.test(path)) {
    let raw = "";
    for await (const part of req) { raw += part; if (raw.length > 1024) { res.writeHead(413); res.end(JSON.stringify({ error: "Payload too large" })); return; } }
    try {
      const body: unknown = JSON.parse(raw);
      if (!body || typeof body !== "object" || !("value" in body) || typeof body.value !== "number") throw new Error("Numeric value required");
      xr18.setFader(Number(path.split("/")[3]), body.value);
      res.end(JSON.stringify({ ok: true, note: xr18.mode === "real" ? "OSC command sent, not acknowledged" : "Simulation updated" }));
    } catch (e) { res.writeHead(400); res.end(JSON.stringify({ error: (e as Error).message })); }
    return;
  }
  // Serve the prebuilt web UI in desktop / production mode; API stays loopback-only.
  if (req.method === "GET" && process.env.XR18_WEB_DIST && !path.startsWith("/api/")) {
    const root=resolve(process.env.XR18_WEB_DIST);
    const requested=resolve(root,"."+path);
    if(requested===root||requested.startsWith(root+sep)){
      try{
        const target=(await stat(requested)).isFile()?requested:resolve(root,"index.html");
        const bytes=await readFile(target);
        const mime:Record<string,string>={".html":"text/html; charset=utf-8",".js":"text/javascript; charset=utf-8",".css":"text/css; charset=utf-8",".svg":"image/svg+xml",".png":"image/png",".ico":"image/x-icon",".woff2":"font/woff2"};
        res.setHeader("Content-Type",mime[extname(target)]??"application/octet-stream");
        res.setHeader("Content-Security-Policy","default-src 'self'; connect-src 'self' ws://127.0.0.1:* wss:; img-src 'self' data:; style-src 'self' 'unsafe-inline'; script-src 'self'; font-src 'self' data:; object-src 'none'; frame-ancestors 'none'");
        res.end(bytes);return;
      }catch{ /* Fall through to 404. */ }
    }
  }
  res.writeHead(404); res.end(JSON.stringify({ error: "Not found" }));
  } catch(e) {if(!res.headersSent)res.writeHead(500);res.end(JSON.stringify({error:(e as Error).message}));}
  finally {if(ownsWriteLock)studioApi.busy=false;}
};
const server=tls?https.createServer(tls,handler):http.createServer(handler);
const wss = new WebSocketServer({ server, path: "/ws", verifyClient:({req},done)=>done(nativeAccess(req)&&sameOrigin(req)&&!!access.user(req),401) });
const wsRequests=new WeakMap<WebSocket,http.IncomingMessage>();
// Live control channel for the graphical mixer (fader drags, knobs, mute, solo), like X-AIR Edit.
function handleLive(ws:WebSocket,req:http.IncomingMessage,raw:Buffer){
  let message:{type?:unknown;address?:unknown;value?:unknown};
  try{if(raw.length>2048)throw Error();message=JSON.parse(raw.toString('utf8'));}catch{return;}
  const reply=(data:unknown)=>{if(ws.readyState===WebSocket.OPEN)ws.send(JSON.stringify(data));};
  const user=access.user(req);if(!user){ws.terminate();return;}
  if(message.type==='sync'){void xr18.syncLiveView().catch(e=>reply({type:'live-error',error:(e as Error).message}));return;}
  if(message.type!=='set'||typeof message.address!=='string')return;
  const address=message.address,value=message.value;
  try{
    if(!liveControlPermitted(user,address))throw Error('Droits insuffisants pour '+address);
    if(studioApi.busy)throw Error('Une opération est déjà en cours');
    if(typeof value!=='number'&&typeof value!=='string')throw Error('Valeur invalide');
    show.manualOverride();
    xr18.liveSet(address,value);
  }catch(e){reply({type:'live-error',address,error:(e as Error).message});}
}
wss.on("connection", (ws,req) => {wsRequests.set(ws,req);ws.on('message',raw=>handleLive(ws,req,raw as Buffer));ws.send(JSON.stringify({ type: "snapshot", channels: xr18.listChannels(), status: xr18.status(), main: xr18.mainState(), meters:xr18.meterState(),parameters:xr18.parameterState() }));});
xr18.on('reset',()=>{const message=JSON.stringify({type:'snapshot',channels:xr18.listChannels(),status:xr18.status(),main:xr18.mainState(),meters:xr18.meterState(),parameters:xr18.parameterState()});for(const ws of wss.clients)if(ws.readyState===WebSocket.OPEN)ws.send(message);});
xr18.on('parameter',state=>{const message=JSON.stringify({type:'parameter',state});for(const ws of wss.clients)if(ws.readyState===WebSocket.OPEN)ws.send(message);});
xr18.on("state", state => { const message = JSON.stringify({ type: "channel", state, status:xr18.status() }); for (const ws of wss.clients) if (ws.readyState === WebSocket.OPEN) ws.send(message); });
xr18.on("main", state => {const message=JSON.stringify({type:"main",state});for(const ws of wss.clients)if(ws.readyState===WebSocket.OPEN)ws.send(message);});
const broadcast=(message:string)=>{for(const ws of wss.clients)if(ws.readyState===WebSocket.OPEN)ws.send(message);};
analyzer.on('live',live=>broadcast(JSON.stringify({type:'analysis-live',live})));
analyzer.on('progress',p=>broadcast(JSON.stringify({type:'analysis-progress',progress:p})));
analyzer.on('state',()=>broadcast(JSON.stringify({type:'analysis',analysis:analyzer.snapshot()})));
xr18.on("meters",state=>{const message=JSON.stringify({type:"meters",state});for(const ws of wss.clients)if(ws.readyState===WebSocket.OPEN)ws.send(message);});
xr18.on("advanced", state => {const message=JSON.stringify({type:"advanced",state});for(const ws of wss.clients)if(ws.readyState===WebSocket.OPEN)ws.send(message);});
xr18.on("connection", () => {const message=JSON.stringify({type:"status",status:xr18.status()});for(const ws of wss.clients)if(ws.readyState===WebSocket.OPEN)ws.send(message);});
xr18.on("warning", warning => {console.warn("[OSC]", warning);diagnostic("osc.warning",{message:String(warning).slice(0,500)}); });
await xr18.start();
const port = Number(process.env.HTTP_PORT ?? 3000);
server.listen(port, listenHost, () => {
 const address=server.address(),actual=typeof address==='object'?address?.port:port;
 console.log(`BandPilot API on ${tls?"https":"http"}://${listenHost}:${actual} (${xr18.mode})`);
 if(isNativeMobile&&process.env.BANDPILOT_READY_FILE){writeFileSync(process.env.BANDPILOT_READY_FILE,JSON.stringify({port:actual,version:APP_VERSION}),{mode:0o600});writeFileSync(join(dirname(process.env.BANDPILOT_READY_FILE),'port.json'),JSON.stringify(actual),{mode:0o600});}
});
server.on('error',error=>{if(isNativeMobile&&(error as NodeJS.ErrnoException).code==='EADDRINUSE')server.listen(0,listenHost);else throw error;});
const statusTimer=setInterval(()=>{for(const ws of wss.clients){const req=wsRequests.get(ws);if(!req||!access.user(req))ws.terminate();}const message=JSON.stringify({type:"status",status:xr18.status()});for(const ws of wss.clients)if(ws.readyState===WebSocket.OPEN)ws.send(message);},2000);
statusTimer.unref();
function shutdown(){clearInterval(statusTimer);ears.close();xr18.close();database.close();access.close();library.close();for(const ws of wss.clients)ws.terminate();wss.close();server.close();}
process.once("SIGINT",shutdown);
process.once("SIGTERM",shutdown);



