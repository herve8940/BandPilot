const REPOSITORY='herve8940/BandPilot';
const WEB=`https://github.com/${REPOSITORY}`;
const API=`https://api.github.com/repos/${REPOSITORY}`;
function versionParts(value){return typeof value==='string'&&/^\d+\.\d+\.\d+$/.test(value)?value.split('.').map(Number):null;}
function newer(candidate,current){const a=versionParts(candidate),b=versionParts(current);if(!a||!b)return false;for(let i=0;i<3;i++){if(a[i]!==b[i])return a[i]>b[i];}return false;}
async function github(fetcher,path,{token,method='GET',body,raw=false}={}){
 const response=await fetcher(API+path,{method,redirect:'error',signal:AbortSignal.timeout(10000),headers:{Accept:raw?'application/vnd.github.raw+json':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28','User-Agent':'BandPilot',...(token?{Authorization:`Bearer ${token}`} :{}),...(body?{'Content-Type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{})});
 if(!response.ok){const error=Error(response.status===401||response.status===403?'GitHub refuse l’accès. Vérifie la connexion et le droit Issues en écriture.':`GitHub indisponible (${response.status}). Réessaie plus tard.`);error.status=response.status;throw error;}
 return response.json();
}
async function checkUpdate(fetcher,current,platform,arch){
 const [release,main]=await Promise.all([github(fetcher,'/releases/latest'),github(fetcher,'/contents/package.json?ref=main',{raw:true})]);
 const version=String(release.tag_name??'').replace(/^v/,'');
 if(release.draft||release.prerelease||!versionParts(version)||!versionParts(main.version)||newer(version,main.version)||!newer(version,current))return {available:false,current};
 const name=platform==='darwin'?`BandPilot-macOS-${version}-${arch}.dmg`:platform==='win32'?`BandPilot-Windows-${version}.exe`:platform==='linux'?`BandPilot-Linux-${version}-${arch==='x64'?'x86_64':arch}.AppImage`:null;
 const asset=release.assets?.find(a=>a.name===name&&a.state==='uploaded'&&a.size>0);
 const releaseURL=`${WEB}/releases/tag/v${version}`,downloadURL=`${WEB}/releases/download/v${version}/${name}`;
 if(!asset||asset.browser_download_url!==downloadURL||release.html_url!==releaseURL)return {available:false,current};
 return {available:true,current,version,url:releaseURL,downloadURL};
}
function issueContent(report){
 const json=JSON.stringify(report,null,2);if(json.length>45000)throw Error('Rapport trop volumineux. Exporte le fichier pour le joindre manuellement.');
 // Four-space indentation avoids user text terminating a Markdown code fence.
 return {title:`[BandPilot ${report.app.version}] ${report.summary||'Rapport de problème'}`.slice(0,180),body:`Rapport envoyé depuis BandPilot.\n\n<!-- bandpilot-report:${report.id} -->\n\n${json.split('\n').map(line=>'    '+line).join('\n')}`};
}
async function createIssue(fetcher,token,report){
 const result=await github(fetcher,'/issues',{method:'POST',token,body:issueContent(report)});
 if(!Number.isInteger(result.number)||result.html_url!==`${WEB}/issues/${result.number}`)throw Error('GitHub a répondu sans lien de suivi valide. Vérifie les issues avant de réessayer.');
 return {number:result.number,url:result.html_url};
}
async function findIssue(fetcher,token,id){
 const response=await fetcher(`https://api.github.com/search/issues?q=${encodeURIComponent(`repo:${REPOSITORY} is:issue "bandpilot-report:${id}" in:body`)}`,{redirect:'error',signal:AbortSignal.timeout(10000),headers:{Accept:'application/vnd.github+json',Authorization:`Bearer ${token}`,'User-Agent':'BandPilot'}});
 if(!response.ok)throw Error('Vérification des issues GitHub indisponible.');
 const data=await response.json();const match=data.items?.find(i=>i.body?.includes(`<!-- bandpilot-report:${id} -->`)&&i.html_url===`${WEB}/issues/${i.number}`);
 return match?{number:match.number,url:match.html_url}:null;
}
module.exports={REPOSITORY,WEB,newer,checkUpdate,issueContent,createIssue,findIssue,github};
