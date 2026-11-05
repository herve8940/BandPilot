import test from 'node:test';
import assert from 'node:assert/strict';
import {identifySymptom} from '../src/sound-coach.js';

test('local adviser recognises English descriptions and retains French diagnoses',()=>{
 const samples=[['feedback','The monitor is whistling','Il y a du larsen'],['clipping','My guitar is clipping','Ça sature'],['cutoff','The ends of notes are cut off','Les notes sont coupées'],['noise','There is a hum and hiss','Il y a du souffle'],['harsh','Vocals sound harsh','Ça pique'],['boomy','Too much bass','Trop de graves'],['muddy','The voice is muffled','La voix est étouffée'],['buried',"I cannot hear my voice",'On ne distingue pas ma voix'],['uneven','The level is uneven','Le volume est irrégulier'],['dry','The vocals sound dry','La voix est sèche']];
 for(const[id,en,fr]of samples){assert.equal(identifySymptom(en!),id,en);assert.equal(identifySymptom(fr!),id,fr);}
 assert.equal(identifySymptom('Everything sounds good'),null);
});


test('local adviser recognises Italian, Spanish and German audio problems',()=>{
 const samples=[
 ['feedback','Il monitor fischia','Hay acople en el monitor','Das Mikrofon pfeift'],
 ['clipping','La chitarra distorce','La guitarra distorsiona','Die Gitarre übersteuert'],
 ['cutoff','Le note vengono tagliate','Se cortan las palabras','Die Notenenden werden abgeschnitten'],
 ['noise','Sento un ronzio','Hay un zumbido','Ich höre ein Brummen'],
 ['harsh','La voce è troppo aspra','La voz es muy chillona','Die Stimme klingt schrill'],
 ['boomy','Ci sono troppi bassi','Los graves retumban','Der Bass dröhnt'],
 ['muddy','La voce è impastata','La voz suena apagada','Die Stimme klingt dumpf'],
 ['buried','Non sento la mia voce','No se oye mi voz','Ich höre meine Stimme nicht'],
 ['uneven','Il volume è irregolare','El volumen es desigual','Die Lautstärke schwankt'],
 ['dry','La voce è troppo asciutta','La voz suena seca','Die Stimme klingt trocken']
 ];
 for(const [id,...texts] of samples)for(const text of texts)assert.equal(identifySymptom(text!),id,text);
 for(const text of ['Tutto suona bene','Todo suena bien','Alles klingt gut'])assert.equal(identifySymptom(text),null,text);
});
