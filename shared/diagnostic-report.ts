/** Diagnostics are deliberately independent of profiles, credentials and audio. */
export function redactDiagnosticText(value:string){
 return value
  .replace(/(?:github_pat_|gh[pousr]_)[A-Za-z0-9_]+|sk-[A-Za-z0-9_-]+/g,'[secret]')
  .replace(/((?:authorization|cookie|password|token|api[_ -]?key|secret)\s*[=:]\s*)[^\s,;]+/gi,'$1[secret]')
  .replace(/Bearer\s+[^\s,;]+/gi,'Bearer [secret]')
  .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi,'[email]')
  .replace(/https?:\/\/[^\s"<>]+/g,'[url]')
  .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g,'[ip]')
  .replace(/(?:[A-Za-z]:[\\/]|\/(?:Users|home|private|var|tmp|data|storage|sdcard)\/)[^\s"<>)]*/g,'[path]')
  .slice(0,1500);
}
export function sanitizeDiagnostic(value:unknown,depth=0):unknown{
 if(depth>5)return '[omitted]';
 if(typeof value==='string')return redactDiagnosticText(value);
 if(value===null||typeof value==='boolean'||typeof value==='number')return value;
 if(Array.isArray(value))return value.slice(-100).map(v=>sanitizeDiagnostic(v,depth+1));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).slice(0,40).filter(([key])=>!/(?:password|token|secret|authorization|cookie|credential|api.?key|contact|email|phone|username|bandname)/i.test(key)).map(([key,v])=>[key,sanitizeDiagnostic(v,depth+1)]));
 return undefined;
}
export function diagnosticEvents(log:string){
 const events:unknown[]=[];
 for(const line of log.split('\n'))try{
  const e=JSON.parse(line);
  if(/^(?:startup$|android\.|connection\.|osc\.warning$|coach\.|ambience\.|http\.error$|ui\.|desktop\.)/.test(e.event))events.push(sanitizeDiagnostic(e));
 }catch{/* A partial final line does not invalidate the report. */}
 return events.slice(-100);
}
