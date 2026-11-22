import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {loadBandStudioSheet} from '../src/bandstudio-sheet.js';
test('export-local cues keep the preroll, optional source fills only missing lanes, ambiguous exports require a match',async()=>{
 const root=await mkdtemp(join(tmpdir(),'bp-song-sheet'));
 try{
  const bundle=join(root,'Song.bandstudio'),folder=join(bundle,'Exports','edition');
  await mkdir(folder,{recursive:true});
  const rpp=join(folder,'Song.rpp');await writeFile(rpp,'modified');
  const cue={start:2,end:3,text:'Am'};
  await writeFile(join(bundle,'project.json'),JSON.stringify({chords:[cue],lyrics:[{...cue,text:'Fixture'}]}));
  const meta={key:'Em',capo:0,chords:[{...cue,text:'Dm'}],lyrics:[],exportPreroll:1.5,rppSHA256:createHash('sha256').update('original').digest('hex')};
  await writeFile(join(folder,'bandstudio-project.json'),JSON.stringify(meta));
  const data=await loadBandStudioSheet(rpp);
  assert.equal(data.sheet.capo,0);assert.equal(data.source?.key,'Em');
  assert.deepEqual(data.sheet.chords,[{text:'Dm',start:3.5,end:4.5}]);
  assert.deepEqual(data.sheet.lyrics,[]);assert.deepEqual(data.source?.chords,data.sheet.chords);
  assert.equal(data.source?.lyrics[0]?.start,3.5);
  await writeFile(join(folder,'Other.rpp'),'original');
  assert.deepEqual((await loadBandStudioSheet(rpp)).sheet.chords,[]);
  assert.equal((await loadBandStudioSheet(join(folder,'Other.rpp'))).sheet.chords.length,1);
 }finally{await rm(root,{recursive:true,force:true});}
});

import {sheetPosition,type SheetFrame} from '../shared/bandstudio-sheet.js';
test('screen clock follows the play rate and wraps locally when the next cue is across a loop boundary',()=>{
 const frame:SheetFrame={project:'song',title:'Song',position:9.95,section:'Verse',loop:true,playing:true,rate:1,loopStart:5,loopEnd:10,sampledAt:0,revision:'v'};
 assert.ok(Math.abs(sheetPosition(frame,80)-5.03)<1e-8);
 assert.ok(Math.abs(sheetPosition({...frame,rate:0.5},80)-9.99)<1e-8);
 assert.equal(sheetPosition({...frame,playing:false},300),9.95);
 assert.ok(Math.abs(sheetPosition({...frame,loop:false},5000)-10.6)<1e-8);
});
