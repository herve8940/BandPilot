import {SupportCenter} from './SupportCenter';
import {LanguageSettings} from "./LanguageSettings";
import {tx, getLocale, useLanguage} from "./i18n";
import {MixerModelContext} from './MixerModel';
import {DEFAULT_MIXER,type MixerProfile} from '../../shared/mixer-models';
import {X32Console} from './X32Console';
import {SoundCoach,PlanDialog,type Plan} from "./SoundCoach";
import {ReturnsPage} from "./ReturnsPage";
import {ConsolePanel} from "./ConsolePanel";
import {ExpertStudio} from "./expert/ExpertStudio";
import {WorkshopNotice} from './show/Workshop';
import {Rehearse} from "./show/Rehearse";
import {Concert} from "./show/Concert";
import {SimpleMixer} from "./SimpleMixer";
import "./theme.css";
import {FxConsole} from "./FxConsole";
import "./console-panel.css";
import {ConnectionPanel} from "./ConnectionPanel";
import {StudioControl} from "./StudioControl";
import {ScenesPage} from "./ScenesPage";
import { PROCESSING_PRESETS, PROCESSING_SOURCES, type ProcessingPreset } from "./processingPresets";
import { FX_PRESETS, type FxFamily } from "./fxPresets";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Eraser, Undo2, PanelLeftClose, PanelLeftOpen, Activity, AudioLines, Power, Gauge, Wrench, BookOpen, Cable, Check, ChevronDown, CircleAlert, Disc3, FolderOpen, Headphones, ListMusic, Mic2, Music2, Plus, Save, Settings2, ShieldCheck, SlidersHorizontal, Trash2, Wifi, WifiOff, Zap } from "lucide-react";
import "./studio.css";
import "./fx-library.css";
import "./processing.css";
import "./design-v3.css";
import "./recording-v3.css";
import "./show/rehearsal-responsive.css";
import "./expert/desk.css";
import "./visual-console.css";
import "./design-system.css";

