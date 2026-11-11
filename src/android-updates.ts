const repo='https://api.github.com/repos/herve8940/BandPilot';
const web='https://github.com/herve8940/BandPilot';
export function androidVersion(version:string){const match=/^(\d+)\.(\d+)\.(\d+)-android\.(\d+)$/.exec(version);return match?.slice(1).map(Number);}
export function newerAndroid(version:string,current:string){const a=androidVersion(version),b=androidVersion(current);if(!a||!b)return false;const i=a.findIndex((n,i)=>n!==b[i]);return i>=0&&a[i]!>b[i]!;}
export function androidDownloadURL(version:string){return `${web}/releases/download/android-v${version}/BandPilot-Android-${version}-universal.apk`;}
export type AndroidRelease={available:boolean;current:string;version?:string;downloadURL?:string;automatic?:{url:string;size:number;sha256:string}};
export async function androidUpdate(current:string,fetcher=fetch):Promise<AndroidRelease>{
 if(!androidVersion(current))throw Error('Version Android invalide.');
 type Release={tag_name:string;draft:boolean;prerelease?:boolean;assets:{name:string;state:string;size:number;browser_download_url:string;digest?:string}[]};
 const releases:Release[]=[];
 // Desktop releases share this repository. Read beyond the first page when needed.
 for(let page=1;page<=3;page++){
  const response=await fetcher(`${repo}/releases?per_page=100&page=${page}`,{headers:{Accept:'application/vnd.github+json','User-Agent':'BandPilot-Android'},signal:AbortSignal.timeout(8000),redirect:'error'});
  if(!response.ok)throw Error('Recherche de mise à jour indisponible. Vérifie la connexion Internet.');
  const batch=await response.json();if(!Array.isArray(batch))throw Error('Réponse de mise à jour invalide.');releases.push(...batch);
  if(batch.length<100)break;
 }
 const candidates=releases.filter(r=>r&&!r.draft&&!r.prerelease&&typeof r.tag_name==='string'&&r.tag_name.startsWith('android-v')).map(r=>({r,version:r.tag_name.slice(9)})).filter(x=>newerAndroid(x.version,current));
 candidates.sort((a,b)=>newerAndroid(a.version,b.version)?-1:newerAndroid(b.version,a.version)?1:0);
 for(const {r,version} of candidates){
  const name=`BandPilot-Android-${version}-universal.apk`,url=androidDownloadURL(version);
  const asset=Array.isArray(r.assets)?r.assets.find(a=>a.name===name&&a.state==='uploaded'&&Number.isSafeInteger(a.size)&&a.size>0&&a.size<=300_000_000&&a.browser_download_url===url):undefined;
  if(asset){const sha256=/^sha256:([a-f0-9]{64})$/i.exec(asset.digest??'')?.[1]?.toLowerCase();return {available:true,current,version,downloadURL:url,...(sha256?{automatic:{url,size:asset.size,sha256}}:{})};}
 }
 return {available:false,current};
}
