const fs=require('node:fs');
const {parseVersion,newer}=require('../desktop/versions.cjs');
function planRelease(base,releases,commit){
 if(!parseVersion(base)||parseVersion(base).prerelease)throw Error('main must declare a stable base version');
 const stable=releases.filter(r=>!r.prerelease&&/^v\d+\.\d+\.\d+$/.test(r.tag_name));
 const existing=stable.find(r=>!r.draft&&r.target_commitish===commit);
 if(existing)return {needed:false,version:existing.tag_name.slice(1)};
 let version=base;
 for(const release of stable){
  const used=release.tag_name.slice(1);
  if(!newer(version,used)){
   const parsed=parseVersion(used);if(!parsed)throw Error('Invalid published version');
   const [major,minor,patch]=parsed.core;
   version=`${major}.${minor}.${patch+1}`;
  }
 }
 return {needed:true,version};
}
async function main(){
 if(process.argv[2]==='apply'){
  const version=process.env.RELEASE_VERSION;
  if(!parseVersion(version)||parseVersion(version).prerelease)throw Error('Invalid RELEASE_VERSION');
  for(const file of ['package.json','package-lock.json']){
   const data=JSON.parse(fs.readFileSync(file,'utf8'));data.version=version;
   if(data.packages?.[''])data.packages[''].version=version;
   fs.writeFileSync(file,JSON.stringify(data,null,2)+'\n');
  }
  return;
 }
 const releases=[];
 for(let page=1;;page++){
  const response=await fetch(`https://api.github.com/repos/${process.env.GITHUB_REPOSITORY}/releases?per_page=100&page=${page}`,{headers:{Authorization:`Bearer ${process.env.GH_TOKEN}`,Accept:'application/vnd.github+json'},signal:AbortSignal.timeout(30000)});
  if(!response.ok)throw Error(`Releases: HTTP ${response.status}`);
  const batch=await response.json();releases.push(...batch);if(batch.length<100)break;
 }
 const plan=planRelease(require('../package.json').version,releases,process.env.GITHUB_SHA);
 fs.appendFileSync(process.env.GITHUB_OUTPUT,`needed=${plan.needed}\nversion=${plan.version}\n`);
 console.log(`main ${process.env.GITHUB_SHA}: ${plan.needed?'build':'already published'} ${plan.version}`);
}
if(require.main===module)main().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={planRelease};
