/** Waveform of a PCM WAV take, drawn by the app so that nobody has to look at Reaper. */
import {open,stat} from 'node:fs/promises';

const cache=new Map<string,{mtime:number;size:number;peaks:number[]}>();
export async function wavPeaks(file:string,buckets=600):Promise<number[]|null>{
 const info=await stat(file),key=file+'#'+buckets,hit=cache.get(key);
 if(hit&&hit.mtime===info.mtimeMs&&hit.size===info.size)return hit.peaks;
 const f=await open(file,'r');
 try{
  const head=Buffer.alloc(65536);const {bytesRead}=await f.read(head,0,head.length,0);
  if(bytesRead<44||head.toString('latin1',0,4)!=='RIFF'||head.toString('latin1',8,12)!=='WAVE')return null;
  let pos=12,bits=0,format=0,channels=0,dataAt=0,dataSize=0;
  while(pos+8<=bytesRead){
   const id=head.toString('latin1',pos,pos+4),size=head.readUInt32LE(pos+4);
   if(id==='fmt '){format=head.readUInt16LE(pos+8);channels=head.readUInt16LE(pos+10);bits=head.readUInt16LE(pos+22);}
   if(id==='data'){dataAt=pos+8;dataSize=Math.min(size,info.size-dataAt);break;}
   pos+=8+size+(size&1);
  }
  const width=bits/8;
  if(!dataAt||!channels||(format!==1&&format!==65534)||![2,3,4].includes(width))return null;
  const frame=width*channels,frames=Math.floor(dataSize/frame),count=Math.max(1,Math.min(buckets,frames)),peaks:number[]=[];
  const stride=Math.max(1,Math.floor(frames/count/400));
  // Whole file in big blocks: a long rehearsal is several gigabytes, it is sampled, never loaded.
  const block=Buffer.alloc(Math.min(1<<20,Math.floor(frames/count)*frame||frame));
  for(let b=0;b<count;b++){
   const {bytesRead:got}=await f.read(block,0,block.length,dataAt+Math.floor(b*frames/count)*frame);
   let max=0;
   for(let p=0;p+width<=got;p+=frame*stride){
    const v=width===2?block.readInt16LE(p)/32768:width===3?block.readIntLE(p,3)/8388608:block.readInt32LE(p)/2147483648;
    if(Math.abs(v)>max)max=Math.abs(v);
   }
   peaks.push(Math.round(max*1000)/1000);
  }
  cache.set(key,{mtime:info.mtimeMs,size:info.size,peaks});
  return peaks;
 }finally{await f.close();}
}
