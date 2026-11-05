import {test} from 'node:test';
import assert from 'node:assert/strict';
import {askConnectedCoach} from '../src/coach-ai.js';
test('connected AI requires explicit consent, uses server credentials and cannot produce executable console plans',async()=>{
 const oldKey=process.env.XR18_OPENAI_API_KEY,oldModel=process.env.XR18_OPENAI_MODEL;
 process.env.XR18_OPENAI_API_KEY='test-not-a-real-key';process.env.XR18_OPENAI_MODEL='configured-test-model';let calls=0;
 const request:typeof fetch=async(input,init)=>{
  calls++;assert.equal(input,'https://api.openai.com/v1/responses');const body=JSON.parse(String(init?.body));assert.equal(body.store,false);assert.equal(body.tools,undefined);assert.equal(body.model,'configured-test-model');assert.equal(body.text.format.strict,true);assert.deepEqual(body.text.format.schema.required,['answer','checks','question']);assert.ok(!String(init?.body).includes('test-not-a-real-key'));
  return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({answer:'Vérifie le micro et son placement.',checks:['Écoute une source à la fois.'],question:'Quel instrument est concerné ?'})}]}]}),{status:200});
 };
 try{
  const context={source:'lead-rock',mode:'real',connected:true};await assert.rejects(askConnectedCoach('voix étouffée',context,false,request),/Accord explicite/);assert.equal(calls,0);
  const answer=await askConnectedCoach('voix étouffée',context,true,request);assert.equal(calls,1);assert.equal((answer as unknown as {values?:unknown}).values,undefined);
  await assert.rejects(askConnectedCoach('test',context,true,async()=>new Response('private provider message',{status:401})),/Service IA indisponible/);
  delete process.env.XR18_OPENAI_API_KEY;await assert.rejects(askConnectedCoach('test',context,true,request),/non configurée/);assert.equal(calls,1);
 }finally{if(oldKey===undefined)delete process.env.XR18_OPENAI_API_KEY;else process.env.XR18_OPENAI_API_KEY=oldKey;if(oldModel===undefined)delete process.env.XR18_OPENAI_MODEL;else process.env.XR18_OPENAI_MODEL=oldModel;}
});


test('connected advice uses the requested language without changing its safety contract',async()=>{
 const oldKey=process.env.XR18_OPENAI_API_KEY,oldModel=process.env.XR18_OPENAI_MODEL;
 process.env.XR18_OPENAI_API_KEY='test-only';process.env.XR18_OPENAI_MODEL='test-model';
 try {
  for(const language of ['fr','en'] as const){
   await askConnectedCoach('Check my vocals',{source:'lead-rock',mode:'simulation',connected:false,language},true,async(_input,init)=>{
    const payload=JSON.parse(String(init?.body));
    assert.ok(payload.instructions.startsWith(language==='en'?'Respond exclusively in English.':'Réponds exclusivement en français.'));
    assert.ok(payload.instructions.includes('Tu ne reçois aucun audio'));assert.equal(payload.tools,undefined);
    assert.equal(JSON.parse(payload.input[0].content).context.language,language);
    return new Response(JSON.stringify({status:'completed',output:[{type:'message',content:[{type:'output_text',text:JSON.stringify({answer:'Check placement.',checks:[],question:''})}]}]}));
   });
  }
 }finally{if(oldKey===undefined)delete process.env.XR18_OPENAI_API_KEY;else process.env.XR18_OPENAI_API_KEY=oldKey;if(oldModel===undefined)delete process.env.XR18_OPENAI_MODEL;else process.env.XR18_OPENAI_MODEL=oldModel;}
});
