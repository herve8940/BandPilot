import {appendFileSync,chmodSync,existsSync,mkdirSync,readFileSync,renameSync,statSync,unlinkSync} from 'node:fs';
import {dirname} from 'node:path';
import {sanitizeDiagnostic} from '../shared/diagnostic-report.js';
export class DiagnosticLog {
 private failure:string|undefined;
 private last='';private lastAt=0;private repeats=0;
 constructor(readonly path:string,private maxBytes=1024*1024){}
 write(event:string,details:Record<string,unknown>={}){
  try{
   mkdirSync(dirname(this.path),{recursive:true,mode:0o700});
   const selected=sanitizeDiagnostic(details) as Record<string,unknown>;
   const signature=JSON.stringify({event,...selected}),now=Date.now();
   if(signature===this.last&&now-this.lastAt<10000){this.repeats++;return;}
   const line=JSON.stringify({time:new Date(now).toISOString(),event,...selected,...(this.repeats?{repeatedSincePrevious:this.repeats}:{})})+'\n';
   this.last=signature;this.lastAt=now;this.repeats=0;
   if(Buffer.byteLength(line)>16384)return;
   if(existsSync(this.path)&&statSync(this.path).size+Buffer.byteLength(line)>this.maxBytes){
    if(existsSync(this.path+'.1'))unlinkSync(this.path+'.1');renameSync(this.path,this.path+'.1');
   }
   appendFileSync(this.path,line,{mode:0o600});chmodSync(this.path,0o600);this.failure=undefined;
  }catch{this.failure='Le journal de diagnostic ne peut pas être écrit.';}
 }
 read(){
  if(this.failure)throw Error(this.failure);
  const chunks:string[]=[];
  for(const path of [this.path+'.1',this.path])if(existsSync(path))chunks.push(readFileSync(path,'utf8'));
  return chunks.join('');
 }
}
let logger:DiagnosticLog|undefined;
export function setDiagnosticLogger(value:DiagnosticLog){logger=value;}
/** Call only with explicitly selected diagnostic fields; never HTTP bodies, cookies or credentials. */
export function diagnostic(event:string,details:Record<string,unknown>={}){logger?.write(event,details);}
