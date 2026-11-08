import {identifyMixer,type MixerModelId} from '../shared/mixer-models.js';
import {diagnostic} from './diagnostics.js';
import {readFile,mkdir,writeFile,rename} from 'node:fs/promises';
import {dirname} from 'node:path';
import {isIPv4} from 'node:net';
import {XR18,type Mode} from './xr18.js';
import {discoverXR18} from './discovery.js';
export interface ConnectionConfig {mode:Mode;host:string;port:number;enableWrites:boolean;model?:MixerModelId}
/** Plain-language explanation of why the console cannot be reached, from the socket error codes. */
export function unreachableMessage(host:string,port:number,errors:string[]){
 const text=errors.join(' ');
 if(process.env.BANDPILOT_IOS==='1'&&/EHOSTUNREACH|ENETUNREACH|EACCES|EPERM/.test(text))return `L’iPad ne peut pas joindre ${host}:${port}. Vérifie le Wi-Fi, l’adresse de la console et l’autorisation Réseau local de BandPilot dans Réglages.`;
 if(/EHOSTUNREACH|ENETUNREACH|EACCES|EPERM/.test(text))return `L’ordinateur n’arrive pas à joindre ${host} (réseau injoignable). Causes les plus fréquentes : `+
  `1) sur Mac, BandPilot n’a pas l’autorisation « Réseau local » : Réglages Système › Confidentialité et sécurité › Réseau local, active BandPilot puis relance l’application ; `+
  `2) la console a changé d’adresse ou est éteinte : clique « Détecter et connecter ma console » ; `+
  `3) l’ordinateur n’est pas sur le même réseau que la table (Wi-Fi invité, VPN actif). Détail technique : ${errors.join('; ')}`;
 return `La console ne répond pas aux demandes /info et /xinfo à ${host}:${port} après plusieurs essais.${errors.length?' Erreur réseau : '+errors.join('; '):' Vérifie que la table est allumée, sur le même réseau, et l’autorisation Réseau local / pare-feu de BandPilot.'}`;
}
export function connectionConfig(value:unknown):ConnectionConfig {
 if(!value||typeof value!=='object')throw Error('Configuration de connexion invalide');
 const d=value as Record<string,unknown>;
 if(d.mode!=='real'&&d.mode!=='simulation')throw Error('Mode invalide');
 const host=d.host??'192.168.1.1',port=d.port??identifyMixer(String(d.model??'XR18'))?.port??10024;
 if(typeof host!=='string'||!isIPv4(host)||host==='0.0.0.0'||Number(host.split('.')[0])>=224)throw Error('Adresse IPv4 invalide');
 if(typeof port!=='number'||!Number.isInteger(port)||port<1||port>65535)throw Error('Port invalide');
 if(d.enableWrites!==undefined&&typeof d.enableWrites!=='boolean')throw Error('Option de contrôle invalide');
 if(d.model!==undefined&&(typeof d.model!=='string'||!identifyMixer(d.model)))throw Error('Modèle inconnu');
 return {...(d.model?{model:identifyMixer(String(d.model))!.id}:{}),mode:d.mode,host,port,enableWrites:d.mode==='real'&&d.enableWrites===true};
}
export async function loadConnection(path:string,fallback:ConnectionConfig){
 try{return connectionConfig(JSON.parse(await readFile(path,'utf8')));}catch{return fallback;}
}
export async function saveConnection(path:string,config:ConnectionConfig){
 await mkdir(dirname(path),{recursive:true});
 await writeFile(path+'.tmp',JSON.stringify(config,null,2),{mode:0o600});await rename(path+'.tmp',path);
}
export class ConnectionManager {
 private busy=false;
 private epoch=0;
 constructor(private xr:XR18,private path:string,private config:ConnectionConfig){}
 async suspend(){this.epoch++;this.config={...this.config,enableWrites:false};this.xr.suspendControl();if(!this.busy)await saveConnection(this.path,this.config);}
 async change(input:unknown){
  if(this.busy)throw Error('Connexion déjà en cours');
  const next=connectionConfig(input);this.busy=true;const epoch=this.epoch;
  const previous=this.config;let switched=false;
  diagnostic('connection.start',{mode:next.mode,host:next.host,port:next.port,enableWrites:next.enableWrites});
  try{
   // Verify identity before touching the running transport. No mixer writes.
   if(next.mode==='real'){
    const diagnostics={received:0,unrecognized:0,sendErrors:[] as string[]};
    const devices=await discoverXR18(2500,[next.host],(input as {port?:number}).port,diagnostics);
    if(!devices.some(d=>d.host===next.host))throw Error(diagnostics.received?`Réponse UDP reçue de ${next.host}:${next.port}, mais identité de console non reconnue (${diagnostics.unrecognized} réponse(s)).`:unreachableMessage(next.host,next.port,diagnostics.sendErrors));
    if(devices.length>1)throw Error('Plusieurs consoles sur cette adresse : choisis le port détecté.');
    const device=devices[0]!;next.model=device.model;next.port=device.port;
   }
   if(epoch!==this.epoch)throw Error('Connexion interrompue : vérifie le réseau puis reconnecte la console.');
   switched=true;await this.xr.reconnect(next);
   if(next.mode==='real'){
    const end=Date.now()+2500;
    while(!this.xr.status().connected&&Date.now()<end)await new Promise(r=>setTimeout(r,40));
    if(!this.xr.status().connected)throw Error('Console détectée, mais aucune réponse de mixage reçue.');
   }
   if(epoch!==this.epoch)throw Error('Connexion interrompue : vérifie le réseau puis reconnecte la console.');
   await saveConnection(this.path,next);
   if(epoch!==this.epoch){await saveConnection(this.path,this.config);throw Error('Connexion interrompue : vérifie le réseau puis reconnecte la console.');}
   this.config=next;
   diagnostic('connection.success',{mode:next.mode,host:next.host,port:next.port});
   return this.xr.status();
  }catch(e){
   diagnostic('connection.failed',{message:e instanceof Error?e.message:String(e),transportChanged:switched});
   // Failed identity probes leave the existing session untouched.
   if(switched&&epoch===this.epoch){await this.xr.reconnect(previous);}
   else if(epoch!==this.epoch){this.xr.suspendControl();await saveConnection(this.path,this.config);}
   throw e;
  }finally{this.busy=false;}
 }
}
