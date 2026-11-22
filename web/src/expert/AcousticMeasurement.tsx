import {useEffect,useRef,useState} from 'react';
import {ACOUSTIC_BANDS,ACOUSTIC_CLIP,acousticBins,acousticResponse,accumulateAcousticSpectrum,type AcousticPoint} from '../../../shared/acoustic-measurement';
import './studio-additions.css';
import {parseRoomCurve} from '../../../shared/room-eq';
import {tx} from '../i18n';

type Capture={stream:MediaStream;context:AudioContext;timer?:ReturnType<typeof setInterval>};
const changedError='Le microphone a changé depuis la mesure du bruit de fond. Recommence les deux mesures.';
const microphoneError='Micro inaccessible. Vérifie le périphérique et l’autorisation Microphone du système.';
const processedError='Désactive le traitement vocal du périphérique avant de mesurer.';
const width=600,height=150;
const x=(hz:number)=>20+560*Math.log(hz/40)/Math.log(12500/40);
const y=(db:number)=>height/2-Math.max(-30,Math.min(30,db))*2;

// An offline reference file keeps the test signal on the user's chosen playback route.
function downloadPinkNoise(){
 const rate=48000,length=rate*15,samples=new Float32Array(length);
 let energy=0;
 // Voss-McCartney: sum random sequences updated at octave-spaced rates.
 const octaves=Array.from({length:14},()=>Math.random()*2-1);
 for(let i=0;i<samples.length;i++){
  let sample=Math.random()*2-1;
  for(let band=0;band<octaves.length;band++){
   if(i%(2**(band+1))===0)octaves[band]=Math.random()*2-1;
   sample+=octaves[band]!;
  }
  samples[i]=sample;energy+=sample**2;
 }
 const output=new ArrayBuffer(44+length*2),wav=new DataView(output);
 const tag=(offset:number,text:string)=>Array.from(text).forEach((char,i)=>wav.setUint8(offset+i,char.charCodeAt(0)));
 tag(0,'RIFF');wav.setUint32(4,output.byteLength-8,true);tag(8,'WAVE');tag(12,'fmt ');
 wav.setUint32(16,16,true);wav.setUint16(20,1,true);wav.setUint16(22,1,true);
 wav.setUint32(24,rate,true);wav.setUint32(28,rate*2,true);wav.setUint16(32,2,true);wav.setUint16(34,16,true);
 tag(36,'data');wav.setUint32(40,length*2,true);
 const gain=32767*10**(-30/20)/Math.sqrt(energy/length);
 samples.forEach((sample,i)=>wav.setInt16(44+2*i,Math.round(sample*gain*Math.min(1,i/12000,(length-1-i)/12000)),true));
 const url=URL.createObjectURL(new Blob([output],{type:'audio/wav'})),link=document.createElement('a');
 link.href=url;link.download='BandPilot-pink-noise.wav';link.click();
 setTimeout(()=>URL.revokeObjectURL(url),1000);
}

