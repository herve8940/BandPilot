const {getRawHeader}=require('@electron/asar');
const {join}=require('node:path');
const {Arch}=require('builder-util');

module.exports=async function verifyDesktopFiles({appOutDir,packager,electronPlatformName,arch}){
 const resources=electronPlatformName==='darwin'
  ? join(appOutDir,packager.appInfo.productFilename+'.app','Contents','Resources')
  : join(appOutDir,'resources');
 const files=getRawHeader(join(resources,'app.asar')).header.files;
 const expected=['LICENSE','THIRD_PARTY_NOTICES.txt','desktop','dist','integrations','node_modules','package.json'];
 if(Object.keys(files).sort().join()!==expected.sort().join())throw Error('Unexpected app.asar contents: '+Object.keys(files).sort().join(', '));
 const native=files.node_modules.files['better-sqlite3']?.files?.prebuilds?.files;
 if(!native?.[electronPlatformName+'-'+Arch[arch]+'.node'])throw Error('SQLite binding missing for '+electronPlatformName+' '+Arch[arch]);
};
