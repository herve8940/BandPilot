// Stable releases are the only update candidates. Installed development builds
// may advance to the stable release of the same core version (SemVer ordering).
function parseVersion(value){
 if(typeof value!=='string')return null;
 const match=/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(value);
 if(!match)return null;
 const core=match.slice(1,4).map(Number);
 if(!core.every(Number.isSafeInteger)||match[4]?.split('.').some(part=>/^\d+$/.test(part)&&part.length>1&&part[0]==='0'))return null;
 return {core,prerelease:match[4]??null};
}
function newer(candidate,current){
 const a=parseVersion(candidate),b=parseVersion(current);
 if(!a||!b||a.prerelease)return false;
 for(let i=0;i<3;i++)if(a.core[i]!==b.core[i])return a.core[i]>b.core[i];
 return !!b.prerelease;
}
module.exports={parseVersion,newer};
