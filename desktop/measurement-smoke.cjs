/** Measurement UI fixtures, exclusively in the disposable simulation profile. */
module.exports=async(win,wait,screenshot)=>{
 const js=code=>win.webContents.executeJavaScript(code);
 if(await js(`fetch('/api/status').then(r=>r.json()).then(s=>s.mode!=='simulation')`))throw Error('Measurement smoke requires simulation');
 // Synthetic meter packets exercise display states; no fake measurements enter normal sessions.
 await js(`(()=>{const real=window.fetch;window.__measurementFixture={token:null,post:false,source:0,stopped:0};window.fetch=async(path,options)=>{
  const p=String(path),s=window.__measurementFixture,d=options?.body?JSON.parse(options.body):{};
  if(p==='/api/eq-rta/start'){s.token='smoke-rta';s.post=d.post;s.source=d.target.n;return new Response(JSON.stringify({token:s.token,connectionId:44}));}
  if(p==='/api/eq-rta/read')return new Response(JSON.stringify({connectionId:44,frame:{bands:Array.from({length:100},(_,i)=>-62+19*Math.exp(-Math.pow((i-47)/14,2))+8*Math.sin(i/6)),at:Date.now()}}));
  if(p==='/api/eq-rta/stop'){s.token=null;s.stopped++;return new Response(JSON.stringify({ok:true}));}
  if(p==='/api/dynamics')return new Response(JSON.stringify({connectionId:44,frame:{at:Date.now(),gate:Array(16).fill(-9),comp:Array(16).fill(-5-2*Math.sin(Date.now()/450)),bus:Array(6).fill(-2),lr:-1}}));
  return real(path,options);
 };})()`);
 const button=label=>js(`[...document.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(label)}).click()`);
 const processor=label=>js(`[...document.querySelectorAll('.visual-process-tabs button')].find(b=>b.textContent.trim().endsWith(${JSON.stringify(label)})).click()`);
 const capture=async(selector,name)=>{await js(`document.querySelector(${JSON.stringify(selector)}).scrollIntoView({block:'center',behavior:'instant'})`);await new Promise(r=>setTimeout(r,300));await screenshot(name);};
 await js(`document.querySelector('button[title="Régler le son"]').click()`);await wait(`!!document.querySelector('.rail-pages')`);await button('Console');await wait(`!!document.querySelector('.console-mode')||!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Expert')`);await button('Expert');await wait(`!!document.querySelector('.xs2-nav')||!![...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='Canal')`);await button('Canal');
 await wait(`!!document.querySelector('.visual-process-tabs')`);await processor('Égaliseur');await wait(`!!document.querySelector('.eq-spectrum-tools')`);await button('Afficher le RTA');await wait(`!!document.querySelector('.spectrum-line')`);
 await button('Garder comme référence');await button('Figer le spectre');await wait(`!!document.querySelector('.spectrum-held')&&!!document.querySelector('.spectrum-reference-line')`);await capture('.xm-eq-graph','eq-spectrum-frozen.png');
 const size=win.getSize(),minimum=win.getMinimumSize();win.setMinimumSize(360,600);win.setSize(480,850);await new Promise(r=>setTimeout(r,250));
 if(await js(`(()=>{const e=document.querySelector('.eq-spectrum-tools');return e.scrollWidth>e.clientWidth+2;})()`))throw Error('RTA controls overflow');await capture('.eq-spectrum-tools','eq-spectrum-small.png');win.setMinimumSize(...minimum);win.setSize(...size);
 await button('Arrêter le RTA');await wait(`window.__measurementFixture.stopped===1`);await processor('Compresseur');await wait(`!!document.querySelector('.measurement-history-toggle')`);await button('Historique de réduction du gain');await wait(`document.querySelector('.reduction-history svg path')?.getAttribute('d')?.includes('L')`);await button('Figer l’historique');await capture('.measurement-card','dynamics-history.png');
 await button('Effacer l’historique');await wait(`![...document.querySelectorAll('button')].some(b=>b.textContent.trim()==='Reprendre le direct')`);
 console.log('Measurement UI: RTA source selection, freeze/reference, source release, responsive view and dynamics history passed (synthetic simulation fixtures).');
 // Reload removes the fetch fixtures before the rest of the native smoke.
 await win.loadURL(win.webContents.getURL());await wait(`!!document.querySelector('.studio')`);
};
