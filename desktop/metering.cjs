const {readFileSync,writeFileSync,renameSync}=require('node:fs');
const {join}=require('node:path');
const holds=[0,500,1500,3000,10000,-1];
function clean(v){
 if(!v||!holds.includes(v.holdMs))return null;
 const result={holdMs:v.holdMs};
 if([0,6,12,24].includes(v.decay))result.decay=v.decay;
 for(const key of ['contrast','fine'])if(typeof v[key]==='boolean')result[key]=v[key];
 return result;
}
function meteringStore(directory){
 const file=join(directory,'meter-display.json');
 return {
  get(){try{const v=JSON.parse(readFileSync(file,'utf8'));return clean(v);}catch{return null;}},
  set(value){if(!value||!holds.includes(value.holdMs))return false;try{writeFileSync(file+'.tmp',JSON.stringify({...this.get(),...clean(value)}),{mode:0o600});renameSync(file+'.tmp',file);return true;}catch{return false;}}
 };
}
module.exports={meteringStore};
