import test from 'node:test';
import assert from 'node:assert/strict';
import {convertChannelPreset,validateChannelPreset} from '../src/channel-presets.js';
test('explicit preset conversion between X-Air models preserves all processing and stereo differences without changing the source',()=>{
 const input=validateChannelPreset({format:'bandpilot-channel-preset',version:2,stereo:true,linked:false,model:'XR18',sourceChannel:15,sections:['eq'],values:{'eq/on':1,'eq/1/g':.3},rightValues:{'eq/on':1,'eq/1/g':.7}}),original=JSON.stringify(input);
 for(const model of ['MR12','XR12','MR18','X18']){const converted=convertChannelPreset(input,model,3);assert.equal(converted.model,model);assert.equal(converted.sourceChannel,3);assert.deepEqual(converted.values,input.values);assert.equal(converted.version,2);if(converted.version===2&&input.version===2)assert.deepEqual(converted.rightValues,input.rightValues);}
 assert.equal(JSON.stringify(input),original);assert.throws(()=>convertChannelPreset(input,'XR12',12),/Paire/);assert.throws(()=>convertChannelPreset(input,'X32',1),/uniquement/);assert.throws(()=>convertChannelPreset(input,'XR12',15),/absent/);
});
