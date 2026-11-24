const {readFileSync,writeFileSync,renameSync,rmSync}=require('node:fs');
function loadAI(path,storage){
 try{
  const saved=JSON.parse(readFileSync(path,'utf8'));
  if(typeof saved?.encrypted!=='string'||!saved.encrypted)return null;
  if(!storage.isEncryptionAvailable()||storage.getSelectedStorageBackend?.()==='basic_text')return null;
  return validate(JSON.parse(storage.decryptString(Buffer.from(saved.encrypted,'base64'))));
 }catch{return null;}
}
function validate(input){
 if(!input||typeof input.apiKey!=='string'||input.apiKey.trim().length<10||input.apiKey.length>1000||typeof input.model!=='string'||!/^[a-zA-Z0-9._:-]{1,100}$/.test(input.model.trim()))throw Error('Clé API et nom de modèle requis');
 return {apiKey:input.apiKey.trim(),model:input.model.trim()};
}
function saveAI(path,storage,input){
 if(input===null){rmSync(path,{force:true});return null;}
 const config=validate(input);
 if(!storage.isEncryptionAvailable()||storage.getSelectedStorageBackend?.()==='basic_text')throw Error('Le coffre chiffré du système est indisponible. Aucune clé n’a été enregistrée.');
 const encrypted=storage.encryptString(JSON.stringify(config));writeFileSync(path+'.tmp',JSON.stringify({encrypted:encrypted.toString('base64')}),{mode:0o600});renameSync(path+'.tmp',path);return config;
}
module.exports={loadAI,saveAI};
