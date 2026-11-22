import test from 'node:test';
import assert from 'node:assert/strict';
import {trackResonance,sustainedResonance,type Resonance} from '../src/expert/resonance-tracker';
test('resonance guide needs sustained fresh narrow peaks, rejects low or broad spectra and clears interrupted measurements',()=>{
 const bands=Array(100).fill(-70);bands[60]=-30;let r:Resonance|null=null;
 for(let at=0;at<=2000;at+=400){r=trackResonance(r,{bands,at},at);assert.equal(sustainedResonance(r),at===2000);}
 assert.ok(r!.hz>1300&&r!.hz<1400);const repeated=trackResonance(r,{bands,at:2000},2200);assert.equal(repeated,r);assert.equal(repeated!.frames,6);
 assert.equal(trackResonance(r,{bands,at:2000},3600),null);assert.equal(trackResonance(r,null,2400),null);
 assert.equal(sustainedResonance(trackResonance(r,{bands,at:4000},4000)),false);
 assert.equal(trackResonance(r,{bands:Array(100).fill(-20),at:2400},2400),null);
 assert.equal(trackResonance(r,{bands:bands.map(v=>v-30),at:2400},2400),null);
 const moved=[...bands];moved[60]=-70;moved[75]=-20;assert.equal(sustainedResonance(trackResonance(r,{bands:moved,at:2400},2400)),false);
 assert.equal(trackResonance(r,{bands:[NaN],at:2400},2400),null);assert.equal(trackResonance(r,{bands,at:5000},2400),null);
});
