import {renderToStaticMarkup} from 'react-dom/server';
import type {Profile} from './CoachSetup';
import {TechRiderDocument} from './TechRiderDocument';
import {getLanguage,tx} from './i18n';
import documentCSS from './tech-rider-document.css?inline';

declare global{interface Window{bandpilotDocuments?:{saveTechRiderPDF(input:{html:string;filename:string}):Promise<{saved?:boolean;cancelled?:boolean;error?:string}>}}}
export function techRiderHTML(profile:Profile){
 const title=renderToStaticMarkup(<title>{profile.tech?.bandName||tx('Fiche technique')}</title>);
 return `<!doctype html><html lang="${getLanguage()}"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; img-src data:; font-src data:">${title}<style>${documentCSS}</style></head><body>${renderToStaticMarkup(<TechRiderDocument profile={profile}/>)}</body></html>`;
}
export async function printTechRider(profile:Profile){
 // A separate document avoids printing application controls and blank layout pages.
 const frame=document.createElement('iframe');
 frame.title=tx('Impression de la fiche technique');frame.style.cssText='position:fixed;left:-10000px;top:0;width:794px;height:1123px;border:0';
 await new Promise<void>((resolve,reject)=>{
  const cleanup=()=>frame.remove();
  frame.onload=()=>{try{
   if(!frame.contentWindow)throw Error('Impression indisponible');
   frame.contentWindow.addEventListener('afterprint',cleanup,{once:true});
   frame.contentWindow.focus();frame.contentWindow.print();resolve();
   window.setTimeout(cleanup,60_000);
  }catch(error){cleanup();reject(error);}};
  frame.srcdoc=techRiderHTML(profile);document.body.append(frame);
 });
}
export async function exportTechRider(profile:Profile):Promise<'saved'|'cancelled'|'print'>{
 if(!window.bandpilotDocuments){await printTechRider(profile);return 'print';}
 const name=(profile.tech?.bandName||'BandPilot').replace(/[<>:"/\\|?*\x00-\x1f]/g,'-').slice(0,100);
 const result=await window.bandpilotDocuments.saveTechRiderPDF({html:techRiderHTML(profile),filename:`${name}-fiche-technique.pdf`});
 if(result.error)throw Error(result.error);
 return result.saved?'saved':'cancelled';
}
