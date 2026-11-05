import test from 'node:test';
import assert from 'node:assert/strict';
import {identifySymptom} from '../src/sound-coach.js';

test('local adviser recognises English descriptions and retains French diagnoses',()=>{
 const samples=[['feedback','The monitor is whistling','Il y a du larsen'],['clipping','My guitar is clipping','Ça sature'],['cutoff','The ends of notes are cut off','Les notes sont coupées'],['noise','There is a hum and hiss','Il y a du souffle'],['harsh','Vocals sound harsh','Ça pique'],['boomy','Too much bass','Trop de graves'],['muddy','The voice is muffled','La voix est étouffée'],['buried',"I cannot hear my voice",'On ne distingue pas ma voix'],['uneven','The level is uneven','Le volume est irrégulier'],['dry','The vocals sound dry','La voix est sèche']];
 for(const[id,en,fr]of samples){assert.equal(identifySymptom(en!),id,en);assert.equal(identifySymptom(fr!),id,fr);}
 assert.equal(identifySymptom('Everything sounds good'),null);
});
