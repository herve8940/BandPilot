/** New local mixing controls, using only the smoke process's isolated simulator. */
module.exports=async({js,api,set,read,wait,waitValue,button,input,screenshot})=>{
 const sources=Object.fromEntries(Array.from({length:16},(_,i)=>[`/ch/${String(i+1).padStart(2,'0')}/config/insrc`,i]));
 await set({...sources,'/ch/01/preamp/rtnsw':0,'/ch/02/preamp/rtnsw':0,'/headamp/01/gain':24,'/ch/01/mix/fader':-15,'/ch/02/mix/fader':-18,'/bus/2/mix/fader':-10,'/dca/1/on':1,'/ch/04/mix/on':1,'/ch/01/eq/3/f':1000});
 await button('.expert-bankbar','Entrées 1–16');
 await js(`document.querySelector('.expert-console .xs2-strip .fz').scrollIntoView({block:'center'})`);await new Promise(resolve=>setTimeout(resolve,300));await screenshot('mixing-volume-faders.png');
 const before=await read('/ch/01/mix/fader');
 await button('.xs2-bar','Gains / trims');await wait(`document.querySelector('.gain-fader [role=slider]')?.getAttribute('aria-valuetext')==='24.0 dB'`);
 if(Math.abs(await read('/headamp/01/gain')-.5)>.001)throw Error('Arming gain faders wrote audio');
 await js(`document.querySelector('.gain-fader-zone').scrollIntoView({block:'center'})`);await new Promise(resolve=>setTimeout(resolve,300));
 if(await js(`(()=>{const zone=document.querySelector('.gain-fader-zone').getBoundingClientRect(),gain=document.querySelector('.gain-fader').getBoundingClientRect(),out=document.querySelector('.gain-fader output').getBoundingClientRect(),buttons=document.querySelector('.gain-fader-steps').getBoundingClientRect();return gain.bottom>zone.bottom+1||out.bottom>buttons.top+1||buttons.bottom>zone.bottom+1;})()`))throw Error('Gain fader controls overflow their strip');
 await screenshot('mixing-gain-faders.png');await js(`document.querySelector('.gain-fader [role=slider]').dispatchEvent(new KeyboardEvent('keydown',{key:'ArrowUp',bubbles:true}))`);await waitValue('/headamp/01/gain',36.5/72);
 if(await read('/ch/01/mix/fader')!==before)throw Error('Gain fader changed channel volume');
 await set({'/ch/01/config/insrc':2});await wait(`!document.querySelector('.gain-fader')`);await set({'/ch/01/config/insrc':0,'/headamp/01/gain':24});
 const command=await api('/api/library/commands',{name:'Surface simulation mute',data:{version:1,model:'XR18',steps:[{channel:4,target:'mute',value:1}]}});
 const library=await api('/api/expert-surfaces?model=XR18'),base={label:'',channel:1,bus:1,y:0,width:3,height:4};
 await api('/api/expert-surfaces',{...library,surfaces:[{id:'expanded',name:'Sorties, EQ et commande',widgets:[
  {...base,id:'bus',kind:'fader',strip:'bus2',x:0},
  {...base,id:'dca',kind:'mute',strip:'dca1',x:3},
  {...base,id:'eq',kind:'parameter',setting:'eqFrequency',band:3,x:6},
  {...base,id:'command',kind:'command',commandId:command.id,x:9}
 ]}]});
 await button('.xs2-tabs','Surfaces');await wait(`document.querySelectorAll('.surface-widget').length===4`);
 await button('.surface-widget','Mute · DCA 1');await waitValue('/dca/1/on',0);
 await input('.surface-widget:nth-child(3) input[type=range]',2500);await waitValue('/ch/01/eq/3/f',Math.log(2500/20)/Math.log(1000));
 if(await read('/ch/04/mix/on')!==1)throw Error('Loading a favorite command wrote audio');
 await button('.surface-command','Prévisualiser les changements');await wait(`!!document.querySelector('.coach-dialog')`);
 if(await read('/ch/04/mix/on')!==1)throw Error('Command preview wrote audio');
 await button('.coach-dialog','Essayer en simulation');await waitValue('/ch/04/mix/on',0);await wait(`!document.querySelector('.coach-dialog')`);await js(`document.querySelector('.surface-grid').scrollIntoView({block:'center'})`);await new Promise(resolve=>setTimeout(resolve,300));await screenshot('mixing-output-command-surface.png');
 await button('.surface-command','Annuler la dernière commande');await button('.coach-dialog','Essayer en simulation');await waitValue('/ch/04/mix/on',1);
 // Shared analogue source: both consumers must be named before confirming.
 await set({'/ch/02/config/insrc':0,'/ch/01/automix/group':0,'/ch/02/automix/group':0,'/ch/01/insert/on':0,'/ch/02/insert/on':0});
 await button('.xs2-tabs','Mélangeur');await js(`document.querySelector('.xs2-strip .name').click()`);
 await wait(`!!document.querySelector('.mix-preparation input[type=checkbox]')`);
 await js(`document.querySelector('.mix-preparation').open=true;document.querySelector('.mix-preparation input[type=checkbox]').click()`);
 await button('.mix-preparation','Prévisualiser la sélection');await wait(`document.querySelector('.coach-dialog')?.textContent.includes('Canal 1, Canal 2')`);
 await screenshot('mixing-shared-gain-preview.png');await button('.coach-dialog','Annuler, ne rien changer');
 if(Math.abs(await read('/headamp/01/gain')-.5)>.001)throw Error('Shared gain preview wrote audio');
 await set({'/ch/02/config/insrc':1,'/dca/1/on':1});
 console.log('Mix controls: explicit gain faders, routing disarm, output surface, EQ frequency, favorite command preview/apply/undo and shared gain preview passed.');
};
