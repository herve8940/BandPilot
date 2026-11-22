const {readFileSync,writeFileSync,renameSync}=require('node:fs');
const {join}=require('node:path');
const holds=[0,500,1500,3000,10000,-1];
function meteringStore(directory){
 const file=join(directory,'meter-display.json');
 return {
  get(){try{const v=JSON.parse(readFileSync(file,'utf8'));return holds.includes(v.holdMs)?{holdMs:v.holdMs}:null;}catch{return null;}},
  set(value){if(!value||!holds.includes(value.holdMs))return false;try{writeFileSync(file+'.tmp',JSON.stringify({holdMs:value.holdMs}),{mode:0o600});renameSync(file+'.tmp',file);return true;}catch{return false;}}
 };
}
module.exports={meteringStore};
