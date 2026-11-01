import {PARAMETERS,descriptor,validateWire,defaultWire,readbackTolerance,type Value} from "./parameters.js";

/** Solo switches (X-AIR Edit /-stat/solosw/NN): not part of scenes, live control only. */
const SOLO=/^\/-stat\/solosw\/(0[1-9]|1[0-6])$/;
/** Live control never touches 48 V or routing: those keep their confirmed preview flow. */
export function liveAllowed(address:string){return SOLO.test(address)||(!!PARAMETERS[address]&&!address.endsWith('/phantom')&&!address.startsWith('/routing/')&&!/^\/fx\/[1-4]\/type$/.test(address));}
/** /meters/1 order (40 values): ch1-16, aux L/R, fx return 1-4 L/R, bus 1-6, fx send 1-4, main L/R, monitor L/R. */
export const METER_LAYOUT={channels:0,aux:16,fxReturns:18,buses:26,fxSends:32,main:36,monitor:38,count:40} as const;
import dgram from "node:dgram";
import { EventEmitter } from "node:events";
import { decodeOsc, decodeXAirMeterBlob, encodeOsc, oscFloat, type OutgoingOscArg, type OscMessage } from "./osc.js";

export type Mode = "simulation" | "real";
export interface ChannelState { channel: number; fader: number; on: boolean; updatedAt: string | null }
export class XR18 extends EventEmitter {
  private currentMode: Mode;
  get mode(): Mode { return this.currentMode; }
  private socket?: dgram.Socket;
  private timer?: NodeJS.Timeout;
  private host: string;
  private port: number;
  private writes: boolean;
  private parameterValues=new Map<string,{value:Value;updatedAt:string}>();
  private generation=0;
  private operationEpoch=0;
  cancelOperations(){this.operationEpoch++;}
  operationId(){return this.operationEpoch;}
  private fxValues=new Map<number,{slot:number;algorithm:number;parameters:{type:"f"|"i";value:number}[]}>();
  parameterState(){return Object.fromEntries(this.parameterValues);}
  /** Rehearsal mode: the band only listens through the ears, the Main (front of house) stays muted. */
  private rehearsal=false;
  setRehearsal(on:boolean){this.rehearsal=on;}
  isRehearsal(){return this.rehearsal;}
  private guardMain(address:string,value:unknown){if(this.rehearsal&&address==='/lr/mix/on'&&Number(value)!==0)throw Error('Mode Répétition : le Main reste coupé. Quitte le mode Répétition pour l’ouvrir.');}
  // ---------- analysis meters (spectrum analyser and dynamics) ----------
  /** RTA source codes of the XR18 (checked on a physical XR18V2): 0-15 channels, 16 aux, 17-20 FX returns, 21-26 buses, 27-30 FX sends, 31 Main LR, 32 monitor. */
  static readonly RTA={channel:(n:number)=>n-1,aux:16,fx:(n:number)=>16+n,bus:(n:number)=>20+n,fxSend:(n:number)=>26+n,lr:31,mon:32} as const;
  private analysisTimer?:NodeJS.Timeout;
  /** Ask the console for the spectrum (/meters/4) and gain reduction (/meters/6) for the next ~10 s; call again to keep them coming. */
  subscribeAnalysis(){if(this.mode!=='real')return;this.send('/meters',['/meters/4']);this.send('/meters',['/meters/6']);}
  startAnalysisStream(){this.subscribeAnalysis();if(!this.analysisTimer){this.analysisTimer=setInterval(()=>this.subscribeAnalysis(),4000);this.analysisTimer.unref();}}
  stopAnalysisStream(){if(this.analysisTimer){clearInterval(this.analysisTimer);this.analysisTimer=undefined;}}
  /** What the analyser listens to. A display setting of the console: it does not change the sound. */
  setRtaSource(code:number,post=false){
    if(!Number.isInteger(code)||code<0||code>32)throw Error('Source d’analyse 0..32');
    if(this.mode!=='real')return;
    this.send('/-stat/rta/source',[code]);this.send('/-stat/rta/pos',[post?1:0]);
  }
  private remember(address:string,value:Value){
    const state={value,updatedAt:new Date().toISOString()};this.parameterValues.set(address,state);this.emit('parameter',{address,...state});
  }
  async readParameter(address:string):Promise<Value>{
    const p=descriptor(address);
    if(this.mode==='simulation'){
      const c=/^\/ch\/(\d{2})\/mix\/(fader|on)$/.exec(address);
      if(c){const state=this.channels.get(Number(c[1]))!;return c[2]==='fader'?state.fader:state.on?1:0;}
      if(address==='/lr/mix/fader')return this.main.fader;if(address==='/lr/mix/on')return this.main.on?1:0;
      return this.parameterValues.get(address)?.value??defaultWire(p);
    }
    const reply=await this.query(address);const value=validateWire(address,reply.args[0]);this.remember(address,value);return value;
  }
  async refreshParameters(prefix:string){
    if(!prefix.startsWith('/')||prefix.length<3)throw Error('Groupe requis');
    const addresses=Object.keys(PARAMETERS).filter(a=>a===prefix||a.startsWith(prefix+'/'));
    if(!addresses.length||addresses.length>500)throw Error('Choisir un groupe de 1 à 500 paramètres');
    const generation=this.generation;
    for(let offset=0;offset<addresses.length;offset+=8){
      if(generation!==this.generation)throw Error('Connexion modifiée');
      await Promise.all(addresses.slice(offset,offset+8).map(async a=>{const v=await this.readParameter(a);if(this.mode==='simulation')this.remember(a,v);}));
      await new Promise(r=>setTimeout(r,10));
    }
    return this.parameterState();
  }
  async writeParameter(address:string,value:Value,allowPhantom=false){
    const checked=validateWire(address,value),p=descriptor(address);this.guardMain(address,checked);
    if(address.endsWith('/phantom')&&!allowPhantom)throw Error('Confirmation 48 V requise');
    if(this.mode==='simulation'){
      const fxType=/^\/fx\/([1-4])\/type$/.exec(address);if(fxType&&this.fxValues.get(Number(fxType[1]))?.algorithm!==checked)this.fxValues.set(Number(fxType[1]),{slot:Number(fxType[1]),algorithm:checked as number,parameters:[]});
      this.remember(address,checked);if(this.advancedAddresses.has(address)){const state={value:checked,updatedAt:new Date().toISOString()};this.advanced.set(address,state);this.emit('advanced',{address,...state});}
      const c=/^\/ch\/(\d{2})\/mix\/(fader|on)$/.exec(address);
      if(c){if(c[2]==='fader')this.setFader(Number(c[1]),checked as number);else this.setOn(Number(c[1]),checked===1);}
      if(address==='/lr/mix/fader')this.setMainFader(checked as number);
      if(address==='/lr/mix/on')this.setMainOn(checked===1);
      return checked;
    }
    if(!this.writes||!this.isLive())throw Error('Écritures désactivées ou XR18 déconnectée');
    const generation=this.generation;
    // Request readback after sending, never update optimistically.
    this.send(address,[p.type==='f'?oscFloat(checked as number):checked]);
    const observed=await this.readParameter(address);
    if(generation!==this.generation)throw Error('Connexion modifiée pendant écriture');
    // The console quantizes floats (e.g. 201 steps for EQ frequency): compare within half a step.
    if(typeof observed==='number'&&typeof checked==='number'?Math.abs(observed-checked)>readbackTolerance(address):observed!==checked)throw Error('Lecture différente : '+address);
    return observed;
  }
  async applyParameters(values:Record<string,Value>,allowPhantom=false,tolerant=false){
    // Rehearsal: a scene recall or a bulk change never reopens the Main; everything else is applied.
    if(this.rehearsal&&'/lr/mix/on' in values&&Number(values['/lr/mix/on'])!==0){values={...values};delete values['/lr/mix/on'];this.emit('warning','Mode Répétition : Main laissé coupé');}
    for(const [a,v] of Object.entries(values)){validateWire(a,v);if(a.endsWith('/phantom')&&!allowPhantom)throw Error('Confirmation 48 V requise');}
    const generation=this.generation,operation=this.operationEpoch;
    const failed:string[]=[];
    for(const [a,v] of Object.entries(values)){
      if(generation!==this.generation||operation!==this.operationEpoch)throw Error('Opération interrompue');
      if(!tolerant){await this.writeParameter(a,v,allowPhantom);continue;}
      // Tolerant mode (guided set-up of many channels): one value the console reads back
      // differently must not stop the remaining instruments. Retry once, then report it.
      try{await this.writeParameter(a,v,allowPhantom);}
      catch(e){if(/Lecture différente|Pas de réponse XR18/.test((e as Error).message)){try{await this.writeParameter(a,v,allowPhantom);}catch{failed.push(a);}}else throw e;}
    }
    return {failed};
  }
  private connected = false;
  private lastReplyAt: number | null = null;
  private readonly staleAfterMs = 18000;
  private readonly channels = new Map<number, ChannelState>();
  private meters:{channels:number[];all:number[];updatedAt:string}|null=null;
  meterState(){return this.meters&&Date.now()-Date.parse(this.meters.updatedAt)<5000?{...this.meters,available:true}:{channels:[],all:[],updatedAt:null,available:false};}
  private readonly advanced = new Map<string,{value:number|string;updatedAt:string}>();
  private readonly advancedAddresses = new Set<string>();
  private main: ChannelState = {channel:0,fader:0.5,on:true,updatedAt:null};
  constructor(opts: { mode: Mode; host: string; port: number; enableWrites: boolean; autoSync?: boolean }) {
    super(); this.autoSync = opts.autoSync !== false; this.currentMode = opts.mode; this.host = opts.host; this.port = opts.port;
    this.writes = opts.mode === "real" && opts.enableWrites;
    for (let i = 1; i <= 16; i++) this.channels.set(i, { channel: i, fader: 0.5, on: true, updatedAt: null });
    if (this.mode === "simulation") this.connected = true;
    for(let ch=1;ch<=16;ch++){
      const prefix=`/ch/${String(ch).padStart(2,"0")}`;
      for(const suffix of ["eq/on","eq/1/f","eq/1/g","eq/1/q","eq/2/f","eq/2/g","eq/2/q","eq/3/f","eq/3/g","eq/3/q","eq/4/f","eq/4/g","eq/4/q","dyn/on","dyn/thr","dyn/ratio","dyn/attack","dyn/release","gate/on","gate/thr","gate/attack","gate/release","mix/01/level","mix/02/level","mix/03/level","mix/04/level","mix/05/level","mix/06/level"]){this.advancedAddresses.add(`${prefix}/${suffix}`);}
    }
    for(let i=1;i<=4;i++)this.advancedAddresses.add(`/fx/${i}/type`);
  }
  status() { const live=this.mode==="simulation"||this.isLive(); return { mode: this.mode, connected: live, writesEnabled: this.writes, port:this.port, host: this.mode === "real" ? this.host : undefined, lastReplyAt:this.lastReplyAt?new Date(this.lastReplyAt).toISOString():null, lastValuesAreVerified: live&&this.mode==="real" }; }
  private isLive(){return this.connected&&this.lastReplyAt!==null&&Date.now()-this.lastReplyAt<this.staleAfterMs;}
  listChannels() { return [...this.channels.values()]; }
  mainState() { return {...this.main}; }
  advancedState(channel?:number){const prefix=channel===undefined?"":`/ch/${String(channel).padStart(2,"0")}/`;return Object.fromEntries([...this.advanced].filter(([address])=>address.startsWith(prefix)));}
  refreshAdvanced(channel:number){if(!Number.isInteger(channel)||channel<1||channel>16)throw Error("Channel must be 1..16");if(this.mode!=="real"||!this.isLive())return;const prefix=`/ch/${String(channel).padStart(2,"0")}/`;for(const address of this.advancedAddresses)if(address.startsWith(prefix))this.send(address);}
  /** Direct OSC write, explicit operator opt-in; never update local state until hardware echoes. */
  writeAdvanced(address:string,value:number){
    if(this.mode!=='real'||!this.writes||!this.isLive())throw Error('Real XR18 connection and write opt-in required');
    if(!this.advancedAddresses.has(address)||address.startsWith('/fx/'))throw Error('OSC parameter not allowlisted');
    validateWire(address,value);const p=descriptor(address);this.send(address,[p.type==='f'?oscFloat(value):value]);
  }
  private pendingLocal=new Map<string,number>();
  private readbackTimers=new Map<string,NodeJS.Timeout>();
  /**
   * Immediate control like X-AIR Edit (fader drag, knob, mute, solo): no preview, no blocking readback.
   * The value is shown at once, then re-read from the console 300 ms after the last move to show
   * the quantized value actually stored by the XR18.
   */
  liveSet(address:string,value:number|string){
    if(!liveAllowed(address))throw Error('Paramètre non autorisé en contrôle direct : '+address);
    this.guardMain(address,value);
    const checked:Value=SOLO.test(address)?(value===1||value===0?value:(()=>{throw Error('Solo 0 ou 1');})()):validateWire(address,value);
    if(this.mode==='simulation'){this.applyLocal(address,checked);return checked;}
    if(!this.writes||!this.isLive())throw Error('Écritures désactivées ou XR18 déconnectée');
    const p=PARAMETERS[address];
    this.send(address,[p?.type==='f'?oscFloat(checked as number):checked]);
    this.pendingLocal.set(address,Date.now()+250);
    this.applyLocal(address,checked);
    clearTimeout(this.readbackTimers.get(address));
    const generation=this.generation;
    const timer=setTimeout(()=>{this.readbackTimers.delete(address);this.pendingLocal.delete(address);if(generation===this.generation)this.send(address);},300);
    timer.unref();this.readbackTimers.set(address,timer);
    return checked;
  }
  /** Update caches and legacy channel/main state without pretending it is a console reply. */
  private applyLocal(address:string,value:Value){
    this.remember(address,value);
    const now=new Date().toISOString();
    const c=/^\/ch\/(0[1-9]|1[0-6])\/mix\/(fader|on)$/.exec(address);
    if(c&&typeof value==='number'){const state=this.channels.get(Number(c[1]))!;if(c[2]==='fader')state.fader=value;else state.on=value!==0;state.updatedAt=now;this.emit('state',{...state});}
    if((address==='/lr/mix/fader'||address==='/lr/mix/on')&&typeof value==='number'){if(address.endsWith('fader'))this.main.fader=value;else this.main.on=value!==0;this.main.updatedAt=now;this.emit('main',{...this.main});}
    if(this.advancedAddresses.has(address)){const state={value,updatedAt:now};this.advanced.set(address,state);this.emit('advanced',{address,...state});}
  }
  private syncing=false;
  private autoSync=true;
  /** Full pull of the console state, as X-AIR Edit does on "Mixer -> PC" synchronisation. */
  async syncLiveView(){
    const addresses=[...Object.keys(PARAMETERS),...Array.from({length:16},(_,i)=>`/-stat/solosw/${String(i+1).padStart(2,'0')}`)];
    if(this.mode==='simulation'){
      for(const a of addresses){if(this.parameterValues.has(a))continue;const v=PARAMETERS[a]?await this.readParameter(a):0;this.remember(a,v);}
      return {requested:addresses.length};
    }
    if(this.syncing||!this.socket)return {requested:0};
    this.syncing=true;const generation=this.generation;
    try{
      // ~800 requests per second: gentle on the console's network stack (full pull in ~3 s).
      for(let i=0;i<addresses.length;i+=8){
        if(generation!==this.generation)break;
        for(const a of addresses.slice(i,i+8))this.send(a);
        await new Promise(r=>setTimeout(r,10));
      }
    }finally{this.syncing=false;}
    return {requested:addresses.length};
  }
  refreshFx(){if(this.mode!=="real"||!this.isLive())return;for(const address of this.advancedAddresses)if(address.startsWith("/fx/"))this.send(address);}
  async start(): Promise<void> {
    if (this.mode === "simulation") return;
    this.socket = dgram.createSocket("udp4");
    this.socket.on("message", (data, rinfo) => {
      if (rinfo.address !== this.host || rinfo.port !== this.port) return;
      try { this.handle(decodeOsc(data)); } catch (err) { this.emit("warning", String(err)); }
    });
    const transport=this.socket;
    this.socket.on("error", err => { if(this.socket!==transport)return; this.connected = false; this.emit("connection",{connected:false}); this.emit("warning", err.message); });
    await new Promise<void>((resolve, reject) => {
      this.socket!.once("listening", resolve);
      this.socket!.once("error", reject);
      this.socket!.bind(0);
    });
    // XR18 remote update subscription; refresh every 8s (subscription nominally 10s).
    this.send("/xremote");
    this.send("/meters",["/meters/1",2]);
    this.timer = setInterval(() => {this.send("/xremote");this.send("/meters",["/meters/1",2]); this.send("/lr/mix/fader"); if(this.connected&&!this.isLive()){this.connected=false;this.emit("connection",{connected:false});}}, 8000);
    this.timer.unref();
    this.send("/lr/mix/fader");
    this.send("/lr/mix/on");
    // Request initial values explicitly; OSC push subscriptions may not include initial state.
    for (let i = 1; i <= 16; i++) {
      this.send(`/ch/${String(i).padStart(2, "0")}/mix/fader`);
      this.send(`/ch/${String(i).padStart(2, "0")}/mix/on`);
      for(const suffix of ['config/name','config/color','mix/pan'])this.send(`/ch/${String(i).padStart(2,'0')}/${suffix}`);
      this.send(`/headamp/${String(i).padStart(2,'0')}/gain`);
    }
    // Then pull everything else in the background so the graphical mixer shows the real console.
    const generation=this.generation;
    if(this.autoSync)setTimeout(()=>{if(generation===this.generation)void this.syncLiveView().catch(e=>this.emit('warning',String(e)));},400).unref();
  }
  private send(address: string, args: OutgoingOscArg[] = []) {
    if (!this.socket) return;
    const b = encodeOsc(address, args);
    this.socket.send(b, this.port, this.host, err => { if (err) this.emit("warning", err.message); });
  }
  /** Any well-formed reply from the console proves the link is alive (not only faders/meters). */
  private markAlive(){const was=this.isLive();this.connected=true;this.lastReplyAt=Date.now();if(!was)this.emit("connection",{connected:true});}
  private handle(msg: OscMessage) {
    this.emit("osc-reply",msg);
    this.markAlive();
    if(this.pendingLocal.has(msg.address)&&Date.now()<this.pendingLocal.get(msg.address)!)return;
    if(SOLO.test(msg.address)&&typeof msg.args[0]==="number"){this.remember(msg.address,msg.args[0]?1:0);return;}
    if(PARAMETERS[msg.address]){try{this.remember(msg.address,validateWire(msg.address,msg.args[0]));}catch{return;}}
    if(msg.address==="/meters/4"&&Buffer.isBuffer(msg.args[0])){
      // 100 bands, 20 Hz to 20 kHz on a log scale, in dB.
      try{this.emit('rta',{bands:decodeXAirMeterBlob(msg.args[0],100),at:Date.now()});}catch(e){this.emit('warning',String(e));}return;
    }
    if(msg.address==="/meters/6"&&Buffer.isBuffer(msg.args[0])){
      // 39 gain-reduction values (dB, ≤ 0): 16 channel gates, 16 channel compressors, 6 bus compressors, Main.
      try{const v=decodeXAirMeterBlob(msg.args[0],39);this.emit('dynamics',{gate:v.slice(0,16),comp:v.slice(16,32),bus:v.slice(32,38),lr:v[38],at:Date.now()});}catch(e){this.emit('warning',String(e));}return;
    }
    if(msg.address==="/meters/1"&&Buffer.isBuffer(msg.args[0])){
      const levels=decodeXAirMeterBlob(msg.args[0],METER_LAYOUT.count);
      this.meters={channels:levels.slice(0,16),all:levels,updatedAt:new Date().toISOString()};
      this.connected=true;this.lastReplyAt=Date.now();this.emit("meters",this.meterState());return;
    }
    const match = /^\/ch\/(0[1-9]|1[0-6])\/mix\/(fader|on)$/.exec(msg.address);
    if (!match) {
      if(this.advancedAddresses.has(msg.address)&&(typeof msg.args[0]==="number"||typeof msg.args[0]==="string")){
        const state={value:msg.args[0],updatedAt:new Date().toISOString()};this.advanced.set(msg.address,state);this.connected=true;this.lastReplyAt=Date.now();this.emit("advanced",{address:msg.address,...state});return;
      }
      if ((msg.address === "/lr/mix/fader" || msg.address === "/lr/mix/on") && typeof msg.args[0] === "number") {
        if(msg.address.endsWith("/fader") && msg.args[0]>=0 && msg.args[0]<=1) this.main.fader=msg.args[0];
        else if(msg.address.endsWith("/on")) this.main.on=msg.args[0]!==0;
        else return;
        this.main.updatedAt=new Date().toISOString();this.connected=true;this.lastReplyAt=Date.now();this.emit("main",{...this.main});
      }
      return;
    }
    if (typeof msg.args[0] !== "number") return;
    const channel = Number(match[1]), key = match[2];
    const state = this.channels.get(channel)!;
    if (key === "fader" && msg.args[0] >= 0 && msg.args[0] <= 1) state.fader = msg.args[0];
    else if (key === "on") state.on = msg.args[0] !== 0;
    else return;
    state.updatedAt = new Date().toISOString();
    this.connected = true; this.lastReplyAt=Date.now();
    this.emit("state", { ...state });
  }
  /** 0..1 normalized fader, not dB. Read-only unless explicit real-write opt-in. */
  setFader(channel: number, value: number) {
    if (!Number.isInteger(channel) || channel < 1 || channel > 16) throw new Error("Channel must be 1..16");
    if (!Number.isFinite(value) || value < 0 || value > 1) throw new Error("Fader must be 0..1");
    if (this.mode === "real" && !this.writes) throw new Error("Hardware writes disabled");
    if (this.mode === "real" && !this.isLive()) throw new Error("Console state stale or disconnected; refusing write");
    if (this.mode === "real") this.send(`/ch/${String(channel).padStart(2, "0")}/mix/fader`, [oscFloat(value)]);
    else { const state = this.channels.get(channel)!; state.fader = value; state.updatedAt = new Date().toISOString(); this.remember(`/ch/${String(channel).padStart(2,"0")}/mix/fader`,value);this.emit("state", { ...state }); }
  }
  setOn(channel:number,on:boolean) {
    if(!Number.isInteger(channel)||channel<1||channel>16)throw Error("Channel must be 1..16");
    if(typeof on!=="boolean")throw Error("Boolean on required");
    if(this.mode==="real"&&(!this.writes||!this.isLive()))throw Error("Hardware writes disabled or console not confirmed");
    if(this.mode==="real")this.send(`/ch/${String(channel).padStart(2,"0")}/mix/on`,[on?1:0]);
    else {const state=this.channels.get(channel)!;state.on=on;state.updatedAt=new Date().toISOString();this.remember(`/ch/${String(channel).padStart(2,"0")}/mix/on`,on?1:0);this.emit("state",{...state});}
  }
  setMainFader(value:number){
    if(!Number.isFinite(value)||value<0||value>1)throw Error("Main fader must be 0..1");
    if(this.mode==="real"&&(!this.writes||!this.isLive()))throw Error("Hardware writes disabled or console not confirmed");
    if(this.mode==="real")this.send("/lr/mix/fader",[oscFloat(value)]);
    else {this.main.fader=value;this.main.updatedAt=new Date().toISOString();this.remember("/lr/mix/fader",value);this.emit("main",{...this.main});}
  }
  setMainOn(on:boolean){
    if(typeof on!=="boolean")throw Error("Boolean on required");
    this.guardMain('/lr/mix/on',on?1:0);
    if(this.mode==="real"&&(!this.writes||!this.isLive()))throw Error("Hardware writes disabled or console not confirmed");
    if(this.mode==="real")this.send("/lr/mix/on",[on?1:0]);
    else {this.main.on=on;this.main.updatedAt=new Date().toISOString();this.remember("/lr/mix/on",on?1:0);this.emit("main",{...this.main});}
  }
  restoreAdvanced(values:Record<string,{value:number|string;updatedAt:string}>){
    if(this.mode!=='simulation')throw Error('Simulation uniquement');
    for(const [address,state] of Object.entries(values))if(!this.advancedAddresses.has(address)||!Number.isFinite(Number(state.value)))throw Error('Paramètre avancé invalide');
    this.advanced.clear();for(const [address,state] of Object.entries(values)){this.advanced.set(address,structuredClone(state));this.emit('advanced',{address,...state});}
  }
  async setMonitor(bus:number,channel:number,value:number){
    const address=`/ch/${String(channel).padStart(2,'0')}/mix/${String(bus).padStart(2,'0')}/level`;
    return this.writeParameter(address,value);
  }
  async query(address:string):Promise<OscMessage>{
    if(this.mode!=="real"||!this.isLive())throw Error("XR18 déconnectée");
    return new Promise((resolve,reject)=>{
      const cleanup=()=>{clearTimeout(timer);this.off('osc-reply',done);this.off('transport-closed',closed);};
      const closed=()=>{cleanup();reject(Error('Connexion modifiée'));};
      const done=(msg:OscMessage)=>{if(msg.address!==address)return;cleanup();resolve(msg);};
      const timer=setTimeout(()=>{cleanup();reject(Error('Pas de réponse XR18 : '+address));},1500);
      this.on('osc-reply',done);this.once('transport-closed',closed);this.send(address);
    });
  }
  async node(path:string):Promise<string>{
    if(this.mode!=='real'||!this.isLive())throw Error('XR18 déconnectée');
    return new Promise((resolve,reject)=>{const bare=path.slice(1);const done=(msg:OscMessage)=>{const text=msg.args.find(a=>typeof a==='string'&&(a.startsWith(path+' ')||a.startsWith(bare+' ')||a.trim()===path));if(typeof text!=='string')return;clearTimeout(timer);this.off('osc-reply',done);resolve((text.startsWith('/')?text:'/'+text).trim());};const timer=setTimeout(()=>{this.off('osc-reply',done);reject(Error('Nœud XR18 absent : '+path));},1500);this.on('osc-reply',done);this.send('/node',[path.slice(1)]);});
  }
  async applyNative(commands:{address:string;type:'f'|'i'|'s';value:number|string}[]){
    if(process.env.XR18_EXPERIMENTAL_SCENES!=="true"||!this.writes||!this.isLive())throw Error('Rappel matériel expérimental désactivé ou XR18 déconnectée');
    for(const c of commands){if(!this.isLive())throw Error('Rappel interrompu : XR18 déconnectée, état potentiellement partiel');this.send(c.address,[c.type==='f'?oscFloat(c.value as number):c.value]);await new Promise(resolve=>setTimeout(resolve,5));}
  }
  async readFx(slot:number){
    if(!Number.isInteger(slot)||slot<1||slot>4)throw Error('Slot FX 1..4 requis');
    if(this.mode==='simulation')return structuredClone(this.fxValues.get(slot)??{slot,algorithm:0,parameters:[]});
    const algorithm=await this.readParameter(`/fx/${slot}/type`);const reply=await this.query(`/fx/${slot}/par`);
    if(typeof algorithm!=='number'||!reply.args.length||reply.args.length>64||!reply.tags||!/^[fi]+$/.test(reply.tags))throw Error('Vecteur FX typé absent');
    // The XR18 always answers 64 values; the slots the effect does not use come back as NaN.
    // Keep only the used parameters (everything before the first NaN).
    const used=reply.args.findIndex(v=>typeof v!=='number'||!Number.isFinite(v));
    const args=used<0?reply.args:reply.args.slice(0,used);
    if(!args.length)throw Error('Paramètre FX invalide');
    const parameters=args.map((v,i)=>({type:reply.tags![i] as 'f'|'i',value:v as number}));
    const result={slot,algorithm,parameters};this.fxValues.set(slot,result);return structuredClone(result);
  }
  async applyFx(f:{slot:number;algorithm:number;parameters:{type:'f'|'i';value:number}[]}){
    if(!Number.isInteger(f.slot)||f.slot<1||f.slot>4||!Number.isInteger(f.algorithm)||f.algorithm<0||f.algorithm>60||f.parameters.length>64||f.parameters.some(p=>!Number.isFinite(p.value)||(p.type==='f'&&(p.value<0||p.value>1))||(p.type==='i'&&(!Number.isInteger(p.value)||p.value<0||p.value>127))))throw Error('FX invalide');
    if(this.mode==='simulation'){this.fxValues.set(f.slot,structuredClone(f));await this.writeParameter(`/fx/${f.slot}/type`,f.algorithm);return;}
    if(!this.writes||!this.isLive())throw Error('Écritures désactivées ou XR18 déconnectée');
    const generation=this.generation,operation=this.operationEpoch;
    await this.writeParameter(`/fx/${f.slot}/type`,f.algorithm);
    if(f.parameters.length){
      if(operation!==this.operationEpoch)throw Error('FX interrompu');
      // One address per parameter (/fx/N/par/01…): checked on a physical XR18, the console keeps each value.
      for(const [i,p] of f.parameters.entries()){
        if(operation!==this.operationEpoch||generation!==this.generation)throw Error('FX interrompu');
        this.send(`/fx/${f.slot}/par/${String(i+1).padStart(2,'0')}`,[p.type==='f'?oscFloat(p.value):p.value]);
        await new Promise(r=>setTimeout(r,3));
      }
      const observed=await this.readFx(f.slot);
      // The console rounds each FX value to its own step (e.g. 0.333 → 0.32): accept one step of 0.02.
      if(generation!==this.generation||observed.parameters.length<f.parameters.length||f.parameters.some((p,i)=>p.type!==observed.parameters[i]!.type||Math.abs(p.value-observed.parameters[i]!.value)>(p.type==='i'?0:.021)))throw Error('FX potentiellement partiel : lecture différente');
    }
    this.fxValues.set(f.slot,structuredClone(f));
  }
  /** Keep the same instance so scenes, API and subscriptions follow the new transport. */
  async reconnect(opts: {mode: Mode; host: string; port: number; enableWrites: boolean}) {
    this.close();
    this.currentMode=opts.mode;this.host=opts.host;this.port=opts.port;
    this.writes=opts.mode==='real'&&opts.enableWrites;
    this.lastReplyAt=null;this.meters=null;this.advanced.clear();this.parameterValues.clear();this.fxValues.clear();
    for(let i=1;i<=16;i++)this.channels.set(i,{channel:i,fader:.5,on:true,updatedAt:null});
    this.main={channel:0,fader:.5,on:true,updatedAt:null};
    this.connected=opts.mode==='simulation';
    this.emit('reset');this.emit('connection');
    try { await this.start(); } catch(e) { this.close();this.emit('connection');throw e; }
  }
  close() {
    this.stopAnalysisStream();
    this.generation++;this.emit("transport-closed");
    if(this.timer)clearInterval(this.timer);this.timer=undefined;
    for(const t of this.readbackTimers.values())clearTimeout(t);this.readbackTimers.clear();this.pendingLocal.clear();
    const socket=this.socket;this.socket=undefined;
    if(socket){socket.removeAllListeners('message');try{socket.close();}catch{}}
    this.connected=false;
  }
}


