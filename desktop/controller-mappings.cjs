const {readFileSync,writeFileSync,renameSync}=require('node:fs');
const {join}=require('node:path');
function valid(v){return v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).length<=16&&Object.entries(v).every(([model,bindings])=>/^[A-Z0-9]+$/.test(model)&&Array.isArray(bindings)&&bindings.length<=64&&bindings.every(b=>b&&typeof b==='object'&&typeof b.id==='string'&&typeof b.device==='string'&&typeof b.target==='string'&&['cc','note','pitch','program'].includes(b.kind)&&Number.isInteger(b.channel)&&b.channel>=1&&b.channel<=16&&Number.isInteger(b.number)&&b.number>=0&&b.number<=127&&(b.ccMode===undefined||b.kind==='cc'&&['absolute','twos','offset','signed','custom'].includes(b.ccMode))&&(b.stepDb===undefined||[.1,.5,1,2].includes(b.stepDb))&&(b.feedback===undefined||typeof b.feedback==='boolean')&&(b.ccMode!=='custom'||Number.isInteger(b.increment)&&Number.isInteger(b.decrement)&&b.increment>=0&&b.increment<=127&&b.decrement>=0&&b.decrement<=127&&b.increment!==b.decrement)));}
function controllerMappingsStore(directory){const file=join(directory,'controller-mappings.json');return {
 get(){try{const raw=readFileSync(file,'utf8');if(raw.length>128*1024)return null;const v=JSON.parse(raw);return valid(v)?v:null;}catch{return null;}},
 set(v){if(!valid(v))return false;const raw=JSON.stringify(v);if(raw.length>128*1024)return false;try{writeFileSync(file+'.tmp',raw,{mode:0o600});renameSync(file+'.tmp',file);return true;}catch{return false;}}
};}
module.exports={controllerMappingsStore};
