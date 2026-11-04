import {MIXER_MODELS} from '../shared/mixer-models.js';
import {readFileSync,writeFileSync} from 'node:fs';
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
diagnostic('startup',{version:APP_VERSION,platform:process.platform,arch:process.arch,node:process.version});
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
const studioApi=new StudioApi(xr18,access,library,show);
// Musicians' monitor mixes on the local network (QR links). Off until started from the app.
const ears=new EarsShare(dbPath,xr18,()=>process.env.XR18_WEB_DIST,()=>studioApi.busy?'Une opération est en cours sur l’ordinateur, réessaie dans un instant':null,()=>show.manualOverride());
const listenHost=process.env.XR18_HTTP_HOST??'127.0.0.1';
const tls=process.env.XR18_TLS_CERT&&process.env.XR18_TLS_KEY?{cert:await readFile(process.env.XR18_TLS_CERT),key:await readFile(process.env.XR18_TLS_KEY)}:undefined;
if(!['127.0.0.1','localhost'].includes(listenHost)&&(!tls||!access.enabled()))throw Error('Accès réseau : HTTPS et comptes configurés requis.');
const handler: http.RequestListener = async (req, res) => {
  let ownsWriteLock=false;
  try {
  const path = new URL(req.url ?? "/", "http://localhost").pathname;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  if(!sameOrigin(req)){res.writeHead(403);res.end(JSON.stringify({error:"Origine refusée"}));return;}
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
  if(path==='/api/reacue/stop'&&req.method==='POST'){show.arm(false);access.log(user!,'Arrêt ReaCue');res.end(JSON.stringify({ok:true}));return;}
  const readOnlyCoach=['/api/coach/ask','/api/coach/advice','/api/coach/measure','/api/coach/suggest','/api/coach/prepare','/api/coach/ears','/api/coach/gain','/api/coach/bleed','/api/coach/calibration','/api/coach/undo',
    // Analysis only changes what the console's analyser looks at, never the sound: no global lock.
    '/api/reaper/plan','/api/reaper/session','/api/reaper/rec','/api/reaper/stop','/api/reaper/marker','/api/reaper/dismiss','/api/show/install','/api/show/goto','/api/show/loop','/api/show/take','/api/show/track','/api/show/play','/api/show/stop','/api/show/continue','/api/show/presence','/api/show/original','/api/show/rec',
    '/api/analysis/start','/api/analysis/stop','/api/analysis/target','/api/analysis/scan','/api/analysis/dismiss','/api/analysis/release'].includes(path);
  if(path.startsWith('/api/')&&req.method!=='GET'&&!readOnlyCoach){
    const coachMetadata=(path.startsWith('/api/coach/')&&path!=='/api/coach/apply')||(path.startsWith('/api/mixer-sync')&&path!=='/api/mixer-sync/apply')||path.startsWith('/api/ears-share');
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
  if(path==='/api/version'&&req.method==='GET'){res.end(JSON.stringify({version:APP_VERSION}));return;}
  if(path==='/api/diagnostics/log'&&req.method==='GET'){
    try{res.setHeader('Content-Type','text/plain; charset=utf-8');res.setHeader('Content-Disposition','attachment; filename="xr18-studio-diagnostic.log"');res.end(diagnostics.read());}
    catch{res.writeHead(503);res.end('Journal indisponible : vérifier les droits du dossier de données.');}return;
  }
  if(path==='/api/discovery'&&req.method==='GET'){
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
     const state=await bridge.state(),file=state.tracks.find(t=>t.index===track)?.items[item]?.takes[take]?.file;
     if(file===undefined)throw Error('Prise introuvable dans le projet');
     // WAV takes are read here so Reaper is not slowed down; anything else (MP3, MIDI click) is read by Reaper.
     const peaks=/\.wav$/i.test(file)?await wavPeaks(file,buckets).catch(()=>null):null;
     result={peaks:peaks??(await bridge.peaks(track,item,take,buckets)).peaks};
    }
    else if(req.method!=='POST'){res.writeHead(405);res.end(JSON.stringify({error:'Méthode non autorisée'}));return;}
    else{
     const d=await body(req);
     if(path==='/api/show/install'){if(d.confirm!==true)throw Error('Confirmation requise');access.log(user!,'Installation du pont Reaper');result=await bridge.install();}
     else if(path==='/api/show/goto'){if(reaper.status().recording)throw Error('Enregistrement en cours : arrête-le avant de changer de morceau.');result=await bridge.call('goto_pos',{pos:Number(d.pos)});}
     else if(path==='/api/show/loop')result=await bridge.call('set_loop',{project:d.project,on:d.on===true,start:Number(d.start),stop:Number(d.stop)});
     else if(path==='/api/show/take'){
      const done=await bridge.call<{changed:number}>('select_take',{project:d.project,take:Number(d.take),start:Number(d.start),stop:Number(d.stop)});
      if(!done.changed)throw Error('Cette prise n’existe pas sur ces pistes');
      result=done;
     }
     else if(path==='/api/show/track')result=await bridge.call('track_mute',{name:String(d.name),on:d.on===true,solo:d.solo===true});
     else if(path==='/api/show/play'){await reaper.watch();result=await reaper.play();}
     else if(path==='/api/show/stop'){await reaper.watch();result=reaper.status().recording||reaper.status().state==='starting'?await reaper.stop():await reaper.halt();}
     else if(path==='/api/show/continue')result=reaper.cancelAutoStop();
     else if(path==='/api/show/presence'){
      const plan=await recentPlan(),present=(Array.isArray(d.present)?d.present:[]).map(String),rec=plan.tracks.filter(t=>t.selected);
      const {rec:add,unarm,roles}=presenceCommands(rec,present);
      await bridge.call('apply_presence',{project:d.project,rec:add,unarm,roles});
      const state=await bridge.state();
      // ReaCue applies this itself when its window is open. The mutes above already cover the case where it is closed.
      if(state.setlist)await saveLiveRoles(state.setlist,Object.keys(roles).filter(r=>roles[r])).catch(e=>diagnostic('reacue-live',{error:(e as Error).message}));
      result={present};
     }
     else if(path==='/api/show/original'){
      result=await bridge.call('listen_original',{on:d.on===true,project:d.project});
     }
     else if(path==='/api/show/rec'){
      if(!Number.isFinite(d.start))throw Error('Morceau requis');
      await bridge.call('goto_pos',{pos:Number(d.start)});
      access.log(user!,'Reaper : Rec sur un morceau');await reaper.record({atEnd:false});
      result=reaper.setAutoStop(Number.isFinite(d.stop)?Number(d.stop)+SONG_TAIL_S:null,SONG_TAIL_S);
     }
     else{res.writeHead(404);res.end(JSON.stringify({error:'Introuvable'}));return;}
    }
    res.end(JSON.stringify(result));
   }catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));}
   return;
  }
  if(path.startsWith('/api/reaper')){
   // Reaper never touches the console: no global lock, and Rec/Stop must work during any other operation.
   try{
    let result:unknown;
    if(path==='/api/reaper'&&req.method==='GET'){await reaper.watch();result={...reaper.status(),defaultFolder:defaultSessionsFolder()};}
    else if(path==='/api/reaper/plan'&&req.method==='GET'){const plan=await recentPlan();result={...plan,hoursFree:await freeHours(homedir(),plan)};}
    else if(path==='/api/reaper/session'&&req.method==='POST'){
     const d=await body(req);if(reaper.status().recording)throw Error('Un enregistrement est en cours : arrête-le avant de préparer une session.');
     const plan=await reaperPlan();
     if(Array.isArray(d.tracks))for(const t of plan.tracks)t.selected=d.tracks.includes(t.id);
     const session=await createSession(plan,{name:d.name,folder:d.folder});
     access.log(user!,'Session Reaper créée : '+session.title);
     reaper.session={...session,tracks:plan.tracks.filter(t=>t.selected).length};
     await reaper.watch();await openInReaper(session.file);
     result=reaper.status();
    }
    else if(path==='/api/reaper/rec'&&req.method==='POST'){access.log(user!,'Reaper : Rec');result=await reaper.record();}
    else if(path==='/api/reaper/stop'&&req.method==='POST'){access.log(user!,'Reaper : Stop');result=await reaper.stop();}
    else if(path==='/api/reaper/marker'&&req.method==='POST')result=await reaper.marker();
    else if(path==='/api/reaper/dismiss'&&req.method==='POST')result=reaper.dismissAlert();
    else{res.writeHead(404);res.end(JSON.stringify({error:'Introuvable'}));return;}
    res.end(JSON.stringify(result));
   }catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));}
   return;
  }
  if(path==='/api/rehearsal'){
    try{
      if(req.method==='POST'){
        const d=await body(req);if(typeof d.on!=='boolean')throw Error('on: true ou false');
        xr18.setRehearsal(d.on);writeFileSync(rehearsalPath,JSON.stringify({on:d.on}));diagnostic('rehearsal',{on:d.on});
        if(d.on&&xr18.status().writesEnabled&&xr18.status().connected)await xr18.writeParameter('/lr/mix/on',0);
      }
      res.end(JSON.stringify({on:xr18.isRehearsal(),mainOn:xr18.mainState().on}));
    }catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));}return;
  }
  if(path.startsWith('/api/analysis')){
    try{
      let result:unknown;const d:any=req.method==='POST'?await body(req):{};
      if(req.method==='GET'&&path==='/api/analysis')result=analyzer.snapshot();
      else if(path==='/api/analysis/start')result=analyzer.start(d.target);
      else if(path==='/api/analysis/stop')result=analyzer.stop();
      else if(path==='/api/analysis/target')result=analyzer.setTarget(d.target);
      else if(path==='/api/analysis/scan')result=await analyzer.scan();
      else if(path==='/api/analysis/dismiss')result=analyzer.dismiss(String(d.id));
      else if(path==='/api/analysis/release'){analyzer.release(String(d.id));result=analyzer.snapshot();}
      else if(path==='/api/analysis/listen'){if(d.side!=='a'&&d.side!=='b')throw Error('side a ou b');result=await analyzer.listen(String(d.id),d.side);}
      else if(path==='/api/analysis/preview'){
        // Back to A first: the backup taken at apply time must hold the real "before".
        const r=analyzer.find(String(d.id));await analyzer.restoreA(r.id);
        const plan=await show.console.preview(r.changes);analyzer.release(r.id);
        result={...plan,title:r.title,explanation:r.why,inputs:[r.where],recommendation:r};
      }
      else{res.writeHead(404);res.end(JSON.stringify({error:'Action inconnue'}));return;}
      res.end(JSON.stringify(result));
    }catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));}return;
  }
  if(path.startsWith('/api/coach/')&&req.method==='POST'){
    try{const d=await body(req);let result:unknown;
      if(path==='/api/coach/profile')result=coach.saveProfile(d.profile);
      else if(path==='/api/coach/prepare')result=await coach.prepare(d.channel===undefined?undefined:Number(d.channel));
      else if(path==='/api/coach/gain')result=await coach.gainCheck(Number(d.channel));
      else if(path==='/api/coach/bleed')result=await coach.bleedCheck(Number(d.channel));
      else if(path==='/api/coach/calibration')result=await coach.calibrationStatus();
      else if(path==='/api/coach/ears')result=await coach.prepareEars(d.bus===undefined?undefined:Number(d.bus));
      else if(path==='/api/coach/ears/share'){
        // Personal QR link for every musician that has none yet on its bus.
        const musicians=coach.profile().musicians??[];let created=0;
        for(const m of musicians)if(!ears.list().some(s=>s.bus===m.bus)){ears.create(m.name,m.bus);created++;}
        result={created,status:ears.status()};
      }
      else if(path==='/api/coach/suggest')result=await coach.suggest(Number(d.channel),String(d.symptom));
      else if(path==='/api/coach/apply'){if(d.confirm!==true)throw Error('Confirmation requise');result=await coach.apply(d.token,d.confirm);}
      else if(path==='/api/coach/undo')result=await coach.undo();
      else if(path==='/api/coach/measure')result=await coach.measure(Number(d.channel));
      else if(path==='/api/coach/ask'){
        if(typeof d.message!=='string'||!d.message.trim()||d.message.length>2000)throw Error('Question de 1 à 2 000 caractères requise');
        const channel=Number(d.channel),input=coach.profile().inputs.find(i=>i.channel===channel);
        if(!input)throw Error('Choisir un instrument de la préparation');
        if(d.external===true){if(d.consent!==true)throw Error('Accord explicite requis avant envoi à OpenAI');if(Date.now()-aiRequestAt<5000)throw Error('Attendre quelques secondes entre deux demandes IA');aiRequestAt=Date.now();result={source:'openai',...await askConnectedCoach(d.message,{source:input.source,mode:xr18.mode,connected:xr18.status().connected},d.consent)};}
        else{const symptom=identifySymptom(d.message);result=symptom?{source:'local',symptom,...coach.advice(channel,symptom)}:{source:'local',answer:'Je peux t’aider à préparer le groupe, vérifier les niveaux et tester une correction à la fois. Décris ce qui te gêne : son brouillon, agressif, notes coupées, saturation, bruit ou voix difficile à distinguer.',check:'Choisis d’abord le canal et l’instrument, puis explique ce que tu entends. Je ne reçois aucun audio par OSC.',measuredAudio:false};}
      }else throw Error('Action du conseiller inconnue');
      res.end(JSON.stringify(result));
    }catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));}return;
  }
  if(path==='/api/console/fx'&&req.method==='GET'){try{res.end(JSON.stringify(await xr18.readFx(Number(new URL(req.url!,'http://localhost').searchParams.get('slot')))));}catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));}return;}
  if(path==='/api/console/parameters'&&req.method==='GET'){
    const prefix=new URL(req.url!,'http://localhost').searchParams.get('prefix')??'/ch/01/';
    res.end(JSON.stringify({parameters:show.console.catalog(prefix),status:xr18.status()}));return;
  }
  if(path==='/api/console/refresh'&&req.method==='POST'){
    const d=await body(req);try{await xr18.refreshParameters(String(d.prefix));res.end(JSON.stringify({ok:true}));}catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));}return;
  }
  if(path==='/api/console/preview'&&req.method==='POST'){
    try{const d=await body(req);res.end(JSON.stringify(await show.console.preview(d.values)));}catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));}return;
  }
  if(path==='/api/console/blank'&&req.method==='POST'){
    try{res.end(JSON.stringify({...await show.console.preview(Object.fromEntries(Object.entries(blankSceneValues()).filter(([a])=>xr18.supports(a))),true),...BLANK_SCENE_TEXT,inputs:[]}));}catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));}return;
  }
  if(path==='/api/console/restore'&&req.method==='POST'){
    // Preview going back to the values saved just before an apply (undo).
    try{const d=await body(req);const saved=library.get(String(d.backupId));if(saved.kind!=='parameter-backup')throw Error('Sauvegarde incompatible');res.end(JSON.stringify({...await show.console.preview(saved.data,true),title:'Revenir à avant',explanation:'Les réglages modifiés reprennent les valeurs sauvegardées juste avant le changement.',inputs:[]}));}catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));}return;
  }
  if(path==='/api/console/apply'&&req.method==='POST'){
    try{const d=await body(req);if(d.confirm!==true)throw Error('Confirmation requise');res.end(JSON.stringify(await show.console.apply(d.token,d.allowPhantom===true,d.tolerant===true)));}catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));}return;
  }
  if(path==='/api/console/mute-all'&&req.method==='POST'){
    try{const d=await body(req);if(d.confirm!==true)throw Error('Confirmation requise');const values:Record<string,Value>={};for(let i=1;i<=xr18.model().channels;i++)values[`/ch/${String(i).padStart(2,'0')}/mix/on`]=0;const p=await show.console.preview(values,true);res.end(JSON.stringify(await show.console.apply(p.token)));}catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));}return;
  }
    const monitorProfiles=/^\/api\/monitor\/([1-6])\/profiles(?:\/([a-f0-9-]+)\/(apply))?$/.exec(path);
  if(monitorProfiles){
    try{const bus=Number(monitorProfiles[1]);
      if(req.method==='GET'&&!monitorProfiles[2]){res.end(JSON.stringify(database.listEarProfiles().filter(p=>p.bus===bus)));return;}
      if(req.method==='POST'){
        const data=await body(req);
        if(!monitorProfiles[2]){const levels=[];for(let channel=1;channel<=16;channel++)levels.push(await xr18.readParameter(`/ch/${String(channel).padStart(2,'0')}/mix/${String(bus).padStart(2,'0')}/level`));res.end(JSON.stringify(database.saveEarProfile({musician:data.name,bus,levels})));return;}
        if(data.confirm!==true)throw Error('Confirmation requise');
        const profile=database.listEarProfiles().find(p=>p.id===monitorProfiles[2]&&p.bus===bus);if(!profile||profile.levels.some(v=>v>.75))throw Error('Profil absent ou au-dessus du plafond');
        const values:Record<string,Value>={};for(let channel=1;channel<=xr18.model().channels;channel++)values[`/ch/${String(channel).padStart(2,'0')}/mix/${String(bus).padStart(2,'0')}/level`]=profile.levels[channel-1]!;
        const before:Record<string,Value>={};for(const a of Object.keys(values))before[a]=await xr18.readParameter(a);library.save('parameter-backup','Avant rappel retour',before);
        for(let step=1;step<=15;step++){const ramp=Object.fromEntries(Object.entries(values).map(([a,v])=>[a,Number(before[a])+(Number(v)-Number(before[a]))*step/15]));await xr18.applyParameters(ramp);await new Promise(r=>setTimeout(r,30));}
        res.end(JSON.stringify({ok:true}));return;
      }
    }catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));return;}
  }
    if(user&&await studioApi.handle(req,res,path,user))return;
  if (req.method === "GET" && path === "/api/status") { res.end(JSON.stringify(xr18.status())); return; }
  if(req.method==='GET'&&path==='/api/dynamics'){
    xr18.subscribeAnalysis();
    const frame=xr18.status().connected&&dynamicsFrame&&Date.now()-dynamicsFrame.at<2000?dynamicsFrame:null;
    res.end(JSON.stringify({frame}));return;
  }
  if (req.method === "GET" && path === "/api/meters") {res.end(JSON.stringify(xr18.meterState()));return;}
  if (req.method === "GET" && path === "/api/channels") { res.end(JSON.stringify(xr18.listChannels())); return; }
  if(req.method==="GET"&&path==="/api/main"){res.end(JSON.stringify(xr18.mainState()));return;}
  const mixerWrite=/^\/api\/(?:channels\/(\d+)\/(on)|main\/(fader|on))$/.exec(path);
  if(req.method==="POST"&&mixerWrite){
    try{
      let raw="";for await(const part of req){raw+=part;if(raw.length>1024)throw Error("Payload too large");}
      const data:unknown=JSON.parse(raw);if(!data||typeof data!=="object"||Array.isArray(data))throw Error("Invalid body");
      const value=(data as Record<string,unknown>).value;
      if(mixerWrite[2]==="on"||mixerWrite[3]==="on"){
        if(typeof value!=="boolean")throw Error("Boolean value required");
        if(mixerWrite[1])xr18.setOn(Number(mixerWrite[1]),value);else xr18.setMainOn(value);
      }else{
        if(typeof value!=="number")throw Error("Numeric value required");
        xr18.setMainFader(value);
      }
      res.end(JSON.stringify({ok:true,acknowledged:xr18.mode==="simulation"}));return;
    }catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));return;}
  }
  if(req.method==="POST"&&path==="/api/osc/advanced/write"){
    try{
      if(req.headers.origin && !["http://127.0.0.1","http://localhost"].some(base=>req.headers.origin!.startsWith(base+":")))throw Error("Remote origin denied");
      let raw="";for await(const part of req){raw+=part;if(raw.length>512)throw Error("Payload too large");}
      const data:unknown=JSON.parse(raw);
      if(!data||typeof data!=="object"||Array.isArray(data))throw Error("Invalid request");
      const {address,value,confirm} = data as Record<string,unknown>;
      if(confirm!==true||typeof address!=="string"||typeof value!=="number")throw Error("Explicit confirmation and numeric OSC value required");
      xr18.writeAdvanced(address,value);
      res.end(JSON.stringify({ok:true,sent:true,hardwareAcknowledged:false,address}));return;
    }catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));return;}
  }
  if(req.method==="GET"&&path==="/api/osc/advanced"){res.end(JSON.stringify({values:xr18.advancedState(),readOnly:true,verifiedOnHardware:false}));return;}
  const advancedMatch=/^\/api\/osc\/advanced\/channels\/(\d+)\/refresh$/.exec(path);
  if(req.method==="POST"&&advancedMatch){try{xr18.refreshAdvanced(Number(advancedMatch[1]));res.end(JSON.stringify({ok:true,readOnly:true}));}catch(e){res.writeHead(400);res.end(JSON.stringify({error:(e as Error).message}));}return;}
  if(req.method==="POST"&&path==="/api/osc/advanced/fx/refresh"){xr18.refreshFx();res.end(JSON.stringify({ok:true,readOnly:true}));return;}
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
const wss = new WebSocketServer({ server, path: "/ws", verifyClient:({req},done)=>done(sameOrigin(req)&&!!access.user(req),401) });
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
server.listen(port, listenHost, () => console.log(`BandPilot API on ${tls?"https":"http"}://${listenHost}:${port} (${xr18.mode})`));
const statusTimer=setInterval(()=>{for(const ws of wss.clients){const req=wsRequests.get(ws);if(!req||!access.user(req))ws.terminate();}const message=JSON.stringify({type:"status",status:xr18.status()});for(const ws of wss.clients)if(ws.readyState===WebSocket.OPEN)ws.send(message);},2000);
statusTimer.unref();
function shutdown(){clearInterval(statusTimer);ears.close();xr18.close();database.close();access.close();library.close();for(const ws of wss.clients)ws.terminate();wss.close();server.close();}
process.once("SIGINT",shutdown);
process.once("SIGTERM",shutdown);



