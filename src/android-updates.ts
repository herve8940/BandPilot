const repo='https://api.github.com/repos/herve8940/BandPilot';
const web='https://github.com/herve8940/BandPilot';
function parts(version:string){const match=/^(\d+)\.(\d+)\.(\d+)-android\.(\d+)$/.exec(version);return match?.slice(1).map(Number);}
export async function androidUpdate(current:string,fetcher=fetch){
 const response=await fetcher(repo+'/releases?per_page=30',{headers:{Accept:'application/vnd.github+json','User-Agent':'BandPilot-Android'},signal:AbortSignal.timeout(8000),redirect:'error'});
 if(!response.ok)throw Error('Recherche de mise à jour indisponible. Vérifie la connexion Internet.');
 const releases=await response.json() as {tag_name:string;draft:boolean;assets:{name:string;state:string;size:number;browser_download_url:string}[]}[];
 const now=parts(current);if(!now||!Array.isArray(releases))throw Error('Version Android invalide.');
 const candidates=releases.filter(r=>!r.draft&&r.tag_name?.startsWith('android-v')).map(r=>({r,version:r.tag_name.slice(9),numbers:parts(r.tag_name.slice(9))})).filter(x=>x.numbers);
 candidates.sort((a,b)=>{for(let i=0;i<4;i++){const delta=b.numbers![i]!-a.numbers![i]!;if(delta)return delta;}return 0;});
 for(const {r,version,numbers} of candidates){
  const different=numbers!.findIndex((n,i)=>n!==now[i]);if(different<0||numbers![different]!<now[different]!)continue;
  const name=`BandPilot-Android-${version}-universal.apk`,url=`${web}/releases/download/${r.tag_name}/${name}`;
  if(r.assets?.some(a=>a.name===name&&a.state==='uploaded'&&a.size>0&&a.browser_download_url===url))return {available:true,current,version,downloadURL:url};
 }
 return {available:false,current};
}
