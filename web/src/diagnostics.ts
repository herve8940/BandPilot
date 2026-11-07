import {sanitizeDiagnostic} from '../../shared/diagnostic-report';
let sent=0,started=0,last='',lastAt=0;
export function reportUIError(action:string,error:unknown){
 const e=error instanceof Error?error:new Error(String(error));
 const now=Date.now(),signature=action+e.message;
 if(now-started>60000){sent=0;started=now;}
 if(sent>=20||(signature===last&&now-lastAt<10000))return;
 sent++;last=signature;lastAt=now;
 void fetch('/api/diagnostics/event',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(sanitizeDiagnostic({action,message:e.message,stack:e.stack}))}).catch(()=>{});
 window.dispatchEvent(new window.CustomEvent('bandpilot-error',{detail:{message:e.message}}));
}
export function installErrorReporting(){
 window.addEventListener('error',event=>reportUIError('window.error',event.error??event.message));
 window.addEventListener('unhandledrejection',event=>reportUIError('unhandledrejection',event.reason));
}
