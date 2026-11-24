import type {IncomingMessage,ServerResponse} from 'node:http';
import type {StudioDatabase} from './database.js';
import {MAX_SONG_PDF_BYTES} from '../shared/song-pdf.js';

export async function serveSongPdf(req:IncomingMessage,res:ServerResponse,db:StudioDatabase,id:string){
 const finish=(status:number)=>{res.writeHead(status);res.end();};
 res.setHeader('Cache-Control','private, no-store');
 if(req.method==='GET'){
  const pdf=db.songPdf(id);
  if(!pdf)return finish(404);
  res.writeHead(200,{'Content-Type':'application/pdf','Content-Length':pdf.length,
   'Content-Disposition':'attachment; filename="BandPilot.pdf"','X-Content-Type-Options':'nosniff'});
  res.end(pdf);return;
 }
 if(req.method==='DELETE')return finish(db.deleteSongPdf(id)?204:404);
 if(req.method!=='PUT'){res.setHeader('Allow','GET, PUT, DELETE');return finish(405);}
 if(req.headers['content-type']?.split(';')[0]!=='application/pdf')return finish(415);
 if(Number(req.headers['content-length'])>MAX_SONG_PDF_BYTES)return finish(413);
 let size=0;
 const parts:Buffer[]=[];
 for await(const part of req){
  size+=part.length;
  if(size>MAX_SONG_PDF_BYTES)return finish(413);
  parts.push(part);
 }
 const pdf=Buffer.concat(parts,size);
 if(!pdf.subarray(0,5).equals(Buffer.from('%PDF-')) || !pdf.subarray(-1024).includes('%%EOF'))return finish(422);
 finish(db.saveSongPdf(id,pdf)?204:404);
}
