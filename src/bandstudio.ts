import {homedir} from 'node:os';
import {join} from 'node:path';
import {readFile,writeFile,rename,unlink,lstat} from 'node:fs/promises';
import {randomUUID} from 'node:crypto';
export type StudioCapture={deviceUID:string;channels:{input:number;name:string}[];mode:'live'|'overdub'|'punch';latencyMS:number;punchStart:number;punchEnd:number;preRoll:number};
export type StudioState={version:number;session:string;updated:number;projectID:string;name:string;loaded:boolean;duration:number;position:number;recording:boolean;playing:boolean;pending:boolean;busy:boolean;notice:string;capture:{settings:StudioCapture;devices:{uid:string;name:string;channels:number;rate:number}[];meters:number[];elapsed:number}};
const root=()=>process.platform==='win32'?join(process.env.APPDATA??join(homedir(),'AppData','Roaming'),'BandStudio','Bridge'):join(homedir(),'Library','Application Support','BandStudio','Bridge');
const actions=new Set(['new','configure','record','stop','play','pause','start','end','seek','previous','next','back','forward','loop','marker']);
/** Dedicated protocol; never reuses the REAPER bridge or changes the console routing. */
export class BandStudio {
 constructor(private folder=root(),private timeout=7000){}
 async state():Promise<StudioState>{
  const file=join(this.folder,'state.json'),info=await lstat(file).catch(()=>null);
  if(!info?.isFile()||info.isSymbolicLink()||info.size>1_000_000)throw Error('Ouvre BandStudio 0.5 et active « Relier BandPilot » dans Prises.');
  const s=JSON.parse(await readFile(file,'utf8')) as StudioState;
  if(s.version!==1||!s.session||!s.projectID||!Number.isFinite(s.updated)||Math.abs(Date.now()/1000-s.updated)>3)throw Error('BandStudio ne répond plus. Vérifie sa fenêtre avant de relancer une commande.');
  return s;
 }
 async command(args:Record<string,unknown>,expectedProject:string):Promise<StudioState>{
  if(!actions.has(String(args.action)))throw Error('Commande BandStudio inconnue.');
  const s=await this.state();if(s.projectID!==expectedProject)throw Error('Le projet BandStudio a changé. Actualise avant de continuer.');
  const id=randomUUID(),request=join(this.folder,`request-${id}.json`),temporary=request+'.tmp',response=join(this.folder,`response-${id}.json`);
  const payload=JSON.stringify({id,session:s.session,projectID:s.projectID,created:Date.now()/1000,args});
  if(Buffer.byteLength(payload)>100000)throw Error('Commande trop volumineuse.');
  await writeFile(temporary,payload,{mode:0o600,flag:'wx'});await rename(temporary,request);
  const until=Date.now()+this.timeout;
  try{
   while(Date.now()<until){
    const info=await lstat(response).catch(()=>null);
    if(info?.isFile()&&!info.isSymbolicLink()&&info.size<1_000_000){
     const result=JSON.parse(await readFile(response,'utf8')) as {ok:boolean;error?:string;state:StudioState};
     if(!result.ok)throw Error(result.error??'Commande refusée par BandStudio.');return result.state;
    }
    await new Promise(resolve=>setTimeout(resolve,50));
   }
   throw Error('Réponse BandStudio perdue : vérifie son état. La commande n’est pas répétée automatiquement.');
  }finally{await Promise.all([request,response,temporary].map(path=>unlink(path).catch(()=>{})));}
 }
}