export function AcousticMeasurement({curve,onCurve}:{curve:AcousticPoint[]|null;onCurve:(curve:AcousticPoint[]|null)=>void}){
 const session=useRef<Capture|null>(null),generation=useRef(0),floor=useRef<{spectrum:number[];device:string;sampleRate:number}|null>(null);
 const [phase,setPhase]=useState<'idle'|'ambient'|'ready'|'signal'|'result'>('idle');
 const [devices,setDevices]=useState<MediaDeviceInfo[]>([]),[device,setDevice]=useState('');
 const [calibration,setCalibration]=useState<AcousticPoint[]>([]),[error,setError]=useState(''),[progress,setProgress]=useState(0);
 const active=phase==='ambient'||phase==='signal';
 const stop=()=>{
  ++generation.current;
  const capture=session.current;
  session.current=null;
  if(!capture)return;
  clearInterval(capture.timer);
  capture.stream.getTracks().forEach(track=>track.stop());
  void capture.context.close().catch(()=>undefined);
 };
 useEffect(()=>{
  const media=navigator.mediaDevices;
  const refresh=()=>void media?.enumerateDevices().then(list=>setDevices(list.filter(d=>d.kind==='audioinput'&&d.deviceId))).catch(()=>undefined);
  const hide=()=>{if(document.hidden&&(phase==='ambient'||phase==='signal')){stop();setPhase('idle');}};
  refresh();
  const reset=()=>{stop();floor.current=null;onCurve(null);setPhase('idle');};
  media?.addEventListener('devicechange',refresh);
  window.addEventListener('bandpilot-console-reset',reset);
  document.addEventListener('visibilitychange',hide);
  return()=>{media?.removeEventListener('devicechange',refresh);document.removeEventListener('visibilitychange',hide);window.removeEventListener('bandpilot-console-reset',reset);};
 },[phase]);
 useEffect(()=>stop,[]);
 const fail=(message:string)=>{stop();setError(message);setPhase('idle');};
 const measure=async(kind:'ambient'|'signal')=>{
  stop();
  setError('');onCurve(null);setProgress(0);setPhase(kind);
  const id=generation.current;
  let stream:MediaStream|undefined;
  try{
   if(!navigator.mediaDevices?.getUserMedia)throw Error(microphoneError);
   const permission=(window as Window&{bandpilotAcousticMic?:{request:()=>Promise<boolean>}}).bandpilotAcousticMic;
   if(permission&&!await permission.request())throw Error(microphoneError);
   if(id!==generation.current)return;
   const constraints=navigator.mediaDevices.getSupportedConstraints();
   const audio:MediaTrackConstraints={channelCount:{ideal:1}};
   for(const key of ['autoGainControl','noiseSuppression','echoCancellation'] as const)if(constraints[key])audio[key]={exact:false};
   if(device)audio.deviceId={exact:device};
   stream=await navigator.mediaDevices.getUserMedia({audio,video:false});
   if(id!==generation.current||document.hidden){stream.getTracks().forEach(track=>track.stop());return;}
   const track=stream.getAudioTracks()[0];
   if(!track)throw Error(microphoneError);
   const settings=track.getSettings();
   if(settings.autoGainControl||settings.noiseSuppression||settings.echoCancellation)throw Error(processedError);
   const context=new AudioContext();
   const capture:Capture={stream,context};
   session.current=capture;
   const deviceId=settings.deviceId??device;
   const baseline=floor.current;
   if(kind==='signal'&&(!baseline||baseline.device!==deviceId||baseline.sampleRate!==context.sampleRate))throw Error(changedError);
   track.addEventListener('ended',()=>{if(id===generation.current)fail(microphoneError);},{once:true});
   const analyser=context.createAnalyser();
   analyser.fftSize=16384;
   analyser.smoothingTimeConstant=0;
   context.createMediaStreamSource(stream).connect(analyser);
   await context.resume();
   if(id!==generation.current)return;
   const spectrum=new Float32Array(analyser.frequencyBinCount),wave=new Float32Array(analyser.fftSize);
   const bins=acousticBins(context.sampleRate,analyser.fftSize),sum=ACOUSTIC_BANDS.map(()=>0);
   const start=context.currentTime, duration=kind==='ambient'?2:5;
   let frames=0;
   capture.timer=setInterval(()=>{
    try{
     const elapsed=context.currentTime-start-.35;
     if(elapsed<0)return;
     analyser.getFloatTimeDomainData(wave);
     if(wave.some(value=>Math.abs(value)>=.995))throw Error(ACOUSTIC_CLIP);
     analyser.getFloatFrequencyData(spectrum);
     accumulateAcousticSpectrum(spectrum,bins,sum);
     ++frames;
     setProgress(Math.min(1,elapsed/duration));
     if(elapsed<duration)return;
     const average=sum.map(v=>v/frames);
     stop();
     if(kind==='ambient'){floor.current={spectrum:average,device:deviceId,sampleRate:context.sampleRate};setPhase('ready');}
     else{onCurve(acousticResponse(baseline!.spectrum,average,calibration));setPhase('result');}
    }catch(cause){fail((cause as Error).message);}
   },125);
  }catch(cause){
   stream?.getTracks().forEach(track=>track.stop());
   if(id===generation.current){
    const message=(cause as Error).message;
    fail(message===processedError||message===changedError?message:microphoneError);
   }
  }
 };
 return <section className="acoustic-capture" aria-label={tx('Mesure au micro')}>
  <strong>{tx('Mesure au micro')}</strong>
  <p>{tx('Place un micro de mesure à la position d’écoute. Mesure le bruit de fond, puis diffuse du bruit rose à faible niveau sur la sortie choisie et lance la seconde mesure.')}</p>
  <div className="preparation-fields">
   <label>{tx('Microphone')}<select value={device} disabled={active} onChange={e=>{setDevice(e.target.value);setPhase('idle');onCurve(null);}}>
    <option value="">{tx('Micro par défaut')}</option>
    {devices.filter(d=>d.deviceId!=='default'&&d.deviceId!=='communications').map((d,i)=><option key={d.deviceId} value={d.deviceId}>{d.label||`${tx('Microphone')} ${i+1}`}</option>)}
   </select></label>
   <label>{tx('Calibration du micro (facultatif)')}<input type="file" accept=".txt,.csv,.tsv" disabled={active} onChange={async e=>{
    const file=e.target.files?.[0];setError('');setCalibration([]);setPhase('idle');onCurve(null);
    if(file)try{if(file.size>200000)throw Error(microphoneError);setCalibration(parseRoomCurve(await file.text()));}catch(cause){setError((cause as Error).message);}
   }}/></label>
  </div>
  <div className="feature-actions">
   <button type="button" disabled={active} onClick={downloadPinkNoise}>{tx('Télécharger un bruit rose (WAV)')}</button>
   <button type="button" disabled={active} onClick={()=>void measure('ambient')}>{tx('Mesurer le bruit de fond')}</button>
   <button type="button" disabled={phase!=='ready'} onClick={()=>void measure('signal')}>{tx('Mesurer le bruit rose')}</button>
   {active&&<button type="button" onClick={()=>{stop();setPhase('idle');}}>{tx('Arrêter la mesure')}</button>}
  </div>
  {active&&<progress max={1} value={progress} aria-label={tx('Mesure au micro')}/>}
  {phase==='ready'&&<p role="status">{tx('Bruit de fond mesuré. Lance le bruit rose avant de démarrer la seconde mesure.')}</p>}
  {error&&<p role="alert">{tx(error)}</p>}
  {curve&&<figure className="acoustic-curve">
   <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label={tx('Réponse relative en dB')}>
    {[-30,-15,0,15,30].map(db=><g key={db}><line x1={20} x2={580} y1={y(db)} y2={y(db)}/><text x={0} y={y(db)+4}>{db}</text></g>)}
    <polyline points={curve.map(([hz,db])=>`${x(hz)},${y(db)}`).join(' ')}/>
    {[40,100,250,1000,4000,12500].map(hz=><text key={hz} x={x(hz)} y={height-2} textAnchor="middle">{hz}</text>)}
   </svg>
   <figcaption>{tx('Réponse relative en dB')} · {tx(calibration.length?'Micro corrigé par le fichier de calibration':'Réponse incluant le microphone')}</figcaption>
  </figure>}
 </section>;
}