type Channel = { channel: number; fader: number; on: boolean; updatedAt: string | null };
type Status = { profile?:MixerProfile;model?:string;port?:number;mode: "simulation" | "real"; connected: boolean; writesEnabled: boolean; host?:string };
type Scene = { id: string; name: string; created: string; faders: number[] };
type Song = { id: string; title: string; artist: string; bpm: number };
type Tab = "mixer" | "eq" | "dynamics" | "sends" | "fx" | "routing" | "dca" | "controls";
type Page = "coach" | "console" | "ears" | "rehearse" | "concert" | "rehearsals" | "setlists" | "scenes" | "settings";
type Stored = { scenes: Scene[]; songs: Song[]; setlist: string[]; notes: string };
const KEY = "xr18-studio-local-v1";
const NAMES = ["Chant","Guitare 1","Guitare 2","Basse","Kick","Caisse","Tom 1","Tom 2","OH gauche","OH droite","Clavier L","Clavier R","Playback L","Playback R","Ambiance","Réserve"];
const COLORS = ["#f87171","#f59e0b","#fbbf24","#34d399","#38bdf8","#38bdf8","#38bdf8","#38bdf8","#a78bfa","#a78bfa","#f472b6","#f472b6","#c084fc","#c084fc","#94a3b8","#94a3b8"];
const DEFAULT: Stored = { scenes: [], songs: [], setlist: [], notes: "" };
const INITIAL: Channel[] = Array.from({ length: 16 }, (_, i) => ({ channel: i + 1, fader: .5, on: true, updatedAt: null }));
function load(): Stored { try { const raw = localStorage.getItem(KEY); return raw ? { ...DEFAULT, ...JSON.parse(raw) } : DEFAULT; } catch { return DEFAULT; } }
function id() { return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`; }
function labelFor(n: number) { return NAMES[n - 1] ?? `Canal ${n}`; }
function normalized(v: number) { return Math.round(v * 100); }
const MENU: { page: Page; name: string; icon: typeof AudioLines }[] = [
  { page:"coach", name:"Mon ingé son", icon:Headphones },
  { page:"console", name:"Console", icon:SlidersHorizontal }, { page:"ears", name:"Retours in-ear", icon:Headphones },
  { page:"rehearsals", name:"Répétitions", icon:Music2 }, { page:"setlists", name:"Setlists", icon:ListMusic },
  { page:"scenes", name:"Snapshots", icon:Disc3 }, { page:"settings", name:"Configuration", icon:Settings2 },
];
type Space = "play" | "rehearse" | "show" | "prep" | "setup";
const SPACES: { id: Space; name: string; hint: string; icon: typeof AudioLines; pages: Page[] }[] = [
  { id:"prep", name:"Préparer", hint:"Morceaux, setlists et scènes", icon:ListMusic, pages:["setlists","rehearsals","scenes"] },
  { id:"play", name:"Régler le son", hint:"Coach, console et retours", icon:SlidersHorizontal, pages:["coach","console","ears"] },
  { id:"rehearse", name:"Répéter", hint:"Enregistrer et réécouter", icon:Music2, pages:["rehearse"] },
  { id:"show", name:"Concert", hint:"Dérouler le set", icon:ListMusic, pages:["concert"] },
  { id:"setup", name:"Réglages", hint:"Connexion et système", icon:Settings2, pages:["settings"] },
];
const PAGE_INFO: Record<Page, { name: string; hint: string; icon: typeof AudioLines }> = {
  console: { name:"Console", hint:"Volumes, mutes et réglages de chaque source", icon:SlidersHorizontal },
  rehearse: { name:"Répéter", hint:"Avec tes morceaux ReaCue ou le groupe seul", icon:Music2 },
  concert: { name:"Concert", hint:"Écran de scène : peu de boutons, gros affichage", icon:ListMusic },
  ears: { name:"Retours", hint:"Choisir un musicien · mixer · traiter · partager", icon:Headphones },
  coach: { name:"Mon ingé son", hint:"Préparer, écouter et corriger pas à pas", icon:Zap },
  setlists: { name:"Setlists", hint:"Répertoire et ordre de passage", icon:ListMusic },
  rehearsals: { name:"Notes de répète", hint:"Objectifs et notes de répétition", icon:BookOpen },
  scenes: { name:"Scènes", hint:"Sauvegarder et rappeler les réglages", icon:Disc3 },
  settings: { name:"Connexion & système", hint:"Trouver la console, comptes et sécurité", icon:Wrench },
};
const spaceOf = (page: Page) => SPACES.find(sp => sp.pages.includes(page))!.id;
function storedMode(): "simple" | "expert" { try { return localStorage.getItem("xr18-console-mode") === "expert" ? "expert" : "simple"; } catch { return "simple"; } }
const TABS: { id: Tab; name: string }[] = [
  {id:"mixer",name:"Console"},{id:"eq",name:"Préréglages par instrument"},{id:"fx",name:"Bibliothèque d’effets"},{id:"controls",name:"Tous les paramètres"},
];
export default function App() {
  useLanguage();
  const [page, setPage] = useState<Page>("coach");
  useEffect(()=>{const open=()=>setPage('settings');window.addEventListener('xr18-open-connection',open);return()=>window.removeEventListener('xr18-open-connection',open);},[]);
  const [tab, setTab] = useState<Tab>("mixer");
  const [fxFamily, setFxFamily] = useState<FxFamily | "Tous">("Tous");
  const [fxSearch, setFxSearch] = useState("");
  const [selectedFx, setSelectedFx] = useState("vocal-rock-plate");
  const [processingFilter, setProcessingFilter] = useState("Tous");
  const [processingChoice, setProcessingChoice] = useState("lead-rock");
  const [processingDraft, setProcessingDraft] = useState<ProcessingPreset | null>(null);
  const [processingRevision, setProcessingRevision] = useState(0);
  const [processingApplied, setProcessingApplied] = useState(false);
  const [metadata,setMetadata]=useState<Record<string,{value:string|number}>>({});
  function labelFor(n:number){const name=metadata[`/ch/${String(n).padStart(2,'0')}/config/name`]?.value;return typeof name==='string'&&name?name:status.mode==='real'?`Canal ${n}`:NAMES[n-1]??`Canal ${n}`;}
  function colorFor(n:number){const color=metadata[`/ch/${String(n).padStart(2,'0')}/config/color`]?.value;return typeof color==='number'?['#64748b','#f87171','#34d399','#fbbf24','#38bdf8','#f472b6','#22d3ee','#f8fafc'][color%8]:COLORS[n-1];}
  const [channels, setChannels] = useState<Channel[]>(INITIAL);
  const [mainState,setMainState]=useState<Channel>({channel:0,fader:.5,on:true,updatedAt:null});
  const [status, setStatus] = useState<Status>({ mode:"simulation", connected:false, writesEnabled:false });
  const initialConnectionShown=useRef(false);
  useEffect(()=>{if(status.mode==='real'&&status.connected&&!initialConnectionShown.current){initialConnectionShown.current=true;setPage('settings');}},[status.mode,status.connected]);
  const [socketOk, setSocketOk] = useState(false);
  const [lastOscUpdate,setLastOscUpdate]=useState<string|null>(null);
  const [meterState,setMeterState]=useState<{channels:number[];updatedAt:string|null;available:boolean}>({channels:[],updatedAt:null,available:false});
  const [advancedValue,setAdvancedValue]=useState<Record<string,string>>({});
  const [advancedReadback,setAdvancedReadback]=useState<Record<string,{value:number|string;updatedAt:string}>>({});
  const [selected, setSelected] = useState(1);
  const [consoleMode, setConsoleModeState] = useState<"simple" | "expert">(storedMode);
  const [expertTab, setExpertTab] = useState<"mixer" | "eq" | "comp" | "gate" | "sends" | "input">("mixer");
  const setConsoleMode = (mode: "simple" | "expert") => { setConsoleModeState(mode); try { localStorage.setItem("xr18-console-mode", mode); } catch { /* per-viewer convenience */ } };
  const [store, setStore] = useState<Stored>(load);
  const [notice, setNotice] = useState("");
  const [draftReady,setDraftReady]=useState(false), [draftStatus,setDraftStatus]=useState("Chargement du brouillon…");
  const draftVersion=useRef(0);
  const draftQueue=useRef(Promise.resolve());
  useEffect(()=>{let active=true;void Promise.all([api<{notes:string;setlist:string[]}|null>("/api/workspace"),api<{user:{role:string}|null}>("/api/auth")]).then(([d,a])=>{if(active){if(d)setStore(s=>{if((s.notes||s.setlist.length)&&JSON.stringify({notes:s.notes,setlist:s.setlist})!==JSON.stringify(d)){try{localStorage.setItem("xr18-workspace-before-migration",JSON.stringify({notes:s.notes,setlist:s.setlist}));}catch{}}return {...s,...d};});setDraftReady(a.user?.role==="admin");setDraftStatus(a.user?.role==="admin"?"Brouillon chargé":"Consultation du brouillon");}}).catch(()=>{if(active){setDraftStatus("Sauvegarde serveur indisponible");setNotice("Brouillon serveur indisponible : les notes restent dans ce navigateur.");}});return()=>{active=false;};},[]);
  useEffect(()=>{if(!draftReady)return;const version=++draftVersion.current;setDraftStatus("Enregistrement du brouillon…");const draft={notes:store.notes,setlist:store.setlist};draftQueue.current=draftQueue.current.catch(()=>{}).then(async()=>{await api("/api/workspace","PUT",draft);if(version===draftVersion.current)setDraftStatus("Brouillon sauvegardé sur cet ordinateur");}).catch(()=>{setDraftStatus("Brouillon non sauvegardé");setNotice("Le brouillon n’a pas été sauvegardé sur cet ordinateur. Réessaie avant de fermer.");});},[draftReady,store.notes,store.setlist]);
  // "Partir d'une scène vierge": preview → confirm → apply, with a one-click way back.
  const [blankPlan, setBlankPlan] = useState<Plan | null>(null), [blankBusy, setBlankBusy] = useState(false), [lastBackup, setLastBackup] = useState<string | null>(null);
  const startBlank = async () => { setBlankBusy(true); try { setBlankPlan(await api<Plan>("/api/console/blank", "POST", {})); } catch (e) { setNotice((e as Error).message); } finally { setBlankBusy(false); } };
  const [mutedBackup, setMutedBackup] = useState<string>(() => { try { return localStorage.getItem("xr18-muted-backup") ?? ""; } catch { return ""; } });
  const undoBlank = async () => { if (!lastBackup) return; setBlankBusy(true); try { setBlankPlan(await api<Plan>("/api/console/restore", "POST", { backupId: lastBackup })); } catch (e) { setNotice((e as Error).message); } finally { setBlankBusy(false); } };
  const applyBlank = async () => { if (!blankPlan) return; setBlankBusy(true); try { const r = await api<{ backupId: string; failed?: string[] }>("/api/console/apply", "POST", { token: blankPlan.token, confirm: true, tolerant: true }); const undo = blankPlan.title === "Revenir à avant"; setBlankPlan(null); setLastBackup(undo ? null : r.backupId); setNotice(r.failed?.length ? `${r.failed.length} réglage(s) non confirmé(s) par la console : relance pour réessayer.` : undo ? "Réglages d’avant remis en place." : "Console remise à neutre. Tous les volumes sont en bas : monte d’abord le volume général (Main), puis chaque canal. « Revenir à avant » annule."); } catch (e) { setNotice((e as Error).message); } finally { setBlankBusy(false); } };
  // Menu: compact (icons) automatically on the console so every strip fits; the user can force it either way.
  const [railPref, setRailPrefState] = useState<"auto" | "full" | "compact">(() => { try { const v = localStorage.getItem("xr18-rail"); return v === "full" || v === "compact" ? v : "auto"; } catch { return "auto"; } });
  const railCompact = railPref !== "full";
  const toggleRail = () => { const next = railCompact ? "full" : "compact"; setRailPrefState(next); try { localStorage.setItem("xr18-rail", next); } catch { /* per-viewer convenience */ } };
  const [sceneName, setSceneName] = useState("");
  const [songTitle, setSongTitle] = useState("");
  const [songArtist, setSongArtist] = useState("");
  const [songBpm, setSongBpm] = useState(120);
  const [earProfiles,setEarProfiles]=useState<{id:string;musician:string;bus:number;levels:number[]}[]>([]);
  const [musicianName,setMusicianName]=useState("");
  const [selectedEarProfile,setSelectedEarProfile]=useState("");
    const [savedSetlists, setSavedSetlists] = useState<{id:string;name:string;songIds:string[]}[]>([]);
  const [rehearsals, setRehearsals] = useState<{id:string;title:string;startsAt:string;notes:string}[]>([]);
  const [rehearsalTitle, setRehearsalTitle] = useState("");
  const [rehearsalDate, setRehearsalDate] = useState("");
  const [setlistName, setSetlistName] = useState("");
  const [earBus, setEarBus] = useState(1);
  const [earValues, setEarValues] = useState<Record<number, number[]>>({});
  const [eq, setEq] = useState([0,2,-1,1]);
  const [hp, setHp] = useState(true);
  const [onlineSince, setOnlineSince] = useState("");
  const [busy, setBusy] = useState(false);
  const [mixerFilter,setMixerFilter]=useState("");
  const [compactMixer,setCompactMixer]=useState(false);
  const drag = useRef<Record<number, number>>({});
  const channelRef = useRef(channels);
  useEffect(() => { channelRef.current = channels; }, [channels]);
  useEffect(() => { try{localStorage.setItem(KEY, JSON.stringify(store));}catch{} }, [store]);
  const updateChannel = useCallback((c: Channel) => setChannels(old => old.map(x => x.channel === c.channel ? c : x)), []);
  useEffect(() => {
    let active = true; let socket: WebSocket | undefined; let retry: ReturnType<typeof setTimeout> | undefined;
    async function fetchState() {
      try {
        const [a,b,m] = await Promise.all([fetch("/api/status"),fetch("/api/channels"),fetch("/api/main")]);
        if (!a.ok || !b.ok) throw new Error("API indisponible");
        const s = await a.json() as Status, cs = await b.json() as Channel[];
        if (active) { setStatus(s); setChannels(cs); if(m.ok)setMainState(await m.json() as Channel); }
      } catch { if (active) setNotice("Le serveur BandPilot est indisponible. Démarre le backend pour utiliser le mixeur."); }
    }
    function connect() {
      if (!active) return;
      socket = new WebSocket(`${location.protocol === "https:" ? "wss:" : "ws:"}//${location.host}/ws`);
      socket.onopen = () => { if(active) { setSocketOk(true); setOnlineSince(new Date().toLocaleTimeString(getLocale())); } };
      socket.onmessage = e => { try {
        const msg = JSON.parse(e.data) as {type:string;parameters?:Record<string,{value:string|number}>;channels?:Channel[];status?:Status;state?:Channel;main?:Channel;meters?:{channels:number[];updatedAt:string|null;available:boolean}};
        if (!active) return;
        if (msg.type === "snapshot" && msg.channels && msg.status) { setChannels(msg.channels);setMetadata(msg.parameters??{}); setAdvancedReadback({});setLastOscUpdate(null);setStatus(msg.status); if(msg.main)setMainState(msg.main);if(msg.meters)setMeterState(msg.meters); }
        if (msg.type === "channel" && msg.state) {updateChannel(msg.state);setLastOscUpdate(new Date().toISOString());}
        if(msg.type==="main"&&msg.state){setMainState(msg.state);setLastOscUpdate(new Date().toISOString());}
        if(msg.type==='parameter'&&msg.state){const p=msg.state as unknown as {address:string;value:string|number};setMetadata(old=>({...old,[p.address]:{value:p.value}}));}
        if(msg.type==="status"&&msg.status)setStatus(msg.status);
        if(msg.type==="meters"&&msg.state)setMeterState(msg.state as unknown as {channels:number[];updatedAt:string|null;available:boolean});
        if(msg.type==="advanced"&&msg.state){const a=msg.state as unknown as {address:string;value:number|string;updatedAt:string};setAdvancedReadback(prev=>({...prev,[a.address]:{value:a.value,updatedAt:a.updatedAt}}));}
      } catch { /* malformed message */ } };
      socket.onclose = () => { if(active) { setSocketOk(false); retry = setTimeout(connect,3000); } };
      socket.onerror = () => socket?.close();
    }
    void fetchState(); connect();
    return () => { active = false; clearTimeout(retry); socket?.close(); };
  },[updateChannel]);
  const mixerIdentityRef=useRef<string|null>(null);
  useEffect(()=>{const identity=JSON.stringify([status.mode,status.host,status.port,status.model]);if(mixerIdentityRef.current!==null&&mixerIdentityRef.current!==identity){setMutedBackup("");try{localStorage.removeItem("xr18-muted-backup");}catch{}}mixerIdentityRef.current=identity;},[status.mode,status.host,status.port,status.model]);
  const canWrite = status.mode === "simulation" ? socketOk : status.connected && status.writesEnabled && socketOk;
  async function writeFader(channel: number, value: number) {
    if (!canWrite || busy || !Number.isFinite(value)) return;
    setBusy(true);
    try {
      const r = await fetch(`/api/channels/${channel}/fader`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({value})});
      const result = await r.json() as {error?:string};
      if (!r.ok) throw new Error(result.error ?? "Commande refusée");
      if (status.mode === "simulation") updateChannel({...channelRef.current[channel-1]!,fader:value,updatedAt:new Date().toISOString()});
      else setNotice("Commande OSC envoyée, en attente de confirmation par la console.");
    } catch(e) { setNotice((e as Error).message); }
    finally { setBusy(false); }
  }
  async function writeMixValue(endpoint:string,value:number|boolean){
    if(!canWrite||busy)return;
    setBusy(true);
    try{
      const response=await fetch(endpoint,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({value})});
      const result=await response.json() as {error?:string};
      if(!response.ok)throw Error(result.error??"Commande refusée");
      if(!isSim)setNotice("Commande envoyée sans accusé matériel ; attendre la synchronisation OSC.");
    }catch(e){setNotice((e as Error).message);}
    finally{setBusy(false);}
  }
  function toggleChannelOn(ch:Channel){
    if(!canWrite||busy)return;
    if(!ch.on&&!window.confirm(`Réactiver le son du canal ${ch.channel} ? Vérifie le niveau des retours.`))return;
    void writeMixValue(`/api/channels/${ch.channel}/on`,!ch.on);
  }
  async function refreshAdvancedReadback(){
    try{
      const response=await fetch(`/api/osc/advanced/channels/${selected}/refresh`,{method:"POST"});
      if(!response.ok)throw Error("Lecture OSC indisponible");
      const fx=await fetch("/api/osc/advanced/fx/refresh",{method:"POST"});
      if(!fx.ok)throw Error("Lecture FX indisponible");
      setNotice("Demandes de lecture OSC envoyées. Les paramètres s'affichent seulement après réponse réelle de la console.");
    }catch(e){setNotice((e as Error).message);}
  }
  function toggleMainOn(){
    if(!canWrite||busy)return;
    if(!mainState.on&&!window.confirm("Réactiver le mix principal L/R ? Vérifie le volume des enceintes."))return;
    void writeMixValue("/api/main/on",!mainState.on);
  }
    function changeSlider(channel: number, value: number) { drag.current[channel] = value; setChannels(old => old.map(c => c.channel === channel ? {...c,fader:value} : c)); }
  function commitSlider(channel: number) { const v = drag.current[channel]; if(v !== undefined) { delete drag.current[channel]; void writeFader(channel,v); } }
  function resetFader(channel:number){if(!isSim||!canWrite||busy)return;changeSlider(channel,0.5);commitSlider(channel);}
  function saveScene() {
    if (status.mode !== "simulation") { setNotice("Sauvegarde locale depuis une console réelle désactivée tant que les lectures ne sont pas entièrement validées."); return; }
    const name = sceneName.trim() || `Snapshot ${new Date().toLocaleString(getLocale())}`;
    setStore(s => ({...s,scenes:[{id:id(),name,created:new Date().toISOString(),faders:channels.map(c=>c.fader)},...s.scenes]}));
    setSceneName(""); setNotice("Snapshot local enregistré (faders uniquement).");
  }
  async function recallScene(scene: Scene) {
    if (status.mode !== "simulation" || !canWrite) { setNotice("Rappel de snapshot autorisé uniquement en simulation connectée."); return; }
    if (!window.confirm(`Rappeler « ${scene.name} » sur les 16 faders simulés ?`)) return;
    for (let i=0;i<Math.min(16,scene.faders.length);i++) {
      const value=scene.faders[i];
      if (typeof value !== "number") continue;
      try {
        const r=await fetch(`/api/channels/${i+1}/fader`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({value})});
        if (!r.ok) throw new Error(`Échec canal ${i+1}`);
      } catch(e) { setNotice((e as Error).message); return; }
    }
    setNotice("Snapshot restauré dans le simulateur.");
  }
  async function saveProcessing() {
    const preset = processingDraft ?? PROCESSING_PRESETS.find(p=>p.id===processingChoice);
    if (!preset) return;
    if (!canWrite) { setNotice("Activer le contrôle pour appliquer les traitements."); return; }
    const processing = { hpfHz:preset.hpfHz,eq:preset.eq,compressor:preset.compressor,gate:preset.gate };
    try {
      const preview = await fetch(`/api/channels/${selected}/processing/preview`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({processing})});
      const detail = await preview.json() as {error?:string;token?:string;ratio?:number};
      if(!preview.ok) throw Error(detail.error??"Aperçu refusé");
      if(!window.confirm(`Appliquer « ${tx(preset.name)} » au canal ${selected} (${tx(isSim?"simulation":"Console réelle")}) ? Les seuils non renseignés sont conservés. Ratio matériel : ${detail.ratio??preset.compressor.ratio}.`)) return;
      const response = await fetch(`/api/channels/${selected}/processing`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({processing,token:detail.token,confirm:true,expectedRevision:processingRevision})});
      const data=await response.json() as {error?:string;state?:{revision:number}};
      if(!response.ok||!data.state) throw Error(data.error??"Échec");
      setProcessingRevision(data.state.revision);setProcessingApplied(true);
      setNotice(isSim?"Traitement enregistré dans le simulateur.":"Traitement appliqué et lecture OSC comparée.");
    } catch(e) {setNotice((e as Error).message); }
  }
  async function undoProcessing() {
    try {
      const response=await fetch(`/api/channels/${selected}/processing/undo`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({expectedRevision:processingRevision})});
      const data=await response.json() as {error?:string;state?:{revision:number}};
      if(!response.ok||!data.state) throw Error(data.error??"Échec");
      setProcessingRevision(data.state.revision);setNotice("Version précédente restaurée dans le simulateur.");
    } catch(e) {setNotice((e as Error).message); }
  }
  useEffect(()=>{let active=true;setProcessingDraft(null);setProcessingApplied(false);setProcessingRevision(0);fetch(`/api/channels/${selected}/processing`).then(r=>r.json()).then((data:{state?:{revision:number}})=>{if(active)setProcessingRevision(data.state?.revision??0);}).catch(()=>{});return()=>{active=false;};},[selected]);
  async function api<T>(path:string,method="GET",payload?:unknown):Promise<T>{
    const response=await fetch(path,{method,headers:{"Content-Type":"application/json"},body:payload===undefined?undefined:JSON.stringify(payload)});
    const data=await response.json() as T & {error?:string};
    if(!response.ok)throw Error(data.error??"Erreur API");
    return data;
  }
  const refreshLibrary=useCallback(async()=>{
    try{
      const [songs,lists,reps]=await Promise.all([
        api<Song[]>("/api/songs"),api<{id:string;name:string;songIds:string[]}[]>("/api/setlists"),
        api<{id:string;title:string;startsAt:string;notes:string}[]>("/api/rehearsals")]);
      setStore(s=>({...s,songs}));setSavedSetlists(lists);setRehearsals(reps);
    }catch{ /* Backend may be starting. Existing local content remains available. */ }
  },[]);
  useEffect(()=>{void refreshLibrary();},[refreshLibrary,socketOk]);
  async function addSong() {
    if(!songTitle.trim())return;
    try{
      const song=await api<Song>("/api/songs","POST",{title:songTitle.trim(),artist:songArtist.trim(),bpm:songBpm});
      setStore(s=>({...s,songs:[...s.songs,song]}));setSongTitle("");setSongArtist("");setSongBpm(120);
      setNotice("Morceau ajouté au répertoire.");
    }catch(e){setNotice((e as Error).message);}
  }
  async function deleteSong(songId:string){
    if(!window.confirm("Supprimer ce morceau du répertoire et des setlists enregistrées ?"))return;
    try{await api("/api/songs/"+songId,"DELETE");setStore(s=>({...s,songs:s.songs.filter(x=>x.id!==songId),setlist:s.setlist.filter(x=>x!==songId)}));await refreshLibrary();}
    catch(e){setNotice((e as Error).message);}
  }
  async function saveSetlist(){
    if(!setlistName.trim()||store.setlist.length===0){setNotice("Renseigne un nom et ajoute au moins un morceau.");return;}
    try{await api("/api/setlists","POST",{name:setlistName.trim(),songIds:store.setlist});setSetlistName("");await refreshLibrary();setNotice("Setlist enregistrée.");}
    catch(e){setNotice((e as Error).message);}
  }
  async function refreshEarProfiles(){
    try{const data=await api<{profiles:{id:string;musician:string;bus:number;levels:number[]}[]}>("/api/ears/profiles");setEarProfiles(data.profiles);}catch(e){setNotice((e as Error).message);}
  }
  async function saveEarProfile(){
    if(!musicianName.trim()){setNotice("Renseigne le nom du musicien.");return;}
    try{
      await api("/api/ears/profiles","POST",{id:selectedEarProfile||undefined,musician:musicianName.trim(),bus:earBus,levels:(earValues[earBus]??Array(16).fill(50)).map(x=>x/100)});
      await refreshEarProfiles();setNotice("Profil de retour enregistré (rien n’est envoyé à la console).");
    }catch(e){setNotice((e as Error).message);}
  }
  useEffect(()=>{if(page==="ears")void refreshEarProfiles();},[page]);
    async function saveRehearsal(){
    if(!rehearsalTitle.trim()||!rehearsalDate){setNotice("Renseigne le nom et la date de répétition.");return;}
    try{await api("/api/rehearsals","POST",{title:rehearsalTitle.trim(),startsAt:new Date(rehearsalDate).toISOString(),notes:store.notes});setRehearsalTitle("");await refreshLibrary();setNotice("Répétition enregistrée.");}
    catch(e){setNotice((e as Error).message);}
  }
  const setlist = useMemo(()=>store.setlist.map(key=>store.songs.find(s=>s.id===key)).filter((s):s is Song=>Boolean(s)),[store]);
  const isSim = status.mode === "simulation";
  const current = channels[selected-1] ?? channels[0]!;
  const visibleChannels=useMemo(()=>channels.filter(ch=>`${ch.channel} ${labelFor(ch.channel)}`.toLocaleLowerCase("fr").includes(mixerFilter.trim().toLocaleLowerCase("fr"))),[channels,mixerFilter,metadata,status.mode]);
  const space = spaceOf(page);
  const info = PAGE_INFO[page];
  const muteAll = () => { if (confirm(tx("Couper les entrées de la console ?"))) void api<{backupId?:string}>("/api/console/mute-all","POST",{confirm:true}).then(r=>{setMutedBackup(r.backupId??"");try{localStorage.setItem("xr18-muted-backup",r.backupId??"");}catch{}setNotice("Les entrées de la console sont coupées. « Tout rallumer » les remet comme avant.");}).catch(e=>setNotice((e as Error).message)); };
  // "Tout rallumer" puts each input back exactly as it was before "Tout couper" (inputs that were already off stay off).
  const unmuteAll = async () => {
    try { const plan = await api<{token:string}>("/api/console/restore","POST",{backupId:mutedBackup}); await api("/api/console/apply","POST",{token:plan.token,confirm:true,tolerant:true});
      setMutedBackup(""); try{localStorage.removeItem("xr18-muted-backup");}catch{} setNotice("Les entrées sont rallumées comme avant « Tout couper ».");
    } catch (e) { setNotice((e as Error).message); }
  };
  const consoleTools = <details className="console-tools"><summary aria-label={tx("Outils de console")} title={tx("Préréglages, routage et scène vierge")}>{tx("⚙ Outils")}</summary><div className="studio-tabs">{TABS.map(t=><button key={t.id} className={tab===t.id?"active":""} onClick={e=>{setTab(t.id);e.currentTarget.closest("details")?.removeAttribute("open");}}>{tx(t.name)}</button>)}<span className="tabs-spacer"/>{lastBackup&&<button className="blank-btn" disabled={!canWrite||blankBusy} onClick={()=>void undoBlank()} title={tx("Annuler la remise à zéro")}><Undo2 size={15}/>{tx(" Revenir à avant")}</button>}<button className="blank-btn" disabled={!canWrite||blankBusy} onClick={()=>void startBlank()} title={tx("Remettre toute la console à neutre (sans toucher au 48 V, aux gains ni au routage)")}><Eraser size={15}/> {tx(blankBusy&&!blankPlan?"Lecture de la console…":"Partir d’une scène vierge")}</button></div></details>;
  const model=status.profile??DEFAULT_MIXER;
  const unsupportedX32=model.family==="x32"&&!["console","settings","setlists","rehearsals","rehearse","concert"].includes(page);
  return <MixerModelContext.Provider value={model}><div className={`studio app2${railCompact ? " rail-compact" : ""}`}>
    <aside className="rail" aria-label={tx("Navigation principale")}>
      <div className="rail-logo"><span className="logo-mark"><AudioLines size={20}/></span><div><b>{tx("Band")}<em>{tx("Pilot")}</em></b><small>{tx("Ton ingé son de poche")}</small></div></div>
      <nav className="rail-nav">{SPACES.map(sp=><div key={sp.id} className={space===sp.id?"rail-space active":"rail-space"}>
        <button type="button" className="rail-space-btn" aria-label={tx(`${tx(sp.name)} ${tx(sp.hint)}`)} title={tx(sp.name)} onClick={()=>setPage(sp.pages[0]!)} aria-current={space===sp.id?"true":undefined}><sp.icon size={20}/><span><b>{tx(sp.name)}</b><small>{tx(sp.hint)}</small></span></button>
        {space===sp.id&&sp.pages.length>1&&<div className="rail-pages">{sp.pages.map(pg=>{const P=PAGE_INFO[pg];return <button key={pg} type="button" className={page===pg?"active":""} onClick={()=>setPage(pg)}><P.icon size={16}/>{tx(P.name)}</button>;})}</div>}
      </div>)}</nav>
      <div className="rail-foot"><SupportCenter/>
        <button type="button" className="rail-toggle" onClick={toggleRail} title={tx(railCompact ? "Agrandir le menu" : "Réduire le menu pour gagner de la place")} aria-label={tx(railCompact ? "Agrandir le menu" : "Réduire le menu")}>{railCompact ? <PanelLeftOpen size={18}/> : <><PanelLeftClose size={18}/><span>{tx("Réduire le menu")}</span></>}</button>
        <button type="button" className={`conn-card ${status.connected?(isSim?"sim":"ok"):"off"}`} onClick={()=>setPage("settings")} title={tx("Ouvrir la connexion")}>
          {status.connected?<Wifi size={18}/>:<WifiOff size={18}/>}
          <span><b>{tx(status.connected?(isSim?"Simulation":"Console connectée"):"Console déconnectée")}</b><small>{tx(isSim?"Aucune commande envoyée":canWrite?"Contrôle activé":"Lecture seule")}</small></span>
        </button>
      </div>
    </aside>
    <div className={page === "console" ? `app2-main fit${consoleMode === "expert" ? " expert-page" : ""}` : page === "rehearse" ? "app2-main rehearse-page" : "app2-main"}>
      <header className="topbar">
        <div className="topbar-title"><h1>{tx(info.name)}</h1><p>{tx(info.hint)}</p></div>
        <div className="topbar-actions">
          {page==="console"&&model.family!=="x32"&&<div className="seg" role="group" aria-label={tx("Niveau d’affichage")}>
            <button type="button" className={consoleMode==="simple"?"active":""} onClick={()=>setConsoleMode("simple")} title={tx("Volumes, mutes et retours, en gros")}>{tx("Simple")}</button>
            <button type="button" className={consoleMode==="expert"?"active":""} onClick={()=>setConsoleMode("expert")} title={tx("Toute la console, comme X-AIR Edit")}>{tx("Expert")}</button>
          </div>}
          <span className="model-badge">{tx(model.brand)} {tx(model.label)}</span><span className={`pill ${isSim?"sim":status.connected?"ok":"off"}`}><ShieldCheck size={14}/>{tx(isSim?"Simulation":status.connected?"Console réelle":"Déconnectée")}</span>
          {space==="play"&&(mutedBackup?<button type="button" className="btn primary" disabled={!canWrite} onClick={()=>void unmuteAll()} title={tx("Remettre les entrées comme avant « Tout couper »")}><Power size={16}/><span>{tx("Tout rallumer")}</span></button>:<button type="button" className="btn danger" disabled={!canWrite} onClick={muteAll} title={tx("Couper les entrées de la console")}><Power size={16}/><span>{tx("Tout couper")}</span></button>)}
          {page==="console"&&<button type="button" className="btn ghost" onClick={()=>setPage("setlists")} title={tx("Ouvrir les setlists")}><ListMusic size={16}/><span>{tx("Setlists")}</span></button>}
          <button type="button" className="btn ghost" onClick={()=>setPage("scenes")} title={tx("Sauvegarder ou rappeler une scène")}><Save size={16}/><span>{tx("Scènes")}</span></button>
          {tx(page==="console"&&consoleMode==="expert"&&consoleTools)}
        </div>
        {SPACES.find(sp=>sp.id===space)!.pages.length>1&&<nav className="subnav" aria-label={tx("Pages")}>{SPACES.find(sp=>sp.id===space)!.pages.map(pg=><button key={pg} type="button" className={page===pg?"active":""} onClick={()=>setPage(pg)}>{tx(PAGE_INFO[pg].name)}</button>)}</nav>}
      </header>
      <WorkshopNotice onOpen={()=>{sessionStorage.setItem("bandpilot-workshop-view","true");setPage("rehearse");}}/>
      {blankPlan && <PlanDialog plan={blankPlan} busy={blankBusy} canApply={canWrite} mode={isSim ? "simulation" : "real"} onClose={() => setBlankPlan(null)} onApply={() => void applyBlank()}/>}
      {notice && <div className="studio-alert" role="alert"><CircleAlert size={16}/><span>{tx(notice)}</span><button onClick={()=>setNotice("")}>{tx("Fermer")}</button></div>}
      {unsupportedX32 ? <section className="model-blocked"><h2>{tx(model.label)}{tx(" · adaptation en cours")}</h2><p>{tx("Le mélangeur 32 canaux, 16 bus, 8 DCA et 6 matrices est disponible. Les fonctions guidées, scènes complètes et retours sur téléphone nécessitent encore leur adaptateur X32.")}</p><button onClick={()=>setPage("console")}>{tx("Ouvrir le mélangeur ")}{tx(model.label)}</button></section> : page==="console"&&model.family==="x32" ? <div className="studio-work"><X32Console canWrite={canWrite}/></div> : page==="rehearse" ? <Rehearse onExpert={ch=>{setSelected(ch);localStorage.setItem("xr18-expert-view","channel");setPage("console");setTab("mixer");setConsoleMode("expert");}}/> : page==="concert" ? <Concert/> : page==="coach" ? <SoundCoach onWorkshop={()=>{sessionStorage.setItem("bandpilot-workshop-view","true");setPage("rehearse");}} status={status} online={socketOk} meters={meterState} onConnect={()=>setPage("settings")} onMonitors={()=>setPage("ears")} onExpert={(ch,view)=>{if(ch)setSelected(ch);try{localStorage.setItem("xr18-expert-view",view??"channel");}catch{}setPage("console");setTab("mixer");setConsoleMode("expert");}}/> : page==="console" ? consoleMode==="simple" ? <div className="content"><SimpleMixer simulation={isSim} canWrite={canWrite} onExpert={ch=>{if(ch)setSelected(ch);setExpertTab(ch?"eq":"mixer");setTab("mixer");setConsoleMode("expert");}}/></div> : <>

        <div className="studio-work">
          {model.usbChannels===0&&<p className="model-note">{tx(model.label)} : {tx(model.channels)}{tx(" entrées, ")}{tx(model.micPreamps)}{tx(" préamplis micro et ")}{tx(model.monitorOutputs)}{tx(" sorties Aux physiques. Enregistrement USB stéréo sur clé ; pas d’interface USB multipiste vers l’ordinateur.")}</p>}
          {tab==="mixer" ? <>
            <ExpertStudio simulation={isSim} canWrite={canWrite} selectedChannel={selected} onSelectChannel={setSelected}/>
          </> : <section className="studio-panel tab-panel"><div className="tab-heading"><div><span className="eyebrow-studio">{tx("CANAL ")}{tx(selected)} · {labelFor(selected)}</span><h1>{tx(TABS.find(t=>t.id===tab)?.name)}</h1></div><span className="safety-pill"><ShieldCheck size={14}/> {tx(isSim?"Démonstration":status.connected?"Console réelle":"Déconnectée")}</span></div>
            {(tab==="eq" || tab==="dynamics") ? <div className="processing-library"><ConsolePanel initial={`/ch/${String(selected).padStart(2,"0")}`} connected={socketOk}/><div className="processing-intro"><b>{tx("Préréglages EQ · Compresseur · Gate")}</b><p>{tx("Choisis un instrument, puis consulte ou ajuste les paramètres. Les seuils de compression et de gate doivent être réglés à l'oreille sur les niveaux réels.")}</p></div><div className="processing-filter"><label>{tx("Instrument ")}<select value={processingFilter} onChange={e=>setProcessingFilter(e.target.value)}>{["Tous",...new Set(PROCESSING_PRESETS.map(p=>p.instrument))].map(name=><option key={name} value={name}>{tx(name)}</option>)}</select></label><label>{tx("Préréglage ")}<select value={processingChoice} onChange={e=>{setProcessingChoice(e.target.value);setProcessingDraft(null);}}>{PROCESSING_PRESETS.filter(p=>processingFilter==="Tous"||p.instrument===processingFilter).map(p=><option value={p.id} key={p.id}>{tx(p.name)}</option>)}</select></label></div>{(()=>{const preset=processingDraft??PROCESSING_PRESETS.find(p=>p.id===processingChoice)??PROCESSING_PRESETS[0];return <div className="processing-detail"><div className="processing-header"><div><h2>{tx(preset.name)}</h2><p>{tx(preset.description)}</p></div><button onClick={()=>{setProcessingDraft(null);setNotice("Préréglage réinitialisé à sa valeur de départ.");}}>{tx("Réinitialiser")}</button></div><div className="processing-columns"><section><h3>{tx("Égaliseur 4 bandes")}</h3><label>{tx("Filtre coupe-bas (Hz)")}<input type="number" min="20" max="400" value={preset.hpfHz??20} onChange={e=>setProcessingDraft({...preset,hpfHz:Number(e.target.value)})}/></label>{preset.eq.map((band,i)=><div className="processing-band" key={i}><b>{tx("Bande ")}{tx(i+1)} · {tx(band.type)}</b><label>{tx("Fréquence (Hz)")}<input type="number" min="20" max="20000" value={band.frequencyHz} onChange={e=>setProcessingDraft({...preset,eq:preset.eq.map((x,j)=>j===i?{...x,frequencyHz:Number(e.target.value)}:x)})}/></label><label>{tx("Gain (dB)")}<input type="number" min="-15" max="15" step=".5" value={band.gainDb} onChange={e=>setProcessingDraft({...preset,eq:preset.eq.map((x,j)=>j===i?{...x,gainDb:Number(e.target.value)}:x)})}/></label><label>{tx("Q")}<input type="number" min=".1" max="10" step=".1" value={band.q} onChange={e=>setProcessingDraft({...preset,eq:preset.eq.map((x,j)=>j===i?{...x,q:Number(e.target.value)}:x)})}/></label></div>)}</section><section><h3>{tx("Compresseur")}</h3><label className="processing-toggle"><input type="checkbox" checked={preset.compressor.enabled} onChange={e=>setProcessingDraft({...preset,compressor:{...preset.compressor,enabled:e.target.checked}})}/>{tx(" Activé (préparation)")}</label>{([["ratio","Ratio"],["attackMs","Attack (ms)"],["releaseMs","Release (ms)"],["makeupDb","Makeup (dB)"]] as const).map(([key,label])=><label key={key}>{tx(label)}<input type="number" step=".5" value={preset.compressor[key]} onChange={e=>setProcessingDraft({...preset,compressor:{...preset.compressor,[key]:Number(e.target.value)}})}/></label>)}<p>{tx("Seuil : ")}<strong>{tx("à calibrer")}</strong></p><p>{tx("Réduction visée : ")}{tx(preset.compressor.targetReductionDb)}</p><h3>{tx("Gate / Expander")}</h3><label className="processing-toggle"><input type="checkbox" checked={preset.gate.enabled} onChange={e=>setProcessingDraft({...preset,gate:{...preset.gate,enabled:e.target.checked}})}/>{tx(" Activé (préparation)")}</label>{([["attackMs","Attack (ms)"],["holdMs","Hold (ms)"],["releaseMs","Release (ms)"],["rangeDb","Range (dB)"]] as const).map(([key,label])=><label key={key}>{tx(label)}<input type="number" step="1" value={preset.gate[key]} onChange={e=>setProcessingDraft({...preset,gate:{...preset.gate,[key]:Number(e.target.value)}})}/></label>)}<p>{tx("Mode : ")}{tx(preset.gate.mode)}{tx(" · seuil à calibrer")}</p></section></div><div className="processing-actions"><button disabled={!canWrite} onClick={()=>void saveProcessing()}><Save size={15}/>{tx(" Appliquer les traitements")}</button><button disabled={!isSim||!socketOk||!processingApplied} onClick={()=>void undoProcessing()}>{tx("Annuler la dernière application")}</button><span>{tx("Canal ")}{tx(selected)}{tx(" · Révision ")}{tx(processingRevision)} · {tx(isSim?"Simulation":"Lecture comparée")}</span></div><div className="processing-advice"><b>{tx("Conseil de réglage")}</b><p>{tx(preset.advice)}</p><button onClick={()=>{navigator.clipboard?.writeText(JSON.stringify(preset,null,2)).then(()=>setNotice("Réglages copiés au format JSON.")).catch(()=>setNotice("Copie indisponible dans ce navigateur."));}}>{tx("Copier le préréglage (JSON)")}</button></div></div>;})()}<div className="processing-sources"><b>{tx("Sources consultées")}</b>{PROCESSING_SOURCES.map(s=><a key={s.url} href={s.url} target="_blank" rel="noopener noreferrer">{s.name} ↗</a>)}</div><p className="disclaimer">{tx("Les préréglages sont des points de départ. En mode réel, application après prévisualisation, sauvegarde et lecture comparée. Les seuils non renseignés restent inchangés.")}</p></div> : tab==="fx" ? <div className="fx-library"><FxConsole/><ConsolePanel initial="/fxsend/1" connected={socketOk}/><StudioControl section="fx"/><div className="fx-filter"><input aria-label={tx("Rechercher un preset")} placeholder={tx("Rechercher un preset...")} value={fxSearch} onChange={e=>setFxSearch(e.target.value)}/><div className="fx-families">{(["Tous","Voix","Guitare","Basse","Batterie","Clavier","Global"] as const).map(f=><button key={f} className={fxFamily===f?"active":""} onClick={()=>setFxFamily(f)}>{tx(f)}</button>)}</div></div><div className="fx-grid">{FX_PRESETS.filter(p=>(fxFamily==="Tous"||p.family===fxFamily)&&(`${tx(p.name)} ${p.type} ${p.use}`).toLowerCase().includes(fxSearch.toLowerCase())).map(p=><article key={p.id} className={selectedFx===p.id?"fx-card selected":"fx-card"}><div className="fx-card-head"><span>{tx(p.family)}</span><small>{tx("FX ")}{tx(p.slotSuggestion)}{tx(" suggéré")}</small></div><h3>{tx(p.name)}</h3><p>{tx(p.use)}</p><div className="fx-type">{tx(p.type)}</div><div className="fx-params">{p.parameters.map(param=><div key={param.label}><span>{tx(param.label)}</span><b>{param.value}</b></div>)}</div><p className="fx-notes">{tx(p.notes)}</p><div className="fx-actions"><button onClick={()=>setSelectedFx(p.id)}>{tx(selectedFx===p.id?"Sélectionné":"Sélectionner")}</button><a href={p.sourceUrl} target="_blank" rel="noopener noreferrer">{tx("Source ↗")}</a></div></article>)}</div><p className="disclaimer">{tx("Suggestions musicales pour préparer les effets. Les valeurs sont des suggestions de départ et non des presets officiels Behringer. Les cartes de suggestions restent consultatives ; le panneau Processeurs FX permet de lire, éditer et rappeler les réglages matériels. La famille X-Air dispose de quatre slots FX partagés.")}</p></div> : <ConsolePanel initial={tab==="routing"?"/routing":tab==="dca"?"/dca/1":tab==="sends"?`/ch/${String(selected).padStart(2,"0")}`:"/ch/01"} connected={socketOk}/>}
          </section>}
        </div>
      </> : <div className="studio-work other-page content">
        
        {page==="ears" && <ReturnsPage canWrite={canWrite}/>}
        {page==="rehearsals" && <section className="studio-panel pad"><div className="panel-title"><div><b>{tx("Préparation de répétition")}</b><small role="status">{tx(draftStatus)}</small></div><BookOpen size={18}/></div><label className="field">{tx("Objectifs et notes")}<textarea rows={9} value={store.notes} onChange={e=>setStore(s=>({...s,notes:e.target.value}))} placeholder={tx("Ex. travailler le refrain de Plug In Baby, préparer le mix sans chanteur...")}/></label><div className="rehearsal-form"><input placeholder={tx("Nom de la répétition")} value={rehearsalTitle} onChange={e=>setRehearsalTitle(e.target.value)}/><input aria-label={tx("Date et heure")} type="datetime-local" value={rehearsalDate} onChange={e=>setRehearsalDate(e.target.value)}/><button onClick={()=>void saveRehearsal()}><Save size={15}/>{tx(" Enregistrer")}</button></div><div className="song-list">{rehearsals.map(r=><div key={r.id}><div><b>{r.title}</b><small>{tx(new Date(r.startsAt).toLocaleString(getLocale()))} · {r.notes.slice(0,100)}</small></div></div>)}</div><span className="disclaimer">{tx("Les répétitions sont enregistrées sur cet ordinateur. Le brouillon de notes et la setlist active sont conservés même si le port de l’application change.")}</span></section>}
        {page==="setlists" && <div className="two-panels"><section className="studio-panel pad"><div className="panel-title"><div><b>{tx("Répertoire")}</b><small>{tx(store.songs.length)}{tx(" morceaux")}</small></div><Music2 size={18}/></div><div className="song-form"><input placeholder={tx("Titre du morceau")} value={songTitle} onChange={e=>setSongTitle(e.target.value)}/><input placeholder={tx("Artiste")} value={songArtist} onChange={e=>setSongArtist(e.target.value)}/><input type="number" min="20" max="300" value={songBpm} onChange={e=>setSongBpm(Number(e.target.value))}/><button disabled={!songTitle.trim()} title={tx(!songTitle.trim()?"Renseigne le titre du morceau":undefined)} onClick={addSong}><Plus size={16}/>{tx(" Ajouter")}</button></div><div className="song-list">{store.songs.map(song=><div key={song.id}><div><b>{song.title}</b><small>{song.artist} · {tx(song.bpm)}{tx(" BPM")}</small></div><button onClick={()=>setStore(s=>({...s,setlist:[...s.setlist,song.id]}))}>{tx("+ Setlist")}</button><button title={tx("Supprimer")} onClick={()=>void deleteSong(song.id)}><Trash2 size={15}/></button></div>)}</div></section><section className="studio-panel pad"><div className="panel-title"><div><b>{tx("Setlist active")}</b><small>{tx(setlist.length)}{tx(" morceaux")}</small></div><ListMusic size={18}/></div><div className="song-list">{setlist.map((song,i)=><div key={i}><span className="song-order">{tx(i+1)}</span><div><b>{song.title}</b><small>{song.artist}</small></div><button onClick={()=>setStore(s=>({...s,setlist:s.setlist.filter((_,j)=>j!==i)}))}><Trash2 size={15}/></button></div>)}{setlist.length===0&&<p>{tx("Ajoute des morceaux depuis le répertoire.")}</p>}</div><div className="rehearsal-form"><input placeholder={tx("Nom de la setlist")} value={setlistName} onChange={e=>setSetlistName(e.target.value)}/><button onClick={()=>void saveSetlist()}><Save size={15}/>{tx(" Sauvegarder")}</button></div><div className="song-list">{savedSetlists.map(s=><div key={s.id}><div><b>{s.name}</b><small>{tx(s.songIds.length)}{tx(" morceaux")}</small></div><button onClick={()=>setStore(old=>({...old,setlist:s.songIds}))}>{tx("Charger")}</button><button title={tx("Supprimer")} onClick={async()=>{if(!window.confirm("Supprimer la setlist enregistrée ?"))return;try{await api("/api/setlists/"+s.id,"DELETE");await refreshLibrary();}catch(e){setNotice((e as Error).message);}}}><Trash2 size={15}/></button></div>)}</div></section></div>}
        {page==="scenes" && <ScenesPage mode={isSim ? "simulation" : "real"} canWrite={canWrite}/>}
        {page==="settings" && <LanguageSettings/>}
        {page==="settings" && <ConnectionPanel key={`connection:${model.id}`} status={status}/>}
        {page==="settings" && <StudioControl key={`studio-settings:${model.id}`} section="settings"/>}
        {page==="settings" && <section className="studio-panel pad"><div className="panel-title"><div><b>{tx("État du système")}</b><small>{tx("Paramètres de sécurité")}</small></div><Cable size={18}/></div><div className="settings-rows"><div><span>{tx("Mode d'exécution")}</span><b>{tx(isSim?"Simulation":"Console réelle")}</b></div><div><span>{tx("WebSocket")}</span><b>{tx(socketOk?"Connecté":"Déconnecté")}</b></div><div><span>{tx("Réponse OSC")}</span><b>{tx(status.connected?"Reçue / simulation":"Non confirmée")}</b></div><div><span>{tx("Écritures matérielles")}</span><b>{tx(!isSim&&status.writesEnabled?"Activées sur backend":"Désactivées")}</b></div><div><span>{tx("Accès multiappareils")}</span><b>{tx("HTTPS configurable")}</b></div></div><p className="disclaimer">{tx("Utilise le panneau de connexion pour détecter la console, activer le contrôle ou revenir en simulation.")}</p></section>}
      </div>}

    </div>
    <nav className="bottombar" aria-label={tx("Espaces")}>{SPACES.map(sp=><button key={sp.id} type="button" className={space===sp.id?"active":""} onClick={()=>setPage(sp.pages[0]!)}><sp.icon size={22}/><span>{tx(sp.name)}</span></button>)}</nav>
  </div></MixerModelContext.Provider>;
}



