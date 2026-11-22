import {createHash} from 'node:crypto';
import type {SceneRecallScope} from '../shared/scene-recall.js';
import type {LibraryStore} from './library-store.js';
import type {SceneRecall} from './scene-recall.js';
import type {XR18} from './xr18.js';

type MidiScene = {model:string;sourceId:string;scope:SceneRecallScope};
const KIND='midi-scene';

export class MidiScenes {
  constructor(private xr:XR18,private library:LibraryStore,private recall:SceneRecall){}

  list(){
    return this.library.list(KIND).filter(entry=>(entry.data as MidiScene).model===this.xr.model().id);
  }

  save(input:Record<string,unknown>){
    const {model,sourceId,scope,name}=input;
    if(model!==this.xr.model().id||this.xr.model().family!=='xair'||typeof sourceId!=='string')throw Error('Sélection de scène MIDI invalide.');
    const selection=this.recall.validatedScope(sourceId,scope);
    if(this.list().length>=64)throw Error('64 commandes de scène MIDI maximum par modèle.');
    return this.library.save(KIND,name,{model,sourceId,scope:selection});
  }

  remove(id:string){
    const entry=this.library.get(id);
    if(entry.kind!==KIND||(entry.data as MidiScene).model!==this.xr.model().id)throw Error('Sélection de scène MIDI invalide.');
    return this.library.delete(id);
  }

  private source(id:string){
    const entry=this.library.get(id),cue=entry.data as MidiScene;
    if(entry.kind!==KIND||cue.model!==this.xr.model().id)throw Error('Sélection de scène MIDI invalide.');
    const source=this.library.get(cue.sourceId);
    const fingerprint=createHash('sha256').update(JSON.stringify([entry,source])).digest('hex');
    return {cue,name:entry.name,sceneName:source.name,fingerprint};
  }

  async review(id:string){
    const {cue,name,sceneName,fingerprint}=this.source(id);
    const review=await this.recall.reviewMidi(cue.sourceId,cue.scope);
    this.checkSource(id,fingerprint);
    return {id,name,sceneName,fingerprint,...review};
  }

  checkSource(id:string,fingerprint:string){
    if(this.source(id).fingerprint!==fingerprint)throw Error('La scène MIDI a changé. Prépare une nouvelle activation.');
  }

  async fire(review:Awaited<ReturnType<MidiScenes['review']>>,beforeWrite:()=>void,assertActive:()=>void){
    this.checkSource(review.id,review.fingerprint);
    const {cue}=this.source(review.id);
    const plan=await this.recall.previewMidi(cue.sourceId,cue.scope,review,assertActive);
    assertActive();
    if(!plan.token)return {id:review.id,written:0};
    this.checkSource(review.id,review.fingerprint);
    beforeWrite();
    assertActive();
    const result=await this.recall.apply(cue.sourceId,plan.token,true,assertActive);
    return {id:review.id,written:result.written,backupId:result.backupId};
  }
}
